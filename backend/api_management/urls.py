from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    EmployeeListView, EmployeeDropdownView, SignupView, SyncAllUsersView, 
    UserListView, AccessKeyViewSet, DashboardStatsView, ApiKeyUpdateView, 
    DynamicEndpointViewSet, DynamicIngestionView, GeoHierarchyView, 
    SyncUsersPageView, SyncEmployeeCacheView, ClearCacheView
)

router = DefaultRouter()
router.register(r'access-keys', AccessKeyViewSet)
router.register(r'dynamic-endpoints', DynamicEndpointViewSet)

urlpatterns = [
    path('employees/', EmployeeListView.as_view(), name='employee-list'),
    path('employees/dropdown/', EmployeeDropdownView.as_view(), name='employee-dropdown'),
    path('employees/sync-cache/', SyncEmployeeCacheView.as_view(), name='sync-employee-cache'),
    path('signup/', SignupView.as_view(), name='signup'),
    path('sync-users/', SyncAllUsersView.as_view(), name='sync-users'),
    path('sync-users-page/', SyncUsersPageView.as_view(), name='sync-users-page'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('apikey/', ApiKeyUpdateView.as_view(), name='update-api-key'),
    path('clear-cache/', ClearCacheView.as_view(), name='clear-cache'),
    path('connect/<str:endpoint_path>/', DynamicIngestionView.as_view(), name='dynamic-ingest'),
    path('geo/hierarchy/', GeoHierarchyView.as_view(), name='geo-hierarchy'),
    path('', include(router.urls)),
]

