from django.db import models
from django.utils import timezone

class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=dict, blank=True)
    
    def __str__(self):
        return self.name

class User(models.Model):
    employee_id = models.CharField(max_length=20, unique=True)
    
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    password_hash = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    requires_password_change = models.BooleanField(default=False)
    reset_otp = models.CharField(max_length=6, blank=True, null=True)
    reset_otp_expiry = models.DateTimeField(blank=True, null=True)
    theme = models.CharField(max_length=50, default='classic', choices=[
        ('classic', 'Classic Burgundy'),
        ('ocean', 'Ocean Blue'),
        ('teal', 'Modern Teal'),
        ('sunset', 'Sunset Orange'),
        ('midnight', 'Midnight Navy'),
        ('minimal', 'Minimalist Gray'),
        ('pastel', 'Pastel Dreams'),
        ('coastal', 'Coastal Sand'),
        ('sunny', 'Sunny Sky'),
        ('slate', 'Slate Elegance'),
        ('tropical', 'Tropical Teal')
    ])

    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def active_position_id(self):
        if hasattr(self, '_active_position_id') and self._active_position_id:
            return self._active_position_id
        
        from .middleware import get_current_request
        request = get_current_request()
        if request:
            val = request.headers.get('X-Active-Position-Id')
            if val:
                self._active_position_id = str(val).strip()
                return self._active_position_id
                
        data = self._get_api_data()
        if data:
            pos = data.get('position') or (data.get('positions_details', [])[0] if data.get('positions_details', []) else None)
            if pos:
                val = str(pos.get('id'))
                self._active_position_id = val
                return val
            
        return None

    @active_position_id.setter
    def active_position_id(self, value):
        self._active_position_id = str(value) if value else None

    # Finance Reconcilition Wallet
    carry_forward_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    # FRS Fields (Stored as base64 in DB as requested)
    is_face_enrolled = models.BooleanField(default=False)
    face_encoding = models.TextField(null=True, blank=True)
    face_photo = models.TextField(null=True, blank=True)
    allow_photo_reset = models.BooleanField(default=False)
    frs_logs_cleared_at = models.DateTimeField(null=True, blank=True)

    # Mandatory Django auth fields
    USERNAME_FIELD = 'employee_id'
    REQUIRED_FIELDS = []
    
    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return f"{self.name} ({self.employee_id})"

    def _get_api_data(self, force_fresh=False):
        # 0. Check if we should skip external API for performance (Pure DB Mode)
        from .middleware import should_skip_external_api
        if should_skip_external_api():
            return None

        # 1. Guard for literal static system accounts by ID
        # Only skip the API for the specific local-only management identities
        lower_id = self.employee_id.lower()
        static_system_ids = ['admin', 'admin001', 'admino01', 'hr', 'guesthousemanager', 'finance', 'cfo']
        if lower_id in static_system_ids:
             return None
             
        from api_management.services import get_dynamic_employee_data
        return get_dynamic_employee_data(self.employee_id, force_fresh=force_fresh)

    @property
    def is_blocked_by_api(self):
        # 1. System static users are never blocked
        lower_id = self.employee_id.lower()
        static_system_ids = ['admin', 'admin001', 'admino01', 'hr', 'guesthousemanager', 'finance', 'cfo']
        if lower_id in static_system_ids:
            return False
            
        data = self._get_api_data()
        if not data:
            return False # if API is down, fallback to local DB is_active
            
        from datetime import datetime, date
        today = date.today()
        
        # A. Check all possible end/resignation/scheduled dates first
        has_future_date = False
        has_past_date = False
        
        # Check employee dates
        emp = data.get('employee', {})
        for field in ['resignation_date', 'end_date', 'scheduled_to_date', 'scheduled_to', 'leaving_date', 'last_working_day', 'last_working_date']:
            val_str = emp.get(field)
            if val_str:
                try:
                    limit_date = datetime.strptime(str(val_str).split('T')[0], '%Y-%m-%d').date()
                    if limit_date >= today:
                        has_future_date = True
                    else:
                        has_past_date = True
                except:
                    pass
                    
        # Check positions_details dates
        for pos in data.get('positions_details', []):
            for field in ['end_date', 'resignation_date', 'scheduled_to_date', 'scheduled_to']:
                val_str = pos.get(field)
                if val_str:
                    try:
                        limit_date = datetime.strptime(str(val_str).split('T')[0], '%Y-%m-%d').date()
                        if limit_date >= today:
                            has_future_date = True
                        else:
                            has_past_date = True
                    except:
                        pass
                        
        # B. Decision logic:
        # 1. If there is a scheduled/resignation date in the future, they are NOT blocked
        if has_future_date:
            return False
            
        # 2. If there is a scheduled/resignation date in the past, they ARE blocked
        if has_past_date:
            return True
            
        # C. Fallback: If no scheduled/resignation dates are provided, check raw status field
        emp_status = emp.get('status')
        if emp_status:
            status_clean = str(emp_status).strip().lower()
            if status_clean in ['inactive', 'suspended', 'blocked', 'resigned']:
                return True
                
        return False

    @classmethod
    def _get_or_create_shell_user(cls, employee_code):
        """Ensures a shell user exists for a given employee code."""
        if not employee_code:
            return None
        user = User.objects.filter(employee_id=employee_code).first()
        if not user:
            try:
                role, _ = Role.objects.get_or_create(name='Employee')
                user = User.objects.create(
                    employee_id=employee_code,
                    role=role,
                    password_hash='dynamic_user'
                )
            except Exception as e:
                print(f"Error creating shell user {employee_code}: {e}")
                return None
        return user

    @property
    def active_role(self):
        # 1. Base role check (Admin is always Admin)
        base_role = self.role.name if self.role else 'Employee'
        if base_role.lower() == 'admin':
            return 'Admin'

        # 2. Extract context from active position designation/role
        desig = (self.designation or '').lower()
        role_api = (self.role_from_api or '').lower()
        dept = (self.department or '').lower()

        # CFO
        if 'cfo' in desig or 'cfo' in role_api or base_role.lower() == 'cfo':
            return 'CFO'

        # Finance
        if 'finance' in desig or 'finance' in role_api or 'finance' in dept or base_role.lower() == 'finance':
            return 'Finance'

        # HR
        if 'hr' in desig or 'hr' in role_api or 'hr' in dept or 'human resource' in desig or 'human resource' in dept or base_role.lower() == 'hr':
            return 'HR'

        # Guest House Manager
        if 'guesthouse' in desig or 'guesthouse' in role_api or 'facility' in desig or base_role.lower() == 'guesthousemanager':
            return 'GuestHouseManager'

        return base_role

    @property
    def name(self):
        # 1. Hardcoded ID check (fastest)
        lower_id = self.employee_id.lower()
        if lower_id in ['admin', 'admin001', 'admino01']: return 'System Administrator'
        if lower_id == 'guesthousemanager': return 'Guest House Manager'
        if lower_id == 'hr': return 'HR Manager'
        if lower_id == 'finance': return 'Finance Manager'
        if lower_id == 'cfo': return 'CFO'
        
        # 2. Local fallback if API skip is active
        if self._get_api_data() is None:
            return self.employee_id
            
        # 3. Dynamic fetch
        data = self._get_api_data()
        return data.get('employee', {}).get('name') or self.employee_id

    @property
    def email(self):
        lower_id = self.employee_id.lower()
        if lower_id in ['admin', 'admin001', 'admino01', 'hr', 'guesthousemanager', 'finance', 'cfo']:
             return f"{lower_id}@tgs.com"
        data = self._get_api_data()
        return data.get('employee', {}).get('email', '') if data else ''

    @property
    def phone(self):
        data = self._get_api_data()
        return data.get('employee', {}).get('phone', '') if data else ''

    @property
    def designation(self):
        lower_id = self.employee_id.lower()
        if lower_id in ['admin', 'admin001', 'admino01']: return 'Administrator'
        if lower_id == 'guesthousemanager': return 'Facility Manager'
        if lower_id == 'hr': return 'HR Head'
        pos = self.get_current_position()
        return pos.get('name', '') if pos else ''

    @property
    def role_from_api(self):
        pos = self.get_current_position()
        return pos.get('role_name', '') if pos else ''

    @property
    def department(self):
        lower_id = self.employee_id.lower()
        if lower_id in ['admin', 'admin001', 'admino01', 'hr', 'guesthousemanager', 'finance', 'cfo']:
             return 'Management'
        pos = self.get_current_position()
        return pos.get('department_name') or pos.get('department') or 'N/A' if pos else 'N/A'

    @property
    def section(self):
        pos = self.get_current_position()
        return pos.get('section_name') or pos.get('section') or 'N/A' if pos else 'N/A'

    @property
    def project_name(self):
        data = self._get_api_data()
        return data.get('project', {}).get('name') or 'N/A' if data else 'N/A'

    @property
    def project_code(self):
        data = self._get_api_data()
        return data.get('project', {}).get('code') or 'N/A' if data else 'N/A'

    @property
    def photo(self):
        data = self._get_api_data()
        return data.get('employee', {}).get('photo', None) if data else None

    @property
    def office_level(self):
        data = self._get_api_data()
        if data:
            level_str = data.get('office', {}).get('level', '')
            if 'Level' in str(level_str):
                try: return int(str(level_str).replace('Level', '').strip())
                except: pass
        return 3

    @property
    def base_location(self):
        data = self._get_api_data()
        return data.get('office', {}).get('name', '') if data else ''

    @property
    def office_location(self):
        data = self._get_api_data()
        if not data: return ''
        geo = data.get('office', {}).get('geo_location', {}) or {}
        # Prioritize cluster/district as 'real location' names
        return (geo.get('cluster') or geo.get('district') or geo.get('mandal') or self.base_location or '').strip()

    @property
    def cluster_name(self):
        data = self._get_api_data()
        if not data: return ''
        geo = data.get('office', {}).get('geo_location', {}) or {}
        return (geo.get('cluster') or geo.get('district') or self.base_location or '').strip()

    @property
    def level_rank(self):
        pos = self.get_current_position()
        return pos.get('level_rank', 10) if pos else 10

    @property
    def bank_name(self):
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {}) or {}
        return bank_info.get('bank_name', '')

    @property
    def account_no(self):
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {}) or {}
        raw_acc = str(bank_info.get('account_no') or '')
        if not raw_acc: return ''
        
        # Masking: show last 5 digits
        if len(raw_acc) <= 5:
            return raw_acc
        return '*' * (len(raw_acc) - 5) + raw_acc[-5:]

    @property
    def full_account_no(self):
        """Unmasked account number for finance exports."""
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {}) or {}
        return str(bank_info.get('account_no') or '')

    @property
    def ifsc_code(self):
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {}) or {}
        return bank_info.get('ifsc_code', '')

    def _get_hierarchy_manager(self, index):
        """Helper to resolve a manager from the API hierarchy at a specific depth."""
        pos = self.get_current_position()
        if not pos: return None
        # Support both 'position' (current) and 'positions_details' (legacy)
        reporting_to = pos.get('reporting_to', [])
        if len(reporting_to) <= index:
             return None
             
        mgr_info = reporting_to[index]
        if not mgr_info:
            return None
            
        # Resolve identifier: prioritize 'employee_code' (Login ID) then 'employee_id' (Numeric API ID)
        emp_code = None
        if isinstance(mgr_info, dict):
            # Prioritize employee_code/employee_identifier as it's typically the login ID
            emp_code = mgr_info.get('employee_code') or mgr_info.get('employee_id') or mgr_info.get('employee', {}).get('employee_code')
        else:
            emp_code = mgr_info
            
        # If the emp_code is still purely numeric (a raw HR database ID), attempt an active resolution
        if emp_code and str(emp_code).isdigit():
            from api_management.services import resolve_numeric_employee_id
            resolved_code, _ = resolve_numeric_employee_id(str(emp_code).strip())
            if resolved_code:
                emp_code = resolved_code

        # Fallback: if emp_code is null/empty but we have a position ID, resolve via position lookup
        if not emp_code and isinstance(mgr_info, dict):
            pos_id = mgr_info.get('id') or mgr_info.get('position_id')
            if pos_id:
                from travel.views import get_users_by_position
                users = get_users_by_position(pos_id)
                if users:
                    return users[0]
            
        return self._get_or_create_shell_user(str(emp_code)) if emp_code else None

    def _get_hierarchy_manager_position(self, index):
        """Helper to get the raw manager position ID from the API hierarchy."""
        pos = self.get_current_position()
        if not pos: return None
        reporting_to = pos.get('reporting_to', [])
        if len(reporting_to) <= index:
             return None
        mgr_info = reporting_to[index]
        if isinstance(mgr_info, dict):
            return mgr_info.get('id') or mgr_info.get('position_id')
        return mgr_info

    @property
    def reporting_manager_position(self):
        return self._get_hierarchy_manager_position(0)

    @property
    def senior_manager_position(self):
        return self._get_hierarchy_manager_position(1)

    @property
    def hod_director_position(self):
        return self._get_hierarchy_manager_position(2)

    @property
    def reporting_manager(self):
        return self._get_hierarchy_manager(0)

    @property
    def senior_manager(self):
        return self._get_hierarchy_manager(1)

    @property
    def hod_director(self):
        return self._get_hierarchy_manager(2)

    def get_current_position(self):
        """Returns the currently active position object from the API data."""
        data = self._get_api_data()
        if not data: return None
        
        pos_details = data.get('positions_details', [])
        
        # 1. Try to match active_position_id
        if self.active_position_id:
            active_id_str = str(self.active_position_id)
            for p in pos_details:
                p_id_str = str(p.get('id'))
                if p_id_str == active_id_str:
                    return p
        
        # 2. Fallback to the main 'position' object if it matches the current view
        # or just return the first one as default
        fallback = data.get('position') or (pos_details[0] if pos_details else None)
        return fallback

    def get_active_position_identifiers(self):
        """Returns a list of all identifiers (numeric ID and string code) for the active position."""
        ids = []
        if self.active_position_id:
            active_id_str = str(self.active_position_id)
            ids.append(active_id_str)
            
            # 1. Try to get identifiers from the current profile data
            pos = self.get_current_position()
            if pos:
                code = str(pos.get('code') or '').strip()
                if code and code not in ids:
                    ids.append(code)
                name = str(pos.get('name') or '').strip()
                if name and name not in ids:
                    ids.append(name)
            
            # 2. Also check the main position object in case codes/names are there
            data = self._get_api_data()
            if data:
                main_pos = data.get('position')
                if main_pos and str(main_pos.get('id')) == active_id_str:
                    code = str(main_pos.get('code') or '').strip()
                    if code and code not in ids:
                        ids.append(code)
                    name = str(main_pos.get('name') or '').strip()
                    if name and name not in ids:
                        ids.append(name)
            
            # 2. Fallback to global employee cache if code is missing from profile data
            # The profile detail API often lacks the 'code' field, but the global list has it.
            from django.core.cache import cache
            try:
                user_pos_map = cache.get('user_position_identifiers')
                if user_pos_map and self.employee_id in user_pos_map:
                    extra_ids = user_pos_map[self.employee_id].get(active_id_str)
                    if extra_ids:
                        for eid in extra_ids:
                            if eid and str(eid) not in ids:
                                ids.append(str(eid))
            except Exception:
                pass # Fail silently, stick with what we have
                    
        return ids

    def get_available_positions(self, force_fresh=False):
        """Returns a list of all positions the user holds."""
        data = self._get_api_data(force_fresh=force_fresh)
        if not data: return []
        return data.get('positions_details', [])

