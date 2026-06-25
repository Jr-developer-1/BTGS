import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from api_management.services import safe_cache_get
from core.models import User

data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')

if not data:
    print("CACHE IS EMPTY - project filtering will be skipped.")
    print("The background sync task has not populated it yet.")
    sys.exit()

print(f"Cache has {len(data)} entries.\n")

# Show first 3 item structures
print("=== First 3 item structures ===")
for i, item in enumerate(data[:3]):
    emp = item.get('employee', {})
    proj = item.get('project', {})
    print(f"\n[Item {i+1}]")
    print(f"  employee keys : {list(emp.keys()) if emp else '(none)'}")
    print(f"  employee_code : {repr(emp.get('employee_code'))}")
    print(f"  project keys  : {list(proj.keys()) if proj else '(none)'}")
    print(f"  project code  : {repr(proj.get('code'))}")
    print(f"  project name  : {repr(proj.get('name'))}")

# Unique project codes in cache
project_codes_in_cache = set()
for item in data:
    proj = item.get('project', {})
    if proj:
        code = proj.get('code')
        if code:
            project_codes_in_cache.add(code)

print(f"\n=== Unique project codes in cache ({len(project_codes_in_cache)}) ===")
for pc in sorted(project_codes_in_cache):
    count = sum(1 for item in data if (item.get('project') or {}).get('code') == pc)
    print(f"  {repr(pc):40s} -> {count} employees")

# Cross-check employee_codes vs User.employee_id
print("\n=== Cross-checking employee_code vs User.employee_id ===")
all_emp_codes = [
    item.get('employee', {}).get('employee_code')
    for item in data
    if item.get('employee', {}).get('employee_code')
]
print(f"  employee_codes from cache : {len(all_emp_codes)}")
matched_users = User.objects.filter(employee_id__in=all_emp_codes).count()
total_users = User.objects.count()
print(f"  Users in DB               : {total_users}")
print(f"  Users matched by code     : {matched_users}")

if matched_users == 0:
    print("\nZERO MATCHES - employee_code format from API does not match User.employee_id in DB!")
    print("  Sample API codes  :", all_emp_codes[:5])
    print("  Sample DB IDs     :", list(User.objects.values_list('employee_id', flat=True)[:5]))
else:
    print(f"\n{matched_users}/{total_users} users matched correctly.")

# Test specific project
test_code = "AP-104-MMUS"
print(f"\n=== Employees with project_code={repr(test_code)} ===")
matched = [
    item.get('employee', {}).get('employee_code')
    for item in data
    if (item.get('project') or {}).get('code', '').upper() == test_code.upper()
]
print(f"  Found {len(matched)} employees: {matched[:10]}")
db_matched = User.objects.filter(employee_id__in=matched).count()
print(f"  Of those, {db_matched} have a matching User record in DB.")
