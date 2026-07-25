from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from core.views import hash_password
from core.models import Role, User
from .models import SystemConfig, APIKeyHistory
from .services import fetch_employee_data, fetch_geo_data, evict_employee_cache
from core.permissions import IsCustomAuthenticated, IsAdmin
from .utils import encrypt_key, decrypt_key
import uuid
import random
import string
from django.db.models import Avg
from django.core.mail import send_mail
from django.conf import settings

def promote_active_position(data, request):
    active_position_id = request.headers.get('X-Active-Position-Id') or (
        request.custom_user.active_position_id if hasattr(request, 'custom_user') and request.custom_user else None
    )
    if active_position_id and isinstance(data, dict) and "results" in data:
        active_pos_str = str(active_position_id).strip()
        user_emp_id = request.custom_user.employee_id if hasattr(request, 'custom_user') and request.custom_user else None
        
        for item in data.get('results', []):
            emp_code = item.get('employee', {}).get('employee_code')
            if emp_code and user_emp_id and str(emp_code).strip().lower() == str(user_emp_id).strip().lower():
                pos_details = item.get('positions_details', []) or []
                active_pos_obj = None
                for p in pos_details:
                    if str(p.get('id')).strip() == active_pos_str:
                        active_pos_obj = p
                        break
                if active_pos_obj:
                    item['position'] = active_pos_obj
                    other_pos = [p for p in pos_details if str(p.get('id')).strip() != active_pos_str]
                    item['positions_details'] = [active_pos_obj] + other_pos
                    
                    # Dynamically set root project object from active position project name
                    proj_name = active_pos_obj.get('project_name') or active_pos_obj.get('project')
                    if proj_name:
                        from django.core.cache import cache as django_cache
                        unique_projs = django_cache.get('UNIQUE_PROJECTS_LIST') or []
                        proj_code = None
                        for p in unique_projs:
                            if str(p.get('name')).strip().lower() == str(proj_name).strip().lower():
                                proj_code = p.get('code')
                                break
                        if not proj_code:
                            import re
                            if '104' in proj_name:
                                proj_code = 'AP-104-MMUS'
                            elif '1962' in proj_name:
                                proj_code = 'AP-1962-MVU'
                            elif '108' in proj_name:
                                proj_code = 'AP-108'
                            else:
                                num_match = re.search(r'(\d+)', proj_name)
                                proj_code = f"PROJ-{num_match.group(1)}" if num_match else proj_name[:6].upper()
                                
                        item['project'] = {
                            'name': proj_name,
                            'code': proj_code
                        }
    return data

class EmployeeListView(APIView):
    permission_classes = [IsCustomAuthenticated]

    def get(self, request):
        page = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 20)
        search = request.query_params.get('search')
        employee_code = request.query_params.get('employee_code') or request.query_params.get('id')
        
        data = fetch_employee_data(
            employee_id_filter=employee_code, 
            page=page, 
            search=search,
            fetch_all_pages=False,
            page_size=page_size
        )
        
        if "error" in data:
            # If it's just a 404/not found for a specific employee filter, return empty
            if data.get("status_code") == 404:
                return Response({"count": 0, "next": None, "previous": None, "results": []})
            
            # For timeouts and other errors, return the clean error message
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({"error": data["error"]}, status=status_code)
            
        data = promote_active_position(data, request)
        return Response(data)

