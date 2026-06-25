from django.db import models
from travel.models import SoftDeleteModel

class Location(SoftDeleteModel):
    external_id = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    location_type = models.CharField(max_length=50) # Continent, Country, Region, State, City, Site
    code = models.CharField(max_length=50, null=True, blank=True)
    parent_id = models.CharField(max_length=50, null=True, blank=True)
    # From Location API geo_location: Metropolitan, Town, City, Rural, Village, Panchayat, etc.
    # Used to resolve policy city-type: Metropolitan=State HQ, Town/City=Districts, else=Others
    cluster_category = models.CharField(max_length=100, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.location_type})"

class Route(SoftDeleteModel):
    route_code = models.CharField(max_length=20, unique=True, null=True, blank=True)
    name = models.CharField(max_length=255, blank=True)
    source = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='routes_starting_here')
    destination = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='routes_ending_here')
    
    def save(self, *args, **kwargs):
        # 1. Update Name (Clean Format: SOURCE-DEST)
        source_label = self.source.code or self.source.name
        dest_label = self.destination.code or self.destination.name
        self.name = f"{source_label} TO {dest_label}".upper()

        # 2. Assign Route Code (Starts from 10001)
        if not self.route_code:
            while True:
                # Find the highest existing route code that is actually a number
                last_route = Route.all_objects.exclude(route_code__isnull=True).exclude(route_code='').order_by('-route_code').first()
                if last_route and last_route.route_code and last_route.route_code.isdigit():
                    next_code = str(int(last_route.route_code) + 1)
                else:
                    next_code = "10001"
                
                # Double check to prevent IntegrityError specifically if ordering by string was weird
                if not Route.all_objects.filter(route_code=next_code).exists():
                    self.route_code = next_code
                    break
                else:
                    # In case of string order collision (e.g. '9999' > '10000'), increment until free
                    # We just need to find the max by casting to integer if possible, but an iterative check is safer
                    max_code = 10000
                    for r in Route.all_objects.exclude(route_code__isnull=True).exclude(route_code='').values_list('route_code', flat=True):
                        if r.isdigit() and int(r) > max_code:
                            max_code = int(r)
                    self.route_code = str(max_code + 1)
                    break
                
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class RoutePath(SoftDeleteModel):
    route = models.ForeignKey(Route, on_delete=models.CASCADE, related_name='paths')
    path_name = models.CharField(max_length=255, help_text="e.g., Via NH-44")
    via_locations = models.JSONField(default=list, help_text="Ordered list of location IDs")
    is_default = models.BooleanField(default=False)
    distance_km = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    segment_data = models.JSONField(default=dict, blank=True, help_text="Distances between segments")
    latitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    longitude = models.DecimalField(max_digits=12, decimal_places=9, null=True, blank=True)
    
    def __str__(self):
        return f"{self.route.name} - {self.path_name}"

class TollGate(SoftDeleteModel):
    gate_code = models.CharField(max_length=4, unique=True, null=True, blank=True, help_text="Auto-generated 4-digit gate code")
    registered_id = models.CharField(max_length=50, null=True, blank=True, help_text="Manual Registered ID")
    name = models.CharField(max_length=200, unique=True)
    location = models.OneToOneField(Location, on_delete=models.SET_NULL, null=True, blank=True)
    gps_coordinates = models.CharField(max_length=100, blank=True)

    def save(self, *args, **kwargs):
        if not self.gate_code:
            while True:
                last = TollGate.all_objects.exclude(gate_code__isnull=True).exclude(gate_code='').order_by('-gate_code').first()
                if last and last.gate_code and last.gate_code.isdigit():
                    next_code = str(int(last.gate_code) + 1).zfill(4)
                else:
                    next_code = "1001"
                
                if not TollGate.all_objects.filter(gate_code=next_code).exists():
                    self.gate_code = next_code
                    break
                else:
                    max_code = 1000
                    for g in TollGate.all_objects.exclude(gate_code__isnull=True).exclude(gate_code='').values_list('gate_code', flat=True):
                        if g.isdigit() and int(g) > max_code:
                            max_code = int(g)
                    self.gate_code = str(max_code + 1).zfill(4)
                    break
        super().save(*args, **kwargs)

    def __str__(self):
        return f"[{self.gate_code}] {self.name}"

