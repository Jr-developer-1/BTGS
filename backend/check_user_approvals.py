import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel.models import TravelClaim, Trip, TravelAdvance
from django.db.models import Q

emp_id = "HR-EMP-06889"
user = User.objects.filter(employee_id=emp_id).first()

if user:
    print(f"USER: {user.name} ({user.employee_id})")
    print(f"Active Position: {user.active_position_id}")
    
    q = Q(current_approver=user) | Q(approver_position=user.active_position_id)
    claims = TravelClaim.objects.filter(q, status__in=['Pending', 'Submitted', 'Forwarded', 'Resubmitted'])
    print(f"Pending Claims: {claims.count()}")
    for c in claims:
        print(f"- Claim {c.id}: Status={c.status}, Position={c.approver_position}")
else:
    print(f"User {emp_id} not found.")
