from fastapi import APIRouter, Depends
from typing import Dict, Any, List
from packages.contracts import PlatformModule
from . import routes as routes_mod


class RevenueModule(PlatformModule):
    def __init__(self):
        super().__init__()
        self.name = "revenue"
        self.version = "1.0.0"
        self.dependencies = ["core >= 1.0.0"]
        self.permissions = ["revenue:read", "revenue:write"]
        self.services = {}
        self._auth_service = None

    def initialize(self, services: Dict[str, Any]):
        self.services = services

        from apps.Revenue.backend.database import set_platform_repo

        pg_manager = services.get("pg_db")

        if pg_manager is not None:
            from apps.Revenue.backend.database import PostgreSQLRepository
            try:
                repo = PostgreSQLRepository(pg_manager.database_url)
                set_platform_repo(repo)
            except Exception as e:
                print(f"⚠️  Revenue: Failed to connect to PostgreSQL ({e}). Continuing without repository connection at boot.")

        self.audit = services.get("audit")
        self.agent = services.get("agent")
        self.graph = services.get("knowledge")
        self._auth_service = services.get("auth")

    def get_router(self) -> APIRouter:
        # The shell mounts this router with NO auth layer of its own
        # (see apps/shell-backend/module_loader.py), so module routes would
        # otherwise be fully public. When the platform injects an AuthService,
        # secure every route behind JWT authentication — mirroring how the
        # standalone server (main.py) wraps the same router with Depends(auth).
        if self._auth_service is not None:
            auth_dep = self._auth_service.get_current_user
            secured = APIRouter(dependencies=[Depends(auth_dep)])
            secured.include_router(routes_mod.router)
            return secured
        return routes_mod.router

    def check_health(self) -> Dict[str, Any]:
        health = super().check_health()
        return health


# Export an instance for the loader
module = RevenueModule()
