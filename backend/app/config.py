"""Environment-backed settings with safe local-development defaults."""
import os
from pathlib import Path


def _load_local_env() -> None:
    """Load ignored local development settings without overriding real env vars."""
    env_file = Path(__file__).resolve().parents[1] / ".env"
    if not env_file.is_file():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


_load_local_env()

DATABASE_URL = os.getenv("HABITQUEST_DATABASE_URL", "sqlite:///./habitquest.db")
CORS_ORIGINS = [origin.strip() for origin in os.getenv(
    "HABITQUEST_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",") if origin.strip()]
# Vite selects the next free port when 5173 is occupied. This development-only
# expression permits loopback hosts on those dynamic ports, but no LAN or public host.
CORS_ORIGIN_REGEX = os.getenv(
    "HABITQUEST_CORS_ORIGIN_REGEX",
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
).strip() or None
COMPLETION_XP = 20
DAILY_BONUS_XP = 40
ACHIEVEMENT_XP = {
    "first_step": 10,
    "three_days": 25,
    "seven_days": 50,
    "fourteen_days": 75,
    "thirty_completions": 100,
}
EMAILJS_PUBLIC_KEY = os.getenv("EMAILJS_PUBLIC_KEY", "").strip()
EMAILJS_SERVICE_ID = os.getenv("EMAILJS_SERVICE_ID", "").strip()
EMAILJS_TEMPLATE_ID = os.getenv("EMAILJS_TEMPLATE_ID", "").strip()
APP_URL = os.getenv("APP_URL", "http://127.0.0.1:5173").rstrip("/")
