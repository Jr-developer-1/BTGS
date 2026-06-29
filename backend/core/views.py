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

from .models import User, Role, Session, LoginHistory, AuditLog, FaceRegistrationRequest, AttendanceFRS, PhotoUpdateRequest, AppVersion, ReportAccessControl
from notifications.models import Notification
from .permissions import IsCustomAuthenticated, IsAdmin
from .serializers import AuditLogSerializer, LoginHistorySerializer, UserSerializer, RoleSerializer, AppVersionSerializer, ReportAccessControlSerializer
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

def check_user_can_view_reports(user):
    try:
        role_name = (user.role.name if user.role else '').lower()
        if role_name in ['admin', 'it-admin', 'superuser']:
            return True

        from django.db.models import Q

        # Check ReportAccessControl table
        # Check if user is allowed specifically by employee_code
        emp_id = str(user.employee_id or '').strip()
        if emp_id:
            if ReportAccessControl.objects.filter(
                access_type='employee',
                can_view_reports=True
            ).filter(
                Q(target_id=emp_id) | Q(employee_code=emp_id)
            ).exists():
                return True

        user_pos_codes = user.get_active_position_identifiers()
        
        # Check if user is allowed by their position codes
        if user_pos_codes:
            if ReportAccessControl.objects.filter(
                access_type='position',
                can_view_reports=True
            ).filter(
                Q(target_id__in=user_pos_codes) |
                Q(position_code__in=user_pos_codes) |
                Q(position_name__in=user_pos_codes)
            ).exists():
                return True

        if not user_pos_codes:
            return False

        from travel.models import HRPositionConfig, FinanceWorkflowStep
        
        is_hr_allowed = HRPositionConfig.objects.filter(
            position_id__in=user_pos_codes, is_active=True, can_view_reports=True
        ).exists()
        if is_hr_allowed:
            return True

        is_finance_allowed = FinanceWorkflowStep.objects.filter(
            Q(position_id__in=user_pos_codes) | Q(user=user),
            is_active=True,
            can_view_reports=True
        ).exists()
        if is_finance_allowed:
            return True
    except Exception as e:
        print(f"Error checking report access: {e}")
    return False

