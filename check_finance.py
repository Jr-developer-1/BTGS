import os
import django
import sys

# Setup django
sys.path.append(os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel.views import ApprovalsView
from rest_framework.test import APIRequestFactory

# Get Finance Head user (Sri laxmi peketi)
user = User.objects.get(employee_id='HR-EMP-04157')

# Initialize request factory and request
factory = APIRequestFactory()
request = factory.get('/api/approvals/?tab=pending&source=hub')
request.custom_user = user # Bypass custom permission check

# Call view
view = ApprovalsView.as_view()
response = view(request)

print("Status code:", response.status_code)
results = response.data if response.status_code == 200 else []
print(f"Found {len(results)} pending tasks:")

# Local simulation of aggregateApprovedAmount logic
def aggregate_approved_amount(item):
    details = item.get('details', {})
    if not details:
        cost_str = item.get('cost', '0')
        return float(cost_str.replace('₹', '').replace(',', '').strip() or 0)
    
    claim_level_approved = details.get('executive_approved_amount') or details.get('approved_amount') or details.get('hr_approved_amount')
    if claim_level_approved not in [None, '']:
        try:
            return float(claim_level_approved)
        except ValueError:
            pass

    # Fallback to summing up expenses
    expenses = details.get('expenses', [])
    if expenses:
        total = 0
        for e in expenses:
            if e.get('status') == 'Rejected':
                continue
            val = e.get('finance_selected_amount')
            if val is None:
                val = e.get('hr_selected_amount')
            if val is None:
                val = e.get('amount')
            total += float(val or 0)
        return total
    return float(details.get('total_amount', 0))

def calculate_net_payout(item):
    gross = aggregate_approved_amount(item)
    details = item.get('details', {})
    if not details:
        return gross
    
    total_adv = float(details.get('total_advance_taken') or 0)
    wallet_bal = float(details.get('wallet_balance_used') or 0)
    return max(0.0, gross - total_adv - wallet_bal)

for item in results:
    gross = aggregate_approved_amount(item)
    net = calculate_net_payout(item)
    print(f"Task ID: {item.get('id')}")
    print(f"  Type: {item.get('type')}")
    print(f"  Requester: {item.get('requester')}")
    print(f"  Database ID: {item.get('db_id')}")
    print(f"  API Details:")
    print(f"    total_amount (requested): {item.get('details', {}).get('total_amount')}")
    print(f"    executive_approved_amount: {item.get('details', {}).get('executive_approved_amount')}")
    print(f"    hr_approved_amount: {item.get('details', {}).get('hr_approved_amount')}")
    print(f"    approved_amount: {item.get('details', {}).get('approved_amount')}")
    print(f"  Calculated:")
    print(f"    Gross Approved Amount: {gross:.2f}")
    print(f"    Net Payout: {net:.2f}")
