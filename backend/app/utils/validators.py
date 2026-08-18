"""Input validators. Used in services, reusable from future voice pipeline."""
from datetime import datetime, date, time
from typing import Any, Optional
from dateutil import parser as dateparser
from .errors import HTTPError


def require(payload: dict, field: str) -> Any:
    if field not in payload or payload[field] in (None, ""):
        raise HTTPError(f"Field '{field}' is required", 400)
    return payload[field]


def optional(payload: dict, field: str, default=None) -> Any:
    v = payload.get(field, default)
    return default if v in (None, "") else v


def parse_date(value: Any, field: str = "date") -> Optional[date]:
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    try:
        return dateparser.parse(str(value)).date()
    except (ValueError, TypeError) as e:
        raise HTTPError(f"Invalid date for '{field}': {value}", 400) from e


def parse_datetime(value: Any, field: str = "datetime") -> Optional[datetime]:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    try:
        return dateparser.parse(str(value))
    except (ValueError, TypeError) as e:
        raise HTTPError(f"Invalid datetime for '{field}': {value}", 400) from e


def parse_time(value: Any, field: str = "time") -> Optional[time]:
    if value in (None, ""):
        return None
    if isinstance(value, time):
        return value
    try:
        return dateparser.parse(str(value)).time()
    except (ValueError, TypeError) as e:
        raise HTTPError(f"Invalid time for '{field}': {value}", 400) from e


def enum_in(value: Any, allowed: set, field: str) -> Any:
    if value not in allowed:
        raise HTTPError(
            f"Invalid value for '{field}': {value!r}. Allowed: {sorted(allowed)}", 400
        )
    return value


def positive_number(value: Any, field: str, allow_zero: bool = True) -> float:
    try:
        n = float(value)
    except (ValueError, TypeError) as e:
        raise HTTPError(f"'{field}' must be a number", 400) from e
    if n < 0 or (n == 0 and not allow_zero):
        raise HTTPError(f"'{field}' must be {'>= 0' if allow_zero else '> 0'}", 400)
    return n
