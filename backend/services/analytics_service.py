import calendar
import logging
import math
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from .revenue_service import RevenueService
from ..database import RevenueRepository
from .cache import Cache

logger = logging.getLogger(__name__)

ROWS_TTL_S = 5 * 60  # 5 minutes
CURRENCY_DIVIDER = 10_000_000  # Crores
MIN_DATE = '2022-12-26'
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
FISCAL_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
                 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
QTR_MAP = {
    3: 0, 4: 0, 5: 0,
    6: 1, 7: 1, 8: 1,
    9: 2, 10: 2, 11: 2,
    0: 3, 1: 3, 2: 3,
}


class AnalyticsService:
    _rows_cache: Optional[list] = None
    _rows_cache_time: float = 0

    # ------------------------------------------------------------------
    # Internal caching helpers
    # ------------------------------------------------------------------

    @classmethod
    async def _load_rows(cls) -> list:
        """Load rows from RevenueService directly with datetime objects."""
        return await RevenueService.get_clean_revenue(iso_dates=False)

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
            dt = row.get('invoice_date')
            if not isinstance(dt, datetime):
                return False
            if dt < start_dt or dt > end_dt:
                return False
            if segments and row.get('segment') not in segments:
                return False
            if sales_heads:
                sh = row.get('sales_head')
                if sh not in sales_heads and not ('Direct/Unmapped' in sales_heads and not sh):
                    return False
            if customers and row.get('cust_name') not in customers:
                return False
            if excluded:
                wp = row.get('module_wp') or 'Generic'
                if str(wp) in excluded:
                    return False
            return True

        base_rows = [r for r in all_rows if matches(r)]

        def is_pending(row: dict) -> bool:
            rev = str(row.get('revenue', '') or '').lower()
            return 'pending' in rev

        if pending_only:
            view_rows = [r for r in base_rows if is_pending(r)]
        else:
            view_rows = [r for r in base_rows if not is_pending(r)]

        # ---- Compute totals ----
        total_val = sum(float(r.get('taxable_value') or 0) for r in view_rows)
        total_mw = sum(float(r.get('mw') or 0) for r in view_rows)
        total_qty = sum(float(r.get('sales_qty') or 0) for r in view_rows)
        pending_val = sum(float(r.get('taxable_value') or 0) for r in base_rows if is_pending(r))

        # ---- Compute breakdowns ----
        segment_map: Dict[str, Dict[str, float]] = {}
        sales_head_map: Dict[str, Dict[str, float]] = {}
        customer_map: Dict[str, Dict[str, float]] = {}
        wp_map: Dict[str, Dict[str, float]] = {}
        monthly_map: Dict[int, dict] = {}

        for row in view_rows:
            val = float(row.get('taxable_value') or 0)
            mw = float(row.get('mw') or 0)
            qty = float(row.get('sales_qty') or 0)

            # Segment
            seg = row.get('segment') or ''
            if seg:
                entry = segment_map.setdefault(seg, {'val': 0, 'mw': 0, 'qty': 0})
                entry['val'] += val
                entry['mw'] += mw
                entry['qty'] += qty

            # Sales Head
            sh = row.get('sales_head') or 'Direct/Unmapped'
            entry = sales_head_map.setdefault(sh, {'val': 0, 'mw': 0, 'qty': 0})
            entry['val'] += val
            entry['mw'] += mw
            entry['qty'] += qty

            # Customer
            cust = row.get('cust_name') or 'Unidentified'
            entry = customer_map.setdefault(cust, {'val': 0, 'mw': 0, 'qty': 0})
            entry['val'] += val
            entry['mw'] += mw
            entry['qty'] += qty

            # WP / SKU
            wp = row.get('module_wp') or 'Generic'
            entry = wp_map.setdefault(str(wp), {'val': 0, 'mw': 0, 'qty': 0})
            entry['val'] += val
            entry['mw'] += mw
            entry['qty'] += qty

            # Monthly trend
            dt = row.get('invoice_date')
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
    # analytics – TS RevenueComputeEngine.compute() parity port
    # ------------------------------------------------------------------

    @classmethod
    async def analytics(cls, filters: dict) -> dict:
        """Port of RevenueComputeEngine.compute() (packages/shared/src/index.ts).

        Emits the exact shape the React frontend consumes: kpi (with paced
        mtd/qtd/ytd + breakdowns), matrix, sh/cust/wp entities with
        n/raw/plotKeys/comps, buckets.chart.{monthly,weekly,daily,quarterly},
        ytdWeekly (5 RAW groups), mb51SalesPeriods, dailySeries, last7DaysSales.
        """
        rows = await cls._get_rows()
        if not rows:
            return cls._empty_analytics()

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
        metric = filters.get('metric', 'Amount')
        f_start = filters.get('startDate', '')
        f_end = filters.get('endDate', '')

        start_dt = datetime.strptime(f_start, '%Y-%m-%d') if f_start else None
        end_dt = (
            datetime.strptime(f_end, '%Y-%m-%d').replace(hour=23, minute=59, second=59, microsecond=999999)
            if f_end else None
        )

        DIVIDER = CURRENCY_DIVIDER
        is_amount = metric == 'Amount'
        is_mw = metric == 'MW'

        def metric_of(val: float, mw: float, qty: float) -> float:
            """Divided metric value (Amount → Cr); raw MW / Qty."""
            if is_amount:
                return val / DIVIDER
            if is_mw:
                return mw
            return qty

        # ---- kpiAnchorDate / curMonth / curKey / curFYStartYear helpers ----
        anchor_date = latest_date
        if filters.get('endDate'):
            try:
                anchor_date = datetime.strptime(filters['endDate'], '%Y-%m-%d')
            except ValueError:
                pass
        if anchor_date > latest_date:
            anchor_date = latest_date
        anchor = anchor_date.replace(hour=23, minute=59, second=59, microsecond=999999)

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

        anchor_day = anchor_date.day
        cur_month = anchor_date.month - 1  # 0-indexed (0=Jan)
        cur_year = anchor_date.year
        cur_key = f"{cur_year}-{cur_month:02d}"
        cur_fy_start_year = ytd_start.year

        # ---- PASS 1: pacing datasets over ALL rows (TS 849-935) ----
        global_full: Dict[str, dict] = {}
        global_paced: Dict[str, dict] = {}

        # Like-for-like MoM baseline: previous month truncated to the anchor day
        prev_anchor_year = cur_year - 1 if cur_month == 0 else cur_year
        prev_anchor_month = 11 if cur_month == 0 else cur_month - 1

        prev_month_to_date = 0.0
        prev_month_to_date_has_data = False

        kpi = {
            'periodSales': 0.0,
            'periodBreakdown': {},
            'periodActiveKeys': set(),
            'mtd': 0.0,
            'mtdBreakdown': {},
            'qtd': 0.0,
            'qtdBreakdown': {},
            'ytd': 0.0,
            'ytdBreakdown': {},
            'prevMtd': 0.0,
            'prevQtd': 0.0,
            'prevYtd': 0.0,
            'pending': 0.0,
            'pendingBreakdown': {},
        }
        last7_days_sales = 0.0

        for r in rows:
            # segment -> exclusion -> drilldown -> accumulation
            if f_segments and r.get('segment') not in f_segments:
                continue
            r_date = r.get('date')
            if not isinstance(r_date, datetime):
                continue
            r_month = r_date.month - 1
            r_year = r_date.year
            r_day = r_date.day
            r_wp = r.get('wp', 'Generic')
            key = f"{r_year}-{r_month:02d}"
            is_paced = r_month != cur_month or r_day <= anchor_day
            val = r.get('val', 0.0)
            mw = r.get('mw', 0.0)
            qty = r.get('qty', 0.0)
            metric_val = metric_of(val, mw, qty)

            if r_wp in f_excluded:
                continue
            if f_sales_heads and r.get('salesHead') not in f_sales_heads:
                continue
            if f_customers and r.get('customer') not in f_customers:
                continue
            if f_skus and r_wp not in f_skus:
                continue

            is_pend = r.get('isPending', False)
            if is_pend:
                # Pending rows within [startDate, endDate] only
                if (not start_dt or r_date >= start_dt) and (not end_dt or r_date <= end_dt):
                    kpi['pending'] += metric_val
                    kpi['pendingBreakdown'][r_wp] = kpi['pendingBreakdown'].get(r_wp, 0.0) + metric_val
            else:
                # Anchor-date sales (the app never sends customStartDate, so
                # periodSales is always the exact anchor-day figure)
                if r_year == anchor_date.year and r_month == cur_month and r_day == anchor_day:
                    kpi['periodSales'] += metric_val
                    kpi['periodBreakdown'][r_wp] = kpi['periodBreakdown'].get(r_wp, 0.0) + metric_val
                    kpi['periodActiveKeys'].add(r_wp)
                # Last 7 days: (anchor - 7d, anchor]
                if anchor - timedelta(days=7) < r_date <= anchor:
                    last7_days_sales += metric_val

            is_target = is_pend if f_pending else not is_pend
            if is_target:
                if key not in global_full:
                    global_full[key] = {
                        'val': 0.0, 'mw': 0.0, 'qty': 0.0,
                        'metricVal': 0.0, 'plotKeys': {}, 'hasData': False,
                    }
                g = global_full[key]
                g['val'] += val
                g['mw'] += mw
                g['qty'] += qty
                g['metricVal'] += metric_val
                g['plotKeys'][r_wp] = g['plotKeys'].get(r_wp, 0.0) + metric_val
                g['hasData'] = True

                if is_paced:
                    if key not in global_paced:
                        global_paced[key] = {
                            'val': 0.0, 'mw': 0.0, 'qty': 0.0,
                            'metricVal': 0.0, 'plotKeys': {}, 'hasData': False,
                        }
                    gp = global_paced[key]
                    gp['val'] += val
                    gp['mw'] += mw
                    gp['qty'] += qty
                    gp['metricVal'] += metric_val
                    gp['plotKeys'][r_wp] = gp['plotKeys'].get(r_wp, 0.0) + metric_val
                    gp['hasData'] = True

                # Previous month counted only up to the anchor day-of-month
                if r_month == prev_anchor_month and r_year == prev_anchor_year and r_day <= anchor_day:
                    prev_month_to_date += metric_val
                    prev_month_to_date_has_data = True

        # ---- QTD / YTD aggregation over paced months ----
        def get_qtd(year: int, end_month: int):
            total = 0.0
            breakdown: Dict[str, float] = {}
            q_start = (end_month // 3) * 3
            for mth in range(q_start, end_month + 1):
                k = f"{year}-{mth:02d}"
                if k in global_paced and global_paced[k]['hasData']:
                    total += global_paced[k]['metricVal']
                    for pk, pv in global_paced[k]['plotKeys'].items():
                        breakdown[pk] = breakdown.get(pk, 0.0) + pv
            return total, breakdown

        def get_ytd(year: int, end_month: int):
            total = 0.0
            breakdown: Dict[str, float] = {}
            start_year = year - 1 if end_month < 3 else year
            cur_mth = 3  # April
            cur_yr = start_year
            while True:
                k = f"{cur_yr}-{cur_mth:02d}"
                if k in global_paced and global_paced[k]['hasData']:
                    total += global_paced[k]['metricVal']
                    for pk, pv in global_paced[k]['plotKeys'].items():
                        breakdown[pk] = breakdown.get(pk, 0.0) + pv
                if cur_yr == year and cur_mth == end_month:
                    break
                cur_mth += 1
                if cur_mth > 11:
                    cur_mth = 0
                    cur_yr += 1
                if cur_yr > year + 1:
                    break
            return total, breakdown

        qtd_total, qtd_breakdown = get_qtd(cur_year, cur_month)
        prev_qtd_total, _ = get_qtd(cur_year - 1, cur_month)
        ytd_total, ytd_breakdown = get_ytd(cur_year, cur_month)
        prev_ytd_total, _ = get_ytd(cur_year - 1, cur_month)

        cur_global = global_paced.get(cur_key)
        kpi['mtd'] = cur_global['metricVal'] if cur_global and cur_global['hasData'] else 0.0
        kpi['mtdBreakdown'] = cur_global['plotKeys'] if cur_global and cur_global['hasData'] else {}
        kpi['prevMtd'] = prev_month_to_date if prev_month_to_date_has_data else 0.0
        prev_y_key = f"{cur_year - 1}-{cur_month:02d}"
        prev_year_mtd = 0.0
        if prev_y_key in global_paced and global_paced[prev_y_key]['hasData']:
            prev_year_mtd = global_paced[prev_y_key]['metricVal']
        kpi['qtd'] = qtd_total
        kpi['qtdBreakdown'] = qtd_breakdown
        kpi['prevQtd'] = prev_qtd_total
        kpi['ytd'] = ytd_total
        kpi['ytdBreakdown'] = ytd_breakdown
        kpi['prevYtd'] = prev_ytd_total

        # ---- Matrix generation (verified == TS 1075-1141) ----
        def calculate_growth(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
            if cur is None or prev is None:
                return None
            if prev == 0:
                return 100.0 if cur > 0 else 0.0
            return ((cur - prev) / prev) * 100.0

        matrix_arr = []
        for i, m_name in enumerate(FISCAL_MONTHS):
            col_month = (i + 3) % 12
            col_year = cur_fy_start_year if i < 9 else cur_fy_start_year + 1
            key_cur = f"{col_year}-{col_month:02d}"

            p_year = col_year - 1 if col_month == 0 else col_year
            p_month = 11 if col_month == 0 else col_month - 1
            key_prev_m = f"{p_year}-{p_month:02d}"
            key_prev_y = f"{col_year - 1}-{col_month:02d}"

            cur_paced = global_paced.get(key_cur, {}).get('metricVal', 0.0) if key_cur in global_paced else 0.0

            if key_cur == cur_key:
                prev_m_paced = prev_month_to_date if prev_month_to_date_has_data else 0.0
            else:
                prev_m_paced = global_paced.get(key_prev_m, {}).get('metricVal', 0.0) if key_prev_m in global_paced else 0.0

            prev_y_paced = global_paced.get(key_prev_y, {}).get('metricVal', 0.0) if key_prev_y in global_paced else 0.0

            col_qtd = get_qtd(col_year, col_month)[0]
            prev_y_qtd = get_qtd(col_year - 1, col_month)[0]

            has_started = col_year < cur_year or (col_year == cur_year and col_month <= cur_month)

            mom = calculate_growth(cur_paced, prev_m_paced) if has_started else None
            yoy = calculate_growth(cur_paced, prev_y_paced) if has_started else None
            qoq = calculate_growth(col_qtd, prev_y_qtd) if has_started else None

            full_cur = global_full.get(key_cur, {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'hasData': False})

            matrix_arr.append({
                'month': m_name,
                'hasStarted': has_started,
                'valCr': (full_cur['val'] / DIVIDER) if has_started and (full_cur['hasData'] or full_cur['val'] > 0) else None,
                'mw': full_cur['mw'] if has_started and (full_cur['hasData'] or full_cur['mw'] > 0) else None,
                'qty': full_cur['qty'] if has_started and (full_cur['hasData'] or full_cur['qty'] > 0) else None,
                'mom': mom,
                'yoy': yoy,
                'qoq': qoq,
            })

        totals = {'valCr': 0.0, 'mw': 0.0, 'qty': 0.0}
        for item in matrix_arr:
            if item['valCr'] is not None:
                totals['valCr'] += item['valCr']
            if item['mw'] is not None:
                totals['mw'] += item['mw']
            if item['qty'] is not None:
                totals['qty'] += item['qty']

        matrix_arr.append({
            'month': 'Total',
            'hasStarted': True,
            'valCr': totals['valCr'],
            'mw': totals['mw'],
            'qty': totals['qty'],
            'mom': None,
            'yoy': None,
            'qoq': None,
        })

        # ---- PASS 2 range (startDate..endDate, overridden by matrixMonth /
        # selectedQuarter / selectedWeek / selectedDay) ----
        filter_start = start_dt
        filter_end = end_dt

        matrix_month = filters.get('matrixMonth')
        selected_quarter = filters.get('selectedQuarter')
        selected_week = filters.get('selectedWeek')
        selected_day = filters.get('selectedDay')

        if matrix_month:
            fm_idx = FISCAL_MONTHS.index(matrix_month) if matrix_month in FISCAL_MONTHS else -1
            if fm_idx >= 0:
                col_month = (fm_idx + 3) % 12
                col_year = cur_fy_start_year if fm_idx < 9 else cur_fy_start_year + 1
                last_day = calendar.monthrange(col_year, col_month + 1)[1]
                filter_start = datetime(col_year, col_month + 1, 1)
                filter_end = datetime(col_year, col_month + 1, last_day, 23, 59, 59, 999999)
                if selected_week:
                    start_day = (int(selected_week) - 1) * 7 + 1
                    end_day = min(last_day, int(selected_week) * 7)
                    filter_start = datetime(col_year, col_month + 1, start_day)
                    filter_end = datetime(col_year, col_month + 1, end_day, 23, 59, 59, 999999)
                elif selected_day:
                    filter_start = datetime(col_year, col_month + 1, int(selected_day))
                    filter_end = datetime(col_year, col_month + 1, int(selected_day), 23, 59, 59, 999999)
        elif selected_quarter not in (None, '', 'null'):
            q_idx = int(selected_quarter)
            quarters = [[3, 4, 5], [6, 7, 8], [9, 10, 11], [0, 1, 2]]
            q_months = quarters[q_idx]
            start_m, end_m = q_months[0], q_months[2]
            s_year = cur_fy_start_year if start_m >= 3 else cur_fy_start_year + 1
            e_year = cur_fy_start_year if end_m >= 3 else cur_fy_start_year + 1
            filter_start = datetime(s_year, start_m + 1, 1)
            last_day = calendar.monthrange(e_year, end_m + 1)[1]
            filter_end = datetime(e_year, end_m + 1, last_day, 23, 59, 59, 999999)

        # ---- PASS 2: range-bounded analytics (TS 940-1009) ----
        sh_obj: Dict[str, dict] = {}
        cust_obj: Dict[str, dict] = {}
        wp_obj: Dict[str, dict] = {}
        active_segments: set = set()
        active_plot_keys: set = set()
        raw_filtered: List[dict] = []
        t_val = t_mw = t_qty = 0.0
        kpi_val = kpi_mw = kpi_qty = 0.0

        # Pre-initialised buckets: 12 fiscal months (weekly: 5 week slots,
        # daily: 31 day slots), quarterly: 0-3.
        buckets = {
            'chart': {
                'monthly': {},
                'weekly': {},
                'daily': {},
                'quarterly': {0: {}, 1: {}, 2: {}, 3: {}},
            }
        }
        for m_name in FISCAL_MONTHS:
            buckets['chart']['monthly'][m_name] = {}
            buckets['chart']['weekly'][m_name] = {1: {}, 2: {}, 3: {}, 4: {}, 5: {}}
            buckets['chart']['daily'][m_name] = [{} for _ in range(31)]

        for r in rows:
            r_date = r.get('date')
            if not isinstance(r_date, datetime):
                continue
            if filter_start and r_date < filter_start:
                continue
            if filter_end and r_date > filter_end:
                continue
            if f_segments and r.get('segment') not in f_segments:
                continue

            # target state BEFORE drilldown so activePlotKeys never loses SKUs
            is_pend = r.get('isPending', False)
            is_target = is_pend if f_pending else not is_pend
            if not is_target:
                continue

            r_wp = r.get('wp', 'Generic')
            active_plot_keys.add(r_wp)

            # drilldown -> exclusion
            if f_sales_heads and r.get('salesHead') not in f_sales_heads:
                continue
            if f_customers and r.get('customer') not in f_customers:
                continue
            if f_skus and r_wp not in f_skus:
                continue
            if r_wp in f_excluded:
                continue

            val = r.get('val', 0.0)
            mw = r.get('mw', 0.0)
            qty = r.get('qty', 0.0)
            # RAW metric in pass 2 (undivided)
            metric_val_bucket = val if is_amount else (mw if is_mw else qty)

            sh = r.get('salesHead', 'Direct/Unmapped')
            cust = r.get('customer', 'Unidentified')

            if sh not in sh_obj:
                sh_obj[sh] = {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'comps': set(), 'plotKeys': {}}
            sh_obj[sh]['val'] += val
            sh_obj[sh]['mw'] += mw
            sh_obj[sh]['qty'] += qty
            sh_obj[sh]['plotKeys'][r_wp] = sh_obj[sh]['plotKeys'].get(r_wp, 0.0) + metric_val_bucket
            if cust:
                sh_obj[sh]['comps'].add(cust)

            if cust not in cust_obj:
                cust_obj[cust] = {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'plotKeys': {}}
            cust_obj[cust]['val'] += val
            cust_obj[cust]['mw'] += mw
            cust_obj[cust]['qty'] += qty
            cust_obj[cust]['plotKeys'][r_wp] = cust_obj[cust]['plotKeys'].get(r_wp, 0.0) + metric_val_bucket

            if r_wp not in wp_obj:
                wp_obj[r_wp] = {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'plotKeys': {}}
            wp_obj[r_wp]['val'] += val
            wp_obj[r_wp]['mw'] += mw
            wp_obj[r_wp]['qty'] += qty
            wp_obj[r_wp]['plotKeys'][r_wp] = wp_obj[r_wp]['plotKeys'].get(r_wp, 0.0) + metric_val_bucket

            kpi_val += val
            kpi_mw += mw
            kpi_qty += qty
            raw_filtered.append(r)
            active_segments.add(r.get('segment'))
            t_val += val
            t_mw += mw
            t_qty += qty

            r_month = r_date.month - 1
            r_day = r_date.day
            rfm_idx = r_month - 3 if r_month >= 3 else r_month + 9
            m_name = FISCAL_MONTHS[rfm_idx]

            buckets['chart']['monthly'][m_name][r_wp] = (
                buckets['chart']['monthly'][m_name].get(r_wp, 0.0) + metric_val_bucket
            )
            week_num = min(math.ceil(r_day / 7), 5)
            if week_num <= 5:
                buckets['chart']['weekly'][m_name][week_num][r_wp] = (
                    buckets['chart']['weekly'][m_name][week_num].get(r_wp, 0.0) + metric_val_bucket
                )
            if r_day <= 31:
                buckets['chart']['daily'][m_name][r_day - 1][r_wp] = (
                    buckets['chart']['daily'][m_name][r_day - 1].get(r_wp, 0.0) + metric_val_bucket
                )
            q_idx = QTR_MAP[r_month]
            buckets['chart']['quarterly'][q_idx][r_wp] = (
                buckets['chart']['quarterly'][q_idx].get(r_wp, 0.0) + metric_val_bucket
            )

        # ---- Entity mapping -> {n, v, mw, qty, raw, plotKeys, comps} ----
        def map_obj_to_array(obj: dict) -> list:
            arr = []
            for k, v in obj.items():
                comps = list(v.get('comps', set())) if 'comps' in v else []
                raw = {kk: vv for kk, vv in v.items()}
                raw['comps'] = comps
                arr.append({
                    'n': k,
                    'v': v['val'] / DIVIDER if is_amount else (v['mw'] if is_mw else v['qty']),
                    'mw': v['mw'],
                    'qty': v['qty'],
                    'raw': raw,
                    'plotKeys': v.get('plotKeys', {}),
                    'comps': comps,
                })
            return arr

        sh_list = sorted(map_obj_to_array(sh_obj), key=lambda x: x['v'], reverse=True)
        cust_list = sorted(map_obj_to_array(cust_obj), key=lambda x: x['v'], reverse=True)
        wp_list = sorted(map_obj_to_array(wp_obj), key=lambda x: x['v'], reverse=True)

        # ---- ytdWeekly: 5 fixed groups, RAW accumulation (TS 1215-1250) ----
        ytd_start_time = datetime(cur_fy_start_year, 4, 1)
        ytd_end_time = filter_end if filter_end else anchor
        ytd_groups = {
            1: {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'weekNum': 1},
            2: {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'weekNum': 2},
            3: {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'weekNum': 3},
            4: {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'weekNum': 4},
            5: {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'weekNum': 5},
        }
        for r in rows:
            r_date = r.get('date')
            if not isinstance(r_date, datetime):
                continue
            if r_date < ytd_start_time:
                continue
            if ytd_end_time and r_date > ytd_end_time:
                continue
            if f_segments and r.get('segment') not in f_segments:
                continue
            is_pend = r.get('isPending', False)
            is_target = is_pend if f_pending else not is_pend
            if not is_target:
                continue
            r_wp = r.get('wp', 'Generic')
            if f_sales_heads and r.get('salesHead') not in f_sales_heads:
                continue
            if f_customers and r.get('customer') not in f_customers:
                continue
            if f_skus and r_wp not in f_skus:
                continue
            if r_wp in f_excluded:
                continue
            week_num = min(math.ceil(r_date.day / 7), 5)
            if 1 <= week_num <= 5:
                g = ytd_groups[week_num]
                g['val'] += r.get('val', 0.0)
                g['mw'] += r.get('mw', 0.0)
                g['qty'] += r.get('qty', 0.0)

        ytd_weekly = [ytd_groups[i] for i in range(1, 6)]

        # ---- Daily series: RAW vals, sorted date desc (KpiGrid/DailySalesPanel) ----
        daily_map: Dict[str, Dict[str, float]] = {}
        for r in rows:
            r_date = r.get('date')
            if not isinstance(r_date, datetime):
                continue
            if filter_start and r_date < filter_start:
                continue
            if filter_end and r_date > filter_end:
                continue
            if f_segments and r.get('segment') not in f_segments:
                continue
            is_pend = r.get('isPending', False)
            is_target = is_pend if f_pending else not is_pend
            if not is_target:
                continue
            r_wp = r.get('wp', 'Generic')
            if f_sales_heads and r.get('salesHead') not in f_sales_heads:
                continue
            if f_customers and r.get('customer') not in f_customers:
                continue
            if f_skus and r_wp not in f_skus:
                continue
            if r_wp in f_excluded:
                continue
            ds = r_date.strftime('%Y-%m-%d')
            if ds not in daily_map:
                daily_map[ds] = {'val': 0.0, 'mw': 0.0, 'qty': 0.0}
            daily_map[ds]['val'] += r.get('val', 0.0)
            daily_map[ds]['mw'] += r.get('mw', 0.0)
            daily_map[ds]['qty'] += r.get('qty', 0.0)

        daily_series = sorted(
            [{'date': k, **v} for k, v in daily_map.items()],
            key=lambda x: x['date'], reverse=True,
        )

        # ---- mb51SalesPeriods: ABS sums per period from get_mb51_sales ----
        mb51_sales_periods = {
            'today': {'amount': 0.0, 'qty': 0.0, 'mw': 0.0},
            'mtd': {'amount': 0.0, 'qty': 0.0, 'mw': 0.0},
            'qtd': {'amount': 0.0, 'qty': 0.0, 'mw': 0.0},
            'ytd': {'amount': 0.0, 'qty': 0.0, 'mw': 0.0},
        }
        try:
            cust_codes = []
            for r in raw_filtered:
                cc = r.get('custCode')
                if cc not in (None, ''):
                    cust_codes.append(str(cc))
            cust_codes = sorted(set(cust_codes))
            mb_from = f_start if f_start else f"{cur_fy_start_year}-04-01"
            mb_to = f_end if f_end else anchor_date.strftime('%Y-%m-%d')
            if cust_codes and mb_from <= mb_to:
                mb51_rows = RevenueRepository().get_mb51_sales(cust_codes, mb_from, mb_to)
                anchor_date_str = anchor_date.strftime('%Y-%m-%d')
                mtd_start_str = mtd_start.strftime('%Y-%m-%d')
                qtd_start_str = qtd_start.strftime('%Y-%m-%d')
                ytd_start_str = ytd_start.strftime('%Y-%m-%d')
                for row in mb51_rows:
                    if isinstance(row, dict):
                        posting = row.get('posting_date')
                        amount = float(row.get('amount') or 0.0)
                        mb_qty = float(row.get('qty') or 0.0)
                        mb_mw = float(row.get('mw') or 0.0)
                    else:
                        posting = row[1]
                        amount = float(row[2] or 0.0)
                        mb_qty = float(row[3]) if len(row) > 3 else 0.0
                        mb_mw = float(row[4]) if len(row) > 4 else 0.0
                    try:
                        posting_dt = datetime.strptime(str(posting), '%d.%m.%Y')
                    except (ValueError, TypeError):
                        continue
                    pd_str = posting_dt.strftime('%Y-%m-%d')
                    if pd_str == anchor_date_str:
                        mb51_sales_periods['today']['amount'] += amount
                        mb51_sales_periods['today']['qty'] += mb_qty
                        mb51_sales_periods['today']['mw'] += mb_mw
                    if mtd_start_str <= pd_str <= anchor_date_str:
                        mb51_sales_periods['mtd']['amount'] += amount
                        mb51_sales_periods['mtd']['qty'] += mb_qty
                        mb51_sales_periods['mtd']['mw'] += mb_mw
                    if qtd_start_str <= pd_str <= anchor_date_str:
                        mb51_sales_periods['qtd']['amount'] += amount
                        mb51_sales_periods['qtd']['qty'] += mb_qty
                        mb51_sales_periods['qtd']['mw'] += mb_mw
                    if ytd_start_str <= pd_str <= anchor_date_str:
                        mb51_sales_periods['ytd']['amount'] += amount
                        mb51_sales_periods['ytd']['qty'] += mb_qty
                        mb51_sales_periods['ytd']['mw'] += mb_mw
        except Exception as e:
            logger.warning('mb51_fetch_failed: %s', e)

        # ---- Insight engine (TS 1161-1213 / context.md 48) ----
        insights = []
        cur_month_days = calendar.monthrange(cur_year, cur_month + 1)[1]
        week_avg = last7_days_sales / 7
        proj_week = week_avg * cur_month_days
        is_accel = proj_week > kpi['mtd']

        def fmt_insight_val(v: float) -> str:
            if is_amount:
                return f"₹ {v / DIVIDER:,.2f} Cr"
            if is_mw:
                return f"{v:,.2f} MW"
            return f"{round(v):,} Qty"

        insights.append({
            't': 'success' if is_accel else 'risk',
            'l': 'MOMENTUM (7-DAY AVG)',
            'txt': f"Recent trailing velocity projects {fmt_insight_val(proj_week)} for the current period.",
        })

        def hhi_score(items: list) -> float:
            if not items:
                return 0.0
            abs_vals = [abs(i.get('v', 0.0)) for i in items]
            total_abs = sum(abs_vals)
            if total_abs <= 0:
                return 0.0
            return sum((v / total_abs * 100.0) ** 2 for v in abs_vals)

        sorted_cust = cust_list
        sum_cust_abs = sum(abs(c['v']) for c in sorted_cust)
        cust_hhi = hhi_score(sorted_cust)
        top5 = sorted_cust[:5]
        top5_share = (sum(abs(c['v']) for c in top5) / sum_cust_abs * 100.0) if sum_cust_abs > 0 else 0.0
        conc_text = 'Diversified' if cust_hhi < 1500 else ('Moderate' if cust_hhi < 2500 else 'Highly Concentrated')
        conc_type = 'success' if cust_hhi < 1500 else ('strategic' if cust_hhi < 2500 else 'risk')
        insights.append({
            't': conc_type,
            'l': 'CUSTOMER CONCENTRATION',
            'txt': f"Top 5 hold {top5_share:.1f}%. HHI Score: {cust_hhi:.0f} ({conc_text}).",
        })

        sorted_wp = wp_list
        sum_wp_abs = sum(abs(w['v']) for w in sorted_wp)
        prod_hhi = hhi_score(sorted_wp)
        top3 = sorted_wp[:3]
        top3_share = (sum(abs(w['v']) for w in top3) / sum_wp_abs * 100.0) if sum_wp_abs > 0 else 0.0
        insights.append({
            't': 'strategic',
            'l': 'PRODUCT CONCENTRATION',
            'txt': f"Top 3 SKUs hold {top3_share:.1f}%. HHI Score: {prod_hhi:.0f}.",
        })

        if t_mw > 0:
            insights.append({
                't': 'strategic',
                'l': 'YIELD',
                'txt': f"Net Realization: ₹ {t_val / DIVIDER / t_mw:,.2f} / MW.",
            })

        # ---- Executive Stories engine (storyInsights) ----
        story_insights = []
        if insights:
            story_insights = [dict(i, cta={'label': 'View Dashboard'}) for i in insights[:5]]
        # Guarantee a minimum of 3 stories even when the standard insight engine
        # produced fewer than 3 signals.
        if len(story_insights) < 3:
            if t_mw > 0:
                story_insights.append({
                    't': 'success',
                    'l': 'PERFORMANCE',
                    'txt': f"YTD Realization: ₹ {t_val / DIVIDER / t_mw:,.2f} per MW across {len(f_segments)} active segment(s).",
                    'cta': {'label': 'View Dashboard'},
                })
            if kpi['ytd'] > 0:
                ytd_cr = kpi['ytd'] / DIVIDER
                yoy_pct = ((kpi['ytd'] - kpi['prevYtd']) / kpi['prevYtd'] * 100.0) if kpi['prevYtd'] > 0 else 0.0
                story_insights.append({
                    't': 'success' if yoy_pct >= 0 else 'risk',
                    'l': 'YEAR-TO-DATE',
                    'txt': f"YTD sales stand at ₹ {ytd_cr:,.2f} Cr ({'+' if yoy_pct >= 0 else ''}{yoy_pct:.1f}% vs same period last year).",
                    'cta': {'label': 'View Dashboard'},
                })
            if story_insights:
                story_insights.append({
                    't': 'strategic',
                    'l': 'SNAPSHOT',
                    'txt': f"{len(cust_list)} active clients · {len(wp_list)} SKUs · {t_qty:,} units across the period.",
                    'cta': {'label': 'View Dashboard'},
                })
        # De-duplicate identical narrative keys, cap at 5.
        seen_l = set()
        deduped = []
        for s in story_insights:
            if s['l'] not in seen_l:
                seen_l.add(s['l'])
                deduped.append(s)
            if len(deduped) >= 5:
                break
        story_insights = deduped

        # ---- Output ----
        is_only_solar = len(f_segments) == 1 and 'solar' in next(iter(f_segments)).lower()

        return {
            'kpi': {
                **kpi,
                'periodActiveKeys': sorted(kpi['periodActiveKeys']),
            },
            'prevYearMtd': prev_year_mtd,
            'buckets': buckets,
            'matrix': matrix_arr,
            'sh': sh_list,
            'cust': cust_list,
            'wp': wp_list,
            'insights': insights,
            'storyInsights': story_insights,
            'activeSegments': sorted(active_segments),
            'activePlotKeys': sorted(active_plot_keys),
            'rawFiltered': raw_filtered,
            'kpiAnchorDate': anchor.isoformat(),
            'last7DaysSales': last7_days_sales,
            'totalCr': t_val / DIVIDER,
            'totalMW': t_mw,
            'totalQty': t_qty,
            'kpiCr': kpi_val / DIVIDER,
            'kpiMW': kpi_mw,
            'kpiQty': kpi_qty,
            'realization': (t_val / DIVIDER / t_mw) if t_mw > 0 else 0.0,
            'isOnlySolar': is_only_solar,
            'ytdWeekly': ytd_weekly,
            'dailySeries': daily_series,
            'mb51SalesPeriods': mb51_sales_periods,
        }

    # ------------------------------------------------------------------
    # Empty analytics stub (zero-filled shape matching the TS contract)
    # ------------------------------------------------------------------

    @staticmethod
    def _empty_analytics() -> dict:
        buckets = {
            'chart': {
                'monthly': {},
                'weekly': {},
                'daily': {},
                'quarterly': {0: {}, 1: {}, 2: {}, 3: {}},
            }
        }
        for m_name in FISCAL_MONTHS:
            buckets['chart']['monthly'][m_name] = {}
            buckets['chart']['weekly'][m_name] = {1: {}, 2: {}, 3: {}, 4: {}, 5: {}}
            buckets['chart']['daily'][m_name] = [{} for _ in range(31)]

        return {
            'kpi': {
                'periodSales': 0, 'periodBreakdown': {}, 'periodActiveKeys': [],
                'mtd': 0, 'mtdBreakdown': {}, 'qtd': 0, 'qtdBreakdown': {},
                'ytd': 0, 'ytdBreakdown': {}, 'prevMtd': 0, 'prevQtd': 0, 'prevYtd': 0,
                'pending': 0, 'pendingBreakdown': {},
            },
            'prevYearMtd': 0,
            'buckets': buckets,
            'matrix': [],
            'sh': [], 'cust': [], 'wp': [],
            'insights': [], 'storyInsights': [],
            'activeSegments': [], 'activePlotKeys': [],
            'rawFiltered': [],
            'kpiAnchorDate': None,
            'last7DaysSales': 0,
            'totalCr': 0, 'totalMW': 0, 'totalQty': 0,
            'kpiCr': 0, 'kpiMW': 0, 'kpiQty': 0,
            'realization': 0,
            'isOnlySolar': False,
            'ytdWeekly': [
                {'val': 0, 'mw': 0, 'qty': 0, 'weekNum': 1},
                {'val': 0, 'mw': 0, 'qty': 0, 'weekNum': 2},
                {'val': 0, 'mw': 0, 'qty': 0, 'weekNum': 3},
                {'val': 0, 'mw': 0, 'qty': 0, 'weekNum': 4},
                {'val': 0, 'mw': 0, 'qty': 0, 'weekNum': 5},
            ],
            'dailySeries': [],
            'mb51SalesPeriods': {
                'today': {'amount': 0, 'qty': 0, 'mw': 0},
                'mtd': {'amount': 0, 'qty': 0, 'mw': 0},
                'qtd': {'amount': 0, 'qty': 0, 'mw': 0},
                'ytd': {'amount': 0, 'qty': 0, 'mw': 0},
            },
        }