import os
import sys
import django
import time

# Set up Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel.models import Trip, TravelClaim, FinanceIntimation, FinanceWorkflowStep, FinanceWorkflowSetting
from travel.views import _get_finance_steps_and_settings, trigger_finance_workflow, handle_workflow_action

def run_test():
    print("=== TESTING FINANCE PARALLEL FLOW ===")
    
    # 1. Clean up existing test database items
    Trip.objects.filter(trip_id='TEST-FIN-001').delete()
    
    # 2. Get/Create Users for AP-104-MMUS
    # Steps:
    # 71: position_id='FIN-001-AP-104-MMUS', level_type='assistant_manager', visibility='INBOX'
    # 72: position_id='FIN-H-001-AP-104-MMUS', level_type='manager', visibility='INBOX'
    # 73: position_id='FIN-002-AP-104-MMUS', level_type='assistant_manager', visibility='FINANCE_HUB'
    
    # Let's create a test trip and claim for AP-104-MMUS
    requester = User._get_or_create_shell_user('REQ-USER-1')
    requester.is_active = True
    requester.save()
    
    trip = Trip.objects.create(
        user=requester,
        trip_id='TEST-FIN-001',
        project_code='AP-104-MMUS',
        purpose='Test Finance',
        start_date='2026-07-10',
        end_date='2026-07-15',
        source='ELURU',
        destination='VIJAYAWADA',
        status='HR Approved'
    )
    
    claim = TravelClaim.objects.create(
        trip=trip,
        total_amount=1000.00,
        status='HR Approved',
        user_name='Requester'
    )
    
    print(f"Created trip {trip.trip_id} and claim {claim.id} with status={claim.status}")
    
    # Run _get_finance_steps_and_settings
    steps, is_parallel, enable_two_level, p_code = _get_finance_steps_and_settings(claim)
    print(f"_get_finance_steps_and_settings output: project_code={p_code}, is_parallel={is_parallel}, enable_two_level={enable_two_level}")
    
    # Trigger finance workflow
    print("\nTriggering finance workflow...")
    res = trigger_finance_workflow(claim, requester)
    print(f"Trigger result: {res}")
    
    print("Sleeping 2 seconds for worker thread...")
    time.sleep(2)
    
    # Check intimations created
    intimations = FinanceIntimation.objects.filter(claim=claim)
    print(f"Created intimations count: {intimations.count()}")
    approving_user = None
    for int_obj in intimations:
        print(f"  - Intimation: ID={int_obj.id} | User={int_obj.finance_user.employee_id} | Position={int_obj.finance_position} | is_read={int_obj.is_read} | is_approval={int_obj.is_approval}")
        if int_obj.finance_user.employee_id == 'HR-EMP-14656':
            approving_user = int_obj.finance_user

    if approving_user:
        print(f"\nSimulating approval by user {approving_user.employee_id}...")
        # Make sure user's active role allows finance actions
        from core.models import Role
        finance_role, _ = Role.objects.get_or_create(name='Finance')
        approving_user.role = finance_role
        # Active position id needs to be the step position to pass authorization
        approving_user.active_position_id = 'FIN-001-AP-104-MMUS'
        approving_user.save()
        
        data = {
            'id': f'CLAIM-{claim.id}',
            'action': 'Approve'
        }
        
        # Approve!
        res_action = handle_workflow_action(claim, 'Approve', approving_user, data)
        print(f"Action Response: {res_action.data if hasattr(res_action, 'data') else res_action}")
        
        # Reload claim and intimations
        claim.refresh_from_db()
        print(f"Claim status after approval: {claim.status} | approver_position: {claim.approver_position} | current_approver: {claim.current_approver.employee_id if claim.current_approver else None}")
        
        print("\nIntimations status after approval:")
        for int_obj in FinanceIntimation.objects.filter(claim=claim):
            print(f"  - Intimation: ID={int_obj.id} | User={int_obj.finance_user.employee_id} | Position={int_obj.finance_position} | is_read={int_obj.is_read} | is_approval={int_obj.is_approval}")
    else:
        print("ERROR: Approving user not found in intimations.")

if __name__ == '__main__':
    run_test()
