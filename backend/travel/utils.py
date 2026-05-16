from django.utils import timezone
from core.models import User
import json

def _is_hr(user):
    """Checks if a user is an HR user."""
    user_role = (user.role.name.lower() if user.role else '')
    dept = (user.department or '').lower()
    desig = (user.designation or '').lower()
    return (
        'hr' in user_role
        or 'human resources' in user_role
        or 'human resource' in user_role
        or 'hr' in dept
        or 'human resources' in dept
        or 'human resource' in dept
        or 'hr' in desig
        or 'human resources' in desig
        or 'human resource' in desig
    )

def _get_hr_users():
    """Returns a list of users who should be treated as HR."""
    all_users = User.objects.filter(is_active=True).select_related('role')
    return [u for u in all_users if _is_hr(u)]

def get_hr_head(user):
    """Finds an HR approver (Head of HR)."""
    all_hr = _get_hr_users()
    # Try local HR first
    local_hr = [u for u in all_hr if u.base_location == user.base_location]
    if local_hr:
        return local_hr[0]
    
    return all_hr[0] if all_hr else None

def build_approval_chain(user):
    """
    Recursively builds the full hierarchical chain using Position-to-Position traversal 
    by tracing position IDs through multi-position structures in real-time.
    """
    chain = []
    if not user:
        return []
        
    pos = user.get_current_position()
    if not pos:
        return []
        
    current_pos_id = pos.get('id')
    current_user = user
    
    seen_positions = set()
    
    for _ in range(10):
        # Guard against loops or missing IDs
        if not current_pos_id or str(current_pos_id) in seen_positions:
            break
        seen_positions.add(str(current_pos_id))
        
        api_data = current_user._get_api_data()
        if not api_data:
            break
            
        pos_details = api_data.get('positions_details', [])
        target_pos = None
        
        # 1. Locate specific position block matching current position ID
        for p in pos_details:
            if str(p.get('id')) == str(current_pos_id):
                target_pos = p
                break
                
        if not target_pos:
            fallback = api_data.get('position') or (pos_details[0] if pos_details else None)
            if fallback and str(fallback.get('id')) == str(current_pos_id):
                target_pos = fallback
                
        if not target_pos:
            break
            
        # 2. Extract direct manager position info
        reporting_to = target_pos.get('reporting_to', [])
        if not reporting_to or not isinstance(reporting_to, list):
            break
            
        next_mgr = reporting_to[0]
        if not next_mgr or not isinstance(next_mgr, dict):
            break
            
        next_pos_id = next_mgr.get('id')
        next_pos_name = next_mgr.get('name') or next_mgr.get('position_name')
        next_emp_code = next_mgr.get('employee_code') or next_mgr.get('employee_id')
        
        if not next_emp_code:
            break
            
        mgr_user = User._get_or_create_shell_user(str(next_emp_code))
        if not mgr_user:
            break
            
        # 3. Append position-centric hop to timeline
        chain.append({
            "employee_id": mgr_user.employee_id,
            "name": mgr_user.name,
            "designation": str(next_pos_name).upper() if next_pos_name else mgr_user.designation,
            "role": "Manager",
            "position_id": str(next_pos_id) if next_pos_id else None
        })
        
        # 4. Advance hop
        current_pos_id = next_pos_id
        current_user = mgr_user
    
    # Add HR as the terminal verification step
    hr_head = get_hr_head(user)
    # Check if HR head is already in the manager chain to avoid double-stepping
    manager_emp_ids = {item['employee_id'] for item in chain}
    if hr_head and hr_head.employee_id != user.employee_id and hr_head.employee_id not in manager_emp_ids:
        chain.append({
            "employee_id": hr_head.employee_id,
            "name": hr_head.name,
            "designation": hr_head.designation,
            "role": "HR",
            "position_id": None
        })
        
    return chain
