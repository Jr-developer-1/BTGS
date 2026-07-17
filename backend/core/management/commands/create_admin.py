from django.core.management.base import BaseCommand
from core.models import Role, User
from django.conf import settings
import hashlib

class Command(BaseCommand):
    help = 'Seeds initial roles and admin user'

    def handle(self, *args, **kwargs):
        roles = ['Admin', 'Employee', 'Finance', 'GuestHouseManager', 'HR', 'CFO']
        for role_name in roles:
            Role.objects.get_or_create(name=role_name)                              
        
        self.stdout.write(self.style.SUCCESS('Roles created'))

        admin_role = Role.objects.get(name='Admin')
        if not User.objects.filter(employee_id='ADMIN001').exists():
            from api_management.utils import encrypt_key
            pwd_hash = encrypt_key("admin123")
                
            User.objects.create(
                employee_id='ADMIN001',
                role=admin_role,
                password_hash=pwd_hash,
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS('Admin user created (ID: ADMIN001, Pass: admin123)'))
        else:
            self.stdout.write(self.style.WARNING('Admin user already exists'))
