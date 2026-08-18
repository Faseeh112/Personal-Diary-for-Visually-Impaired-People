"""Flask application factory."""
import os
from flask import Flask, jsonify
from .config import CONFIG_MAP
from .extensions import db, jwt, migrate, cors


def create_app(env: str = "development") -> Flask:
    app = Flask(__name__)
    app.config.from_object(CONFIG_MAP[env])

    # Extensions
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    allowed = [o.strip() for o in os.getenv(
    "CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173"
).split(",") if o.strip()]
    cors.init_app(
        app,
        resources={r"/*": {"origins": allowed}},
        supports_credentials=False,             # Bearer tokens, not cookies
        expose_headers=["Content-Disposition"], # for future file downloads
        max_age=86400,
    )

    # Ensure upload folder exists
    os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

    # Register models (imports trigger table registration)
    from . import models  # noqa: F401

    # Register blueprints — let real errors surface (no silent skip)
    from .routes import register_blueprints
    register_blueprints(app)

    # Error handlers
    from .utils.errors import register_error_handlers
    register_error_handlers(app)

    # Healthcheck
    @app.get("/health")
    def health():
        return jsonify(
            status="ok",
            service="smart_diary_backend",
            version="v3.1-phase4a",
        ), 200

    return app
