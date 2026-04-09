import 'dart:async';
import 'dart:ui';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geolocator_android/geolocator_android.dart';
import 'package:geolocator_apple/geolocator_apple.dart';
import 'package:intl/intl.dart';
import 'api_service.dart';
import 'trip_service.dart';
import '../models/trip_model.dart';
import 'logger_service.dart';

class LocationTrackingService {
  static final LocationTrackingService _instance =
      LocationTrackingService._internal();
  factory LocationTrackingService() => _instance;
  LocationTrackingService._internal();

  static Future<void> initializeService() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: 'location_tracking',
        initialNotificationTitle: 'Trip Tracking Active',
        initialNotificationContent:
            'Your location is being shared with your manager.',
        foregroundServiceNotificationId: 888,
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  /// Automatically starts or stops tracking based on approved trip dates
  static Future<void> syncTrackingWithTrips() async {
    try {
      // 1. Safety Check: Verify Permissions before starting background service
      // Starting a foreground service without permissions causes immediate crash on Android 14+
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        // Android 15 Safety: Increase delay to 3 seconds for OS background updates
        await Future.delayed(const Duration(seconds: 3));
        // Force a fresh check from the OS
        permission = await Geolocator.checkPermission();
      }

      if (permission == LocationPermission.denied ||
          permission == LocationPermission.deniedForever) {
        debugPrint(
          'SYNC_TRACKING: Permission still denied after wait. Aborting safely.',
        );
        return;
      }

      // Android 11+ requires BACKGROUND_LOCATION ("always" permission) for pure background launches.
      // However, if the app is in the foreground right now, 'whileInUse' is perfectly valid to start the tracker!
      if (permission == LocationPermission.whileInUse) {
        debugPrint(
          'SYNC_TRACKING: Only while-in-use granted. Tracking will start, but might be killed if closed.',
        );
      }

      final tripService = TripService();
      final trips = await tripService.fetchTrips();
      final now = DateTime.now();
      final nowDay = DateTime(now.year, now.month, now.day);

      Trip? activeTrip;

      for (var trip in trips) {
        final status = trip.status.toLowerCase();

        bool isViableStatus =
            status.contains('approved') ||
            status.contains('ongoing') ||
            status.contains('on-going') ||
            status.contains('started') ||
            status.contains('live') ||
            status == 'ready';

        if (isViableStatus) {
          try {
            final startDateString = trip.startDate;
            final endDateString = trip.endDate;

            if (startDateString.isEmpty || endDateString.isEmpty) continue;

            // Robust date parsing (handles ISO and 'Mar 07, 2026')
            DateTime parseDate(String dateStr) {
              try {
                return DateTime.parse(dateStr);
              } catch (_) {
                return DateFormat('MMM dd, yyyy').parse(dateStr);
              }
            }

            final startDate = parseDate(startDateString);
            final endDate = parseDate(endDateString);

            final tripStart = DateTime(
              startDate.year,
              startDate.month,
              startDate.day,
            );
            final tripEnd = DateTime(endDate.year, endDate.month, endDate.day);

            if ((nowDay.isAfter(tripStart) ||
                    nowDay.isAtSameMomentAs(tripStart)) &&
                (nowDay.isBefore(tripEnd) ||
                    nowDay.isAtSameMomentAs(tripEnd))) {
              activeTrip = trip;
              break;
            }
          } catch (e) {
            debugPrint(
              'SYNC_TRACKING: Date parse error for trip ${trip.tripId}: $e',
            );
          }
        }
      }

      if (activeTrip != null) {
        debugPrint(
          'SYNC_TRACKING: Starting tracking for trip ${activeTrip.tripId} (ID: ${activeTrip.id})',
        );
        try {
          await startTracking(activeTrip.tripId); // Use tripId (e.g. TRP-2026-1814), not encoded id
          debugPrint('SYNC_TRACKING: startTracking() invoked successfully');
        } catch (e) {
          debugPrint('SYNC_TRACKING: startTracking failed: $e');
        }
      } else {
        debugPrint(
          'SYNC_TRACKING: No active trip found among ${trips.length} trips. Stopping service.',
        );
        stopTracking();
      }
    } catch (e) {
      debugPrint('SYNC_TRACKING: Fatal error syncing trips: $e');
    }
  }

  static Future<bool> ensureLocationAccess() async {
    bool enabled = await Geolocator.isLocationServiceEnabled();

    if (!enabled) {
      await Geolocator.openLocationSettings();
      await Future.delayed(const Duration(seconds: 2));
      enabled = await Geolocator.isLocationServiceEnabled();
      if (!enabled) {
        return false;
      }
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      return false;
    }

    if (permission == LocationPermission.deniedForever) {
      await Geolocator.openAppSettings();
      return false;
    }

    return true;
  }

  static Future<void> syncCurrentLocation(String tripId) async {
    try {
      bool enabled = await Geolocator.isLocationServiceEnabled();
      var perm = await Geolocator.checkPermission();
      if (!enabled || perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
        return;
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      ).timeout(const Duration(seconds: 15));

      final apiService = ApiService();
      final endpoint = '/api/trips/$tripId/tracking/';
      await apiService.post(
        endpoint,
        body: {
          'latitude': position.latitude,
          'longitude': position.longitude,
          'timestamp': DateTime.now().toIso8601String(),
          'accuracy': position.accuracy,
          'speed': position.speed,
        },
        includeAuth: true,
      );
      debugPrint('IMMEDIATE LOCATION SYNCED for $tripId');
    } catch (e) {
      debugPrint('IMMEDIATE LOCATION SYNC ERROR: $e');
    }
  }

  static Future<void> startTracking(String tripId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('active_tracking_trip_id', tripId);

    // Grab instant location on track start
    await syncCurrentLocation(tripId);

    final service = FlutterBackgroundService();

    try {
      // avoid trying to relaunch if the service is already running
      if (!await service.isRunning()) {
        await service.startService();
      }
      // Pass tripId to the background isolate regardless of restart
      service.invoke('setTripId', {"tripId": tripId});
    } catch (e) {
      debugPrint('START_TRACKING_ERROR: $e');
    }
  }

  static Future<void> stopTracking() async {
    final prefs = await SharedPreferences.getInstance();
    final tripId = prefs.getString('active_tracking_trip_id');
    
    // Grab instant location on track stop/logout
    if (tripId != null) {
      await syncCurrentLocation(tripId);
    }
    
    await prefs.remove('active_tracking_trip_id');

    final service = FlutterBackgroundService();
    if (await service.isRunning()) {
      service.invoke("stopService");
    }
  }
}

