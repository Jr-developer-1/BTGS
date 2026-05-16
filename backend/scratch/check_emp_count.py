import os
import sys
import django

sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from api_management.models import SystemConfig
from api_management.services import decrypt_key
import requests

try:
    api_url = SystemConfig.objects.get(key='external_api_url').value
    api_key = decrypt_key(SystemConfig.objects.get(key='external_api_key').value)
    headers = {'X-Api-Key': api_key, 'Accept': 'application/json'}
    resp = requests.get(api_url, headers=headers).json()
    print(f"Total Count: {resp.get('count')}")
except Exception as e:
    print(f"Error: {e}")
