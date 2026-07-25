import os
import sys
import django

sys.path.append(os.path.abspath('backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from django.test import RequestFactory
from django.contrib.auth import get_user_model
from api_management.views import SyncEmployeeCacheView

User = get_user_model()
admin_user = User.objects.filter(role__name='ADMIN').first()
if not admin_user:
    admin_user = User.objects.create_user(
        employee_id='TESTADMIN',
        username='TESTADMIN',
        email='testadmin@example.com',
        password='password123',
        role_id=1 # Admin
    )

factory = RequestFactory()
request = factory.post('/api/employees/sync-cache/')
request.user = admin_user
request.custom_user = admin_user

try:
    view = SyncEmployeeCacheView.as_view()
    response = view(request)
    print("Response status code:", response.status_code)
    print("Response data:", getattr(response, 'data', None))
except Exception as e:
    import traceback
    print("Error during execution:")
    traceback.print_exc()
