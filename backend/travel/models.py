from django.db import models
import random
import datetime
import re
from django.conf import settings
from django.utils import timezone

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(is_deleted=False)

    def all_with_deleted(self):
        return super().get_queryset()

class SoftDeleteModel(models.Model):
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='+')

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract = True

    def delete(self, using=None, keep_parents=False):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        if hasattr(self, 'status'):
            self.status = False
        self.save()

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        if hasattr(self, 'status'):
            self.status = True
        self.save()

class Trip(SoftDeleteModel):
    COMPOSITION_CHOICES = [
        ('Solo', 'Solo Travel'),
        ('Mutual', 'Mutual (2 Teams)'),
        ('Group', 'Group Travel (3+)'),
    ]

    TRAVEL_MODE_CHOICES = [
        ('Airways', 'Airways'),
        ('Train', 'Train'),
        ('Bus', 'Bus'),
        ('Car / Jeep / Van', 'Car / Jeep / Van'),
        ('LCV', 'LCV (Light Commercial Vehicle)'),
        ('Bus / Truck (2 Axle)', 'Bus / Truck (2 Axle)'),
        ('3-Axle Commercial', '3-Axle Commercial'),
        ('MAV (4-6 Axle)', 'MAV (Multi-Axle Vehicle 4-6)'),
        ('Oversized (7+ Axle)', 'Oversized Vehicle (7+ Axle)'),
        ('2 Wheeler', '2 Wheeler (Non-Tollable)'),
        ('3 Wheeler', '3 Wheeler (Non-Tollable)'),
    ]

    VEHICLE_TYPE_CHOICES = [
        ('Own', 'Own Vehicle'),
        ('Service', 'Service / Outsourced'),
    ]

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='trips', null=True, blank=True)
    requester_position = models.CharField(max_length=50, null=True, blank=True)
    trip_id = models.CharField(max_length=100, unique=True, primary_key=True, editable=False)
    source = models.CharField(max_length=100) 
    destination = models.CharField(max_length=100) 
    route_path = models.ForeignKey('travel_masters.RoutePath', on_delete=models.SET_NULL, null=True, blank=True)
    en_route = models.CharField(max_length=255, blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField()
    composition = models.CharField(max_length=20, choices=COMPOSITION_CHOICES, default='Solo')
    purpose = models.TextField()
    travel_mode = models.CharField(max_length=20, choices=TRAVEL_MODE_CHOICES, default='Airways')
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPE_CHOICES, blank=True, null=True)
    members = models.JSONField(default=list, blank=True) 
    trip_leader = models.CharField(max_length=100, default='Self (Creator)')
    accommodation_requests = models.JSONField(default=list, blank=True) 
    lifecycle_events = models.JSONField(default=list, blank=True) 
    project_code = models.CharField(max_length=100, default='General', blank=True)
    consider_as_local = models.BooleanField(default=True)
    current_approver = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='trips_to_approve')
    approver_position = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=50, default='Submitted') # Submitted, Forwarded, Manager Approved, Approved, Rejected, Completed
    hierarchy_level = models.IntegerField(default=1) # 1: Manager, 2: Senior Manager, 3: Director
    cost_estimate = models.CharField(max_length=50, default='₹0 (Estimated)')
    # Snapshot fields for resilience during API downtime
    user_name = models.CharField(max_length=255, null=True, blank=True)
    user_designation = models.CharField(max_length=255, null=True, blank=True)
    user_department = models.CharField(max_length=255, null=True, blank=True)
    reporting_manager_name = models.CharField(max_length=255, null=True, blank=True)
    senior_manager_name = models.CharField(max_length=255, null=True, blank=True)
    hod_director_name = models.CharField(max_length=255, null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    rejected_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_trips')
    fuel_rate_snapshot = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    executive_approved_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    # Full ordered approval chain, populated at submission time
    approval_chain = models.JSONField(default=list, blank=True)

    # Finance/Payment fields (Aligned with TravelClaim/TravelAdvance)
    payment_mode = models.CharField(max_length=50, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    payment_date = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_trips')
    finance_remarks = models.TextField(blank=True, null=True)
    paid_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        
        if not self.trip_id:
            if self.consider_as_local:
                # 1. Project Code
                proj = (self.project_code or 'GS').upper()
                if proj == 'GENERAL': proj = 'GS'
                
                # 2. Branch Code
                branch = 'GEN'
                if self.user:
                    base_loc = self.user.base_location
                    if base_loc:
                        try:
                            clean_loc = re.sub(r'[^a-zA-Z0-9-]', '', base_loc)
                            branch = clean_loc.upper()
                        except:
                            pass
                
                # 3. MonthYear (e.g., apr26) – use english abbreviation to avoid locale issues
                import calendar
                ref_date = self.start_date or datetime.date.today()
                month_year = f"{calendar.month_abbr[ref_date.month].lower()}{str(ref_date.year)[-2:]}"
                
                # 4. Generate & Check Uniqueness
                base_id = f"ITS-{proj}-{branch}-{month_year}"
                generated_id = base_id
                
                seq = 1
                while Trip.all_objects.filter(trip_id=generated_id).exists():
                    generated_id = f"{base_id}-{seq:02d}"
                    seq += 1
                
                self.trip_id = generated_id
            else:
                # Legacy / Trip ID format
                current_year = datetime.datetime.now().year
                random_number = random.randint(1000, 9999)
                self.trip_id = f"TRP-{current_year}-{random_number}"
                
                while Trip.all_objects.filter(trip_id=self.trip_id).exists():
                    random_number = random.randint(1000, 9999)
                    self.trip_id = f"TRP-{current_year}-{random_number}"
        
        if is_new and not self.lifecycle_events:
            requester_name = self.user_name or (self.user.name if self.user else 'User')
            self.lifecycle_events = [{
                "title": "Trip Requested",
                "status": "completed",
                "date": datetime.datetime.now().strftime("%b %d, %Y"),
                "description": f"Travel request initiated by {requester_name}."
            }]
        
        super().save(*args, **kwargs)

    @property
    def reporting_manager(self):
        return self.user.reporting_manager if self.user else None

    @property
    def senior_manager(self):
        return self.user.senior_manager if self.user else None

    @property
    def hod_director(self):
        return self.user.hod_director if self.user else None

    def __str__(self):
        return f"{self.trip_id} - {self.destination}"

    class Meta:
        ordering = ['-created_at']

class TripOdometer(SoftDeleteModel):
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name='odometer_details')
    
    start_odo_reading = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    start_odo_image = models.TextField(null=True, blank=True)
    start_odo_lat = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    start_odo_long = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    
    end_odo_reading = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    end_odo_image = models.TextField(null=True, blank=True)
    end_odo_lat = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    end_odo_long = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Odometer for {self.trip.trip_id}"

    class Meta:
        ordering = ['-created_at']

class TripTracking(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='tracking_history')
    latitude = models.DecimalField(max_digits=20, decimal_places=10)
    longitude = models.DecimalField(max_digits=20, decimal_places=10)
    timestamp = models.DateTimeField(default=timezone.now)
    accuracy = models.FloatField(null=True, blank=True)
    speed = models.FloatField(null=True, blank=True)

    class Meta:
        ordering = ['timestamp']
        verbose_name = "Trip Tracking"
        verbose_name_plural = "Trip Tracking Points"

    def __str__(self):
        return f"Tracking for {self.trip_id} at {self.timestamp}"


class TripGeofenceLocationSet(models.Model):
    """
    Separate table which saves the entire trip or travel related geofence location
    saved in a single row as a JSON array (set of locations).
    """
    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name='geofence_set')
    location_data = models.JSONField(default=list) 
    last_latitude = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-last_updated']
        verbose_name = "Trip Geofence Location Set"
        verbose_name_plural = "Trip Geofence Location Sets"

    def __str__(self):
        return f"Geofence Locations for {self.trip.trip_id}"


