"""
Quick cache diagnostic - checks GLOBAL_EMPLOYEE_DATA PLUS GLOBAL_EMPLOYEE_CACHE (in-memory)
Run: python brain/cc4a8a3c-ecca-46ad-8ad1-f7abe61d1d98/scratch/debug_project_filter2.py
"""
import os, sys, django
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from api_management.services import safe_cache_get, GLOBAL_EMPLOYEE_CACHE
from core.models import User

# 1. Check file-based persistent cache
file_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
print(f"File cache (GLOBAL_EMPLOYEE_DATA): {len(file_data) if file_data else 0} entries")

# 2. Check in-memory cache
mem_data = GLOBAL_EMPLOYEE_CACHE.get('data', [])
print(f"Memory cache (GLOBAL_EMPLOYEE_CACHE): {len(mem_data)} entries")

data = file_data or mem_data

if not data:
    print("\nBOTH CACHES EMPTY - project filter cannot match employees.")
    print("The external API sync must complete at least once for filtering to work.")
    print("\nTo trigger a sync manually, call:")
    print("  GET /api/management/employees/?fetch_all=true")
    print("Or restart the server and wait for the background scheduler.")
    sys.exit()

# Show what project codes exist
print(f"\nTotal entries: {len(data)}")
project_map = {}
for item in data:
    proj = item.get('project', {})
    emp = item.get('employee', {})
    code = (proj or {}).get('code', '(none)')
    emp_code = (emp or {}).get('employee_code', '')
    if code not in project_map:
        project_map[code] = []
    if emp_code:
        project_map[code].append(emp_code)

print("\nProject codes and employee counts:")
for proj_code, emp_codes in sorted(project_map.items()):
    matched = User.objects.filter(employee_id__in=emp_codes).count()
    print(f"  {proj_code:35s} | API employees: {len(emp_codes):3d} | DB matches: {matched}")

# Overall match rate
all_codes = [e for codes in project_map.values() for e in codes]
total_matched = User.objects.filter(employee_id__in=all_codes).count()
print(f"\nOverall: {total_matched}/{len(all_codes)} API employee_codes match a User.employee_id in DB")

if total_matched == 0 and all_codes:
    print("\nSample API employee_codes:", all_codes[:5])
    print("Sample DB employee_ids:   ", list(User.objects.values_list('employee_id', flat=True)[:5]))
