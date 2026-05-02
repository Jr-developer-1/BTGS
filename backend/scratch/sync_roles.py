import os
import django
import sys

# Set up Django environment
sys.path.append(r'c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from api_management.services import fetch_employee_data
from core.models import Role

def sync_roles():
    print("Fetching roles from external API...")
    # Fetch all employees (using fetch_all_pages=True)
    data = fetch_employee_data(fetch_all_pages=True)
    if 'error' in data:
        print(f"Error fetching data: {data['error']}")
        return

    results = data.get('results', [])
    unique_roles = set()
    unique_positions = set()

    for item in results:
        pos = item.get('position', {})
        role_name = pos.get('role_name')
        pos_name = pos.get('name')
        
        if role_name:
            unique_roles.add(role_name.strip())
        if pos_name:
            unique_positions.add(pos_name.strip())

    print(f"Found {len(unique_roles)} unique roles and {len(unique_positions)} unique positions.")
    
    # We'll treat both as "Roles" in our system because that's how the user views them
    all_names = unique_roles.union(unique_positions)
    
    added_count = 0
    for name in sorted(all_names):
        if not name or name == 'N/A': continue
        
        role, created = Role.objects.get_or_create(name=name)
        if created:
            print(f"Added role: {name}")
            added_count += 1
        else:
            print(f"Role already exists: {name}")

    print(f"Finished. Added {added_count} new roles.")

if __name__ == "__main__":
    sync_roles()
