
from app import app, db, User, GlobalRole
from werkzeug.security import generate_password_hash

def reset_db():
    print("WARNING: This will delete ALL data.")
    with app.app_context():
        # Drop all tables
        db.drop_all()
        print("Dropped all tables.")
        
        # Recreate tables
        db.create_all()
        print("Recreated all tables.")
        
        # Create Default Superadmin
        admin_email = "admin@123"
        admin_pass = "Admin@123"
        admin = User(
            email=admin_email,
            name="System Admin",
            password_hash=generate_password_hash(admin_pass),
            global_role=GlobalRole.SUPERADMIN
        )
        db.session.add(admin)
        db.session.commit()
        
        print(f"Verified Reset. Default Superadmin created:")
        print(f"Email: {admin_email}")
        print(f"Password: {admin_pass}")

if __name__ == "__main__":
    reset_db()
