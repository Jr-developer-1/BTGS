import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import '../services/trip_service.dart';
import '../models/trip_model.dart';
import 'live_map_screen.dart';

class TeamTripDetailsScreen extends StatefulWidget {
  final String? tripId;
  const TeamTripDetailsScreen({super.key, this.tripId});

  @override
  State<TeamTripDetailsScreen> createState() => _TeamTripDetailsScreenState();
}

class _TeamTripDetailsScreenState extends State<TeamTripDetailsScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  List<Map<String, dynamic>> _teamLiveTrips = [];
  Timer? _refreshTimer;
  Map<String, String> _addresses = {};
  Map<String, String> _geofenceStatus = {};

  @override
  void initState() {
    super.initState();
    _fetchLiveTracking();
    // Auto-refresh every 30 seconds for live updates
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (mounted) _fetchLiveTracking();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchLiveTracking() async {
    if (!mounted) return;
    try {
      final trips = await _tripService.fetchTeamLiveTracking();
      if (mounted) {
        setState(() {
          _teamLiveTrips = trips;
          _isLoading = false;
        });
        
        // Background geocode addresses and calculate geofence status for better UX
        for (var trip in trips) {
          _geocodeTripLocation(trip);
          _checkGeofence(trip);
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error syncing live tracking: $e')),
        );
      }
    }
  }

  Future<void> _geocodeTripLocation(Map<String, dynamic> trip) async {
    final tripId = trip['trip_id'];
    if (_addresses.containsKey(tripId)) return; // Already geocoded

    final lat = trip['latitude'];
    final lng = trip['longitude'];
    
    if (lat != null && lng != null && lat != 0.0 && lng != 0.0) {
      try {
        final placemarks = await placemarkFromCoordinates(lat, lng)
            .timeout(const Duration(seconds: 5));
        if (mounted && placemarks.isNotEmpty) {
          final p = placemarks[0];
          setState(() {
            _addresses[tripId] = "${p.name}, ${p.subLocality}, ${p.locality}";
          });
        }
      } catch (e) {
        debugPrint('GEOCODING_ERROR for $tripId: $e');
      }
    }
  }

  Future<void> _checkGeofence(Map<String, dynamic> trip) async {
    final tripId = trip['trip_id'];
    if (_geofenceStatus.containsKey(tripId)) return;

    final lat = trip['latitude'] != null ? double.tryParse(trip['latitude'].toString()) : null;
    final lng = trip['longitude'] != null ? double.tryParse(trip['longitude'].toString()) : null;
    final destination = trip['destination'];
    
    if (lat != null && lng != null && destination != null) {
      try {
        final destLocations = await locationFromAddress(destination).timeout(const Duration(seconds: 5));
        if (destLocations.isNotEmpty && mounted) {
           final destLat = destLocations[0].latitude;
           final destLng = destLocations[0].longitude;
           
           final distance = Geolocator.distanceBetween(lat, lng, destLat, destLng);
           
           setState(() {
               if (distance <= 1000) { // Within 1km
                  _geofenceStatus[tripId] = 'ARRIVED (DEST)';
               } else if (distance >= 50000) { // Off by 50km
                  _geofenceStatus[tripId] = 'DEVIATED';
               } else {
                  _geofenceStatus[tripId] = 'ON ROUTE';
               }
           });
        }
      } catch (e) {
         debugPrint('GEOFENCE_CHECK_ERROR for $tripId: $e');
      }
    }
  }

  Future<void> _openGoogleMaps(double lat, double lng) async {
    final geoUrl = 'geo:$lat,$lng?q=$lat,$lng';
    final webUrl = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';

    try {
      debugPrint('LAUNCHING_MAPS: Trying geo scheme');
      await launchUrl(Uri.parse(geoUrl), mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('GEO_FAILED: $e. Falling back to web URL.');
      try {
        await launchUrl(Uri.parse(webUrl), mode: LaunchMode.externalApplication);
      } catch (e2) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Could not open map application')),
          );
        }
      }
    }
  }

  String _formatLastSeen(String? timestamp) {
    if (timestamp == null || timestamp.isEmpty) return "Unknown";
    try {
      final dt = DateTime.parse(timestamp).toLocal();
      return DateFormat('MMM dd, HH:mm').format(dt);
    } catch (e) {
      return "Online";
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F1E2A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Live Team Operations',
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
        actions: [
          if (_isLoading)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0),
              child: Center(
                child: SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                ),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.refresh_rounded, color: Colors.white),
              onPressed: () {
                setState(() => _isLoading = true);
                _fetchLiveTracking();
              },
            ),
        ],
      ),
      body: _isLoading && _teamLiveTrips.isEmpty
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFBB0633)))
          : _teamLiveTrips.isEmpty
              ? _buildEmptyState()
              : ListView.builder(
                  padding: const EdgeInsets.all(20),
                  itemCount: _teamLiveTrips.length,
                  itemBuilder: (context, index) => _buildTripCard(_teamLiveTrips[index]),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.map_outlined, size: 64, color: Colors.black.withOpacity(0.1)),
          const SizedBox(height: 16),
          Text(
            'No Active Team Trips Today',
            style: GoogleFonts.plusJakartaSans(
              color: const Color(0xFF0F1E2A),
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32.0),
            child: Text(
              'Only trips scheduled for today that belong to your direct reports will appear here.',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFF64748B),
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTripCard(Map<String, dynamic> trip) {
    final tripId = trip['trip_id'] ?? 'Unknown';
    final employeeName = trip['employee_name'] ?? 'Employee';
    final employeeId = trip['employee_id'] ?? '';
    final destination = trip['destination'] ?? 'Unknown';
    final purpose = trip['purpose'] ?? 'Business';
    final lat = trip['latitude'] != null ? double.tryParse(trip['latitude'].toString()) : null;
    final lng = trip['longitude'] != null ? double.tryParse(trip['longitude'].toString()) : null;
    final lastUpdated = trip['last_updated'];
    final isLocal = trip['consider_as_local'] == true;
    final isLoggedOut = trip['is_logged_out'] == true;
    final address = _addresses[tripId];

    final hasCoord = lat != null && lng != null && lat != 0 && lng != 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.5),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F1E2A).withOpacity(0.06),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: [
            // Top Badge for "Scheduled Today"
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 8),
              color: hasCoord ? const Color(0xFFF0FDF4) : const Color(0xFFFFF7ED),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.event_available_rounded,
                    size: 14,
                    color: hasCoord ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'SCHEDULED TODAY',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                      color: hasCoord ? const Color(0xFF16A34A) : const Color(0xFFEA580C),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: const Color(0xFFF1F5F9),
                        child: Text(
                          employeeName.isNotEmpty ? employeeName[0].toUpperCase() : 'U',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              employeeName,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              employeeId,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: isLoggedOut 
                              ? const Color(0xFFF3F4F6) 
                              : (hasCoord ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2)),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              isLoggedOut ? Icons.power_settings_new_rounded : Icons.circle,
                              size: isLoggedOut ? 12 : 8,
                              color: isLoggedOut 
                                  ? const Color(0xFF4B5563) 
                                  : (hasCoord ? Colors.green : Colors.red),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              isLoggedOut ? 'LOGGED OUT' : (hasCoord ? 'LIVE' : 'OFFLINE'),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                color: isLoggedOut 
                                    ? const Color(0xFF4B5563) 
                                    : (hasCoord ? const Color(0xFF15803D) : const Color(0xFFB91C1C)),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (hasCoord && _geofenceStatus.containsKey(tripId)) ...[
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: _geofenceStatus[tripId] == 'ARRIVED (DEST)' 
                                ? const Color(0xFFEFF6FF) 
                                : (_geofenceStatus[tripId] == 'DEVIATED' ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4)),
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                                color: _geofenceStatus[tripId] == 'ARRIVED (DEST)' 
                                    ? const Color(0xFFDBEAFE) 
                                    : (_geofenceStatus[tripId] == 'DEVIATED' ? const Color(0xFFFEE2E2) : const Color(0xFFDCFCE7))
                            ),
                          ),
                          child: Text(
                            _geofenceStatus[tripId]!,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: _geofenceStatus[tripId] == 'ARRIVED (DEST)' 
                                  ? const Color(0xFF1D4ED8) 
                                  : (_geofenceStatus[tripId] == 'DEVIATED' ? Colors.red : const Color(0xFF16A34A)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: isLocal ? const Color(0xFFE0F2FE) : const Color(0xFFF3E5F5),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                isLocal ? Icons.directions_car_rounded : Icons.flight_takeoff_rounded,
                                size: 16,
                                color: isLocal ? const Color(0xFF0369A1) : const Color(0xFF7B1FA2),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    isLocal ? 'Local Conveyance' : 'Outstation Trip',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                  Text(
                                    destination,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                tripId,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF475569),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 12),
                          child: Divider(height: 1),
                        ),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Icon(Icons.assignment_rounded, size: 14, color: Color(0xFF94A3B8)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Purpose of Travel',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF64748B),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    purpose,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFF1E293B),
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

          GestureDetector(
            onTap: hasCoord ? () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => LiveMapScreen(
                    trip: Trip(
                      id: tripId,
                      tripId: tripId,
                      userId: employeeId,
                      purpose: purpose,
                      destination: destination,
                      source: trip['source'] ?? trip['user_base_location'] ?? 'Origin',
                      dates: '',
                      startDate: '',
                      endDate: '',
                      status: 'Ongoing',
                      costEstimate: '0',
                      travelMode: '',
                      vehicleType: '',
                      employee: employeeName,
                      title: purpose,
                      members: [],
                      lifecycleEvents: [],
                    ),
                    isOwner: false, // Manager viewing subordinate → use backend polling, NOT manager's own GPS
                  ),
                ),
              );
            } : null,
            child: Container(
              height: 140,
              width: double.infinity,
              decoration: BoxDecoration(
                color: const Color(0xFF0F1E2A),
                borderRadius: const BorderRadius.only(
                  bottomLeft: Radius.circular(24),
                  bottomRight: Radius.circular(24),
                ),
                image: DecorationImage(
                  image: const NetworkImage(
                    'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1000&auto=format&fit=crop',
                  ),
                  fit: BoxFit.cover,
                  opacity: 0.3,
                  colorFilter: ColorFilter.mode(
                    const Color(0xFF0F1E2A).withOpacity(0.6),
                    BlendMode.darken,
                  ),
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      hasCoord ? Icons.gps_fixed_rounded : Icons.location_searching_rounded,
                      color: hasCoord ? Colors.greenAccent : Colors.white70,
                      size: 28,
                    ),
                    const SizedBox(height: 8),
                    if (hasCoord) ...[
                      Text(
                        'Last Live Sync: ${_formatLastSeen(lastUpdated)}',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (address != null)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
                          child: Text(
                            address,
                            textAlign: TextAlign.center,
                            style: GoogleFonts.plusJakartaSans(
                              color: Colors.greenAccent,
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      const SizedBox(height: 4),
                      Text(
                        isLoggedOut ? 'Last Known Location (Employee Logged Out)' : 'Tap to Open Live Tracker Hub',
                        style: GoogleFonts.plusJakartaSans(
                          color: isLoggedOut ? Colors.orange[200] : Colors.white60,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ] else
                      Text(
                        isLoggedOut ? 'Last Known Location Unavailable (Logged Out)' : 'Waiting for GPS signal...',
                        style: GoogleFonts.plusJakartaSans(
                          color: isLoggedOut ? Colors.orange[200] : Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      ),
    );
  }
}

