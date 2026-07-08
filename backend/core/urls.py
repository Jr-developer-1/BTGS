from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import login_view, logout_view, me_view, switch_position_view, LoginHistoryViewSet, AuditLogViewSet, RoleViewSet, ReportAccessControlViewSet, profile_view, AuditLogView, LoginHistoryView, enroll_face_view, verify_face_view, get_face_registration_requests_view, handle_face_registration_request_view, get_pending_frs_approvals_view, handle_frs_approval_view, clear_frs_notifications_view, request_photo_update_view, get_photo_update_requests_view, handle_photo_update_request_view, health_check, heartbeat_view, update_theme_view, app_version_view, change_password_view, request_otp_view, reset_password_otp_view, user_documents_view, set_security_pin_view, verify_security_pin_view, has_security_pin_view

app_name = 'core'

router = DefaultRouter()



router.register(r'login-history', LoginHistoryViewSet, basename='login-history')
router.register(r'audit-logs', AuditLogViewSet, basename='audit-logs')
router.register(r'roles', RoleViewSet, basename='roles')
router.register(r'report-access', ReportAccessControlViewSet, basename='report-access')

urlpatterns = [
    path('auth/login', login_view, name='login'),
    path('health', health_check, name='health-check'),
    path('heartbeat', heartbeat_view, name='heartbeat'),
    path('auth/logout', logout_view, name='logout'),
    path('auth/me', me_view, name='me'),
    path('auth/profile', profile_view, name='profile'),
    path('auth/change-password', change_password_view, name='change-password'),
    path('auth/request-otp', request_otp_view, name='request-otp'),
    path('auth/reset-password-otp', reset_password_otp_view, name='reset-password-otp'),
    path('auth/update-theme', update_theme_view, name='update-theme'),
    path('auth/switch-position', switch_position_view, name='switch-position'),
    path('auth/set-pin', set_security_pin_view, name='set-security-pin'),
    path('auth/verify-pin', verify_security_pin_view, name='verify-security-pin'),
    path('auth/has-pin', has_security_pin_view, name='has-security-pin'),
    path('audit-history', AuditLogView.as_view(), name='audit-history'),
    path('session-history', LoginHistoryView.as_view(), name='session-history'),
    
    path('app-version', app_version_view, name='app-version'),

    # FRS Endpoints
    path('frs/enroll', enroll_face_view, name='frs-enroll'),
    path('frs/verify', verify_face_view, name='frs-verify'),
    path('frs/face-requests', get_face_registration_requests_view, name='get-face-requests'),
    path('frs/handle-face-request', handle_face_registration_request_view, name='handle-face-request'),
    path('frs/approvals', get_pending_frs_approvals_view, name='frs-approvals'),
    path('frs/handle-approval', handle_frs_approval_view, name='handle-approval'),
    path('frs/clear-notifications', clear_frs_notifications_view, name='frs-clear-notifications'),
    path('frs/request-update', request_photo_update_view, name='request-photo-update'),
    path('frs/update-requests', get_photo_update_requests_view, name='get-photo-update-requests'),
    path('frs/handle-request', handle_photo_update_request_view, name='handle-photo-update-request'),
    path('auth/documents', user_documents_view, name='user-documents'),
    
    path('', include(router.urls)),
]

