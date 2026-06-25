import os
import django
import sys

# Add the current directory and backend directory to sys.path
sys.path.append(os.getcwd())
sys.path.append(os.path.join(os.getcwd(), 'backend'))

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.views import get_users_by_position

from api_management.services import _bg_refresh_global_employee_cache, safe_cache_get

print("Running _bg_refresh_global_employee_cache() synchronously...")
_bg_refresh_global_employee_cache()

persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
if persistent_data:
    print(f"GLOBAL_EMPLOYEE_DATA cached. Count: {len(persistent_data)}")
    
    print("\n=== USERS BY POSITION ===")
    p_ids = ['FIN-001-AP-104-MMUS', 'FIN-H-001-AP-104-MMUS', 'FIN-002-AP-104-MMUS']
    for pid in p_ids:
        users = get_users_by_position(pid)
        print(f"Position: {pid} -> Users: {[u.name for u in users]}")
else:
    print("GLOBAL_EMPLOYEE_DATA is still empty!")


