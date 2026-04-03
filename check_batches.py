import os
import django
import sys
import json

# Add the current directory and backend directory to sys.path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import BulkActivityBatch, Trip

# Try to find a trip with batches
trip = Trip.objects.filter(activity_batches__isnull=False).first()
if trip:
    print(f"Trip ID: {trip.trip_id}")
    batches = trip.activity_batches.all()
    print(f"Total batches: {batches.count()}")
    for b in batches:
        print(f"Batch ID: {b.id} | Status: {b.status}")
        data = b.data_json
        print(f"Rows count: {len(data) if isinstance(data, list) else 'N/A'}")
        if isinstance(data, list) and len(data) > 0:
            print(f"First row keys: {list(data[0].keys())}")
            # check for rejection markers
            for i, row in enumerate(data):
                if '_status' in row or 'status' in row or '_remarks' in row:
                    print(f"Row {i} markers: status={row.get('_status')}, remarks={row.get('_remarks') or row.get('remarks')}")
else:
    print("No trip with batches found")
