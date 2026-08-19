import json
import logging
import os
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any, Dict, List, Optional

try:
    # Available when loaded as a module inside the GrewAnalytics platform.
    from packages.contracts import IRepository
except ImportError:
    # Standalone server: no platform contracts package on the path.
    from abc import ABC

    class IRepository(ABC):  # minimal structural base — methods defined below
        pass

logger = logging.getLogger(__name__)

DOI_FLOOR = '2022-12-25'

REVENUE_QUERY = '''
    SELECT
        invoice_date, invoice_no, invoice_type, cust_code, cust_name,
        segment, sales_head, module_wp, material_code,
        mat_desc, hsn_code_sac_code, sales_qty, unit_price,
        taxable_value, cgst_amount, sgst_amount, igst_amount,
        net_value, uom, plant, storage_location, vehicle_no,
        so_number, incoterms, invoice_status, revenue, eway_expiry,
        mw
    FROM revenue.revenue
    WHERE invoice_date > %s::timestamp
'''

_PLATFORM_REPO: Optional[IRepository] = None
_STANDALONE_REPO: Optional[IRepository] = None
_all_rows_cache = None
_date_range_cache = None

# Standalone credential resolution state (mirrors Node revenueRepository.js).
CREDS_TTL_S = 10 * 60  # re-fetch credentials every 10 minutes
_creds_fetched_at = 0.0
_cred_hash = ''


