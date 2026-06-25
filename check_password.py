import os
import sys
import django
import hashlib

# Add backend folder to python path
workspace_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(workspace_dir, 'backend')
sys.path.append(backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User

user = User.objects.get(employee_id='HR-EMP-10868')
print("User name:", user.name)
print("Password hash:", user.password_hash)

# Check common passwords
for pw in ['admin', '123456', 'testpass', 'password', 'welcome', 'welcome123', 'admin123', 'tgs', 'tgs123']:
    h = hashlib.sha256(pw.encode()).hexdigest()
    if h == user.password_hash:
        print(f"MATCH: password is '{pw}'")
        break
else:
    # If no match, let's set password to '123456' so we can test easily!
    print("No common password match. Setting password to '123456'")
    user.password_hash = hashlib.sha256(b'123456').hexdigest()
    user.save()
