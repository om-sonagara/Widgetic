
from app import app, db, Website
import uuid

def test_upgrade_route(website_id):
    with app.app_context():
        # Ensure site exists or create dummy if testing generic
        website = Website.query.get(website_id)
        if not website:
            print(f"Website {website_id} not found, creating dummy...")
            website = Website(id=website_id, name="Test Site", domain="test.com")
            db.session.add(website)
            db.session.commit()
            print("Dummy website created.")
            
    client = app.test_client()
    # Mock login (we need a valid user, but let's assume session is tricky without full setup. 
    # Actually, we need to bypass login or valid session. 
    # Let's just check if the URL resolves to 404 or 302 (redirect to login) vs 500.
    
    url = f"/website/{website_id}/upgrade"
    print(f"Testing URL: {url}")
    
    # GET method not allowed, should be 405
    res = client.get(url)
    print(f"GET Status: {res.status_code} (Expected 405 or 302 if auth redirect)")
    
    # POST
    res = client.post(url, data={'price': '399'})
    print(f"POST Status: {res.status_code}")
    if res.status_code == 302:
        print(f"Redirected to: {res.headers['Location']}")

if __name__ == "__main__":
    # Use the ID from user report if possible, or random
    test_id = "922c681e-ed16-4951-9116-762bd8980c61"
    try:
        test_upgrade_route(test_id)
    except Exception as e:
        print(f"ERROR: {e}")
