from django.test import TestCase
from rest_framework import serializers
from core.models import User, Role
from travel_masters.models import Cadre, EligibilityRule
from travel.models import Trip, Expense
from travel.serializers import ExpenseSerializer, get_user_max_mileage, get_user_laundry_threshold
import datetime


class MileageEntitlementTestCase(TestCase):

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name='Employee')

        self.cadre_exec = Cadre.objects.create(
            name="EXECUTIVES",
            designation_keywords=["executive", "engineer"]
        )
        self.cadre_manager = Cadre.objects.create(
            name="MANAGERS",
            designation_keywords=["manager", "lead"]
        )

        self.rule_exec = EligibilityRule.objects.create(
            cadre=self.cadre_exec,
            max_mileage_km=150.00,
            max_mileage_bike_km=100.00,
            max_mileage_car_km=250.00,
            is_active=True
        )
        self.rule_manager = EligibilityRule.objects.create(
            cadre=self.cadre_manager,
            max_mileage_km=300.00,
            max_mileage_bike_km=180.00,
            max_mileage_car_km=400.00,
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
                "odo_end": "1100.00",  # 100km
                "description": "{}"
            }
            serializer = ExpenseSerializer(data=data_valid)
            self.assertTrue(serializer.is_valid(), serializer.errors)

            # 2. Test exceeding limit (200km > 150km executive limit)
            data_invalid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "1600.00",
                "odo_start": "1000.00",
                "odo_end": "1200.00",  # 200km
                "description": '{"odoStartImg": "mock_start", "odoEndImg": "mock_end"}'
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

    def test_mode_specific_mileage_validation(self):
        original_get_api_data = User._get_api_data
        try:
            User._get_api_data = lambda self, force_fresh=False: {
                "positions_details": [{"id": 1, "name": "Software Engineer"}]
            }

            trip = Trip.objects.create(
                user=self.exec_user,
                trip_id="TRP-TEST-MODE-001",
                source="Origin",
                destination="Dest",
                start_date=datetime.date.today(),
                end_date=datetime.date.today(),
                purpose="Test"
            )

            # 1. Bike mode, Own Bike subType: limit is max_mileage_bike_km (100.00)
            # Valid: 90km
            data_bike_valid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "800.00",
                "odo_start": "1000.00",
                "odo_end": "1090.00",
                "travel_mode": "Bike",
                "vehicle_type": "Own Bike",
                "description": "{}"
            }
            serializer = ExpenseSerializer(data=data_bike_valid)
            self.assertTrue(serializer.is_valid(), serializer.errors)

            # Invalid: 120km (exceeds bike limit of 100, but less than general limit of 150)
            data_bike_invalid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "800.00",
                "odo_start": "1000.00",
                "odo_end": "1120.00",
                "travel_mode": "Bike",
                "vehicle_type": "Own Bike",
                "description": '{"odoStartImg": "mock_start", "odoEndImg": "mock_end"}'
            }
            serializer = ExpenseSerializer(data=data_bike_invalid)
            self.assertFalse(serializer.is_valid())
            self.assertIn("odo_end", serializer.errors)
            self.assertIn("exceeds your cadre entitlement limit of 100", serializer.errors["odo_end"][0])

            # 2. Car mode, Own Car subType: limit is max_mileage_car_km (250.00)
            # Valid: 220km (exceeds general 150 but within car limit 250)
            data_car_valid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "2000.00",
                "odo_start": "1000.00",
                "odo_end": "1220.00",
                "travel_mode": "Car",
                "vehicle_type": "Own Car",
                "description": "{}"
            }
            serializer = ExpenseSerializer(data=data_car_valid)
            self.assertTrue(serializer.is_valid(), serializer.errors)

            # Invalid: 270km (exceeds car limit of 250)
            data_car_invalid = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "2000.00",
                "odo_start": "1000.00",
                "odo_end": "1270.00",
                "travel_mode": "Car",
                "vehicle_type": "Own Car",
                "description": '{"odoStartImg": "mock_start", "odoEndImg": "mock_end"}'
            }
            serializer = ExpenseSerializer(data=data_car_invalid)
            self.assertFalse(serializer.is_valid())
            self.assertIn("odo_end", serializer.errors)
            self.assertIn("exceeds your cadre entitlement limit of 250", serializer.errors["odo_end"][0])

            # 3. Test exceeding mileage with approval document
            data_with_approval = {
                "trip": trip.trip_id,
                "date": datetime.date.today(),
                "category": "Fuel",
                "amount": "2000.00",
                "odo_start": "1000.00",
                "odo_end": "1270.00",
                "travel_mode": "Car",
                "vehicle_type": "Own Car",
                "description": '{"odoStartImg": "data:image/png;base64,mock...", "odoEndImg": "data:image/png;base64,mock...", "approvalDocImg": "data:image/png;base64,mock..."}'
            }
            serializer = ExpenseSerializer(data=data_with_approval)
            self.assertTrue(serializer.is_valid(), serializer.errors)
        finally:
            User._get_api_data = original_get_api_data


