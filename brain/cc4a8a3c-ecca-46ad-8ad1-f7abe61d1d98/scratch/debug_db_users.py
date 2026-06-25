import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User, LoginHistory

# Show all users who have login history
print("=== Users with LoginHistory ===")
users_with_logins = (
    User.objects.filter(login_history__isnull=False)
    .distinct()
    .values('employee_id', 'name', 'designation', 'department')
)
for u in users_with_logins:
    count = LoginHistory.objects.filter(user__employee_id=u['employee_id']).count()
    print(f"  employee_id: {repr(u['employee_id']):25s} | name: {u.get('name','?'):30s} | designation: {u.get('designation','?')} | logins: {count}")

# Show all users
print(f"\n=== All Users ({User.objects.count()} total) ===")
for u in User.objects.all().values('employee_id', 'name', 'designation', 'department')[:20]:
    print(f"  {repr(u['employee_id']):25s} | {u.get('name','?'):30s} | {u.get('designation','')}")
