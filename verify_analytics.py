
import requests
from app import app, db, Widget, Analytics

def verify_tracking():
    # 1. Get a widget
    with app.app_context():
        widget = Widget.query.first()
        if not widget:
            print("No widgets found to test.")
            return
        
        initial_views = widget.views
        print(f"Widget {widget.id} Initial Views: {initial_views}")
        
    # 2. Setup API Call
    url = f"http://127.0.0.1:5000/api/widget/{widget.id}/track"
    payload = {"type": "view"}
    
    print(f"Sending POST to {url}...")
    try:
        response = requests.post(url, json=payload)
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Request failed: {e}")
        return

    # 3. Verify Update
    with app.app_context():
        # Re-fetch widget
        # Note: We need a fresh session or refresh
        db.session.expire_all()
        updated_widget = Widget.query.get(widget.id)
        
        print(f"Widget {widget.id} Updated Views: {updated_widget.views}")
        
        # Check Analytics Table
        daily = Analytics.query.filter_by(widget_id=widget.id).all()
        print(f"Daily Analytics Records: {len(daily)}")
        for d in daily:
            print(f" - Date: {d.date}, Views: {d.views}")
            
        if updated_widget.views > initial_views:
            print("SUCCESS: Views incremented.")
        else:
            print("FAILURE: Views did not increment.")

if __name__ == "__main__":
    verify_tracking()
