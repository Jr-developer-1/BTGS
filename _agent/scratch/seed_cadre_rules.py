import os
import django
import sys

# Setup Django environment
# The script is in TGS_LIVE/_agent/scratch/seed_cadre_rules.py
# We need to add TGS_LIVE/backend to sys.path
root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
backend_dir = os.path.join(root_dir, 'backend')
sys.path.append(backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'tgs_backend.settings')
django.setup()

from travel_masters.models import Cadre, EligibilityRule

cadre_policies = [
    {
        'cadre_name': 'ADMINISTRATIVE',
        'rule': {
            'is_active': True,
            'air_allowed': True,  'air_class': 'Business Class',
            'train_allowed': True, 'train_class': 'I A/c',
            'bus_allowed': True,   'bus_class': 'Volvo',
            'car_allowed': True,   'car_notes': 'Company/Taxi',
            'local_conveyance_allowed': True, 'local_conveyance_type': 'Cab',
            'company_guest_house_status': 'available',
            'accommodation_state_hq': 4000, 'state_hq_clusters': ['Metropolitan'],
            'accommodation_districts': 2500, 'districts_clusters': ['Town', 'City'],
            'accommodation_others': 1500, 'others_clusters': [],
            'daily_allowance_amount': 1000, 'monthly_tour_daily_allowance_amount': 1000,
            'max_mileage_km': 0, 'max_mileage_bike_km': 0, 'max_mileage_car_km': 0,
            'own_stay_state_hq_pct': 75, 'own_stay_districts_pct': 75, 'own_stay_others_pct': 75,
            'laundry_days_threshold': 5, 'travel_rules': {},
        }
    },
    {
        'cadre_name': 'MANAGERIAL - PAN INDIA',
        'rule': {
            'is_active': True,
            'air_allowed': True,  'air_class': 'Economy',
            'train_allowed': True, 'train_class': 'II A/c',
            'bus_allowed': True,   'bus_class': 'AC Bus',
            'car_allowed': True,   'car_notes': 'Company/Taxi',
            'local_conveyance_allowed': True, 'local_conveyance_type': 'Cab',
            'company_guest_house_status': 'available',
            'accommodation_state_hq': 3000, 'state_hq_clusters': ['Metropolitan'],
            'accommodation_districts': 2000, 'districts_clusters': ['Town', 'City'],
            'accommodation_others': 1200, 'others_clusters': [],
            'daily_allowance_amount': 700, 'monthly_tour_daily_allowance_amount': 700,
            'max_mileage_km': 0, 'max_mileage_bike_km': 0, 'max_mileage_car_km': 0,
            'own_stay_state_hq_pct': 75, 'own_stay_districts_pct': 75, 'own_stay_others_pct': 75,
            'laundry_days_threshold': 5, 'travel_rules': {},
        }
    },
    {
        'cadre_name': 'PAN INDIA - MANAGERS',
        'rule': {
            'is_active': True,
            'air_allowed': False, 'air_class': 'NA',
            'train_allowed': True, 'train_class': 'III A/c',
            'bus_allowed': True,   'bus_class': 'AC Bus',
            'car_allowed': True,   'car_notes': 'Company/Taxi',
            'local_conveyance_allowed': True, 'local_conveyance_type': '4 or 3-wheeler',
            'company_guest_house_status': 'available',
            'accommodation_state_hq': 2500, 'state_hq_clusters': ['Metropolitan'],
            'accommodation_districts': 1500, 'districts_clusters': ['Town', 'City'],
            'accommodation_others': 1000, 'others_clusters': [],
            'daily_allowance_amount': 400, 'monthly_tour_daily_allowance_amount': 300,
            'max_mileage_km': 0, 'max_mileage_bike_km': 0, 'max_mileage_car_km': 0,
            'own_stay_state_hq_pct': 50, 'own_stay_districts_pct': 50, 'own_stay_others_pct': 50,
            'laundry_days_threshold': 7, 'travel_rules': {},
        }
    },
    {
        'cadre_name': 'PAN INDIA - SR EXECUTIVES',
        'rule': {
            'is_active': True,
            'air_allowed': False, 'air_class': 'NA',
            'train_allowed': True, 'train_class': 'Sleeper',
            'bus_allowed': True,   'bus_class': 'Non-AC Bus',
            'car_allowed': False,  'car_notes': 'NA',
            'local_conveyance_allowed': True, 'local_conveyance_type': '2 or 3-wheeler',
            'company_guest_house_status': 'available',
            'accommodation_state_hq': 2000, 'state_hq_clusters': ['Metropolitan'],
            'accommodation_districts': 1200, 'districts_clusters': ['Town', 'City'],
            'accommodation_others': 800,  'others_clusters': [],
            'daily_allowance_amount': 350, 'monthly_tour_daily_allowance_amount': 350,
            'max_mileage_km': 0, 'max_mileage_bike_km': 0, 'max_mileage_car_km': 0,
            'own_stay_state_hq_pct': 50, 'own_stay_districts_pct': 50, 'own_stay_others_pct': 50,
            'laundry_days_threshold': 7, 'travel_rules': {},
        }
    },
    {
        'cadre_name': 'PAN INDIA - BELOW EXECUTIVE',
        'rule': {
            'is_active': True,
            'air_allowed': False, 'air_class': 'NA',
            'train_allowed': True, 'train_class': 'Sleeper',
            'bus_allowed': True,   'bus_class': 'Non-AC Bus',
            'car_allowed': False,  'car_notes': 'NA',
            'local_conveyance_allowed': True, 'local_conveyance_type': '2 or 3-wheeler',
            'company_guest_house_status': 'available',
            'accommodation_state_hq': 1500, 'state_hq_clusters': ['Metropolitan'],
            'accommodation_districts': 1000, 'districts_clusters': ['Town', 'City'],
            'accommodation_others': 600,  'others_clusters': [],
            'daily_allowance_amount': 300, 'monthly_tour_daily_allowance_amount': 300,
            'max_mileage_km': 0, 'max_mileage_bike_km': 0, 'max_mileage_car_km': 0,
            'own_stay_state_hq_pct': 50, 'own_stay_districts_pct': 50, 'own_stay_others_pct': 50,
            'laundry_days_threshold': 7, 'travel_rules': {},
        }
    },
]

for cp in cadre_policies:
    cadre, cadre_created = Cadre.objects.get_or_create(name=cp['cadre_name'])
    rule_data = cp['rule']
    rule, rule_created = EligibilityRule.objects.get_or_create(
        cadre=cadre,
        defaults=rule_data
    )
    if not rule_created:
        for k, v in rule_data.items():
            setattr(rule, k, v)
        rule.save()
    status = 'CREATED' if rule_created else 'UPDATED'
    print(f"[{status}] {cp['cadre_name']} | DA={rule.daily_allowance_amount} | Monthly DA={rule.monthly_tour_daily_allowance_amount}")

print()
print('Done. Total cadres:', Cadre.objects.count())
print('Total rules:', EligibilityRule.objects.count())
