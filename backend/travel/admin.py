from django.contrib import admin
from .models import HRPositionConfig, HRWorkflowSetting

@admin.register(HRPositionConfig)
class HRPositionConfigAdmin(admin.ModelAdmin):
    list_display = ('id', 'position_name', 'position_id', 'project_code', 'sequence_order', 'is_active')
    list_filter = ('project_code', 'is_active')
    search_fields = ('position_name', 'position_id')
    ordering = ('project_code', 'sequence_order')

@admin.register(HRWorkflowSetting)
class HRWorkflowSettingAdmin(admin.ModelAdmin):
    list_display = ('id', 'project_code', 'is_parallel')
    list_filter = ('is_parallel',)
    search_fields = ('project_code',)
