"""Event instance routes."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from ..services import event_instance_service, cascade_service
from ..utils.responses import ok, created, no_content
from ..utils.jwt_helpers import current_user_id

bp = Blueprint("event_instance", __name__, url_prefix="/events")


@bp.get("")
@jwt_required()
def list_events():
    return ok([e.to_dict() for e in event_instance_service.list_for_user(current_user_id())])


@bp.get("/<int:event_instance_id>")
@jwt_required()
def get_event(event_instance_id: int):
    return ok(event_instance_service.get(current_user_id(), event_instance_id).to_dict())


@bp.post("")
@jwt_required()
def create_event():
    """Create event_instance. Fires cascade for birth/wedding/death."""
    payload = request.get_json(silent=True) or {}
    fire_cascade = payload.pop("fire_cascade", True)  # default ON

    e = event_instance_service.create(current_user_id(), payload)

    cascade_count = 0
    if fire_cascade:
        cascade_count = cascade_service.fire_cascade_for_event(
            e.event_instance_id, current_user_id())

    response = e.to_dict()
    response["cascade_reminders_created"] = cascade_count
    return created(response)


@bp.put("/<int:event_instance_id>")
@jwt_required()
def update_event(event_instance_id: int):
    e = event_instance_service.update(current_user_id(), event_instance_id, request.get_json(silent=True) or {})
    return ok(e.to_dict())


@bp.delete("/<int:event_instance_id>")
@jwt_required()
def delete_event(event_instance_id: int):
    event_instance_service.delete(current_user_id(), event_instance_id)
    return no_content()


@bp.get("/<int:event_instance_id>/cascade")
@jwt_required()
def get_cascade(event_instance_id: int):
    """List the auto-generated reminders this event spawned."""
    reminders = cascade_service.list_cascade_for_event(
        event_instance_id, current_user_id())
    return ok([r.to_dict() for r in reminders])
