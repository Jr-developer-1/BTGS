from django.test import TestCase
from rest_framework import serializers
from core.models import User, Role
from travel_masters.models import Cadre, EligibilityRule
from travel.models import Trip, Expense
from travel.serializers import ExpenseSerializer, get_user_max_mileage, get_user_laundry_threshold
import datetime

class MileageEntitlementTestCase(TestCase):
    def setUp(self):
        # Create user role
        self.role, _ = Role.objects.get_or_create(name='Employee')
        
        # Create cadres
        self.cadre_exec = Cadre.objects.create(
            name="EXECUTIVES",
            designation_keywords=["executive", "engineer"]
        )
        self.cadre_manager = Cadre.objects.create(
            name="MANAGERS",
            designation_keywords=["manager", "lead"]
        )
        
        # Create eligibility rules
        self.rule_exec = EligibilityRule.objects.create(
            cadre=self.cadre_exec,
            max_mileage_km=150.00,
            is_active=True
        )
        self.rule_manager = EligibilityRule.objects.create(
            cadre=self.cadre_manager,
            max_mileage_km=300.00,
            is_active=True
        )

        self.exec_user = User.objects.create(
            employee_id="exec001",
            role=self.role,
            password_hash="testpass"
        )
        
        self.manager_user = User.objects.create(
            employee_id="mgr001",
            role=self.role,
            password_hash="testpass"
        )

    def test_get_user_max_mileage_default_fallback(self):
        limit = get_user_max_mileage(self.exec_user)
        self.assertEqual(limit, 150.00)

    def test_get_user_max_mileage_with_matched_designation(self):
        original_get_api_data = User._get_api_data
        try:
            User._get_api_data = lambda self, force_fresh=False: {
                "positions_details": [{"id": 1, "name": "Software Engineer"}]
            } if self.employee_id == "exec001" else {
                "positions_details": [{"id": 2, "name": "Project Manager"}]
            }
            
            exec_limit = get_user_max_mileage(self.exec_user)
            self.assertEqual(exec_limit, 150.00)
            
            mgr_limit = get_user_max_mileage(self.manager_user)
            self.assertEqual(mgr_limit, 300.00)
        finally:
            User._get_api_data = original_get_api_data

    def test_expense_serializer_mileage_validation(self):
        original_get_api_data = User._get_api_data
        try:
            User._get_api_data = lambda self, force_fresh=False: {
                "positions_details": [{"id": 1, "name": "Software Engineer"}]
            } if self.employee_id == "exec001" else {
                "positions_details": [{"id": 2, "name": "Project Manager"}]
            }
            
            # Create a Trip
            trip = Trip.objects.create(
                user=self.exec_user,
                trip_id="TRP-TEST-001",
                source="Origin",
                destination="Dest",
                start_date=datetime.date.today(),
                end_date=datetime.date.today(),
                purpose="Test"
            )

            # 1. Test within limit (100km is <= 150km executive limit)
            data_valid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "800.00",
                "odo_start": "1000.00",
                "odo_end": "1100.00", # 100km
                "description": "{}"
            }
            serializer = ExpenseSerializer(data=data_valid)
            self.assertTrue(serializer.is_valid(), serializer.errors)
            
            # 2. Test exceeding limit (200km is > 150km executive limit)
            data_invalid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "1600.00",
                "odo_start": "1000.00",
                "odo_end": "1200.00", # 200km
                "description": "{}"
            }
            serializer = ExpenseSerializer(data=data_invalid)
            self.assertFalse(serializer.is_valid())
            self.assertIn("odo_end", serializer.errors)
            self.assertIn("exceeds your cadre entitlement limit", serializer.errors["odo_end"][0])
            
            # 3. Test equal start and end
            data_equal = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "0.00",
                "odo_start": "1000.00",
                "odo_end": "1000.00",
                "description": "{}"
            }
            serializer = ExpenseSerializer(data=data_equal)
            self.assertFalse(serializer.is_valid())
            self.assertIn("odo_end", serializer.errors)
            self.assertIn("greater than Start Odometer", serializer.errors["odo_end"][0])
            
        finally:
            User._get_api_data = original_get_api_data

