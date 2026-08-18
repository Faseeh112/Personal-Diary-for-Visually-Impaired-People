from app import create_app
from app.extensions import db

app = create_app()

with app.app_context():
    sql = """
    IF COL_LENGTH('note_transaction', 'event_context') IS NULL
    BEGIN
        ALTER TABLE note_transaction
        ADD event_context NVARCHAR(255) NULL
    END
    """
    db.session.execute(db.text(sql))
    db.session.commit()

print("event_context migration complete")
