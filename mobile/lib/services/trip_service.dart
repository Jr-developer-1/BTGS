import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../models/trip_model.dart';
import 'api_service.dart';
import '../constants/api_constants.dart';

class TripService {
  final ApiService _apiService = ApiService();

  Future<List<Trip>> fetchTrips({String? search, bool all = false}) async {
    List<String> params = [];
    if (search != null && search.isNotEmpty) params.add('search=$search');
    if (all) params.add('all=true');

    String queryString = params.isNotEmpty ? '?${params.join('&')}' : '';

    final tripsResponse = await _apiService.get(
      '${ApiConstants.trips}$queryString',
    );
    final travelsResponse = await _apiService.get(
      '${ApiConstants.travels}$queryString',
    );

    List<Trip> trips = [];
    if (tripsResponse is List) {
      trips.addAll(tripsResponse.map((json) => Trip.fromJson(json)));
    }
    if (travelsResponse is List) {
      trips.addAll(travelsResponse.map((json) => Trip.fromJson(json)));
    }
    return trips;
  }

  Future<List<Map<String, dynamic>>> fetchUserAdvances() async {
    final response = await _apiService.get(ApiConstants.UserAdvances);
    if (response is List) {
      return List<Map<String, dynamic>>.from(response);
    }
    return [];
  }

  String _resolveTripId(String id) {
    // id may be raw or base64-url encoded. Decode encoded IDs for routing decisions.
    if (id.startsWith('ITS-') ||
        id.startsWith('TRP-') ||
        id.startsWith('TRV-')) {
      return id;
    }

    try {
      var normalized = id;
      // Add padding for Base64 decode as needed
      final pad = normalized.length % 4;
      if (pad != 0) {
        normalized = normalized + ('=' * (4 - pad));
      }
      // base64Url for URL-safe strings
      final decoded = utf8.decode(base64Url.decode(normalized));
      if (decoded.isNotEmpty) {
        return decoded;
      }
    } catch (_) {
      // Not a base64-encoded ID; use as-is
    }

    return id;
  }

  Future<Trip> fetchTripDetails(String id) async {
    final resolvedId = _resolveTripId(id);
    final endpoint = resolvedId.startsWith('ITS-')
        ? ApiConstants.travelDetails
        : ApiConstants.tripDetails;
    final url = endpoint.replaceFirst('{id}', id);
    final response = await _apiService.get(url);
    return Trip.fromJson(response);
  }

  Future<void> patchTrip(String tripId, Map<String, dynamic> data) async {
    final resolvedId = _resolveTripId(tripId);
    final endpoint = resolvedId.startsWith('ITS-')
        ? ApiConstants.travelDetails
        : ApiConstants.tripDetails;
    final url = endpoint.replaceFirst('{id}', tripId);
    await _apiService.patch(url, body: data, includeAuth: true);
  }

  Future<Trip> createTrip(Map<String, dynamic> data) async {
    final isLocal = data['consider_as_local'] == true;
    final url = isLocal ? ApiConstants.travels : ApiConstants.trips;

    final response = await _apiService.post(url, body: data, includeAuth: true);
    return Trip.fromJson(response);
  }

  Future<List<Map<String, dynamic>>> fetchClaims({String? tripId}) async {
    String url = '${ApiConstants.baseUrl}/api/claims/';
    if (tripId != null) url += '?trip_id=$tripId';
    final response = await _apiService.get(url);
    if (response is List) {
      return List<Map<String, dynamic>>.from(response);
    }
    return [];
  }

  Future<Map<String, dynamic>> createClaim(Map<String, dynamic> data) async {
    return await _apiService.post(
      '${ApiConstants.baseUrl}/api/claims/',
      body: data,
      includeAuth: true,
    );
  }

  Future<Map<String, dynamic>> updateClaim(
    int id,
    Map<String, dynamic> data,
  ) async {
    return await _apiService.put(
      '${ApiConstants.baseUrl}/api/claims/$id/',
      body: data,
      includeAuth: true,
    );
  }

