import os
import sys
import django

sys.path.append(r"d:\TGS_LIVE\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import TravelClaim, Expense

claims = TravelClaim.objects.filter(trip__destination__icontains='Guntur')
if not claims.exists():
    claims = TravelClaim.objects.all()[:5]

for claim in claims:
    print(f"--- Claim ID: {claim.id} (Status: {claim.status}) ---")
    print(f"Requester: {claim.trip.user_name if claim.trip else 'N/A'}")
    print(f"Total Amount (Claimed): {claim.total_amount}")
    print(f"Approved Amount: {claim.approved_amount}")
    print(f"HR Approved Amount: {claim.hr_approved_amount}")
    print(f"Executive Approved Amount: {claim.executive_approved_amount}")
    print("Expenses:")
    for e in claim.trip.expenses.filter(is_deleted=False):
        print(f"  ID: {e.id} | Category: {e.category} | Claimed: {e.amount} | HR Selected: {e.hr_selected_amount} | Fin Selected: {e.finance_selected_amount}")
