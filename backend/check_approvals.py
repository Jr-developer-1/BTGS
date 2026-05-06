import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import TravelClaim, Trip, TravelAdvance
from core.models import User

print("CHECKING PENDING APPROVALS:")
pending_claims = TravelClaim.objects.filter(status__in=['Pending', 'Submitted', 'Forwarded', 'Resubmitted'])
print(f"Total Pending Claims: {pending_claims.count()}")
for c in pending_claims:
    print(f"Claim {c.id}: Approver={c.current_approver}, Position={c.approver_position}")

pending_trips = Trip.objects.filter(status__in=['Pending', 'Submitted', 'Forwarded', 'Resubmitted'])
print(f"Total Pending Trips: {pending_trips.count()}")
for t in pending_trips:
    print(f"Trip {t.id}: Approver={t.current_approver}, Position={t.approver_position}")
