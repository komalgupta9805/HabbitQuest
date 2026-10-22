"""Environment-backed settings with safe local-development defaults."""
import os

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