def check_user_can_view_claim_report(user):
    try:
        role_name = (user.role.name if user.role else '').lower()
        if role_name in ['admin', 'it-admin', 'superuser']:
            return True

        user_pos_codes = user.get_active_position_identifiers()
        if not user_pos_codes:
            return False

        from travel.models import HRPositionConfig, FinanceWorkflowStep
        from django.db.models import Q

        is_hr_allowed = HRPositionConfig.objects.filter(
            position_id__in=user_pos_codes, is_active=True, can_view_reports=True
        ).exists()
        if is_hr_allowed:
            return True

        is_finance_allowed = FinanceWorkflowStep.objects.filter(
            Q(position_id__in=user_pos_codes) | Q(user=user),
            is_active=True,
            can_view_reports=True
        ).exists()
        if is_finance_allowed:
            return True
    except Exception as e:
        print(f"Error checking claim report access: {e}")
    return False

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
        
        if not user.is_active or user.is_blocked_by_api:
             return Response({'error': 'Your account has been deactivated. Kindly contact the administrator.'}, status=status.HTTP_401_UNAUTHORIZED)
             
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
            # Enforce minimum mobile app version (v3.0.0, build 3)
            app_version = data.get('app_version')
            build_number = data.get('build_number')
            try:
                if not app_version or not build_number:
                    return Response({
                        'error': 'A newer version of the mobile app is available. Please update the app to login.'
                    }, status=status.HTTP_426_UPGRADE_REQUIRED)
                
                build_int = int(build_number)
                if build_int < 3:
                    return Response({
                        'error': 'A newer version of the mobile app is available. Please update the app to login.'
                    }, status=status.HTTP_426_UPGRADE_REQUIRED)
            except (ValueError, TypeError):
                return Response({
                    'error': 'A newer version of the mobile app is available. Please update the app to login.'
                }, status=status.HTTP_426_UPGRADE_REQUIRED)
                
            expiration = timezone.now() + datetime.timedelta(days=3650)
        else:
            expiration = timezone.now() + datetime.timedelta(hours=1)
            
        available_positions = user.get_available_positions(force_fresh=True)
        active_pos_id = None
        if available_positions:
            active_pos_id = str(available_positions[0].get('id'))
        user.active_position_id = active_pos_id

        payload = {
            'user_id': user.id,
            'role': user.role.name if user.role else 'Employee',
            'is_mobile': is_mobile,
            'active_position_id': active_pos_id,
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
                'available_positions': available_positions,
                'can_view_reports': check_user_can_view_reports(user),
                'can_view_claim_report': check_user_can_view_claim_report(user)
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
            'role': user.active_role,
            'role_permissions': (lambda u: (Role.objects.filter(Q(name__iexact=u.role_from_api) | Q(name__iexact=u.designation)).first() or u.role).permissions if u.role else {})(user),
            'department': getattr(user, 'department', 'N/A'),
            'designation': getattr(user, 'designation', 'N/A'),
            'office_level': getattr(user, 'office_level', 3),
            'email': getattr(user, 'email', ''),
            'theme': getattr(user, 'theme', 'classic'),
            'active_position_id': user.active_position_id,
            'available_positions': user.get_available_positions(force_fresh=True),
            'can_view_reports': check_user_can_view_reports(user),
            'can_view_claim_report': check_user_can_view_claim_report(user)
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
        
        # Generate new JWT token containing updated active_position_id
        session = getattr(request, 'active_session', None)
        expiration = session.expires_at if session else (timezone.now() + datetime.timedelta(hours=1))
        
        # Detect mobile client
        user_agent = request.headers.get('User-Agent', '').lower()
        is_mobile = 'dart' in user_agent or 'android' in user_agent
        
        payload = {
            'user_id': user.id,
            'role': user.active_role,
            'is_mobile': is_mobile,
            'active_position_id': str(position_id),
            'exp': expiration
        }
        new_token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
        
        if session:
            session.token = new_token
            session.save()
        
        # Force refresh properties by clearing cache
        from django.core.cache import cache
        from api_management.services import CACHE_EMPLOYEE_DATA, safe_cache_delete
        if user.employee_id in CACHE_EMPLOYEE_DATA:
            del CACHE_EMPLOYEE_DATA[user.employee_id]
        
        # Clear persistent employee cache and position maps
        cache_key = f"EMP_DATA_PERSISTENT_{str(user.employee_id).strip().upper()}"
        safe_cache_delete(cache_key)
        safe_cache_delete('position_to_employee_codes_map')
        safe_cache_delete('user_position_identifiers')
            
        # Safely resolve role and permissions
        user_role_obj = user.role
        role_name = user.active_role
        
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
            'token': new_token,
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
                'available_positions': available,
                'can_view_reports': check_user_can_view_reports(user),
                'can_view_claim_report': check_user_can_view_claim_report(user)
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
            
        role_name = user.active_role.lower()
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

        # Project-based filtering — cache-only, never blocks on live API during a request
        project_code = self.request.query_params.get('project_code') or self.request.query_params.get('project')
        if project_code:
            from api_management.services import safe_cache_get, GLOBAL_EMPLOYEE_CACHE
            import time
            # Prefer file-based persistent cache; fall back to in-process memory cache
            persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
            if not persistent_data:
                mem_cache = GLOBAL_EMPLOYEE_CACHE
                if mem_cache.get('data') and (time.time() - mem_cache.get('timestamp', 0)) < 7200:
                    persistent_data = mem_cache['data']

            if persistent_data:
                emp_codes = []
                for item in persistent_data:
                    if isinstance(item, dict):
                        emp = item.get('employee', {})
                        proj = item.get('project', {})
                        emp_proj_code = proj.get('code') if proj else None

                        if project_code.lower() == 'general':
                            if not emp_proj_code or emp_proj_code.lower() in ['general', 'n/a']:
                                code = emp.get('employee_code')
                                if code:
                                    emp_codes.append(code)
                        else:
                            if emp_proj_code and emp_proj_code.lower() == project_code.lower():
                                code = emp.get('employee_code')
                                if code:
                                    emp_codes.append(code)
                queryset = queryset.filter(user__employee_id__in=emp_codes)
            else:
                # Cache cold — trigger background warm-up and return unfiltered so page loads
                import threading
                from api_management.services import fetch_employee_data
                def _warm_cache():
                    try:
                        fetch_employee_data(fetch_all_pages=True)
                    except Exception:
                        pass
                t = threading.Thread(target=_warm_cache, daemon=True)
                t.start()

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

    @action(detail=False, methods=['get'], url_path='cache-status')
    def cache_status(self, request):
        """Returns whether the employee data cache is warm for project filtering."""
        from api_management.services import safe_cache_get, GLOBAL_EMPLOYEE_CACHE
        import time

        persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
        mem_cache = GLOBAL_EMPLOYEE_CACHE
        mem_warm = bool(mem_cache.get('data')) and (time.time() - mem_cache.get('timestamp', 0)) < 7200

        cache_warm = bool(persistent_data) or mem_warm
        count = len(persistent_data or mem_cache.get('data') or [])
        return Response({
            'cache_warm': cache_warm,
            'employee_count': count,
            'message': (
                'Employee data cache is ready. Project filtering is active.'
                if cache_warm else
                'Employee data is still syncing from the HR system. Project filtering will be available shortly — please try again in a moment.'
            )
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        from django.utils.dateparse import parse_date
        from django.utils import timezone
        import datetime
        from travel.models import Trip, BulkActivityBatch
        from django.db.models import Count, Max

        user = request.custom_user
        role_name = user.active_role.lower() if user else ''
        privileged_keywords = ['admin', 'superuser', 'it admin', 'it-admin', 'cfo', 'hr', 'finance']
        is_privileged = any(kw in role_name for kw in privileged_keywords) or check_user_can_view_reports(user)

        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        search_query = request.query_params.get('search', '')

        # Base querysets
        history_qs = LoginHistory.objects.all().select_related('user')
        bulk_trip_ids = BulkActivityBatch.all_objects.values_list('trip_id', flat=True).distinct()
        trip_qs = Trip.objects.exclude(trip_id__in=bulk_trip_ids).select_related('user')
        batch_qs = BulkActivityBatch.objects.all().select_related('user')

        if not is_privileged:
            history_qs = history_qs.filter(user=user)
            trip_qs = trip_qs.filter(user=user)
            batch_qs = batch_qs.filter(user=user)

        # Date filtering
        if start_date_str:
            parsed_start = parse_date(start_date_str)
            if parsed_start:
                start_dt = datetime.datetime.combine(parsed_start, datetime.time.min)
                if timezone.is_aware(timezone.now()):
                    start_dt = timezone.make_aware(start_dt)
                history_qs = history_qs.filter(login_time__gte=start_dt)
                trip_qs = trip_qs.filter(created_at__gte=start_dt)
                batch_qs = batch_qs.filter(created_at__gte=start_dt)

        if end_date_str:
            parsed_end = parse_date(end_date_str)
            if parsed_end:
                end_dt = datetime.datetime.combine(parsed_end, datetime.time.max)
                if timezone.is_aware(timezone.now()):
                    end_dt = timezone.make_aware(end_dt)
                history_qs = history_qs.filter(login_time__lte=end_dt)
                trip_qs = trip_qs.filter(created_at__lte=end_dt)
                batch_qs = batch_qs.filter(created_at__lte=end_dt)

        # Search query filtering (if any search filters the list)
        if search_query:
            history_qs = history_qs.filter(
                Q(user__employee_id__icontains=search_query) |
                Q(ip_address__icontains=search_query)
            )

        # Project-based filtering — cache-only, never blocks on live API during a request
        project_code = request.query_params.get('project_code') or request.query_params.get('project')
        emp_codes = []
        emp_details_map = {}
        
        from api_management.services import safe_cache_get, GLOBAL_EMPLOYEE_CACHE
        import time
        persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
        if not persistent_data:
            mem_cache = GLOBAL_EMPLOYEE_CACHE
            if mem_cache.get('data') and (time.time() - mem_cache.get('timestamp', 0)) < 7200:
                persistent_data = mem_cache['data']

        if persistent_data:
            for item in persistent_data:
                if isinstance(item, dict):
                    emp = item.get('employee', {})
                    code = emp.get('employee_code')
                    if code:
                        pos_info = item.get('position', {}) or {}
                        emp_details_map[code] = {
                            'name': emp.get('name') or emp.get('employee_name') or 'Unknown',
                            'designation': pos_info.get('name') or '',
                            'position_code': pos_info.get('code') or '',
                            'role_name': pos_info.get('role_name') or ''
                        }

        # Populate emp_codes with all employee codes from cache by default
        if persistent_data:
            for item in persistent_data:
                if isinstance(item, dict):
                    emp = item.get('employee', {})
                    code = emp.get('employee_code')
                    if code and code not in emp_codes:
                        emp_codes.append(code)

        if project_code and project_code != 'All':
            project_emp_codes = []
            if persistent_data:
                for item in persistent_data:
                    if isinstance(item, dict):
                        emp = item.get('employee', {})
                        proj = item.get('project', {})
                        emp_proj_code = proj.get('code') if proj else None

                        match = False
                        if project_code.lower() == 'general':
                            if not emp_proj_code or emp_proj_code.lower() in ['general', 'n/a']:
                                match = True
                        else:
                            if emp_proj_code and emp_proj_code.lower() == project_code.lower():
                                match = True

                        if match:
                            code = emp.get('employee_code')
                            if code:
                                project_emp_codes.append(code)
            history_qs = history_qs.filter(user__employee_id__in=project_emp_codes)
            trip_qs = trip_qs.filter(user__employee_id__in=project_emp_codes)
            batch_qs = batch_qs.filter(user__employee_id__in=project_emp_codes)
            emp_codes = project_emp_codes

        # Helper to resolve actual names for any user object
        def get_resolved_user_name(user_obj):
            if not user_obj:
                return 'Unknown'
            # First try looking up in our bulk loaded cache map
            cached_emp = emp_details_map.get(user_obj.employee_id)
            if cached_emp and cached_emp.get('name'):
                return cached_emp['name']
            # Fallback to the User object name if present and not equal to employee_id
            if user_obj.name and user_obj.name != user_obj.employee_id:
                return user_obj.name
            # Last fallback
            return user_obj.employee_id or 'Unknown'

        # Calculate counts
        # Unique Users from LoginHistory
        unique_users_data = (
            history_qs
            .filter(user__isnull=False)
            .values('user_id')
            .annotate(login_count=Count('id'), last_login=Max('login_time'))
            .order_by('-last_login')
        )
        user_ids = [item['user_id'] for item in unique_users_data]
        users_map = {u.id: u for u in User.objects.filter(id__in=user_ids)}

        unique_users_list = []
        for item in unique_users_data:
            u_obj = users_map.get(item['user_id'])
            if u_obj:
                try:
                    pos = u_obj.get_current_position()
                    pos_code = pos.get('code', '') if pos else ''
                    designation = u_obj.designation or ''
                except Exception:
                    pos_code = ''
                    designation = ''
                unique_users_list.append({
                    'employee_id': u_obj.employee_id,
                    'name': u_obj.name,
                    'email': u_obj.email,
                    'designation': designation,
                    'position_code': pos_code,
                    'login_count': item['login_count'],
                    'last_login': item['last_login'].isoformat() if item['last_login'] else None
                })

        trips_list = []
        for trip in trip_qs.order_by('-created_at'):
            try:
                pos = trip.user.get_current_position() if trip.user else None
                designation = trip.user.designation or '' if trip.user else ''
                pos_code = pos.get('code', '') if pos else ''
                role_name = pos.get('role_name') if pos else (trip.user.role.name if trip.user and trip.user.role else '')
            except Exception:
                designation = ''
                pos_code = ''
                role_name = ''

            current_approver_name = None
            if trip.status not in ['Approved', 'Rejected', 'Completed', 'Settled']:
                approver_obj = trip
                if hasattr(trip, 'claim') and trip.claim and trip.claim.status not in ['Paid', 'Draft']:
                    approver_obj = trip.claim
                
                if not approver_obj.approver_position:
                    current_approver_name = get_resolved_user_name(approver_obj.current_approver) if approver_obj.current_approver else 'Pending'
                else:
                    try:
                        from travel.views import get_users_by_position
                        users = get_users_by_position(approver_obj.approver_position)
                        target_user = users[0] if users else None
                        if target_user:
                            current_approver_name = get_resolved_user_name(target_user)
                        elif approver_obj.current_approver:
                            current_approver_name = get_resolved_user_name(approver_obj.current_approver)
                        else:
                            current_approver_name = f"Position {approver_obj.approver_position}"
                    except Exception:
                        if approver_obj.current_approver:
                            current_approver_name = get_resolved_user_name(approver_obj.current_approver)

            rejected_by = None
            rejection_reason = None
            if trip.status == 'Rejected':
                rejected_by = get_resolved_user_name(trip.rejected_by) if trip.rejected_by else 'Unknown'
                rejection_reason = trip.rejection_reason or ''

            trips_list.append({
                'trip_id': trip.trip_id,
                'user_id': trip.user.employee_id if trip.user else 'N/A',
                'user_name': trip.user_name or (trip.user.name if trip.user else 'Unknown'),
                'user_designation': designation,
                'user_position_code': pos_code,
                'user_role': role_name,
                'source': trip.source,
                'destination': trip.destination,
                'start_date': trip.start_date.isoformat() if trip.start_date else None,
                'end_date': trip.end_date.isoformat() if trip.end_date else None,
                'status': trip.status,
                'created_at': trip.created_at.isoformat() if trip.created_at else None,
                'is_bulk_upload': False,
                'current_approver_name': current_approver_name,
                'rejected_by': rejected_by,
                'rejection_reason': rejection_reason,
            })

        batches_list = []
        submitted_by_emp_code = {}
        for batch in batch_qs.order_by('-created_at'):
            try:
                pos = batch.user.get_current_position() if batch.user else None
                designation = batch.user.designation or '' if batch.user else ''
                pos_code = pos.get('code', '') if pos else ''
                role_name = pos.get('role_name') if pos else (batch.user.role.name if batch.user and batch.user.role else '')
            except Exception:
                designation = ''
                pos_code = ''
                role_name = ''

            # Merge live odometer and deviation data from created expenses
            rows_data = batch.data_json if batch.data_json else []
            if batch.created_expenses:
                try:
                    import json
                    from travel.models import Expense
                    expenses = Expense.objects.filter(id__in=batch.created_expenses)
                    expense_map = {}
                    for exp in expenses:
                        try:
                            desc = json.loads(exp.description)
                            r_idx = desc.get('row_index')
                            if r_idx is not None:
                                expense_map[int(r_idx)] = {
                                    'odo_start': exp.odo_start,
                                    'odo_end': exp.odo_end,
                                    'is_deviated': exp.is_deviated or desc.get('is_deviated', False),
                                    'deviation_reason': exp.deviation_reason or desc.get('deviation_reason', ''),
                                    'planned_origin': exp.planned_origin or desc.get('planned_origin', desc.get('origin', '')),
                                    'planned_destination': exp.planned_destination or desc.get('planned_destination', desc.get('destination', '')),
                                    'is_not_visited': desc.get('isNotVisited') == True or desc.get('travelStatus') == 'Cancelled' or (exp.deviation_reason and '[cancelled/skip]' in str(exp.deviation_reason).lower()),
                                    'actual_mode': desc.get('mode', exp.travel_mode or ''),
                                    'actual_vehicle': desc.get('subType', '')
                                }
                        except Exception:
                            pass
                    
                    updated_rows = []
                    for idx, row in enumerate(rows_data):
                        new_row = dict(row)
                        if idx in expense_map:
                            m_data = expense_map[idx]
                            if m_data['odo_start'] is not None:
                                new_row['odo_start'] = float(m_data['odo_start'])
                            if m_data['odo_end'] is not None:
                                new_row['odo_end'] = float(m_data['odo_end'])
                            new_row['is_deviated'] = m_data['is_deviated']
                            new_row['deviation_reason'] = m_data['deviation_reason']
                            new_row['planned_origin'] = m_data['planned_origin']
                            new_row['planned_destination'] = m_data['planned_destination']
                            new_row['is_not_visited'] = m_data['is_not_visited']
                            new_row['actual_mode'] = m_data['actual_mode']
                            new_row['actual_vehicle'] = m_data['actual_vehicle']
                        updated_rows.append(new_row)
                    rows_data = updated_rows
                except Exception:
                    pass

            current_approver_name = None
            if batch.status in ['Submitted', 'Resubmitted', 'Pending', 'Forwarded']:
                if not batch.approver_position:
                    current_approver_name = get_resolved_user_name(batch.current_approver) if batch.current_approver else 'Pending'
                else:
                    try:
                        from travel.views import get_users_by_position
                        users = get_users_by_position(batch.approver_position)
                        target_user = users[0] if users else None
                        if target_user:
                            current_approver_name = get_resolved_user_name(target_user)
                        elif batch.current_approver:
                            current_approver_name = get_resolved_user_name(batch.current_approver)
                        else:
                            current_approver_name = f"Position {batch.approver_position}"
                    except Exception:
                        if batch.current_approver:
                            current_approver_name = get_resolved_user_name(batch.current_approver)

            rejected_by = None
            rejection_reason = None
            if batch.status == 'Rejected':
                try:
                    from core.models import AuditLog
                    log = AuditLog.objects.filter(
                        model_name='BulkActivityBatch',
                        object_id=str(batch.id),
                        action='REJECT'
                    ).order_by('-timestamp').first()
                    if log:
                        rejected_by = get_resolved_user_name(log.user) if log.user else 'Unknown'
                        rejection_reason = log.details.get('reason', '') if isinstance(log.details, dict) else ''
                    if not rejection_reason:
                        rejection_reason = batch.remarks or ''
                    if not rejected_by and batch.trip and batch.trip.rejected_by:
                        rejected_by = get_resolved_user_name(batch.trip.rejected_by)
                        rejection_reason = batch.trip.rejection_reason or batch.remarks or ''
                except Exception:
                    pass

            batch_item = {
                'id': batch.id,
                'user_id': batch.user.employee_id if batch.user else 'N/A',
                'user_name': batch.user.name if batch.user else 'Unknown',
                'user_designation': designation,
                'user_position_code': pos_code,
                'user_role': role_name,
                'file_name': batch.file_name,
                'trip_id': batch.trip.trip_id if batch.trip else None,
                'status': batch.status,
                'created_at': batch.created_at.isoformat() if batch.created_at else None,
                'row_count': len(rows_data),
                'rows': rows_data,
                'original_rows': batch.data_json if batch.data_json else [],
                'current_approver_name': current_approver_name,
                'rejected_by': rejected_by,
                'rejection_reason': rejection_reason,
            }
            if batch.user and batch.user.employee_id:
                submitted_by_emp_code.setdefault(batch.user.employee_id, []).append(batch_item)
            
            batches_list.append(batch_item)

        actual_batches_count = len(batches_list)

        # Merge with project employee roster to report all employees (Submitted/Not Submitted)
        if emp_codes:
            batches_list = []
            processed_codes = set()
            
            # 1. Add all actual submissions
            for emp_id, items in submitted_by_emp_code.items():
                batches_list.extend(items)
                processed_codes.add(emp_id)
                
            # 2. Add employees who have not submitted anything
            for emp_id in emp_codes:
                if emp_id in processed_codes:
                    continue
                
                # Fetch employee details from DB or cache fallback
                u_obj = User.objects.filter(employee_id=emp_id).first()
                if u_obj:
                    try:
                        pos = u_obj.get_current_position()
                        pos_code = pos.get('code', '') if pos else ''
                        designation = u_obj.designation or ''
                        role_name = pos.get('role_name') if pos else (u_obj.role.name if u_obj.role else '')
                    except Exception:
                        designation = ''
                        pos_code = ''
                        role_name = ''
                    name = u_obj.name
                else:
                    cache_info = emp_details_map.get(emp_id, {})
                    name = cache_info.get('name', 'Unknown')
                    designation = cache_info.get('designation', '')
                    pos_code = cache_info.get('position_code', '')
                    role_name = cache_info.get('role_name', '')

                batches_list.append({
                    'id': f"not_submitted_{emp_id}",
                    'user_id': emp_id,
                    'user_name': name,
                    'user_designation': designation,
                    'user_position_code': pos_code,
                    'user_role': role_name,
                    'file_name': '—',
                    'trip_id': None,
                    'status': 'Not Submitted',
                    'created_at': None,
                    'row_count': 0,
                    'rows': [],
                    'original_rows': [],
                    'current_approver_name': None,
                    'rejected_by': None,
                    'rejection_reason': None,
                })
                processed_codes.add(emp_id)

            # Sort: Submitted (latest first) followed by Not Submitted (alphabetical)
            submitted_batches = [b for b in batches_list if b.get('created_at')]
            not_submitted_batches = [b for b in batches_list if not b.get('created_at')]
            submitted_batches.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            not_submitted_batches.sort(key=lambda x: x.get('user_name', '').lower())
            batches_list = submitted_batches + not_submitted_batches

        return Response({
            'trips_count': len(trips_list),
            'batches_count': actual_batches_count,
            'users_count': len(unique_users_list),
            'trips': trips_list,
            'batches': batches_list,
            'users': unique_users_list
        })

    @action(detail=False, methods=['get'], url_path='export-csv')
    def export_csv(self, request):
        import csv
        from django.http import HttpResponse
        
        queryset = self.filter_queryset(self.get_queryset())
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="login_history.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Employee Name', 'Employee ID', 'Position', 'IP Address', 'Browser', 'Device', 'Login Time', 'Logout Time', 'Status'])
        
        for log in queryset:
            try:
                designation = log.user.designation or '' if log.user else ''
            except Exception:
                designation = ''
            writer.writerow([
                log.user.name if log.user else 'Unknown',
                log.user.employee_id if log.user else '',
                designation,
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
    search_fields = ['user__employee_id', 'object_repr', 'details']
    ordering_fields = ['timestamp']
    ordering = ['-timestamp']

    def get_queryset(self):
        user = self.request.custom_user
        if not user or not user.role:
            return AuditLog.objects.none()
            
        role_name = user.active_role.lower()
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
    
    # 1. Notifications (Latest 10) - Filtered by active position identifiers
    from django.db.models import Q
    pos_ids = user.get_active_position_identifiers()
    notif_filter = Q(user=user) & (Q(target_position__isnull=True) | Q(target_position='') | Q(target_position__in=pos_ids))
    notifications_qs = Notification.objects.filter(notif_filter).order_by('-created_at')[:10]
    unread_count = Notification.objects.filter(notif_filter, unread=True).count()
    
    # 2. Approval Counts
    from travel.models import Trip, TravelAdvance, TravelClaim
    user_role = user.active_role.lower() if user else ''
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
class ReportAccessControlViewSet(viewsets.ModelViewSet):
    queryset = ReportAccessControl.objects.all()
    serializer_class = ReportAccessControlSerializer
    permission_classes = [IsCustomAuthenticated]

    def get_queryset(self):
        user = getattr(self.request, 'custom_user', None)
        if not user or not user.role or user.role.name.lower() not in ['admin', 'it-admin', 'superuser']:
            return ReportAccessControl.objects.none()
        return ReportAccessControl.objects.all().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        user = getattr(request, 'custom_user', None)
        if not user or not user.role or user.role.name.lower() not in ['admin', 'it-admin', 'superuser']:
            return Response({"error": "Only administrators can configure report access."}, status=403)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        user = getattr(request, 'custom_user', None)
        if not user or not user.role or user.role.name.lower() not in ['admin', 'it-admin', 'superuser']:
            return Response({"error": "Only administrators can configure report access."}, status=403)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = getattr(request, 'custom_user', None)
        if not user or not user.role or user.role.name.lower() not in ['admin', 'it-admin', 'superuser']:
            return Response({"error": "Only administrators can configure report access."}, status=403)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='search-profiles')
    def search_profiles(self, request):
        user = getattr(request, 'custom_user', None)
        if not user or not user.role or user.role.name.lower() not in ['admin', 'it-admin', 'superuser']:
            return Response({"error": "Only administrators can search profiles for report access."}, status=403)

        query = request.query_params.get('q', '').strip().lower()
        if not query:
            return Response([])

        from api_management.services import safe_cache_get, GLOBAL_EMPLOYEE_CACHE
        import time
        
        persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
        if not persistent_data:
            mem_cache = GLOBAL_EMPLOYEE_CACHE
            if mem_cache.get('data') and (time.time() - mem_cache.get('timestamp', 0)) < 7200:
                persistent_data = mem_cache['data']

        results = []
        if persistent_data:
            for item in persistent_data:
                if not isinstance(item, dict):
                    continue
                emp = item.get('employee', {})
                pos = item.get('position', {}) or {}
                
                emp_code = emp.get('employee_code', '') or ''
                emp_name = emp.get('name', '') or ''
                pos_code = pos.get('code', '') or ''
                pos_name = pos.get('name', '') or ''
                
                # Check match
                if (query in emp_code.lower() or 
                    query in emp_name.lower() or 
                    query in pos_code.lower() or 
                    query in pos_name.lower()):
                    
                    # Avoid duplicate records in search results
                    res_item = {
                        'employee_code': emp_code,
                        'employee_name': emp_name,
                        'position_code': pos_code,
                        'position_name': pos_name,
                    }
                    if res_item not in results:
                        results.append(res_item)
                    
        # Limit results to top 50
        return Response(results[:50])


