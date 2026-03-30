from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from core.views import hash_password
from core.models import Role, User
from .models import SystemConfig, APIKeyHistory
from .services import fetch_employee_data, fetch_geo_data
from core.permissions import IsCustomAuthenticated, IsAdmin
from .utils import encrypt_key, decrypt_key
import uuid
from django.db.models import Avg

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
        password = request.data.get('password')

        if not employee_code or not password:
            return Response({'error': 'Employee code/id and password are required'}, status=status.HTTP_400_BAD_REQUEST)

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

        defaults = {
            'role': role,
            'password_hash': hash_password(password),
            'is_active': True,
        }

        user, created = User.objects.update_or_create(
            employee_id=employee_code,
            defaults=defaults
        )

        message = "User created successfully" if created else "User linked/updated successfully"
        return Response({'message': message}, status=status.HTTP_201_CREATED)

class SyncAllUsersView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        data = fetch_employee_data(fetch_all_pages=True)
        if "error" in data:
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'error': data['error']}, status=status_code)

        results = data.get('results', [])
        created_count = 0
        
        role_name = 'Employee'
        role, _ = Role.objects.get_or_create(name=role_name)

        for item in results:
            emp = item.get('employee', {})
            code = emp.get('employee_code')
            if not code: continue
            
            user, created = User.objects.get_or_create(
                employee_id=code,
                defaults={
                    'role': role,
                    'password_hash': hash_password('user123'),
                    'is_active': True
                }
            )
            if created:
                created_count += 1
                
        return Response({
            'message': f'Successfully synced and created {created_count} new users.',
            'total_synced': len(results)
        }, status=status.HTTP_200_OK)

class SyncUsersPageView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request):
        page = request.data.get('page', 1)
        data = fetch_employee_data(page=page)
        
        if "error" in data:
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response({'error': data['error']}, status=status_code)

        results = data.get('results', [])
        created_count = 0
        
        role_name = 'Employee'
        role, _ = Role.objects.get_or_create(name=role_name)

        for item in results:
            emp = item.get('employee', {})
            code = emp.get('employee_code')
            if not code: continue
            
            user, created = User.objects.get_or_create(
                employee_id=code,
                defaults={
                    'role': role,
                    'password_hash': hash_password('user123'),
                    'is_active': True
                }
            )
            if created:
                created_count += 1
                
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
                results.append({
                    'id': u.id,
                    'employee_id': u.employee_id,
                    'username': u.employee_id,
                    'name': u.name # This calls the dynamic property
                })
            return Response(results)

        paginator = Paginator(users_queryset, page_size)
        page_obj = paginator.get_page(page_number)
        
        data = []
        for user in page_obj:
            # We still fetch name for single page view, which is acceptable (N limit)
            data.append({
                'id': user.id,
                'username': user.employee_id,
                'name': user.name,
                'employee_id': user.employee_id,
                'role': user.role.name if user.role else 'Pending'
            })
        
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
        
        return Response({'message': f'{key_type} configuration updated successfully'})

class GeoHierarchyView(APIView):
    permission_classes = [IsCustomAuthenticated]

    def get(self, request):
        data = fetch_geo_data()
        if "error" in data:
            status_code = data.get("status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)
            return Response(data, status=status_code)
        return Response(data)

        