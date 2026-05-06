from django.core.management.base import BaseCommand
from django.apps import apps
from django.db import transaction

class Command(BaseCommand):
    help = 'Safely wipe transactional data while preserving Users and Configuration.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Starting database wipe (preserving users)..."))
        
        apps_to_wipe = {
            'travel': [], # Wipe all models in this app
            'notifications': [], # Wipe all models
        }
        
        models_to_wipe = [
            # Core Transactional
            ('core', 'AuditLog'),
            ('core', 'LoginHistory'),
            ('core', 'Session'),
            ('core', 'AttendanceFRS'),
            ('core', 'FaceRegistrationRequest'),
            ('core', 'PhotoUpdateRequest'),
            
            # API Logs
            ('api_management', 'APILog'),
            ('api_management', 'DynamicSubmission'),
        ]

        with transaction.atomic():
            # 1. Wipe entire apps
            for app_label in apps_to_wipe:
                app_config = apps.get_app_config(app_label)
                for model in app_config.get_models():
                    count = model.objects.all().count()
                    model.objects.all().delete()
                    self.stdout.write(f"Wiped {count} records from {app_label}.{model.__name__}")

            # 2. Wipe specific models
            for app_label, model_name in models_to_wipe:
                try:
                    model = apps.get_model(app_label, model_name)
                    count = model.objects.all().count()
                    model.objects.all().delete()
                    self.stdout.write(f"Wiped {count} records from {app_label}.{model_name}")
                except LookupError:
                    self.stdout.write(self.style.ERROR(f"Model {app_label}.{model_name} not found, skipping."))

            # 3. Reset User carry_forward_balance
            User = apps.get_model('core', 'User')
            User.objects.all().update(carry_forward_balance=0)
            self.stdout.write("Reset all user virtual wallet balances to 0.")

        self.stdout.write(self.style.SUCCESS("Database wipe complete. Users and Masters preserved."))
