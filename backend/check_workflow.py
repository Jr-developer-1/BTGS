import os
import django
import sys

# Add backend to path
sys.path.append(r"c:\Users\Usha\Downloads\Bavya-TGS-2- (3)\Bavya-TGS-2- (2)\Bavya-TGS-2-\backend")

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel.models import FinanceWorkflowStep

print("FINANCE WORKFLOW STEPS:")
steps = FinanceWorkflowStep.objects.all().order_by('sequence_order')
for s in steps:
    print(f"Step {s.sequence_order}: {s.user.name} ({s.user.employee_id}), Visibility={s.visibility_type}, Active={s.is_active}")
