from api_management.services import fetch_geo_data, fetch_employee_data
from .models import Location, Cadre


# Mapping of API keys to clean Location Types for the hierarchy
TYPE_MAPPING = {
    'continents': 'Continent',
    'countries': 'Country',
    'states': 'State',
    'districts': 'District',
    'mandals': 'Mandal',
    'metro_polyten_cities': 'Metro City',
    'cities': 'City',
    'towns': 'Town',
    'villages': 'Village',
    'clusters': 'Cluster',
    'visiting_locations': 'Site',
    'locations': 'Site',
    'landmarks': 'Landmark'
}

def sync_geo_locations():
    """
    Syncs hierarchical location data from the Geo API into the local master database.
    Handles complex nested structures like clusters, panchayats, and wards.
    """
    data = fetch_geo_data()
    if not data or "error" in data:
        return {"error": "Failed to fetch Geo data"}

    stats = {"created": 0, "updated": 0, "total": 0}

    def walk_tree(items, parent_id=None, level_name="Continent"):
        if not items or not isinstance(items, list):
            return
            
        for item in items:
            if not isinstance(item, dict): continue
            
            # Use API ID or code as the raw identifier
            api_id = item.get("id")
            api_code = item.get("code")
            name = item.get("name")
            
            # Create a unique external ID using Level + API ID
            ext_id = f"{level_name}-{api_id}"
            
            if not name: continue
            
            # Clean up: securely map it over instead of deleting, which prevents CASCADE deletion of Routes!
            # We ONLY care about transitions between Site and Landmark, as they share the same ID space.
            if level_name in ['Site', 'Landmark']:
                other_type = 'Landmark' if level_name == 'Site' else 'Site'
                old_ext_id = f"{other_type}-{api_id}"
                old_loc = Location.objects.filter(external_id=old_ext_id).first()
                if old_loc:
                    old_loc.external_id = ext_id
                    old_loc.location_type = level_name
                    old_loc.save()

            cluster_cat = item.get("cluster_type_display") or item.get("cluster_type") or item.get("cluster_category")
            if cluster_cat:
                cluster_cat = cluster_cat.strip().capitalize()

            defaults = {
                "name": name,
                "location_type": level_name,
                "parent_id": parent_id,
                "code": api_code
            }
            if cluster_cat:
                defaults["cluster_category"] = cluster_cat

            loc, created = Location.objects.update_or_create(
                external_id=ext_id,
                defaults=defaults
            )
            
            if created: stats["created"] += 1
            else: stats["updated"] += 1
            stats["total"] += 1
            
            # Find child lists based on our mapping
            for api_key, mapped_type in TYPE_MAPPING.items():
                child_items = item.get(api_key)
                if isinstance(child_items, list) and child_items:
                    walk_tree(child_items, ext_id, mapped_type)

    # Trigger walk starting from the root (expected to be continents or Top Level)
    # The API structure usually starts with an array of continents
    walk_tree(data, None, "Continent")

    return stats

def get_external_locations(loc_type=None, parent_id=None):
    """
    Fetches geo data from API, synchronizes it to DB, and returns the DB objects.
    This ensures we have valid integer IDs for relational integrity.
    """
    # 1. First sync everything to ensure DB is up to date with API truth
    sync_geo_locations()
    
    # 2. Query the DB for the requested level/parent
    queryset = Location.objects.all()
    
    if loc_type:
        queryset = queryset.filter(location_type__iexact=loc_type)
    if parent_id:
        queryset = queryset.filter(parent_id=parent_id)
        
    return queryset

def sync_cadres():
    """
    Syncs hierarchical position levels (Cadres) from the Employees API into the local master database.
    """
    stats = {"created": 0, "updated": 0, "total": 0}
    
    # We fetch all pages
    data = fetch_employee_data(fetch_all_pages=True, page_size=100)
    
    if not data or "error" in data:
        print("Failed to fetch Employee data")
        return {"error": "Failed to fetch Employee data"}

    results = data.get('results', [])
    unique_levels = set()
    
    for emp in results:
        pos_details = emp.get('positions_details', [])
        pos = emp.get('position', {})
        level_name = None
        
        if pos:
            level_name = pos.get('level_name')
            
        if not level_name and pos_details and isinstance(pos_details, list):
            level_name = pos_details[0].get('level_name')
            
        if level_name:
            unique_levels.add(level_name)

    for level in unique_levels:
        cadre, created = Cadre.objects.get_or_create(
            name=level,
            defaults={'description': f"Auto-synced from employee API (Position Level)"}
        )
        if created:
            stats["created"] += 1
        else:
            stats["updated"] += 1
        stats["total"] += 1

    print(f"Cadre Sync Complete. Extracted {len(unique_levels)} unique position levels. Created {stats['created']}.")
    return stats

