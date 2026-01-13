from flask import Flask, render_template, redirect, url_for, flash, request, jsonify, make_response
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from models import db, User, Website, WebsiteMember, GlobalRole, UserStatus, Widget, WidgetType, WidgetStatus, WidgetPosition, Analytics, GlobalRole
import uuid
import json
from flask_migrate import Migrate
from flask_cors import CORS
from datetime import datetime
from sqlalchemy import func


app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)
migrate = Migrate(app, db)
CORS(app, resources={r"/api/*": {"origins": "*"}})
login_manager = LoginManager(app)
login_manager.login_view = 'login'

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(user_id)

# Removed deprecated before_first_request

# Authentication Routes

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        name = request.form.get('name')
        
        if User.query.filter_by(email=email).first():
            flash('Email already registered')
            return redirect(url_for('register'))
            
        user = User(email=email, name=name, password_hash=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        
        
        login_user(user)

        # Auto-create Website for new User
        # Name it "[User Name]'s Website"
        company_site = Website(
            name=f"{name}'s Website",
            domain="" # Pending setup
        )
        db.session.add(company_site)
        db.session.commit()
        
        # Add User as Admin
        member = WebsiteMember(user_id=user.id, website_id=company_site.id, role="ADMIN")
        db.session.add(member)
        db.session.commit()

        # Redirect to the new website
        return redirect(url_for('website_detail', website_id=company_site.id))
        
    return render_template('auth/register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        user = User.query.filter_by(email=email).first()
        
        if user and check_password_hash(user.password_hash, password):
            login_user(user)
            login_user(user)
            
            # Redirect Logic
            if user.global_role == GlobalRole.SUPERADMIN:
                return redirect(url_for('dashboard'))
            else:
                # Regular user: redirect to first website if exists
                member_ship = WebsiteMember.query.filter_by(user_id=user.id).first()
                if member_ship:
                    return redirect(url_for('website_detail', website_id=member_ship.website_id))
                else:
                    return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password')
            
    return render_template('auth/login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

# Dashboard & Website Routes

@app.route('/')
def index():
    return redirect(url_for('dashboard'))


@app.route('/dashboard')
@login_required
def dashboard():
    # Superadmin sees all
    if current_user.global_role == GlobalRole.SUPERADMIN:
        websites = Website.query.all()
        return render_template('dashboard/websites.html', websites=websites)
    else:
        # Regular Users: Redirect to their first website
        membership = WebsiteMember.query.filter_by(user_id=current_user.id).first()
        if membership:
            return redirect(url_for('website_detail', website_id=membership.website_id))
        else:
            # Fallback if no website exists (should be rare due to auto-create)
            return render_template('dashboard/websites.html', websites=[])

@app.route('/website/new', methods=['GET', 'POST'])
@login_required
def create_new_website():
    # Only Superadmin can create websites
    if current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Only Superadmins can create new websites.", "error")
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        name = request.form.get('name')
        domain = request.form.get('domain')
        
        website = Website(name=name, domain=domain)
        db.session.add(website)
        db.session.commit()
        
        member = WebsiteMember(user_id=current_user.id, website_id=website.id, role="ADMIN")
        db.session.add(member)
        db.session.commit()
        
        return redirect(url_for('dashboard'))
        
    return render_template('dashboard/create_website.html')

@app.route('/website/<website_id>')
@login_required
def website_detail(website_id):
    website = Website.query.get_or_404(website_id)
    # Check membership
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))
        
    search_query = request.args.get('search', '')
    filter_type = request.args.get('type', '')
    filter_status = request.args.get('status', '')

    query = Widget.query.filter_by(website_id=website.id)

    if search_query:
        query = query.filter(Widget.name.contains(search_query))
    
    if filter_type:
        query = query.filter(Widget.type == WidgetType(filter_type))
    
    if filter_status:
        query = query.filter(Widget.status == WidgetStatus(filter_status))

    widgets = query.order_by(Widget.created_at.desc()).all()
    
    # Calculate stats
    total_views = sum(w.views for w in website.widgets)
    total_clicks = sum(w.clicks for w in website.widgets)
    ctr = (total_clicks / total_views * 100) if total_views > 0 else 0
    
    return render_template('dashboard/index.html', 
                           website=website, 
                           widgets=widgets, 
                           total_views=total_views,
                           total_clicks=total_clicks,
                           ctr=ctr,
                           WidgetType=WidgetType, 
                           WidgetStatus=WidgetStatus,
                           search_query=search_query,
                           filter_type=filter_type,
                           filter_status=filter_status)

@app.route('/website/<website_id>/pricing')
@login_required
def website_pricing(website_id):
    website = Website.query.get_or_404(website_id)
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))
        
    return render_template('dashboard/pricing.html', website=website)

