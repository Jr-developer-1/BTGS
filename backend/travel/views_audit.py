from rest_framework import viewsets, permissions, filters
from core.models import LoginHistory, AuditLog
from .serializers import LoginHistorySerializer, AuditLogSerializer
from django_filters.rest_framework import DjangoFilterBackend
from core.permissions import IsCustomAuthenticated, IsAdmin

class LoginHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoginHistory.objects.all().select_related('user')
    serializer_class = LoginHistorySerializer
    permission_classes = [IsCustomAuthenticated] 
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['user', 'ip_address']
    search_fields = ['user__employee_id', 'user__email', 'ip_address']
    ordering_fields = ['login_time', 'logout_time']
    ordering = ['-login_time']

    def get_queryset(self):
        user = getattr(self.request, 'custom_user', None) or self.request.user
        
        if not user or (hasattr(user, 'is_authenticated') and not user.is_authenticated):
             if not getattr(self.request, 'custom_user', None):
                 return LoginHistory.objects.none()

        role_name = ''
        if hasattr(user, 'active_role'):
            role_name = user.active_role.lower()
            
        if role_name in ['admin', 'cfo', 'hr', 'finance']:
             return LoginHistory.objects.all().select_related('user')
        return LoginHistory.objects.filter(user=user).select_related('user')

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('user')
    serializer_class = AuditLogSerializer
    permission_classes = [IsCustomAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['user', 'action', 'model_name']
    search_fields = ['user__employee_id', 'user__email', 'object_repr', 'details']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = getattr(self.request, 'custom_user', None) or self.request.user
        
        if not user or (hasattr(user, 'is_authenticated') and not user.is_authenticated):
             if not getattr(self.request, 'custom_user', None):
                 return AuditLog.objects.none()

        role_name = ''
        if hasattr(user, 'active_role'):
            role_name = user.active_role.lower()

        if role_name in ['admin', 'cfo', 'finance']:
             return AuditLog.objects.all().select_related('user')
        return AuditLog.objects.filter(user=user).select_related('user')
