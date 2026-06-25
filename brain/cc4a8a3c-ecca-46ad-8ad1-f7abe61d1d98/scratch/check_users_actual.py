import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User

print("=== User database check ===")
for u in User.objects.all()[:15]:
    try:
        print(f"User ID: {repr(u.employee_id):15s} | Prop Name: {u.name:25s} | Designation: {u.designation}")
    except Exception as e:
        print(f"Error for ID {u.employee_id}: {e}")
