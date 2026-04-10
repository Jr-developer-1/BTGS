import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:geolocator/geolocator.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';

class LiveMapScreen extends StatefulWidget {
  final Trip trip;
  final bool isOwner; // true = employee on their own trip, false = manager viewing subordinate

  const LiveMapScreen({super.key, required this.trip, this.isOwner = true});

  @override
  State<LiveMapScreen> createState() => _LiveMapScreenState();
}

class _LiveMapScreenState extends State<LiveMapScreen> {
  final MapController _mapController = MapController();
  final TripService _tripService = TripService();

  LatLng _currentPos = const LatLng(17.3850, 78.4867);
  bool _isLoading = true;
  bool _hasLocation = false;
  bool _locationOff = false; 
  String? _lastPointTimestamp; 
  DateTime? _staleStartTime;
  StreamSubscription<Position>? _positionStream;
  Timer? _backendPollingTimer;

  @override
  void initState() {
    super.initState();
    _initTracking();
  }

  Future<void> _initTracking() async {
    // ONLY check Manager's own GPS hardware if they are viewing their OWN trip.
    // If it's a manager viewing a subordinate, we skip hardware checks entirely.
    if (widget.isOwner) {
      try {
        bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (serviceEnabled) {
          LocationPermission permission = await Geolocator.checkPermission();
          if (permission == LocationPermission.denied) {
            permission = await Geolocator.requestPermission();
          }

          if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
            // ... (keep the rest of the GPS streaming logic for owners)
            Position pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
            if (mounted) {
              setState(() {
                _currentPos = LatLng(pos.latitude, pos.longitude);
                _isLoading = false;
                _hasLocation = true;
              });
              _mapController.move(_currentPos, 15.0);
            }
            
            final settings = AndroidSettings(
              accuracy: LocationAccuracy.high,
              distanceFilter: 5,
              intervalDuration: const Duration(seconds: 4),
            );

            _positionStream = Geolocator.getPositionStream(locationSettings: settings).listen((Position pos) {
              if (mounted) {
                setState(() {
                  _currentPos = LatLng(pos.latitude, pos.longitude);
                  _isLoading = false;
                  _hasLocation = true;
                });
                _mapController.move(_currentPos, 15.0);
              }
            });
            return;
          }
        }
      } catch (e) {
        debugPrint('Device GPS Initialization error: $e');
      }
    }

    // If we reach here, either widget.isOwner is false (Manager) or GPS failed.
    // We strictly use backend polling.
    _startBackendPolling();
  }

  void _startBackendPolling() {
    _fetchBackendPoint();
    // Hyper-Live Sync: Poll every 1 second for absolute immediate updates
    _backendPollingTimer = Timer.periodic(const Duration(seconds: 1), (_) => _fetchBackendPoint());
  }

  Future<void> _fetchBackendPoint() async {
    if (!mounted) return;
    try {
      final point = await _tripService.fetchLatestTrackingPoint(widget.trip.tripId);
      if (point != null && point['latitude'] != null && point['longitude'] != null) {
        final currentTimestamp = (point['updated_at'] ?? point['timestamp'] ?? point['last_updated'] ?? '').toString();
        
        // Check if the data from the server is 'New' or 'Stuck'
        if (currentTimestamp != _lastPointTimestamp) {
          // BRAND NEW DATA! Instantly show bike and clear warning
          setState(() {
            _lastPointTimestamp = currentTimestamp;
            _staleStartTime = null; 
            _locationOff = false;
            _isLoading = false;
            _hasLocation = true;
            final lat = double.tryParse(point['latitude'].toString()) ?? 0.0;
            final lng = double.tryParse(point['longitude'].toString()) ?? 0.0;
            if (lat != 0.0) _currentPos = LatLng(lat, lng);
          });
          _mapController.move(_currentPos, 15.0);
          return;
        } else {
          // DATA IS REPEATING (GPS might be off or user is standing still)
          _staleStartTime ??= DateTime.now();
          // Increase buffer to 40 seconds for maximum stability against network blips
          if (DateTime.now().difference(_staleStartTime!).inSeconds > 40) {
            if (mounted) setState(() => _locationOff = true);
          } else {
            // Even if data is repeating, as long as it's under 40s, keep the bike visible
            if (mounted) setState(() => _locationOff = false);
          }
        }
      } else {
        if (mounted) setState(() => _locationOff = true);
      }
    } catch (_) {
      if (mounted) setState(() => _locationOff = true);
    }
  }

  @override
  void dispose() {
    _positionStream?.cancel();
    _backendPollingTimer?.cancel();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFFF6B00)))
          : Stack(
              children: [
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _currentPos,
                    initialZoom: 15.0,
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                      userAgentPackageName: 'com.btgs.app',
                    ),
                    // Always show the bike marker at its last known position
                    MarkerLayer(
                      markers: [
                        Marker(
                          point: _currentPos,
                          width: 70,
                          height: 70,
                          child: Opacity(
                            // Fade the bike to 40% if they go offline so the manager knows it's 'last seen'
                            opacity: _locationOff ? 0.4 : 1.0,
                            child: Column(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(10),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: const Color(0xFFFF6B00),
                                    boxShadow: [
                                      if (!_locationOff) // Only show the glow when actually live
                                        BoxShadow(
                                          color: const Color(0xFFFF6B00).withOpacity(0.4),
                                          blurRadius: 12,
                                          spreadRadius: 3,
                                        ),
                                    ],
                                  ),
                                  child: const Icon(Icons.two_wheeler_rounded, color: Colors.white, size: 28),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),

                // Location OFF warning banner (only for manager view when employee GPS is disabled)
                if (!widget.isOwner && _locationOff)
                  Positioned(
                    top: 110,
                    left: 20,
                    right: 20,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEF2F2),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFFECACA), width: 1.5),
                        boxShadow: [
                          BoxShadow(color: Colors.red.withOpacity(0.1), blurRadius: 12, offset: const Offset(0, 4)),
                        ],
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.location_off_rounded, color: Color(0xFFDC2626), size: 22),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              '${widget.trip.employee}\'s location is currently off',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFDC2626),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Bottom Info Panel
                Positioned(
                  bottom: 40,
                  left: 20,
                  right: 20,
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 30, offset: const Offset(0, 15)),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(30)),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 8,
                                height: 8,
                                decoration: const BoxDecoration(color: Color(0xFFFF6B00), shape: BoxShape.circle),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'LIVE TRACKING',
                                style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w800, color: const Color(0xFFFF6B00)),
                              )
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          widget.trip.purpose,
                          style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A)),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Text('ORIGIN', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
                                Text(widget.trip.source, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
                              ]),
                            ),
                            const Icon(Icons.arrow_forward_rounded, color: Color(0xFFFF6B00)),
                            Expanded(
                              child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                Text('DESTINATION', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
                                Text(widget.trip.destination, style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)), textAlign: TextAlign.right),
                              ]),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // Back Button
                Positioned(
                  top: 50,
                  left: 20,
                  child: InkWell(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 10)],
                      ),
                      child: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
