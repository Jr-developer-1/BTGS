import os
import django
import sys
import json

sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from api_management.services import fetch_employee_data

res = fetch_employee_data(employee_id_filter='HR-EMP-14656')
print(json.dumps(res, indent=2))
