import os
import django
import sys
import json

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from django.test import RequestFactory
from core.views import me_view

emp_id = "HR-EMP-06889"
user = User.objects.filter(employee_id=emp_id).first()

if user:
    factory = RequestFactory()
    request = factory.get('/api/auth/me/')
    request.custom_user = user
    
    response = me_view(request)
    print("ME RESPONSE DATA:")
    print(json.dumps(response.data, indent=2))
else:
    print(f"User {emp_id} not found.")
