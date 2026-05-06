from django.db import models
from django.utils import timezone

class Notification(models.Model):
    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=100)
    message = models.TextField()
    type = models.CharField(max_length=20, default='info')
    unread = models.BooleanField(default=True)
    link = models.CharField(max_length=255, blank=True, null=True)
    target_position = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} for {self.user.name if hasattr(self.user, 'name') else self.user.employee_id}"

    class Meta:
        ordering = ['-created_at']

class Reminder(models.Model):
    CATEGORY_CHOICES = [
        ('trip_start', 'Trip Starting'),
        ('advance_request', 'Advance Request'),
        ('expense_entry', 'Expense Entry'),
        ('claim_submission', 'Claim Submission'),
        ('other', 'Other Reminder'),
    ]

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='reminders')
    trip = models.ForeignKey('travel.Trip', on_delete=models.CASCADE, null=True, blank=True, related_name='reminders')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    title = models.CharField(max_length=100)
    message = models.TextField(blank=True, null=True)
    remind_at = models.DateTimeField()
    is_sent = models.BooleanField(default=False)
    acknowledged = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Reminder: {self.title} for {self.user.employee_id} at {self.remind_at}"

    class Meta:
        ordering = ['remind_at']

class PushSubscription(models.Model):
    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.URLField(max_length=500, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    browser = models.CharField(max_length=50, blank=True, null=True)
    device_type = models.CharField(max_length=50, default='Web')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Push Sub for {self.user.employee_id} ({self.browser})"