def fetch_db_config() -> Dict[str, Any]:
    """Which DB do we use — single source of truth (Node fetchDbConfig parity).

    Priority 1: complete local .env PG_* vars.  Priority 2: the Supabase
    ``db-credentials`` edge function.  Returns the PG config plus a ``source``
    field ('local_env' | 'edge_function').
    """
    env = lambda k: (os.getenv(k) or '').strip()
    if env('PG_HOST') and env('PG_USER') and env('PG_PASSWORD') and env('PG_DATABASE'):
        return {
            'host': env('PG_HOST'),
            'port': int(env('PG_PORT') or '5432'),
            'user': env('PG_USER'),
            'password': env('PG_PASSWORD'),
            'database': env('PG_DATABASE'),
            'source': 'local_env',
        }
    if env('PG_HOST'):
        logger.warning('db_credentials_env_incomplete: PG_HOST set but PG_USER/PG_PASSWORD/PG_DATABASE incomplete — falling back to edge function')

    supabase_url = os.getenv('VITE_SUPABASE_URL')
    anon_key = os.getenv('VITE_SUPABASE_ANON_KEY')
    if not supabase_url or not anon_key:
        raise RuntimeError(
            'No database credentials found. Set PG_HOST/PG_PORT/PG_USER/PG_PASSWORD/PG_DATABASE in .env, '
            'or set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use the Supabase db-credentials function.'
        )

    # ponytail: stdlib urllib blocks the event loop; fine for this internal
    # tool (single-worker uvicorn, 10-min creds cache). Swap to httpx if it ever
    # runs multi-worker under real concurrency.
    req = urllib.request.Request(
        f'{supabase_url}/functions/v1/db-credentials',
        headers={'apikey': anon_key, 'Authorization': f'Bearer {anon_key}'},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            config = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.reason
        try:
            detail = json.loads(e.read().decode()).get('error', detail)
        except Exception:
            pass
        raise RuntimeError(
            f'Supabase db-credentials returned {e.code}: {detail}. '
            'Ensure PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE are set as Supabase secrets.'
        )
    except urllib.error.URLError as e:
        raise RuntimeError(f'Network error reaching Supabase db-credentials: {e.reason}')

    config['source'] = 'edge_function'
    return config

def set_platform_repo(repo: IRepository):
    global _PLATFORM_REPO
    _PLATFORM_REPO = repo

class PostgreSQLRepository(IRepository):
    """IRepository backed by PostgreSQL via psycopg2."""
    def __init__(self, dsn: str):
        import psycopg2, psycopg2.extras
        self._psycopg2 = psycopg2
        self._extras = psycopg2.extras
        self._dsn = dsn
        self._con = psycopg2.connect(dsn)
        self._con.autocommit = True
        logger.info("Revenue: PostgreSQL repository connected (%s)", dsn.split('@')[-1])

    def _cursor(self):
        try:
            if self._con.closed:
                raise Exception("closed")
            return self._con.cursor(cursor_factory=self._extras.RealDictCursor)
        except Exception:
            self._con = self._psycopg2.connect(self._dsn)
            self._con.autocommit = True
            return self._con.cursor(cursor_factory=self._extras.RealDictCursor)

    def execute(self, query, params=None):
        cur = self._cursor()
        cur.execute(query, params)
        return cur

    def fetch_all(self, query, params=None) -> List[Dict[str, Any]]:
        cur = self.execute(query, params)
        return [dict(row) for row in cur.fetchall()]

    def fetch_one(self, query, params=None) -> Optional[Dict[str, Any]]:
        cur = self.execute(query, params)
        row = cur.fetchone()
        return dict(row) if row else None

    def get_dataframe(self, query, params=None):
        import pandas as pd
        return pd.read_sql_query(query, self._con, params=params)

def _dsn_from(cfg: Dict[str, Any]) -> str:
    import urllib.parse
    pwd = urllib.parse.quote_plus(str(cfg.get('password', '')))
    ssl = cfg.get('ssl')
    sslmode = '?sslmode=require' if (ssl is True or str(ssl).lower() == 'true') else ''
    return (
        f"postgresql://{cfg['user']}:{pwd}@{cfg['host']}:"
        f"{cfg.get('port', 5432)}/{cfg['database']}{sslmode}"
    )


def get_repo() -> IRepository:
    """Return the active repository.

    Platform-injected repo wins. Otherwise (standalone server) resolve
    credentials via ``fetch_db_config`` and cache the connection, re-fetching
    after CREDS_TTL_S or when the target DB changes (matches Node getPool()).
    """
    global _STANDALONE_REPO, _creds_fetched_at, _cred_hash
    if _PLATFORM_REPO:
        return _PLATFORM_REPO

    fresh = _STANDALONE_REPO is not None and (time.time() - _creds_fetched_at) < CREDS_TTL_S
    if fresh:
        return _STANDALONE_REPO

    cfg = fetch_db_config()
    new_hash = f"{cfg['host']}:{cfg.get('port', 5432)}/{cfg['database']}/{cfg['user']}"
    if new_hash != _cred_hash:
        if _cred_hash:
            logger.info('db_switched: %s -> %s', _cred_hash, new_hash)
        RevenueRepository.clear_cache()  # discard rows cached from the previous DB
        _cred_hash = new_hash

    _STANDALONE_REPO = PostgreSQLRepository(_dsn_from(cfg))
    _creds_fetched_at = time.time()
    return _STANDALONE_REPO


def clear_db_cache():
    """Reset standalone connection + credential TTL so the next request
    re-resolves the DB (used by POST /api/v1/db/switch)."""
    global _STANDALONE_REPO, _creds_fetched_at, _cred_hash
    _STANDALONE_REPO = None
    _creds_fetched_at = 0.0
    _cred_hash = ''
    RevenueRepository.clear_cache()

def fetch_dict(query, params=None):
    return get_repo().fetch_all(query, params)

def fetch_one_row(query, params=None):
    return get_repo().fetch_one(query, params)

class RevenueRepository:
    _all_rows_cache = None
    _date_range_cache = None

    @classmethod
    def find_all(cls):
        if cls._all_rows_cache is not None:
            return cls._all_rows_cache
        rows = fetch_dict(REVENUE_QUERY, (DOI_FLOOR,))
        # Map invoice_date to Python datetime
        for row in rows:
            dt = row.get('invoice_date')
            if dt and not isinstance(dt, datetime):
                try:
                    row['invoice_date'] = datetime.fromisoformat(str(dt))
                except (ValueError, TypeError):
                    pass
        cls._all_rows_cache = rows
        return rows

    @classmethod
    def get_date_range(cls):
        if cls._date_range_cache:
            return cls._date_range_cache
        rows = cls.find_all()
        if not rows:
            return {'min_date': '2022-12-26', 'max_date': '2022-12-26'}
        dates = []
        for r in rows:
            d = r.get('invoice_date')
            if isinstance(d, datetime):
                dates.append(d)
        if not dates:
            return {'min_date': '2022-12-26', 'max_date': '2022-12-26'}
        doi_floor = datetime(2022, 12, 26)
        min_d = max(min(dates), doi_floor)
        max_d = max(dates)
        cls._date_range_cache = {'min_date': min_d, 'max_date': max_d}
        return cls._date_range_cache

    @classmethod
    def get_load_history(cls):
        """DB load audit log (mirrors Node RevenueRepository.getLoadHistory)."""
        try:
            return fetch_dict(
                "SELECT id, table_name, loaded_at, rows_count, status "
                "FROM public.data_load_history "
                "ORDER BY loaded_at DESC LIMIT 50"
            )
        except Exception as e:
            logger.error("database_query_failed getLoadHistory: %s", e)
            return []

    @classmethod
    def clear_cache(cls):
        cls._all_rows_cache = None
        cls._date_range_cache = None
        logger.info('Revenue repository cache cleared')

    def get_mb51_sales(self, customer_codes: list, from_date: str, to_date: str) -> list:
        """Aggregate MB51 sales (posting-level) for given customers & date range.
        Returns rows of (customer_code, dd.mm.yyyy posting date, abs amount in local currency).
        """
        if not customer_codes:
            return []
        placeholders = ",".join(["%s"] * len(customer_codes))
        sql = f"""
            SELECT "Customer" AS customer_code,
                   to_char("Posting Date", 'DD.MM.YYYY') AS posting_date,
                   ABS(SUM("Amt.in Loc.Cur.")) AS amount,
                   ABS(SUM("Qty")) AS qty,
                   ABS(SUM("MW")) AS mw
            FROM revenue.mb51
            WHERE "Customer" IN ({placeholders})
              AND "Posting Date" >= %s AND "Posting Date" <= %s
              AND "Movement Type" IN ('601', '602')
            GROUP BY 1, 2
        """
        params = customer_codes + [from_date, to_date]
        return fetch_dict(sql, params)
