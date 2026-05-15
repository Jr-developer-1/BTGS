# from django.contrib.auth.signals import user_logged_in, user_logged_out
import json
from django.dispatch import receiver
from .models import LoginHistory, AuditLog
from django.db.models.signals import post_migrate, pre_save, post_save, post_delete
from django.core.management import call_command
from django.forms.models import model_to_dict
from django.core.serializers.json import DjangoJSONEncoder
from core.middleware import get_current_user

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# Centralized Dynamic Audit Logging System
WHITELISTED_APPS = [
    'core',
    'travel',
    'guest_house',
    'travel_masters',
    'fleet',
    'chatbot',
    'notifications',
    'api_management'
]

BLACKLISTED_MODELS = [
    'AuditLog',
    'Session',
    'LoginHistory',
    'Notification',
    'SystemConfig',
    'APILog',
    'DynamicSubmission',
    'ChatSession',
    'ChatMessage',
    'APIKeyHistory',
]

def serialize_instance(instance):
    try:
        return model_to_dict(instance)
    except Exception:
        return {}

@receiver(pre_save)
def capture_old_state_global(sender, instance, **kwargs):
    try:
        app_label = getattr(sender._meta, 'app_label', '')
        model_name = sender.__name__
        if app_label not in WHITELISTED_APPS or model_name in BLACKLISTED_MODELS:
            return

        if instance.pk:
            try:
                old_instance = sender.objects.get(pk=instance.pk)
                instance._old_state = serialize_instance(old_instance)
            except sender.DoesNotExist:
                instance._old_state = {}
        else:
            instance._old_state = {}
    except Exception:
        pass

@receiver(post_save)
def log_model_changes_global(sender, instance, created, **kwargs):
    try:
        app_label = getattr(sender._meta, 'app_label', '')
        model_name = sender.__name__
        if app_label not in WHITELISTED_APPS or model_name in BLACKLISTED_MODELS:
            return

        user = get_current_user()
        
        action = 'CREATE' if created else 'UPDATE'
        old_state = getattr(instance, '_old_state', {})
        
        # Detect soft delete via attribute 'is_deleted'
        if not created and getattr(instance, 'is_deleted', False) and not old_state.get('is_deleted', False):
            action = 'DELETE'

        changes = {}
        if not created:
            new_state = serialize_instance(instance)
            for key, value in new_state.items():
                if key not in old_state or old_state[key] != value:
                    changes[key] = {'old': old_state.get(key), 'new': value}
        else:
            changes = serialize_instance(instance)

        if not changes and action == 'UPDATE':
            return

        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
            details=json.loads(json.dumps(changes, cls=DjangoJSONEncoder)),
            ip_address=None
        )
    except Exception as e:
        print(f"DEBUG: Global AuditLog Create Error for {model_name}: {str(e)}")

@receiver(post_delete)
def log_model_delete_global(sender, instance, **kwargs):
    try:
        app_label = getattr(sender._meta, 'app_label', '')
        model_name = sender.__name__
        if app_label not in WHITELISTED_APPS or model_name in BLACKLISTED_MODELS:
            return

        user = get_current_user()
        AuditLog.objects.create(
            user=user,
            action='HARD_DELETE',
            model_name=model_name,
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
            details=json.loads(json.dumps(serialize_instance(instance), cls=DjangoJSONEncoder)),
            ip_address=None
        )
    except Exception:
        pass


@receiver(post_migrate)
def create_default_superuser(sender, **kwargs):
    """Automatically creates default superuser after migrations."""
    if sender.name == 'core':
        try:
            call_command('create_admin')
        except Exception as e:
            print(f"Error creating default superuser: {e}")
