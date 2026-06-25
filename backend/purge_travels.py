import os
import django
import sys

# Add project root to path and configure settings
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "tgs_backend.settings")
django.setup()

from django.db import transaction
from django.db.models import Q
from travel.models import (
    Trip, TripOdometer, TripTracking, TripGeofenceLocationSet,
    Expense, TravelClaim, TravelAdvance, Dispute,
    BulkActivityBatch, JobReport, HistoricalTripStop, HRIntimation,
    FinanceIntimation
)
from core.models import AuditLog
from notifications.models import Notification, Reminder

print("Initializing Safe Database Purge...")
print("===================================")

try:
    with transaction.atomic():
        # 1. Wipe Dependent Logs and Intimations
        count_hr_inti = HRIntimation.objects.all().delete()[0]
        print(f"- Wiped {count_hr_inti} HR Intimations")

        count_fin_inti = FinanceIntimation.objects.all().delete()[0]
        print(f"- Wiped {count_fin_inti} Finance Intimations")

        count_reminder = Reminder.objects.all().delete()[0]
        print(f"- Wiped {count_reminder} Reminders")

        # Selective Notification wipe (only travel/trip/claim/advance related)
        notif_q = Q(title__icontains='trip') | Q(title__icontains='claim') | Q(title__icontains='advance') | Q(title__icontains='travel') | \
                  Q(message__icontains='trip') | Q(message__icontains='claim') | Q(message__icontains='advance') | Q(message__icontains='travel') | \
                  Q(link__icontains='trip') | Q(link__icontains='claim') | Q(link__icontains='advance') | Q(link__icontains='travel')
        count_notif = Notification.objects.filter(notif_q).delete()[0]
        print(f"- Wiped {count_notif} Travel-related Notifications")

        # Selective AuditLog wipe (only travel/trip/claim/advance related models)
        travel_models = [
            'Trip', 'Expense', 'TravelClaim', 'TravelAdvance', 'TripOdometer', 
            'Dispute', 'BulkActivityBatch', 'JobReport', 'TripTracking', 
            'HistoricalTripStop', 'TripGeofenceLocationSet', 'FinanceIntimation', 'HRIntimation'
        ]
        count_audit = AuditLog.objects.filter(model_name__in=travel_models).delete()[0]
        print(f"- Wiped {count_audit} Travel-related System Audit Logs")

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
