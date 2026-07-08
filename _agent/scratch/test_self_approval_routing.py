import os
import sys
import django

# Set up Django environment
sys.path.append(r'c:\Users\Usha\Desktop\TGS_LIVE\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from core.models import User
from travel.models import Trip
from travel.views import handle_workflow_action, resolve_approver
from travel.utils import build_approval_chain

def test_routing():
    print("=== STARTING SELF-APPROVAL ROUTING VERIFICATION ===")
    
    himaja_code = 'HR-EMP-06889'
    naresh_code = 'HR-EMP-17065'
    
    himaja = User.objects.filter(employee_id=himaja_code).first()
    naresh = User.objects.filter(employee_id=naresh_code).first()
    
    # 1. Set Himaja's active position to DM (2133)
    himaja.active_position_id = '2133'
    print(f"Himaja Active Position: {himaja.active_position_id}")
    
    # 2. Build approval chain for Himaja (acting as DM)
    chain = build_approval_chain(himaja)
    print("\nCalculated Approval Chain for Himaja:")
    for step in chain:
        print(f"  - Employee: {step['employee_id']} ({step['name']}) | Position: {step['position_id']} ({step['designation']}) | Role: {step['role']}")
        
    # Clean up previous test trips
    Trip.objects.filter(user=himaja, trip_id='TEST-SELF-001').delete()
    
    # 3. Resolve initial approver
    current_approver, h_level, rm, sm, hod, pos_id = resolve_approver(himaja)
    print(f"\nResolved Initial Approver: {current_approver.employee_id if current_approver else None} | Position: {pos_id}")
    
    # 4. Create mock Trip for Himaja
    trip = Trip.objects.create(
        user=himaja,
        trip_id='TEST-SELF-001',
        purpose='Testing self-approval routing',
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
            "description": "Travel request initiated by Himaja Sai Vaani Ganta."
        }]
    )
    print(f"Trip created with status={trip.status}, current_approver={trip.current_approver.employee_id if trip.current_approver else None}, approver_position={trip.approver_position}")
    
    # 5. Simulate Himaja approving the request as RM (position 3)
    print("\nSimulating approval by Himaja (Regional Manager position 3)...")
    himaja.active_position_id = '3'
    resp = handle_workflow_action(trip, 'Approve', himaja)
    print(f"Response from Himaja RM approval: {resp.data}")
    
    # Reload trip from DB
    trip.refresh_from_db()
    print(f"Trip after Himaja RM approval: status={trip.status}, current_approver={trip.current_approver.employee_id if trip.current_approver else None}, approver_position={trip.approver_position}, hierarchy_level={trip.hierarchy_level}")
    
    # 6. Verify if it forwarded to Naresh SPH
    if trip.current_approver == naresh:
        print("\nSUCCESS: Trip successfully forwarded to Naresh SPH!")
        
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
