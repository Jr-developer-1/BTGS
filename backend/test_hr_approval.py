import os
import django
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel.models import TravelClaim, HRPositionConfig, HRIntimation
from travel.views import handle_workflow_action

# Find the user KS Rahul
user = User.objects.filter(employee_id='HR-EMP-06903').first()
if not user:
    print("User KS Rahul not found")
    exit(1)

# Find or create a claim to test with
claim = TravelClaim.objects.filter(id=1).first()
if not claim:
    print("Claim ID=1 not found")
    exit(1)

# Ensure the claim status is PENDING_HR and reset approved amounts for testing
claim.status = 'PENDING_HR'
claim.hr_approved_amount = None
claim.executive_approved_amount = 0.00
claim.approver_position = 'HR@-AP-104-MMUS'
claim.current_approver = user
claim.save()

# Ensure there is a pending HR intimation for this claim
HRIntimation.objects.filter(claim=claim).update(is_read=False, hr_position='HR@-AP-104-MMUS')

print(f"BEFORE: hr_approved_amount={claim.hr_approved_amount}, executive_approved_amount={claim.executive_approved_amount}")

# Run handle_workflow_action
data = {
    'id': f'CLAIM-{claim.id}',
    'action': 'Approve',
    'executive_approved_amount': '120.00'
}

try:
    res = handle_workflow_action(claim, 'Approve', user, data)
    print(f"Workflow Action Result: {res}")
    
    # Reload from DB
    claim.refresh_from_db()
    print(f"AFTER: hr_approved_amount={claim.hr_approved_amount}, executive_approved_amount={claim.executive_approved_amount}, status={claim.status}, approver_position={claim.approver_position}")
except Exception as e:
    import traceback
    traceback.print_exc()
