import requests
import time
import threading
from django.core.cache import cache
from .models import SystemConfig
from .utils import decrypt_key
from core.models import User, Role

_cache_warming = False
_cache_warm_lock = threading.Lock()

def safe_cache_get(key, default=None):
    """Wraps cache.get to handle Windows file-lock PermissionErrors gracefully."""
    try:
        val = cache.get(key, default)
    except (PermissionError, OSError):
        val = default

    if key == 'GLOBAL_EMPLOYEE_DATA' and not val:
        global _cache_warming
        if not _cache_warming:
            with _cache_warm_lock:
                if not _cache_warming:
                    _cache_warming = True
                    def _warm_in_bg():
                        global _cache_warming
                        try:
                            _bg_refresh_global_employee_cache()
                        except Exception:
                            pass
                        finally:
                            _cache_warming = False
                    t = threading.Thread(target=_warm_in_bg, daemon=True)
                    t.start()
    return val


def safe_cache_set(key, value, timeout=None):
    """Wraps cache.set to handle Windows file-lock PermissionErrors gracefully."""
    try:
        cache.set(key, value, timeout)
    except (PermissionError, OSError):
        pass

def safe_cache_delete(key):
    """Wraps cache.delete to handle Windows file-lock PermissionErrors gracefully."""
    try:
        cache.delete(key)
    except (PermissionError, OSError):
        pass

# EXTERNAL_API_URL = "http://192.168.1.235:8000/api/employees/"  

# Global in-memory cache for dynamic data to avoid N+1 API calls
# In a production environment, this should be replaced with Redis/Memcached.
CACHE_EMPLOYEE_DATA = {}
CACHE_TIMEOUT = 300 # Restored to 5 minutes to fix global app slowness

# HR ID to Info mapping (code and name)
HR_ID_TO_INFO_CACHE = {}

# Full employee list cache for team filtering
GLOBAL_EMPLOYEE_CACHE = {'timestamp': 0, 'data': []}
GLOBAL_CACHE_TIMEOUT = 86400 # 24 hours

def _find_best_matching_employee_code(s_res, target_position_name):
    """
    Performs a rigorous title-matching scan across search results to find the 
    employee holding the exact position, preventing fuzzy-search hijack bugs.
    """
    if not s_res:
        return None
        
    target_clean = str(target_position_name or "").strip().lower()
    if not target_clean:
        for item in s_res:
            if isinstance(item, dict):
                code = item.get('employee', {}).get('employee_code')
                if code: return code
        return None
        
    # Pass 1: Look for Exact Match in Primary Position
    for item in s_res:
        if not isinstance(item, dict): continue
        emp_pos = item.get('position', {})
        if not isinstance(emp_pos, dict): continue
        pos_name = str(emp_pos.get('name') or "").strip().lower()
        
        if pos_name == target_clean:
            code = item.get('employee', {}).get('employee_code')
            if code:
                return code

    # Pass 2: Look for Exact Match in Any Secondary Position
    for item in s_res:
        if not isinstance(item, dict): continue
        pos_list = item.get('positions_details') or []
        if not isinstance(pos_list, list): continue
        
        for p_det in pos_list:
            if not isinstance(p_det, dict): continue
            det_name = str(p_det.get('name') or "").strip().lower()
            if det_name == target_clean:
                code = item.get('employee', {}).get('employee_code')
                if code:
                    return code

    # Pass 3: Last Resort Fallback (reproduce legacy behavior rather than fail)
    for item in s_res:
        if isinstance(item, dict):
            code = item.get('employee', {}).get('employee_code')
            if code:
                return code
                
    return None


def resolve_hr_id_to_info(hr_id, api_url, headers):
    """Resolves an internal HR ID to (employee_code, name) by fetching details."""
    if not hr_id: return None, None
    hr_id_str = str(hr_id).strip()
    
    cache_key = f"hr_id_info_{hr_id_str}"
    cached_info = safe_cache_get(cache_key)
    if cached_info is not None:
        return cached_info.get('code'), cached_info.get('name')
        
    # Check global employee data cache
    persistent_global = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
    if persistent_global:
        for item in persistent_global:
            emp = item.get('employee', {})
            if str(emp.get('id')).strip() == hr_id_str or str(emp.get('employee_code')).strip().lower() == hr_id_str.lower():
                code = emp.get('employee_code')
                name = emp.get('name')
                if code:
                    info = {'code': code, 'name': name}
                    safe_cache_set(cache_key, info, 2592000)
                    return code, name
                    
    return None, None

