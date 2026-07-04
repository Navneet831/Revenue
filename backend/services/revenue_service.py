import logging
from apps.Revenue.backend.database import RevenueRepository
from apps.Revenue.backend.sanitizer import build_key_map, sanitize

logger = logging.getLogger(__name__)


class RevenueService:
    @staticmethod
    async def get_clean_revenue() -> list:
        """Fetches all revenue rows and sanitizes them."""
        raw_rows = RevenueRepository.find_all()
        if not raw_rows:
            return []
        key_map = build_key_map(raw_rows[0])
        clean_data = []
        for row in raw_rows:
            sanitized = sanitize(row, key_map)
            if sanitized and sanitized.get('date'):
                # Convert date to ISO string for JSON
                sanitized['date'] = sanitized['date'].isoformat()
                clean_data.append(sanitized)
        return clean_data