class Expense(SoftDeleteModel):
    CATEGORY_CHOICES = [
        ('Food', 'Food & Refreshments'),
        ('Fuel', 'Fuel / Mileage'),
        ('Accommodation', 'Hotel & Stay'),
        ('Toll', 'Toll & Parking'),
        ('Incidental', 'Incidental Expenses'),
        ('Others', 'Miscellaneous'),
    ]

    PAID_BY_CHOICES = [
        ('Self (Out of Pocket)', 'Self (Out of Pocket)'),
        ('Company Paid', 'Company Paid'),
        ('Corporate Card', 'Corporate Card')
    ]

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='expenses')
    date = models.DateField()
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    paid_by = models.CharField(max_length=50, choices=PAID_BY_CHOICES, default='Self (Out of Pocket)')
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='Pending') # Pending, Approved, Rejected
    receipt_image = models.TextField(null=True, blank=True) 
    latitude = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    longitude = models.DecimalField(max_digits=20, decimal_places=10, null=True, blank=True)
    rm_remarks = models.TextField(blank=True, null=True)
    hr_remarks = models.TextField(blank=True, null=True)
    is_deviated = models.BooleanField(default=False)
    deviation_reason = models.TextField(blank=True, null=True)
    deviation_target = models.CharField(max_length=255, blank=True, null=True)
    planned_origin = models.CharField(max_length=255, blank=True, null=True)
    planned_destination = models.CharField(max_length=255, blank=True, null=True)
    finance_remarks = models.TextField(blank=True, null=True)
    row_index = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # New fields for Long Distance Travel Enhancement
    travel_mode = models.CharField(max_length=50, blank=True, null=True)
    class_type = models.CharField(max_length=50, blank=True, null=True)
    booking_reference = models.CharField(max_length=100, blank=True, null=True)
    refundable_flag = models.BooleanField(default=False)
    meal_included_flag = models.BooleanField(default=False)
    vehicle_type = models.CharField(max_length=50, blank=True, null=True)
    odo_start = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    odo_end = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    distance = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cancellation_status = models.CharField(max_length=50, blank=True, null=True)
    cancellation_date = models.DateField(null=True, blank=True)
    refund_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    cancellation_reason = models.TextField(blank=True, null=True)

    # --- Entitlement / HR Approval fields ---
    # City type resolved from trip destination's cluster_category:
    #   Metropolitan  → 'State HQ'
    #   Town / City   → 'Districts'
    #   Anything else → 'Others'
    city_type_resolved = models.CharField(
        max_length=20, null=True, blank=True,
        help_text="State HQ / Districts / Others — auto-resolved from destination cluster_category"
    )
    # Policy maximum for this expense line (filled when claim is submitted / HR opens it)
    allowed_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Max reimbursable amount per cadre entitlement rule"
    )
    # Amount HR decided to approve for this line
    hr_selected_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Final amount HR approved for this expense line"
    )
    hr_amount_source = models.CharField(
        max_length=10, null=True, blank=True,
        choices=[
            ('claimed', 'Claimed Amount'),
            ('allowed', 'Allowed Amount'),
            ('manual',  'Manually Edited'),
        ],
        help_text="Which amount HR chose or whether they manually edited"
    )
    # Amount Finance decided to approve for this line
    finance_selected_amount = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text="Final amount Finance approved for this expense line"
    )
    finance_amount_source = models.CharField(
        max_length=10, null=True, blank=True,
        choices=[
            ('claimed', 'Claimed Amount'),
            ('allowed', 'Allowed Amount'),
            ('manual',  'Manually Edited'),
        ],
        help_text="Which amount Finance chose or whether they manually edited"
    )
    # Short note explaining any policy deviation (e.g. 'Exceeds class entitlement')
    policy_note = models.CharField(
        max_length=255, null=True, blank=True,
        help_text="Auto-generated note about entitlement status for HR reference"
    )

    def __str__(self):
        return f"{self.category} - {self.amount} for {self.trip.trip_id}"

    class Meta:
        ordering = ['-date']

