from rest_framework import serializers
from .models import User, Role, Session, AuditLog, LoginHistory
from django.db.models import Q

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions']

class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    role_permissions = serializers.SerializerMethodField()
    available_positions = serializers.SerializerMethodField()
    
    def get_role_permissions(self, obj):
        if not obj.role:
            return {}
        
        # Priority: Role from API > Designation from API > Default local role
        role_from_api = obj.role_from_api
        designation = obj.designation
        
        matching_role = Role.objects.filter(Q(name__iexact=role_from_api) | Q(name__iexact=designation)).first()
        if matching_role:
            return matching_role.permissions
        return obj.role.permissions

    def get_available_positions(self, obj):
        return obj.get_available_positions()

    class Meta:
        model = User
        fields = ['id', 'name', 'employee_id', 'role_name', 'role_permissions', 'designation', 'department', 
                  'is_face_enrolled', 'face_photo', 'allow_photo_reset', 'theme', 'carry_forward_balance',
                  'active_position_id', 'available_positions']

class SessionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Session
        fields = ['id', 'user_name', 'user_email', 'ip_address', 'created_at', 'expires_at', 'logged_out_at', 'is_active']



class LoginHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')
    user_email = serializers.ReadOnlyField(source='user.email')
    user_employee_id = serializers.ReadOnlyField(source='user.employee_id')
    user_designation = serializers.SerializerMethodField()
    user_position_code = serializers.SerializerMethodField()

    def get_user_designation(self, obj):
        try:
            return obj.user.designation or ''
        except Exception:
            return ''

    def get_user_position_code(self, obj):
        try:
            pos = obj.user.get_current_position()
            return pos.get('code', '') if pos else ''
        except Exception:
            return ''

    class Meta:
        model = LoginHistory
        fields = [
            'id', 'user', 'user_name', 'user_email', 'user_employee_id',
            'user_designation', 'user_position_code',
            'login_time', 'logout_time', 'ip_address', 'user_agent',
            'device_type', 'browser_type', 'status', 'failure_reason'
        ]

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ['id', 'user_name', 'action', 'model_name', 'object_repr', 'details', 'ip_address', 'timestamp']

from .models import AppVersion, ReportAccessControl

class AppVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppVersion
        fields = '__all__'

class ReportAccessControlSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReportAccessControl
        fields = '__all__'

