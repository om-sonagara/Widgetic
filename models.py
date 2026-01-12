from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import uuid
import enum

db = SQLAlchemy()

# Enums
class GlobalRole(enum.Enum):
    SUPERADMIN = "SUPERADMIN"
    USER = "USER"

class UserStatus(enum.Enum):
    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"

class WidgetType(enum.Enum):
    ANNOUNCEMENT_BAR = "ANNOUNCEMENT_BAR"
    NOTIFICATION = "NOTIFICATION"
    POPUP_MODAL = "POPUP_MODAL"
    SLIDE_IN = "SLIDE_IN"
    FLOATING_BUTTON = "FLOATING_BUTTON"
    BANNER = "BANNER"

class WidgetPosition(enum.Enum):
    TOP = "TOP"
    BOTTOM = "BOTTOM"
    TOP_LEFT = "TOP_LEFT"
    TOP_RIGHT = "TOP_RIGHT"
    BOTTOM_LEFT = "BOTTOM_LEFT"
    BOTTOM_RIGHT = "BOTTOM_RIGHT"
    LEFT_CENTER = "LEFT_CENTER"
    RIGHT_CENTER = "RIGHT_CENTER"
    CENTER = "CENTER"
    CENTER_LEFT = "CENTER_LEFT"
    CENTER_RIGHT = "CENTER_RIGHT"
    FLOATING_TOP = "FLOATING_TOP"
    FLOATING_BOTTOM = "FLOATING_BOTTOM"
    FLOATING_CENTER = "FLOATING_CENTER"

class WidgetStatus(enum.Enum):
    DRAFT = "DRAFT"
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    SCHEDULED = "SCHEDULED"
    EXPIRED = "EXPIRED"
    ARCHIVED = "ARCHIVED"

# Models

class User(UserMixin, db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(128))
    name = db.Column(db.String(100))
    global_role = db.Column(db.Enum(GlobalRole), default=GlobalRole.USER)
    status = db.Column(db.Enum(UserStatus), default=UserStatus.ACTIVE)
    
    # Relationships
    created_widgets = db.relationship('Widget', backref='creator', lazy=True, foreign_keys='Widget.created_by_id')

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    websites = db.relationship('WebsiteMember', backref='user', lazy=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Website(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    public_key = db.Column(db.String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)
    name = db.Column(db.String(100), nullable=False)
    domain = db.Column(db.String(255)) # e.g., https://example.com
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Global Widget Settings for this website
    # Structure: { "loop": { "enabled": bool, "showTime": int, "hideTime": int } }
    settings = db.Column(db.JSON, default={})
    
    # Relationships
    members = db.relationship('WebsiteMember', backref='website', lazy=True)
    widgets = db.relationship('Widget', backref='website', lazy=True)

class WebsiteMember(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    website_id = db.Column(db.String(36), db.ForeignKey('website.id'), nullable=False)
    role = db.Column(db.String(20), default="ADMIN") # ADMIN, EDITOR, VIEWER

class Widget(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    public_key = db.Column(db.String(36), unique=True, default=lambda: str(uuid.uuid4()), index=True)
    website_id = db.Column(db.String(36), db.ForeignKey('website.id'), nullable=False)
    
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.Enum(WidgetType), default=WidgetType.NOTIFICATION)
    status = db.Column(db.Enum(WidgetStatus), default=WidgetStatus.DRAFT)
    position = db.Column(db.Enum(WidgetPosition), default=WidgetPosition.BOTTOM_RIGHT)

    # Content & Style stored as JSON
    content = db.Column(db.JSON, nullable=False)
    style = db.Column(db.JSON, nullable=True)
    
    # Analytics
    views = db.Column(db.Integer, default=0)
    clicks = db.Column(db.Integer, default=0)
    
    created_by_id = db.Column(db.String(36), db.ForeignKey('user.id'), nullable=False)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
