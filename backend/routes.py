import json
import logging
import os
import subprocess
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from .database import RevenueRepository
from .services.analytics_service import AnalyticsService
from .services.cache import Cache
from .services.revenue_service import RevenueService

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/")
async def get_all_revenue():
    """Returns all sanitized revenue data."""
    try:
        rows = await RevenueService.get_clean_revenue()
        return rows
    except Exception as e:
        logger.error("api_revenue_fetch_failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Database connection failed. System in high-integrity mode (No Mock Fallback)."
        )


@router.get("/features")
async def get_features():
    """Returns feature flags."""
    return {
        "agentation": os.getenv("FEATURE_AGENTATION", "true").lower() == "true",
        "story": os.getenv("FEATURE_STORY", "true").lower() == "true",
        "commitDrilldown": os.getenv("FEATURE_COMMIT_DRILLDOWN", "false").lower() == "true",
        "enable_auth": os.getenv("FEATURE_ENABLE_AUTH", "true").lower() == "true",
    }


@router.get("/meta")
async def get_meta():
    """Bootstrap metadata (dates, filter dimensions, record count)."""
    try:
        cached = Cache.get("grew_rev_meta")
        if cached is not None:
            return cached
        meta = await AnalyticsService.meta()
        Cache.set("grew_rev_meta", meta, 300)
        return meta
    except Exception as e:
        logger.error("meta_failed: %s", e)
        raise HTTPException(status_code=500, detail={"error": "Failed to load metadata", "details": str(e)})


@router.get("/summary")
async def get_revenue_summary(
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    segment: Optional[List[str]] = Query(None),
    salesHead: Optional[List[str]] = Query(None),
    customer: Optional[List[str]] = Query(None),
    pendingOnly: bool = False,
    excludeWp: Optional[List[str]] = Query(None),
):
    """Returns KPI summary with breakdowns."""
    try:
        filters = {
            "startDate": startDate,
            "endDate": endDate,
            "segment": segment or [],
            "salesHead": salesHead or [],
            "customer": customer or [],
            "pendingOnly": pendingOnly,
            "excludeWp": excludeWp or [],
        }
        cache_key = (
            f"grew_rev_summary_{startDate}_{endDate}_"
            f"seg_{'_'.join(sorted(filters['segment'])) or 'all'}_"
            f"sh_{'_'.join(sorted(filters['salesHead'])) or 'all'}_"
            f"cust_{'_'.join(sorted(filters['customer'])) or 'all'}_"
            f"pending_{pendingOnly}_exwp_{'_'.join(sorted(filters['excludeWp'])) or 'none'}"
        )
        cached = Cache.get(cache_key)
        if cached is not None:
            return cached
        payload = await AnalyticsService.compute_summary(filters)
        Cache.set(cache_key, payload, 300)
        return payload
    except Exception as e:
        logger.error("database_aggregation_failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to aggregate revenue data", "details": str(e)}
        )


@router.get("/analytics")
async def get_revenue_analytics(
    segment: Optional[List[str]] = Query(None),
    salesHead: Optional[List[str]] = Query(None),
    customer: Optional[List[str]] = Query(None),
    selectedSku: Optional[List[str]] = Query(None),
    excludeWp: Optional[List[str]] = Query(None),
    metric: str = "Amount",
    velocityMode: str = "Weekly",
    pendingOnly: bool = False,
    startDate: Optional[str] = None,
    endDate: Optional[str] = None,
    matrixMonth: Optional[str] = None,
    selectedQuarter: Optional[int] = None,
    selectedWeek: Optional[int] = None,
    selectedDay: Optional[int] = None,
):
    """Full analytical output for the given filters."""
    try:
        filters = {
            "segment": segment or [],
            "salesHead": salesHead or [],
            "customer": customer or [],
            "selectedSku": selectedSku or [],
            "excludedSeries": excludeWp or [],
            "metric": metric,
            "velocityMode": velocityMode,
            "pendingOnly": pendingOnly,
            "startDate": startDate or "",
            "endDate": endDate or "",
            "matrixMonth": matrixMonth,
            "selectedQuarter": selectedQuarter,
            "selectedWeek": selectedWeek,
            "selectedDay": selectedDay,
        }
        cache_key = f"grew_rev_analytics_{json.dumps(filters, sort_keys=True)}"
        cached = Cache.get(cache_key)
        if cached is not None:
            return cached
        payload = await AnalyticsService.analytics(filters)
        Cache.set(cache_key, payload, 300)
        return payload
    except Exception as e:
        logger.error("analytics_failed: %s", e, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"error": "Failed to compute analytics", "details": str(e)}
        )


