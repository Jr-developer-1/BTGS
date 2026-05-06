from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import models, transaction
from .models import FinanceWorkflowStep
from .serializers import FinanceWorkflowStepSerializer
from core.models import User
from core.permissions import IsCustomAuthenticated

class FinanceWorkflowConfigViewSet(viewsets.ModelViewSet):
    permission_classes = [IsCustomAuthenticated]
    queryset = FinanceWorkflowStep.objects.all().order_by('sequence_order')
    serializer_class = FinanceWorkflowStepSerializer
    pagination_class = None

    def get_queryset(self):
        return FinanceWorkflowStep.objects.all().order_by('sequence_order')

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder_steps(self, request):
        """
        Reorder steps based on a list of IDs.
        Expected data: {'ids': [id1, id2, id3]}
        """
        new_order_ids = request.data.get('ids', [])
        if not new_order_ids:
            return Response({"error": "List of IDs required"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Temporarily offset all sequence orders to avoid unique constraint collisions during swap
            FinanceWorkflowStep.objects.all().update(sequence_order=models.F('sequence_order') + 10000)
            
            # Apply new orders
            for index, step_id in enumerate(new_order_ids):
                FinanceWorkflowStep.objects.filter(id=step_id).update(sequence_order=index + 1)
        
        return Response({"message": "Order updated successfully"})

    @action(detail=False, methods=['get'], url_path='search-users')
    def search_users(self, request):
        """
        Search users to add to the finance workflow.
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

    def perform_create(self, serializer):
        # Auto-assign next sequence order if not provided
        if 'sequence_order' not in serializer.validated_data:
            max_order = FinanceWorkflowStep.objects.aggregate(m=models.Max('sequence_order'))['m'] or 0
            serializer.save(sequence_order=max_order + 1)
        else:
            serializer.save()