class TravelClaim(SoftDeleteModel):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Manager Approved', 'Manager Approved'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Under Process', 'Under Process'),
        ('Transferred', 'Transferred'),
        ('Rejected by Finance', 'Rejected by Finance'),
        ('Paid', 'Paid'),
        ('PENDING_HR', 'Pending HR Approval'),
        ('PENDING_EXECUTIVE', 'Pending Finance Executive'),
        ('PENDING_HEAD', 'Pending Finance Head'),
        ('PENDING_FINAL_RELEASE', 'Pending Final Release'),
        ('REJECTED_BY_HEAD', 'Rejected by Finance Head'),
        ('PARTIALLY_COMPLETED', 'Partially Completed'),
    ]

    HEAD_ACTION_CHOICES = [
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    trip = models.OneToOneField(Trip, on_delete=models.CASCADE, related_name='claim')
    requester_position = models.CharField(max_length=50, null=True, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    approved_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    hr_approved_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    executive_approved_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    
    current_approver = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='claims_to_approve')
    approver_position = models.CharField(max_length=50, null=True, blank=True)
    sent_by_executive = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_claims')
    final_executive = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='final_processed_claims')
    
    hierarchy_level = models.IntegerField(default=1)
    submitted_at = models.DateTimeField(null=True, blank=True)
    remarks = models.TextField(blank=True)
    has_deviations = models.BooleanField(default=False)
    deviation_summary = models.TextField(blank=True)
    planned_origin = models.CharField(max_length=255, blank=True, null=True)
    planned_destination = models.CharField(max_length=255, blank=True, null=True)
    
    # Finance/Payment fields
    payment_mode = models.CharField(max_length=50, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    receipt_file = models.TextField(null=True, blank=True)
    head_action = models.CharField(max_length=20, choices=HEAD_ACTION_CHOICES, null=True, blank=True)
    payment_date = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_claims')
    finance_remarks = models.TextField(blank=True)
    
    # Snapshot fields for resilience
    user_name = models.CharField(max_length=255, null=True, blank=True)
    user_designation = models.CharField(max_length=255, null=True, blank=True)
    user_department = models.CharField(max_length=255, null=True, blank=True)
    reporting_manager_name = models.CharField(max_length=255, null=True, blank=True)
    senior_manager_name = models.CharField(max_length=255, null=True, blank=True)
    hod_director_name = models.CharField(max_length=255, null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    rejected_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_claims')
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def user(self):
        return self.trip.user if self.trip else None

    @property
    def reporting_manager(self):
        return self.user.reporting_manager if self.user else None

    @property
    def senior_manager(self):
        return self.user.senior_manager if self.user else None

    @property
    def hod_director(self):
        return self.user.hod_director if self.user else None

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Claim for {self.trip.trip_id} - {self.status}"

class TravelAdvance(SoftDeleteModel):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Manager Approved', 'Manager Approved'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
        ('Under Process', 'Under Process'),
        ('Transferred', 'Transferred'),
        ('Rejected by Finance', 'Rejected by Finance'),
        ('Paid', 'Paid'),
        ('PENDING_HR', 'Pending HR Approval'),
        ('PENDING_EXECUTIVE', 'Pending Finance Executive'),
        ('PENDING_HEAD', 'Pending Finance Head'),
        ('PENDING_FINAL_RELEASE', 'Pending Final Release'),
        ('REJECTED_BY_HEAD', 'Rejected by Finance Head'),
        ('COMPLETED', 'Completed'),
        ('PARTIALLY_COMPLETED', 'Partially Completed'),
    ]

    HEAD_ACTION_CHOICES = [
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='advances')
    requester_position = models.CharField(max_length=50, null=True, blank=True)
    requested_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    hr_approved_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    executive_approved_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='Draft')
    
    current_approver = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='advances_to_approve')
    approver_position = models.CharField(max_length=50, null=True, blank=True)
    sent_by_executive = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='sent_advances')
    final_executive = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='final_processed_advances')
    
    hierarchy_level = models.IntegerField(default=1)
    purpose = models.TextField(blank=True)
    hr_remarks = models.TextField(blank=True, null=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    
    # Finance/Payment fields
    payment_mode = models.CharField(max_length=50, blank=True, null=True)
    transaction_id = models.CharField(max_length=100, blank=True, null=True)
    receipt_file = models.TextField(null=True, blank=True)
    head_action = models.CharField(max_length=20, choices=HEAD_ACTION_CHOICES, null=True, blank=True)
    payment_date = models.DateTimeField(null=True, blank=True)
    processed_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='processed_advances')
    finance_remarks = models.TextField(blank=True)
    
    # Snapshot fields for resilience
    user_name = models.CharField(max_length=255, null=True, blank=True)
    user_designation = models.CharField(max_length=255, null=True, blank=True)
    user_department = models.CharField(max_length=255, null=True, blank=True)
    reporting_manager_name = models.CharField(max_length=255, null=True, blank=True)
    senior_manager_name = models.CharField(max_length=255, null=True, blank=True)
    hod_director_name = models.CharField(max_length=255, null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    rejected_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_advances')
    paid_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def user(self):
        return self.trip.user if self.trip else None

    @property
    def reporting_manager(self):
        return self.user.reporting_manager if self.user else None

    @property
    def senior_manager(self):
        return self.user.senior_manager if self.user else None

    @property
    def hod_director(self):
        return self.user.hod_director if self.user else None

    def __str__(self):
        return f"Advance for {self.trip.trip_id} - {self.status}"

    class Meta:
        ordering = ['-created_at']

class Dispute(SoftDeleteModel):
    CATEGORY_CHOICES = [
        ('Mileage', 'Mileage / GPS Variance'),
        ('Expense', 'Expense Rejection'),
        ('Policy', 'Policy Violation'),
        ('Other', 'Other'),
    ]

    STATUS_CHOICES = [
        ('Open', 'Open'),
        ('In Review', 'In Review'),
        ('Resolved', 'Resolved'),
        ('Rejected', 'Rejected'),
    ]

    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='disputes')
    expense = models.ForeignKey(Expense, on_delete=models.CASCADE, null=True, blank=True, related_name='disputes')
    raised_by = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='disputes')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    reason = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Open')
    admin_comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Dispute {self.id} - {self.trip.trip_id} - {self.status}"

    class Meta:
        ordering = ['-created_at']

