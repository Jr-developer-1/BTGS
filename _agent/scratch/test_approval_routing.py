import os
import sys
import django

# Set up Django environment
sys.path.append(r'c:\Users\Usha\Desktop\TGS_LIVE\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User, Role
from travel.models import Trip, BulkActivityBatch
from travel.views import handle_workflow_action, resolve_approver
from travel.utils import build_approval_chain
from api_management.services import get_dynamic_employee_data

def test_routing():
    print("=== STARTING APPROVAL ROUTING VERIFICATION ===")
    
    # 1. Ensure users exist and are activated in the DB
    karthik_code = 'HR-EMP-07565'
    himaja_code = 'HR-EMP-06889'
    naresh_code = 'HR-EMP-17065'
    
    # Force refresh cache for all three to ensure positions_details is populated
    print("Refreshing employee data caches...")
    get_dynamic_employee_data(karthik_code, force_fresh=True)
    get_dynamic_employee_data(himaja_code, force_fresh=True)
    get_dynamic_employee_data(naresh_code, force_fresh=True)
    
    karthik = User._get_or_create_shell_user(karthik_code)
    himaja = User._get_or_create_shell_user(himaja_code)
    naresh = User._get_or_create_shell_user(naresh_code)
    
    # Ensure they are active
    User.objects.filter(employee_id__in=[karthik_code, himaja_code, naresh_code]).update(is_active=True)
    
    # Print their resolved active position IDs
    print(f"Karthik: active_position_id={karthik.active_position_id}")
    print(f"Himaja: active_position_id={himaja.active_position_id}")
    print(f"Naresh: active_position_id={naresh.active_position_id}")
    
    # Verify approval chain calculation
    chain = build_approval_chain(karthik)
    print("\nCalculated Approval Chain for Karthik:")
    for step in chain:
        print(f"  - Employee: {step['employee_id']} ({step['name']}) | Position: {step['position_id']} ({step['designation']}) | Role: {step['role']}")
        
    # Clean up previous test trips
    Trip.objects.filter(user=karthik, trip_id='TEST-ROUTE-001').delete()
    
    # 2. Create mock Trip for Karthik
    print("\nCreating test trip for Karthik...")
    # Resolve initial approver
    current_approver, h_level, rm, sm, hod, pos_id = resolve_approver(karthik)
    print(f"Resolved Initial Approver: {current_approver.employee_id if current_approver else None} | Position: {pos_id}")
    
    trip = Trip.objects.create(
        user=karthik,
        trip_id='TEST-ROUTE-001',
        purpose='Testing approval routing',
        start_date='2026-07-10',
        end_date='2026-07-15',
        source='ELURU',
        destination='VIJAYAWADA',
        status='Pending',
        current_approver=current_approver,
        approver_position=pos_id,
        hierarchy_level=1,
        approval_chain=chain,
        lifecycle_events=[{
            "date": "Jul 04, 2026",
            "title": "Trip Requested",
            "status": "completed",
            "description": "Travel request initiated by K Karthik."
        }]
    )
    print(f"Trip created with status={trip.status}, current_approver={trip.current_approver.employee_id if trip.current_approver else None}, approver_position={trip.approver_position}")
    
    # 3. Simulate Himaja approving the request as Level 1 Manager
    print("\nSimulating approval by Himaja (Level 1, position 2133)...")
    # Set Himaja's active position to 2133 to match
    himaja.active_position_id = '2133'
    
    # Run handle_workflow_action
    resp = handle_workflow_action(trip, 'Approve', himaja)
    print(f"Response from Himaja approval: {resp.data}")
    
    # Reload trip from DB
    trip.refresh_from_db()
    print(f"Trip after Himaja approval: status={trip.status}, current_approver={trip.current_approver.employee_id if trip.current_approver else None}, approver_position={trip.approver_position}, hierarchy_level={trip.hierarchy_level}")
    
    # 4. Simulate Himaja approving as Level 2 Manager (Regional Manager position 3)
    if trip.current_approver == himaja and trip.approver_position == '3':
        print("\nSimulating approval by Himaja (Level 2, position 3)...")
        himaja.active_position_id = '3'
        resp = handle_workflow_action(trip, 'Approve', himaja)
        print(f"Response from Himaja RM approval: {resp.data}")
        trip.refresh_from_db()
        print(f"Trip after Himaja RM approval: status={trip.status}, current_approver={trip.current_approver.employee_id if trip.current_approver else None}, approver_position={trip.approver_position}, hierarchy_level={trip.hierarchy_level}")
    
    # 5. Verify if it forwarded to Naresh SPH
    if trip.current_approver == naresh:
        print("\nSUCCESS! Trip successfully forwarded to Naresh SPH!")
        
        # Simulating Naresh approving
        print("\nSimulating approval by Naresh SPH...")
        naresh.active_position_id = '2'
        resp = handle_workflow_action(trip, 'Approve', naresh)
        print(f"Response from Naresh approval: {resp.data}")
        trip.refresh_from_db()
        print(f"Trip after Naresh approval: status={trip.status}, current_approver={trip.current_approver.employee_id if trip.current_approver else None}, approver_position={trip.approver_position}, hierarchy_level={trip.hierarchy_level}")
    else:
        print("\nFAILURE: Trip did not route to Naresh SPH.")

if __name__ == '__main__':
    test_routing()
