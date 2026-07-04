import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from packages.contracts import IRepository

logger = logging.getLogger(__name__)

DOI_FLOOR = '2022-12-25'

REVENUE_QUERY = '''
    SELECT
        "Invoice date", "Invoice No", "Invoice Type", "Cust_code", "Cust_name",
        "Segment", "Sales Head", "Module WP", "Material Code",
        "Mat Desc", "HSN CODE/SAC Code", "SalesQty", "UnitPrice",
        "Taxable Value", "CGST Amount", "SGST Amount", "IGST Amount",
        "Net Value", "UOM", "Plant", "Storage Location", "Vehicle No.",
        "S.O.Number", "Incoterms", "Invoice Status", "Revenue", "Eway Expiry",
        "MW"
    FROM public.revenue
    WHERE "Invoice date" > %s::timestamp
'''

_PLATFORM_REPO: Optional[IRepository] = None
_STANDALONE_REPO: Optional[IRepository] = None
_all_rows_cache = None
_date_range_cache = None

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

def get_repo() -> IRepository:
    global _STANDALONE_REPO
    if _PLATFORM_REPO:
        return _PLATFORM_REPO
    if _STANDALONE_REPO:
        return _STANDALONE_REPO
    # Standalone fallback: try POSTGRES_URL env
    pg_url = os.getenv('POSTGRES_URL') or os.getenv('DATABASE_URL')
    if not pg_url:
        # Try individual PG_* vars
        host = os.getenv('PG_HOST')
        port = os.getenv('PG_PORT', '5432')
        user = os.getenv('PG_USER')
        password = os.getenv('PG_PASSWORD')
        database = os.getenv('PG_DATABASE')
        if host and user and password and database:
            import urllib.parse
            encoded = urllib.parse.quote_plus(password)
            pg_url = f'postgresql://{user}:{encoded}@{host}:{port}/{database}'
    if pg_url:
        try:
            _STANDALONE_REPO = PostgreSQLRepository(pg_url)
            return _STANDALONE_REPO
        except Exception as e:
            logger.warning('Revenue: PostgreSQL failed (%s)', e)
    raise RuntimeError('No database configured for Revenue module')

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
        # Map 'Invoice date' to Python datetime
        for row in rows:
            dt = row.get('Invoice date')
            if dt and not isinstance(dt, datetime):
                try:
                    row['Invoice date'] = datetime.fromisoformat(str(dt))
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
            d = r.get('Invoice date')
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
    def clear_cache(cls):
        cls._all_rows_cache = None
        cls._date_range_cache = None
        logger.info('Revenue repository cache cleared')
