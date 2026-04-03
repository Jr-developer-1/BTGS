from rest_framework import serializers
from .models import User, Role, Session, AuditLog, LoginHistory

class UserSerializer(serializers.ModelSerializer):
    role = serializers.StringRelatedField()
    class Meta:
        model = User
        fields = ['id', 'name', 'employee_id', 'role', 'designation', 'department', 
                  'is_face_enrolled', 'face_photo', 'allow_photo_reset', 'theme']

class SessionSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    
    class Meta:
        model = Session
        fields = ['id', 'user_name', 'user_email', 'ip_address', 'created_at', 'expires_at', 'logged_out_at', 'is_active']



class LoginHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')
    user_email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = LoginHistory
        fields = ['id', 'user', 'user_name', 'user_email', 'login_time', 'logout_time', 'ip_address', 'user_agent', 'device_type', 'browser_type', 'status', 'failure_reason']

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.name', read_only=True)
    
    class Meta:
        model = AuditLog
        fields = ['id', 'user_name', 'action', 'model_name', 'object_repr', 'details', 'ip_address', 'timestamp']

from .models import AppVersion

class AppVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppVersion
        fields = '__all__'
