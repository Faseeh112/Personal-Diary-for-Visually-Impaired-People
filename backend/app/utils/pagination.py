"""Simple query pagination helper for list endpoints."""
from flask import request


def paginate(query, default_limit: int = 50, max_limit: int = 200) -> dict:
    try:
        limit = min(int(request.args.get("limit", default_limit)), max_limit)
        offset = int(request.args.get("offset", 0))
    except (ValueError, TypeError):
        limit, offset = default_limit, 0
    limit = max(1, limit)
    offset = max(0, offset)

    total = query.count()
    items = query.limit(limit).offset(offset).all()
    return {"items": items, "total": total, "limit": limit, "offset": offset}
