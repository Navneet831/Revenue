import time
from threading import Lock
from typing import Any, Optional

class Cache:
    _cache = {}
    _lock = Lock()

    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        with cls._lock:
            entry = cls._cache.get(key)
            if entry is None:
                return None
            if entry['expires_at'] < time.time():
                del cls._cache[key]
                return None
            return entry['value']

    @classmethod
    def set(cls, key: str, value: Any, ttl_seconds: int = 300) -> None:
        with cls._lock:
            cls._cache[key] = {
                'value': value,
                'expires_at': time.time() + ttl_seconds
            }

    @classmethod
    def flush(cls) -> None:
        with cls._lock:
            cls._cache.clear()
