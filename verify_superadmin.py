
from app import app, db, User, Website, WebsiteMember, Widget, WidgetType, GlobalRole
import uuid

def verify_superadmin():
    with app.app_context():
        # 1. Setup Data
        # - Create Regular User U1 and their Site S1
        u1_email = f"user_{uuid.uuid4().hex[:6]}@example.com"
        u1 = User(email=u1_email, name="Regular User", global_role=GlobalRole.USER)
        db.session.add(u1)
        db.session.commit()
        
        s1 = Website(name="User Site", domain="user.com")
        db.session.add(s1)
        db.session.commit()
        
        m1 = WebsiteMember(user_id=u1.id, website_id=s1.id, role="ADMIN")
        db.session.add(m1)
        db.session.commit()
        
        # - Create Superadmin SU
        su_email = f"admin_{uuid.uuid4().hex[:6]}@example.com"
        su = User(email=su_email, name="Super Admin", global_role=GlobalRole.SUPERADMIN)
        db.session.add(su)
        db.session.commit()
        
        s1_id = s1.id
        u1_id = u1.id
        su_id = su.id
        
        print(f"Setup: User={u1_id}, Site={s1_id}, Superadmin={su_id}")

    client = app.test_client()
    
    # 2. Test Superadmin Dashboard Access (should see S1)
    with client.session_transaction() as sess:
        sess['_user_id'] = su_id
        
    print("Testing Dashboard Access as Superadmin...")
    res = client.get('/dashboard')
    if res.status_code == 200 and b"User Site" in res.data:
        print("SUCCESS: Superadmin sees User Site on dashboard.")
    else:
        print(f"FAILURE: Dashboard access failed or site missing. Status: {res.status_code}")
        
    # 3. Test Accessing Site Detail (should bypass membership check)
    print("Testing Site Detail Access...")
    res = client.get(f'/website/{s1_id}')
    if res.status_code == 200:
        print("SUCCESS: Superadmin accessed site detail.")
    elif res.status_code == 302:
        print("FAILURE: Redirected (likely unauthorized).")
    else:
        print(f"FAILURE: Status {res.status_code}")

    # 4. Test Creating Widget on S1 (should work)
    print("Testing Create Widget on User Site...")
    res = client.post(f'/website/{s1_id}/widget/new', data={
        'name': 'AdminWidget',
        'type': 'NOTIFICATION', 
        'title': 'Admin Created'
    }, follow_redirects=True)
    
    if b"AdminWidget" in res.data:
         print("SUCCESS: Superadmin created widget on User Site.")
    else:
         print("FAILURE: Could not create widget.")

if __name__ == "__main__":
    try:
        verify_superadmin()
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
