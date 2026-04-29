from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TripListCreateView, TravelListCreateView, TripDetailView, ExpenseViewSet, TravelClaimViewSet, 
    TravelAdvanceViewSet, TripOdometerViewSet, DashboardStatsView,
    ApprovalsView, ApprovalCountView, TripBookingSearchView, DisputeViewSet,
    PolicyDocumentViewSet, TripSettlementView, CFOWarRoomView, BulkActivityBatchViewSet, JobReportViewSet,
    TripTrackingView, TeamLiveTrackingView, HistoricalTripStopsView,
    TravelModeMasterViewSet, BookingTypeMasterViewSet, OperatorMasterViewSet, TravelClassMasterViewSet,
    VehicleMasterViewSet, ProviderMasterViewSet, TicketStatusMasterViewSet, QuotaTypeMasterViewSet,
    LocalTravelModeMasterViewSet, LocalProviderMasterViewSet, LocalSubTypeMasterViewSet,
    StayTypeMasterViewSet, RoomTypeMasterViewSet, StayBookingTypeMasterViewSet, StayBookingSourceMasterViewSet,
    MealCategoryMasterViewSet, MealTypeMasterViewSet, MealSourceMasterViewSet, MealProviderMasterViewSet,
    IncidentalTypeMasterViewSet, CustomMasterDefinitionViewSet, CustomMasterValueViewSet, MasterModuleViewSet,
    FinanceExportExcelView, FinanceBulkImportView
)
from .views_export import ExpenseStatementPDFView, ExpenseStatementExcelView

router = DefaultRouter()
router.register(r'expenses', ExpenseViewSet)
router.register(r'claims', TravelClaimViewSet)
router.register(r'advances', TravelAdvanceViewSet)
router.register(r'odometers', TripOdometerViewSet)
router.register(r'disputes', DisputeViewSet)
router.register(r'policies', PolicyDocumentViewSet)
router.register(r'bulk-activities', BulkActivityBatchViewSet)
router.register(r'job-reports', JobReportViewSet)

# Master route registers (Travel)
router.register(r'travel-mode-masters', TravelModeMasterViewSet)
router.register(r'booking-type-masters', BookingTypeMasterViewSet)
router.register(r'operator-masters', OperatorMasterViewSet)
router.register(r'travel-class-masters', TravelClassMasterViewSet)
router.register(r'vehicle-masters', VehicleMasterViewSet)
router.register(r'provider-masters', ProviderMasterViewSet)
router.register(r'ticket-status-masters', TicketStatusMasterViewSet)
router.register(r'quota-type-masters', QuotaTypeMasterViewSet)

# Master route registers (Local)
router.register(r'local-travel-mode-masters', LocalTravelModeMasterViewSet)
router.register(r'local-provider-masters', LocalProviderMasterViewSet)
router.register(r'local-sub-type-masters', LocalSubTypeMasterViewSet)

# Master route registers (Stay)
router.register(r'stay-type-masters', StayTypeMasterViewSet)
router.register(r'room-type-masters', RoomTypeMasterViewSet)
router.register(r'stay-booking-type-masters', StayBookingTypeMasterViewSet)
router.register(r'stay-booking-source-masters', StayBookingSourceMasterViewSet)

# Master route registers (Food)
router.register(r'meal-category-masters', MealCategoryMasterViewSet)
router.register(r'meal-type-masters', MealTypeMasterViewSet)
router.register(r'meal-source-masters', MealSourceMasterViewSet)
router.register(r'meal-provider-masters', MealProviderMasterViewSet)

# Master route registers (Incidental)
router.register(r'incidental-type-masters', IncidentalTypeMasterViewSet)

# Master route registers (Custom/Dynamic)
router.register(r'master-modules', MasterModuleViewSet)
router.register(r'custom-master-definitions', CustomMasterDefinitionViewSet)
router.register(r'custom-master-values', CustomMasterValueViewSet)


urlpatterns = [
    path('trips/', TripListCreateView.as_view(), name='trip-list-create'),
    path('travels/', TravelListCreateView.as_view(), name='travel-list-create'),
    path('travels/<str:trip_id>/', TripDetailView.as_view(), name='travel-detail'),
    path('trips/approvals/', ApprovalsView.as_view(), name='trip-approvals-list'),
    path('trips/search/', TripBookingSearchView.as_view(), name='trip-search'),
    path('trips/<str:trip_id>/', TripDetailView.as_view(), name='trip-detail'),
    path('trips/<str:trip_id>/tracking/', TripTrackingView.as_view(), name='trip-tracking'),
    path('team/live-tracking/', TeamLiveTrackingView.as_view(), name='team-live-tracking'),
    path('trips/<str:trip_id>/export/pdf/',   ExpenseStatementPDFView.as_view(),   name='trip-export-pdf'),
    path('trips/<str:trip_id>/export/excel/', ExpenseStatementExcelView.as_view(), name='trip-export-excel'),
    path('dashboard-stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('historical_stops/', HistoricalTripStopsView.as_view(), name='historical-stops'),
    path('approvals/', ApprovalsView.as_view(), name='approvals'),
    path('approvals/count/', ApprovalCountView.as_view(), name='approvals-count'),
    path('settlement/', TripSettlementView.as_view(), name='trip-settlement'),
    path('war-room/', CFOWarRoomView.as_view(), name='war-room'),
    path('finance/export/', FinanceExportExcelView.as_view(), name='finance-export-excel'),
    path('finance/import/', FinanceBulkImportView.as_view(), name='finance-bulk-import'),
    path('', include(router.urls)),
]
