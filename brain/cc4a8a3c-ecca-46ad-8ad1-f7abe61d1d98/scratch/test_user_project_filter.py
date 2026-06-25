import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.views import LoginHistoryViewSet
from rest_framework.test import APIRequestFactory
from core.models import User

factory = APIRequestFactory()

user = User.objects.get(employee_id='HR-EMP-06889')
request = factory.get('/api/login-history/', {'project_code': 'AP-104-MMUS'})
request.custom_user = user

view = LoginHistoryViewSet()
view.action_map = {'get': 'list'}
view.action = 'list'
view.request = view.initialize_request(request)

qs = view.get_queryset()
print(f"Queryset count for user {user.employee_id}: {qs.count()}")
print(f"Query SQL: {qs.query}")