class EmployeeDropdownView(APIView):
    """
    Lightweight endpoint for searchable dropdowns. 
    Returns only id, name, and employee_code.
    """
    permission_classes = [IsCustomAuthenticated]

    def get(self, request):
        search = request.query_params.get('search', '')
        page = request.query_params.get('page', 1)
        requester_code = request.query_params.get('requester_code')
        
        # Get requester role and level if provided
        requester_rank = 99
        is_admin = False
        
        if requester_code:
            # We use our own User model to check role first
            user_obj = User.objects.filter(employee_id=requester_code).first()
            if user_obj:
                role_name = (user_obj.role.name if user_obj.role else '').lower()
                is_admin = any(keyword in role_name for keyword in ['admin', 'superuser', 'it admin'])
                
                # If not admin, get their rank to filter
                if not is_admin:
                    requester_rank = user_obj.level_rank # This calls external API via dynamic property

        # Use a raw fetch to avoid heavy transformation for dropdowns
        data = fetch_employee_data(search=search, page=page)
        
        if "error" in data:
            return Response({
                "error": data["error"],
                "results": [],
                "count": 0
            }, status=status.HTTP_200_OK) # Return 200 so frontend can handle it gracefully
            
        data = promote_active_position(data, request)
        results = []
        for item in data.get('results', []):
            emp = item.get('employee', {})
            pos = item.get('position', {})
            off = item.get('office', {})
            
            emp_rank = pos.get('level_rank') or 99
            
            # HIERARCHY FILTERING LOGIC
            # 1. Admins see all
            # 2. Others see peers (same rank) and subordinates (higher rank number)
            # Example: requester is rank 5 -> can see ranks 5, 6, 7...
            if not is_admin:
                if emp_rank < requester_rank:
                    continue # Hide superiors
            
            results.append({
                'id': emp.get('id'),
                'name': emp.get('name'),
                'employee_code': emp.get('employee_code'),
                'designation': pos.get('name') or pos.get('role_name') or 'N/A',
                'level': off.get('level') or pos.get('level_rank') or 'N/A',
                'numeric_level': emp_rank
            })
            
        return Response({
            'count': data.get('count', 0),
            'next': data.get('next'),
            'previous': data.get('previous'),
            'results': results
        })

