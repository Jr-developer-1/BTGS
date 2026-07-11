from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import models, transaction
from .models import FinanceWorkflowStep, HRPositionConfig, HRWorkflowSetting, FinanceWorkflowSetting
from .serializers import FinanceWorkflowStepSerializer, HRPositionConfigSerializer
from core.models import User
from core.permissions import IsCustomAuthenticated

class FinanceWorkflowConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCustomAuthenticated]
    serializer_class = FinanceWorkflowStepSerializer
    pagination_class = None

    def get_queryset(self):
        project_code = self.request.query_params.get('project_code')
        qs = FinanceWorkflowStep.objects.all().order_by('sequence_order')
        if project_code:
            qs = qs.filter(project_code=project_code)
        return qs

    def perform_create(self, serializer):
        project_code = serializer.validated_data.get('project_code', 'General')
        if 'sequence_order' not in serializer.validated_data:
            max_order = FinanceWorkflowStep.objects.filter(project_code=project_code).aggregate(m=models.Max('sequence_order'))['m'] or 0
            serializer.save(sequence_order=max_order + 1)
        else:
            serializer.save()

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_steps(self, request):
        """
        Reorder steps based on a list of IDs.
        Expected data: {'ids': [id1, id2, id3]}
        """
        new_order_ids = request.data.get('ids', [])
        if not new_order_ids:
            return Response({"error": "List of IDs required"}, status=status.HTTP_400_BAD_REQUEST)

        project_code = 'General'
        first_step = FinanceWorkflowStep.objects.filter(id=new_order_ids[0]).first()
        if first_step:
            project_code = first_step.project_code

        with transaction.atomic():
            FinanceWorkflowStep.objects.filter(project_code=project_code).update(sequence_order=models.F('sequence_order') + 10000)
            
            for index, step_id in enumerate(new_order_ids):
                FinanceWorkflowStep.objects.filter(id=step_id).update(sequence_order=index + 1)
        
        return Response({"message": "Order updated successfully"})

    @action(detail=False, methods=['get'], url_path='get_workflow_setting')
    def get_workflow_setting(self, request):
        project_code = request.query_params.get('project_code', 'General')
        setting, _ = FinanceWorkflowSetting.objects.get_or_create(project_code=project_code)
        return Response({
            "project_code": project_code, 
            "is_parallel": setting.is_parallel,
            "enable_two_level_flow": setting.enable_two_level_flow
        })

    @action(detail=False, methods=['post'], url_path='set_workflow_setting')
    def set_workflow_setting(self, request):
        project_code = request.data.get('project_code', 'General')
        is_parallel = request.data.get('is_parallel', False)
        enable_two_level_flow = request.data.get('enable_two_level_flow', False)
        if not isinstance(is_parallel, bool):
            is_parallel = str(is_parallel).lower() == 'true'
        if not isinstance(enable_two_level_flow, bool):
            enable_two_level_flow = str(enable_two_level_flow).lower() == 'true'
        setting, _ = FinanceWorkflowSetting.objects.get_or_create(project_code=project_code)
        setting.is_parallel = is_parallel
        setting.enable_two_level_flow = enable_two_level_flow
        setting.save()
        return Response({
            "project_code": project_code, 
            "is_parallel": setting.is_parallel,
            "enable_two_level_flow": setting.enable_two_level_flow
        })

    @action(detail=False, methods=['get'], url_path='search-positions')
    def search_positions(self, request):
        """
        Dynamic search to fetch all available positions across all employees (using the API cache)
        """
        query = request.query_params.get('q', '').lower()
        from api_management.services import fetch_employee_data
        
        # Use local global cache first (fetch_all_pages=True) as it's much faster and avoids external API timeouts.
        response_data = fetch_employee_data(fetch_all_pages=True)
        
        # If cache returned an error or is empty, fallback to searching via external API as a last resort
        if not response_data or response_data.get('error'):
            if query:
                response_data = fetch_employee_data(search=query, page_size=100)

        results = []
        seen_positions = set()
        
        if response_data and not response_data.get('error'):
            all_emps = response_data.get('results', [])
            for item in all_emps:
                emp_proj_code = 'General'
                if item.get('project') and item['project'].get('code') and item['project']['code'] != 'N/A':
                    emp_proj_code = item['project']['code']

                pos_list = []
                if item.get('position'):
                    pos_list.append(item['position'])
                pos_details = item.get('positions_details') or []
                pos_list.extend(pos_details)
                
                for pos in pos_list:
                    p_raw_id = str(pos.get('id') or pos.get('position_id') or '')
                    p_code = str(pos.get('code') or pos.get('position_code') or '').strip()
                    
                    # Prefer Position Code from API as the primary matching identifier
                    p_id = p_code if p_code else p_raw_id
                    p_name = (pos.get('name') or pos.get('position_name') or '').strip()
                    p_dept = (pos.get('department_name') or pos.get('department') or '').strip()
                    
                    # Combine name & code for a richer descriptive visualization in dropdowns
                    display_name = f"{p_name} ({p_code})" if p_code and p_name else (p_name or p_code)
                    
                    if p_id and p_name and p_id not in seen_positions:
                        if not query or query in p_name.lower() or query in p_id.lower() or query in p_dept.lower() or query in p_code.lower():
                            seen_positions.add(p_id)
                            results.append({
                                "id": p_id,              # Natively consumed by frontend
                                "name": display_name,    # Natively consumed by frontend
                                "position_id": p_id,
                                "position_name": display_name,
                                "position_code": p_code,
                                "department": p_dept,
                                "project_code": emp_proj_code
                            })
                            
        return Response(results[:30])


    @action(detail=False, methods=['get'], url_path='search-users')
    def search_users(self, request):
        """
        Legacy: Search users to add to the finance workflow.
        """
        query = request.query_params.get('q', '')
        if not query:
            return Response([])
        
        from api_management.services import fetch_employee_data
        
        # Search via external API first to get real names/details
        api_results = fetch_employee_data(search=query, page_size=10)
        
        results = []
        if api_results and not api_results.get('error'):
            for item in api_results.get('results', []):
                emp_data = item.get('employee', {})
                pos_data = item.get('position', {})
                emp_code = emp_data.get('employee_code')
                
                if emp_code:
                    # Get or create shell user to ensure we have a valid ID for the workflow
                    user = User._get_or_create_shell_user(emp_code)
                    if user:
                        results.append({
                            "id": user.id,
                            "name": emp_data.get('name') or user.name,
                            "employee_id": emp_code,
                            "department": pos_data.get('department') or user.department,
                            "designation": pos_data.get('name') or user.designation
                        })

        # Fallback: search local DB by employee_id if API gave no results
        if not results:
            users = User.objects.filter(employee_id__icontains=query, is_active=True)[:10]
            results = [
                {
                    "id": u.id,
                    "name": u.name,
                    "employee_id": u.employee_id,
                    "department": u.department,
                    "designation": u.designation
                } for u in users
            ]
            
        return Response(results)


class HRPositionConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCustomAuthenticated]
    serializer_class = HRPositionConfigSerializer
    pagination_class = None

    def get_queryset(self):
        project_code = self.request.query_params.get('project_code')
        qs = HRPositionConfig.objects.all().order_by('sequence_order')
        if project_code:
            qs = qs.filter(project_code=project_code)
        return qs

    def clear_caches(self):
        from api_management.services import safe_cache_delete
        safe_cache_delete('position_to_employee_codes_map')
        safe_cache_delete('user_position_identifiers')

    def perform_create(self, serializer):
        project_code = serializer.validated_data.get('project_code', 'General')
        if 'sequence_order' not in serializer.validated_data:
            max_order = HRPositionConfig.objects.filter(project_code=project_code).aggregate(m=models.Max('sequence_order'))['m'] or 0
            serializer.save(sequence_order=max_order + 1)
        else:
            serializer.save()
        self.clear_caches()

    def perform_update(self, serializer):
        serializer.save()
        self.clear_caches()

    def perform_destroy(self, instance):
        instance.delete()
        self.clear_caches()

    @action(detail=False, methods=['post'], url_path='reorder_steps')
    def reorder_steps(self, request):
        new_order_ids = request.data.get('ids', [])
        if not new_order_ids:
            return Response({"error": "List of IDs required"}, status=status.HTTP_400_BAD_REQUEST)

        # Dynamically resolve project_code from the first step ID
        project_code = 'General'
        first_step = HRPositionConfig.objects.filter(id=new_order_ids[0]).first()
        if first_step:
            project_code = first_step.project_code

        with transaction.atomic():
            HRPositionConfig.objects.filter(project_code=project_code).update(sequence_order=models.F('sequence_order') + 10000)
            for index, step_id in enumerate(new_order_ids):
                HRPositionConfig.objects.filter(id=step_id).update(sequence_order=index + 1)
        
        self.clear_caches()
        return Response({"message": "Order updated successfully"})

    @action(detail=False, methods=['get'], url_path='get_workflow_setting')
    def get_workflow_setting(self, request):
        project_code = request.query_params.get('project_code', 'General')
        setting, _ = HRWorkflowSetting.objects.get_or_create(project_code=project_code)
        return Response({
            "project_code": project_code, 
            "is_parallel": setting.is_parallel,
            "enable_two_level_flow": setting.enable_two_level_flow
        })

    @action(detail=False, methods=['post'], url_path='set_workflow_setting')
    def set_workflow_setting(self, request):
        project_code = request.data.get('project_code', 'General')
        is_parallel = request.data.get('is_parallel', False)
        enable_two_level_flow = request.data.get('enable_two_level_flow', False)
        if not isinstance(is_parallel, bool):
            is_parallel = str(is_parallel).lower() == 'true'
        if not isinstance(enable_two_level_flow, bool):
            enable_two_level_flow = str(enable_two_level_flow).lower() == 'true'
        setting, _ = HRWorkflowSetting.objects.get_or_create(project_code=project_code)
        setting.is_parallel = is_parallel
        setting.enable_two_level_flow = enable_two_level_flow
        setting.save()
        self.clear_caches()
        return Response({
            "project_code": project_code, 
            "is_parallel": setting.is_parallel,
            "enable_two_level_flow": setting.enable_two_level_flow
        })