class PolicyDocument(models.Model):
    title = models.CharField(max_length=200)
    category = models.CharField(max_length=50, default='General')
    
    # English
    file_content_en = models.TextField(blank=True, null=True)
    file_name_en = models.CharField(max_length=255, blank=True, null=True)
    file_size_en = models.CharField(max_length=50, blank=True, null=True)
    
    # Telugu
    file_content_te = models.TextField(blank=True, null=True)
    file_name_te = models.CharField(max_length=255, blank=True, null=True)
    file_size_te = models.CharField(max_length=50, blank=True, null=True)
    
    # Hindi
    file_content_hi = models.TextField(blank=True, null=True)
    file_name_hi = models.CharField(max_length=255, blank=True, null=True)
    file_size_hi = models.CharField(max_length=50, blank=True, null=True)
    
    uploaded_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    class Meta:
        ordering = ['-created_at']

class BulkActivityBatch(SoftDeleteModel):
    STATUS_CHOICES = [
        ('Draft', 'Draft'),
        ('Submitted', 'Submitted'),
        ('Approved', 'Approved'),
        ('Rejected', 'Rejected'),
    ]

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='activity_batches')
    requester_position = models.CharField(max_length=50, null=True, blank=True)
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='activity_batches', null=True, blank=True)
    file_name = models.CharField(max_length=255)
    
    # Store the actual rows in JSON temporarily until approval
    data_json = models.JSONField(default=list) 
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Draft')
    current_approver = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='batches_to_approve')
    approver_position = models.CharField(max_length=50, null=True, blank=True)
    hierarchy_level = models.IntegerField(default=1) 
    remarks = models.TextField(blank=True, null=True)
    
    # To track which expenses were created from this batch
    created_expenses = models.JSONField(default=list, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Batch {self.id} - {self.user.name} ({self.status})"

    class Meta:
        ordering = ['-created_at']


class JobReport(SoftDeleteModel):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='job_reports')
    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='job_reports', null=True)
    description = models.TextField()
    attachment = models.TextField(null=True, blank=True) # Base64 encoded PDF
    file_name = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Job Report for {self.trip.trip_id} by {self.user.name}"

    class Meta:
        ordering = ['-created_at']


