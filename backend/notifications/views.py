from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Notification, Reminder, PushSubscription
from .serializers import NotificationSerializer, ReminderSerializer, PushSubscriptionSerializer
from core.permissions import IsCustomAuthenticated

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsCustomAuthenticated]

    def get_queryset(self):
        user = self.request.custom_user
        from django.db.models import Q
        pos_ids = user.get_active_position_identifiers()
        
        # Filter by user AND (target_position is null OR matches any of current active position IDs/Codes)
        queryset = Notification.objects.filter(
            Q(user=user) & 
            (Q(target_position__isnull=True) | Q(target_position='') | Q(target_position__in=pos_ids))
        )
        unread = self.request.query_params.get('unread')
        if unread is not None:
            is_unread = unread.lower() == 'true'
            queryset = queryset.filter(unread=is_unread)
        return queryset

    def perform_create(self, serializer):
        user_id = self.request.data.get('user') or self.request.data.get('target_user')
        if user_id:
            serializer.save(user_id=user_id)
        else:
            serializer.save(user=self.request.custom_user)

    @action(detail=False, methods=['post'], url_path='mark-all-read')
    def mark_all_read(self, request):
        user = request.custom_user
        Notification.objects.filter(user=user, unread=True).update(unread=False)
        return Response({'message': 'All notifications marked as read'})

class ReminderViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderSerializer
    permission_classes = [IsCustomAuthenticated]

    def get_queryset(self):
        queryset = Reminder.objects.filter(user=self.request.custom_user)
        trip_id = self.request.query_params.get('trip_id')
        sent = self.request.query_params.get('sent')
        
        if trip_id:
            queryset = queryset.filter(trip_id=trip_id)
        if sent is not None:
            is_sent = sent.lower() == 'true'
            queryset = queryset.filter(is_sent=is_sent)
            
        return queryset

    def send_immediate_push(self, reminder):
        from .models import PushSubscription
        from pywebpush import webpush, WebPushException
        import json
        from django.conf import settings

        subscriptions = PushSubscription.objects.filter(user=reminder.user)
        payload = {
            "title": "Reminder Set!",
            "body": f"We'll alert you: {reminder.title}",
            "icon": "/logo.png",
            "badge": "/logo.png",
            "data": {
                "reminder_id": reminder.id,
                "url": f"/trip-story/{reminder.trip_id}" if reminder.trip else "/"
            }
        }

        for sub in subscriptions:
            try:
                webpush(
                    subscription_info={
                        "endpoint": sub.endpoint,
                        "keys": {"p256dh": sub.p256dh, "auth": sub.auth}
                    },
                    data=json.dumps(payload),
                    vapid_private_key=settings.VAPID_PRIVATE_KEY,
                    vapid_claims={"sub": settings.VAPID_CLAIM_EMAIL}
                )
            except Exception:
                pass

    def perform_create(self, serializer):
        # Check for existing active reminder for the same trip and user
        trip_id = self.request.data.get('trip')
        category = self.request.data.get('category', 'other')
        if trip_id:
            from .models import Reminder
            # A reminder is "active" if it hasn't been acknowledged AND hasn't been sent.
            # If it's sent but not acknowledged (ringing), or not sent yet, it blocks.
            # Once either it's acknowledged OR it's been sent AND we decide to allow retry (usually acknowledged is the key).
            # The USER says "remainder is not allowing to create when the current remainder is stop."
            # "Stop" means acknowledged=True.
            existing = Reminder.objects.filter(
                user=self.request.custom_user,
                trip_id=trip_id,
                category=category,
                acknowledged=False
            ).exists()
            if existing:
                from rest_framework.exceptions import ValidationError
                raise ValidationError({"non_field_errors": [f"An active '{category}' reminder already exists for this trip."]})
        
        reminder = serializer.save(user=self.request.custom_user)
        
        # Determine if this is a snooze based on title prefix
        is_snooze = reminder.title.startswith('[SNOOZED]')
        
        # Only create feedback notifications/pushes for FETCH creations, not snoozes
        if not is_snooze:
            # Create an in-app notification for immediate feedback
            from django.utils import timezone
            local_time = timezone.localtime(reminder.remind_at)
            from .models import Notification
            Notification.objects.create(
                user=reminder.user,
                title="Reminder Set",
                message=f"I'll remind you about '{reminder.title}' at {local_time.strftime('%H:%M')}.",
                type='success'
            )

            # Send immediate push for creation feedback
            try:
                self.send_immediate_push(reminder)
            except Exception:
                pass

class PushSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PushSubscriptionSerializer
    permission_classes = [IsCustomAuthenticated]

    def get_queryset(self):
        return PushSubscription.objects.filter(user=self.request.custom_user)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        
        # Standard PushSubscription object has endpoint and keys {p256dh, auth}
        if 'endpoint' in data and 'keys' in data:
            keys = data.get('keys', {})
            data['p256dh'] = keys.get('p256dh')
            data['auth'] = keys.get('auth')
            
        endpoint = data.get('endpoint')
        if endpoint:
            sub = PushSubscription.objects.filter(endpoint=endpoint).first()
            if sub:
                serializer = self.get_serializer(sub, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()
                return Response(serializer.data)
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(user=self.request.custom_user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