class Session(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    token = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    logged_out_at = models.DateTimeField(null=True, blank=True)
    last_activity = models.DateTimeField(default=timezone.now)

    def is_valid(self):
        return self.is_active and self.expires_at > timezone.now()





class LoginHistory(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_history')
    login_time = models.DateTimeField(auto_now_add=True)
    logout_time = models.DateTimeField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    device_type = models.CharField(max_length=50, default='Web')
    browser_type = models.CharField(max_length=50, default='Chrome')
    status = models.CharField(max_length=20, default='Success')
    failure_reason = models.TextField(null=True, blank=True, default='')

    class Meta:
        verbose_name_plural = "Login History"
        ordering = ['-login_time']

    def __str__(self):
        return f"{self.user} - {self.login_time}"

class AuditLog(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=50)
    model_name = models.CharField(max_length=100)
    object_id = models.CharField(max_length=100, null=True, blank=True)
    object_repr = models.CharField(max_length=255, null=True, blank=True)
    details = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-timestamp']


class AttendanceFRS(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='frs_attendance')
    photo_captured = models.TextField() # Stored as base64 in DB
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    is_matched = models.BooleanField(default=False)
    match_score = models.FloatField(default=0.0)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    location_address = models.TextField(blank=True, null=True)
    hierarchy_level = models.IntegerField(default=1) # 1: Reporting Manager, 2: Senior Manager, etc.
    status = models.CharField(max_length=20, default='Recorded') # Pending, Approved, Rejected
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"FRS {self.user.name} at {self.timestamp}"

    class Meta:
        ordering = ['-timestamp']

class FaceRegistrationRequest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='face_registration_requests')
    reporting_manager = models.ForeignKey(User, on_delete=models.CASCADE, related_name='managed_face_registrations')
    face_encoding = models.TextField()
    face_photo = models.TextField(null=True, blank=True) # Stored as base64 in DB
    status = models.CharField(max_length=20, default='Pending') # Pending, Approved, Rejected
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Face Registration Request from {self.user.name}"

    class Meta:
        ordering = ['-created_at']

class PhotoUpdateRequest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='photo_update_requests')
    reason = models.TextField()
    status = models.CharField(max_length=20, default='Pending') # Pending, Approved, Rejected
    created_at = models.DateTimeField(auto_now_add=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='decided_photo_updates')
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return f"Photo Update Request from {self.user.name}"

    class Meta:
        ordering = ['-created_at']

