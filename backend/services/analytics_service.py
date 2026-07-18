import logging
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

        # Populate active plot keys and segments from range-bounded records (ignoring exclusions & drilldowns)
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
            is_pend = r.get('isPending', False)
            is_target_state = is_pend if f_pending else not is_pend
            if not is_target_state:
                continue
                
            wp = r.get('wp', 'Generic')
            plot_keys.add(wp)
            seg = r.get('segment')
            if seg:
                segs_active.add(seg)

        for r in filtered:
            val_cr = r.get('val', 0) / CURRENCY_DIVIDER

            sh = r.get('salesHead', 'Direct/Unmapped')
            sh_map[sh] = sh_map.get(sh, 0) + val_cr

            cust = r.get('customer', 'Unidentified')
            cust_map[cust] = cust_map.get(cust, 0) + val_cr

            wp = r.get('wp', 'Generic')
            wp_map[wp] = wp_map.get(wp, 0) + val_cr

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

        # Determine anchor date from filters if provided, else use latest_date
        anchor_date = latest_date
        if filters.get('endDate'):
            try:
                anchor_date = datetime.strptime(filters['endDate'], '%Y-%m-%d')
            except ValueError:
                pass
        
        if anchor_date > latest_date:
            anchor_date = latest_date
            
        anchor = anchor_date.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        # ---- KPI: MTD, QTD, YTD (fiscal calendar) ----
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

        CONFIG_FISCAL_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
        
        anchor_day = anchor_date.day
        cur_month = anchor_date.month - 1  # 0-indexed (0=Jan)
        cur_year = anchor_date.year
        cur_key = f"{cur_year}-{cur_month:02d}"
        
        cur_fy_start_year = ytd_start.year
        metric = filters.get('metric', 'Amount')
        
        # Compute global pacing and global full datasets for matrix comparison
        global_full = {}
        global_paced = {}
        
        # Like-for-like MoM baseline: previous month truncated to the anchor day-of-month
        prev_anchor_year = cur_year - 1 if cur_month == 0 else cur_year
        prev_anchor_month = 11 if cur_month == 0 else cur_month - 1
        
        prev_month_to_date = 0.0
        prev_month_to_date_has_data = False
        
        for r in rows:
            if f_segments and r.get('segment') not in f_segments:
                continue
            r_date = r['date']
            if not isinstance(r_date, datetime):
                continue
            r_month = r_date.month - 1
            r_year = r_date.year
            r_day = r_date.day
            r_wp = r.get('wp', 'Generic')
            
            if f_excluded and r_wp in f_excluded:
                continue
                
            matches_drilldown = True
            if f_sales_heads and r.get('salesHead') not in f_sales_heads:
                matches_drilldown = False
            if f_customers and r.get('customer') not in f_customers:
                matches_drilldown = False
            if f_skus and r_wp not in f_skus:
                matches_drilldown = False
                
            if not matches_drilldown:
                continue
                
            is_pend = r.get('isPending', False)
            is_target_state = is_pend if f_pending else not is_pend
            
            if is_target_state:
                key = f"{r_year}-{r_month:02d}"
                val = r.get('val', 0.0)
                mw = r.get('mw', 0.0)
                qty = r.get('qty', 0.0)
                metric_val = val / CURRENCY_DIVIDER if metric == 'Amount' else mw if metric == 'MW' else qty
                
                if key not in global_full:
                    global_full[key] = {
                        'val': 0.0,
                        'mw': 0.0,
                        'qty': 0.0,
                        'metricVal': 0.0,
                        'hasData': False
                    }
                global_full[key]['val'] += val
                global_full[key]['mw'] += mw
                global_full[key]['qty'] += qty
                global_full[key]['metricVal'] += metric_val
                global_full[key]['hasData'] = True
                
                is_paced = r_month != cur_month or r_day <= anchor_day
                if is_paced:
                    if key not in global_paced:
                        global_paced[key] = {
                            'val': 0.0,
                            'mw': 0.0,
                            'qty': 0.0,
                            'metricVal': 0.0,
                            'hasData': False
                        }
                    global_paced[key]['val'] += val
                    global_paced[key]['mw'] += mw
                    global_paced[key]['qty'] += qty
                    global_paced[key]['metricVal'] += metric_val
                    global_paced[key]['hasData'] = True
                    
                if r_month == prev_anchor_month and r_year == prev_anchor_year and r_day <= anchor_day:
                    prev_month_to_date += metric_val
                    prev_month_to_date_has_data = True

        qtr_map = {
            3: 0, 4: 0, 5: 0,
            6: 1, 7: 1, 8: 1,
            9: 2, 10: 2, 11: 2,
            0: 3, 1: 3, 2: 3
        }
        
        def get_qtd(year: int, end_month: int) -> float:
            q_idx = qtr_map[end_month]
            quarters = [
                [3, 4, 5],
                [6, 7, 8],
                [9, 10, 11],
                [0, 1, 2]
            ]
            q_months = quarters[q_idx]
            total_sum = 0.0
            for m in q_months:
                is_valid = False
                if m == end_month:
                    is_valid = True
                elif end_month >= 3:
                    if m < end_month and m >= 3:
                        is_valid = True
                else:
                    if m < end_month or m >= 3:
                        is_valid = True
                
                if is_valid:
                    k = f"{year}-{m:02d}"
                    if k in global_paced and global_paced[k]['hasData']:
                        total_sum += global_paced[k]['metricVal']
            return total_sum
            
        def calculate_growth(cur: Optional[float], prev: Optional[float]) -> Optional[float]:
            if cur is None or prev is None:
                return None
            if prev == 0:
                return 100.0 if cur > 0 else 0.0
            return ((cur - prev) / prev) * 100.0

        matrix_arr = []
        for i, m_name in enumerate(CONFIG_FISCAL_MONTHS):
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
            
            col_qtd = get_qtd(col_year, col_month)
            prev_y_qtd = get_qtd(col_year - 1, col_month)
            
            has_started = col_year < cur_year or (col_year == cur_year and col_month <= cur_month)
            
            mom = calculate_growth(cur_paced, prev_m_paced) if has_started else None
            yoy = calculate_growth(cur_paced, prev_y_paced) if has_started else None
            qoq = calculate_growth(col_qtd, prev_y_qtd) if has_started else None
            
            full_cur = global_full.get(key_cur, {'val': 0.0, 'mw': 0.0, 'qty': 0.0, 'hasData': False})
            
            matrix_arr.append({
                'month': m_name,
                'hasStarted': has_started,
                'valCr': (full_cur['val'] / CURRENCY_DIVIDER) if has_started and (full_cur['hasData'] or full_cur['val'] > 0) else None,
                'mw': full_cur['mw'] if has_started and (full_cur['hasData'] or full_cur['mw'] > 0) else None,
                'qty': full_cur['qty'] if has_started and (full_cur['hasData'] or full_cur['qty'] > 0) else None,
                'mom': mom,
                'yoy': yoy,
                'qoq': qoq
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
            'qoq': None
        })

        prev_y_key = f"{cur_year - 1}-{cur_month:02d}"
        prev_year_mtd = global_paced.get(prev_y_key, {}).get('metricVal', 0.0) if prev_y_key in global_paced else 0.0

        # Determine if it's a custom period range
        start_date = ytd_start
        if filters.get('startDate'):
            try:
                start_date = datetime.strptime(filters['startDate'], '%Y-%m-%d')
            except ValueError:
                pass

        is_custom_period = start_date.date() != ytd_start.date()

        # Calculate periodSales based on selected metric
        if is_custom_period:
            if metric == 'Amount':
                period_sales = total_cr
            elif metric == 'MW':
                period_sales = total_mw
            else:
                period_sales = total_qty
        else:
            # Anchor date only sales
            anchor_day_start = anchor_date.replace(hour=0, minute=0, second=0, microsecond=0)
            anchor_day_end = anchor_date.replace(hour=23, minute=59, second=59, microsecond=999999)
            
            exact_day_val = sum(
                r.get('val' if metric == 'Amount' else 'mw' if metric == 'MW' else 'qty', 0)
                for r in rows
                if isinstance(r.get('date'), datetime) and anchor_day_start <= r['date'] <= anchor_day_end
                and (not f_segments or r.get('segment') in f_segments)
                and (not f_sales_heads or r.get('salesHead') in f_sales_heads)
                and (not f_customers or r.get('customer') in f_customers)
                and (not f_skus or r.get('wp') in f_skus)
                and (not f_excluded or r.get('wp') not in f_excluded)
                and (r.get('isPending', False) == f_pending)
            )
            
            if metric == 'Amount':
                period_sales = exact_day_val / CURRENCY_DIVIDER
            else:
                period_sales = exact_day_val

        period_sales = round(period_sales, 2)

        return {
            'kpi': {
                'periodSales': period_sales,
                'periodBreakdown': {},
                'periodActiveKeys': list(plot_keys),
                'mtd': mtd_val,
                'mtdBreakdown': {},
                'qtd': qtd_val,
                'qtdBreakdown': {},
                'ytd': ytd_val,
                'ytdBreakdown': {},
                'prevMtd': prev_year_mtd,
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
            'matrix': matrix_arr,
            'insights': [],
            'storyInsights': [],
            'prevYearMtd': prev_year_mtd,
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
