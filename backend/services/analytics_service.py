import logging
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from apps.Revenue.backend.services.revenue_service import RevenueService
from apps.Revenue.backend.database import RevenueRepository
from apps.Revenue.backend.services.cache import Cache

logger = logging.getLogger(__name__)

ROWS_TTL_S = 5 * 60  # 5 minutes
CURRENCY_DIVIDER = 10_000_000  # Crores
MIN_DATE = '2022-12-26'
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']


class AnalyticsService:
    _rows_cache: Optional[list] = None
    _rows_cache_time: float = 0

    # ------------------------------------------------------------------
    # Internal caching helpers
    # ------------------------------------------------------------------

    @classmethod
    async def _load_rows(cls) -> list:
        """Load rows from RevenueService and parse date strings back to datetime."""
        raw = await RevenueService.get_clean_revenue()
        rows: list = []
        for r in raw:
            r_copy = dict(r)
            if isinstance(r_copy.get('date'), str):
                try:
                    r_copy['date'] = datetime.fromisoformat(r_copy['date'])
                except (ValueError, TypeError):
                    continue
            rows.append(r_copy)
        return rows

    @classmethod
    async def _get_rows(cls) -> list:
        """Return cached rows or reload if TTL has expired."""
        now = time.time()
        if cls._rows_cache and (now - cls._rows_cache_time) < ROWS_TTL_S:
            return cls._rows_cache
        cls._rows_cache = await cls._load_rows()
        cls._rows_cache_time = now
        return cls._rows_cache

    @classmethod
    def clear_cache(cls) -> None:
        cls._rows_cache = None
        cls._rows_cache_time = 0

    # ------------------------------------------------------------------
    # meta – bootstrap metadata for the front-end
    # ------------------------------------------------------------------

    @classmethod
    async def meta(cls) -> dict:
        """Bootstrap metadata: dates, filter dimensions, record count."""
        rows = await cls._get_rows()
        if not rows:
            return {
                'latestDate': None, 'minDate': None, 'maxDate': None,
                'years': [], 'segments': [], 'skus': [], 'customers': [],
                'totalRecords': 0,
            }

        max_t: Optional[datetime] = None
        min_t: Optional[datetime] = None
        years_set: set = set()
        segs_set: set = set()
        skus_set: set = set()
        custs_set: set = set()

        for r in rows:
            d = r.get('date')
            if not isinstance(d, datetime):
                continue
            if max_t is None or d > max_t:
                max_t = d
            if min_t is None or d < min_t:
                min_t = d

            month_idx = r.get('monthIdx', d.month - 1)
            year = r.get('year', d.year)
            fy = year + 1 if month_idx >= 3 else year
            years_set.add(fy)

            seg = r.get('segment')
            if seg:
                segs_set.add(seg)
            wp = r.get('wp')
            if wp:
                skus_set.add(wp)
            cust = r.get('customer')
            if cust:
                custs_set.add(cust)

        def _fmt(d: Optional[datetime]) -> Optional[str]:
            return d.strftime('%Y-%m-%d') if d else None

        return {
            'latestDate': _fmt(max_t),
            'minDate': _fmt(min_t),
            'maxDate': _fmt(max_t),
            'years': sorted(years_set, reverse=True),
            'segments': sorted(segs_set),
            'skus': sorted(skus_set),
            'customers': sorted(custs_set),
            'totalRecords': len(rows),
        }

    # ------------------------------------------------------------------
    # compute_summary – operates on RAW DB rows for perf parity with Node
    # ------------------------------------------------------------------

    @classmethod
    async def compute_summary(cls, filters: dict) -> dict:
        """Port of getRevenueSummary from revenueController.js.
        Operates on RAW DB rows (not sanitized) for performance parity."""
        all_rows = RevenueRepository.find_all()

        # ---- Determine date range ----
        start_date = filters.get('startDate')
        end_date = filters.get('endDate')
        if not start_date or not end_date:
            date_range = RevenueRepository.get_date_range()
            if not start_date:
                md = date_range['min_date']
                start_date = md.strftime('%Y-%m-%d') if isinstance(md, datetime) else str(md)
            if not end_date:
                md = date_range['max_date']
                end_date = md.strftime('%Y-%m-%d') if isinstance(md, datetime) else str(md)

        # Enforce minimum date
        if start_date <= MIN_DATE:
            start_date = MIN_DATE
        if end_date <= MIN_DATE:
            end_date = MIN_DATE

        segments = filters.get('segment', [])
        sales_heads = filters.get('salesHead', [])
        customers = filters.get('customer', [])
        pending_only = filters.get('pendingOnly', False)
        excluded = filters.get('excludeWp', [])

        start_dt = datetime.strptime(start_date, '%Y-%m-%d')
        end_dt = datetime.strptime(end_date, '%Y-%m-%d')

        # ---- Row filter predicate ----
        def matches(row: dict) -> bool:
            dt = row.get('Invoice date')
            if not isinstance(dt, datetime):
                return False
            if dt < start_dt or dt > end_dt:
                return False
            if segments and row.get('Segment') not in segments:
                return False
            if sales_heads:
                sh = row.get('Sales Head')
                if sh not in sales_heads and not ('Direct/Unmapped' in sales_heads and not sh):
                    return False
            if customers and row.get('Cust_name') not in customers:
                return False
            if excluded:
                wp = row.get('Module WP') or 'Generic'
                if str(wp) in excluded:
                    return False
            return True

        base_rows = [r for r in all_rows if matches(r)]

        def is_pending(row: dict) -> bool:
            rev = str(row.get('Revenue', '') or '').lower()
            return 'pending' in rev

        if pending_only:
            view_rows = [r for r in base_rows if is_pending(r)]
        else:
            view_rows = [r for r in base_rows if not is_pending(r)]

        # ---- Compute totals ----
        total_val = sum(float(r.get('Taxable Value') or 0) for r in view_rows)
        total_mw = sum(float(r.get('MW') or 0) for r in view_rows)
        total_qty = sum(float(r.get('SalesQty') or 0) for r in view_rows)
        pending_val = sum(float(r.get('Taxable Value') or 0) for r in base_rows if is_pending(r))

        # ---- Compute breakdowns ----
        segment_map: Dict[str, Dict[str, float]] = {}
        sales_head_map: Dict[str, Dict[str, float]] = {}
        customer_map: Dict[str, Dict[str, float]] = {}
        wp_map: Dict[str, Dict[str, float]] = {}
        monthly_map: Dict[int, dict] = {}

        for row in view_rows:
            val = float(row.get('Taxable Value') or 0)
            mw = float(row.get('MW') or 0)
            qty = float(row.get('SalesQty') or 0)

            # Segment
            seg = row.get('Segment') or ''
            if seg:
                entry = segment_map.setdefault(seg, {'val': 0, 'mw': 0, 'qty': 0})
                entry['val'] += val
                entry['mw'] += mw
                entry['qty'] += qty

            # Sales Head
            sh = row.get('Sales Head') or 'Direct/Unmapped'
            entry = sales_head_map.setdefault(sh, {'val': 0, 'mw': 0, 'qty': 0})
            entry['val'] += val
            entry['mw'] += mw
            entry['qty'] += qty

            # Customer
            cust = row.get('Cust_name') or 'Unidentified'
            entry = customer_map.setdefault(cust, {'val': 0, 'mw': 0, 'qty': 0})
            entry['val'] += val
            entry['mw'] += mw
            entry['qty'] += qty

            # WP / SKU
            wp = row.get('Module WP') or 'Generic'
            entry = wp_map.setdefault(str(wp), {'val': 0, 'mw': 0, 'qty': 0})
            entry['val'] += val
            entry['mw'] += mw
            entry['qty'] += qty

            # Monthly trend
            dt = row.get('Invoice date')
            if isinstance(dt, datetime):
                m_idx = dt.month - 1  # 0-11
                if m_idx not in monthly_map:
                    monthly_map[m_idx] = {
                        'monthName': MONTHS[m_idx],
                        'monthIdx': m_idx + 1,
                        'val': 0, 'mw': 0, 'qty': 0,
                    }
                monthly_map[m_idx]['val'] += val
                monthly_map[m_idx]['mw'] += mw
                monthly_map[m_idx]['qty'] += qty

        def _to_ranked_list(m: dict) -> list:
            return sorted(
                [{'name': k, **v} for k, v in m.items()],
                key=lambda x: x['val'],
                reverse=True,
            )

        return {
            'totals': {
                'value': total_val,
                'mw': total_mw,
                'qty': total_qty,
                'pendingValue': pending_val,
            },
            'breakdowns': {
                'segment': _to_ranked_list(segment_map),
                'salesHead': _to_ranked_list(sales_head_map),
                'customer': _to_ranked_list(customer_map)[:20],
                'wp': _to_ranked_list(wp_map),
            },
            'monthlyTrend': sorted(
                [{'month': v['monthName'], 'monthIdx': v['monthIdx'],
                  'val': v['val'], 'mw': v['mw'], 'qty': v['qty']}
                 for v in monthly_map.values()],
                key=lambda x: x['monthIdx'],
            ),
        }

    # ------------------------------------------------------------------
    # analytics – core KPIs, groupings, daily series (sanitized rows)
    # ------------------------------------------------------------------

    @classmethod
    async def analytics(cls, filters: dict) -> dict:
        """Simplified analytics: core KPIs, groupings, daily series."""
        rows = await cls._get_rows()
        if not rows:
            return cls._empty_analytics()

        # Find latest date across the full dataset
        latest_date = max(
            (r['date'] for r in rows if isinstance(r.get('date'), datetime)),
            default=datetime.now(),
        )

        # ---- Extract filter values ----
        f_segments = set(filters.get('segment') or [])
        f_sales_heads = set(filters.get('salesHead') or [])
        f_customers = set(filters.get('customer') or [])
        f_skus = set(filters.get('selectedSku') or [])
        f_excluded = set(filters.get('excludedSeries') or [])
        f_pending = filters.get('pendingOnly', False)
        f_start = filters.get('startDate', '')
        f_end = filters.get('endDate', '')

        start_dt = datetime.strptime(f_start, '%Y-%m-%d') if f_start else None
        end_dt = (
            datetime.strptime(f_end, '%Y-%m-%d').replace(hour=23, minute=59, second=59)
            if f_end else None
        )

        # ---- Apply filters ----
        filtered: List[dict] = []
        for r in rows:
            d = r.get('date')
            if not isinstance(d, datetime):
                continue
            if start_dt and d < start_dt:
                continue
            if end_dt and d > end_dt:
                continue
            if f_segments and r.get('segment') not in f_segments:
                continue
            if f_sales_heads and r.get('salesHead') not in f_sales_heads:
                continue
            if f_customers and r.get('customer') not in f_customers:
                continue
            if f_skus and r.get('wp') not in f_skus:
                continue
            if f_excluded and r.get('wp') in f_excluded:
                continue
            is_pend = r.get('isPending', False)
            if f_pending and not is_pend:
                continue
            if not f_pending and is_pend:
                continue
            filtered.append(r)

        # ---- Compute totals ----
        total_val = sum(r.get('val', 0) for r in filtered)
        total_mw = sum(r.get('mw', 0) for r in filtered)
        total_qty = sum(r.get('qty', 0) for r in filtered)
        total_cr = total_val / CURRENCY_DIVIDER

        realization = total_cr / total_mw if total_mw > 0 else 0

        # ---- Group by sales-head, customer, wp ----
        sh_map: Dict[str, float] = {}
        cust_map: Dict[str, float] = {}
        wp_map: Dict[str, float] = {}
        segs_active: set = set()
        plot_keys: set = set()

        for r in filtered:
            val_cr = r.get('val', 0) / CURRENCY_DIVIDER

            sh = r.get('salesHead', 'Direct/Unmapped')
            sh_map[sh] = sh_map.get(sh, 0) + val_cr

            cust = r.get('customer', 'Unidentified')
            cust_map[cust] = cust_map.get(cust, 0) + val_cr

            wp = r.get('wp', 'Generic')
            wp_map[wp] = wp_map.get(wp, 0) + val_cr
            plot_keys.add(wp)

            seg = r.get('segment')
            if seg:
                segs_active.add(seg)

        sh_list = sorted(
            [{'name': k, 'v': v} for k, v in sh_map.items()],
            key=lambda x: x['v'], reverse=True,
        )
        cust_list = sorted(
            [{'name': k, 'v': v} for k, v in cust_map.items()],
            key=lambda x: x['v'], reverse=True,
        )
        wp_list = sorted(
            [{'name': k, 'v': v} for k, v in wp_map.items()],
            key=lambda x: x['v'], reverse=True,
        )

        # ---- Daily series ----
        daily_map: Dict[str, Dict[str, float]] = {}
        for r in filtered:
            d = r.get('date')
            if not isinstance(d, datetime):
                continue
            ds = d.strftime('%Y-%m-%d')
            if ds not in daily_map:
                daily_map[ds] = {'val': 0, 'mw': 0, 'qty': 0}
            daily_map[ds]['val'] += r.get('val', 0)
            daily_map[ds]['mw'] += r.get('mw', 0)
            daily_map[ds]['qty'] += r.get('qty', 0)

        daily_series = sorted(
            [{'date': k, **v} for k, v in daily_map.items()],
            key=lambda x: x['date'], reverse=True,
        )

        # ---- Last 7 days sales ----
        seven_days_ago = latest_date - timedelta(days=7)
        last7 = sum(
            r.get('val', 0)
            for r in filtered
            if isinstance(r.get('date'), datetime) and r['date'] >= seven_days_ago
        ) / CURRENCY_DIVIDER

        # ---- KPI: MTD, QTD, YTD (fiscal calendar) ----
        anchor = latest_date
        mtd_start = anchor.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Fiscal quarters: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar
        m = anchor.month
        if m in (4, 5, 6):
            qtd_start = anchor.replace(month=4, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif m in (7, 8, 9):
            qtd_start = anchor.replace(month=7, day=1, hour=0, minute=0, second=0, microsecond=0)
        elif m in (10, 11, 12):
            qtd_start = anchor.replace(month=10, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            qtd_start = anchor.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)

        # Fiscal year starts April 1
        if anchor.month >= 4:
            ytd_start = anchor.replace(month=4, day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            ytd_start = anchor.replace(
                year=anchor.year - 1, month=4, day=1,
                hour=0, minute=0, second=0, microsecond=0,
            )

        def _sum_since(start: datetime, key: str = 'val') -> float:
            return sum(
                r.get(key, 0)
                for r in filtered
                if isinstance(r.get('date'), datetime) and r['date'] >= start
            )

        mtd_val = _sum_since(mtd_start) / CURRENCY_DIVIDER
        qtd_val = _sum_since(qtd_start) / CURRENCY_DIVIDER
        ytd_val = _sum_since(ytd_start) / CURRENCY_DIVIDER
        pending_val = sum(
            r.get('val', 0) for r in rows if r.get('isPending', False)
        ) / CURRENCY_DIVIDER

        # Check if only solar segments are active
        is_only_solar = len(segs_active) == 1 and 'Solar' in segs_active

        return {
            'kpi': {
                'periodSales': total_cr,
                'periodBreakdown': {},
                'periodActiveKeys': list(plot_keys),
                'mtd': mtd_val,
                'mtdBreakdown': {},
                'qtd': qtd_val,
                'qtdBreakdown': {},
                'ytd': ytd_val,
                'ytdBreakdown': {},
                'prevMtd': 0,
                'prevQtd': 0,
                'prevYtd': 0,
                'pending': pending_val,
                'pendingBreakdown': {},
            },
            'totalCr': total_cr,
            'totalMW': total_mw,
            'totalQty': total_qty,
            'realization': realization,
            'sh': sh_list,
            'cust': cust_list,
            'wp': wp_list,
            'dailySeries': daily_series,
            'last7DaysSales': last7,
            'kpiAnchorDate': anchor.isoformat(),
            'activeSegments': sorted(segs_active),
            'activePlotKeys': sorted(plot_keys),
            'isOnlySolar': is_only_solar,
            'rawFiltered': [],
            'matrix': [],
            'insights': [],
            'storyInsights': [],
            'prevYearMtd': 0,
            'buckets': {
                'chart': {
                    'monthly': {},
                    'weekly': {},
                    'daily': {},
                    'quarterly': {},
                },
            },
            'kpiCr': mtd_val,
            'kpiMW': _sum_since(mtd_start, 'mw'),
            'kpiQty': _sum_since(mtd_start, 'qty'),
        }

    # ------------------------------------------------------------------
    # Empty analytics stub
    # ------------------------------------------------------------------

    @staticmethod
    def _empty_analytics() -> dict:
        return {
            'kpi': {
                'periodSales': 0, 'periodBreakdown': {}, 'periodActiveKeys': [],
                'mtd': 0, 'mtdBreakdown': {}, 'qtd': 0, 'qtdBreakdown': {},
                'ytd': 0, 'ytdBreakdown': {}, 'prevMtd': 0, 'prevQtd': 0, 'prevYtd': 0,
                'pending': 0, 'pendingBreakdown': {},
            },
            'totalCr': 0, 'totalMW': 0, 'totalQty': 0, 'realization': 0,
            'sh': [], 'cust': [], 'wp': [], 'dailySeries': [],
            'last7DaysSales': 0, 'kpiAnchorDate': None,
            'activeSegments': [], 'activePlotKeys': [],
            'isOnlySolar': False, 'rawFiltered': [],
            'matrix': [], 'insights': [], 'storyInsights': [],
            'prevYearMtd': 0,
            'buckets': {
                'chart': {
                    'monthly': {},
                    'weekly': {},
                    'daily': {},
                    'quarterly': {},
                },
            },
            'kpiCr': 0, 'kpiMW': 0, 'kpiQty': 0,
        }
