import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User

u = User.objects.get(employee_id='HR-EMP-06889')
print(f"User: {u.employee_id}")
print(f"  base_role: {u.role.name if u.role else 'None'}")
print(f"  active_role: {u.active_role}")
print(f"  designation: {u.designation}")
print(f"  department: {u.department}")

role_name = u.active_role.lower()
privileged_keywords = ['admin', 'superuser', 'it admin', 'it-admin', 'cfo', 'hr', 'finance']
is_privileged = any(kw in role_name for kw in privileged_keywords)
print(f"  is_privileged?: {is_privileged}")
