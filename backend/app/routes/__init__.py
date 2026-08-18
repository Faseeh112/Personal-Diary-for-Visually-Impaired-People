"""Blueprint registry — single source of truth for HTTP routes."""
from flask import Flask

from .auth            import bp as auth_bp
from .user            import bp as user_bp
from .note            import bp as note_bp
from .person          import bp as person_bp
from .location        import bp as location_bp
from .category        import bp as category_bp
from .tag             import bp as tag_bp
from .asset           import bp as asset_bp
from .stored_item     import bp as stored_item_bp
from .reminder        import bp as reminder_bp
from .timetable       import bp as timetable_bp
from .event_instance  import bp as event_instance_bp
from .triple          import bp as triple_bp
from .predicate_vocab import bp as predicate_vocab_bp
from .currency        import bp as currency_bp
from .attachment      import bp as attachment_bp
from .audio_action    import bp as audio_action_bp
from .activity_log    import bp as activity_log_bp
from .voice_entry     import bp as voice_entry_bp
from .voice           import bp as voice_bp
from .query           import bp as query_bp
from .upload          import bp as upload_bp   # NEW (chunk 2)

_ALL_BLUEPRINTS = [
    auth_bp, user_bp, note_bp, person_bp, location_bp, category_bp, tag_bp,
    asset_bp, stored_item_bp, reminder_bp, timetable_bp, event_instance_bp,
    triple_bp, predicate_vocab_bp, currency_bp, attachment_bp, audio_action_bp,
    activity_log_bp, voice_entry_bp, voice_bp, query_bp, upload_bp,
]


def register_blueprints(app: Flask) -> None:
    for bp in _ALL_BLUEPRINTS:
        app.register_blueprint(bp)