@app.route('/website/<website_id>/analytics')
@login_required
def website_analytics(website_id):
    website = Website.query.get_or_404(website_id)
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))

    # Calculate stats
    total_views = sum(w.views for w in website.widgets)
    total_clicks = sum(w.clicks for w in website.widgets)
    ctr = (total_clicks / total_views * 100) if total_views > 0 else 0
    
    return render_template('dashboard/analytics.html', 
                            website=website, 
                            widgets=website.widgets,
                            total_views=total_views,
                            total_clicks=total_clicks,
                            ctr=ctr)

@app.route('/website/<website_id>/analytics/table')
@login_required
def website_analytics_table(website_id):
    website = Website.query.get_or_404(website_id)
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))

    # Fetch daily analytics for all widgets in this website
    # Join with Widget to get the name, and aggregate duplicates
    results = db.session.query(
        Analytics.date, 
        Widget, 
        func.sum(Analytics.views).label('views'),
        func.sum(Analytics.clicks).label('clicks'),
        func.sum(Analytics.dismissals).label('dismissals')
    ).join(Widget).filter(
        Widget.website_id == website.id
    ).group_by(
        Analytics.date, Widget.id
    ).order_by(
        Analytics.date.desc()
    ).all()
    
    # Structure for template: dict of {date: list of (stat_obj_like, widget)}
    # We use a standard dictionary and sort keys in the template, or use a list of tuples
    grouped_data = {}
    for r in results:
        date_key = r[0]
        stat = {
            'views': r[2] or 0,
            'clicks': r[3] or 0,
            'dismissals': r[4] or 0
        }
        if date_key not in grouped_data:
            grouped_data[date_key] = []
        grouped_data[date_key].append((stat, r[1]))
    
    # Sort dates descending
    sorted_dates = sorted(grouped_data.keys(), reverse=True)
    
    return render_template('dashboard/analytics_table.html', website=website, grouped_data=grouped_data, sorted_dates=sorted_dates)



@app.route('/website/<website_id>/upgrade', methods=['POST'])
@login_required
def upgrade_website(website_id):
    website = Website.query.get_or_404(website_id)
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized", "error")
        return redirect(url_for('dashboard'))
        
    plan_price = request.form.get('price')
    
    # Ensure current max_widgets is int
    if website.max_widgets is None:
        website.max_widgets = 3

    if plan_price == '399':
        website.max_widgets += 1
        flash("Successfully added 1 Toast!", "success")
    elif plan_price == '699':
        website.max_widgets += 2
        flash("Successfully added 2 Toasts!", "success")
    elif plan_price == '999':
        website.max_widgets += 3
        flash("Successfully added 3 Toasts!", "success")
    else:
        flash("Invalid plan selected", "error")
        
    db.session.commit()
    return redirect(url_for('website_detail', website_id=website.id))


