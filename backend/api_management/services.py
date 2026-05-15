import requests
import time
from .models import SystemConfig
from .utils import decrypt_key
from core.models import User, Role

# EXTERNAL_API_URL = "http://192.168.1.235:8000/api/employees/"  

# Global in-memory cache for dynamic data to avoid N+1 API calls
# In a production environment, this should be replaced with Redis/Memcached.
CACHE_EMPLOYEE_DATA = {}
CACHE_TIMEOUT = 300 # Restored to 5 minutes to fix global app slowness

# HR ID to Info mapping (code and name)
HR_ID_TO_INFO_CACHE = {}

# Full employee list cache for team filtering
GLOBAL_EMPLOYEE_CACHE = {'timestamp': 0, 'data': []}
GLOBAL_CACHE_TIMEOUT = 600 # 10 minutes

def resolve_hr_id_to_info(hr_id, api_url, headers):
    """Resolves an internal HR ID to (employee_code, name) by fetching details."""
    if not hr_id: return None, None
    hr_id_str = str(hr_id)
    if hr_id_str in HR_ID_TO_INFO_CACHE:
        info = HR_ID_TO_INFO_CACHE[hr_id_str]
        return info.get('code'), info.get('name')
    
    try:
        url = f"{api_url.rstrip('/')}/{hr_id_str}/"
        url = url.replace('//', '/').replace(':/', '://')
        resp = requests.get(url, headers=headers, timeout=5.0)
        if resp.status_code == 200:
            data = resp.json() or {}
            emp_obj = data.get('employee', {})
            code = emp_obj.get('employee_code') or data.get('employee_code')
            name = emp_obj.get('name') or data.get('name')
            
            if code:
                HR_ID_TO_INFO_CACHE[hr_id_str] = {'code': code, 'name': name}
                return code, name
            else:
                HR_ID_TO_INFO_CACHE[hr_id_str] = {'code': None, 'name': None}
        else:
            HR_ID_TO_INFO_CACHE[hr_id_str] = {'code': None, 'name': None}
    except Exception as e:
        print(f"Error resolving HR ID {hr_id}: {e}")
        HR_ID_TO_INFO_CACHE[hr_id_str] = {'code': None, 'name': None}
    
    return None, None

def resolve_hr_id_to_code(hr_id, api_url, headers):
    """Legacy wrapper for resolve_hr_id_to_info."""
    code, _ = resolve_hr_id_to_info(hr_id, api_url, headers)
    return code

def get_dynamic_employee_data(employee_code, force_fresh=False):
    """
    Fetches employee details in real-time. Checks local caches first unless force_fresh=True.
    """
    import time
    now = time.time()
    
    # 1. Check per-employee cache (Fastest)
    if not force_fresh and employee_code in CACHE_EMPLOYEE_DATA:
        entry = CACHE_EMPLOYEE_DATA[employee_code]
        if now - entry['timestamp'] < CACHE_TIMEOUT:
            return entry['data']

    # 2. Check global employee cache (Second Fastest - In Memory)
    g_cached = GLOBAL_EMPLOYEE_CACHE
    if not force_fresh and now - g_cached['timestamp'] < GLOBAL_CACHE_TIMEOUT and g_cached['data']:
        for item in g_cached['data']:
            if item.get('employee', {}).get('employee_code') == employee_code:
                # Cache it locally and return instantly
                CACHE_EMPLOYEE_DATA[employee_code] = {
                    'timestamp': now,
                    'data': item
                }
                return item
            
    # 3. Fetch from API (Direct lookup with minimum page size to avoid parallel pagination overhead)
    data = fetch_employee_data(employee_id_filter=employee_code, page_size=1)
    if data and not data.get('error') and data.get('results'):
        emp_data = data['results'][0]
        CACHE_EMPLOYEE_DATA[employee_code] = {
            'timestamp': now,
            'data': emp_data
        }
        return emp_data
        
    return None

