import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from django.core.cache import cache
from core.models import User

data = cache.get('GLOBAL_EMPLOYEE_DATA')
print(f"Total cached employees: {len(data) if data else 0}")
if data:
    # Print the first 5 elements
    for idx, item in enumerate(data[:5]):
        print(f"\nItem {idx+1}:")
        print(f"  Type: {type(item)}")
        if isinstance(item, dict):
            emp = item.get('employee', {})
            proj = item.get('project', {})
            print(f"  Employee Name: {emp.get('name')}")
            print(f"  Employee Code: {repr(emp.get('employee_code'))}")
            print(f"  Project Name: {proj.get('name')}")
            print(f"  Project Code: {repr(proj.get('code'))}")
            
            # Check if there is a matching user in DB
            db_user = User.objects.filter(employee_id=emp.get('employee_code')).first()
            print(f"  Matches user in DB?: {db_user is not None}")

    # Let's count how many cached employees match users in our DB
    matched_count = 0
    unique_projects = set()
    for item in data:
        if isinstance(item, dict):
            emp = item.get('employee', {})
            proj = item.get('project', {})
            p_code = proj.get('code')
            if p_code:
                unique_projects.add(p_code)
            
            emp_code = emp.get('employee_code')
            if emp_code and User.objects.filter(employee_id=emp_code).exists():
                matched_count += 1
                
    print(f"\nSummary:")
    print(f"  Matched users count: {matched_count}")
    print(f"  Unique projects in cache: {sorted(list(unique_projects))}")