@app.route('/website/<website_id>/settings', methods=['POST'])
@login_required
def website_settings(website_id):
    website = Website.query.get_or_404(website_id)
    # Check membership
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))

    # Update Settings
    hide_time = int(request.form.get('hide_time', 8))
    show_time = int(request.form.get('show_time', 5))
    
    position = request.form.get('position', 'BOTTOM_RIGHT')
    bg_color = request.form.get('background_color', '#000000')
    text_color = request.form.get('text_color', '#ffffff')
    
    show_close_button = request.form.get('show_close_button') == 'on'
    show_branding = request.form.get('show_branding') == 'on'
    
    website.settings = {
        "timing": {
            "showTime": show_time,
            "hideTime": hide_time
        },
        "position": position,
        "style": {
            "backgroundColor": bg_color,
            "textColor": text_color
        },
        "behavior": {
            "showCloseButton": show_close_button,
            "showBranding": show_branding
        }
    }
    db.session.commit()
    flash("Settings updated")
    return redirect(url_for('website_detail', website_id=website.id, tab='settings'))

# Widget Routes

@app.route('/website/<website_id>/widget/new', methods=['GET', 'POST'])
@login_required
def create_widget(website_id):
    website = Website.query.get_or_404(website_id)
    member = WebsiteMember.query.filter_by(user_id=current_user.id, website_id=website.id).first()
    if not member and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))

    # Check Limit
    current_count = Widget.query.filter_by(website_id=website.id).count()
    limit = website.max_widgets if website.max_widgets is not None else 3
    
    if current_count >= limit:
        flash(f"Limit reached ({limit}). Upgrade to create more!", "warning")
        return redirect(url_for('website_pricing', website_id=website.id))

    if request.method == 'POST':
        name = request.form.get('name')
        
        widget_type = request.form.get('type')
        
        content = {
            "title": request.form.get('title'),
            "description": request.form.get('description'),
            "button_text": request.form.get('button_text'),
            "button_url": request.form.get('button_url'),
            "open_behavior": request.form.get('open_behavior', 'AUTO'),
            "loop_count": int(request.form.get('loop_count', 0))
        }
        
        print(f"DEBUG CREATE: Received type '{widget_type}'")
        
        widget = Widget(
            name=name,
            website_id=website.id,
            created_by_id=current_user.id,
            content=content,
            status=WidgetStatus.ACTIVE,
            type=WidgetType(widget_type) if widget_type else WidgetType.NOTIFICATION,
            position=WidgetPosition.BOTTOM_RIGHT # Default, handled by website settings
        )
        
        db.session.add(widget)
        db.session.commit()
        return redirect(url_for('website_detail', website_id=website.id))
        
    return render_template('dashboard/create_widget.html', website=website)

@app.route('/widget/<widget_id>/edit', methods=['GET', 'POST'])
@login_required
def edit_widget(widget_id):
    widget = Widget.query.get_or_404(widget_id)
    if widget.created_by_id != current_user.id and current_user.global_role != GlobalRole.SUPERADMIN:
        # Note: Usually checking website membership is better, but this checks creator. 
        # For legacy, we keep creator check but allow superadmin bypass.
        # Ideally we should also check if current user is admin of the website, but let's stick to existing logic + bypass
        flash("Unauthorized")
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        widget.name = request.form.get('name')
        
        content = widget.content.copy() # Shallow copy
        content['title'] = request.form.get('title')
        content['description'] = request.form.get('description')
        content['button_text'] = request.form.get('button_text')
        content['button_url'] = request.form.get('button_url')
        
        # Custom Fields & Settings
        try:
            content['loop_count'] = int(request.form.get('loop_count', 0)) # 0 means infinite
        except (ValueError, TypeError):
            content['loop_count'] = 0
            
        content['open_behavior'] = request.form.get('open_behavior', content.get('open_behavior', 'AUTO'))
            
        widget.content = content
        
        # update fields
        # update fields
        widget_type = request.form.get('type')
        print(f"DEBUG EDIT: Received type '{widget_type}'")
        if widget_type:
            try:
                widget.type = WidgetType(widget_type)
            except ValueError:
                print(f"DEBUG EDIT: Invalid type '{widget_type}'")
                pass # Keep existing type if invalid

        db.session.commit()
        flash("Widget updated")
        return redirect(url_for('edit_widget', widget_id=widget.id, tab='settings'))

    return render_template('dashboard/edit_widget.html', widget=widget, WidgetType=WidgetType, WidgetPosition=WidgetPosition)

