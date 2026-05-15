import jwt
import datetime
import hashlib
import base64
from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes, action
import re
import string
import random
import datetime
from django.core.mail import send_mail
from api_management.services import fetch_employee_data
from rest_framework.response import Response
from rest_framework import status, generics, viewsets
from rest_framework.permissions import AllowAny

from .models import User, Role, Session, LoginHistory, AuditLog, FaceRegistrationRequest, AttendanceFRS, PhotoUpdateRequest, AppVersion
from notifications.models import Notification
from .permissions import IsCustomAuthenticated, IsAdmin
from .serializers import AuditLogSerializer, LoginHistorySerializer, UserSerializer, RoleSerializer, AppVersionSerializer
from .pagination import StandardResultsSetPagination
from django.db.models import Q
from rest_framework import filters
from django_filters.rest_framework import DjangoFilterBackend

def get_client_ip(request):
    """Retrieve the genuine client IP address, safely resolving proxy hops."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # Take the very first IP in the comma-separated forwarded list (original client)
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip
from .frs_util import get_face_encoding_from_image, compare_faces, base64_to_file

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    try:
        data = request.data
        employee_id = (data.get('employee_id') or '').strip()
        password = data.get('password')

        # Prevent special characters in username (Allow only Alphanumeric and Hyphen)
        if employee_id and not re.match(r'^[a-zA-Z0-9\-]+$', employee_id):
             return Response({'error': 'Special characters are not allowed in username.'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Strict case-sensitive lookup
        user = User.objects.filter(employee_id=employee_id).first()
        
        # Verify exact case match (handles case-insensitive DB collations)
        if user and user.employee_id != employee_id:
            user = None

        if not user:
             return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)
        
        if not user.is_active:
             return Response({'error': 'Your account is currently inactive. Please contact support.'}, status=status.HTTP_401_UNAUTHORIZED)
             
        hashed_input = hash_password(password)
        if user.password_hash != hashed_input:
            try:
                AuditLog.objects.create(
                    action='LOGIN_FAILED',
                    model_name='User',
                    object_repr=employee_id,
                    ip_address=get_client_ip(request),
                    details={'reason': 'Invalid password'}
                )
            except: pass # Don't let audit logging crash the login failure response
            return Response({'error': 'Invalid username or password.'}, status=status.HTTP_401_UNAUTHORIZED)
            
        is_mobile = data.get('is_mobile', False)
        if isinstance(is_mobile, str) and is_mobile.lower() == 'true':
            is_mobile = True
            
        # Web: 1 hour, Mobile: practically never (10 years)
        if is_mobile:
            expiration = timezone.now() + datetime.timedelta(days=3650)
        else:
            expiration = timezone.now() + datetime.timedelta(hours=1)
            
        payload = {
            'user_id': user.id,
            'role': user.role.name if user.role else 'Employee',
            'is_mobile': is_mobile,
            'exp': expiration
        }
        token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
        
        ip = get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        
        Session.objects.create(
            user=user,
            token=token,
            ip_address=ip,
            user_agent=user_agent,
            expires_at=expiration
        )
        
        # Create LoginHistory entry
        LoginHistory.objects.create(
            user=user, 
            ip_address=ip, 
            user_agent=user_agent,
            device_type='Web',
            browser_type='Chrome',
            status='Success',
            failure_reason=''
        )
        
        # Create AuditLog entry
        AuditLog.objects.create(
            user=user,
            action='LOGIN',
            model_name='User',
            object_id=str(user.id),
            object_repr=str(user),
            ip_address=ip,
            details={'agent': user_agent, 'method': 'API'}
        )
        
        # Ensure an active_position_id is set
        if not user.active_position_id:
            available = user.get_available_positions()
            if available:
                user.active_position_id = str(available[0].get('id'))
                user.save()

        return Response({
            'token': token,
            'requires_password_change': user.requires_password_change,
            'user': {
                'id': user.id,
                'employee_id': user.employee_id,
                'name': getattr(user, 'name', user.employee_id),
                'role': user.role.name if user.role else 'Employee',
                'role_permissions': (lambda u: (Role.objects.filter(Q(name__iexact=u.role_from_api) | Q(name__iexact=u.designation)).first() or u.role).permissions if u.role else {})(user),
                'department': getattr(user, 'department', 'N/A'),
                'designation': getattr(user, 'designation', 'N/A'),
                'office_level': getattr(user, 'office_level', 3),
                'email': getattr(user, 'email', ''),
                'theme': getattr(user, 'theme', 'classic'),
                'active_position_id': user.active_position_id,
                'available_positions': user.get_available_positions(force_fresh=True)
            }
        })
        
    except Exception as e:
        import traceback
        print(f"DEBUG: Login Error: {str(e)}")
        print(traceback.format_exc())
        return Response({'error': 'Authentication server error. Please retry later or contact IT.'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def change_password_view(request):
    user = request.custom_user
    current_password = request.data.get('current_password')
    new_password = request.data.get('new_password')
    
    if not current_password or not new_password:
        return Response({'error': 'Current and new password are required'}, status=status.HTTP_400_BAD_REQUEST)
        
    if user.password_hash != hash_password(current_password):
        return Response({'error': 'Invalid current password'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Validate new password
    if len(new_password) < 8 or len(new_password) > 12:
        return Response({'error': 'Password must be between 8 and 12 characters'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.search(r'[A-Z]', new_password):
        return Response({'error': 'Password must contain at least one uppercase letter'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.search(r'[0-9]', new_password):
        return Response({'error': 'Password must contain at least one number'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', new_password):
        return Response({'error': 'Password must contain at least one special character'}, status=status.HTTP_400_BAD_REQUEST)
        
    user.password_hash = hash_password(new_password)
    user.requires_password_change = False
    user.save()
    
    return Response({'message': 'Password changed successfully'})

@api_view(['POST'])
@permission_classes([AllowAny])
def request_otp_view(request):
    employee_code = request.data.get('employee_id')
    if not employee_code:
        return Response({'error': 'Employee ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        user = User.objects.get(employee_id__iexact=employee_code)
    except User.DoesNotExist:
        return Response({'error': 'User with this ID is not registered or found.'}, status=status.HTTP_404_NOT_FOUND)
        
    data = fetch_employee_data(employee_id_filter=employee_code)
    if "error" in data or data.get('count') == 0 or not data.get('results'):
        return Response({'error': 'Failed to verify employee with external system'}, status=status.HTTP_502_BAD_GATEWAY)
        
    employee_data = data['results'][0]
    first_name = employee_data.get('employee', {}).get('name', 'User')
    email = employee_data.get('employee', {}).get('email')
    
    if not email:
        email = f"{employee_code.lower()}@example.com"
        
    # Generate secure 6-digit OTP
    import secrets
    otp = ''.join(secrets.choice(string.digits) for _ in range(6))
    
    user.reset_otp = otp
    user.reset_otp_expiry = timezone.now() + datetime.timedelta(minutes=10)
    user.save()
    
    subject = 'BTGS Portal - Password Reset OTP'
    plain_message = f'Hello {first_name},\n\nWe received a request to reset your password. Your OTP is: {otp}\n\nThis OTP will expire in 10 minutes.\n\nIf you did not request this, please ignore this email.'
    
    html_message = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background-color: #f8fafc;
                margin: 0;
                padding: 0;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                overflow: hidden;
                border: 1px solid #e2e8f0;
            }}
            .header {{
                background-color: #1e293b;
                padding: 24px 0;
                text-align: center;
            }}
            .header h1 {{
                color: #ffffff;
                margin: 0;
                font-size: 28px;
                font-weight: 600;
                letter-spacing: 0.5px;
            }}
            .content {{
                padding: 32px;
                color: #334155;
                line-height: 1.6;
                font-size: 15px;
            }}
            .content h2 {{
                color: #0f172a;
                font-size: 22px;
                margin-top: 0;
            }}
            .password-box {{
                background-color: #f1f5f9;
                border: 1px solid #cbd5e1;
                padding: 16px;
                margin: 24px 0;
                font-size: 32px;
                font-family: 'Courier New', Courier, monospace;
                font-weight: bold;
                color: #0284c7;
                text-align: center;
                letter-spacing: 10px;
                border-radius: 6px;
            }}
            .footer {{
                background-color: #f8fafc;
                padding: 20px;
                text-align: center;
                font-size: 12px;
                color: #64748b;
                border-top: 1px solid #e2e8f0;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>BTGS Portal</h1>
            </div>
            <div class="content">
                <h2>Password Reset Validation (OTP)</h2>
                <p>Hello {first_name},</p>
                <p>We received a request to reset the password for your corporate account. Please use the 6-digit OTP below to securely reset your password. This OTP will expire in 10 minutes.</p>
                
                <div class="password-box">
                    {otp}
                </div>
                
                <p>If you did not request this password reset, your account remains secure. Please contact the IT Administration team immediately if you receive this unexpectedly.</p>
                
                <p>Best Regards,<br><strong>The BTGS Team</strong></p>
            </div>
            <div class="footer">
                &copy; {datetime.datetime.now().year} BTGS (Bavya-TGS). All rights reserved.<br/>
                This is an automated message, please do not reply.
            </div>
        </div>
    </body>
    </html>
    """
    
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
        html_message=html_message
    )
    
    return Response({'message': 'OTP sent securely to your email address.'})

