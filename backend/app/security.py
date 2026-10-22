"""Authentication primitives kept separate from HTTP route code."""
from datetime import datetime, timedelta, timezone
from hashlib import pbkdf2_hmac
from hmac import compare_digest
from secrets import token_urlsafe

import bcrypt

TOKEN_LIFETIME = timedelta(days=7)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, stored: str) -> tuple[bool, bool]:
    """Return (valid, needs_upgrade), supporting hashes from the first prototype."""
    if stored.startswith("$2"):
        return bcrypt.checkpw(password.encode(), stored.encode()), False
    legacy = pbkdf2_hmac("sha256", password.encode(), b"habitquest-local", 100_000).hex()
    valid = compare_digest(legacy, stored)
    return valid, valid


def issue_token() -> tuple[str, datetime]:
    return token_urlsafe(32), datetime.now(timezone.utc).replace(tzinfo=None) + TOKEN_LIFETIME


def token_is_valid(expires_at: datetime | None) -> bool:
    return bool(expires_at and expires_at > datetime.now(timezone.utc).replace(tzinfo=None))
