import os, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
import django; django.setup()

from core.models import User
from travel.views import ApprovalsView
from rest_framework.test import APIRequestFactory

user = User.objects.get(employee_id='HR-EMP-04157')
factory = APIRequestFactory()
request = factory.get('/api/approvals/?tab=pending&source=hub')
request.custom_user = user

view = ApprovalsView.as_view()
response = view(request)

for item in response.data:
    cost = item.get('cost', 'N/A').replace('\u20b9', 'Rs.') if item.get('cost') else 'N/A'
    exec_a = item['details'].get('executive_approved_amount', 'N/A')
    hr_a = item['details'].get('hr_approved_amount', 'N/A')
    total = item['details'].get('total_amount', 'N/A')
    print(f"{item['id']} | cost={cost} | exec={exec_a} | hr={hr_a} | total={total}")
