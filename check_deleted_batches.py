import os
import django
import sys

sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import Trip, BulkActivityBatch

print("Checking Trips and Batches:")
all_trips = Trip.objects.all()
print(f"Total Trips: {all_trips.count()}")

trips_with_batches = Trip.objects.filter(activity_batches__isnull=False).distinct()
print(f"Trips with batches (isnull=False): {trips_with_batches.count()}")

trips_with_no_batches = Trip.objects.filter(activity_batches__isnull=True).distinct()
print(f"Trips with no batches (isnull=True): {trips_with_no_batches.count()}")

print("\nDetail of trips with no batches but consider_as_local=True:")
local_trips_no_batches = trips_with_no_batches.filter(consider_as_local=True)
for t in local_trips_no_batches:
    # Check all_objects to see if there are any soft-deleted batches
    all_batches_count = BulkActivityBatch.all_objects.filter(trip=t).count()
    active_batches_count = BulkActivityBatch.objects.filter(trip=t).count()
    print(f"Trip ID: {t.trip_id} | Status: {t.status} | Active Batches: {active_batches_count} | All Batches (incl. deleted): {all_batches_count}")