# --- MASTER TABLES ---

# --- MASTER TABLES (TRAVEL MODULE) ---

class TravelModeMaster(SoftDeleteModel):
    mode_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class BookingTypeMaster(SoftDeleteModel):
    booking_type = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class OperatorMaster(SoftDeleteModel):
    operator_name = models.CharField(max_length=100, unique=True)
    is_flight = models.BooleanField(default=False)
    is_train = models.BooleanField(default=False)
    is_bus = models.BooleanField(default=False)
    key = models.CharField(max_length=100, unique=True, null=True, blank=True)
    status = models.BooleanField(default=True)

class TravelClassMaster(SoftDeleteModel):
    class_name = models.CharField(max_length=100, unique=True)
    is_flight = models.BooleanField(default=False)
    is_train = models.BooleanField(default=False)
    is_bus = models.BooleanField(default=False)
    key = models.CharField(max_length=100, unique=True, null=True, blank=True)
    status = models.BooleanField(default=True)

class VehicleMaster(SoftDeleteModel):
    vehicle_name = models.CharField(max_length=100, unique=True)
    is_bus = models.BooleanField(default=False)
    is_intercity_cab = models.BooleanField(default=False)
    key = models.CharField(max_length=100, unique=True, null=True, blank=True)
    status = models.BooleanField(default=True)

