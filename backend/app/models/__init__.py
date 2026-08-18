"""Model package — imports register SQLAlchemy metadata."""
from .user import AppUser
from .user_settings import UserSettings
from .currency import Currency
from .category import Category
from .person import Person
from .location import Location
from .tag import Tag, NoteTag
from .event_instance import EventInstance
from .note import Note
from .note_transaction import NoteTransaction
from .asset import Asset
from .reminder import Reminder
from .timetable import Timetable
from .activity_log import ActivityLog
from .stored_item import StoredItem
from .audio_action import AudioAction
from .attachment import Attachment
from .voice_entry import VoiceEntry
from .ai_query_log import AIQueryLog
from .predicate_vocab import PredicateVocab
from .knowledge_triple import KnowledgeTriple
from .zakat_nisab import ZakatNisab

__all__ = [
    "AppUser", "UserSettings", "Currency", "Category", "Person", "Location",
    "Tag", "NoteTag", "EventInstance", "Note", "NoteTransaction", "Asset",
    "Reminder", "Timetable", "ActivityLog", "StoredItem", "AudioAction",
    "Attachment", "VoiceEntry", "AIQueryLog", "PredicateVocab",
    "KnowledgeTriple", "ZakatNisab",
]
