import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/trip_service.dart';
import '../models/trip_model.dart';
import 'package:intl/intl.dart';
import 'live_map_screen.dart';

class MyTrackingScreen extends StatefulWidget {
  const MyTrackingScreen({super.key});

  @override
  State<MyTrackingScreen> createState() => _MyTrackingScreenState();
}

class _MyTrackingScreenState extends State<MyTrackingScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  Trip? _currentActiveTrip;

  @override
  void initState() {
    super.initState();
    _fetchMyActiveTrip();
  }

  Future<void> _fetchMyActiveTrip() async {
    setState(() => _isLoading = true);
    try {
      final allTrips = await _tripService.fetchTrips();
      final now = DateTime.now();

      Trip? activeMatch;
      for (var t in allTrips) {
        final rawStatus = t.status.trim().toLowerCase();
        final status = rawStatus.replaceAll(' ', '').replaceAll('-', '');

        if (status == 'ongoing' ||
            status == 'inprogress' ||
            status == 'started') {
          activeMatch = t;
          break;
        }

        if (status == 'approved') {
          try {
            DateTime parseDate(String dateStr) {
              try {
                return DateTime.parse(dateStr);
              } catch (_) {
                return DateFormat('MMM dd, yyyy').parse(dateStr);
              }
            }

            final startDate = parseDate(t.startDate);
            final endDate = parseDate(t.endDate).add(const Duration(days: 1));

            if (now.isAfter(startDate) && now.isBefore(endDate)) {
              activeMatch = t;
              break;
            }
          } catch (e) {
            debugPrint('DATE_PARSE_ERROR: ${t.tripId} - $e');
          }
        }
      }

      setState(() {
        _currentActiveTrip = activeMatch;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F1E2A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Colors.white,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'My Tracking Status',
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
        actions: [
          if (!_isLoading && _currentActiveTrip != null)
            IconButton(
              icon: const Icon(Icons.map_rounded, color: Colors.greenAccent),
              tooltip: 'Live Map Tracking',
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => LiveMapScreen(trip: _currentActiveTrip!),
                  ),
                );
              },
            ),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFBB0633)),
            )
          : _currentActiveTrip == null
          ? _buildNoActiveTrip()
          : _buildActiveTrackingView(_currentActiveTrip!),
    );
  }

  Widget _buildNoActiveTrip() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.blue.withOpacity(0.05),
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.gps_off_rounded,
                size: 80,
                color: Colors.blue.shade200,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'No Active Tracking',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'You don\'t have an approved trip active for today. Tracking only starts automatically on your trip dates.',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: const Color(0xFF64748B),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveTrackingView(Trip trip) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDF4),
                        borderRadius: BorderRadius.circular(100),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.circle,
                            size: 8,
                            color: Colors.green,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            'LIVE TRACKING ACTIVE',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF15803D),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Text(
                  trip.purpose,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                Text(
                  'Trip ID: ${trip.tripId}',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    color: const Color(0xFF64748B),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 32),
                Row(
                  children: [
                    _locationCol(trip.source, 'SOURCE'),
                    const Icon(
                      Icons.east_rounded,
                      color: Colors.grey,
                      size: 20,
                    ),
                    _locationCol(trip.destination, 'DESTINATION'),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          _buildInfoTile(
            Icons.security_rounded,
            'Privacy Protected',
            'Your location is only shared during trip hours as per company policy.',
            Colors.indigo,
          ),
          const SizedBox(height: 16),
          _buildInfoTile(
            Icons.battery_saver_rounded,
            'Battery Optimized',
            'Tracking uses low-power GPS synchronization to save your battery.',
            Colors.teal,
          ),
        ],
      ),
    );
  }

  Widget _locationCol(String name, String label) {
    return Expanded(
      child: Column(
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: Colors.blueGrey.shade300,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            name,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF0F172A),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildInfoTile(IconData icon, String title, String desc, Color color) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  desc,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF64748B),
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
