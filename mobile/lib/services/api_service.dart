import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io';
import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';
import 'logger_service.dart';
import 'location_tracking_service.dart';

/// Centralized API Service for handling all HTTP requests
/// Provides consistent error handling, authentication, and request/response management
/// Token + user are persisted in SharedPreferences (mirrors web app's localStorage 'tgs_user' key).
class ApiService {
  static final ApiService _instance = ApiService._internal();

  String? _authToken;
  Map<String, dynamic>? _currentUser;

  factory ApiService() {
    return _instance;
  }

  ApiService._internal();

  // ─── Session Persistence ─────────────────────────────────────────────────

  /// Load persisted session from SharedPreferences on app launch.
  /// Call this in main() before runApp() so all screens start authenticated.
  static Future<void> loadSession() async {
    final prefs = await SharedPreferences.getInstance();
    final stored = prefs.getString('tgs_user');
    LoggerService.log('SESSION: Checking for stored session...');

    if (stored != null && stored.isNotEmpty) {
      // Safety check: metadata should never be megabytes.
      // Large strings here usually mean un-stripped Base64 images which cause OOM at startup.
      if (stored.length > 200000) {
        LoggerService.log(
          'SESSION: Oversized session data detected (${stored.length} bytes). Clearing for safety.',
          isError: true,
        );
        await prefs.remove('tgs_user');
        return;
      }
      try {
        final userData = jsonDecode(stored) as Map<String, dynamic>;
        final token = userData['token']?.toString() ?? '';
        if (token.isNotEmpty) {
          _instance._authToken = token;
          _instance._currentUser = userData;
          LoggerService.log(
            'SESSION: Successfully restored token for ${userData['employee_id']}',
          );
        }
      } catch (e) {
        LoggerService.log('SESSION: Corrupted data found: $e', isError: true);
        await prefs.remove('tgs_user');
      }
    } else {
      LoggerService.log('SESSION: No stored session found.');
    }
  }

  /// Persist token + full user map to SharedPreferences.
  Future<void> _saveSession() async {
    final prefs = await SharedPreferences.getInstance();
    if (_currentUser != null) {
      final data = Map<String, dynamic>.from(_currentUser!);
      data['token'] = _authToken ?? '';

      // CRITICAL: Strip large Base64 strings before persisting to SharedPreferences
      // Storing megabytes of Base64 in XML-based prefs causes OOM and launch crashes.
      data.remove('face_photo');
      data.remove('photo_captured');
      if (data.containsKey('external_profile')) {
        final ext = Map<String, dynamic>.from(data['external_profile']);
        ext.remove('photo');
        data['external_profile'] = ext;
      }

      await prefs.setString('tgs_user', jsonEncode(data));
      LoggerService.log('SESSION: Persisted metadata to storage.');
    }
  }

  // ─── Token / User Setters ────────────────────────────────────────────────

  /// Set authentication token from login response and persist it.
  Future<void> setToken(String token) async {
    _authToken = token;
    await _saveSession();
  }

  /// Clear token on logout — removes from memory AND SharedPreferences.
  Future<void> clearToken() async {
    // Explicitly grab final tracking position and kill tracking service BEFORE token is destroyed
    await LocationTrackingService.stopTracking();

    try {
      if (_authToken != null) {
        // Use raw http.post to avoid hitting _handleResponse which could trigger infinite clearToken() loops on 401
        final uri = _buildUri(ApiConstants.authLogout);
        await http.post(
          uri,
          headers: _buildHeaders(includeAuth: true),
          body: jsonEncode({}),
        ).timeout(const Duration(seconds: 3));
      }
    } catch (e) {
      LoggerService.log('Silent API logout failure: $e');
    }

    _authToken = null;
    _currentUser = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('tgs_user');
  }

  /// Store user details and persist them.
  Future<void> setUser(Map<String, dynamic> user) async {
    _currentUser = user;
    await _saveSession();
  }

  /// Get current user details.
  Map<String, dynamic>? getUser() => _currentUser;

  /// Fetch latest user profile from server and update local session.
  Future<Map<String, dynamic>> fetchFreshUser() async {
    final response = await get(ApiConstants.authProfile, includeAuth: true);
    if (response is Map<String, dynamic>) {
      await setUser(response);
      return response;
    }
    throw Exception('Failed to fetch fresh user data');
  }

  /// Get current token.
  String? getToken() => _authToken;

  /// Whether a valid session is loaded.
  bool get isAuthenticated => _authToken != null && _authToken!.isNotEmpty;

  // ─── Headers ─────────────────────────────────────────────────────────────

  Map<String, String> _buildHeaders({bool includeAuth = true}) {
    final headers = Map<String, String>.from(ApiConstants.headers);
    if (includeAuth && _authToken != null) {
      headers['Authorization'] = 'Bearer $_authToken';
    }
    // Automatically include the System API Key if present
    if (ApiConstants.apiKey.isNotEmpty) {
      headers['X-API-KEY'] = ApiConstants.apiKey;
    }
    return headers;
  }

