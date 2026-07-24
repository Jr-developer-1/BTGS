import os
import django
import sys

sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User

user = User.objects.get(employee_id='HR-EMP-10866')
print("Active position ID from backend:", user.active_position_id)
print("Available positions from get_available_positions():")
print(user.get_available_positions())
print("-" * 40)
print("API Data positions details:")
data = user._get_api_data()
if data:
    print("Employee Status:", data.get('employee', {}).get('status'))
    print("Main Position:", data.get('position'))
    print("Positions details list:")
    for p in data.get('positions_details', []):
        print(f"  - ID: {p.get('id')}, Name: {p.get('name')}, Role: {p.get('role_name')}")
else:
    print("No API Data.")
