"""Password hashing (bcrypt)."""
import bcrypt

_BCRYPT_MAX = 72  # bcrypt truncates beyond 72 bytes; be explicit about it.


def _prep(password: str) -> bytes:
    b = password.encode("utf-8")
    return b[:_BCRYPT_MAX]


def hash_password(password: str) -> bytes:
    return bcrypt.hashpw(_prep(password), bcrypt.gensalt())


def verify_password(password: str, hashed: bytes) -> bool:
    try:
        return bcrypt.checkpw(_prep(password), hashed)
    except (ValueError, TypeError):
        return False