def resolve_hr_id_to_code(hr_id, api_url, headers):
    """Legacy wrapper for resolve_hr_id_to_info."""
    code, _ = resolve_hr_id_to_info(hr_id, api_url, headers)
    return code

def resolve_numeric_employee_id(emp_id_val):
    """
    Tries to resolve a purely numeric manager database ID (like 7106)
    into the actual string employee_code (like HR-EMP-06889) and name,
    by scanning the global cache first, then falling back to API lookup.
    """
    if not emp_id_val:
        return None, None
    emp_id_str = str(emp_id_val).strip()
    if not emp_id_str.isdigit():
        return None, None
        
    # 1. Look in the global employee list cache
    global_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
    if global_data:
        for item in global_data:
            emp = item.get('employee', {})
            if str(emp.get('id')) == emp_id_str:
                code = emp.get('employee_code')
                name = emp.get('name')
                if code:
                    return code, name
                    
    # 2. Fallback to API resolver using existing services
    try:
        if SystemConfig.objects.filter(key='external_api_url').exists() and SystemConfig.objects.filter(key='external_api_key').exists():
            api_url = SystemConfig.objects.get(key='external_api_url').value
            encrypted_key = SystemConfig.objects.get(key='external_api_key').value
            api_key = decrypt_key(encrypted_key)
            headers = {"X-Api-Key": api_key, "Accept": "application/json"}
            code, name = resolve_hr_id_to_info(emp_id_str, api_url, headers)
            if code:
                return code, name
    except Exception:
        pass
        
    return None, None

def get_dynamic_employee_data(employee_code, force_fresh=False):
    """
    Fetches employee details in real-time. Checks local caches first unless force_fresh=True.
    Optimized with Django Persistent Caching to eliminate cold starts completely.
    """
    import time
    if not employee_code:
        return None
        
    cache_key = f"EMP_DATA_PERSISTENT_{str(employee_code).strip().upper()}"
    
    # 1. Check memory/persistent global employee cache FIRST (Master source of truth)
    # If the global employee cache has the data, that is always fresh and authoritative,
    # and it automatically heals any transient negative cache (not_found=True) records.
    g_cached = GLOBAL_EMPLOYEE_CACHE
    if not force_fresh:
        now = time.time()
        if not g_cached['data'] or now - g_cached['timestamp'] >= GLOBAL_CACHE_TIMEOUT:
            persistent_global = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
            if persistent_global:
                g_cached['data'] = persistent_global
                g_cached['timestamp'] = safe_cache_get('GLOBAL_EMPLOYEE_DATA_TIMESTAMP') or now
                
        if g_cached['data'] and now - g_cached['timestamp'] < GLOBAL_CACHE_TIMEOUT:
            for item in g_cached['data']:
                if item.get('employee', {}).get('employee_code') == employee_code:
                    if item.get('positions_details'):
                        # Overwrite/promote to persistent cache to heal/update it, then return
                        safe_cache_set(cache_key, item, timeout=2592000)
                        return item

    # 2. Check Persistent Cache (fallback/individual cached entries)
    if not force_fresh:
        persistent_data = safe_cache_get(cache_key)
        if persistent_data:
            if isinstance(persistent_data, dict):
                if persistent_data.get('not_found'):
                    return None
                if persistent_data.get('positions_details'):
                    return persistent_data

    # 3. Fetch from API (Cold start fallback - executed max once per hour per employee)
    data = fetch_employee_data(employee_id_filter=employee_code, page_size=1, force_fresh=force_fresh)
    if data and not data.get('error'):
        if data.get('results'):
            emp_data = data['results'][0]
            # Commit to persistent cache with 30-day timeout (Organizational structures are stable)
            safe_cache_set(cache_key, emp_data, timeout=2592000)
            return emp_data
        else:
            # Cache negative result ONLY if API successfully ran but returned 0 results (user doesn't exist)
            safe_cache_set(cache_key, {"not_found": True}, timeout=2592000)
    else:
        # DO NOT cache negative results on transient errors or timeouts!
        # Just return None for now, so next request can retry fetching.
        pass
        
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