@app.route('/widget/<widget_id>/delete', methods=['POST'])
@login_required
def delete_widget(widget_id):
    widget = Widget.query.get_or_404(widget_id)
    website_id = widget.website_id
    if widget.created_by_id != current_user.id and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))
        
    db.session.delete(widget)
    db.session.commit()
    flash("Widget deleted")
    return redirect(url_for('website_detail', website_id=website_id))

@app.route('/widget/<widget_id>/toggle_status', methods=['POST'])
@login_required
def toggle_widget_status(widget_id):
    widget = Widget.query.get_or_404(widget_id)
    if widget.created_by_id != current_user.id and current_user.global_role != GlobalRole.SUPERADMIN:
        flash("Unauthorized")
        return redirect(url_for('dashboard'))
    
    if widget.status == WidgetStatus.ACTIVE:
        widget.status = WidgetStatus.PAUSED
    else:
        widget.status = WidgetStatus.ACTIVE
        
    db.session.commit()
    flash(f"Widget {widget.name} is now {widget.status.value}")
    return redirect(url_for('website_detail', website_id=widget.website_id, tab='toasts'))


# API & Widget Routes

@app.route('/api/website/<public_key>/config')
def get_website_config(public_key):
    website = Website.query.filter_by(public_key=public_key).first()
    if not website:
        return jsonify({"error": "Website not found"}), 404
    
    # Global Settings
    settings = {
        "timing": website.settings.get('timing', {"showTime": 5, "hideTime": 8}),
        "position": website.settings.get('position', 'BOTTOM_RIGHT'),
        "style": website.settings.get('style', {"backgroundColor": "#000000", "textColor": "#ffffff"}),
        "behavior": website.settings.get('behavior', {"showCloseButton": False, "showBranding": False})
    }

    # Active Widgets
    active_widgets = []
    for widget in website.widgets:
        if widget.status == WidgetStatus.ACTIVE:
            active_widgets.append({
                "id": widget.id,
                "type": widget.type.name,
                "content": widget.content,
                "views": widget.views,
                "clicks": widget.clicks
            })

    return jsonify({
        "settings": settings,
        "widgets": active_widgets
    })

# Analytics Tracking Endpoint
@app.route('/api/widget/<widget_id>/track', methods=['POST'])
def track_widget_event(widget_id):
    data = request.json
    event_type = data.get('type') # 'view' or 'click'
    
    widget = Widget.query.get(widget_id)
    if not widget:
        return jsonify({"error": "Widget not found"}), 404
        
    # 1. Update Total Stats
    if event_type == 'view':
        widget.views += 1
    elif event_type == 'click':
        widget.clicks += 1
    elif event_type == 'dismiss':
        widget.dismissals += 1
        
    # 2. Update Daily Stats (Analytics)
    today = datetime.utcnow().date()
    # Check if a record exists for today
    daily_stat = Analytics.query.filter_by(widget_id=widget.id, date=today).first()
    
    if not daily_stat:
        daily_stat = Analytics(widget_id=widget.id, date=today, views=0, clicks=0, dismissals=0)
        db.session.add(daily_stat)
    
    if event_type == 'view':
        daily_stat.views += 1
    elif event_type == 'click':
        daily_stat.clicks += 1
    elif event_type == 'dismiss':
        daily_stat.dismissals += 1
        
    db.session.commit()
    return jsonify({"success": True})
        
    db.session.commit()
    return jsonify({"success": True})

if __name__ == '__main__':
    app.run(debug=True)
