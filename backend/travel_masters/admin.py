from django.contrib import admin
from .models import Location, Route, RoutePath, TollGate, Cadre, EligibilityRule

@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'external_id', 'name', 'location_type', 'code', 'parent_id', 'cluster_category')
    search_fields = ('name', 'code', 'external_id')
    list_filter = ('location_type', 'cluster_category')

@admin.register(Route)
class RouteAdmin(admin.ModelAdmin):
    list_display = ('id', 'route_code', 'name', 'source', 'destination')
    search_fields = ('route_code', 'name')

@admin.register(RoutePath)
class RoutePathAdmin(admin.ModelAdmin):
    list_display = ('id', 'route', 'path_name', 'distance_km', 'is_default')
    list_filter = ('is_default',)
    search_fields = ('path_name', 'route__name')

@admin.register(TollGate)
class TollGateAdmin(admin.ModelAdmin):
    list_display = ('id', 'gate_code', 'registered_id', 'name', 'location', 'gps_coordinates')
    search_fields = ('gate_code', 'name', 'registered_id')

@admin.register(Cadre)
class CadreAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'designation_keywords')
    search_fields = ('name',)
@admin.register(EligibilityRule)
class EligibilityRuleAdmin(admin.ModelAdmin):
    list_display = ('id', 'cadre', 'is_active', 'max_mileage_km', 'max_mileage_bike_km', 'max_mileage_car_km', 'daily_allowance_amount', 'monthly_tour_daily_allowance_amount', 'air_allowed', 'train_allowed')
    list_filter = ('is_active', 'air_allowed', 'train_allowed')
    search_fields = ('cadre__name',)