class ProviderMaster(SoftDeleteModel):
    provider_name = models.CharField(max_length=100, unique=True)
    is_flight = models.BooleanField(default=False)
    is_train = models.BooleanField(default=False)
    is_bus = models.BooleanField(default=False)
    is_intercity_cab = models.BooleanField(default=False)
    key = models.CharField(max_length=100, null=True, blank=True)
    status = models.BooleanField(default=True)

class TicketStatusMaster(SoftDeleteModel):
    status_name = models.CharField(max_length=100, unique=True)
    is_flight = models.BooleanField(default=False)
    is_train = models.BooleanField(default=False)
    is_bus = models.BooleanField(default=False)
    is_intercity_cab = models.BooleanField(default=False)
    status = models.BooleanField(default=True)

class QuotaTypeMaster(SoftDeleteModel):
    quota_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

# --- MASTER TABLES (LOCAL CONVEYANCE MODULE) ---

class LocalTravelModeMaster(SoftDeleteModel):
    mode_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class LocalProviderMaster(SoftDeleteModel):
    provider_name = models.CharField(max_length=100, unique=True)
    is_car = models.BooleanField(default=False)
    is_bike = models.BooleanField(default=False)
    is_auto = models.BooleanField(default=False)
    is_bus = models.BooleanField(default=False)
    is_metro = models.BooleanField(default=False)
    key = models.CharField(max_length=100, null=True, blank=True)
    status = models.BooleanField(default=True)

class LocalSubTypeMaster(SoftDeleteModel):
    sub_type = models.CharField(max_length=100, unique=True)
    is_car = models.BooleanField(default=False)
    is_bike = models.BooleanField(default=False)
    is_auto = models.BooleanField(default=False)
    key = models.CharField(max_length=100, unique=True, null=True, blank=True)
    status = models.BooleanField(default=True)

# --- MASTER TABLES (STAY & LODGING MODULE) ---

class StayTypeMaster(SoftDeleteModel):
    stay_type = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class RoomTypeMaster(SoftDeleteModel):
    room_type = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class StayBookingTypeMaster(SoftDeleteModel):
    booking_type = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class StayBookingSourceMaster(SoftDeleteModel):
    source_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

