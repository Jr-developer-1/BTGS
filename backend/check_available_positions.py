import os
import django
import sys
import json

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User

emp_id = "HR-EMP-06889"
user = User.objects.filter(employee_id=emp_id).first()

if user:
    available = user.get_available_positions()
    print("AVAILABLE POSITIONS CONTENT:")
    print(json.dumps(available, indent=2))
else:
    print(f"User {emp_id} not found.")