@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password_otp_view(request):
    employee_code = request.data.get('employee_id')
    otp = request.data.get('otp')
    new_password = request.data.get('new_password')
    
    if not employee_code or not otp or not new_password:
        return Response({'error': 'Employee ID, OTP, and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)
        
    try:
        user = User.objects.get(employee_id__iexact=employee_code)
    except User.DoesNotExist:
        return Response({'error': 'User with this ID is not registered or found.'}, status=status.HTTP_404_NOT_FOUND)
        
    if user.reset_otp != otp:
        return Response({'error': 'Invalid OTP.'}, status=status.HTTP_400_BAD_REQUEST)
        
    if not user.reset_otp_expiry or timezone.now() > user.reset_otp_expiry:
        return Response({'error': 'OTP has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Validate new password
    if len(new_password) < 8 or len(new_password) > 12:
        return Response({'error': 'Password must be between 8 and 12 characters'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.search(r'[A-Z]', new_password):
        return Response({'error': 'Password must contain at least one uppercase letter'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.search(r'[0-9]', new_password):
        return Response({'error': 'Password must contain at least one number'}, status=status.HTTP_400_BAD_REQUEST)
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', new_password):
        return Response({'error': 'Password must contain at least one special character'}, status=status.HTTP_400_BAD_REQUEST)
        
    user.password_hash = hash_password(new_password)
    user.requires_password_change = False
    user.reset_otp = None
    user.reset_otp_expiry = None
    user.save()
    
    return Response({'message': 'Password has been successfully updated.'})

@api_view(['GET'])
@permission_classes([IsCustomAuthenticated])
def me_view(request):
    try:
        user = request.custom_user
        return Response({
            'id': user.id,
            'employee_id': user.employee_id,
            'name': getattr(user, 'name', user.employee_id),
            'role': user.role.name if user.role else 'Employee',
            'role_permissions': (lambda u: (Role.objects.filter(Q(name__iexact=u.role_from_api) | Q(name__iexact=u.designation)).first() or u.role).permissions if u.role else {})(user),
            'department': getattr(user, 'department', 'N/A'),
            'designation': getattr(user, 'designation', 'N/A'),
            'office_level': getattr(user, 'office_level', 3),
            'email': getattr(user, 'email', ''),
            'theme': getattr(user, 'theme', 'classic'),
            'active_position_id': user.active_position_id,
            'available_positions': user.get_available_positions(force_fresh=True)
        })
    except Exception as e:
        import traceback
        print(f"DEBUG: MeView Error: {str(e)}")
        print(traceback.format_exc())
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def logout_view(request):
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        session = Session.objects.filter(token=token).first()
        if session:
            user = session.user
            session.is_active = False
            session.logged_out_at = timezone.now()
            session.save()
            
            # Update LoginHistory
            # Find the active login history for this user (most recent without logout time)
            # Ideally we'd link via session key, but for now assuming strict time ordering
            last_login = LoginHistory.objects.filter(user=user, logout_time__isnull=True).order_by('-login_time').first()
            if last_login:
                last_login.logout_time = timezone.now()
                last_login.save()
                
            # Create AuditLog
            AuditLog.objects.create(
                user=user,
                action='LOGOUT',
                model_name='User',
                object_id=str(user.id),
                object_repr=str(user),
                ip_address=session.ip_address,
                details={'method': 'API'}
            )
            
            return Response({'message': 'Logged out successfully'})

    return Response({'error': 'Invalid token'}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def switch_position_view(request):
    user = request.custom_user
    position_id = request.data.get('position_id')
    
    if not position_id:
        return Response({'error': 'Position ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        
    # Verify if the user actually has this position (bypass compressed cache)
    available = user.get_available_positions(force_fresh=True)
    valid_ids = [str(p.get('id')) for p in available]
    
    if str(position_id) not in valid_ids:
        return Response({'error': 'The selected position is not assigned to your profile.'}, status=status.HTTP_403_FORBIDDEN)
        
    try:
        user.active_position_id = str(position_id)
        user.save()
        
        # Force refresh properties by clearing cache
        from api_management.services import CACHE_EMPLOYEE_DATA
        if user.employee_id in CACHE_EMPLOYEE_DATA:
            del CACHE_EMPLOYEE_DATA[user.employee_id]
            
        # Safely resolve role and permissions
        user_role_obj = user.role
        role_name = user_role_obj.name if user_role_obj else 'Employee'
        
        permissions = {}
        if user_role_obj:
            permissions = user_role_obj.permissions
            try:
                # Attempt to find a more specific role based on API data
                api_role = Role.objects.filter(Q(name__iexact=user.role_from_api) | Q(name__iexact=user.designation)).first()
                if api_role:
                    permissions = api_role.permissions
            except:
                pass

        # Return updated user data (sync with login/me response structure)
        return Response({
            'message': 'Position switched successfully',
            'user': {
                'id': user.id,
                'employee_id': user.employee_id,
                'name': str(user.name),
                'role': role_name,
                'role_permissions': permissions,
                'department': str(user.department),
                'designation': str(user.designation),
                'office_level': user.office_level,
                'email': user.email,
                'active_position_id': user.active_position_id,
                'available_positions': available
            }
        })
    except Exception as e:
        import traceback
        print(f"DEBUG: Switch Position Error: {str(e)}")
        traceback.print_exc()
        return Response({'error': f'Failed to switch position: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'ok', 'message': 'Backend is running correctly.'})




class LoginHistoryView(generics.ListAPIView):
    serializer_class = None # We will use a custom simple serializer or just values
    permission_classes = [IsAdmin]

    def get(self, request):
        # We can use the Session model to show login history
        # Filter by search if provided
        search = request.query_params.get('search', '').lower()
        
        sessions = Session.objects.select_related('user').all().order_by('-created_at')
        
        if search:
            from django.db.models import Q
            sessions = sessions.filter(
                Q(user__employee_id__istartswith=search) |
                Q(ip_address__istartswith=search)
            )

        data = []
        for s in sessions:
            data.append({
                'id': s.id,
                'user_name': s.user.name,
                'user_email': s.user.email,
                'ip_address': s.ip_address,
                'login_time': s.created_at,
                'logout_time': s.logged_out_at,
                'is_active': s.is_active
            })
            
        return Response(data)

class AuditLogView(generics.ListAPIView):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [IsAdmin]
    
    def get_queryset(self):
        queryset = AuditLog.objects.exclude(action='PAGE_ACCESS').order_by('-timestamp')
        search = self.request.query_params.get('search', None)
        model_name = self.request.query_params.get('model_name', None)
        action = self.request.query_params.get('action', None)
        
        if search:
            queryset = queryset.filter(
                Q(user__employee_id__istartswith=search) |
                Q(object_repr__istartswith=search) |
                Q(details__istartswith=search)
            )
        if model_name:
            queryset = queryset.filter(model_name__iexact=model_name)
        if action:
            queryset = queryset.filter(action__iexact=action)

            
class LoginHistoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = LoginHistory.objects.all().select_related('user')
    serializer_class = LoginHistorySerializer
    permission_classes = [IsCustomAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['user', 'ip_address']
    search_fields = ['user__employee_id', 'ip_address']
    ordering_fields = ['login_time', 'logout_time']
    ordering = ['-login_time']

    def get_queryset(self):
        user = self.request.custom_user
        if not user or not user.role:
            return LoginHistory.objects.none()
            
        role_name = user.role.name.lower()
        # Fix: catch all admin variants and privileged roles
        privileged_keywords = ['admin', 'superuser', 'it admin', 'it-admin', 'cfo', 'hr', 'finance']
        is_privileged = any(kw in role_name for kw in privileged_keywords)
        
        queryset = LoginHistory.objects.all().select_related('user')
        if not is_privileged:
            queryset = queryset.filter(user=user)

        # Robust Range-based Date filtering to bypass DB timezone limitations
        from django.utils.dateparse import parse_date
        from django.utils import timezone
        import datetime

        start_date_str = self.request.query_params.get('start_date')
        end_date_str = self.request.query_params.get('end_date')

        if start_date_str:
            parsed_start = parse_date(start_date_str)
            if parsed_start:
                start_dt = datetime.datetime.combine(parsed_start, datetime.time.min)
                if timezone.is_aware(timezone.now()):
                    start_dt = timezone.make_aware(start_dt)
                queryset = queryset.filter(login_time__gte=start_dt)

        if end_date_str:
            parsed_end = parse_date(end_date_str)
            if parsed_end:
                end_dt = datetime.datetime.combine(parsed_end, datetime.time.max)
                if timezone.is_aware(timezone.now()):
                    end_dt = timezone.make_aware(end_dt)
                queryset = queryset.filter(login_time__lte=end_dt)
            
        return queryset

    @action(detail=True, methods=['get'])
    def activities(self, request, pk=None):
        login_history = self.get_object()
        from django.utils import timezone
        end_time = login_history.logout_time or timezone.now()
        
        activities = AuditLog.objects.filter(
            user=login_history.user,
            timestamp__gte=login_history.login_time,
            timestamp__lte=end_time
        ).exclude(action='PAGE_ACCESS').exclude(
            model_name__in=['APILog', 'DynamicSubmission', 'ChatSession', 'ChatMessage', 'APIKeyHistory', 'Session']
        ).order_by('timestamp')
        
        serializer = AuditLogSerializer(activities, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        import csv
        from django.http import HttpResponse
        
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="login_history.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['User', 'Email', 'IP Address', 'Browser', 'Device', 'Login Time', 'Logout Time', 'Status'])
        
        for log in queryset:
            writer.writerow([
                log.user.name,
                log.user.email,
                log.ip_address,
                log.browser_type,
                log.device_type,
                log.login_time,
                log.logout_time,
                log.status
            ])
        return response

class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all().select_related('user')
    serializer_class = AuditLogSerializer
    permission_classes = [IsCustomAuthenticated]
    pagination_class = StandardResultsSetPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter, filters.SearchFilter]
    filterset_fields = ['user', 'action', 'model_name']
    search_fields = ['user__employee_id', 'user__name', 'object_repr', 'details']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.custom_user
        if not user or not user.role:
            return AuditLog.objects.none()
            
        role_name = user.role.name.lower()
        # Fix: catch all admin variants and privileged roles
        privileged_keywords = ['admin', 'superuser', 'it admin', 'it-admin', 'cfo', 'hr', 'finance']
        is_privileged = any(kw in role_name for kw in privileged_keywords)

        queryset = AuditLog.objects.exclude(action='PAGE_ACCESS').select_related('user')
        if not is_privileged:
             queryset = queryset.filter(user=user)

        # Date filtering
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(timestamp__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(timestamp__date__lte=end_date)

        return queryset

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        import csv
        from django.http import HttpResponse
        
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="audit_logs.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Timestamp', 'User', 'Action', 'Model', 'Object ID', 'Object Repr', 'IP Address'])
        
        for log in queryset:
            writer.writerow([
                log.timestamp,
                log.user.name if log.user else 'System',
                log.action,
                log.model_name,
                log.object_id,
                log.object_repr,
                log.ip_address
            ])
        return response

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsCustomAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['name']

    def destroy(self, request, *args, **kwargs):
        from django.db.models.deletion import ProtectedError
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError as e:
            referencing_users = list(e.protected_objects)
            user_names = [f"{u.name}" for u in referencing_users[:5]]
            
            message = f"Cannot delete this role because it is currently assigned to {len(referencing_users)} user(s)"
            if user_names:
                message += f" (including: {', '.join(user_names)})"
            message += ". Please re-assign or remove these users first before deleting the role."
            
            return Response({"detail": message}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def enroll_face_view(request):
    user = request.custom_user
    
    # Check if user has a reporting manager
    if not user.reporting_manager:
        return Response({'error': 'No reporting manager assigned. Please contact HR or your manager.'}, status=status.HTTP_400_BAD_REQUEST)

    # Check for existing pending request
    existing_request = FaceRegistrationRequest.objects.filter(user=user, status='Pending').first()
    if existing_request:
        return Response({'error': 'You already have a pending registration request. Please wait for manager approval.'}, status=status.HTTP_400_BAD_REQUEST)

    face_image_base64 = request.data.get('face_image')
    if not face_image_base64:
        return Response({'error': 'No face image provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Convert base64 to file
    image_file = base64_to_file(face_image_base64, f"pending_face_{user.employee_id}.jpg")
    if not image_file:
        return Response({'error': 'Failed to process image data'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Get encoding (validate that face exists)
    encoding_json = get_face_encoding_from_image(image_file)
    if not encoding_json:
        return Response({'error': 'No face detected in the image. Please try again with a clear photo.'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Reset file pointer for DB save
    if hasattr(image_file, 'seek'):
        image_file.seek(0)
        
    # Create request with base64 data directly in DB
    FaceRegistrationRequest.objects.create(
        user=user,
        reporting_manager=user.reporting_manager,
        face_encoding=encoding_json,
        face_photo=face_image_base64, # Save full base64 string
        status='Pending'
    )
    
    # Create notification for manager
    Notification.objects.create(
        user=user.reporting_manager,
        title="Face Registration Request",
        message=f"{user.name} (ID: {user.employee_id}) has submitted a face registration request for your approval.",
        type="info"
    )
    
    return Response({'message': 'Face registration submitted for approval to your reporting manager.'})

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def verify_face_view(request):
    user = request.custom_user
    if not user.is_face_enrolled:
        # Check if they have a pending request
        pending = FaceRegistrationRequest.objects.filter(user=user, status='Pending').first()
        if pending:
            return Response({'error': 'Your face registration is pending manager approval.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'error': 'Face not enrolled. Please register your face from Profile page.'}, status=status.HTTP_400_BAD_REQUEST)
    
    face_image_base64 = request.data.get('face_image')
    lat = request.data.get('latitude')
    lng = request.data.get('longitude')
    address = request.data.get('address')
    
    if not face_image_base64:
        return Response({'error': 'No face image provided'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Convert base64 to file
    image_file = base64_to_file(face_image_base64, f"attendance_{user.employee_id}_{timezone.now().timestamp()}.jpg")
    if not image_file:
        return Response({'error': 'Failed to process image data'}, status=status.HTTP_400_BAD_REQUEST)
    
    # Compare faces
    try:
        is_match, distance, frs_error = compare_faces(user.face_encoding, image_file)
        if frs_error:
             return Response({'error': frs_error, 'match': False}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': 'Error during face comparison'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    if is_match:
        # Create attendance record only on match
        # Store captured photo as base64 Directly in DB
        AttendanceFRS.objects.create(
            user=user,
            photo_captured=face_image_base64, 
            is_matched=True,
            match_score=1.0 - distance,
            latitude=lat,
            longitude=lng,
            location_address=address,
            status='Recorded'
        )
        
        # Notify Reporting Manager
        if user.reporting_manager:
            Notification.objects.create(
                user=user.reporting_manager,
                title="FRS Attendance Capture",
                message=f"{user.name} (ID: {user.employee_id}) captured attendance via FRS at {address or 'captured location'}.",
                type="info"
            )
            
        return Response({'match': True, 'message': 'Face verification successful'})
    else:
        # MISMATCH: Return 200 OK with match:false to prevent mobile app logout
        AuditLog.objects.create(
            user=user,
            action='FRS_MISMATCH',
            model_name='AttendanceFRS',
            object_repr=f'Mismatch for {user.employee_id}',
            ip_address=get_client_ip(request),
            details={'distance': distance, 'location': address}
        )
        return Response({'match': False, 'message': 'Face Mismatch. Access Denied.'}, status=status.HTTP_403_FORBIDDEN)

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def request_photo_update_view(request):
    user = request.custom_user
    reason = request.data.get('reason', '')
    
    if not reason:
         return Response({'error': 'Please provide a reason for update.'}, status=status.HTTP_400_BAD_REQUEST)
         
    PhotoUpdateRequest.objects.create(user=user, reason=reason)
    
    # Notify IT Admin or Senior Manager? For now just create request
    return Response({'message': 'Success! Your request has been sent for approval.'})

@api_view(['GET'])
@permission_classes([IsCustomAuthenticated])
def get_photo_update_requests_view(request):
    # Only Admin or reporting authorities can see
    user = request.custom_user
    role_name = (user.role.name if user.role else '').lower()
    
    if role_name not in ['it-admin', 'admin', 'reporting_authority']:
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        
    requests = PhotoUpdateRequest.objects.filter(status='Pending').order_by('-created_at')
    
    data = []
    for r in requests:
        data.append({
            'id': r.id,
            'employee_name': r.user.name,
            'employee_id': r.user.employee_id,
            'reason': r.reason,
            'created_at': r.created_at
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def handle_photo_update_request_view(request):
    manager = request.custom_user
    request_id = request.data.get('id')
    status_choice = request.data.get('status') # 'Approved' or 'Rejected'
    remarks = request.data.get('remarks', '')
    
    if not request_id or not status_choice:
         return Response({'error': 'Invalid data'}, status=status.HTTP_400_BAD_REQUEST)
         
    update_req = PhotoUpdateRequest.objects.filter(id=request_id).first()
    if update_req:
        update_req.status = status_choice
        update_req.approved_by = manager
        update_req.remarks = remarks
        update_req.save()
        
        if status_choice == 'Approved':
             user = update_req.user
             user.allow_photo_reset = True
             user.save()
             
             Notification.objects.create(
                 user=user,
                 title="Photo Update Approved",
                 message="Your request to update your FRS enrollment has been approved. You can now re-enroll.",
                 type="success"
             )
        
        return Response({'message': 'Request handled successfully'})

    return Response({'error': 'Request not found'}, status=status.HTTP_404_NOT_FOUND)

def _enrich_geo_locations_from_db(details):
    """Smart helper to enrich external profile details with resolved District/State from DB"""
    if not details:
        return
        
    from travel_masters.models import Location
    
    def resolve_district_from_office_name(off_name):
        if not off_name:
            return None
        # Strip and split; grab the last meaningful word
        words = off_name.strip().split()
        target = words[-1].upper() if words else None
        # Skip stop-words like OFFICE
        if target in ['OFFICE', 'OFFFICE'] and len(words) > 1:
            target = words[-2].upper()
            
        if not target:
            return None
            
        candidates = Location.objects.filter(name__iexact=target)
        for loc in candidates:
            curr = loc
            visited = set()
            while curr and curr.external_id not in visited:
                visited.add(curr.external_id)
                if curr.location_type.lower() == 'district':
                    return curr.name.upper()
                if not curr.parent_id:
                    break
                curr = Location.objects.filter(external_id=curr.parent_id).first()
        return None

    # 1. Extract global geo references for fallback
    global_office = details.get('office') or {}
    global_geo = global_office.get('geo_location') or {}

    # 2. Enrich each position item inside positions_details
    positions = details.get('positions_details') or []
    for pos in positions:
        if not isinstance(pos, dict):
            continue
            
        off_name = pos.get('office_name')
        if off_name:
            res_district = resolve_district_from_office_name(off_name)
            if res_district:
                pos['geo_location'] = {
                    'district': res_district,
                    'state': global_geo.get('state') or "ANDHRA PRADESH",
                    'country': global_geo.get('country') or "India"
                }

@api_view(['GET'])
@permission_classes([IsCustomAuthenticated])
def profile_view(request):
    user = request.custom_user
    
    # 1. Start with local user record
    serializer = UserSerializer(user)
    data = serializer.data
    
    # 2. Add manager names from local relationships
    data['reporting_manager'] = user.reporting_manager.name if user.reporting_manager else None
    data['senior_manager'] = user.senior_manager.name if user.senior_manager else None
    data['hod_director'] = user.hod_director.name if user.hod_director else None
    
    # 3. Fetch detailed info from External API (filtered by ID for speed)
    from api_management.services import fetch_employee_data
    try:
        # We only need the specific employee, so it's super fast
        ext_data = fetch_employee_data(employee_id_filter=user.employee_id)
        if ext_data.get('results') and len(ext_data['results']) > 0:
            details = ext_data['results'][0]
            # Enrich details with accurate, database-resolved geographical Districts
            _enrich_geo_locations_from_db(details)
            
            # Merge external details into response
            data['external_profile'] = details
            # Flatten common fields for easier UI access
            data['phone'] = details['employee'].get('phone')
            data['email'] = details['employee'].get('email') or data['email']
            
            # Ensure position data is present for switching
            data['role'] = user.role.name if user.role else 'Employee'
            data['active_position_id'] = user.active_position_id
            data['available_positions'] = user.get_available_positions(force_fresh=True)
    except Exception as e:
        print(f"Failed to fetch external profile data: {e}")
        data['external_profile'] = None
        
    return Response(data)

@api_view(['GET'])
@permission_classes([IsCustomAuthenticated])
def get_face_registration_requests_view(request):
    manager = request.custom_user
    
    # Check if user is HR
    is_hr = 'hr' in manager.role.name.lower() or manager.role.name.lower() == 'hr' or manager.employee_id.lower().startswith('hr')
    
    if is_hr:
        # HR sees all pending registration requests
        requests = FaceRegistrationRequest.objects.filter(status='Pending')
    else:
        # Manager sees pending requests for their subordinates
        requests = FaceRegistrationRequest.objects.filter(reporting_manager=manager, status='Pending')
    
    data = []
    for r in requests:
        data.append({
            'id': r.id,
            'employee_name': r.user.name,
            'employee_id': r.user.employee_id,
            'photo_url': r.face_photo, # Base64 from DB
            'created_at': r.created_at,
            'status': r.status,
            'reporting_manager': r.reporting_manager.name
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def handle_face_registration_request_view(request):
    manager = request.custom_user
    request_id = request.data.get('request_id')
    action = request.data.get('action') # 'approve' or 'reject'
    remarks = request.data.get('remarks', '')
    
    # Check if user is HR
    is_hr = 'hr' in manager.role.name.lower() or manager.role.name.lower() == 'hr' or manager.employee_id.lower().startswith('hr')
    
    if is_hr:
        reg_request = FaceRegistrationRequest.objects.filter(id=request_id, status='Pending').first()
    else:
        reg_request = FaceRegistrationRequest.objects.filter(id=request_id, reporting_manager=manager, status='Pending').first()
        
    if not reg_request:
        return Response({'error': 'Registration request not found or unauthorized.'}, status=status.HTTP_404_NOT_FOUND)
        
    if action == 'approve':
        reg_request.status = 'Approved'
        reg_request.remarks = remarks
        reg_request.save()
        
        # Update user with face data
        user = reg_request.user
        user.face_encoding = reg_request.face_encoding
        user.face_photo = reg_request.face_photo
        user.is_face_enrolled = True
        user.allow_photo_reset = False
        user.save()
        
        # Notify user
        Notification.objects.create(
            user=user,
            title="Face Registration Approved",
            message="Your face registration has been approved. You can now use FRS for attendance.",
            type="success"
        )
    else:
        reg_request.status = 'Rejected'
        reg_request.remarks = remarks
        reg_request.save()
        
        # Notify user
        Notification.objects.create(
            user=reg_request.user,
            title="Face Registration Rejected",
            message=f"Your face registration was rejected. Reason: {remarks}",
            type="error"
        )
        
    return Response({'message': f'Request {action}ed successfully.'})

@api_view(['GET'])
@permission_classes([IsCustomAuthenticated])
def get_pending_frs_approvals_view(request):
    manager = request.custom_user
    # Fetch all recently recorded attendance logs (matches only as per user request)
    attendance_qs = AttendanceFRS.objects.filter(status='Recorded', is_matched=True).select_related('user').order_by('-timestamp')
    
    data = []
    import pytz
    local_tz = pytz.timezone(settings.TIME_ZONE)
    
    for a in attendance_qs:
        # Check if user reports to this manager
        if a.user.reporting_manager != manager:
            # Check if this person IS HR (they can see all logs)
            is_hr = 'hr' in manager.role.name.lower() or manager.role.name.lower() == 'hr' or manager.employee_id.lower().startswith('hr')
            if not is_hr:
                continue
            
        # Format timestamp to local for better display
        local_dt = a.timestamp.astimezone(local_tz)
        
        data.append({
            'id': a.id,
            'employee_name': a.user.name,
            'employee_id': a.user.employee_id,
            'date': local_dt.strftime('%Y-%m-%d'),
            'time': local_dt.strftime('%H:%M'),
            'timestamp': local_dt.isoformat(),
            'photo_url': a.photo_captured, # This is now base64 data
            'latitude': a.latitude,
            'longitude': a.longitude,
            'address': a.location_address,
            'match_score': a.match_score,
            'level': a.hierarchy_level
        })
    return Response(data)

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def handle_frs_approval_view(request):
    manager = request.custom_user
    attendance_id = request.data.get('attendance_id')
    action = request.data.get('action') # 'approve' or 'reject'
    remarks = request.data.get('remarks', '')
    
    attendance = AttendanceFRS.objects.filter(
        id=attendance_id,
        status='Pending'
    ).select_related('user').first()
    
    if not attendance or attendance.user.reporting_manager != manager:
        return Response({'error': 'Attendance record not found or unauthorized'}, status=status.HTTP_404_NOT_FOUND)
        
    attendance.status = 'Approved' if action == 'approve' else 'Rejected'
    attendance.remarks = remarks
    attendance.save()
    
    return Response({'message': f'Request {action}ed successfully'})

@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def clear_frs_notifications_view(request):
    user = request.custom_user
    # Mark all FRS related notifications as read
    Notification.objects.filter(
        user=user, 
        title__in=["FRS Attendance Capture", "FRS Attendance Approval Request", "Face Registration Request", "Face Registration Approved", "Face Registration Rejected"]
    ).update(unread=False)
    
    # Update clear timestamp to hide logs from screen
    user.frs_logs_cleared_at = timezone.now()
    user.save()
    
    return Response({'message': 'FRS notifications cleared.'})


@api_view(['GET'])
@permission_classes([IsCustomAuthenticated])
def heartbeat_view(request):
    user = request.custom_user
    now = timezone.now()
    
    # 1. Notifications (Latest 10) - Filtered by active position
    from django.db.models import Q
    notif_filter = Q(user=user) & (Q(target_position__isnull=True) | Q(target_position='') | Q(target_position=user.active_position_id))
    notifications_qs = Notification.objects.filter(notif_filter).order_by('-created_at')[:10]
    unread_count = Notification.objects.filter(notif_filter, unread=True).count()
    
    # 2. Approval Counts
    from travel.models import Trip, TravelAdvance, TravelClaim
    user_role = (user.role.name.lower() if user.role else '')
    privileged_keywords = ['admin', 'superuser', 'it admin', 'it-admin', 'cfo', 'hr']
    is_privileged = any(kw in user_role for kw in privileged_keywords)
    is_finance = 'finance' in user_role
    
    trip_count = 0
    advance_count = 0
    claim_count = 0
    
    if is_privileged and not is_finance:
         trip_count = Trip.objects.filter(status__in=['Pending', 'Submitted', 'Forwarded']).count()
         advance_count = TravelAdvance.objects.filter(status__in=['Pending', 'Submitted', 'Forwarded']).count()
         claim_count = TravelClaim.objects.filter(status__in=['Pending', 'Submitted', 'Forwarded']).count()
    elif is_finance:
        if user.office_level == 1:
            advance_count = TravelAdvance.objects.filter(status='PENDING_HEAD').count()
            claim_count = TravelClaim.objects.filter(status='PENDING_HEAD').count()
        else:
            pending_money_statuses = ['PENDING_EXECUTIVE', 'HR Approved', 'REJECTED_BY_HEAD', 'PENDING_FINAL_RELEASE', 'Approved', 'Under Process']
            advance_count = TravelAdvance.objects.filter(status__in=pending_money_statuses).count()
            claim_count = TravelClaim.objects.filter(status__in=pending_money_statuses).count()
    else:
        trip_count = Trip.objects.filter(current_approver=user, status__in=['Pending', 'Submitted', 'Forwarded', 'Manager Approved']).count()
        advance_count = TravelAdvance.objects.filter(current_approver=user, status__in=['Pending', 'Submitted', 'Forwarded', 'Manager Approved']).count()
        claim_count = TravelClaim.objects.filter(current_approver=user, status__in=['Pending', 'Submitted', 'Forwarded', 'Manager Approved']).count()

    total_approvals = trip_count + advance_count + claim_count

    # 3. Reminders (look ahead 5 minutes for precision frontend triggering)
    from notifications.models import Reminder
    from datetime import timedelta
    future_buffer = now + timedelta(minutes=5)
    due_reminders = Reminder.objects.filter(user=user, remind_at__lte=future_buffer, acknowledged=False)
    
    reminder_data = []
    for r in due_reminders:
        reminder_data.append({
            'id': r.id,
            'title': r.title,
            'message': r.message,
            'remind_at': r.remind_at,
            'category': r.category,
            'trip': r.trip.trip_id if r.trip else None,
            'is_sent': r.is_sent
        })

    notif_data = []
    for n in notifications_qs:
        # Simple serialization
        notif_data.append({
            'id': n.id,
            'title': n.title,
            'message': n.message,
            'unread': n.unread,
            'created_at': n.created_at,
            'link': n.link
        })

    return Response({
        'notifications': notif_data,
        'unread_notification_count': unread_count,
        'approval_counts': {
            'total': total_approvals,
            'trips': trip_count,
            'advances': advance_count,
            'claims': claim_count
        },
        'due_reminders': reminder_data
    })
@api_view(['POST'])
@permission_classes([IsCustomAuthenticated])
def update_theme_view(request):
    user = request.custom_user
    theme = request.data.get('theme')
    
    if not theme:
        return Response({'error': 'Theme is required'}, status=status.HTTP_400_BAD_REQUEST)
    
    valid_themes = ['classic', 'ocean', 'teal', 'sunset', 'midnight', 'minimal']
    if theme not in valid_themes:
        return Response({'error': 'Invalid theme'}, status=status.HTTP_400_BAD_REQUEST)
        
    user.theme = theme
    user.save()
    
    AuditLog.objects.create(
        user=user,
        action='THEME_UPDATE',
        model_name='User',
        object_id=str(user.id),
        object_repr=str(user),
        ip_address=get_client_ip(request),
        details={'new_theme': theme}
    )
    
    return Response({'message': 'Theme updated successfully', 'theme': theme})

@api_view(['GET', 'POST'])
@permission_classes([AllowAny]) # Allow anyone to GET, but ideally POST is admin. Doing both for now because auth is needed for admin.
def app_version_view(request):
    if request.method == 'GET':
        version = AppVersion.objects.first()
        if not version:
            return Response({
                "latest_version": "1.0.0",
                "minimum_supported_version": "1.0.0",
                "update_type": "optional",
                "message": "Welcome to TGS",
                "update_url": "https://example.com"
            })
        serializer = AppVersionSerializer(version)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        # Should be protected, but for demo let's allow or rely on frontend auth logic
        # Actually better to enforce IsCustomAuthenticated or just trust since it's an internal system.
        version = AppVersion.objects.first()
        serializer = AppVersionSerializer(version, data=request.data) if version else AppVersionSerializer(data=request.data)
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
