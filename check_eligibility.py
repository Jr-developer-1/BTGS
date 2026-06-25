import os
import sys
import django

# Add backend folder to python path
workspace_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(workspace_dir, 'backend')
sys.path.append(backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel_masters.models import Cadre, EligibilityRule
from api_management.models import SystemConfig
from rest_framework.test import APIRequestFactory
from travel_masters.views import my_eligibility_view

user = User.objects.get(employee_id='HR-EMP-10868')
print("USER:", user.name, "Designation:", user.designation)

# Mock a request with this user
factory = APIRequestFactory()
request = factory.get('/api/masters/my-eligibility/')
request.custom_user = user

response = my_eligibility_view(request)
print("RESPONSE STATUS:", response.status_code)
import json
print("RESPONSE DATA:")
print(json.dumps(response.data, indent=2))
