from rest_framework import serializers
from .models import (
    Trip, TripOdometer, Expense, TravelClaim, TravelAdvance, Dispute, PolicyDocument, BulkActivityBatch, JobReport,
    TravelModeMaster, BookingTypeMaster, OperatorMaster, TravelClassMaster, VehicleMaster, ProviderMaster,
    TicketStatusMaster, QuotaTypeMaster,
    LocalTravelModeMaster, LocalProviderMaster, LocalSubTypeMaster,
    StayTypeMaster, RoomTypeMaster, StayBookingTypeMaster, StayBookingSourceMaster,
    MealCategoryMaster, MealTypeMaster, MealSourceMaster, MealProviderMaster,
    IncidentalTypeMaster, CustomMasterDefinition, CustomMasterValue, MasterModule, TripTracking
)
from api_management.utils import encrypt_key, decrypt_key

# --- MASTER SERIALIZERS ---

class TripTrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripTracking
        fields = ['id', 'trip', 'latitude', 'longitude', 'timestamp', 'accuracy', 'speed']

class TravelModeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelModeMaster
        fields = '__all__'

class BookingTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingTypeMaster
        fields = '__all__'

class OperatorMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = OperatorMaster
        fields = '__all__'

class TravelClassMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TravelClassMaster
        fields = '__all__'

class VehicleMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleMaster
        fields = '__all__'

class ProviderMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderMaster
        fields = '__all__'

class TicketStatusMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = TicketStatusMaster
        fields = '__all__'

class QuotaTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuotaTypeMaster
        fields = '__all__'

class LocalTravelModeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocalTravelModeMaster
        fields = '__all__'

class LocalProviderMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocalProviderMaster
        fields = '__all__'

class LocalSubTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = LocalSubTypeMaster
        fields = '__all__'

class StayTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = StayTypeMaster
        fields = '__all__'

class RoomTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = RoomTypeMaster
        fields = '__all__'

class StayBookingTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = StayBookingTypeMaster
        fields = '__all__'

class StayBookingSourceMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = StayBookingSourceMaster
        fields = '__all__'

class MealCategoryMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealCategoryMaster
        fields = '__all__'

class MealTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealTypeMaster
        fields = '__all__'

class MealSourceMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealSourceMaster
        fields = '__all__'

class MealProviderMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealProviderMaster
        fields = '__all__'

class IncidentalTypeMasterSerializer(serializers.ModelSerializer):
    class Meta:
        model = IncidentalTypeMaster
        fields = '__all__'

class MasterModuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MasterModule
        fields = '__all__'

class CustomMasterDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomMasterDefinition
        fields = '__all__'

class CustomMasterValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomMasterValue
        fields = '__all__'

# --- CORE SERIALIZERS ---

class PolicyDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.ReadOnlyField(source='uploaded_by.name')

    class Meta:
        model = PolicyDocument
        fields = [
            'id', 'title', 'category', 'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at',
            'file_name_en', 'file_size_en',
            'file_name_te', 'file_size_te',
            'file_name_hi', 'file_size_hi',
            'file_content_en', 'file_content_te', 'file_content_hi'
        ]
        extra_kwargs = {
            'file_content_en': {'write_only': True},
            'file_content_te': {'write_only': True},
            'file_content_hi': {'write_only': True}
        }

class PolicyDocumentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PolicyDocument
        fields = '__all__'

class TripOdometerSerializer(serializers.ModelSerializer):
    class Meta:
        model = TripOdometer
        fields = [
            'id', 'trip', 'start_odo_reading', 'start_odo_image', 'start_odo_lat', 'start_odo_long',
            'end_odo_reading', 'end_odo_image', 'end_odo_lat', 'end_odo_long',
            'updated_at'
        ]

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if representation.get('start_odo_image'):
            representation['start_odo_image'] = decrypt_key(representation['start_odo_image'])
        if representation.get('end_odo_image'):
            representation['end_odo_image'] = decrypt_key(representation['end_odo_image'])
        return representation

    def to_internal_value(self, data):
        if data.get('start_odo_image'):
            data['start_odo_image'] = encrypt_key(data['start_odo_image'])
        if data.get('end_odo_image'):
            data['end_odo_image'] = encrypt_key(data['end_odo_image'])
        return super().to_internal_value(data)

class ExpenseSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='trip.user.name')
    trip_user_id = serializers.ReadOnlyField(source='trip.user.employee_id')

    class Meta:
        model = Expense
        fields = '__all__'

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if representation.get('receipt_image'):
            representation['receipt_image'] = decrypt_key(representation['receipt_image'])
        return representation

    def to_internal_value(self, data):
        if data.get('receipt_image'):
            data['receipt_image'] = encrypt_key(data['receipt_image'])
        return super().to_internal_value(data)

    def validate(self, attrs):
        import json
        from api_management.utils import decrypt_key

        trip = attrs.get('trip')
        category = attrs.get('category')
        date = attrs.get('date')
        description_str = attrs.get('description', '{}')
        
        try:
            description = json.loads(description_str)
        except:
            description = {}

        # 1. INCIDENTAL: Duplicate entry check
        if category == 'Incidental':
            incidental_type = description.get('incidentalType')
            incidental_time = description.get('incidentalTime')
            other_reason = (description.get('otherReason') or "").strip().lower()

            if incidental_type and incidental_time:
                existing_incidental = Expense.objects.filter(trip=trip, category='Incidental', date=date)
                if self.instance:
                    existing_incidental = existing_incidental.exclude(id=self.instance.id)

                for inc_exp in existing_incidental:
                    try:
                        inc_desc = json.loads(inc_exp.description)
                        # Case-insensitive, stripped comparison for type and time
                        if ((inc_desc.get('incidentalType') or "").strip().lower() == incidental_type.strip().lower() and 
                            (inc_desc.get('incidentalTime') or "").strip() == incidental_time.strip()):
                            
                            # Special case for "Others"
                            if incidental_type.strip().lower() in ['others', 'other']:
                                if (inc_desc.get('otherReason') or "").strip().lower() == other_reason:
                                    raise serializers.ValidationError({"description": "Duplicate entry not allowed"})
                            else:
                                raise serializers.ValidationError({"description": "Duplicate entry not allowed"})
                    except json.JSONDecodeError:
                        continue

        # 2. FOOD & REFRESHMENTS: Daily Meal Limits
        if category == 'Food':
            meal_type = description.get('mealType')
            if meal_type in ['Breakfast', 'Lunch', 'Dinner']:
                existing_food = Expense.objects.filter(trip=trip, category='Food', date=date)
                if self.instance:
                    existing_food = existing_food.exclude(id=self.instance.id)
                
                for food_exp in existing_food:
                    try:
                        food_desc = json.loads(food_exp.description)
                        if (food_desc.get('mealType') or "").strip().lower() == meal_type.strip().lower():
                            raise serializers.ValidationError({"description": f"A {meal_type} entry already exists for this date."})
                    except:
                        continue

        # 3. ACCOMMODATION: Overlap & Seq Check
        if category == 'Accommodation':
            check_in = description.get('checkInDate')
            check_out = description.get('checkOutDate')
            
            if check_in and check_out:
                if check_in >= check_out:
                    raise serializers.ValidationError({"description": "Check-out date must be after Check-in date."})

                existing_stays = Expense.objects.filter(trip=trip, category='Accommodation').order_by('date')
                if self.instance:
                    existing_stays = existing_stays.exclude(id=self.instance.id)

                for stay in existing_stays:
                    try:
                        stay_desc = json.loads(stay.description)
                        s_in = stay_desc.get('checkInDate')
                        s_out = stay_desc.get('checkOutDate')
                        
                        if s_in and s_out:
                            # Check overlap
                            if (check_in < s_out) and (check_out > s_in):
                                raise serializers.ValidationError({"description": f"Stay overlaps with an existing entry ({s_in} to {s_out})."})
                    except:
                        continue

        return attrs

class TravelClaimSerializer(serializers.ModelSerializer):
    expenses = ExpenseSerializer(many=True, read_only=True, source='trip.expenses')
    
    user_name = serializers.SerializerMethodField()
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = TravelClaim
        fields = '__all__'

    def get_user_name(self, obj):
        return obj.user_name or (obj.trip.user.name if obj.trip and obj.trip.user else 'Unknown User')

    def get_reporting_manager_name(self, obj):
        return obj.reporting_manager_name or (obj.trip.user.reporting_manager.name if obj.trip and obj.trip.user and obj.trip.user.reporting_manager else None)

class TravelAdvanceSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    reporting_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = TravelAdvance
        fields = '__all__'

    def get_user_name(self, obj):
        return obj.user_name or (obj.trip.user.name if obj.trip and obj.trip.user else 'Unknown User')

    def get_reporting_manager_name(self, obj):
        return obj.reporting_manager_name or (obj.trip.user.reporting_manager.name if obj.trip and obj.trip.user and obj.user.reporting_manager else None)

class DisputeSerializer(serializers.ModelSerializer):
    trip_id_display = serializers.CharField(source='trip.trip_id', read_only=True)
    raised_by_name = serializers.ReadOnlyField(source='raised_by.name')
    expense_category = serializers.CharField(source='expense.category', read_only=True)

    class Meta:
        model = Dispute
        fields = ['id', 'trip', 'trip_id_display', 'expense', 'expense_category', 'raised_by', 'raised_by_name', 'category', 'reason', 'status', 'admin_comment', 'created_at', 'updated_at']
        read_only_fields = ['raised_by', 'status', 'admin_comment', 'created_at', 'updated_at', 'expense_category']

class JobReportSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')

    class Meta:
        model = JobReport
        fields = '__all__'

class BulkActivityBatchSerializer(serializers.ModelSerializer):
    user_name = serializers.SerializerMethodField()
    reporting_manager_name = serializers.SerializerMethodField()
    trip_id_display = serializers.CharField(source='trip.trip_id', read_only=True)

    class Meta:
        model = BulkActivityBatch
        fields = '__all__'

    def get_user_name(self, obj):
        return obj.user.name if obj.user else 'Unknown'

    def get_reporting_manager_name(self, obj):
        return obj.user.reporting_manager.name if obj.user and obj.user.reporting_manager else 'N/A'