class AppVersion(models.Model):
    latest_version = models.CharField(max_length=50)
    minimum_supported_version = models.CharField(max_length=50)
    update_type = models.CharField(max_length=20, choices=[('optional', 'Optional'), ('force', 'Force')])
    message = models.TextField()
    update_url = models.URLField(max_length=500)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Version {self.latest_version} ({self.update_type})"

    class Meta:
        ordering = ['-updated_at']

class ReportAccessControl(models.Model):
    ACCESS_TYPE_CHOICES = [
        ('employee', 'Specific Employee'),
        ('position', 'Specific Position'),
    ]
    access_type = models.CharField(max_length=20, choices=ACCESS_TYPE_CHOICES)
    target_id = models.CharField(max_length=100)
    target_name = models.CharField(max_length=255, blank=True, null=True)
    can_view_reports = models.BooleanField(default=True)
    
    # Extra fields for total details
    employee_code = models.CharField(max_length=100, blank=True, null=True)
    employee_name = models.CharField(max_length=255, blank=True, null=True)
    position_code = models.CharField(max_length=100, blank=True, null=True)
    position_name = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Report Access Control'
        verbose_name_plural = 'Report Access Controls'
        unique_together = ('access_type', 'target_id')

    def __str__(self):
        return f"{self.access_type} - {self.target_name} ({self.target_id})"




