import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.views import LoginHistoryViewSet
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()

# Test 1: No project filter (All Projects)
request_all = factory.get('/api/login-history/')
from core.models import User
admin_user = User.objects.filter(role__name__iexact='admin').first() or User.objects.first()
request_all.custom_user = admin_user

view_all = LoginHistoryViewSet()
view_all.action_map = {'get': 'list'}
view_all.action = 'list'
view_all.request = view_all.initialize_request(request_all)

qs_all = view_all.get_queryset()
print("Test 1 (All Projects):")
print(f"  Queryset count: {qs_all.count()}")

# Test 2: Project AP-104-MMUS
request_proj = factory.get('/api/login-history/', {'project_code': 'AP-104-MMUS'})
request_proj.custom_user = admin_user
view_proj = LoginHistoryViewSet()
view_proj.action_map = {'get': 'list'}
view_proj.action = 'list'
view_proj.request = view_proj.initialize_request(request_proj)

qs_proj = view_proj.get_queryset()
print("\nTest 2 (Project AP-104-MMUS):")
print(f"  Queryset count: {qs_proj.count()}")
print(f"  Query SQL: {qs_proj.query}")

# Let's inspect the cached employee data
from api_management.services import safe_cache_get, GLOBAL_EMPLOYEE_CACHE
import time
persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
print("\nCache Status:")
print(f"  File cache 'GLOBAL_EMPLOYEE_DATA' type: {type(persistent_data)}")
print(f"  File cache truthy?: {bool(persistent_data)}")
if isinstance(persistent_data, list):
    print(f"  File cache length: {len(persistent_data)}")
print(f"  Memory cache data length: {len(GLOBAL_EMPLOYEE_CACHE.get('data', []))}")
