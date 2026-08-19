"""Standalone FastAPI server for the Revenue Analytics API.

Full replacement for the Node/Express server in apps/api/index.js. Run from the
repo root:  uvicorn backend.main:app --host 0.0.0.0 --port 8000

Same package (backend/*) also loads inside the GrewAnalytics platform as a
module (see module.py); the routes/services use relative imports so both work.
"""
import json
import logging
import os
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse

# --- .env (repo root: backend/ -> ..) BEFORE importing the DB layer, which
# reads env at connect time. override=False so real env wins over the file. ---
ROOT = Path(__file__).resolve().parent.parent


def _load_env(path: Path):
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key, val = key.strip(), val.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = val


_load_env(ROOT / ".env")

from .database import clear_db_cache, fetch_db_config  # noqa: E402
from .routes import router as revenue_router  # noqa: E402
from .services.analytics_service import AnalyticsService  # noqa: E402
from .services.cache import Cache  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("revenue.api")

# Feature-flag defaults mirror @revenue/shared FEATURES.
_FEATURE_DEFAULTS = {
    "FEATURE_AGENTATION": True,
    "FEATURE_STORY": True,
    "FEATURE_COMMIT_DRILLDOWN": False,
    "FEATURE_ENABLE_AUTH": True,
}


def _feat(key: str) -> bool:
    v = os.getenv(key)
    return _FEATURE_DEFAULTS[key] if v is None else v.strip().lower() == "true"


app = FastAPI(title="Revenue Analytics API")
app.add_middleware(GZipMiddleware, minimum_size=500)

# --- CORS: CORS_ORIGINS (comma-separated); empty or "*" = allow any origin. ---
_origins = [s.strip() for s in os.getenv("CORS_ORIGINS", "").split(",") if s.strip()]
if not _origins or "*" in _origins:
    app.add_middleware(CORSMiddleware, allow_origin_regex=".*", allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])
else:
    app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"])

# --- Rate limiting: 200 requests / 15 min per IP on /api/*. ---
_RL_WINDOW, _RL_MAX = 15 * 60, 200
_rl: dict = {}


@app.middleware("http")
async def _throttle_and_log(request: Request, call_next):
    logger.info("http_request %s %s", request.method, request.url.path)
    if request.url.path.startswith("/api/"):
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        count, start = _rl.get(ip, (0, now))
        if now - start >= _RL_WINDOW:
            count, start = 0, now
        count += 1
        _rl[ip] = (count, start)
        if len(_rl) > 10000:  # ponytail: crude prune, fine for an internal tool
            for k in [k for k, (_, s) in _rl.items() if now - s >= _RL_WINDOW]:
                _rl.pop(k, None)
        if count > _RL_MAX:
            logger.warning("rate_limit_exceeded ip=%s url=%s", ip, request.url.path)
            return JSONResponse({"error": "Too many requests"}, status_code=429)
    return await call_next(request)


# --- Authentication: Bearer token verified against Supabase, 60s cache. ---
_TOKEN_TTL = 60
_token_cache: dict = {}