class SignupView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        employee_code = request.data.get('employee_code') or request.data.get('employee_id')

        if not employee_code:
            return Response({'error': 'Employee code/id is required'}, status=status.HTTP_400_BAD_REQUEST)

        data = fetch_employee_data(employee_id_filter=employee_code)

        if "error" in data:
             return Response({'error': 'Failed to verify employee with external system'}, status=status.HTTP_502_BAD_GATEWAY)
        
        if data.get('count') == 0 or not data.get('results'):
            return Response({'error': 'Invalid Employee Code'}, status=status.HTTP_404_NOT_FOUND)

        employee_data = data['results'][0]
        emp_info = employee_data.get('employee', {})
        pos_info = employee_data.get('position', {})
        
        first_name = emp_info.get('name', 'Unknown')
        email = emp_info.get('email')
        
        if not email:
            email = f"{employee_code.lower()}@example.com"
            
        role_name = 'Employee' 
        role, _ = Role.objects.get_or_create(name=role_name)

        # Generate Password: 8-12 chars, 1 upper, 1 special, 1 number
        length = random.randint(8, 12)
        upper = random.choice(string.ascii_uppercase)
        special = random.choice("!@#$%^&*")
        number = random.choice(string.digits)
        others = ''.join(random.choices(string.ascii_letters + string.digits, k=length-3))
        pwd_list = list(upper + special + number + others)
        random.shuffle(pwd_list)
        generated_password = ''.join(pwd_list)

        defaults = {
            'role': role,
            'password_hash': hash_password(generated_password),
            'is_active': True,
            'requires_password_change': True
        }

        user, created = User.objects.update_or_create(
            employee_id=employee_code,
            defaults=defaults
        )


        resend_requested = request.data.get('resend', False)
        if created or resend_requested:
            import datetime
            subject = 'Welcome to BTGS - Your Account is Activated'
            plain_message = f'Hello {first_name},\n\nWelcome to BTGS.\n\nYour account has been activated. Your temporary password is: {generated_password}\n\nPlease login and change your password.\n\nThank you.'
            
            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {{
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        background-color: #f8fafc;
                        margin: 0;
                        padding: 0;
                    }}
                    .container {{
                        max-width: 600px;
                        margin: 40px auto;
                        background-color: #ffffff;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.05);
                        overflow: hidden;
                        border: 1px solid #e2e8f0;
                    }}
                    .header {{
                        background-color: #1e293b;
                        padding: 24px 0;
                        text-align: center;
                    }}
                    .header h1 {{
                        color: #ffffff;
                        margin: 0;
                        font-size: 28px;
                        font-weight: 600;
                        letter-spacing: 0.5px;
                    }}
                    .content {{
                        padding: 32px;
                        color: #334155;
                        line-height: 1.6;
                        font-size: 15px;
                    }}
                    .content h2 {{
                        color: #0f172a;
                        font-size: 22px;
                        margin-top: 0;
                    }}
                    .password-box {{
                        background-color: #f1f5f9;
                        border: 1px solid #cbd5e1;
                        padding: 16px;
                        margin: 24px 0;
                        font-size: 20px;
                        font-family: 'Courier New', Courier, monospace;
                        font-weight: bold;
                        color: #0284c7;
                        text-align: center;
                        letter-spacing: 3px;
                        border-radius: 6px;
                    }}
                    .footer {{
                        background-color: #f8fafc;
                        padding: 20px;
                        text-align: center;
                        font-size: 12px;
                        color: #64748b;
                        border-top: 1px solid #e2e8f0;
                    }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>BTGS Portal</h1>
                    </div>
                    <div class="content">
                        <h2>Welcome to BTGS, {first_name}!</h2>
                        <p>Your corporate account has been successfully created and activated. To access the portal, please use the temporary secure password generated for you below.</p>
                        
                        <div class="password-box">
                            {generated_password}
                        </div>
                        
                        <p><strong>Important Security Notice:</strong> You will be required to change this password immediately upon your first login. Your new password must contain at least 8 characters, an uppercase letter, a number, and a special character.</p>
                        <p>If you encounter any issues or did not request this access, please contact the IT Administration team immediately.</p>
                        
                        <p>Best Regards,<br><strong>The BTGS Team</strong></p>
                    </div>
                    <div class="footer">
                        &copy; {datetime.datetime.now().year} BTGS (Bavya-TGS). All rights reserved.<br/>
                        This is an automated message, please do not reply.
                    </div>
                </div>
            </body>
            </html>
            """
            
            send_mail(
                subject,
                plain_message,
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
                html_message=html_message
            )

        message_response = "User created and email sent successfully" if created else ("Email resent successfully" if resend_requested else "User linked/updated successfully")
        return Response({'message': message_response}, status=status.HTTP_201_CREATED)

class SyncAllUsersView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        from api_management.services import safe_cache_delete, GLOBAL_EMPLOYEE_CACHE
        # Clear caches
        safe_cache_delete('GLOBAL_EMPLOYEE_DATA')
        safe_cache_delete('GLOBAL_EMPLOYEE_DATA_TIMESTAMP')
        safe_cache_delete('UNIQUE_PROJECTS_LIST')
        safe_cache_delete('EXTERNAL_ROLES_LIST')
        safe_cache_delete('position_to_employee_codes_map')
        safe_cache_delete('user_position_identifiers')
        GLOBAL_EMPLOYEE_CACHE['data'] = []
        GLOBAL_EMPLOYEE_CACHE['timestamp'] = 0

        data = fetch_employee_data(fetch_all_pages=True, force_fresh=True)
        if "error" in data:
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'error': data['error']}, status=status_code)

        results = data.get('results', [])
        
        # Extract and cache unique projects list
        unique_projects = {}
        for item in results:
            proj = item.get('project', {})
            if proj and isinstance(proj, dict):
                name = proj.get('name')
                code = proj.get('code')
                if name and code:
                    unique_projects[code] = {"name": name, "code": code}
        if unique_projects:
            from django.core.cache import cache
            cache.set('UNIQUE_PROJECTS_LIST', list(unique_projects.values()), 30 * 86400)

        created_count = 0
        
        role_name = 'Employee'
        role, _ = Role.objects.get_or_create(name=role_name)

        from api_management.services import safe_cache_delete
        from datetime import datetime, date
        today = date.today()

        for item in results:
            emp = item.get('employee', {})
            code = emp.get('employee_code')
            if not code: continue
            
            evict_employee_cache(code)
            emp_id_api = emp.get('id')
            if emp_id_api:
                safe_cache_delete(f"emp_detail_data_{emp_id_api}")
                
            status_clean = str(item.get('employee', {}).get('status') or item.get('status') or '').strip().lower()
            is_blocked = status_clean in ['inactive', 'suspended', 'blocked', 'resigned']
            
            for field in ['resignation_date', 'end_date', 'scheduled_to_date', 'scheduled_to', 'leaving_date', 'last_working_day', 'last_working_date']:
                val_str = emp.get(field) or item.get(field)
                if val_str:
                    try:
                        limit_date = datetime.strptime(str(val_str).split('T')[0], '%Y-%m-%d').date()
                        if limit_date < today:
                            is_blocked = True
                    except:
                        pass
            
            user = User.objects.filter(employee_id=code).first()
            if user:
                user.is_active = not is_blocked
                user.save()
            else:
                user = User.objects.create(
                    employee_id=code,
                    role=role,
                    password_hash=hash_password('user123'),
                    is_active=not is_blocked
                )
                created_count += 1
                
        return Response({
            'message': f'Successfully synced and created {created_count} new users.',
            'total_synced': len(results)
        }, status=status.HTTP_200_OK)

class SyncUsersPageView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        page = request.data.get('page', 1)
        # 1. Clear global cache on page 1 of sync to ensure it doesn't return stale records
        if int(page) == 1:
            from api_management.services import safe_cache_delete, GLOBAL_EMPLOYEE_CACHE
            safe_cache_delete('GLOBAL_EMPLOYEE_DATA')
            safe_cache_delete('GLOBAL_EMPLOYEE_DATA_TIMESTAMP')
            safe_cache_delete('UNIQUE_PROJECTS_LIST')
            safe_cache_delete('TEMP_SYNC_PROJECTS')
            safe_cache_delete('EXTERNAL_ROLES_LIST')
            safe_cache_delete('position_to_employee_codes_map')
            safe_cache_delete('user_position_identifiers')
            GLOBAL_EMPLOYEE_CACHE['data'] = []
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = 0

        # 2. Fetch employee data page-by-page bypassing cache
        data = fetch_employee_data(page=page, force_fresh=True)
        
        if "error" in data:
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'error': data['error']}, status=status_code)

        results = data.get('results', [])
        
        # Accumulate projects for this page
        from api_management.services import safe_cache_get, safe_cache_set
        temp_projects = safe_cache_get('TEMP_SYNC_PROJECTS') or {}
        for item in results:
            proj = item.get('project', {})
            if proj and isinstance(proj, dict):
                name = proj.get('name')
                code = proj.get('code')
                if name and code:
                    temp_projects[code] = {"name": name, "code": code}
        safe_cache_set('TEMP_SYNC_PROJECTS', temp_projects, 3600)

        created_count = 0
        
        role_name = 'Employee'
        role, _ = Role.objects.get_or_create(name=role_name)

        from api_management.services import safe_cache_delete
        from datetime import datetime, date
        today = date.today()

        for item in results:
            emp = item.get('employee', {})
            code = emp.get('employee_code')
            if not code: continue
            
            # Clear individual cache for this employee so they immediately resolve fresh next time
            evict_employee_cache(code)
            emp_id_api = emp.get('id')
            if emp_id_api:
                safe_cache_delete(f"emp_detail_data_{emp_id_api}")
            
            # Check if employee is blocked/resigned/inactive
            status_clean = str(item.get('employee', {}).get('status') or item.get('status') or '').strip().lower()
            is_blocked = status_clean in ['inactive', 'suspended', 'blocked', 'resigned']
            
            # Check resignation and other dates
            for field in ['resignation_date', 'end_date', 'scheduled_to_date', 'scheduled_to', 'leaving_date', 'last_working_day', 'last_working_date']:
                val_str = emp.get(field) or item.get(field)
                if val_str:
                    try:
                        limit_date = datetime.strptime(str(val_str).split('T')[0], '%Y-%m-%d').date()
                        if limit_date < today:
                            is_blocked = True
                    except:
                        pass
            
            # Try to get existing user
            user = User.objects.filter(employee_id=code).first()
            if user:
                # Update status of existing user based on API
                user.is_active = not is_blocked
                user.save()
            else:
                # Create new user
                user = User.objects.create(
                    employee_id=code,
                    role=role,
                    password_hash=hash_password('user123'),
                    is_active=not is_blocked
                )
                created_count += 1

        # 3. Rebuild global employee cache on the last page of sync
        # Determine total count and if we've reached the end
        total_count = data.get('count', 0)
        import math
        page_size = 20
        total_pages = math.ceil(total_count / page_size) if total_count else 1
        if int(page) >= total_pages:
            # Save accumulated projects to UNIQUE_PROJECTS_LIST cache
            temp_projects = safe_cache_get('TEMP_SYNC_PROJECTS') or {}
            if temp_projects:
                from django.core.cache import cache
                cache.set('UNIQUE_PROJECTS_LIST', list(temp_projects.values()), 30 * 86400)
            safe_cache_delete('TEMP_SYNC_PROJECTS')

            import threading
            from api_management.services import _bg_refresh_global_employee_cache
            # Trigger background refresh of the cache so it's fully populated and fresh
            t = threading.Thread(target=_bg_refresh_global_employee_cache)
            t.daemon = True
            t.start()
                
        return Response({
            'batch_processed': len(results),
            'new_created': created_count
        }, status=status.HTTP_200_OK)


class UserListView(APIView):
    permission_classes = [IsCustomAuthenticated]

    def get(self, request):
        from django.core.paginator import Paginator
        
        search_query = request.query_params.get('search', '').strip()
        page_number = request.query_params.get('page', 1)
        page_size = request.query_params.get('page_size', 20)
        fetch_all = request.query_params.get('all_pages') == 'true'
        
        user = getattr(request, 'custom_user', None)
        role_name = (user.role.name if user and user.role else '').lower()
        is_admin = any(keyword in role_name for keyword in ['admin', 'superuser', 'it admin'])
        is_hr_fin = any(keyword in role_name for keyword in ['hr', 'finance', 'cfo'])
        
        users_queryset = User.objects.all().order_by('-id')
        
        # Hierarchy filtering for Managers
        if not (is_admin or is_hr_fin) and role_name == 'reporting_authority' and user:
            from travel.models import Trip
            from django.db.models import Q
            # Get IDs of users who have trips where this user is the recorded manager
            team_user_ids = Trip.objects.filter(
                Q(reporting_manager_name=user.name) | 
                Q(senior_manager_name=user.name) | 
                Q(hod_director_name=user.name)
            ).values_list('user_id', flat=True).distinct()
            
            # Show team + self
            users_queryset = users_queryset.filter(Q(id__in=team_user_ids) | Q(id=user.id))
            
        if search_query:
            from django.db.models import Q
            # Search locally by employeecode
            users_queryset = users_queryset.filter(employee_id__icontains=search_query)

        if fetch_all:
            # We need names for dropdowns, so we can't do a simple values() call
            results = []
            for u in users_queryset:
                user_data = {
                    'id': u.id,
                    'employee_id': u.employee_id,
                    'username': u.employee_id,
                    'name': u.name # This calls the dynamic property
                }
                if is_admin:
                    from api_management.utils import decrypt_key
                    dec_pass = decrypt_key(u.password_hash)
                    if dec_pass:
                        user_data['password'] = dec_pass
                    elif u.password_hash == "e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446":
                        user_data['password'] = "user123"
                    elif u.password_hash == "240be518fabd2724adb470e7a1428b7e29c0b72f199690b411237a73ab5592b2":
                        user_data['password'] = "admin123"
                    else:
                        user_data['password'] = "Legacy Hash"
                results.append(user_data)
            return Response(results)

        paginator = Paginator(users_queryset, page_size)
        page_obj = paginator.get_page(page_number)
        
        data = []
        for user in page_obj:
            # We still fetch name for single page view, which is acceptable (N limit)
            user_data = {
                'id': user.id,
                'username': user.employee_id,
                'name': user.name,
                'employee_id': user.employee_id,
                'role': user.role.name if user.role else 'Pending'
            }
            if is_admin:
                from api_management.utils import decrypt_key
                dec_pass = decrypt_key(user.password_hash)
                if dec_pass:
                    user_data['password'] = dec_pass
                elif user.password_hash == "e606e38b0d8c19b24cf0ee3808183162ea7cd63ff7912dbb22b5e803286b4446":
                    user_data['password'] = "user123"
                elif user.password_hash == "240be518fabd2724adb470e7a1428b7e29c0b72f199690b411237a73ab5592b2":
                    user_data['password'] = "admin123"
                else:
                    user_data['password'] = "Legacy Hash"
            data.append(user_data)
        
        return Response({
            'count': users_queryset.count(),
            'total_pages': paginator.num_pages,
            'current_page': int(page_number),
            'results': data
        })

from rest_framework import viewsets
from rest_framework.decorators import action
from django.utils import timezone
from .models import AccessKey, APILog, DynamicEndpoint, DynamicSubmission
from .serializers import AccessKeySerializer, AccessKeyListSerializer, APILogSerializer, DynamicEndpointSerializer, DynamicSubmissionSerializer
from .utils import encrypt_key
from rest_framework.views import APIView
from travel.models import Trip
from travel.serializers import TripSerializer

class DynamicEndpointViewSet(viewsets.ModelViewSet):
    queryset = DynamicEndpoint.objects.all()
    serializer_class = DynamicEndpointSerializer

from django.db import connection

class DynamicIngestionView(APIView):
    
    def post(self, request, endpoint_path):
        if 'X-API-KEY' not in request.headers:
             return Response({'error': 'Authentication Required: Missing X-API-KEY header.'}, status=401)

        try:
            endpoint = DynamicEndpoint.objects.get(url_path=endpoint_path, is_active=True)
        except DynamicEndpoint.DoesNotExist:
            return Response({'error': 'Endpoint not found or inactive'}, status=404)
            
        submission = DynamicSubmission.objects.create(
            endpoint=endpoint,
            data=request.data,
            headers=dict(request.headers)
        )
        
        return Response({'status': 'success', 'submission_id': submission.id}, status=201)
    
    def get(self, request, endpoint_path):
        # Authentication Logic
        is_admin_user = request.user.is_authenticated
        has_api_key = 'X-API-KEY' in request.headers
        
        if not is_admin_user and not has_api_key:
             return Response({'error': 'Unauthorized'}, status=401)
             
        try:
            endpoint = DynamicEndpoint.objects.get(url_path=endpoint_path)
        except DynamicEndpoint.DoesNotExist:
            return Response({'error': 'Endpoint not found'}, status=404)

        # Case A: External API Key Request (Data Retrieval Strategy)
        if has_api_key:
            if not endpoint.is_active:
                return Response({'error': 'Endpoint inactive'}, status=404)
            
            # Logic based on Response Type
            if endpoint.response_type == 'TRIP_LIST':
                trips = Trip.objects.filter(is_deleted=False).order_by('-created_at')
                
                # Simple Pagination
                try:
                    page = int(request.query_params.get('page', 1))
                    page_size = 20
                    start = (page - 1) * page_size
                    end = start + page_size
                    data = trips[start:end]
                except:
                    data = trips[:20]

                serializer = TripSerializer(data, many=True)
                return Response({
                    'status': 'success',
                    'count': trips.count(),
                    'results': serializer.data
                })
                
            elif endpoint.response_type == 'TRIP_STATS':
                 total = Trip.objects.filter(is_deleted=False).count()
                 active = Trip.objects.filter(is_deleted=False, status__in=['Submitted', 'Approved']).count()
                 return Response({
                     'status': 'success',
                     'total_trips': total,
                     'active_trips': active
                 })

            elif endpoint.response_type == 'CUSTOM_SCRIPT':
                try:
                    if endpoint.script_type == 'SQL':
                        with connection.cursor() as cursor:
                            cursor.execute(endpoint.script_content)
                            columns = [col[0] for col in cursor.description]
                            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
                        return Response({'status': 'success', 'results': results})

                    elif endpoint.script_type == 'PYTHON':
                        # Prepare safe execution context
                        local_context = {
                            'request': request,
                            'Trip': Trip,
                            'connection': connection,
                            'dataset': {},  # Output variable
                        }
                        
                        # Execute the script
                        exec(endpoint.script_content, {}, local_context)
                        
                        # Return the 'dataset' variable which script must populate
                        return Response({'status': 'success', 'result': local_context.get('dataset', {})})
                    
                    else:
                        return Response({'error': 'Invalid Script Type Configured'}, status=500)

                except Exception as e:
                    return Response({'error': f"Script Execution Failed: {str(e)}"}, status=500)

            else:
                 return Response({'error': 'This endpoint is configured for Ingestion Only (POST). No data retrieval allowed.'}, status=405)

        # Case B: Admin Dashboard Request (View Submissions)
        # Only admins/logged-in users can see the submissions log
        if is_admin_user:
            submissions = endpoint.submissions.all().order_by('-received_at')[:50]
            serializer = DynamicSubmissionSerializer(submissions, many=True)
            return Response(serializer.data)
            
        return Response({'error': 'Unauthorized'}, status=401)

class AccessKeyViewSet(viewsets.ModelViewSet):
    queryset = AccessKey.objects.all()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return AccessKeySerializer
        return AccessKeyListSerializer


    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        self.raw_key = f"sk_live_{uuid.uuid4().hex[:24]}"
        
        encrypted_key = encrypt_key(self.raw_key)
        masked_key = f"{self.raw_key[:8]}...{self.raw_key[-4:]}"
        
        serializer.save(encrypted_key=encrypted_key, masked_key=masked_key)
        
        headers = self.get_success_headers(serializer.data)
        
        response_data = serializer.data
        response_data['key'] = self.raw_key
        
        return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        pass

class DashboardStatsView(APIView):
    permission_classes = [IsCustomAuthenticated]

    def get(self, request):
        now = timezone.now()
        last_24h = now - timezone.timedelta(hours=24)

        total_calls_24h = APILog.objects.filter(timestamp__gte=last_24h).count()

        active_keys = AccessKey.objects.filter(is_active=True).count()
        failed_requests = APILog.objects.filter(status_code__gte=400).count()
        
        avg_latency = APILog.objects.filter(timestamp__gte=last_24h).aggregate(Avg('latency_ms'))['latency_ms__avg'] or 0

        recent_logs = APILog.objects.all()[:10]
        logs_serializer = APILogSerializer(recent_logs, many=True)

        return Response({
            'stats': {
                'externalCalls': total_calls_24h,
                'activeKeys': active_keys,
                'failedRequests': failed_requests,
                'avgLatency': f"{int(avg_latency)}ms"
            },
            'logs': logs_serializer.data
        })

class ApiKeyUpdateView(APIView):
    permission_classes = [IsAdmin]
    
    def get(self, request):
        configs = SystemConfig.objects.all()
        data = {}
        for c in configs:
            if 'key' in c.key:
                data[c.key] = decrypt_key(c.value)
            else:
                data[c.key] = c.value
        return Response(data)

    def post(self, request):
        api_key = request.data.get('api_key')
        key_type = request.data.get('key_type', 'external_api_key')
        api_url = request.data.get('api_url')
        
        if not api_key and not api_url:
            return Response({'error': 'api_key or api_url is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Only update key if it's provided and not masked
        if api_key and api_key != "************":
            old_config = SystemConfig.objects.filter(key=key_type).first()
            is_new_key = True
            
            if old_config:
                if api_key == decrypt_key(old_config.value):
                    is_new_key = False
                else:
                    APIKeyHistory.objects.create(encrypted_value=old_config.value)

            if is_new_key:
                encrypted = encrypt_key(api_key)
                SystemConfig.objects.update_or_create(
                    key=key_type,
                    defaults={'value': encrypted}
                )

        if api_url:
            url_key = 'external_api_url' if key_type == 'external_api_key' else 'geo_api_url'
            SystemConfig.objects.update_or_create(
                key=url_key,
                defaults={'value': api_url}
            )
        
        # Automatically clear cache on config update to prevent stale data
        from django.core.cache import cache
        from .services import CACHE_EMPLOYEE_DATA, HR_ID_TO_INFO_CACHE, GLOBAL_EMPLOYEE_CACHE, safe_cache_delete
        try:
            cache.clear()
            CACHE_EMPLOYEE_DATA.clear()
            HR_ID_TO_INFO_CACHE.clear()
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = 0
            GLOBAL_EMPLOYEE_CACHE['data'] = []
            safe_cache_delete('GLOBAL_EMPLOYEE_DATA')
            safe_cache_delete('GLOBAL_EMPLOYEE_DATA_TIMESTAMP')
            safe_cache_delete('UNIQUE_PROJECTS_LIST')
            safe_cache_delete('EXTERNAL_ROLES_LIST')
            safe_cache_delete('position_to_employee_codes_map')
            safe_cache_delete('user_position_identifiers')
        except Exception as e:
            print(f"Error clearing cache on config update: {e}")
        
        return Response({'message': f'{key_type} configuration updated successfully'})

class GeoHierarchyView(APIView):
    permission_classes = [IsCustomAuthenticated]

    def get(self, request):
        data = fetch_geo_data()
        if "error" in data:
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(data, status=status_code)
        return Response(data)

import threading
from django.core.cache import cache

def _run_employee_sync_task():
    from .services import fetch_employee_data
    try:
        cache.set('EMPLOYEE_SYNC_STATUS', 'running', 3600)
        data = fetch_employee_data(fetch_all_pages=True, force_fresh=True)
        if not data or "error" in data:
            err_msg = data.get("error") if data else "Empty response received"
            cache.set('EMPLOYEE_SYNC_STATUS', f'failed: {err_msg}', 3600)
            return
        
        employees = data.get("results", []) if isinstance(data, dict) else []
        if employees:
            unique_projects = {}
            for item in employees:
                proj = item.get('project', {})
                if proj and isinstance(proj, dict):
                    name = proj.get('name')
                    code = proj.get('code')
                    if name and code:
                        unique_projects[code] = {"name": name, "code": code}
            if unique_projects:
                cache.set('UNIQUE_PROJECTS_LIST', list(unique_projects.values()), 30 * 86400)

            try:
                from core.views import sync_roles_from_employees
                sync_roles_from_employees(employees)
            except Exception as ex:
                print(f"Error executing sync_roles_from_employees: {ex}")
                
        cache.set('EMPLOYEE_SYNC_STATUS', 'success', 3600)
    except Exception as e:
        cache.set('EMPLOYEE_SYNC_STATUS', f'failed: {str(e)}', 3600)

class SyncEmployeeCacheView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        status_val = cache.get('EMPLOYEE_SYNC_STATUS', 'idle')
        return Response({"status": status_val})

    def post(self, request):
        status_val = cache.get('EMPLOYEE_SYNC_STATUS')
        if status_val == 'running':
            return Response({
                "status": "running",
                "message": "Synchronization is already in progress in the background."
            }, status=status.HTTP_200_OK)
            
        t = threading.Thread(target=_run_employee_sync_task, daemon=True)
        t.start()
        
        return Response({
            "status": "pending",
            "message": "Employee cache synchronization started in the background."
        }, status=status.HTTP_202_ACCEPTED)

class ClearCacheView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        from django.core.cache import cache
        from .services import CACHE_EMPLOYEE_DATA, HR_ID_TO_INFO_CACHE, GLOBAL_EMPLOYEE_CACHE, safe_cache_delete
        try:
            # 1. Clear Django cache backend
            cache.clear()
            
            # 2. Clear service level in-memory caches
            CACHE_EMPLOYEE_DATA.clear()
            HR_ID_TO_INFO_CACHE.clear()
            GLOBAL_EMPLOYEE_CACHE['timestamp'] = 0
            GLOBAL_EMPLOYEE_CACHE['data'] = []
            
            # 3. Explicitly delete known keys
            safe_cache_delete('GLOBAL_EMPLOYEE_DATA')
            safe_cache_delete('GLOBAL_EMPLOYEE_DATA_TIMESTAMP')
            safe_cache_delete('UNIQUE_PROJECTS_LIST')
            safe_cache_delete('EXTERNAL_ROLES_LIST')
            safe_cache_delete('position_to_employee_codes_map')
            safe_cache_delete('user_position_identifiers')
            
            return Response({"status": "success", "message": "All cache (persistent and in-memory) has been cleared successfully."})
        except Exception as e:
            return Response({"error": f"Failed to clear cache: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



        