import os
import django
import sys
import unittest
from django.test import RequestFactory
from django.utils import timezone

sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import Trip, BulkActivityBatch
from core.models import User, Role
from core.views import LoginHistoryViewSet

class TestStatsEndpoint(unittest.TestCase):
    def setUp(self):
        # Find or create a test user
        self.user = User.objects.first()
        if not self.user:
            self.user = User.objects.create(
                employee_id='HR-EMP-00006',
                first_name='Test',
                last_name='User',
                email='test@tgs.com'
            )
        
        # Ensure role is set up for custom_user
        role, _ = Role.objects.get_or_create(name='Admin')
        self.user.role = role
        self.user.save()

        # Clean up any existing test trips/batches
        Trip.all_objects.filter(trip_id__startswith='TEST-TRIP-').delete()
        BulkActivityBatch.all_objects.filter(file_name__startswith='test-batch-').delete()

    def test_stats_bulk_upload_filtering(self):
        # 1. Create a normal trip (should be included in stats)
        normal_trip = Trip.objects.create(
            trip_id='TEST-TRIP-NORMAL',
            user=self.user,
            source='Origin A',
            destination='Dest A',
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            consider_as_local=False,
            status='Approved'
        )

        # 2. Create a bulk upload trip (with active batch - should be excluded)
        bulk_trip = Trip.objects.create(
            trip_id='TEST-TRIP-BULK-ACTIVE',
            user=self.user,
            source='Origin B',
            destination='Dest B',
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            consider_as_local=True,
            status='Approved'
        )
        active_batch = BulkActivityBatch.objects.create(
            user=self.user,
            trip=bulk_trip,
            trip_id=bulk_trip.trip_id,
            file_name='test-batch-active.xlsx',
            status='Approved',
            data_json=[]
        )

        # 3. Create a bulk upload trip (with rejected batch - should be excluded)
        rejected_bulk_trip = Trip.objects.create(
            trip_id='TEST-TRIP-BULK-REJECTED',
            user=self.user,
            source='Origin C',
            destination='Dest C',
            start_date=timezone.now().date(),
            end_date=timezone.now().date(),
            consider_as_local=True,
            status='Rejected'
        )
        rejected_batch = BulkActivityBatch.objects.create(
            user=self.user,
            trip=rejected_bulk_trip,
            trip_id=rejected_bulk_trip.trip_id,
            file_name='test-batch-rejected.xlsx',
            status='Rejected',
            data_json=[]
        )

        # Get stats via ViewSet
        viewset = LoginHistoryViewSet()
        request = RequestFactory().get('/api/login-history/stats/')
        request.query_params = request.GET
        request.custom_user = self.user
        
        response = viewset.stats(request)
        self.assertEqual(response.status_code, 200)
        
        data = response.data
        trips = data.get('trips', [])
        batches = data.get('batches', [])
        
        # Verify normal trip is IN the list
        trip_ids = [t['trip_id'] for t in trips]
        self.assertIn('TEST-TRIP-NORMAL', trip_ids)
        
        # Verify bulk trips are NOT in the list
        self.assertNotIn('TEST-TRIP-BULK-ACTIVE', trip_ids)
        self.assertNotIn('TEST-TRIP-BULK-REJECTED', trip_ids)
        
        # Verify both batches are IN the batches list
        batch_trip_ids = [b['trip_id'] for b in batches]
        self.assertIn('TEST-TRIP-BULK-ACTIVE', batch_trip_ids)
        self.assertIn('TEST-TRIP-BULK-REJECTED', batch_trip_ids)
        
        print("Test passed successfully!")

if __name__ == '__main__':
    unittest.main()