async def authenticate(request: Request) -> dict:
    if not _feat("FEATURE_ENABLE_AUTH"):
        return {"id": "admin", "email": "admin@grew.energy"}

    auth_header = request.headers.get("authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    cached = _token_cache.get(token)
    if cached and cached[1] > time.time():
        return cached[0]

    url, key = os.getenv("VITE_SUPABASE_URL"), os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        logger.error("auth_verification_failed: Supabase URL or Anon Key missing")
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    try:
        req = urllib.request.Request(
            f"{url}/auth/v1/user",
            headers={"apikey": key, "Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError:
        raise HTTPException(status_code=401, detail="Unauthorized")
    except Exception as e:
        logger.error("auth_verification_failed: %s", e)
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    user_email = data.get("email")
    user = {"id": data.get("id"), "email": user_email, "features": {}}

    try:
        import urllib.parse
        encoded_email = urllib.parse.quote(user_email)
        whitelist_req = urllib.request.Request(
            f"{url}/rest/v1/whitelist?select=*&email=eq.{encoded_email}",
            headers={"apikey": key, "Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        )
        with urllib.request.urlopen(whitelist_req, timeout=5) as w_resp:
            w_data = json.loads(w_resp.read().decode())
            if w_data and isinstance(w_data, list) and len(w_data) > 0:
                row = w_data[0]
                for k, v in row.items():
                    if k != 'email':
                        if isinstance(v, bool):
                            user["features"][k] = v
                        elif isinstance(v, str):
                            user["features"][k] = v.lower() == 'true'
    except Exception as e:
        logger.error("whitelist_fetch_failed: %s", e)

    path = request.url.path
    features = user["features"]
    
    # Enforce user-wise permissions
    if path.startswith("/api/v1/revenue/analytics") or path.startswith("/api/v1/revenue/meta") or path.startswith("/api/v1/revenue/summary") or path.startswith("/api/v1/revenue/daily-series"):
        if "dashboard" in features and not features.get("dashboard"):
            raise HTTPException(status_code=403, detail="Forbidden: Dashboard access required")
    elif path.startswith("/api/v1/revenue/history") or path.startswith("/api/v1/db/load-history"):
        if "audit" in features and not features.get("audit"):
            raise HTTPException(status_code=403, detail="Forbidden: Audit access required")

    if len(_token_cache) > 1000:
        _token_cache.clear()
    _token_cache[token] = (user, time.time() + _TOKEN_TTL)
    logger.info("auth_verified email=%s url=%s", user["email"], request.url.path)
    return user


# --- Feature flags ---
@app.get("/api/features")
async def get_features(request: Request):
    referer = request.headers.get("referer", "")
    has_bypass = "bypass_auth=true" in referer
    enable_auth = False if has_bypass else _feat("FEATURE_ENABLE_AUTH")
    return {
        "agentation": _feat("FEATURE_AGENTATION"),
        "story": _feat("FEATURE_STORY"),
        "commitDrilldown": _feat("FEATURE_COMMIT_DRILLDOWN"),
        "enable_auth": enable_auth,
    }



# --- DB switch / status ---
@app.post("/api/v1/db/switch")
async def db_switch():
    try:
        clear_db_cache()
        AnalyticsService.clear_cache()
        Cache.flush()
        logger.info("db_switch_triggered")
        return {
            "ok": True,
            "message": "All caches cleared. Next request re-fetches credentials from "
            "Supabase edge function and connects to the newly configured DB.",
        }
    except Exception as e:
        return JSONResponse({"ok": False, "error": str(e)}, status_code=500)


@app.get("/api/v1/db/status")
async def db_status():
    try:
        cfg = fetch_db_config()
        return {
            "configured": True,
            "source": cfg.get("source"),
            "host": cfg.get("host"),
            "port": cfg.get("port"),
            "database": cfg.get("database"),
            "user": cfg.get("user"),
            "password": "***" if cfg.get("password") else "(not set)",
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=502)


# --- Revenue domain routes (both legacy and v1 prefixes), behind auth ---
app.include_router(revenue_router, prefix="/api/revenue", dependencies=[Depends(authenticate)])
app.include_router(revenue_router, prefix="/api/v1/revenue", dependencies=[Depends(authenticate)])


# --- Git history endpoints (disabled in .exe builds via HIDE_GIT_ENDPOINTS) ---
if not os.getenv("HIDE_GIT_ENDPOINTS"):
    _git_cache: dict = {"payload": None, "expires": 0.0}

    def _git(*args: str) -> str:
        return subprocess.check_output(["git", *args], cwd=str(ROOT)).decode().strip()

    @app.get("/api/git/commits", dependencies=[Depends(authenticate)])
    async def git_commits():
        try:
            if not _git_cache["payload"] or _git_cache["expires"] < time.time():
                log = _git("--no-pager", "log", "--oneline")
                commits = []
                for i, line in enumerate(log.split("\n")):
                    parts = line.split(" ")
                    commits.append({"index": i, "hash": parts[0], "msg": " ".join(parts[1:])})
                current = _git("rev-parse", "--short", "HEAD")
                _git_cache.update(payload={"commits": commits, "currentHash": current},
                                  expires=time.time() + 60)
            return _git_cache["payload"]
        except Exception:
            return JSONResponse({"error": "Git history unavailable"}, status_code=500)

    @app.post("/api/git/checkout", dependencies=[Depends(authenticate)])
    async def git_checkout(request: Request):
        import re
        body = await request.json()
        commit_hash = (body or {}).get("hash", "")
        if not re.fullmatch(r"[0-9a-f]{7,40}", commit_hash, re.IGNORECASE):
            return JSONResponse({"error": "Invalid commit hash"}, status_code=400)
        try:
            _git("checkout", commit_hash)
            try:
                # Keep Commit Drill-down files functional so the UI can navigate back.
                _git("checkout", "main", "--",
                     "apps/web/src/modules/shared/CommitDrilldown.tsx",
                     "apps/api/index.js", "apps/web/src/App.tsx")
            except Exception as e:
                logger.error("git_restore_drilldown_failed: %s", e)
            _git_cache["payload"] = None
            return {"ok": True, "hash": commit_hash}
        except Exception as e:
            logger.error("git_checkout_failed: %s", e)
            return JSONResponse(
                {"error": "Checkout failed. Commit local changes first."}, status_code=500)


# --- Static assets + SPA fallback (registered last so /api/* wins) ---
_DIST = ROOT / "apps" / "web" / "dist"


@app.get("/{full_path:path}")
async def spa(full_path: str):
    if full_path.startswith("api") or full_path == "metrics":
        raise HTTPException(status_code=404, detail="Not found")
    candidate = _DIST / full_path
    if full_path and candidate.is_file():
        return FileResponse(candidate)
    index = _DIST / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host=os.getenv("HOST", "0.0.0.0"), port=int(os.getenv("PORT", "8000")))