class TripSerializer(serializers.ModelSerializer):
    advances = TravelAdvanceSerializer(many=True, read_only=True)
    expenses = ExpenseSerializer(many=True, read_only=True)
    odometer = TripOdometerSerializer(read_only=True, source='odometer_details')
    reporting_manager_name = serializers.SerializerMethodField()
    user_name = serializers.SerializerMethodField()
    user_emp_id = serializers.ReadOnlyField(source='user.employee_id')
    claim = TravelClaimSerializer(read_only=True)
    total_approved_advance = serializers.SerializerMethodField()
    total_expenses = serializers.SerializerMethodField()
    wallet_balance = serializers.SerializerMethodField()
    user_bank_name = serializers.ReadOnlyField(source='user.bank_name')
    user_account_no = serializers.ReadOnlyField(source='user.account_no')
    user_ifsc_code = serializers.ReadOnlyField(source='user.ifsc_code')
    user_base_location = serializers.ReadOnlyField(source='user.base_location')
    route_path_name = serializers.ReadOnlyField(source='route_path.path_name')

    has_gh_booking = serializers.SerializerMethodField()
    has_vehicle_booking = serializers.SerializerMethodField()
    job_reports = JobReportSerializer(many=True, read_only=True)
    activity_batches = BulkActivityBatchSerializer(many=True, read_only=True)
    current_approver_name = serializers.ReadOnlyField(source='current_approver.name')

    class Meta:
        model = Trip
        fields = [
            'trip_id', 'user', 'user_name', 'user_emp_id', 'user_bank_name', 'user_account_no', 'user_ifsc_code', 'user_base_location',
            'purpose', 'destination', 'start_date', 'end_date',
            'status', 'cost_estimate', 'source', 'travel_mode', 'composition',
            'trip_leader', 'en_route', 'route_path', 'route_path_name', 'project_code', 'consider_as_local', 'accommodation_requests',
            'vehicle_type', 'members', 'lifecycle_events', 'created_at', 'updated_at',
            'advances', 'expenses', 'odometer', 'claim', 'reporting_manager_name', 'senior_manager_name', 'hod_director_name',
            'current_approver', 'current_approver_name', 'total_approved_advance', 'total_expenses', 'wallet_balance', 'has_gh_booking', 'has_vehicle_booking',
            'rejection_reason', 'rejected_by', 'fuel_rate_snapshot', 'job_reports', 'activity_batches'
        ]
        read_only_fields = ('trip_id', 'user', 'user_name', 'user_emp_id', 'status', 'cost_estimate', 'created_at', 'updated_at', 'lifecycle_events')

    def get_user_name(self, obj):
        # Use snapshot if available, otherwise fallback to dynamic property
        return obj.user_name or (obj.user.name if obj.user else 'Unknown User')

    def get_reporting_manager_name(self, obj):
        # Use snapshot if available, otherwise fallback to dynamic property
        return obj.reporting_manager_name or (obj.user.reporting_manager.name if obj.user and obj.user.reporting_manager else None)

    def get_total_approved_advance(self, obj):
        return sum(
            (float(a.executive_approved_amount) if float(a.executive_approved_amount) > 0 else float(a.requested_amount))
            for a in obj.advances.filter(status__in=['Paid', 'Transferred', 'COMPLETED'])
        )

    def get_total_expenses(self, obj):
        return float(sum(e.amount for e in obj.expenses.all()))

    def get_wallet_balance(self, obj):
        return float(self.get_total_approved_advance(obj)) - float(self.get_total_expenses(obj))

    def get_has_gh_booking(self, obj):
        return obj.room_bookings.exists()
    
    def get_has_vehicle_booking(self, obj):
        return obj.vehicle_bookings.exists()

    def validate(self, attrs):
        source = attrs.get('source')
        destination = attrs.get('destination')
        
        is_local = attrs.get('consider_as_local', False)
        
        if not is_local and source and destination and str(source).strip().lower() == str(destination).strip().lower():
            raise serializers.ValidationError({
                "to": "Source and Destination cannot be the same.",
                "from": "Source and Destination cannot be the same."
            })
            
        return attrs


from core.models import LoginHistory, AuditLog

class LoginHistorySerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')
    user_email = serializers.ReadOnlyField(source='user.email')

    class Meta:
        model = LoginHistory
        fields = ['id', 'user', 'user_name', 'user_email', 'login_time', 'logout_time', 'ip_address', 'user_agent']

class AuditLogSerializer(serializers.ModelSerializer):
    user_name = serializers.ReadOnlyField(source='user.name')

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'model_name', 'object_id', 'object_repr', 'timestamp', 'details', 'ip_address']


    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'user_name', 'action', 'model_name', 'object_id', 'object_repr', 'timestamp', 'details', 'ip_address']


