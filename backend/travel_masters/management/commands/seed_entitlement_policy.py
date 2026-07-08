"""
Management command to seed all 5 cadres and their entitlement rules
from the official policy table.

Usage:
    python manage.py seed_entitlement_policy
    python manage.py seed_entitlement_policy --clear   # Clears existing data first
"""
from django.core.management.base import BaseCommand
from travel_masters.models import Cadre, EligibilityRule


POLICY_DATA = [
    {
        "name": "ADMINISTRATIVE",
        "description": (
            "CDO / National Head / Head of Projects / Corp Affairs Head / "
            "SCM Head / Chief R&D Policy Affairs"
        ),
        "designation_keywords": [
            "CDO", "National Head", "Head of Projects", "Corp Affairs Head",
            "SCM Head", "Chief R&D", "Policy Affairs", "Chief Development Officer",
        ],
        "rule": {
            # (A) TRAVEL
            "air_allowed": True,
            "air_class": "Economy II A/c",
            "train_allowed": True,
            "train_class": "Sleeper or Equivalent",
            "bus_allowed": True,
            "bus_class": "A/c. Sleeper or Equivalent",
            "car_allowed": True,
            "car_notes": "At Management discretion / Company car",
            "local_conveyance_allowed": True,
            "local_conveyance_type": "Company car",
            # (B) ACCOMMODATION
            "company_guest_house_status": "Preferred",
            "accommodation_state_hq": 2500,
            "accommodation_districts": 2000,
            "accommodation_others": 1500,
            # (C) DAILY ALLOWANCE
            "daily_allowance_amount": 1000,
            "monthly_tour_daily_allowance_amount": 1000,
            # (D) OWN STAY ALLOWANCE
            "own_stay_state_hq_pct": 50,
            "own_stay_districts_pct": 50,
            "own_stay_others_pct": 50,
            # (E) ODOMETER LIMIT
            "max_mileage_km": 500.00,
            "max_mileage_bike_km": 150.00,
            "max_mileage_car_km": 300.00,
        }
    },
    {
        "name": "MANAGERIAL - PAN INDIA",
        "description": (
            "State Program Head / State Dept. Head / Sr Manager / Head Dept. / "
            "MO Specialist / M&E Analyst / Lead / Sr Consultant"
        ),
        "designation_keywords": [
            "State Program Head", "State Dept Head", "State Dept. Head",
            "Sr Manager", "Senior Manager", "Head Dept", "Head of Dept",
            "MO Specialist", "M&E Analyst", "Lead", "Sr Consultant",
            "Senior Consultant",
        ],
        "rule": {
            # (A) TRAVEL
            "air_allowed": True,
            "air_class": "On need basis",
            "train_allowed": True,
            "train_class": "III A/c or Equivalent",
            "bus_allowed": True,
            "bus_class": "A/c. Sleeper or Equivalent",
            "car_allowed": False,
            "car_notes": "NA",
            "local_conveyance_allowed": True,
            "local_conveyance_type": "Online Cab services 4/3-Wheeler for Hire",
            # (B) ACCOMMODATION
            "company_guest_house_status": "Optional",
            "accommodation_state_hq": 2000,
            "accommodation_districts": 1500,
            "accommodation_others": 1250,
            # (C) DAILY ALLOWANCE
            "daily_allowance_amount": 700,
            "monthly_tour_daily_allowance_amount": 700,
            # (D) OWN STAY ALLOWANCE
            "own_stay_state_hq_pct": 50,
            "own_stay_districts_pct": 50,
            "own_stay_others_pct": 50,
            # (E) ODOMETER LIMIT
            "max_mileage_km": 300.00,
            "max_mileage_bike_km": 120.00,
            "max_mileage_car_km": 250.00,
        }
    },
    {
        "name": "PAN INDIA - MANAGERS",
        "description": (
            "RM / DM / DC / DFM / OM / ZM / MO MBBS / Data Analysts / MIS Manager / "
            "PA (Founders' Office) / Pharma Dept Manager / Pharma Inventory / Analyst"
        ),
        "designation_keywords": [
            "RM", "DM", "DC", "DFM", "OM", "ZM",
            "MO MBBS", "Data Analyst", "MIS Manager", "MIS",
            "PA (Founders", "Pharma Dept Manager", "Pharma Inventory", "Analyst",
            "Regional Manager", "District Manager", "Zonal Manager",
        ],
        "rule": {
            # (A) TRAVEL
            "air_allowed": False,
            "air_class": "NA",
            "train_allowed": True,
            "train_class": "III A/c or Equivalent",
            "bus_allowed": True,
            "bus_class": "A/c. Sleeper or Equivalent",
            "car_allowed": False,
            "car_notes": "NA",
            "local_conveyance_allowed": True,
            "local_conveyance_type": "Online Cab services 4/3-Wheeler for Hire",
            # (B) ACCOMMODATION
            "company_guest_house_status": "Optional",
            "accommodation_state_hq": 1000,
            "accommodation_districts": 650,
            "accommodation_others": 650,
            # (C) DAILY ALLOWANCE
            "daily_allowance_amount": 400,
            "monthly_tour_daily_allowance_amount": 400,
            # (D) OWN STAY ALLOWANCE
            "own_stay_state_hq_pct": 50,
            "own_stay_districts_pct": 50,
            "own_stay_others_pct": 50,
            # (E) ODOMETER LIMIT
            "max_mileage_km": 250.00,
            "max_mileage_bike_km": 100.00,
            "max_mileage_car_km": 200.00,
        }
    },
    {
        "name": "PAN INDIA - SR EXECUTIVES",
        "description": (
            "Sr Executives / Executives / IOE / FE / FC / MIS / Sr Pharmacist"
        ),
        "designation_keywords": [
            "Sr Executive", "Senior Executive", "Executive", "IOE", "FE",
            "FC", "Sr Pharmacist", "Senior Pharmacist",
        ],
        "rule": {
            # (A) TRAVEL
            "air_allowed": False,
            "air_class": "NA",
            "train_allowed": True,
            "train_class": "Sleeper or Equivalent",
            "bus_allowed": True,
            "bus_class": "A/c. Bus or Equivalent",
            "car_allowed": False,
            "car_notes": "NA",
            "local_conveyance_allowed": True,
            "local_conveyance_type": "Online 2 or 3 Wheeler (Bavya encourages 3 Wheeler for safety)",
            # (B) ACCOMMODATION
            "company_guest_house_status": "Optional",
            "accommodation_state_hq": 1000,
            "accommodation_districts": 500,
            "accommodation_others": 500,
            # (C) DAILY ALLOWANCE
            "daily_allowance_amount": 350,
            "monthly_tour_daily_allowance_amount": 350,
            # (D) OWN STAY ALLOWANCE
            "own_stay_state_hq_pct": 50,
            "own_stay_districts_pct": 50,
            "own_stay_others_pct": 50,
            # (E) ODOMETER LIMIT
            "max_mileage_km": 200.00,
            "max_mileage_bike_km": 80.00,
            "max_mileage_car_km": 150.00,
        }
    },
    {
        "name": "PAN INDIA - BELOW EXECUTIVE",
        "description": (
            "Pharma Exec. / Below Executive: EMT / Pilot / Fleet Mechanic / "
            "CCE / DEO / Nurse / Collection Agent (TB) / Driver"
        ),
        "designation_keywords": [
            "Pharma Exec", "Below Executive", "EMT", "Pilot", "Fleet Mechanic",
            "CCE", "DEO", "Nurse", "Collection Agent", "Driver",
            "Field Executive", "Delivery Executive",
        ],
        "rule": {
            # (A) TRAVEL
            "air_allowed": False,
            "air_class": "NA",
            "train_allowed": True,
            "train_class": "Sleeper or Equivalent",
            "bus_allowed": True,
            "bus_class": "A/c. Bus or Equivalent",
            "car_allowed": False,
            "car_notes": "NA",
            "local_conveyance_allowed": True,
            "local_conveyance_type": "Online 2 or 3 Wheeler (3 Wheeler for safety)",
            # (B) ACCOMMODATION
            # Hotel only under exceptional circumstances — Company GH required
            "company_guest_house_status": "Exceptional Only",
            "accommodation_state_hq": 800,
            "accommodation_districts": 500,
            "accommodation_others": 300,
            # (C) DAILY ALLOWANCE
            "daily_allowance_amount": 300,
            "monthly_tour_daily_allowance_amount": 300,
            # (D) OWN STAY ALLOWANCE
            "own_stay_state_hq_pct": 50,
            "own_stay_districts_pct": 50,
            "own_stay_others_pct": 50,
            # (E) ODOMETER LIMIT
            "max_mileage_km": 150.00,
            "max_mileage_bike_km": 60.00,
            "max_mileage_car_km": 120.00,
        }
    },
]