class LaundryEntitlementTestCase(TestCase):
    def setUp(self):
        # Create user role
        self.role, _ = Role.objects.get_or_create(name='Employee')
        
        # Create cadres
        self.cadre_exec = Cadre.objects.create(
            name="EXECUTIVES",
            designation_keywords=["executive", "engineer"]
        )
        
        # Create eligibility rule with laundry threshold = 4 days
        self.rule_exec = EligibilityRule.objects.create(
            cadre=self.cadre_exec,
            laundry_days_threshold=4,
            is_active=True
        )

        self.exec_user = User.objects.create(
            employee_id="exec001",
            role=self.role,
            password_hash="testpass"
        )

        # Create a Trip
        self.trip = Trip.objects.create(
            user=self.exec_user,
            trip_id="TRP-TEST-002",
            source="Origin",
            destination="Dest",
            start_date=datetime.date.today(),
            end_date=datetime.date.today() + datetime.timedelta(days=10),
            purpose="Test"
        )

    def test_get_user_laundry_threshold(self):
        limit = get_user_laundry_threshold(self.exec_user)
        self.assertEqual(limit, 4)

    def test_laundry_validation_no_stay(self):
        # 1. No stay: laundry expense should fail
        import json
        data = {
            "trip": self.trip.trip_id,
            "date": datetime.date.today(),
            "category": "Incidental",
            "amount": "150.00",
            "description": json.dumps({
                "incidentalType": "Laundry Services",
                "incidentalTime": "20:00",
                "location": "Guest House"
            })
        }
        serializer = ExpenseSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("description", serializer.errors)
        self.assertIn("Laundry charges are only allowed", serializer.errors["description"][0])

    def test_laundry_validation_short_stay(self):
        # 2. Short guest house stay (2 nights < 4 threshold): laundry should fail
        import json
        Expense.objects.create(
            trip=self.trip,
            date=datetime.date.today(),
            category="Accommodation",
            amount="1200.00",
            description=json.dumps({
                "accomType": "Guest House Stay",
                "hotelName": "Bavya Guest House",
                "checkInDate": str(datetime.date.today()),
                "checkOutDate": str(datetime.date.today() + datetime.timedelta(days=2))
            })
        )
        data = {
            "trip": self.trip.trip_id,
            "date": datetime.date.today() + datetime.timedelta(days=1),
            "category": "Incidental",
            "amount": "150.00",
            "description": json.dumps({
                "incidentalType": "Laundry Services",
                "incidentalTime": "20:00",
                "location": "Guest House"
            })
        }
        serializer = ExpenseSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn("description", serializer.errors)
        self.assertIn("Laundry charges are only allowed", serializer.errors["description"][0])

    def test_laundry_validation_sufficient_stay(self):
        # 3. Sufficient guest house stay (5 nights >= 4 threshold): laundry should pass
        import json
        Expense.objects.create(
            trip=self.trip,
            date=datetime.date.today(),
            category="Accommodation",
            amount="3000.00",
            description=json.dumps({
                "accomType": "Guest House Stay",
                "hotelName": "Bavya Guest House",
                "checkInDate": str(datetime.date.today()),
                "checkOutDate": str(datetime.date.today() + datetime.timedelta(days=5))
            })
        )
        data = {
            "trip": self.trip.trip_id,
            "date": datetime.date.today() + datetime.timedelta(days=1),
            "category": "Incidental",
            "amount": "150.00",
            "description": json.dumps({
                "incidentalType": "Laundry Services",
                "incidentalTime": "20:00",
                "location": "Guest House"
            })
        }
        serializer = ExpenseSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)

