"""JWT helpers. sub claim is stored as string per JWT spec; we cast back to int."""
from flask_jwt_extended import get_jwt_identity


def current_user_id() -> int:
    identity = get_jwt_identity()
    if identity is None:
        return 0
    return int(identity)