class Command(BaseCommand):
    help = "Seeds 5 entitlement cadres and their full policy rules from the official policy table."

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear', action='store_true',
            help='Delete existing cadres and rules before seeding.'
        )

    def handle(self, *args, **options):
        if options['clear']:
            EligibilityRule.objects.all().delete()
            Cadre.objects.all().delete()
            self.stdout.write(self.style.WARNING("  Cleared existing cadres and rules."))

        created_c = updated_c = created_r = updated_r = 0

        for data in POLICY_DATA:
            rule_data = data.pop('rule')

            cadre, c_created = Cadre.objects.update_or_create(
                name=data['name'],
                defaults={
                    'description': data['description'],
                    'designation_keywords': data['designation_keywords'],
                }
            )
            if c_created:
                created_c += 1
            else:
                updated_c += 1

            rule, r_created = EligibilityRule.objects.update_or_create(
                cadre=cadre,
                defaults=rule_data
            )
            if r_created:
                created_r += 1
            else:
                updated_r += 1

            status_str = "Created" if c_created else "Updated"
            self.stdout.write(f"  [{status_str}] cadre: {cadre.name}")

        self.stdout.write(self.style.SUCCESS(
            f"\nDone. Cadres: {created_c} created, {updated_c} updated. "
            f"Rules: {created_r} created, {updated_r} updated."
        ))
