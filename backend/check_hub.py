import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import TravelClaim, Trip, TravelAdvance
from django.db.models import Q

print("CHECKING FINANCE HUB RECORDS:")
hub_statuses = ['PENDING_FINAL_RELEASE', 'Approved', 'PARTIALLY_COMPLETED']
trips = Trip.objects.filter(status__in=hub_statuses)
claims = TravelClaim.objects.filter(status__in=hub_statuses)

print(f"Trips in Hub Status: {trips.count()}")
for t in trips:
    print(f"Trip {t.trip_id}: Status={t.status}, Expenses={t.expenses.count()}, Claim={hasattr(t, 'claim')}")

print(f"Claims in Hub Status: {claims.count()}")
for c in claims:
    print(f"Claim {c.id}: Status={c.status}, Trip={c.trip.trip_id if c.trip else 'N/A'}")
