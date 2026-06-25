import os
import django
import sys
import unittest
from django.test import RequestFactory
from django.core.cache import cache

sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User, Role, LoginHistory
from core.views import LoginHistoryViewSet
from travel.models import Trip, BulkActivityBatch

class TestProjectFiltering(unittest.TestCase):
    def setUp(self):
        # Clear cache first
        cache.clear()
        
        # Find or create test users
        self.role, _ = Role.objects.get_or_create(name='Admin')
        
        # User 1: associated with Project A
        self.user_a, _ = User.objects.get_or_create(
            employee_id='EMP-PROJ-A',
            defaults={
                'first_name': 'Project',
                'last_name': 'A',
                'email': 'proj_a@tgs.com',
                'role': self.role
            }
        )
        self.user_a.role = self.role
        self.user_a.save()
        
        # User 2: associated with Project B
        self.user_b, _ = User.objects.get_or_create(
            employee_id='EMP-PROJ-B',
            defaults={
                'first_name': 'Project',
                'last_name': 'B',
                'email': 'proj_b@tgs.com',
                'role': self.role
            }
        )
        self.user_b.role = self.role
        self.user_b.save()

        # Create LoginHistory for both
        LoginHistory.objects.filter(user__in=[self.user_a, self.user_b]).delete()
        self.lh_a = LoginHistory.objects.create(user=self.user_a, ip_address='127.0.0.1')
        self.lh_b = LoginHistory.objects.create(user=self.user_b, ip_address='127.0.0.2')

        # Mock GLOBAL_EMPLOYEE_DATA in the cache
        self.mock_employee_data = [
            {
                'employee': {
                    'employee_code': 'EMP-PROJ-A',
                    'first_name': 'Project',
                    'last_name': 'A',
                },
                'project': {
                    'code': 'PROJ-A',
                    'name': 'Project Alpha'
                }
            },
            {
                'employee': {
                    'employee_code': 'EMP-PROJ-B',
                    'first_name': 'Project',
                    'last_name': 'B',
                },
                'project': {
                    'code': 'PROJ-B',
                    'name': 'Project Beta'
                }
            }
        ]
        cache.set('GLOBAL_EMPLOYEE_DATA', self.mock_employee_data, 300)

    def tearDown(self):
        LoginHistory.objects.filter(user__in=[self.user_a, self.user_b]).delete()
        cache.clear()

    def test_get_queryset_filtering_by_project_a(self):
        viewset = LoginHistoryViewSet()
        
        # Mock request with query param project_code='PROJ-A'
        request = RequestFactory().get('/api/login-history/?project_code=PROJ-A')
        request.query_params = request.GET
        request.custom_user = self.user_a
        viewset.request = request
        
        queryset = viewset.get_queryset()
        
        # Should only contain lh_a, not lh_b
        self.assertIn(self.lh_a, queryset)
        self.assertNotIn(self.lh_b, queryset)

    def test_get_queryset_filtering_by_project_b(self):
        viewset = LoginHistoryViewSet()
        
        # Mock request with query param project_code='PROJ-B'
        request = RequestFactory().get('/api/login-history/?project_code=PROJ-B')
        request.query_params = request.GET
        request.custom_user = self.user_a
        viewset.request = request
        
        queryset = viewset.get_queryset()
        
        # Should only contain lh_b, not lh_a
        self.assertIn(self.lh_b, queryset)
        self.assertNotIn(self.lh_a, queryset)

    def test_stats_filtering_by_project(self):
        viewset = LoginHistoryViewSet()
        
        # Mock request with query param project_code='PROJ-A'
        request = RequestFactory().get('/api/login-history/stats/?project_code=PROJ-A')
        request.query_params = request.GET
        request.custom_user = self.user_a
        
        response = viewset.stats(request)
        self.assertEqual(response.status_code, 200)
        
        # Unique active users in response data should only include user_a details
        users = response.data.get('users', [])
        user_ids = [u['user_id'] for u in users]
        self.assertIn(self.user_a.id, user_ids)
        self.assertNotIn(self.user_b.id, user_ids)

if __name__ == '__main__':
    unittest.main()
