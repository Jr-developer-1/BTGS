from django.utils import timezone
from core.models import User
import json

def _is_hr(user):
    """Checks if a user is an HR user."""
    user_role = (user.role.name.lower() if user.role else '')
    dept = (user.department or '').lower()
    desig = (user.designation or '').lower()
    return 'hr' in user_role or 'hr' in dept or 'hr' in desig

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
    """Recursively builds the full reporting hierarchy chain."""
    chain = []
    current = user
    if not current:
        return []
    seen_ids = {user.employee_id}
    
    # Traverse management hierarchy (limit to 10 levels)
    for _ in range(10):
        mgr = current.reporting_manager
        if not mgr or mgr.employee_id in seen_ids:
            break
        
        chain.append({
            "employee_id": mgr.employee_id,
            "name": mgr.name,
            "designation": mgr.designation,
            "role": "Manager"
        })
        seen_ids.add(mgr.employee_id)
        current = mgr
    
    # Add HR as the terminal verification step
    hr_head = get_hr_head(user)
    if hr_head and hr_head.employee_id not in seen_ids:
        chain.append({
            "employee_id": hr_head.employee_id,
            "name": hr_head.name,
            "designation": hr_head.designation,
            "role": "HR"
        })
        
    return chain
