import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel_masters.models import Jurisdiction
from travel.models import HRPositionConfig

print("=== Jurisdiction Table project_code ===")
for j in Jurisdiction.objects.all().values('project_code', 'project_name').distinct():
    print(f"  Code: {repr(j['project_code'])} | Name: {repr(j['project_name'])}")

print("\n=== HRPositionConfig Table project_code ===")
for hp in HRPositionConfig.objects.all().values('project_code').distinct():
    print(f"  Code: {repr(hp['project_code'])}")

print("\n=== Unique Projects from UNIQUE_PROJECTS_LIST cache ===")
from django.core.cache import cache
projects = cache.get('UNIQUE_PROJECTS_LIST')
print(f"  Cache exists?: {projects is not None}")
if projects:
    for p in projects:
        print(f"    Code: {repr(p.get('code'))} | Name: {repr(p.get('name'))}")
