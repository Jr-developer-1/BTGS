import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User

emp_id = "HR-EMP-06889"
user = User.objects.filter(employee_id=emp_id).first()

if user:
    print(f"USER: {user.name} ({user.employee_id})")
    print(f"Active Position: {user.active_position_id}")
    positions = user.get_available_positions()
    print(f"Available Positions ({len(positions)}):")
    for p in positions:
        print(f"- ID: {p.get('id')}, Name: {p.get('name')}, Dept: {p.get('department_name')}")
else:
    print(f"User {emp_id} not found.")
