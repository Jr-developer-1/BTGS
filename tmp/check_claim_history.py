import os
import django
import sys

sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User, AuditLog
from travel.models import TravelClaim

himaja = User.objects.filter(login_history__user__isnull=False).distinct()
# Find Himaja by name
for u in User.objects.all():
    if "himaja" in u.name.lower():
        print(f"User: {u.name} ({u.employee_id})")
        print(f"  Role: {u.role.name if u.role else 'None'}, Active Role: {u.active_role}")
        print(f"  Designation: {u.designation}")
        print(f"  Department: {u.department}")
        print(f"  Role Permissions: {u.role.permissions if u.role else 'None'}")
        
        # Check permissions specifically
        from core.models import Role
        print(f"  Permissions dict: {u.role.permissions}")
        break

print("\nAudit Logs for TravelClaim 6:")
for log in AuditLog.objects.filter(model_name="TravelClaim", object_id="6").order_by():
    user_name = log.user.name if log.user else 'System'
    role = log.user.active_role if log.user else 'None'
    print(f"  User: {user_name} ({role}), Action: {log.action}, Timestamp: {log.timestamp}")
    print(f"  Details: {log.details}")
