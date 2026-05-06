import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import (
    Trip, Expense, TravelClaim, TravelAdvance, TripOdometer, 
    Dispute, BulkActivityBatch, JobReport, TripTracking, 
    HistoricalTripStop, TripGeofenceLocationSet
)
from notifications.models import Notification

def wipe_data():
    print("Starting database wipe (Transactional Data only)...")
    
    try:
        # Order matters to avoid foreign key issues, although CASCADE usually handles it
        # We delete from child to parent just in case
        
        print("Cleaning up Odometer readings...")
        TripOdometer.objects.all().delete()
        
        print("Cleaning up Expenses...")
        Expense.objects.all().delete()
        
        print("Cleaning up Claims...")
        TravelClaim.objects.all().delete()
        
        print("Cleaning up Advances...")
        TravelAdvance.objects.all().delete()
        
        print("Cleaning up Disputes...")
        Dispute.objects.all().delete()
        
        print("Cleaning up Tracking data...")
        TripTracking.objects.all().delete()
        TripGeofenceLocationSet.objects.all().delete()
        HistoricalTripStop.objects.all().delete()
        
        print("Cleaning up Job Reports...")
        JobReport.objects.all().delete()
        
        print("Cleaning up Bulk Activity Batches...")
        BulkActivityBatch.objects.all().delete()
        
        print("Cleaning up Notifications...")
        Notification.objects.all().delete()
        
        print("Cleaning up Trips (Root objects)...")
        Trip.objects.all().delete()
        
        print("\nSUCCESS: All transactional travel data has been wiped.")
        print("Users, Roles, Masters, and Finance Configurations remain intact.")
        
    except Exception as e:
        print(f"\nERROR during wipe: {e}")

if __name__ == "__main__":
    confirm = input("Are you sure you want to wipe all travel records? (y/n): ")
    if confirm.lower() == 'y':
        wipe_data()
    else:
        print("Wipe cancelled.")
