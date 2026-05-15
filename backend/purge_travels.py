import os
import django
import sys

# Add project root to path and configure settings
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tgs_backend.settings")
django.setup()

from django.db import transaction
from travel.models import (
    Trip, TripOdometer, TripTracking, TripGeofenceLocationSet,
    Expense, TravelClaim, TravelAdvance, Dispute,
    BulkActivityBatch, JobReport, HistoricalTripStop, HRIntimation
)
from core.models import AuditLog
from notifications.models import Notification

print("Initializing Safe Database Purge...")
print("===================================")

try:
    with transaction.atomic():
        # 1. Wipe Dependent Logs and Intimations
        count_intimation = HRIntimation.objects.all().delete()[0]
        print(f"- Wiped {count_intimation} HR Intimations")

        count_notif = Notification.objects.all().delete()[0]
        print(f"- Wiped {count_notif} Internal Notifications")

        count_audit = AuditLog.objects.all().delete()[0]
        print(f"- Wiped {count_audit} System Audit Logs")

        # 2. Wipe Transactional Records and Expenses
        count_dispute = Dispute.objects.all().delete()[0]
        print(f"- Wiped {count_dispute} Disputes")

        count_expense = Expense.objects.all().delete()[0]
        print(f"- Wiped {count_expense} Individual Expenses")

        count_batch = BulkActivityBatch.objects.all().delete()[0]
        print(f"- Wiped {count_batch} Bulk Activity Batches")

        count_job = JobReport.objects.all().delete()[0]
        print(f"- Wiped {count_job} Job Reports")

        count_claim = TravelClaim.objects.all().delete()[0]
        print(f"- Wiped {count_claim} Travel Claims")

        count_advance = TravelAdvance.objects.all().delete()[0]
        print(f"- Wiped {count_advance} Travel Advances")

        # 3. Wipe Trip Geodata and Tracking
        count_odo = TripOdometer.objects.all().delete()[0]
        print(f"- Wiped {count_odo} Odometer Snapshots")

        count_track = TripTracking.objects.all().delete()[0]
        print(f"- Wiped {count_track} Real-time GPS Tracking logs")

        count_geo = TripGeofenceLocationSet.objects.all().delete()[0]
        print(f"- Wiped {count_geo} Geofence Location Sets")

        count_hist = HistoricalTripStop.objects.all().delete()[0]
        print(f"- Wiped {count_hist} Historical Trip Stops")

        # 4. Wipe Trips Containers
        count_trip = Trip.objects.all().delete()[0]
        print(f"- Wiped {count_trip} Trips containers")

    print("===================================")
    print("SUCCESS: All trip, travel, and approval workflow transactions have been wiped.")
    print("CRITICAL SAFEGUARD: No Users, Managers, HR Positions, or System configurations were modified.")

except Exception as e:
    print(f"CRITICAL ERROR DURING PURGE: {str(e)}")
    sys.exit(1)
