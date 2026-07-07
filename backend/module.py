from fastapi import APIRouter
from typing import Dict, Any, List
from packages.contracts import PlatformModule
import apps.Revenue.backend.routes as routes_mod


class RevenueModule(PlatformModule):
    def __init__(self):
        super().__init__()
        self.name = "revenue"
        self.version = "1.0.0"
        self.dependencies = ["core >= 1.0.0"]
        self.permissions = ["revenue:read", "revenue:write"]
        self.services = {}

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

    def get_router(self) -> APIRouter:
        return routes_mod.router

    def check_health(self) -> Dict[str, Any]:
        health = super().check_health()
        return health


# Export an instance for the loader
module = RevenueModule()