@router.get("/db-config")
async def get_db_config():
    """Returns DB configuration info."""
    connection = None
    source = None
    connection_error = None

    pg_host = os.getenv("PG_HOST")
    if pg_host:
        connection = {
            "host": pg_host,
            "port": int(os.getenv("PG_PORT", "5432")),
            "user": os.getenv("PG_USER"),
            "database": os.getenv("PG_DATABASE"),
            "ssl": os.getenv("PG_SSL", "false").lower() == "true",
        }
        source = "local_env"
    else:
        pg_url = os.getenv("POSTGRES_URL", "")
        if pg_url:
            # Parse the URL for display (no password)
            try:
                from urllib.parse import urlparse
                parsed = urlparse(pg_url)
                connection = {
                    "host": parsed.hostname,
                    "port": parsed.port or 5432,
                    "user": parsed.username,
                    "database": parsed.path.lstrip("/"),
                    "ssl": False,
                }
                source = "postgres_url"
            except Exception as e:
                connection_error = f"Failed to parse POSTGRES_URL: {e}"
        else:
            connection_error = "No PG_HOST or POSTGRES_URL configured."

    # Git info
    git_info = {"branch": None, "commits": [], "error": None}
    try:
        branch = subprocess.check_output(
            ["git", "rev-parse", "--abbrev-ref", "HEAD"],
            stderr=subprocess.DEVNULL, timeout=3
        ).decode().strip()
        raw_log = subprocess.check_output(
            ["git", "log", "-5", "--format=%H|%s|%ai|%an"],
            stderr=subprocess.DEVNULL, timeout=3
        ).decode().strip()
        commits = []
        for line in raw_log.split("\n"):
            if not line:
                continue
            parts = line.split("|")
            if len(parts) >= 4:
                commits.append({
                    "hash": parts[0][:7],
                    "message": parts[1],
                    "date": parts[2],
                    "author": parts[3],
                })
        git_info = {"branch": branch, "commits": commits, "error": None}
    except Exception as e:
        git_info["error"] = f"Git metadata unavailable: {e}"

    # Data stats
    data_stats = {
        "totalRecords": None,
        "minDate": None,
        "maxDate": None,
        "cacheStatus": "cold",
        "fetchMode": "direct_pg" if pg_host else "postgres_url",
    }
    try:
        rows = RevenueRepository.find_all()
        if rows:
            date_range = RevenueRepository.get_date_range()
            fmt = lambda d: d.strftime("%Y-%m-%d") if isinstance(d, datetime) else str(d)
            data_stats = {
                "totalRecords": len(rows),
                "minDate": fmt(date_range["min_date"]),
                "maxDate": fmt(date_range["max_date"]),
                "cacheStatus": "warm",
                "fetchMode": "direct_pg" if pg_host else "postgres_url",
            }
    except Exception:
        data_stats["cacheStatus"] = "error"

    return {
        "connection": connection,
        "source": source,
        "connectionError": connection_error,
        "dataStats": data_stats,
        "gitInfo": git_info,
        "dataLogic": {
            "table": "revenue.revenue",
            "dateColumn": "invoice_date",
            "minDateFilter": "invoice_date > DATE '2022-12-25'",
            "currencyDivider": "10,000,000 (Divide to get Crores)",
            "fiscalYearStart": "April (month index 3)",
        },
    }


@router.post("/db/switch")
async def switch_db():
    """Clears all caches — call after changing DB credentials."""
    try:
        RevenueRepository.clear_cache()
        AnalyticsService.clear_cache()
        Cache.flush()
        return {
            "ok": True,
            "message": "All caches cleared. Next request re-fetches from the configured DB.",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail={"ok": False, "error": str(e)})


@router.get("/history")
async def get_history():
    """DB load history log (returns [] on failure, like the Node route)."""
    try:
        return RevenueRepository.get_load_history()
    except Exception as e:
        logger.error("api_history_fetch_failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to retrieve load history.")


@router.get("/health")
async def health():
    return {"module": "revenue", "status": "online"}
