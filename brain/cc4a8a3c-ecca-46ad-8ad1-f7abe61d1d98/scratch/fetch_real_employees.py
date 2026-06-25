import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from api_management.services import fetch_employee_data
from core.models import User

# Try to fetch some real employee data from the external API
print("Fetching raw employee data from external API...")
try:
    resp = fetch_employee_data(page=1, page_size=5, force_fresh=True)
    if 'results' in resp:
        results = resp['results']
        print(f"Successfully fetched {len(results)} items.")
        for idx, item in enumerate(results[:3]):
            print(f"\n--- Item {idx+1} ---")
            print("Employee Details:")
            emp = item.get('employee', {})
            for k, v in emp.items():
                print(f"  {k}: {v}")
            print("Project Details:")
            proj = item.get('project', {})
            for k, v in proj.items():
                print(f"  {k}: {v}")
            
            # Let's check matching user in DB
            emp_code = emp.get('employee_code')
            if emp_code:
                db_user = User.objects.filter(employee_id=emp_code).first()
                print(f"  Matches user in DB? {db_user is not None} (ID in DB: {emp_code})")
    else:
        print("API Response Error:", resp)
except Exception as e:
    print("Failed to fetch:", e)