  Uri _buildUri(String endpoint) {
    if (endpoint.startsWith('http')) {
      return Uri.parse(endpoint);
    }
    // Remove leading slash if present
    final path = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;
    return Uri.parse('${ApiConstants.baseUrl}/$path');
  }

  /// Get a full URL for an image source.
  /// If it starts with 'data:', it handles as Base64.
  /// If it starts with 'http', it returns it as is.
  /// Otherwise, it prepends the baseUrl.
  String getImageUrl(String source) {
    if (source.startsWith('data:')) return source;
    if (source.startsWith('http')) return source;
    // Remove leading slash if present
    final path = source.startsWith('/') ? source.substring(1) : source;
    return '${ApiConstants.baseUrl}/$path';
  }

  // ─── HTTP Methods ─────────────────────────────────────────────────────────

  /// POST request
  Future<dynamic> post(
    String endpoint, {
    required Map<String, dynamic> body,
    bool includeAuth = false,
  }) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API POST: $uri');
      final response = await http
          .post(
            uri,
            headers: _buildHeaders(includeAuth: includeAuth),
            body: jsonEncode(body),
          )
          .timeout(
            const Duration(milliseconds: ApiConstants.requestTimeout),
            onTimeout: () => throw TimeoutException('Request timeout'),
          );

      return _handleResponse(response);
    } on SocketException catch (e) {
      LoggerService.log('API POST ERR: SocketException - $e', isError: true);
      throw NetworkException('No internet connection');
    } on TimeoutException catch (e) {
      LoggerService.log('API POST ERR: Timeout - $e', isError: true);
      throw TimeoutException('Request timeout. Please try again.');
    } catch (e) {
      LoggerService.log('API POST ERR: $e', isError: true);
      rethrow;
    }
  }

  /// MULTIPART POST request for file uploads
  Future<dynamic> postMultipart(
    String endpoint, {
    required Map<String, String> fields,
    required String fileKey,
    required File file,
    bool includeAuth = true,
  }) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API MULTIPART POST: $uri');

      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(_buildHeaders(includeAuth: includeAuth));
      request.fields.addAll(fields);

      request.files.add(
        await http.MultipartFile.fromPath(
          fileKey,
          file.path,
        ),
      );

      final streamedResponse = await request.send().timeout(
        const Duration(milliseconds: ApiConstants.requestTimeout * 2), // Longer timeout for uploads
        onTimeout: () => throw TimeoutException('Upload timeout'),
      );

      final response = await http.Response.fromStream(streamedResponse);
      return _handleResponse(response);
    } on SocketException catch (e) {
      LoggerService.log('API MULTIPART ERR: SocketException - $e', isError: true);
      throw NetworkException('No internet connection');
    } on TimeoutException catch (e) {
      LoggerService.log('API MULTIPART ERR: Timeout - $e', isError: true);
      throw TimeoutException('Upload timeout. Please try again.');
    } catch (e) {
      LoggerService.log('API MULTIPART ERR: $e', isError: true);
      rethrow;
    }
  }

  /// GET request
  Future<dynamic> get(String endpoint, {bool includeAuth = true}) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API GET: $uri');
      final response = await http
          .get(uri, headers: _buildHeaders(includeAuth: includeAuth))
          .timeout(
            const Duration(milliseconds: ApiConstants.requestTimeout),
            onTimeout: () => throw TimeoutException('Request timeout'),
          );

      return _handleResponse(response);
    } on SocketException catch (e) {
      LoggerService.log('API GET ERR: SocketException - $e', isError: true);
      throw NetworkException('No internet connection');
    } on TimeoutException catch (e) {
      LoggerService.log('API GET ERR: Timeout - $e', isError: true);
      throw TimeoutException('Request timeout. Please try again.');
    } catch (e) {
      LoggerService.log('API GET ERR: $e', isError: true);
      rethrow;
    }
  }

  /// GET request for binary data
  Future<List<int>> getBinary(String endpoint, {bool includeAuth = true}) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API GET BINARY: $uri');
      final response = await http
          .get(uri, headers: _buildHeaders(includeAuth: includeAuth))
          .timeout(
            const Duration(milliseconds: ApiConstants.requestTimeout),
            onTimeout: () => throw TimeoutException('Request timeout'),
          );

      if (response.statusCode == 200) {
        return response.bodyBytes;
      } else {
        throw Exception('Failed to download file. Status: ${response.statusCode}');
      }
    } catch (e) {
      LoggerService.log('API GET BINARY ERR: $e', isError: true);
      rethrow;
    }
  }

  /// PUT request
  Future<dynamic> put(
    String endpoint, {
    required Map<String, dynamic> body,
    bool includeAuth = true,
  }) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API PUT: $uri');
      final response = await http
          .put(
            uri,
            headers: _buildHeaders(includeAuth: includeAuth),
            body: jsonEncode(body),
          )
          .timeout(
            const Duration(milliseconds: ApiConstants.requestTimeout),
            onTimeout: () => throw TimeoutException('Request timeout'),
          );

      return _handleResponse(response);
    } on SocketException catch (e) {
      LoggerService.log('API PUT ERR: SocketException - $e', isError: true);
      throw NetworkException('No internet connection');
    } on TimeoutException catch (e) {
      LoggerService.log('API PUT ERR: Timeout - $e', isError: true);
      throw TimeoutException('Request timeout. Please try again.');
    } catch (e) {
      LoggerService.log('API PUT ERR: $e', isError: true);
      rethrow;
    }
  }

  /// PATCH request
  Future<dynamic> patch(
    String endpoint, {
    required Map<String, dynamic> body,
    bool includeAuth = true,
  }) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API PATCH: $uri');
      final response = await http
          .patch(
            uri,
            headers: _buildHeaders(includeAuth: includeAuth),
            body: jsonEncode(body),
          )
          .timeout(
            const Duration(milliseconds: ApiConstants.requestTimeout),
            onTimeout: () => throw TimeoutException('Request timeout'),
          );

      return _handleResponse(response);
    } on SocketException catch (e) {
      LoggerService.log('API PATCH ERR: SocketException - $e', isError: true);
      throw NetworkException('No internet connection');
    } on TimeoutException catch (e) {
      LoggerService.log('API PATCH ERR: Timeout - $e', isError: true);
      throw TimeoutException('Request timeout. Please try again.');
    } catch (e) {
      LoggerService.log('API PATCH ERR: $e', isError: true);
      rethrow;
    }
  }

  /// DELETE request
  Future<dynamic> delete(String endpoint, {bool includeAuth = true}) async {
    try {
      final uri = _buildUri(endpoint);
      LoggerService.log('API DELETE: $uri');
      final response = await http
          .delete(uri, headers: _buildHeaders(includeAuth: includeAuth))
          .timeout(
            const Duration(milliseconds: ApiConstants.requestTimeout),
            onTimeout: () => throw TimeoutException('Request timeout'),
          );

      return _handleResponse(response);
    } on SocketException catch (e) {
      LoggerService.log('API DELETE ERR: SocketException - $e', isError: true);
      throw NetworkException('No internet connection');
    } on TimeoutException catch (e) {
      LoggerService.log('API DELETE ERR: Timeout - $e', isError: true);
      throw TimeoutException('Request timeout. Please try again.');
    } catch (e) {
      LoggerService.log('API DELETE ERR: $e', isError: true);
      rethrow;
    }
  }

  // ─── Response Handler ─────────────────────────────────────────────────────

  dynamic _handleResponse(http.Response response) {
    if (response.statusCode == 204) {
      return {'success': true};
    }

    try {
      final decoded = (response.body.isEmpty || response.body == 'null')
          ? <String, dynamic>{}
          : jsonDecode(response.body);
      
      // The data can be a Map or a List for various API endpoints
      final dynamic data = (decoded is Map || decoded is List) 
          ? decoded 
          : <String, dynamic>{'message': response.body};

      switch (response.statusCode) {
        case 200:
        case 201:
          return data;
        case 400:
          final Map<String, dynamic> errorMap = (data is Map) ? Map<String, dynamic>.from(data) : <String, dynamic>{'detail': data.toString()};
          throw BadRequestException(_extractMessage(errorMap, 'Bad request'));
        case 401:
          // Removed clearToken() to prevent auto-logout
          final Map<String, dynamic> errorMap = (data is Map) ? Map<String, dynamic>.from(data) : <String, dynamic>{'detail': data.toString()};
          throw UnauthorizedException(_extractMessage(errorMap, 'Unauthorized. Please login again.'));
        case 403:
          throw ForbiddenException(_extractMessage(data, 'Access forbidden'));
        case 404:
          throw NotFoundException(_extractMessage(data, 'Resource not found'));
        case 500:
          throw ServerException(_extractMessage(data, 'Server error. Please try again later.'));
        default:
          throw Exception('Unknown error. Status: ${response.statusCode}');
      }
    } on FormatException {
      // Response was not valid JSON
      if (response.statusCode == 200 || response.statusCode == 201) {
        return <String, dynamic>{'message': response.body};
      }
      throw Exception('Invalid server response (status ${response.statusCode})');
    } catch (e) {
      rethrow;
    }
  }

  String _extractMessage(dynamic data, String fallback) {
    if (data is Map) {
      return (data['detail'] ?? data['error'] ?? data['message'] ?? fallback)
          .toString();
    }
    return fallback;
  }
}

// ─── Custom Exception Classes ─────────────────────────────────────────────────

class NetworkException implements Exception {
  final String message;
  NetworkException(this.message);
  @override
  String toString() => message;
}

class TimeoutException implements Exception {
  final String message;
  TimeoutException(this.message);
  @override
  String toString() => message;
}

class BadRequestException implements Exception {
  final String message;
  BadRequestException(this.message);
  @override
  String toString() => message;
}

class UnauthorizedException implements Exception {
  final String message;
  UnauthorizedException(this.message);
  @override
  String toString() => message;
}

class ForbiddenException implements Exception {
  final String message;
  ForbiddenException(this.message);
  @override
  String toString() => message;
}

class NotFoundException implements Exception {
  final String message;
  NotFoundException(this.message);
  @override
  String toString() => message;
}

class ServerException implements Exception {
  final String message;
  ServerException(this.message);
  @override
  String toString() => message;
}
