import pytest
from datetime import datetime
from unittest.mock import patch
from backend.services.analytics_service import AnalyticsService

# Mock data matching the shape of the database records returned by RevenueService.get_clean_revenue()
MOCK_ROWS = [
    # FY 24-25 (Current Year)
    {
        'date': datetime(2024, 4, 10),
        'val': 10000000,
        'mw': 10,
        'qty': 100,
        'segment': 'Solar',
        'wp': '580',
        'isPending': False,
        'salesHead': 'Direct',
        'customer': 'CustA'
    },
    {
        'date': datetime(2024, 5, 15),
        'val': 20000000,
        'mw': 20,
        'qty': 200,
        'segment': 'Solar',
        'wp': '580',
        'isPending': False,
        'salesHead': 'Direct',
        'customer': 'CustA'
    },
    {
        'date': datetime(2024, 5, 20),
        'val': 30000000,
        'mw': 30,
        'qty': 300,
        'segment': 'RM',
        'wp': 'Generic',
        'isPending': False,
        'salesHead': 'Direct',
        'customer': 'CustB'
    }
]

@pytest.mark.anyio
async def test_anchor_date_sales_standard_fy():
    # standard FY view (isCustomPeriodActive = False)
    filters = {
        'segment': [],
        'metric': 'Amount',
        'velocityMode': 'Monthly',
        'salesHead': [],
        'customer': [],
        'pendingOnly': False,
        'startDate': '2024-04-01',
        'endDate': '2024-05-15',
    }
    
    with patch.object(AnalyticsService, '_get_rows', return_value=MOCK_ROWS):
        stats = await AnalyticsService.analytics(filters)
        # Anchor date is 2024-05-15, which has sales of 20000000.
        # In crores, it should be 2.00 Cr
        assert stats['kpi']['periodSales'] == 2.0
        assert stats['kpiAnchorDate'].startswith('2024-05-15')

@pytest.mark.anyio
async def test_anchor_date_sales_custom_period():
    # custom period view (startDate starts from 2024-05-01, not default FY start)
    filters = {
        'segment': [],
        'metric': 'Amount',
        'velocityMode': 'Monthly',
        'salesHead': [],
        'customer': [],
        'pendingOnly': False,
        'startDate': '2024-05-01',
        'endDate': '2024-05-25',
    }
    
    with patch.object(AnalyticsService, '_get_rows', return_value=MOCK_ROWS):
        stats = await AnalyticsService.analytics(filters)
        # TS parity: periodSales = anchor-day sales (customStartDate is never sent).
        # Anchor date clamps to latest available date: min(endDate 2024-05-25, latest 2024-05-20)
        # = 2024-05-20, which has sales of 30,000,000. In crores, that is 3.0.
        assert stats['kpi']['periodSales'] == 3.0
        assert stats['kpiAnchorDate'].startswith('2024-05-20')