# --- MASTER TABLES (FOOD & REFRESHMENTS MODULE) ---

class MealCategoryMaster(SoftDeleteModel):
    category_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class MealTypeMaster(SoftDeleteModel):
    meal_type = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class MealSourceMaster(SoftDeleteModel):
    source_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

class MealProviderMaster(SoftDeleteModel):
    provider_name = models.CharField(max_length=100, unique=True)
    status = models.BooleanField(default=True)

# --- MASTER TABLES (INCIDENTAL MODULE) ---

class IncidentalTypeMaster(SoftDeleteModel):
    CATEGORY_CHOICES = [
        ('local_conveyance', 'Local Conveyance'),
        ('travel_incidental', 'Travel Incidental'),
        ('general_incidental', 'General Incidental'),
    ]
    expense_type = models.CharField(max_length=100)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='travel_incidental')
    status = models.BooleanField(default=True)

    class Meta:
        unique_together = ('expense_type', 'category')

# --- DYNAMIC MASTER SYSTEM ---

class MasterModule(SoftDeleteModel):
    name = models.CharField(max_length=100, unique=True)
    display_order = models.IntegerField(default=0)
    status = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class CustomMasterDefinition(SoftDeleteModel):
    table_name = models.CharField(max_length=100, unique=True)
    module_ref = models.ForeignKey(MasterModule, on_delete=models.CASCADE, related_name='tables', null=True, blank=True)
    module = models.CharField(max_length=50, blank=True, null=True) # Legacy
    api_endpoint = models.CharField(max_length=255, blank=True, null=True) # For system tables
    fields_list = models.TextField(default='name,code') # Comma separated list of fields
    is_system = models.BooleanField(default=False)
    status = models.BooleanField(default=True)

    def __str__(self):
        return self.table_name

class CustomMasterValue(SoftDeleteModel):
    definition = models.ForeignKey(CustomMasterDefinition, on_delete=models.CASCADE, related_name='values')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=100, blank=True, null=True)
    status = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['definition', 'name'], name='unique_name_per_definition')
        ]

    def __str__(self):
        return f"{self.definition.table_name} - {self.name}"

class HistoricalTripStop(models.Model):
    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='historical_stops')
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='historical_stops', null=True, blank=True)
    location_name = models.CharField(max_length=255)
    latitude = models.DecimalField(max_digits=20, decimal_places=10)
    longitude = models.DecimalField(max_digits=20, decimal_places=10)
    arrival_time = models.DateTimeField()
    departure_time = models.DateTimeField(null=True, blank=True)
    duration_minutes = models.IntegerField(default=0)
    date = models.DateField(db_index=True)

    class Meta:
        ordering = ['arrival_time']
        verbose_name = "Historical Trip Stop"
        verbose_name_plural = "Historical Trip Stops"

    def __str__(self):
        return f"Stop at {self.location_name} for {self.user.name} on {self.date}"

class FinanceWorkflowStep(SoftDeleteModel):
    VISIBILITY_CHOICES = [
        ('INBOX', 'Inbox Only'),
        ('FINANCE_HUB', 'Finance Hub Only'),
        ('BOTH', 'Both Inbox and Finance Hub'),
    ]

    TRIP_TYPE_CHOICES = [
        ('BOTH', 'Both Trip & Travel'),
        ('TRIP', 'Trip Only (Local)'),
        ('TRAVEL', 'Travel Only (Outstation)'),
        ('NONE', 'None'),
    ]

    TRIP_CONTROL_CHOICES = [
        ('APPROVAL', 'Approval'),
        ('MARK_READ', 'Mark as Read'),
    ]

    user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='finance_workflow_steps', null=True, blank=True)
    position_id = models.CharField(max_length=50, null=True, blank=True)
    position_name = models.CharField(max_length=100, null=True, blank=True)
    
    sequence_order = models.PositiveIntegerField(unique=True)
    can_edit_amount = models.BooleanField(default=False)
    visibility_type = models.CharField(max_length=20, choices=VISIBILITY_CHOICES, default='INBOX')
    is_active = models.BooleanField(default=True)
    
    trip_type = models.CharField(max_length=20, choices=TRIP_TYPE_CHOICES, default='BOTH')
    trip_control = models.CharField(max_length=20, choices=TRIP_CONTROL_CHOICES, default='APPROVAL')
    can_view_reports = models.BooleanField(default=False)

    class Meta:
        ordering = ['sequence_order']
        verbose_name = "Finance Workflow Step"
        verbose_name_plural = "Finance Workflow Steps"

    def __str__(self):
        name = self.position_name or (self.user.name if self.user else 'Unknown')
        return f"Step {self.sequence_order}: {name} ({self.visibility_type})"


