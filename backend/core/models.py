from django.db import models
from django.utils import timezone

class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    
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

    def _get_api_data(self):
        # 0. Check if we should skip external API for performance (Pure DB Mode)
        from .middleware import should_skip_external_api
        if should_skip_external_api():
            return None

        # 1. Guard for literal static system accounts by ID
        # Only skip the API for the specific local-only management identities
        lower_id = self.employee_id.lower()
        static_system_ids = ['admin', 'admin001', 'hr', 'guesthousemanager', 'finance', 'cfo']
        if lower_id in static_system_ids:
             return None
             
        from api_management.services import get_dynamic_employee_data
        return get_dynamic_employee_data(self.employee_id)

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
    def name(self):
        # 1. Hardcoded ID check (fastest)
        lower_id = self.employee_id.lower()
        if lower_id in ['admin', 'admin001']: return 'System Administrator'
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
        if lower_id in ['admin', 'hr', 'guesthousemanager', 'finance', 'cfo']:
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
        if lower_id == 'admin': return 'Administrator'
        if lower_id == 'guesthousemanager': return 'Facility Manager'
        if lower_id == 'hr': return 'HR Head'
        data = self._get_api_data()
        return data.get('position', {}).get('name', '') if data else ''

    @property
    def department(self):
        lower_id = self.employee_id.lower()
        if lower_id in ['admin', 'hr', 'guesthousemanager', 'finance', 'cfo']:
             return 'Management'
        data = self._get_api_data()
        return data.get('position', {}).get('department') or 'N/A' if data else 'N/A'

    @property
    def section(self):
        data = self._get_api_data()
        return data.get('position', {}).get('section') or 'N/A' if data else 'N/A'

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
        data = self._get_api_data()
        return data.get('position', {}).get('level_rank', 10) if data else 10

    @property
    def bank_name(self):
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {})
        return bank_info.get('bank_name', '')

    @property
    def account_no(self):
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {})
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
        bank_info = data.get('bank_details', {})
        return str(bank_info.get('account_no') or '')

    @property
    def ifsc_code(self):
        data = self._get_api_data()
        if not data: return ''
        bank_info = data.get('bank_details', {})
        return bank_info.get('ifsc_code', '')

    def _get_hierarchy_manager(self, index):
        """Helper to resolve a manager from the API hierarchy at a specific depth."""
        data = self._get_api_data()
        if not data: return None
        # Support both 'position' (current) and 'positions_details' (legacy)
        pos = data.get('position') or (data.get('positions_details', [{}])[0])
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
            from api_management.services import resolve_hr_id_to_code
            from api_management.models import SystemConfig
            from api_management.utils import decrypt_key
            try:
                if SystemConfig.objects.filter(key='external_api_url').exists() and SystemConfig.objects.filter(key='external_api_key').exists():
                    v_url = SystemConfig.objects.get(key='external_api_url').value
                    v_key = decrypt_key(SystemConfig.objects.get(key='external_api_key').value)
                    v_headers = {"X-Api-Key": v_key, "Accept": "application/json"}
                    resolved = resolve_hr_id_to_code(emp_code, v_url, v_headers)
                    if resolved:
                        emp_code = resolved
            except Exception as e:
                print(f"HR fallback resolution failed for {emp_code}: {e}")
            
        return self._get_or_create_shell_user(str(emp_code)) if emp_code else None

    @property
    def reporting_manager(self):
        return self._get_hierarchy_manager(0)

    @property
    def senior_manager(self):
        return self._get_hierarchy_manager(1)

    @property
    def hod_director(self):
        return self._get_hierarchy_manager(2)

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



