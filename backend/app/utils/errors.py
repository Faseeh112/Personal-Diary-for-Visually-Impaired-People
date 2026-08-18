"""Centralized error handling. Raise HTTPError anywhere; get a JSON response."""
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException
from sqlalchemy.exc import IntegrityError
from .responses import error


class HTTPError(Exception):
    def __init__(self, message: str, status: int = 400, details=None):
        super().__init__(message)
        self.message = message
        self.status = status
        self.details = details


def register_error_handlers(app: Flask) -> None:

    @app.errorhandler(HTTPError)
    def _handle_http_error(e: HTTPError):
        return error(e.message, e.status, e.details)

    @app.errorhandler(HTTPException)
    def _handle_http_exception(e: HTTPException):
        return error(e.description or str(e), e.code or 500)

    @app.errorhandler(IntegrityError)
    def _handle_integrity(e: IntegrityError):
        return error("Database integrity error", 409, str(e.orig) if e.orig else None)

    @app.errorhandler(Exception)
    def _handle_generic(e: Exception):
        app.logger.exception("Unhandled exception")
        return error("Internal server error", 500, str(e) if app.debug else None)
