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
    hr_users = []
    hr_codes = set()
    
    # 1. Database HR users
    all_users = User.objects.filter(is_active=True).select_related('role')
    for u in all_users:
        if _is_hr(u):
            hr_users.append(u)
            hr_codes.add(u.employee_id.lower())
            
    # 2. Cache-resolved HR users from global employee roster
    from api_management.services import safe_cache_get
    global_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA') or []
    matching_codes = []
    for item in global_data:
        emp = item.get('employee', {})
        emp_code = emp.get('employee_code')
        if not emp_code:
            continue
        if emp_code.lower() in hr_codes:
            continue
            
        pos = item.get('position', {}) or {}
        pos_name = str(pos.get('name') or '').lower()
        role_name = str(pos.get('role_name') or '').lower()
        dept = str(pos.get('department') or '').lower()
        sect = str(pos.get('section') or '').lower()
        
        is_hr = (
            'hr' in pos_name or 'human resource' in pos_name or
            'hr' in role_name or 'human resource' in role_name or
            'hr' in dept or 'human resource' in dept or
            'hr' in sect or 'human resource' in sect
        )
        if is_hr:
            matching_codes.append(emp_code)
            
    if matching_codes:
        for code in matching_codes:
            u = User._get_or_create_shell_user(code)
            if u and u.employee_id.lower() not in hr_codes:
                hr_users.append(u)
                hr_codes.add(u.employee_id.lower())
                
    return hr_users

def get_hr_head(user):
    """Finds an HR approver (Head of HR)."""
    all_hr = _get_hr_users()
    # Try local HR first
    local_hr = [u for u in all_hr if u.base_location == user.base_location]
    if local_hr:
        return local_hr[0]
    
    return all_hr[0] if all_hr else None

def _resolve_numeric_employee_id(emp_id_val):
    """Delegates to centralized resolve_numeric_employee_id."""
    from api_management.services import resolve_numeric_employee_id
    return resolve_numeric_employee_id(emp_id_val)

def _is_coo_position(pos_name, designation, employee_id=None):
    """
    Checks if a position name or designation represents a COO position.
    Specifically checks if it starts with 'coo' or 'chief operating officer' (case-insensitive).
    """
    name_str = str(pos_name or '').strip().lower()
    desig_str = str(designation or '').strip().lower()
    
    # Check cache if both are empty/missing and employee_id is provided
    if not name_str and not desig_str and employee_id:
        from api_management.services import safe_cache_get
        global_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA') or []
        for item in global_data:
            emp = item.get('employee', {}) or {}
            if emp.get('employee_code') == employee_id:
                pos = item.get('position', {}) or {}
                name_str = str(pos.get('name') or '').strip().lower()
                desig_str = str(emp.get('designation') or pos.get('designation') or '').strip().lower()
                break

    name_match = (
        name_str == 'coo' or
        name_str.startswith('coo-') or
        name_str.startswith('coo ') or
        name_str.startswith('coo_') or
        name_str.startswith('chief operating officer')
    )
    
    desig_match = (
        desig_str == 'coo' or
        desig_str.startswith('coo-') or
        desig_str.startswith('coo ') or
        desig_str.startswith('coo_') or
        desig_str.startswith('chief operating officer')
    )
    
    return name_match or desig_match


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
            
        pos_details = api_data.get('positions_details', []) or []
        target_pos = None
        
        # 1. Locate specific position block matching current position ID
        for p in pos_details:
            if str(p.get('id')) == str(current_pos_id):
                target_pos = p
                break
                
        # Fallback to any available position to keep traversing the chain
        if not target_pos:
            target_pos = api_data.get('position') or (pos_details[0] if pos_details else None)
                
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
        
        if not next_emp_code and next_pos_id:
            from travel.views import get_users_by_position
            users = get_users_by_position(next_pos_id)
            if users:
                next_emp_code = users[0].employee_id
                
        if not next_emp_code:
            break
            
        # Robustly resolve numeric manager DB record ID to actual employee string code
        if str(next_emp_code).strip().isdigit():
            resolved_code, resolved_name = _resolve_numeric_employee_id(str(next_emp_code).strip())
            if resolved_code:
                next_emp_code = resolved_code
            
        mgr_user = User._get_or_create_shell_user(str(next_emp_code))
        if not mgr_user:
            break
            
        if mgr_user.employee_id == user.employee_id and str(next_pos_id) == str(current_pos_id):
            current_pos_id = next_pos_id
            current_user = mgr_user
            continue
            
        # Resolve manager's human-readable name from cache
        mgr_name = mgr_user.name
        if not mgr_name or mgr_name == mgr_user.employee_id:
            from api_management.services import safe_cache_get
            global_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
            if global_data:
                for item in global_data:
                    emp = item.get('employee', {})
                    if emp.get('employee_code') == mgr_user.employee_id:
                        mgr_name = emp.get('name') or emp.get('employee_name') or mgr_user.name
                        break

        # SPECIAL CASE: Stop building the management chain if the next approver is the COO.
        # This ensures the flow ends at the level reporting to the COO.
        if _is_coo_position(next_pos_name, mgr_user.designation, employee_id=mgr_user.employee_id):
            break

        # 3. Append position-centric hop to timeline if not consecutive duplicate (by both employee ID and position ID)
        is_duplicate = False
        if chain:
            last_step = chain[-1]
            if last_step["employee_id"] == mgr_user.employee_id and last_step["position_id"] == (str(next_pos_id) if next_pos_id else None):
                is_duplicate = True

        if not is_duplicate:
            chain.append({
                "employee_id": mgr_user.employee_id,
                "name": mgr_name,
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
        hr_name = hr_head.name
        hr_designation = hr_head.designation
        
        from api_management.services import safe_cache_get
        global_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
        if global_data:
            for item in global_data:
                emp = item.get('employee', {})
                if emp.get('employee_code') == hr_head.employee_id:
                    hr_name = emp.get('name') or emp.get('employee_name') or hr_head.name
                    pos = item.get('position', {}) or {}
                    hr_designation = pos.get('name') or hr_head.designation
                    break
                    
        chain.append({
            "employee_id": hr_head.employee_id,
            "name": hr_name,
            "designation": str(hr_designation).upper() if hr_designation else "HR",
            "role": "HR",
            "position_id": None
        })
        
    return chain