class LaundryEntitlementTestCase(TestCase):

    def setUp(self):
        self.role, _ = Role.objects.get_or_create(name='Employee')

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


class DAAggregationTestCase(TestCase):

    def setUp(self):
        from core.models import User, Role
        from travel_masters.models import Cadre, EligibilityRule
        from travel.models import Trip

        self.role, _ = Role.objects.get_or_create(name='Employee')

        self.cadre_exec = Cadre.objects.create(
            name="EXECUTIVES",
            designation_keywords=["executive"]
        )

        self.rule_exec = EligibilityRule.objects.create(
            cadre=self.cadre_exec,
            daily_allowance_amount=400.00,
            monthly_tour_daily_allowance_amount=200.00,
            is_active=True
        )

        self.user = User.objects.create(
            employee_id="exec002",
            role=self.role,
            password_hash="testpass"
        )

        self.original_get_api_data = User._get_api_data
        User._get_api_data = lambda self_user, force_fresh=False: {
            "positions_details": [{"id": 1, "name": "Software Executive"}]
        }

        self.trip = Trip.objects.create(
            user=self.user,
            trip_id="TRP-AGG-001",
            source="Origin",
            destination="Dest",
            start_date=datetime.date.today(),
            end_date=datetime.date.today(),
            purpose="Test",
            status="approved",
            consider_as_local=False  # Use standard tour DA (daily_allowance_amount)
        )

    def tearDown(self):
        User._get_api_data = self.original_get_api_data

    def test_generate_expenses_from_batches_da_aggregation(self):
        from travel.models import BulkActivityBatch, Expense
        from travel.views import _generate_expenses_from_batches
        import json

        # Create a batch with two entries on the same date:
        # Entry 1: 06:00–16:00 (10h)
        # Entry 2: 14:00–23:30 (9.5h)
        # Sum of durations: 10h + 9.5h = 19.5 hours → in > 18h bracket → 100% DA
        # With consider_as_local=False → daily_allowance_amount=400 → 100% = 400.00
        batch_data = [
            {
                "date": str(datetime.date.today()),
                "origin_route": "Origin A",
                "destination_route": "Dest B",
                "start_time": "06:00",
                "reach_time": "16:00",
                "odo_start": "1000",
                "odo_end": "1020",
                "mode": "Bike",
                "vehicle": "Own Bike",
                "amount": "170"
            },
            {
                "date": str(datetime.date.today()),
                "origin_route": "Dest B",
                "destination_route": "Origin A",
                "start_time": "14:00",
                "reach_time": "23:30",
                "odo_start": "1020",
                "odo_end": "1040",
                "mode": "Bike",
                "vehicle": "Own Bike",
                "amount": "170"
            }
        ]

        BulkActivityBatch.objects.create(
            user=self.user,
            trip=self.trip,
            file_name="batch.xlsx",
            data_json=batch_data,
            status="Approved"
        )

        _generate_expenses_from_batches(self.trip)

        # Fetch created expenses
        expenses = Expense.objects.filter(trip=self.trip).order_by('id')
        self.assertEqual(expenses.count(), 2)

        # First expense: gets 100% DA of 400 = 400.00 (19.5h is in the > 18h bracket)
        e1 = expenses[0]
        d1 = json.loads(e1.description)
        self.assertEqual(float(d1.get('daily_allowance', 0)), 400.00)
        self.assertEqual(float(e1.amount), 170.00 + 400.00)

        # Second expense: DA = 0 (aggregated/subsequent entry for same date)
        e2 = expenses[1]
        d2 = json.loads(e2.description)
        self.assertEqual(float(d2.get('daily_allowance', 0)), 0.0)
        self.assertEqual(float(e2.amount), 170.00)
