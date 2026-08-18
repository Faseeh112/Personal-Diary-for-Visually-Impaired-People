"""Configuration. Reads from env; supports MSSQL (prod) or SQLite (dev)."""
import os
from datetime import timedelta
from urllib.parse import quote_plus
from dotenv import load_dotenv

load_dotenv()


def _mssql_uri() -> str:
    server   = os.getenv("MSSQL_SERVER",   "localhost")
    database = os.getenv("MSSQL_DATABASE", "SmartDiaryDB")
    user     = os.getenv("MSSQL_USER",     "sa")
    password = os.getenv("MSSQL_PASSWORD", "")
    driver   = os.getenv("MSSQL_DRIVER",   "ODBC Driver 17 for SQL Server")

    odbc = (
        f"DRIVER={{{driver}}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={user};"
        f"PWD={password};"
        f"TrustServerCertificate=yes;"
    )
    return f"mssql+pyodbc:///?odbc_connect={quote_plus(odbc)}"


def _db_uri() -> str:
    if os.getenv("USE_SQLITE", "0") == "1":
        return f"sqlite:///{os.getenv('SQLITE_PATH', 'smart_diary_dev.db')}"
    return _mssql_uri()


class BaseConfig:
    SQLALCHEMY_DATABASE_URI = _db_uri()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True, "pool_recycle": 3600}

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=int(os.getenv("JWT_ACCESS_TOKEN_HOURS", "24")))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.getenv("JWT_REFRESH_TOKEN_DAYS", "30")))

    UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", "uploads")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH_MB", "50")) * 1024 * 1024


class DevConfig(BaseConfig):
    DEBUG = True


class ProdConfig(BaseConfig):
    DEBUG = False


CONFIG_MAP = {"development": DevConfig, "production": ProdConfig}
