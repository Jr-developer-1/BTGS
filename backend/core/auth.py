from rest_framework import authentication

class CustomTokenAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        user = getattr(request, 'custom_user', None)
        if not user:
            return None
        return (user, None)
