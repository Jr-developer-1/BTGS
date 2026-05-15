from core.models import AuditLog
from django.utils.deprecation import MiddlewareMixin

class PageAccessMiddleware(MiddlewareMixin):
    def process_request(self, request):
        pass

    def process_response(self, request, response):
        user = getattr(request, 'custom_user', None)
        
        if not user and hasattr(request, 'user') and request.user and request.user.is_authenticated:
            user = request.user

        if user:
            if not request.path.startswith('/static/') and not request.path.startswith('/media/') and not request.path.startswith('/admin/'):
                
                x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
                if x_forwarded_for:
                    ip = x_forwarded_for.split(',')[0].strip()
                else:
                    ip = request.META.get('REMOTE_ADDR')

                details = {
                    'method': request.method,
                    'query_params': dict(request.GET),
                    'status_code': response.status_code
                }
                
                AuditLog.objects.create(
                    user=user,
                    action='PAGE_ACCESS',
                    model_name='API',
                    object_repr=request.path,
                    details=details,
                    ip_address=ip
                )
        
        return response