def _enrich_employee_locations_from_db(transformed_items):
    """Enriches external API employee objects with official database-traced Districts"""
    if not transformed_items:
        return
        
    try:
        from travel_masters.models import Location
    except Exception:
        return

    def resolve_district_from_office_name(off_name):
        if not off_name:
            return None
        words = off_name.strip().split()
        target = words[-1].upper() if words else None
        if target in ['OFFICE', 'OFFFICE'] and len(words) > 1:
            target = words[-2].upper()
            
        if not target:
            return None
            
        try:
            candidates = Location.objects.filter(name__iexact=target)
            for loc in candidates:
                curr = loc
                visited = set()
                while curr and curr.external_id not in visited:
                    visited.add(curr.external_id)
                    if curr.location_type.lower() == 'district':
                        return curr.name.upper()
                    if not curr.parent_id:
                        break
                    curr = Location.objects.filter(external_id=curr.parent_id).first()
        except Exception:
            pass
        return None

    for item in transformed_items:
        if not isinstance(item, dict):
            continue
            
        global_geo = item.get('office', {}).get('geo_location') or {}
        
        # Enrich positions_details
        pos_details = item.get('positions_details') or []
        for pos in pos_details:
            if not isinstance(pos, dict):
                continue
            off_name = pos.get('office_name')
            if off_name:
                res_district = resolve_district_from_office_name(off_name)
                if res_district:
                    pos['geo_location'] = {
                        'district': res_district,
                        'state': global_geo.get('state') or "ANDHRA PRADESH",
                        'country': global_geo.get('country') or "India"
                    }