class TollRate(SoftDeleteModel):
    toll_gate = models.ForeignKey(TollGate, on_delete=models.CASCADE, related_name='rates')
    travel_mode = models.CharField(max_length=50) # e.g. 2 Wheeler, 4 Wheeler, etc.
    journey_type = models.CharField(max_length=20, default='UP', help_text="UP, DOWN, or TO_AND_FRO")
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    
    def __str__(self):
        return f"{self.toll_gate.name} - {self.travel_mode}: {self.rate}"

class RoutePathToll(SoftDeleteModel):
    path = models.ForeignKey(RoutePath, on_delete=models.CASCADE, related_name='toll_assignments')
    toll_gate = models.ForeignKey(TollGate, on_delete=models.CASCADE)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ['order']

class FuelRateMaster(SoftDeleteModel):
    state = models.CharField(max_length=100)
    vehicle_type = models.CharField(max_length=50) # '2 Wheeler' or '4 Wheeler'
    rate_per_km = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f"{self.state} - {self.vehicle_type}: {self.rate_per_km}"

    class Meta:
        unique_together = ('state', 'vehicle_type', 'is_deleted')

class Cadre(SoftDeleteModel):
    name = models.CharField(max_length=100, unique=True, help_text="e.g. ADMINISTRATIVE, MANAGERIAL - PAN INDIA")
    description = models.TextField(blank=True, null=True)
    # JSON list of designation keywords to auto-match employees to this cadre.
    # e.g. ["COO", "National Head", "Head of Dept", "Corp Affairs Head"]
    designation_keywords = models.JSONField(
        default=list,
        help_text="Designation keywords to auto-match employees. e.g. ['COO','National Head']"
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ['name']


class EligibilityRule(SoftDeleteModel):
    """
    One row per cadre covering all columns of the policy table:
    (A) Travel: Air, Train, Bus, Car, Local Conveyance
    (B) Accommodation: Company GH, State HQ, Districts, Others
    (C) Daily Allowance
    (D) Own Stay Allowance (as % of hotel limit)
    """
    cadre = models.OneToOneField(
        Cadre, on_delete=models.CASCADE, related_name='eligibility_rule',
        help_text="One rule set per cadre"
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Is this policy/entitlement rule active for this cadre?"
    )

    # --- (A) TRAVEL ---
    # Air
    air_allowed = models.BooleanField(
        default=False,
        help_text="Is air travel allowed for this cadre?"
    )
    air_class = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="e.g. Economy II A/c, On need basis, NA"
    )

    # Train
    train_allowed = models.BooleanField(default=True)
    train_class = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="e.g. Sleeper or Equivalent, III A/c or Equivalent"
    )

    # Bus
    bus_allowed = models.BooleanField(default=True)
    bus_class = models.CharField(
        max_length=100, blank=True, null=True,
        help_text="e.g. A/c. Sleeper or Equivalent, A/c. Bus or Equivalent"
    )

    # Car
    car_allowed = models.BooleanField(default=False)
    car_notes = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="e.g. At Management discretion / Company car, NA"
    )

    # Local Conveyance (Outstation)
    local_conveyance_allowed = models.BooleanField(default=True)
    local_conveyance_type = models.CharField(
        max_length=200, blank=True, null=True,
        help_text="e.g. Online Cab/3-Wheeler for Hire, 2 or 3 Wheeler, NA"
    )
    travel_rules = models.JSONField(
        default=dict, blank=True, null=True,
        help_text="Dynamic travel rules mapping mode names to list of allowed classes. e.g. {'long_distance': [], 'local_conveyance': []}"
    )

    # --- (B) ACCOMMODATION ---
    COMPANY_GH_CHOICES = [
        ('Preferred', 'Preferred (Strong Preference)'),
        ('Optional', 'Optional'),
        ('Exceptional Only', 'Exceptional Only (Hotel in rare cases)'),
    ]
    company_guest_house_status = models.CharField(
        max_length=20, choices=COMPANY_GH_CHOICES, default='Optional',
        help_text="Company Guest House policy for this cadre"
    )
    # Per-night hotel limits by city type (resolved from Location API cluster_category)
    accommodation_state_hq = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Max per-night hotel cost for State HQ accommodation tier"
    )
    state_hq_clusters = models.JSONField(
        default=list, blank=True, null=True,
        help_text="Cluster categories mapped to State HQ (e.g. ['Metropolitan'])"
    )
    accommodation_districts = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Max per-night hotel cost for Districts accommodation tier"
    )
    districts_clusters = models.JSONField(
        default=list, blank=True, null=True,
        help_text="Cluster categories mapped to Districts (e.g. ['Town', 'City'])"
    )
    accommodation_others = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Max per-night hotel cost for Others accommodation tier"
    )
    others_clusters = models.JSONField(
        default=list, blank=True, null=True,
        help_text="Cluster categories mapped to Others (e.g. ['Others'])"
    )

    # --- (C) DAILY ALLOWANCE ---
    daily_allowance_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Flat daily allowance amount for this cadre"
    )

    # --- (E) ODOMETER/MILEAGE LIMIT ---
    max_mileage_km = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Maximum permitted odometer/distance limit per cadre in km"
    )

    # --- (D) OWN STAY ALLOWANCE ---
    # Stored as a percentage of the applicable hotel limit (e.g. 50 = 50%)
    own_stay_state_hq_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=50,
        help_text="% of State HQ hotel limit paid when employee stays at own accommodation"
    )
    own_stay_districts_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=50,
        help_text="% of Districts hotel limit for own stay"
    )
    own_stay_others_pct = models.DecimalField(
        max_digits=5, decimal_places=2, default=50,
        help_text="% of Others hotel limit for own stay"
    )

    # --- LAUNDRY APPLICABILITY ---
    laundry_days_threshold = models.IntegerField(
        default=4,
        help_text="Minimum stay nights in guest house for laundry to be applicable"
    )

    def get_accommodation_limit(self, city_type: str) -> float:
        """Returns the per-night hotel limit for the given city_type string."""
        ct = (city_type or '').strip().lower()
        if ct == 'state hq':
            return float(self.accommodation_state_hq)
        elif ct == 'districts':
            return float(self.accommodation_districts)
        else:
            return float(self.accommodation_others)

    def get_own_stay_limit(self, city_type: str) -> float:
        """Returns the own-stay reimbursement amount (pct × hotel limit) for given city_type."""
        ct = (city_type or '').strip().lower()
        if ct == 'state hq':
            hotel_limit = float(self.accommodation_state_hq)
            pct = float(self.own_stay_state_hq_pct)
        elif ct == 'districts':
            hotel_limit = float(self.accommodation_districts)
            pct = float(self.own_stay_districts_pct)
        else:
            hotel_limit = float(self.accommodation_others)
            pct = float(self.own_stay_others_pct)
        return round((pct / 100) * hotel_limit, 2)

    def __str__(self):
        return f"Entitlement: {self.cadre.name}"

    class Meta:
        verbose_name = 'Eligibility Rule'
        verbose_name_plural = 'Eligibility Rules'
class Circle(SoftDeleteModel):
    name = models.CharField(max_length=100)
    state = models.ForeignKey(Location, on_delete=models.CASCADE, related_name='circles', limit_choices_to={'location_type': 'State'})
    
    def __str__(self):
        return f"{self.name} ({self.state.name})"

    class Meta:
        unique_together = ('name', 'state', 'is_deleted')
        ordering = ['state__name', 'name']

class Jurisdiction(SoftDeleteModel):
    project_name = models.CharField(max_length=200)
    project_code = models.CharField(max_length=100)
    circle = models.ForeignKey(Circle, on_delete=models.CASCADE, related_name='jurisdictions')
    districts = models.ManyToManyField(Location, related_name='jurisdiction_districts', limit_choices_to={'location_type': 'District'})
    
    def __str__(self):
        return f"{self.project_name} - {self.circle.name}"

    class Meta:
        unique_together = ('project_code', 'circle', 'is_deleted')
        ordering = ['project_name', 'circle__name']

