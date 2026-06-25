import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.views import LoginHistoryViewSet
from rest_framework.test import APIRequestFactory
from core.models import User

factory = APIRequestFactory()

user = User.objects.get(employee_id='HR-EMP-06889')
request = factory.get('/api/login-history/stats/', {'project_code': 'AP-104-MMUS'})
request.custom_user = user

view = LoginHistoryViewSet()
view.action_map = {'get': 'stats'}
view.action = 'stats'
drf_request = view.initialize_request(request)
view.request = drf_request

response = view.stats(drf_request)
print(f"Status Code: {response.status_code}")
print(f"Response Data keys: {response.data.keys()}")
print(f"users_count: {response.data.get('users_count')}")
print(f"trips_count: {response.data.get('trips_count')}")
print(f"batches_count: {response.data.get('batches_count')}")
print(f"First 3 unique active users: {response.data.get('users')[:3]}")
