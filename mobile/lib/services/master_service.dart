import '../constants/api_constants.dart';
import 'api_service.dart';

class MasterService {
  final ApiService _apiService = ApiService();

  static final MasterService _instance = MasterService._internal();
  factory MasterService() => _instance;
  MasterService._internal();

  // Cache to avoid redundant API calls
  Map<String, List<String>> _masterCache = {};
  Map<String, dynamic> _rawMasterCache = {};

  Future<List<String>> fetchMasterList(
    String endpoint,
    String listKey,
    String displayKey,
  ) async {
    if (_masterCache.containsKey(endpoint)) return _masterCache[endpoint]!;

    try {
      final response = await _apiService.get(endpoint);
      // Log for user diagnosis
      print(
        'MASTER_FETCH: $endpoint -> Response Type: ${response.runtimeType}',
      );

      List<dynamic> rawList = [];

      if (response is List) {
        rawList = response;
      } else if (response is Map) {
        // Try various common keys used in DRF/Axios
        rawList =
            response[listKey] ??
            response['results'] ??
            response['data'] ??
            response['items'] ??
            [];
      }

      final list = rawList
          .where((item) {
            if (item is! Map) return false;
            // Filter by status if present (mirrors web app behavior)
            final bool status = item['status'] ?? true;
            final bool isDeleted = item['is_deleted'] ?? false;
            return status && !isDeleted;
          })
          .map((item) => _toTitleCase(item[displayKey]?.toString() ?? ''))
          .where((s) => s.isNotEmpty)
          .toSet() // Remove duplicates
          .toList();

      if (list.isNotEmpty) {
        _masterCache[endpoint] = list;
        print('MASTER_SUCCESS: $endpoint -> Found ${list.length} items (Key: $displayKey)');
        return list;
      } else {
        print('MASTER_EMPTY: $endpoint -> No items found with key $displayKey');
      }
    } catch (e) {
      print('MASTER_ERROR: $endpoint -> $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> fetchRawMaster(String endpoint) async {
    if (_rawMasterCache.containsKey(endpoint)) return _rawMasterCache[endpoint];
    try {
      final response = await _apiService.get(endpoint);
      _rawMasterCache[endpoint] = response;
      return response;
    } catch (e) {
      print('Error fetching raw master from $endpoint: $e');
    }
    return {};
  }

  String _toTitleCase(String text) {
    if (text.isEmpty) return text;
    return text
        .split(' ')
        .map((word) {
          if (word.isEmpty) return word;
          return word[0].toUpperCase() + word.substring(1).toLowerCase();
        })
        .join(' ');
  }

  // Specific Helpers
  Future<List<String>> getTravelModes() =>
      fetchMasterList(ApiConstants.masterTravelModes, 'results', 'mode_name');
  Future<List<String>> getBookingTypes() => fetchMasterList(
    ApiConstants.masterBookingTypes,
    'results',
    'booking_type',
  );
  Future<List<String>> getLocalTravelModes() => fetchMasterList(
    ApiConstants.masterLocalTravelModes,
    'results',
    'mode_name',
  );

  Future<List<Map<String, dynamic>>> getLocalSubTypesRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterLocalSubTypes);
      List rawList = [];
      if (response is List) {
        rawList = response;
      } else if (response is Map) {
        rawList = response['results'] ?? response['data'] ?? [];
      }
      return rawList
          .where((item) =>
              item is Map &&
              (item['status'] == true || item['status'] == null) &&
              !(item['is_deleted'] == true))
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      print('Error fetching raw local sub-types: $e');
      return [];
    }
  }

  Future<List<String>> getTravelClasses(String mode) async {
    final response = await _apiService.get(ApiConstants.masterTravelClasses);
    if (response is List) {
      return response
          .where((item) => item['status'] == true && _matchesMode(item, mode))
          .map((item) => _toTitleCase(item['class_name'] ?? ''))
          .toList();
    }
    return [];
  }

  bool _matchesMode(dynamic item, String m) {
    final mode = m.toLowerCase();
    if (mode.contains('flight')) return item['is_flight'] == true;
    if (mode.contains('train')) return item['is_train'] == true;
    if (mode.contains('bus')) return item['is_bus'] == true;
    return false;
  }

  Future<List<Map<String, dynamic>>> searchLocations(String search) async {
    try {
      final response = await _apiService.get(
        '/api/masters/locations/live_query/?search=${Uri.encodeComponent(search)}',
      );
      if (response is List) return List<Map<String, dynamic>>.from(response);
      if (response is Map && response['results'] != null)
        return List<Map<String, dynamic>>.from(response['results']);
      if (response is Map && response['data'] != null)
        return List<Map<String, dynamic>>.from(response['data']);
    } catch (e) {
      print('Error searching locations: $e');
    }
    return [];
  }

  String formatLocation(Map<String, dynamic> loc) {
    final name = _toTitleCase(loc['name']?.toString() ?? '');
    final code = loc['code']?.toString() ?? '';
    return code.isNotEmpty ? '$name - $code' : name;
  }

  Future<List<Map<String, dynamic>>> getGeoHierarchy() async {
    try {
      final response = await _apiService.get(ApiConstants.geoHierarchy);
      if (response is Map &&
          (response['results'] != null || response['data'] != null)) {
        final data = response['results'] ?? response['data'];
        return List<Map<String, dynamic>>.from(data is List ? data : []);
      }
      if (response is List) return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      print('Error fetching geo hierarchy: $e');
    }
    return [];
  }

  Future<List<String>> getIncidentalTypes() => fetchMasterList(
    ApiConstants.masterIncidentalTypes,
    'results',
    'expense_type',
  );

  /// Returns the raw list of incidental type objects (with 'category' and 'expense_type' fields)
  /// so callers can split them by category (general_incidental / travel_incidental / local_conveyance)
  Future<List<Map<String, dynamic>>> getIncidentalTypesRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterIncidentalTypes);
      List rawList = [];
      if (response is List) {
        rawList = response;
      } else if (response is Map) {
        rawList = response['results'] ?? response['data'] ?? [];
      }
      return rawList
          .where((item) =>
              item is Map &&
              (item['status'] == true || item['status'] == null) &&
              !(item['is_deleted'] == true))
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      print('Error fetching raw incidental types: $e');
      return [];
    }
  }

  Future<List<String>> getVehicles() =>
      fetchMasterList(ApiConstants.masterVehicles, 'results', 'vehicle_model');

  Future<List<String>> getOperators() =>
      fetchMasterList(ApiConstants.masterOperators, 'results', 'operator_name');

  Future<List<Map<String, dynamic>>> getOperatorsRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterOperators);
      List rawList = [];
      if (response is List) rawList = response;
      else if (response is Map) rawList = response['results'] ?? response['data'] ?? [];
      return rawList.where((item) => item is Map && (item['status'] == true || item['status'] == null) && !(item['is_deleted'] == true))
          .map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) { return []; }
  }

  Future<List<String>> getProviders() =>
      fetchMasterList(ApiConstants.masterProviders, 'results', 'provider_name');

  Future<List<Map<String, dynamic>>> getProvidersRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterProviders);
      List rawList = [];
      if (response is List) rawList = response;
      else if (response is Map) rawList = response['results'] ?? response['data'] ?? [];
      return rawList.where((item) => item is Map && (item['status'] == true || item['status'] == null) && !(item['is_deleted'] == true))
          .map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) { return []; }
  }

  Future<List<Map<String, dynamic>>> getLocalProvidersRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterLocalProviders);
      List rawList = [];
      if (response is List) rawList = response;
      else if (response is Map) rawList = response['results'] ?? response['data'] ?? [];
      return rawList.where((item) => item is Map && (item['status'] == true || item['status'] == null) && !(item['is_deleted'] == true))
          .map((item) => Map<String, dynamic>.from(item)).toList();
    } catch (e) { return []; }
  }

  Future<List<String>> getLocationsPool() async {
    final hierarchy = await getGeoHierarchy();
    final List<String> result = [];
    final seen = <String>{};

    const cityTypes = ['city', 'metropolitan city', 'metro city', 'metro_city', 'metropolyten city'];
    bool isCityType(String? t) => cityTypes.contains((t ?? '').toLowerCase().trim());

    void walk(dynamic node) {
      if (node == null || node is! Map) return;

      // 1. Process explicit city buckets (Matches web logic)
      final cityKeys = ['cities', 'metro_polyten_cities'];
      for (var key in cityKeys) {
        final arr = node[key];
        if (arr is List) {
          for (var c in arr) {
            if (c is Map && c.containsKey('name')) {
              final finalName = formatLocation(Map<String, dynamic>.from(c));
              if (finalName.isNotEmpty && !seen.contains(finalName)) {
                seen.add(finalName);
                result.add(finalName);
              }
            }
            walk(c);
          }
        }
      }

      // 2. Process clusters/children with type filter
      final clusterKeys = ['clusters', 'cluster', 'children'];
      for (var key in clusterKeys) {
        final arr = node[key];
        if (arr is List) {
          for (var c in arr) {
            if (c is Map && c.containsKey('name')) {
              final type = c['type'] ?? c['cluster_type'];
              if (isCityType(type?.toString())) {
                final finalName = formatLocation(Map<String, dynamic>.from(c));
                if (finalName.isNotEmpty && !seen.contains(finalName)) {
                  seen.add(finalName);
                  result.add(finalName);
                }
              }
            }
            walk(c);
          }
        }
      }

      // 3. Recurse into others without adding them to results (Matches web logic)
      final otherKeys = ['continents', 'countries', 'states', 'districts', 'mandals', 'towns', 'villages', 'locations'];
      for (var key in otherKeys) {
        final arr = node[key];
        if (arr is List) {
          for (var child in arr) walk(child);
        }
      }
    }

    for (var node in hierarchy) walk(node);
    result.sort();
    return result;
  }
}