  Future<List<Map<String, dynamic>>> fetchExpenses({String? tripId}) async {
    String url = '${ApiConstants.baseUrl}/api/expenses/';
    if (tripId != null) url += '?trip_id=$tripId';
    final response = await _apiService.get(url);
    if (response is List) {
      return List<Map<String, dynamic>>.from(response);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchApprovals({
    String tab = 'pending',
    String type = 'all',
    String viewType = 'special',
    String? search,
  }) async {
    String url =
        '${ApiConstants.approvals}?tab=$tab&type=$type&view_type=$viewType';
    if (search != null && search.isNotEmpty) {
      url += '&search=$search';
    }
    final response = await _apiService.get(url);
    if (response is List) {
      return List<Map<String, dynamic>>.from(response);
    }
    return [];
  }

  Future<List<Trip>> fetchTripApprovals() async {
    final response = await _apiService.get(ApiConstants.tripApprovals);
    if (response is List) {
      return response.map((json) => Trip.fromJson(json)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> fetchApprovalCounts() async {
    final response = await _apiService.get(ApiConstants.approvalsCount);
    if (response is Map) {
      return Map<String, dynamic>.from(response);
    }
    return {'total': 0, 'advances': 0, 'trips': 0, 'claims': 0};
  }

  Future<void> performApproval(
    dynamic id,
    String action, {
    Map<String, dynamic>? extraData,
  }) async {
    final Map<String, dynamic> body = {'id': id.toString(), 'action': action};
    if (extraData != null) {
      body.addAll(extraData);
    }

    await _apiService.post(
      '${ApiConstants.baseUrl}/api/approvals/',
      body: body,
      includeAuth: true,
    );
  }

  Future<dynamic> getReportingManager() async {
    try {
      final response = await _apiService.get(
        '${ApiConstants.baseUrl}/api/employees/',
      );
      // Logic matching CreateTrip.jsx to find manager
      // This is simplified for service, complexity handled in screen if needed
      return response;
    } catch (e) {
      return null;
    }
  }

  Future<void> requestAdvance(
    String tripId,
    double amount,
    String purpose, {
    String? paymentMode,
  }) async {
    await _apiService.post(
      '${ApiConstants.baseUrl}/api/advances/',
      body: {
        'requested_amount': amount,
        'purpose': purpose,
        'trip': tripId,
        'status': 'Submitted',
        'payment_mode': paymentMode ?? 'Bank Transfer',
        'submitted_at': DateTime.now().toIso8601String(),
      },
      includeAuth: true,
    );
  }

  Future<Map<String, dynamic>> addExpense(
    Map<String, dynamic> expenseData,
  ) async {
    final response = await _apiService.post(
      ApiConstants.expenses,
      body: expenseData,
      includeAuth: true,
    );
    return Map<String, dynamic>.from(response);
  }

  Future<Map<String, dynamic>> updateExpense(
    String id,
    Map<String, dynamic> expenseData,
  ) async {
    final response = await _apiService.put(
      '${ApiConstants.expenses}$id/',
      body: expenseData,
      includeAuth: true,
    );
    return Map<String, dynamic>.from(response);
  }

  /// Partial update — use this for targeted field changes (e.g. job report)
  Future<Map<String, dynamic>> patchExpense(
    String id,
    Map<String, dynamic> expenseData,
  ) async {
    final response = await _apiService.patch(
      '${ApiConstants.expenses}$id/',
      body: expenseData,
      includeAuth: true,
    );
    return Map<String, dynamic>.from(response);
  }

  Future<void> deleteExpense(String id) async {
    await _apiService.delete('${ApiConstants.expenses}$id/', includeAuth: true);
  }

  Future<double?> fetchFuelRate(String vehicleType) async {
    try {
      final response = await _apiService.get(
        '${ApiConstants.fuelRates}?vehicle_type=$vehicleType',
      );
      if (response != null && response['rate_per_km'] != null) {
        return double.tryParse(response['rate_per_km'].toString());
      }
    } catch (e) {
      debugPrint('Error fetching fuel rate: $e');
    }
    return null;
  }

  Future<void> updateOdometer(
    String tripId, {
    String? start,
    String? end,
  }) async {
    final payload = {'trip': tripId};
    if (start != null) payload['start_odo_reading'] = start;
    if (end != null) payload['end_odo_reading'] = end;

    await _apiService.post(
      '${ApiConstants.baseUrl}/api/trip-odometer/',
      body: payload,
      includeAuth: true,
    );
  }

  Future<List<Map<String, dynamic>>> fetchGuestHouses() async {
    final response = await _apiService.get(
      '${ApiConstants.baseUrl}/api/guesthouse/',
    );
    if (response is List) {
      return response.map((item) => Map<String, dynamic>.from(item)).toList();
    }
    return [];
  }

  Future<Map<String, dynamic>> fetchGuestHouseById(int id) async {
    final response = await _apiService.get(
      '${ApiConstants.baseUrl}/api/guesthouse/$id',
    );
    return Map<String, dynamic>.from(response);
  }

  Future<void> saveGuestHouse(Map<String, dynamic> data, {int? id}) async {
    if (id != null) {
      await _apiService.put(
        '${ApiConstants.baseUrl}/api/guesthouse/$id',
        body: data,
        includeAuth: true,
      );
    } else {
      await _apiService.post(
        '${ApiConstants.baseUrl}/api/guesthouse/',
        body: data,
        includeAuth: true,
      );
    }
  }

  Future<void> deleteGuestHouse(int id) async {
    await _apiService.delete(
      '${ApiConstants.baseUrl}/api/guesthouse/$id',
      includeAuth: true,
    );
  }

  Future<void> createRoomBooking(int roomId, Map<String, dynamic> data) async {
    await _apiService.post(
      '${ApiConstants.baseUrl}/api/guesthouse/rooms/$roomId/bookings',
      body: data,
      includeAuth: true,
    );
  }

  Future<List<Map<String, dynamic>>> fetchAllTransactions() async {
    final claims = await fetchClaims();
    final advances = await _apiService.get(
      '${ApiConstants.baseUrl}/api/advances/',
    );

    List<Map<String, dynamic>> all = [];
    for (var c in claims) {
      all.add({
        'id': 'CLM-${c['id']}',
        'trip': c['trip'],
        'employee': c['user_name'] ?? 'N/A',
        'amount': c['total_amount'],
        'type': 'Travel Claim',
        'status': c['status'],
        'date': c['submitted_at'] ?? c['created_at'],
      });
    }
    if (advances is List) {
      for (var a in advances) {
        all.add({
          'id': 'ADV-${a['id']}',
          'trip': a['trip'],
          'employee': a['user_name'] ?? 'N/A',
          'amount': a['requested_amount'],
          'type': 'Cash Advance',
          'status': a['status'],
          'date': a['created_at'],
        });
      }
    }
    all.sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));
    return all;
  }

  Future<List<Map<String, dynamic>>> fetchAuditLogs({
    String? search,
    String? action,
  }) async {
    String url = ApiConstants.auditLogs;
    List<String> params = [];
    if (search != null && search.isNotEmpty) params.add('search=$search');
    if (action != null && action.isNotEmpty) params.add('action=$action');
    if (params.isNotEmpty) url += '?${params.join('&')}';

    final response = await _apiService.get(url, includeAuth: true);
    if (response is List) return List<Map<String, dynamic>>.from(response);
    return [];
  }

  Future<Map<String, dynamic>> fetchApiDashboardStats() async {
    final response = await _apiService.get(
      ApiConstants.apiDashboardStats,
      includeAuth: true,
    );
    if (response is Map) return Map<String, dynamic>.from(response);
    return {};
  }

  Future<List<Map<String, dynamic>>> fetchAccessKeys() async {
    final response = await _apiService.get(
      ApiConstants.apiAccessKeys,
      includeAuth: true,
    );
    if (response is List) return List<Map<String, dynamic>>.from(response);
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchDynamicEndpoints() async {
    final response = await _apiService.get(
      ApiConstants.apiDynamicEndpoints,
      includeAuth: true,
    );
    if (response is List) return List<Map<String, dynamic>>.from(response);
    return [];
  }

  Future<void> updateMasterApiKey(String key) async {
    await _apiService.post(
      ApiConstants.apiUpdateKey,
      body: {'key': key},
      includeAuth: true,
    );
  }

  Future<void> revokeAccessKey(int id) async {
    await _apiService.delete(
      '${ApiConstants.apiAccessKeys}$id/',
      includeAuth: true,
    );
  }

  Future<Map<String, dynamic>> generateAccessKey(
    Map<String, dynamic> data,
  ) async {
    final response = await _apiService.post(
      ApiConstants.apiAccessKeys,
      body: data,
      includeAuth: true,
    );
    if (response is Map) return Map<String, dynamic>.from(response);
    return {};
  }

  Future<void> createDynamicEndpoint(Map<String, dynamic> data) async {
    await _apiService.post(
      ApiConstants.apiDynamicEndpoints,
      body: data,
      includeAuth: true,
    );
  }

  Future<List<Map<String, dynamic>>> fetchEmployees() async {
    final response = await _apiService.get(
      '${ApiConstants.baseUrl}/api/employees/',
      includeAuth: true,
    );
    if (response is List) return List<Map<String, dynamic>>.from(response);
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchUsers() async {
    final response = await _apiService.get(
      ApiConstants.users,
      includeAuth: true,
    );
    if (response is List) return List<Map<String, dynamic>>.from(response);
    return [];
  }

  Future<void> makeUser(Map<String, dynamic> data) async {
    await _apiService.post(ApiConstants.users, body: data, includeAuth: true);
  }

  // Fleet Management
  Future<List<Map<String, dynamic>>> fetchFleetHubs() async {
    final response = await _apiService.get(
      '${ApiConstants.baseUrl}/api/fleet/hub/',
    );
    if (response is List) {
      return response.map((item) => Map<String, dynamic>.from(item)).toList();
    }
    return [];
  }

  Future<void> saveFleetHub(Map<String, dynamic> data, {int? id}) async {
    if (id != null) {
      await _apiService.put(
        '${ApiConstants.baseUrl}/api/fleet/hub/$id/',
        body: data,
        includeAuth: true,
      );
    } else {
      await _apiService.post(
        '${ApiConstants.baseUrl}/api/fleet/hub/',
        body: data,
        includeAuth: true,
      );
    }
  }

  Future<void> deleteFleetHub(int id) async {
    await _apiService.delete(
      '${ApiConstants.baseUrl}/api/fleet/hub/$id/',
      includeAuth: true,
    );
  }

  Future<void> saveFleetItem(
    String type,
    Map<String, dynamic> data, {
    int? id,
  }) async {
    // type is 'vehicles' or 'drivers'
    if (id != null) {
      await _apiService.put(
        '${ApiConstants.baseUrl}/api/fleet/items/$type/$id/',
        body: data,
        includeAuth: true,
      );
    } else {
      await _apiService.post(
        '${ApiConstants.baseUrl}/api/fleet/items/$type/',
        body: data,
        includeAuth: true,
      );
    }
  }

  Future<void> deleteFleetItem(String type, int id) async {
    await _apiService.delete(
      '${ApiConstants.baseUrl}/api/fleet/items/$type/$id/',
      includeAuth: true,
    );
  }

  Future<void> assignVehicle(int vehicleId, Map<String, dynamic> data) async {
    await _apiService.post(
      '${ApiConstants.baseUrl}/api/fleet/vehicles/$vehicleId/bookings/',
      body: data,
      includeAuth: true,
    );
  }

  Future<Map<String, dynamic>> fetchDashboardStats() async {
    final response = await _apiService.get(
      '${ApiConstants.baseUrl}/api/dashboard-stats/',
      includeAuth: true,
    );
    if (response is Map) return Map<String, dynamic>.from(response);
    return {};
  }

  Future<Map<String, dynamic>?> fetchLatestTrackingPoint(String tripId) async {
    try {
      final response = await _apiService.get('/api/trips/$tripId/tracking/');
      if (response is List && response.isNotEmpty) {
        // Return latest known point from the end of the history
        return Map<String, dynamic>.from(response.last);
      }
    } catch (e) {
      debugPrint('ERROR FETCHING TRACKING for $tripId: $e');
    }
    return null;
  }

  // Settlement Methods
  Future<dynamic> fetchSettlements({String? tripId}) async {
    String url = ApiConstants.settlement;
    if (tripId != null) url += '?trip_id=$tripId';
    return await _apiService.get(url);
  }

  Future<void> performSettlement(String tripId) async {
    await _apiService.post(
      ApiConstants.settlement,
      body: {'trip_id': tripId},
      includeAuth: true,
    );
  }

  Future<List<int>> downloadBulkTemplate() async {
    return await _apiService.getBinary(ApiConstants.bulkTemplate);
  }

  Future<void> uploadBulkLocalConveyance(String tripId, File file) async {
    await _apiService.postMultipart(
      ApiConstants.bulkUpload,
      fields: {'trip_id': tripId},
      fileKey: 'file',
      file: file,
      includeAuth: true,
    );
  }

  Future<List<Map<String, dynamic>>> fetchBulkActivities() async {
    final response = await _apiService.get(
      '${ApiConstants.baseUrl}/api/bulk-activities/',
    );
    if (response is List) return List<Map<String, dynamic>>.from(response);
    if (response is Map && response['results'] != null) {
      return List<Map<String, dynamic>>.from(response['results']);
    }
    return [];
  }

  Future<List<Map<String, dynamic>>> fetchBulkHistory(String tripId) async {
    try {
      final response = await _apiService.get(
        '${ApiConstants.bulkHistory}?trip_id=$tripId',
      );
      if (response is List) return List<Map<String, dynamic>>.from(response);
      return [];
    } catch (e) {
      debugPrint('ERROR FETCHING BULK HISTORY for $tripId: $e');
      return [];
    }
  }

  Future<void> uploadBulkJson({
    required String tripId,
    required List<dynamic> jsonData,
    String? parentBatchId,
  }) async {
    final Map<String, dynamic> body = {
      'trip_id': tripId,
      'data_json': jsonData,
    };
    if (parentBatchId != null) {
      body['parent_batch_id'] = parentBatchId;
    }

    await _apiService.post(
      '${ApiConstants.baseUrl}/api/bulk-activities/upload/',
      body: body,
      includeAuth: true,
    );
  }

  Future<void> handleBulkBatchAction(
    String batchId,
    String action, {
    Map<String, dynamic> extraData = const {},
  }) async {
    await _apiService.post(
      '${ApiConstants.baseUrl}/api/bulk-activities/$batchId/$action/',
      body: extraData,
      includeAuth: true,
    );
  }

  Future<List<Map<String, dynamic>>> fetchTeamLiveTracking() async {
    try {
      final response = await _apiService.get('/api/team/live-tracking/');
      if (response is List) return List<Map<String, dynamic>>.from(response);
      return [];
    } catch (e) {
      debugPrint('ERROR FETCHING TEAM TRACKING: $e');
      return [];
    }
  }
}