def fetch_employee_data(employee_id_filter=None, page=1, search=None, api_key_override=None, fetch_all_pages=False, page_size=20, force_fresh=False):
    """
    Fetches employee data with direct pagination and search forwarding.
    Supports a custom page_size by fetching multiple pages from external API if needed.
    """
    # If not forcing a fresh API sync, fetch entirely from local cache
    if not force_fresh:
        persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA') or []
        matched_items = []
        
        if employee_id_filter:
            filter_lower = str(employee_id_filter).strip().lower()
            for item in persistent_data:
                emp = item.get('employee', {})
                code = str(emp.get('employee_code') or '').strip().lower()
                if code == filter_lower:
                    matched_items.append(item)
                    break
        elif search:
            search_lower = str(search).strip().lower()
            for item in persistent_data:
                emp = item.get('employee', {})
                code = str(emp.get('employee_code') or '').strip().lower()
                name = str(emp.get('name') or '').strip().lower()
                if search_lower in code or search_lower in name:
                    matched_items.append(item)
        else:
            matched_items = persistent_data
            
        # Apply pagination on matched_items
        total_count = len(matched_items)
        start_idx = (int(page) - 1) * int(page_size)
        end_idx = start_idx + int(page_size)
        sliced = matched_items[start_idx:end_idx] if not fetch_all_pages else matched_items
        
        return {
            "count": total_count,
            "next": None,
            "previous": None,
            "results": sliced
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
        
        session = requests.Session()
        # Configure connection pool adapter to keep connections alive
        adapter = requests.adapters.HTTPAdapter(pool_connections=4, pool_maxsize=4)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        session.headers.update(headers)
        
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
            # Fast fail-fast timeout of 35 seconds for single records, 120 seconds for full listing
            t_val = 35 if (employee_id_filter or search) else 120
            response = session.get(api_url, params=params, timeout=t_val)
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
                                # 25s timeout per page — gives headroom, while keep-alive keeps handshake latency low
                                p_resp = session.get(api_url, params=p_params, timeout=25)
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

                    # Lower concurrency to 4 workers to prevent rate-limiting and overloading the external API server
                    with ThreadPoolExecutor(max_workers=4) as executor:
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
            
            employee = item.get('employee') or {}
            
            # Filter out inactive employees
            status = str(employee.get('status') or '').strip().lower()
            if status == 'inactive':
                continue
                
            emp_id_api = employee.get('id')
            
            if employee_id_filter and emp_id_api:
                try:
                    detail_cache_key = f"emp_detail_data_{emp_id_api}"
                    cached_item = safe_cache_get(detail_cache_key)
                    if cached_item and not force_fresh:
                        transformed_results.append(cached_item)
                        continue

                    detail_url = api_url.rstrip('/') + f"/{emp_id_api}/"
                    detail_resp = session.get(detail_url, timeout=25.0)  # Increased timeout for slow external API
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
                                            # Cache check for position name using high-speed disk cache
                                            cache_key = f"pos_name_res_{name.replace(' ', '_').lower()[:40]}"
                                            cached_code = safe_cache_get(cache_key)
                                            if cached_code is not None:
                                                code = cached_code
                                            else:
                                                try:
                                                    s_resp = session.get(api_url, params={'search': name}, timeout=25.0)
                                                    if s_resp.status_code == 200:
                                                        s_data = s_resp.json() or {}
                                                        s_res = s_data.get('results', [])
                                                        if s_res:
                                                            # BUG FIX: Match position strictly, don't blindly take s_res[0]
                                                            code = _find_best_matching_employee_code(s_res, name)
                                                            safe_cache_set(cache_key, code, 3600) # Cache for 1 hour
                                                        else:
                                                            safe_cache_set(cache_key, None, 300)
                                                except:
                                                    safe_cache_set(cache_key, None, 300)
                                        
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
                                    # Cache check for position name using high-speed disk cache
                                    cache_key = f"pos_name_res_{name.replace(' ', '_').lower()[:40]}"
                                    cached_code = safe_cache_get(cache_key)
                                    if cached_code is not None:
                                        code = cached_code
                                    else:
                                        try:
                                            s_resp = session.get(api_url, params={'search': name}, timeout=25.0)
                                            if s_resp.status_code == 200:
                                                s_data = s_resp.json() or {}
                                                s_res = s_data.get('results', [])
                                                if s_res:
                                                    # BUG FIX: Match position strictly, don't blindly take s_res[0]
                                                    code = _find_best_matching_employee_code(s_res, name)
                                                    safe_cache_set(cache_key, code, 3600) # Cache for 1 hour
                                                else:
                                                    safe_cache_set(cache_key, None, 300)
                                        except:
                                            safe_cache_set(cache_key, None, 300)
                                
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
                            
                        safe_cache_set(detail_cache_key, item, 86400) # Cache details for 24 hours
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
                    "status": emp_info.get("status"),
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
            now_time = time.time()
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = now_time
            GLOBAL_EMPLOYEE_CACHE['data'] = transformed_results
            
            # Also write to persistent cache for cross-worker re-use
            safe_cache_set('GLOBAL_EMPLOYEE_DATA', transformed_results, timeout=86400)
            safe_cache_set('GLOBAL_EMPLOYEE_DATA_TIMESTAMP', now_time, timeout=86400)


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

def _bg_refresh_global_employee_cache():
    """Safely refreshes global employee cache in background thread to guarantee no block."""
    lock_key = 'GLOBAL_EMPLOYEE_DATA_REFRESH_LOCK'
    try:
        from django.db import connection
        connection.close()
        
        resp = fetch_employee_data(fetch_all_pages=True, force_fresh=True)
        if resp and not resp.get('error') and "results" in resp:
            data = resp.get('results', [])
            now = time.time()
            safe_cache_set('GLOBAL_EMPLOYEE_DATA', data, timeout=86400)
            safe_cache_set('GLOBAL_EMPLOYEE_DATA_TIMESTAMP', now, timeout=86400)
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = now
            GLOBAL_EMPLOYEE_CACHE['data'] = data
            
            # Extract and cache unique projects list
            unique_projects = {}
            for item in data:
                proj = item.get('project', {})
                if proj and isinstance(proj, dict):
                    name = proj.get('name')
                    code = proj.get('code')
                    if name and code:
                        unique_projects[code] = {"name": name, "code": code}
            if unique_projects:
                from django.core.cache import cache
                cache.set('UNIQUE_PROJECTS_LIST', list(unique_projects.values()), 30 * 86400)

            # Clear position maps & in-memory caches to guarantee fresh recalculation on next access
            CACHE_EMPLOYEE_DATA.clear()
            safe_cache_delete('position_to_employee_codes_map')
            safe_cache_delete('user_position_identifiers')
    except Exception as e:
        print(f"Background global cache refresh failed: {e}")
    finally:
        safe_cache_delete(lock_key)

def get_manager_reports_locations(manager_code):
    """
    Returns unique office locations of employees who report directly to the given manager.
    Optimized with Stale-While-Revalidate and Persistent Cache for INSTANT template downloads.
    """
    import time
    now = time.time()
    
    # 1. Resolve cache
    all_emps_results = None
    cached = GLOBAL_EMPLOYEE_CACHE
    if now - cached['timestamp'] < GLOBAL_CACHE_TIMEOUT and cached['data']:
        all_emps_results = cached['data']
    else:
        persistent_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA')
        if persistent_data:
            cached_ts = safe_cache_get('GLOBAL_EMPLOYEE_DATA_TIMESTAMP') or now
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = cached_ts
            GLOBAL_EMPLOYEE_CACHE['data'] = persistent_data
            all_emps_results = persistent_data

    # 2. Trigger background refresh if empty or stale (older than 2 hours)
    cached_ts = safe_cache_get('GLOBAL_EMPLOYEE_DATA_TIMESTAMP') or 0
    is_expired = (now - cached_ts > 7200)
    is_empty = (all_emps_results is None)
    
    if is_empty or is_expired:
        lock_key = 'GLOBAL_EMPLOYEE_DATA_REFRESH_LOCK'
        # Set lock to prevent concurrent background downloads (increased to 2 hours for slow external API)
        try:
            if cache.add(lock_key, '1', timeout=7200):
                t = threading.Thread(target=_bg_refresh_global_employee_cache)
                t.daemon = True
                t.start()
        except (PermissionError, OSError):
            # If cache.add fails due to Windows file lock, we just skip background refresh this time
            pass

    # 3. Fast Fallback for complete Cache Miss (so first run does NOT hang)
    if not all_emps_results:
        try:
            from travel_masters.models import Location
            # Return popular configured Mandals/Districts instantly
            db_locs = list(Location.objects.filter(location_type__in=['District', 'Mandal']).values_list('name', flat=True).order_by('name')[:100])
            if db_locs:
                return sorted(list(set([str(l).upper().strip() for l in db_locs if l])))
        except Exception:
            pass
        return ["HEAD OFFICE", "FIELD OFFICE", "CLIENT SITE"]

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

def fetch_geo_data(force_fresh=False):
    """
    Fetches full hierarchy data from the external Geo API.
    """
    cache_key = "GEO_HIERARCHY_DATA"
    fallback_key = "GEO_HIERARCHY_DATA_FALLBACK"

    if not force_fresh:
        cached_data = safe_cache_get(cache_key)
        if cached_data:
            return cached_data

    try:
        # Get configured API Key
        if SystemConfig.objects.filter(key='geo_api_key').exists():
            encrypted_key = SystemConfig.objects.get(key='geo_api_key').value
            api_key = decrypt_key(encrypted_key)
            if not api_key:
                fallback_data = safe_cache_get(fallback_key)
                if fallback_data:
                    return fallback_data
                return {"error": "Failed to decrypt Geo API Key. Please re-type the key in settings.", "status_code": 500}
        else:
            fallback_data = safe_cache_get(fallback_key)
            if fallback_data:
                return fallback_data
            return {"error": "Geo API Key not configured in system settings.", "status_code": 500}

        # Get configured API URL
        if SystemConfig.objects.filter(key='geo_api_url').exists():
            api_url = SystemConfig.objects.get(key='geo_api_url').value
        else:
            fallback_data = safe_cache_get(fallback_key)
            if fallback_data:
                return fallback_data
            return {"error": "Geo API URL not configured in system settings."}
            
        headers = {
            "X-Api-Key": api_key,
            "Accept": "application/json"
        }
        
        start_time = time.time()
        response = requests.get(api_url, headers=headers, timeout=30.0)  # Increased timeout for geo API
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
        data = response.json() or {}
        
        if data and "error" not in data:
            safe_cache_set(cache_key, data, timeout=3600)  # Cache for 1 hour
            safe_cache_set(fallback_key, data, timeout=2592000)  # Persistent fallback for 30 days
            
        return data

    except requests.exceptions.Timeout as e:
        print(f"Geo API Connection Timed Out: {str(e)}")
        fallback_data = safe_cache_get(fallback_key)
        if fallback_data:
            print("Returning fallback cached geo data.")
            return fallback_data
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
        
        fallback_data = safe_cache_get(fallback_key)
        if fallback_data:
            print("Returning fallback cached geo data.")
            return fallback_data
            
        return {"error": error_msg, "status_code": status_code}
    except Exception as e:
        print(f"An unexpected error occurred in Geo API: {str(e)}")
        fallback_data = safe_cache_get(fallback_key)
        if fallback_data:
            print("Returning fallback cached geo data.")
            return fallback_data
        return {"error": "An unexpected error occurred while fetching location data.", "status_code": 500}

def evict_employee_cache(employee_code):
    """
    Evicts all cached entries for a given employee code, including individual
    persistent caches, local process caches, and global/position maps.
    """
    if not employee_code:
        return
        
    code_clean = str(employee_code).strip().upper()
    
    # 1. Clear individual persistent employee cache
    cache_key = f"EMP_DATA_PERSISTENT_{code_clean}"
    safe_cache_delete(cache_key)
    
    # 2. Clear process-level cache if it exists
    from api_management.services import CACHE_EMPLOYEE_DATA
    if code_clean in CACHE_EMPLOYEE_DATA:
        del CACHE_EMPLOYEE_DATA[code_clean]
    # Check case-insensitive versions
    for k in list(CACHE_EMPLOYEE_DATA.keys()):
        if str(k).strip().upper() == code_clean:
            del CACHE_EMPLOYEE_DATA[k]
            
    # 3. Clear position-to-employee maps and user position identifiers
    safe_cache_delete('position_to_employee_codes_map')
    safe_cache_delete('user_position_identifiers')
    
    # 4. Clear/invalidate the global employee cache to force reload
    safe_cache_delete('GLOBAL_EMPLOYEE_DATA')
    safe_cache_delete('GLOBAL_EMPLOYEE_DATA_TIMESTAMP')
    
    from api_management.services import GLOBAL_EMPLOYEE_CACHE
    GLOBAL_EMPLOYEE_CACHE['data'] = None
    GLOBAL_EMPLOYEE_CACHE['timestamp'] = 0
