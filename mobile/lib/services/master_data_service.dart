import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';
import 'api_service.dart';
import 'logger_service.dart';

/// Service to fetch and cache master data (dropdown values) from backend
/// Reduces API calls by caching data locally
class MasterDataService {
  static final MasterDataService _instance = MasterDataService._internal();

  Map<String, dynamic>? _cachedMasters;
  bool _isLoading = false;

  factory MasterDataService() {
    return _instance;
  }

  MasterDataService._internal();

  /// Fetch master data from backend or return cached data
  Future<Map<String, dynamic>> fetchMasters({bool forceRefresh = false}) async {
    if (_cachedMasters != null && !forceRefresh) {
      return _cachedMasters!;
    }

    if (_isLoading) {
      // Wait for ongoing request to complete
      int attempts = 0;
      while (_isLoading && attempts < 30) {
        await Future.delayed(const Duration(milliseconds: 100));
        attempts++;
      }
      return _cachedMasters ?? {};
    }

    final masters = <String, dynamic>{};
    _isLoading = true;
    try {
      // Try to load from cache first
      if (!forceRefresh) {
        final cached = await _loadCachedMasters();
        if (cached.isNotEmpty) {
          _cachedMasters = cached;
          _isLoading = false;
          return cached;
        }
      }
      final apiService = ApiService();

      // Fetch all master data in parallel with independent error handling
      final endpoints = [
        {'key': 'travelModes', 'url': '/api/travel-mode-masters/'},
        {'key': 'bookingTypes', 'url': '/api/booking-type-masters/'},
        {'key': 'travelClasses', 'url': '/api/travel-class-masters/'},
        {'key': 'vehicles', 'url': '/api/vehicle-masters/'},
        {'key': 'providers', 'url': '/api/provider-masters/'},
        {'key': 'localTravelModes', 'url': '/api/local-travel-mode-masters/'},
        {'key': 'localProviders', 'url': '/api/local-provider-masters/'},
        {'key': 'localSubTypes', 'url': '/api/local-sub-type-masters/'},
        {'key': 'stayTypes', 'url': '/api/stay-type-masters/'},
        {'key': 'roomTypes', 'url': '/api/room-type-masters/'},
        {'key': 'mealCategories', 'url': '/api/meal-category-masters/'},
        {'key': 'mealTypes', 'url': '/api/meal-type-masters/'},
        {'key': 'incidentalTypes', 'url': '/api/incidental-type-masters/'},
      ];

      final results = await Future.wait(endpoints.map((e) async {
        try {
          final res = await apiService.get(e['url']!);
          return MapEntry(e['key']!, _extractNames(res));
        } catch (err) {
          LoggerService.log('MASTERS: Error fetching ${e['key']}: $err', isError: true);
          return MapEntry(e['key']!, <String>[]);
        }
      }));

      for (var entry in results) {
        masters[entry.key] = entry.value;
      }

        _cachedMasters = masters;
        await _saveCachedMasters(masters);

        LoggerService.log('MASTERS: Successfully fetched and cached all master data');
      } catch (e) {
        LoggerService.log('MASTERS: Failed to fetch master data: $e', isError: true);
        return _getDefaultMasters();
      } finally {
        _isLoading = false;
      }

      return masters;
  }

  /// Extract name/label from API response
  List<String> _extractNames(dynamic response) {
    try {
      List<dynamic> rawList = [];
      if (response is List) {
        rawList = response;
      } else if (response is Map) {
        rawList = response['results'] ?? response['data'] ?? response['items'] ?? [];
      }

      if (rawList.isNotEmpty) {
        return rawList
            .map((item) {
              if (item is! Map) return item.toString();
              return item['mode_name'] ??
                  item['provider_name'] ??
                  item['operator_name'] ??
                  item['vehicle_name'] ??
                  item['class_name'] ??
                  item['booking_type'] ??
                  item['stay_type'] ??
                  item['room_type'] ??
                  item['category_name'] ??
                  item['meal_type'] ??
                  item['sub_type'] ??
                  item['expense_type'] ??
                  item.toString();
            })
            .whereType<String>()
            .toList();
      }
      return [];
    } catch (e) {
      LoggerService.log('MASTERS: Error extracting names: $e', isError: true);
      return [];
    }
  }

  /// Save masters to SharedPreferences for offline access
  Future<void> _saveCachedMasters(Map<String, dynamic> masters) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_masters', jsonEncode(masters));
      LoggerService.log('MASTERS: Cached to local storage');
    } catch (e) {
      LoggerService.log('MASTERS: Failed to cache masters: $e', isError: true);
    }
  }

  /// Load masters from SharedPreferences cache
  Future<Map<String, dynamic>> _loadCachedMasters() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString('cached_masters');
      if (cached != null) {
        return jsonDecode(cached) as Map<String, dynamic>;
      }
    } catch (e) {
      LoggerService.log('MASTERS: Failed to load cached masters: $e', isError: true);
    }
    return {};
  }

  /// Return default masters (for offline fallback)
  Map<String, dynamic> _getDefaultMasters() {
    return {
      'travelModes': [],
      'bookingTypes': [],
      'travelClasses': [],
      'vehicles': [],
      'providers': [],
      'localTravelModes': [],
      'localProviders': [],
      'localSubTypes': {},
      'stayTypes': [],
      'roomTypes': [],
      'mealCategories': [],
      'mealTypes': [],
      'incidentalTypes': [],
    };
  }

  /// Clear cache (e.g., on logout)
  Future<void> clearCache() async {
    _cachedMasters = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('cached_masters');
      LoggerService.log('MASTERS: Cache cleared');
    } catch (e) {
      LoggerService.log('MASTERS: Failed to clear cache: $e', isError: true);
    }
  }

  /// Get a specific master list
  Future<List<String>> getMasterList(String key) async {
    final masters = await fetchMasters();
    final data = masters[key];
    
    if (data is List) {
      return data.cast<String>();
    } else if (data is Map) {
      return data.keys.cast<String>().toList();
    }
    return [];
  }
}
