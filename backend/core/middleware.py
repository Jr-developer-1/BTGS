import jwt
from django.conf import settings
from django.http import JsonResponse
from .models import Session, User
from django.utils import timezone

class CustomAuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/auth/login') or request.path.startswith('/api/health'):
            return self.get_response(request)

        # 1. Capture Authorization header
        auth_header = request.headers.get('Authorization')
        has_bearer = auth_header and auth_header.startswith('Bearer ')

        # 2. Skip if already authenticated (e.g. by API Key middleware) ONLY if we don't have a specific user token
        if (getattr(request, 'custom_user', None) or getattr(request, 'is_api_key_authenticated', False)) and not has_bearer:
            return self.get_response(request)

        # auth_header already captured above in current __call__
        if not auth_header or not auth_header.startswith('Bearer '):
            request.custom_user = None
        else:
            token = auth_header.split(' ')[1]
            try:
                payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
                
                session = Session.objects.filter(token=token, is_active=True).first()
                
                if session and session.is_valid():
                    # Check is_mobile flag from JWT payload if available, or fallback to User-Agent
                    is_mobile = payload.get('is_mobile', False)
                    if not is_mobile:
                        user_agent = request.headers.get('User-Agent', '').lower()
                        is_mobile = 'dart' in user_agent or 'android' in user_agent
                    
                    has_timed_out = False
                    if not is_mobile and session.last_activity:
                        idle_duration = timezone.now() - session.last_activity
                        if idle_duration.total_seconds() > 3600:  # 1 hour timeout for web
                            session.is_active = False
                            session.logged_out_at = timezone.now()
                            session.save()
                            has_timed_out = True
                    
                    if not has_timed_out:
                        session.last_activity = timezone.now()
                        session.save(update_fields=['last_activity'])
                        
                        user = session.user
                        request.custom_user = user
                        request.user = user
                        request.active_session = session
                    else:
                        request.custom_user = None
                        request.active_session = None
                else:
                    request.custom_user = None
                    request.active_session = None
            except jwt.ExpiredSignatureError:
                request.custom_user = None
            except (jwt.InvalidTokenError, Session.DoesNotExist):
                request.custom_user = None

        return self.get_response(request)



import threading
_thread_locals = threading.local()

def get_current_user():
    return getattr(_thread_locals, 'user', None)

def should_skip_external_api():
    return getattr(_thread_locals, 'skip_external_api', False)

def get_current_request():
    return getattr(_thread_locals, 'request', None)

class ThreadLocalMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.user = getattr(request, 'user', None)
        if hasattr(request, 'custom_user') and request.custom_user:
             _thread_locals.user = request.custom_user
        _thread_locals.request = request
        
        # Set skip_external_api for specific "DB-only" views
        # IMPORTANT: Do NOT add /api/trips/, /api/advances/, /api/claims/ here.
        # Those paths call resolve_approver() which NEEDS the external API to
        # correctly resolve the reporting_manager hierarchy. Without it, all
        # requests fall back to HR/Admin instead of routing to the actual manager.
        db_only_paths = [
            '/api/heartbeat',
            '/api/bot/chat',
            '/api/audit-logs/', 
            '/api/login-history/', 
            '/api/audit-history',
            '/api/session-history'
        ]
        _thread_locals.skip_external_api = any(request.path.startswith(p) for p in db_only_paths)
        
        response = self.get_response(request)
        
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user
        if hasattr(_thread_locals, 'request'):
            del _thread_locals.request
        if hasattr(_thread_locals, 'skip_external_api'):
            del _thread_locals.skip_external_api
            
        return response
