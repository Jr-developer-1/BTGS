import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from django.core.cache import cache
from core.models import User, LoginHistory

data = cache.get('GLOBAL_EMPLOYEE_DATA')
print(f"Total cached employees: {len(data) if data else 0}")
if data:
    emp_codes = []
    for item in data:
        if isinstance(item, dict):
            emp = item.get('employee', {})
            proj = item.get('project', {})
            emp_proj_code = proj.get('code') if proj else None
            if emp_proj_code and emp_proj_code.lower() == 'ap-104-mmus':
                code = emp.get('employee_code')
                if code:
                    emp_codes.append(code)
                    
    print(f"Total emp_codes for AP-104-MMUS in cache: {len(emp_codes)}")
    
    # Check users in DB with these employee_ids
    matching_users = User.objects.filter(employee_id__in=emp_codes)
    print(f"Matching users in DB: {matching_users.count()}")
    for u in matching_users:
        logins_count = LoginHistory.objects.filter(user=u).count()
        print(f"  User: {u.employee_id} | Name: {u.name} | Logins count: {logins_count}")
