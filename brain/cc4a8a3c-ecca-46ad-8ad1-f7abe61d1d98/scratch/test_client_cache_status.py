import os, sys, django
sys.path.insert(0, os.path.join(os.getcwd(), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from django.test import Client
from core.models import User

client = Client()
# Log in an admin user or set custom_user manually
user = User.objects.filter(role__name__iexact='admin').first() or User.objects.first()

# Let's request the endpoint
response = client.get('/api/login-history/cache-status/')
print(f"Status Code without auth: {response.status_code}")
print(f"Content: {response.content}")

# Since authentication is required:
from rest_framework.test import APIClient
apiclient = APIClient()
apiclient.force_authenticate(user=user)

# We also need to set the custom_user middleware attribute if required, 
# but let's see how our custom auth middleware sets custom_user:
# It reads auth token, resolves user.
# Let's try requesting:
response = apiclient.get('/api/login-history/cache-status/')
print(f"DRF Client Status Code: {response.status_code}")
print(f"DRF Client Content: {response.content}")
