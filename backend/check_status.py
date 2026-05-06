import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import Trip, TravelClaim, BulkActivityBatch

print("RECENT TRIPS:")
for t in Trip.objects.order_by('-created_at')[:5]:
    print(f"ID: {t.trip_id}, Status: {t.status}, Current Approver: {t.current_approver}, Local: {t.consider_as_local}")

print("\nRECENT CLAIMS:")
for c in TravelClaim.objects.order_by('-created_at')[:5]:
    print(f"ID: {c.id}, Trip: {c.trip.trip_id}, Status: {c.status}, Current Approver: {c.current_approver}")

print("\nRECENT BATCHES:")
for b in BulkActivityBatch.objects.order_by('-created_at')[:5]:
    print(f"ID: {b.id}, Trip: {b.trip_id if b.trip else 'N/A'}, Status: {b.status}, Current Approver: {b.current_approver}")