def fetch_employee_data(employee_id_filter=None, page=1, search=None, api_key_override=None, fetch_all_pages=False, page_size=20):
    """
    Fetches employee data with direct pagination and search forwarding.
    Supports a custom page_size by fetching multiple pages from external API if needed.
    """
    # Early Cache check for full downloads (massive performance boost & timeout avoidance)
    if fetch_all_pages and not employee_id_filter and not search:
        now = time.time()
        cached = GLOBAL_EMPLOYEE_CACHE
        if now - cached['timestamp'] < GLOBAL_CACHE_TIMEOUT and cached['data']:
            data_list = cached['data']
            return {
                "count": len(data_list),
                "next": None,
                "previous": None,
                "results": data_list
            }

    try:

        # Get configured API Key
        if api_key_override:
            api_key = api_key_override
        elif SystemConfig.objects.filter(key='external_api_key').exists():
            encrypted_key = SystemConfig.objects.get(key='external_api_key').value
            api_key = decrypt_key(encrypted_key)
            if not api_key:
                return {"error": "Failed to decrypt API Key. This usually happens if DJANGO_SECRET_KEY has changed. Please re-type the key in settings.", "status_code": 500}
        else:
            return {"error": "API Key not configured in system settings.", "status_code": 500}

        # Get configured API URL from DB
        if SystemConfig.objects.filter(key='external_api_url').exists():
            api_url = SystemConfig.objects.get(key='external_api_url').value
        else:
            return {"error": "External API URL not configured in system settings."}
            
        headers = {
            "X-Api-Key": api_key,
            "Accept": "application/json"
        }
        
        # Determine internal start page for the external API
        # If internal page_size is 20 and external is 10:
        # Internal Page 1 -> External Pages 1, 2
        # Internal Page 2 -> External Pages 3, 4
        
        # We start by fetching the first required external page
        # Note: We assume external API gives 10 per page. If it changes, we'll adapt.
        external_page_size = 10 
        
        # Calculate how many pages to skip based on requested internal page and size
        items_to_skip = (int(page) - 1) * int(page_size)
        start_external_page = (items_to_skip // external_page_size) + 1
        
        # How many external pages we need to fulfill one internal page
        pages_needed = (int(page_size) + external_page_size - 1) // external_page_size
        
        params = {'page': start_external_page}
        if employee_id_filter:
            params['search'] = employee_id_filter
        elif search:
            params['search'] = search

        page_results = []
        total_count = 0
        next_url = None
        prev_url = None

        # Fetch the first page to get metadata
        try:
            start_time = time.time()
            response = requests.get(api_url, params=params, headers=headers, timeout=120)
            latency = (time.time() - start_time) * 1000

            try:
                from .models import APILog
                APILog.objects.create(
                    source="External Integration",
                    endpoint=api_url,
                    method="GET",
                    status_code=response.status_code,
                    latency_ms=latency
                )
            except: pass

            response.raise_for_status()
            data = response.json() or {}
            
            if not data:
                return {"count": 0, "results": []}

            total_count = data.get('count', 0)
            # Handle pagination logic efficiently
            next_url = data.get('next')
            prev_url = data.get('previous')
            count = data.get('count', 0)
            page_results = data.get('results', [])
            
            target_page_count = 0
            if fetch_all_pages:
                # Calculate how many pages we need to fetch in total
                import math
                # API seems hardcoded to 10 per page
                target_page_count = math.ceil(count / 10)
            elif int(page_size) > len(page_results) and count > len(page_results):
                import math
                # Cap math at total records available (count) to prevent requesting empty extra pages
                max_possible_records = min(int(count), int(page_size))
                target_page_count = math.ceil(max_possible_records / 10)


            if target_page_count > 1:
                from concurrent.futures import ThreadPoolExecutor
                
                # We already have page 1 (start_external_page)
                # Fetch remaining pages up to target_page_count in parallel
                max_pages_to_fetch = target_page_count
                pages_to_fetch = range(start_external_page + 1, max_pages_to_fetch + 1)
                
                if pages_to_fetch:
                    def fetch_single_page(p_num):
                        retries = 3
                        delay = 1.0
                        for attempt in range(retries):
                            try:
                                p_params = params.copy()
                                p_params['page'] = p_num
                                # Use 30s timeout for reliable read buffered streaming
                                p_resp = requests.get(api_url, params=p_params, headers=headers, timeout=30)
                                if p_resp.status_code == 200:
                                    return p_resp.json().get('results', [])
                                elif p_resp.status_code == 429:
                                    time.sleep(delay * 2)
                            except Exception as e:
                                if attempt == retries - 1:
                                    print(f"Parallel fetch error on page {p_num} after {retries} attempts: {e}")
                                else:
                                    time.sleep(delay)
                                    delay *= 1.5
                        return []

                    # Lower to 8 workers to prevent external system connection exhaustion
                    with ThreadPoolExecutor(max_workers=8) as executor:
                        extra_results_list = list(executor.map(fetch_single_page, pages_to_fetch))
                    
                    for er in extra_results_list:
                        page_results.extend(er)


            # Slice to exact page_size in case we fetched too many (only if not fetching all)
            if not fetch_all_pages:
                page_results = page_results[:int(page_size)]
            
            all_results = page_results

        except requests.exceptions.Timeout as e:
            error_msg = "External Employee API Connection Timed Out. Please try again later."
            print(f"External API Request failed (Timeout): {str(e)}")
            return {"error": error_msg, "status_code": 408}
        except requests.RequestException as e:
            # Safely obtain status code as an integer
            status_code = 503  # Default to Service Unavailable
            try:
                if e.response is not None:
                    status_code = int(getattr(e.response, 'status_code', 503))
            except:
                pass
            
            # CRITICAL FIX: Map external 401/403 to 503 so frontend doesn't log the user out
            if status_code in [401, 403]:
                error_msg = f"External API Authentication Error (External Status {status_code}). Please check API keys in system settings."
                status_code = 503
            else:
                error_msg = f"External Employee API Request failed (Status {status_code}). Service unavailable."
                
            print(f"External API Request failed (Status {status_code}): {str(e)}")
            return {"error": error_msg, "status_code": status_code}


        transformed_results = []
        for item in all_results:
            if not isinstance(item, dict): continue
            
            # If we are filtering for a specific employee, get more details
            employee = item.get('employee') or {}
            emp_id_api = employee.get('id')
            
            if employee_id_filter and emp_id_api:
                try:
                    detail_url = api_url.rstrip('/') + f"/{emp_id_api}/"
                    detail_resp = requests.get(detail_url, headers=headers, timeout=5)
                    if detail_resp.status_code == 200:
                        detail_data = detail_resp.json() or {}
                        pos_list = detail_data.get('positions_details') or []
                        pos_detail = (pos_list[0] if pos_list else {}) or {}
                        
                        # Resolve hierarchy for ALL positions in the list
                        top_reporting_names = detail_data.get('reporting_to_names', [])
                        
                        for pos in pos_list:
                            raw_reporting_to = pos.get('reporting_to', [])
                            pos_reporting_names = pos.get('reporting_to_names') or top_reporting_names
                            
                            if not raw_reporting_to:
                                # Fallback to top-level if this position is missing it
                                raw_reporting_to = detail_data.get('reporting_to', [])
                            
                            resolved_reporting_to = []
                            if isinstance(raw_reporting_to, list):
                                for i, mgr in enumerate(raw_reporting_to):
                                    if isinstance(mgr, int) or (isinstance(mgr, str) and str(mgr).isdigit()):
                                        code, resolved_name = resolve_hr_id_to_info(mgr, api_url, headers)
                                        name = resolved_name or (pos_reporting_names[i] if i < len(pos_reporting_names) else f"Manager {mgr}")
                                        
                                        # CRITICAL WORKFLOW FIX: If it's a Position ID, code will be None.
                                        # We MUST resolve the name to an employee_code so the Trip Approval can route to a User!
                                        if not code and name and not name.startswith("Manager"):
                                            # Cache check for position name
                                            cache_key = f"pos_name_{name}"
                                            if cache_key in HR_ID_TO_INFO_CACHE:
                                                code = HR_ID_TO_INFO_CACHE[cache_key].get('code')
                                            else:
                                                try:
                                                    s_resp = requests.get(api_url, params={'search': name}, headers=headers, timeout=2.0)
                                                    if s_resp.status_code == 200:
                                                        s_data = s_resp.json() or {}
                                                        s_res = s_data.get('results', [])
                                                        if s_res:
                                                            code = s_res[0].get('employee', {}).get('employee_code')
                                                            HR_ID_TO_INFO_CACHE[cache_key] = {'code': code}
                                                        else:
                                                            HR_ID_TO_INFO_CACHE[cache_key] = {'code': None}
                                                except:
                                                    HR_ID_TO_INFO_CACHE[cache_key] = {'code': None}
                                        
                                        resolved_reporting_to.append({"id": mgr, "name": name, "employee_code": code})
                                    else:
                                        if isinstance(mgr, dict):
                                            emp_id = mgr.get('employee_id')
                                            if emp_id and not mgr.get('employee_code'):
                                                code, resolved_name = resolve_hr_id_to_info(emp_id, api_url, headers)
                                                mgr['employee_code'] = code
                                                if resolved_name:
                                                    mgr['name'] = resolved_name
                                        resolved_reporting_to.append(mgr)
                            elif isinstance(raw_reporting_to, int) or (isinstance(raw_reporting_to, str) and str(raw_reporting_to).isdigit()):
                                code, resolved_name = resolve_hr_id_to_info(raw_reporting_to, api_url, headers)
                                name = resolved_name or (pos_reporting_names[0] if pos_reporting_names else f"Manager {raw_reporting_to}")
                                
                                if not code and name and not name.startswith("Manager"):
                                    cache_key = f"pos_name_{name}"
                                    if cache_key in HR_ID_TO_INFO_CACHE:
                                        code = HR_ID_TO_INFO_CACHE[cache_key].get('code')
                                    else:
                                        try:
                                            s_resp = requests.get(api_url, params={'search': name}, headers=headers, timeout=2.0)
                                            if s_resp.status_code == 200:
                                                s_res = s_resp.json().get('results', [])
                                                if s_res:
                                                    code = s_res[0].get('employee', {}).get('employee_code')
                                                    HR_ID_TO_INFO_CACHE[cache_key] = {'code': code}
                                                else:
                                                    HR_ID_TO_INFO_CACHE[cache_key] = {'code': None}
                                        except:
                                            HR_ID_TO_INFO_CACHE[cache_key] = {'code': None}
                                
                                resolved_reporting_to = [{"id": raw_reporting_to, "name": name, "employee_code": code}]
                            else:
                                if isinstance(raw_reporting_to, dict):
                                    emp_id = raw_reporting_to.get('employee_id')
                                    if emp_id and not raw_reporting_to.get('employee_code'):
                                        code, resolved_name = resolve_hr_id_to_info(emp_id, api_url, headers)
                                        raw_reporting_to['employee_code'] = code
                                        if resolved_name:
                                            raw_reporting_to['name'] = resolved_name
                                    resolved_reporting_to = [raw_reporting_to]
                                else:
                                    resolved_reporting_to = [raw_reporting_to] if raw_reporting_to else []
                            
                            pos['reporting_to'] = resolved_reporting_to

                        # We NO LONGER inject the primary position's reporting_to into the top-level item['position']
                        # because that causes stale data when switching roles. 
                        # The User model's get_current_position() will now handle picking the right one from positions_details.
                        
                        # Only enrich fields that might be missing from list view (like photo or bank details)
                        if detail_data.get('photo') and not item['employee'].get('photo'):
                            item['employee']['photo'] = detail_data.get('photo')
                        if detail_data.get('bank_details'):
                            item['bank_details'] = detail_data.get('bank_details')
                        
                        # CRITICAL: Include all positions for multi-position switching
                        if detail_data.get('positions_details'):
                            item['positions_details'] = detail_data.get('positions_details')
                            
                        transformed_results.append(item)
                        continue 
                except Exception as e:
                    print(f"Error fetching detail for transformed results: {e}")

            # Original summary-based transform
            emp_info = item.get('employee') or {}
            pos_info = item.get('position') or {}
            off_info = item.get('office') or {}
            proj_info = item.get('project') or {}
            
            transformed_results.append({
                "employee": {
                    "id": emp_info.get("id"),
                    "name": emp_info.get("name", "Unknown"),
                    "employee_code": emp_info.get("employee_code"),
                    "photo": emp_info.get("photo"),
                    "email": emp_info.get("email") or "",
                    "phone": emp_info.get("phone") or "",
                },
                "position": {
                    "id": pos_info.get("id"),
                    "code": pos_info.get("code"),
                    "name": pos_info.get("name"),
                    "role_name": pos_info.get("role_name"),
                    "department": pos_info.get("department_name") or pos_info.get("department"),
                    "section": pos_info.get("section_name") or pos_info.get("section"),

                    "reporting_to": pos_info.get("reporting_to", []),
                    "level_rank": pos_info.get("level_rank"),
                    "level_name": pos_info.get("level_name") or (f"Level {pos_info.get('level_rank')}" if pos_info.get("level_rank") else None)
                },
                "project": proj_info,
                "positions_details": item.get("positions_details") or [],
                "office": {
                    "name": off_info.get("name") or off_info.get("office_name"),
                    "level": off_info.get("level") or off_info.get("office_level"),
                    "geo_location": off_info.get("geo_location") or item.get("location_details") or {}
                }
            })
            
        # Globally enrich output objects with authoritative local DB Districts
        _enrich_employee_locations_from_db(transformed_results)

        count = total_count
        if employee_id_filter:
            count = len(transformed_results)

        # Update Global Cache if we just fetched everything fresh
        if fetch_all_pages and not employee_id_filter and not search:
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = time.time()
            GLOBAL_EMPLOYEE_CACHE['data'] = transformed_results


        return {
            "count": count,
            "next": next_url if not (fetch_all_pages or employee_id_filter) else None,
            "previous": prev_url if not (fetch_all_pages or employee_id_filter) else None,
            "results": transformed_results
        }

    except requests.RequestException as e:
        return {"error": f"API Connection Error: {str(e)}"}
    except Exception as e:
        return {"error": f"Data Transformation Error: {str(e)}"}

def get_manager_reports_locations(manager_code):
    """
    Returns unique office locations of employees who report directly to the given manager.
    Uses a global cache to avoid fetching thousands of records on every call.
    """
    import time
    now = time.time()
    
    # Check global cache first
    cached = GLOBAL_EMPLOYEE_CACHE
    if now - cached['timestamp'] < GLOBAL_CACHE_TIMEOUT and cached['data']:
        all_emps_results = cached['data']
    else:
        # Fetch fresh data (summary version is faster)
        # Note: fetch_all_pages=True iterates through all results
        response_data = fetch_employee_data(fetch_all_pages=True)
        if "error" in response_data:
            return []
        
        all_emps_results = response_data.get('results', [])
        # Update cache
        GLOBAL_EMPLOYEE_CACHE['timestamp'] = now
        GLOBAL_EMPLOYEE_CACHE['data'] = all_emps_results

    # 1. Resolve manager's internal employee ID from the manager_code
    manager_id = None
    for item in all_emps_results:
        if item.get('employee', {}).get('employee_code') == manager_code:
            manager_id = item.get('employee', {}).get('id')
            break

    if not manager_id:
        return []

    # 2. Recursively find ALL subordinates at every level
    team_ids = set()
    def find_all_reports(m_id):
        direct_ids = []
        for item in all_emps_results:
            reporting_to = item.get('position', {}).get('reporting_to', [])
            is_match = False
            if reporting_to and isinstance(reporting_to[0], dict):
                r_mgr_id = reporting_to[0].get('employee_id')
                if r_mgr_id and str(r_mgr_id) == str(m_id):
                    is_match = True
            elif reporting_to and isinstance(reporting_to[0], (str, int)):
                if str(reporting_to[0]) == str(m_id):
                    is_match = True
            
            if is_match:
                emp_id = item.get('employee', {}).get('id')
                if emp_id and emp_id not in team_ids:
                    team_ids.add(emp_id)
                    direct_ids.append(emp_id)
        
        for d_id in direct_ids:
            find_all_reports(d_id)

    find_all_reports(manager_id)

    # 3. Collect geo_location cluster/district for all team members
    team_locations = set()
    for item in all_emps_results:
        emp_id = item.get('employee', {}).get('id')
        if emp_id in team_ids:
            geo = item.get('office', {}).get('geo_location', {})
            # Prioritize cluster > district > mandal > office name
            loc_label = (geo.get('cluster') or geo.get('district') or geo.get('mandal') or 
                         item.get('office', {}).get('name') or '').strip()
            if loc_label:
                team_locations.add(loc_label)

    return sorted(list(team_locations))

def sync_user_hierarchy(user):
    """
    DEPRECATED: Hierarchy is now dynamic via User model properties.
    This function remains as a stub to avoid breaking legacy imports.
    """
    return None

def fetch_geo_data():
    """
    Fetches full hierarchy data from the external Geo API.
    """
    try:
        # Get configured API Key
        if SystemConfig.objects.filter(key='geo_api_key').exists():
            encrypted_key = SystemConfig.objects.get(key='geo_api_key').value
            api_key = decrypt_key(encrypted_key)
            if not api_key:
                 return {"error": "Failed to decrypt Geo API Key. Please re-type the key in settings.", "status_code": 500}
        else:
            return {"error": "Geo API Key not configured in system settings.", "status_code": 500}

        # Get configured API URL
        if SystemConfig.objects.filter(key='geo_api_url').exists():
            api_url = SystemConfig.objects.get(key='geo_api_url').value
        else:
            return {"error": "Geo API URL not configured in system settings."}
            
        headers = {
            "X-Api-Key": api_key,
            "Accept": "application/json"
        }
        
        start_time = time.time()
        response = requests.get(api_url, headers=headers, timeout=30)
        latency = (time.time() - start_time) * 1000

        try:
            from .models import APILog
            APILog.objects.create(
                source="Geo Integration",
                endpoint=api_url,
                method="GET",
                status_code=response.status_code,
                latency_ms=latency
            )
        except Exception as log_err:
            print(f"Failed to log geo API call: {log_err}")

        response.raise_for_status()
        return response.json() or {}

    except requests.exceptions.Timeout as e:
        print(f"Geo API Connection Timed Out: {str(e)}")
        return {"error": "Geo API Connection Timed Out. Please try again later.", "status_code": 408}
    except requests.RequestException as e:
        status_code = getattr(e.response, 'status_code', 'Unknown')
        
        # MAP 401/403 to 503 to avoid frontend logout
        if status_code in [401, 403]:
            error_msg = f"Geo API Authentication Error (External Status {status_code})."
            status_code = 503
        else:
            error_msg = f"Geo API Service Unavailable (Status {status_code})."
            
        print(f"Geo API Connection Error (Status {status_code}): {str(e)}")
        return {"error": error_msg, "status_code": status_code}
    except Exception as e:
        print(f"An unexpected error occurred in Geo API: {str(e)}")
        return {"error": "An unexpected error occurred while fetching location data.", "status_code": 500}