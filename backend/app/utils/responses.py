"""Uniform JSON response helpers. All API responses follow the same shape."""
from flask import jsonify


def ok(data=None, message: str = "Success"):
    return jsonify(success=True, message=message, data=data), 200


def created(data=None, message: str = "Created"):
    return jsonify(success=True, message=message, data=data), 201


def no_content(message: str = "Deleted"):
    return jsonify(success=True, message=message, data=None), 200


def error(message: str, status: int = 400, details=None):
    body = {"success": False, "message": message}
    if details is not None:
        body["details"] = details
    return jsonify(body), status
