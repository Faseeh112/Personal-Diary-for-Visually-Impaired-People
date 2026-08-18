"""Auth service: register, authenticate, refresh."""
from datetime import datetime
from email_validator import validate_email, EmailNotValidError
from flask_jwt_extended import create_access_token, create_refresh_token

from ..extensions import db
from ..models import AppUser, UserSettings
from ..utils.security import hash_password, verify_password
from ..utils.errors import HTTPError


MIN_PWD = 8


def register(name: str, email: str, password: str) -> dict:
    if not name or not name.strip():
        raise HTTPError("Name is required", 400)
    try:
        email_clean = validate_email(email, check_deliverability=False).normalized
    except EmailNotValidError as e:
        raise HTTPError(f"Invalid email: {e}", 400) from e
    if len(password or "") < MIN_PWD:
        raise HTTPError(f"Password must be at least {MIN_PWD} characters", 400)

    if AppUser.query.filter_by(email=email_clean).first():
        raise HTTPError("Email already registered", 409)

    user = AppUser(
        name=name.strip(),
        email=email_clean,
        password_hash=hash_password(password),
    )
    db.session.add(user)
    db.session.flush()  # get user_id

    # Create default settings
    db.session.add(UserSettings(user_id=user.user_id))
    db.session.commit()

    return _token_payload(user)


def authenticate(email: str, password: str) -> dict:
    user = AppUser.query.filter_by(email=(email or "").strip().lower()).first()
    if not user or not user.is_active:
        raise HTTPError("Invalid credentials", 401)
    if not verify_password(password or "", user.password_hash):
        raise HTTPError("Invalid credentials", 401)
    user.last_login = datetime.utcnow()
    db.session.commit()
    return _token_payload(user)


def refresh(user_id: int) -> dict:
    user = db.session.get(AppUser, user_id)
    if not user or not user.is_active:
        raise HTTPError("User not found", 404)
    return {"access_token": create_access_token(identity=str(user.user_id))}


def _token_payload(user: AppUser) -> dict:
    return {
        "access_token":  create_access_token(identity=str(user.user_id)),
        "refresh_token": create_refresh_token(identity=str(user.user_id)),
        "user": user.to_dict(),
    }