class FinanceIntimation(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='finance_intimations')
    finance_user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='finance_intimations')
    finance_position = models.CharField(max_length=50, blank=True)
    is_approval = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Finance Intimation"
        verbose_name_plural = "Finance Intimations"

    def __str__(self):
        return f"Finance Intimation: {self.finance_user.name} for Trip {self.trip.trip_id} (Approval: {self.is_approval})"

class HRPositionConfig(SoftDeleteModel):
    TRIPS_APPROVAL_CHOICES = [
        ('MARK_READ', 'Mark as Read'),
        ('APPROVAL', 'Formal Approval'),
    ]
    BULK_APPROVAL_CHOICES = [
        ('MARK_READ', 'Mark as Read'),
        ('APPROVAL', 'Formal Approval'),
    ]
    CLAIMS_APPROVAL_CHOICES = [
        ('MARK_READ', 'Mark as Read'),
        ('APPROVAL', 'Formal Approval'),
    ]
    EDIT_CLAIMS_CHOICES = [
        ('READ_ONLY', 'Read Only'),
        ('CAN_EDIT', 'Can Edit'),
    ]

    position_id = models.CharField(max_length=50)
    position_name = models.CharField(max_length=100)
    department_name = models.CharField(max_length=100, null=True, blank=True)
    can_approve = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sequence_order = models.PositiveIntegerField(default=1)
    project_code = models.CharField(max_length=100, default='General', blank=True)
    trips_approval = models.CharField(max_length=20, choices=TRIPS_APPROVAL_CHOICES, default='MARK_READ')
    bulk_approval = models.CharField(max_length=20, choices=BULK_APPROVAL_CHOICES, default='MARK_READ')
    claims_approval = models.CharField(max_length=20, choices=CLAIMS_APPROVAL_CHOICES, default='MARK_READ')
    edit_claims = models.CharField(max_length=20, choices=EDIT_CLAIMS_CHOICES, default='READ_ONLY')
    can_view_reports = models.BooleanField(default=False)

    class Meta:
        verbose_name = "HR Position Configuration"
        verbose_name_plural = "HR Position Configurations"
        ordering = ['sequence_order']

    def __str__(self):
        return f"HR Position: {self.position_name} ({self.position_id}) for Project {self.project_code}"

class HRIntimation(models.Model):
    trip = models.ForeignKey(Trip, on_delete=models.CASCADE, related_name='hr_intimations', null=True, blank=True)
    claim = models.ForeignKey(TravelClaim, on_delete=models.CASCADE, related_name='hr_intimations', null=True, blank=True)
    advance = models.ForeignKey(TravelAdvance, on_delete=models.CASCADE, related_name='hr_intimations', null=True, blank=True)
    
    hr_user = models.ForeignKey('core.User', on_delete=models.CASCADE, related_name='hr_intimations')
    hr_position = models.CharField(max_length=50, null=True, blank=True)
    is_approval = models.BooleanField(default=False)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "HR Intimation"
        verbose_name_plural = "HR Intimations"

    def __str__(self):
        target = self.trip or self.claim or self.advance
        return f"Intimation for {target} to {self.hr_user.name} ({'Read' if self.is_read else 'Unread'})"