class COOProjectSettingViewSet(viewsets.ViewSet):
    permission_classes = [IsCustomAuthenticated]

    def list(self, request):
        """
        GET /api/coo-project-setting/
        Exposes all detected COO positions and their corresponding projects from cached employee data.
        Merges stored COOProjectSetting toggle configurations.
        """
        from .utils import _is_coo_position
        force_refresh = request.query_params.get('force_refresh', '').lower() == 'true'
        if force_refresh:
            from api_management.services import fetch_employee_data
            # Force fetch all pages from external API to refresh the cache
            fetch_employee_data(fetch_all_pages=True, force_fresh=True)
            
        from api_management.services import safe_cache_get
        from .models import COOProjectSetting
        global_data = safe_cache_get('GLOBAL_EMPLOYEE_DATA') or []
        
        # Keep track of detected combinations
        detected = []
        seen = set()
        
        # Step 1: scan global roster
        for item in global_data:
            proj = item.get('project', {}) or {}
            proj_code = proj.get('code') or 'General'
            if not proj_code or proj_code == 'N/A':
                proj_code = 'General'
                
            emp = item.get('employee', {}) or {}
            pos = item.get('position', {}) or {}
            pos_details = item.get('positions_details', []) or []
            
            # Scan positions held by employee
            for p in [pos] + pos_details:
                if not p:
                    continue
                p_id = str(p.get('id') or p.get('code') or '')
                p_name = p.get('name') or p.get('position_name')
                p_desig = emp.get('designation') or p.get('designation')
                
                if p_id and p_name and _is_coo_position(p_name, p_desig, employee_id=emp.get('employee_code')):
                    key = (proj_code, p_id)
                    if key not in seen:
                        seen.add(key)
                        detected.append({
                            'project_code': proj_code,
                            'coo_position_id': p_id,
                            'coo_position_name': p_name
                        })
                        
            # Scan reporting managers of employee
            for p in [pos] + pos_details:
                if not p:
                    continue
                for mgr in p.get('reporting_to', []):
                    if not isinstance(mgr, dict):
                        continue
                    mgr_pos_id = str(mgr.get('id') or mgr.get('code') or mgr.get('position_id') or '')
                    mgr_pos_name = mgr.get('name') or mgr.get('position_name')
                    mgr_emp_code = mgr.get('employee_code') or mgr.get('employee_id')
                    
                    if mgr_pos_id and mgr_pos_name and _is_coo_position(mgr_pos_name, None, employee_id=mgr_emp_code):
                        key = (proj_code, mgr_pos_id)
                        if key not in seen:
                            seen.add(key)
                            detected.append({
                                	'project_code': proj_code,
                                	'coo_position_id': mgr_pos_id,
                                	'coo_position_name': mgr_pos_name
                            })
                            
        # Step 2: Query database for existing settings and merge
        db_settings = {
            (s.project_code, s.coo_position_id): s.enable_coo_approval
            for s in COOProjectSetting.objects.all()
        }
        
        # Merge
        results = []
        for d in detected:
            key = (d['project_code'], d['coo_position_id'])
            # Fetch toggle from DB, default to False
            enabled = db_settings.get(key, False)
            
            # Ensure it is created/represented in our return value
            results.append({
                'project_code': d['project_code'],
                'coo_position_id': d['coo_position_id'],
                'coo_position_name': d['coo_position_name'],
                'enable_coo_approval': enabled
            })
            
        # Also include any settings stored in DB that might not have active users in the current cache scan
        for key, enabled in db_settings.items():
            if key not in seen:
                # Find matching config details if we can or just display
                db_item = COOProjectSetting.objects.filter(project_code=key[0], coo_position_id=key[1]).first()
                if db_item:
                    results.append({
                        'project_code': db_item.project_code,
                        'coo_position_id': db_item.coo_position_id,
                        'coo_position_name': db_item.coo_position_name,
                        'enable_coo_approval': db_item.enable_coo_approval
                    })
                    
        return Response(results)

    def create(self, request):
        """
        POST /api/coo-project-setting/
        Updates or creates a toggle configuration.
        """
        from .models import COOProjectSetting
        project_code = request.data.get('project_code')
        coo_position_id = request.data.get('coo_position_id')
        coo_position_name = request.data.get('coo_position_name')
        enable_coo_approval = request.data.get('enable_coo_approval', False)
        
        if not project_code or not coo_position_id:
            return Response({"error": "project_code and coo_position_id are required"}, status=400)
            
        if not isinstance(enable_coo_approval, bool):
            enable_coo_approval = str(enable_coo_approval).lower() == 'true'
            
        setting, created = COOProjectSetting.objects.get_or_create(
            project_code=project_code,
            coo_position_id=coo_position_id,
            defaults={'coo_position_name': coo_position_name or 'COO', 'enable_coo_approval': enable_coo_approval}
        )
        if not created:
            setting.enable_coo_approval = enable_coo_approval
            if coo_position_name:
                setting.coo_position_name = coo_position_name
            setting.save()
            
        # Saved successfully without needing to wipe other unrelated caches like GLOBAL_EMPLOYEE_DATA
        
        return Response({
            "project_code": setting.project_code,
            "coo_position_id": setting.coo_position_id,
            "coo_position_name": setting.coo_position_name,
            "enable_coo_approval": setting.enable_coo_approval
        })


