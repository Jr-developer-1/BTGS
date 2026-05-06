import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel.models import Trip, TravelClaim

print("CHECKING USER POSITIONS:")
# Replace with the actual employee ID if known, or just check a few
for user in User.objects.all()[:10]:
    print(f"User: {user.employee_id} ({user.name})")
    print(f"  Active Position: {user.active_position_id}")
    print(f"  RM Position: {user.reporting_manager_position}")
    print(f"  RM User: {user.reporting_manager}")

print("\nCHECKING RECENT CLAIMS:")
for c in TravelClaim.objects.order_by('-created_at')[:5]:
    print(f"Claim ID: {c.id}, Status: {c.status}")
    print(f"  Current Approver: {c.current_approver}")
    print(f"  Approver Position: {c.approver_position}")
