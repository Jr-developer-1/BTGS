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
  List<Map<String, dynamic>>? _geoHierarchyCache;

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
        print(
          'MASTER_SUCCESS: $endpoint -> Found ${list.length} items (Key: $displayKey)',
        );
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
          .where(
            (item) =>
                item is Map &&
                (item['status'] == true || item['status'] == null) &&
                !(item['is_deleted'] == true),
          )
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
    if (_geoHierarchyCache != null) return _geoHierarchyCache!;
    try {
      final response = await _apiService.get(ApiConstants.geoHierarchy);
      List<Map<String, dynamic>> result = [];
      if (response is Map &&
          (response['results'] != null || response['data'] != null)) {
        final data = response['results'] ?? response['data'];
        result = List<Map<String, dynamic>>.from(data is List ? data : []);
      } else if (response is List) {
        result = List<Map<String, dynamic>>.from(response);
      }
      _geoHierarchyCache = result;
      return result;
    } catch (e) {
      print('Error fetching geo hierarchy: $e');
    }
    return [];
  }

  Future<String> getCityType(String locationName) async {
    final hierarchy = await getGeoHierarchy();
    String target = locationName.trim();
    if (target.contains(' - ')) {
      target = target.split(' - ')[0].trim();
    }
    if (target.isEmpty) return 'Others';

    String? foundType;
    void walk(dynamic node) {
      if (foundType != null) return;
      if (node == null || node is! Map) return;

      final clusterKeys = ['clusters', 'cluster'];
      for (var key in clusterKeys) {
        final arr = node[key];
        if (arr is List) {
          for (var c in arr) {
            if (c is Map && c.containsKey('name')) {
              final name = c['name']?.toString() ?? '';
              if (name.toLowerCase().trim() == target.toLowerCase()) {
                foundType = (c['cluster_type'] ?? c['type'] ?? 'Cluster').toString();
                return;
              }
            }
            walk(c);
          }
        }
      }

      final recurseKeys = [
        'cities',
        'metro_polyten_cities',
        'children',
        'continents',
        'countries',
        'states',
        'districts',
        'mandals',
        'towns',
        'villages',
        'locations',
      ];
      for (var key in recurseKeys) {
        final arr = node[key];
        if (arr is List) {
          for (var child in arr) {
            walk(child);
            if (foundType != null) return;
          }
        }
      }
    }

    for (var node in hierarchy) {
      walk(node);
      if (foundType != null) break;
    }

    if (foundType != null) {
      final ct = foundType!.toLowerCase();
      if (ct.contains('metro') || ct.contains('state hq')) {
        return 'State HQ';
      } else if (ct.contains('city') || ct.contains('town') || ct.contains('district')) {
        return 'Districts';
      }
    }
    return 'Others';
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
      final response = await _apiService.get(
        ApiConstants.masterIncidentalTypes,
      );
      List rawList = [];
      if (response is List) {
        rawList = response;
      } else if (response is Map) {
        rawList = response['results'] ?? response['data'] ?? [];
      }
      return rawList
          .where(
            (item) =>
                item is Map &&
                (item['status'] == true || item['status'] == null) &&
                !(item['is_deleted'] == true),
          )
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
      if (response is List)
        rawList = response;
      else if (response is Map)
        rawList = response['results'] ?? response['data'] ?? [];
      return rawList
          .where(
            (item) =>
                item is Map &&
                (item['status'] == true || item['status'] == null) &&
                !(item['is_deleted'] == true),
          )
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<String>> getProviders() =>
      fetchMasterList(ApiConstants.masterProviders, 'results', 'provider_name');

  Future<List<Map<String, dynamic>>> getProvidersRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterProviders);
      List rawList = [];
      if (response is List)
        rawList = response;
      else if (response is Map)
        rawList = response['results'] ?? response['data'] ?? [];
      return rawList
          .where(
            (item) =>
                item is Map &&
                (item['status'] == true || item['status'] == null) &&
                !(item['is_deleted'] == true),
          )
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<Map<String, dynamic>>> getLocalProvidersRaw() async {
    try {
      final response = await _apiService.get(ApiConstants.masterLocalProviders);
      List rawList = [];
      if (response is List)
        rawList = response;
      else if (response is Map)
        rawList = response['results'] ?? response['data'] ?? [];
      return rawList
          .where(
            (item) =>
                item is Map &&
                (item['status'] == true || item['status'] == null) &&
                !(item['is_deleted'] == true),
          )
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    } catch (e) {
      return [];
    }
  }

  Future<List<String>> getLocationsPool() async {
    final hierarchy = await getGeoHierarchy();
    final List<String> result = [];
    final seen = <String>{};

    void walk(dynamic node) {
      if (node == null || node is! Map) return;

      // Collect all cluster nodes (matching web locationsPool)
      final clusterKeys = ['clusters', 'cluster'];
      for (var key in clusterKeys) {
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

      // Recurse into all other structural levels
      final recurseKeys = [
        'cities',
        'metro_polyten_cities',
        'children',
        'continents',
        'countries',
        'states',
        'districts',
        'mandals',
        'towns',
        'villages',
        'locations',
      ];
      for (var key in recurseKeys) {
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

  Future<List<String>> getCitiesPool() async {
    final hierarchy = await getGeoHierarchy();
    final List<String> result = [];
    final seen = <String>{};

    const cityTypes = [
      'city',
      'metropolitan city',
      'metro city',
      'metro_city',
      'metropolyten city',
    ];
    bool isCityType(String? t) =>
        cityTypes.contains((t ?? '').toLowerCase().trim());

    void walk(dynamic node) {
      if (node == null || node is! Map) return;

      // Collect explicit cities
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

      // Collect only clusters matching cityTypes
      final clusterKeys = ['clusters', 'cluster'];
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

      // Recurse into all other structural levels
      final recurseKeys = [
        'children',
        'continents',
        'countries',
        'states',
        'districts',
        'mandals',
        'towns',
        'villages',
        'locations',
      ];
      for (var key in recurseKeys) {
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

  Future<Map<String, dynamic>> getMyEligibility() async {
    try {
      final response = await _apiService.get(ApiConstants.masterMyEligibility);
      if (response is Map<String, dynamic>) {
        return response;
      }
    } catch (e) {
      print('Error fetching my eligibility rules: $e');
    }
    return {};
  }
}