@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  // Required for background isolate to use plugins
  DartPluginRegistrant.ensureInitialized();
  WidgetsFlutterBinding.ensureInitialized();

  // 1. IMMEDIATELY tell Android we are a foreground service to avoid SIG:9 kill
  if (service is AndroidServiceInstance) {
    service.setAsForegroundService();
    service.setForegroundNotificationInfo(
      title: "Trip Tracking Active",
      content: "Initializing tracking...",
    );
  }

  // basic sanity checks that often fail silently
  bool enabled = await Geolocator.isLocationServiceEnabled();
  debugPrint('BACKGROUND SERVICE: location service enabled? $enabled');
  LocationPermission perm = await Geolocator.checkPermission();
  debugPrint('BACKGROUND SERVICE: permission status: $perm');

  // Prevent ANRs by aggressively shutting down the service if location cannot be accessed.
  if (!enabled || 
      perm == LocationPermission.denied || 
      perm == LocationPermission.deniedForever) {
    debugPrint("BACKGROUND SERVICE: Insufficient permissions or GPS disabled. Shutting down.");
    service.stopSelf();
    return; // Fast exit prevents Geolocator.getPositionStream crash
  }

  // Initialize static session for the background isolate
  await ApiService.loadSession();
  final ApiService apiService = ApiService();

  // DEBUG: show the token we recovered (may be empty if load failed)
  LoggerService.log(
    'BACKGROUND SERVICE: auth token = ${apiService.getToken()}',
  );
  final prefs = await SharedPreferences.getInstance();
  String? currentTripId = prefs.getString('active_tracking_trip_id');

  debugPrint(
    'BACKGROUND SERVICE: Started. Current Trip ID from Prefs: $currentTripId',
  );

  service.on('setTripId').listen((event) {
    currentTripId = event?['tripId'];
    debugPrint('BACKGROUND SERVICE: Trip ID set to $currentTripId');
  });

  StreamSubscription<Position>? positionStream;

  service.on('stopService').listen((event) {
    debugPrint('BACKGROUND SERVICE: Stopping');
    positionStream?.cancel();
    service.stopSelf();
  });

  // Tracking Logic - Triggered only when device moves 100 meters
  late LocationSettings locationSettings;
  if (defaultTargetPlatform == TargetPlatform.android) {
    // AndroidSettings allows fallback to standard LocationManager to avoid FusedLocationProvider ANRs on some devices
    locationSettings = AndroidSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 100,
      forceLocationManager: true, 
    );
  } else if (defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.macOS) {
    locationSettings = AppleSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 100,
      pauseLocationUpdatesAutomatically: true,
      activityType: ActivityType.automotiveNavigation,
    );
  } else {
    locationSettings = const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 100,
    );
  }

  positionStream = Geolocator.getPositionStream(locationSettings: locationSettings).listen((Position? position) async {
    try {
      debugPrint('BACKGROUND SERVICE: 100m Movement Detected. TripID: $currentTripId');
      if (position != null && currentTripId != null) {
        try {
          final token = apiService.getToken();
          debugPrint(
            'BACKGROUND SERVICE: Syncing. Token present: ${token != null && token.isNotEmpty}',
          );

          final endpoint = '/api/trips/$currentTripId/tracking/';
          await apiService.post(
            endpoint,
            body: {
              'latitude': position.latitude,
              'longitude': position.longitude,
              'timestamp': DateTime.now().toIso8601String(),
              'accuracy': position.accuracy,
              'speed': position.speed,
            },
            includeAuth: true,
          );
          debugPrint('BACKGROUND SERVICE: Sync OK for $currentTripId');

          if (service is AndroidServiceInstance) {
            service.setForegroundNotificationInfo(
              title: "Trip Tracking Active",
              content:
                  "Last Sync: ${DateFormat('HH:mm').format(DateTime.now())} (Moved 100m)",
            );
          }
        } catch (e) {
          debugPrint('BACKGROUND SERVICE: API Post Error: $e');
          if (e is ForbiddenException || e is UnauthorizedException || e is NotFoundException || e.toString().contains('404') || e.toString().contains('NotFound')) {
            debugPrint('BACKGROUND SERVICE: Auth or NotFound failure, stopping.');
            positionStream?.cancel();
            service.stopSelf();
          }
        }
      } else {
        if (service is AndroidServiceInstance) {
          service.setForegroundNotificationInfo(
            title: "Trip Tracking Active",
            content: "Waiting for GPS movement...",
          );
        }
      }
    } catch (e) {
      debugPrint('BACKGROUND SERVICE: Fatal stream error: $e');
    }
  });
}

@pragma('vm:entry-point')
bool onIosBackground(ServiceInstance service) {
  return true;
}
