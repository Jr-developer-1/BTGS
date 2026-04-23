import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';

class HistoryMapScreen extends StatefulWidget {
  final Trip trip;
  final String? employeeId;

  const HistoryMapScreen({super.key, required this.trip, this.employeeId});

  @override
  State<HistoryMapScreen> createState() => _HistoryMapScreenState();
}

class _HistoryMapScreenState extends State<HistoryMapScreen> {
  final MapController _mapController = MapController();
  final TripService _tripService = TripService();
  
  DateTime _selectedDate = DateTime.now();
  List<Map<String, dynamic>> _stops = [];
  List<LatLng> _routePoints = [];
  bool _isLoading = false;
  LatLng _initialCenter = const LatLng(17.3850, 78.4867);

  @override
  void initState() {
    super.initState();
    // Initially empty as requested
  }

  Future<void> _fetchHistory() async {
    setState(() => _isLoading = true);
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final data = await _tripService.fetchHistoricalStops(dateStr, employeeId: widget.employeeId ?? widget.trip.userId);
      
      setState(() {
        _stops = List<Map<String, dynamic>>.from(data['stops'] ?? []);
        final rawBreadcrumbs = List<Map<String, dynamic>>.from(data['breadcrumbs'] ?? []);
        
        _routePoints = rawBreadcrumbs.map((b) => LatLng(
          double.tryParse(b['latitude'].toString()) ?? 0.0,
          double.tryParse(b['longitude'].toString()) ?? 0.0,
        )).where((p) => p.latitude != 0.0).toList();

        _isLoading = false;
        
        if (_stops.isNotEmpty) {
          final first = _stops.first;
          _initialCenter = LatLng(
            double.tryParse(first['latitude'].toString()) ?? 0.0,
            double.tryParse(first['longitude'].toString()) ?? 0.0,
          );
          _mapController.move(_initialCenter, 13.0);
        } else if (_routePoints.isNotEmpty) {
          _initialCenter = _routePoints.first;
          _mapController.move(_initialCenter, 13.0);
        }
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error fetching history: $e')),
        );
      }
    }
  }

  Future<void> _selectDate(BuildContext context) async {
    // 7-day retention policy - restricted by the backend cleanup logic
    final DateTime retentionLimit = DateTime.now().subtract(const Duration(days: 7));
    
    // Default fallback values
    DateTime startDate = retentionLimit;
    DateTime endDate = DateTime.now();

    try {
      // 1. Try to parse Trip dates
      if (widget.trip.startDate.isNotEmpty) {
        DateTime parsedTripStart = DateTime.parse(widget.trip.startDate);
        // Calendar shows the intersection of Trip dates and the 7-day window
        if (parsedTripStart.isAfter(startDate)) {
          startDate = parsedTripStart;
        }
      }
      
      if (widget.trip.endDate.isNotEmpty) {
        DateTime parsedTripEnd = DateTime.parse(widget.trip.endDate);
        if (parsedTripEnd.isBefore(endDate)) {
          endDate = parsedTripEnd;
        }
      }
      
      // 2. Clamp current selection to valid bounds for the picker to avoid crash
      if (_selectedDate.isBefore(startDate)) {
        _selectedDate = startDate;
      }
      if (_selectedDate.isAfter(endDate)) {
        _selectedDate = endDate;
      }
    } catch (e) {
      debugPrint('Date parsing error: $e');
    }

    // Safety: firstDate must be <= lastDate
    if (startDate.isAfter(endDate)) {
      startDate = endDate;
    }

    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: startDate,
      lastDate: endDate,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFFFF6B00),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDate) {
      setState(() {
        _selectedDate = picked;
      });
      _fetchHistory();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 18),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Tracking History',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF0F172A),
          ),
        ),
        actions: [
          TextButton.icon(
            onPressed: () => _selectDate(context),
            icon: const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFFFF6B00)),
            label: Text(
              DateFormat('MMM dd, yyyy').format(_selectedDate),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: const Color(0xFFFF6B00),
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _initialCenter,
              initialZoom: 13.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.btgs.app',
              ),
              if (_routePoints.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(
                      points: _routePoints,
                      color: const Color(0xFFFF6B00),
                      strokeWidth: 5,
                      borderStrokeWidth: 2,
                      borderColor: Colors.white,
                    ),
                  ],
                ),
              MarkerLayer(
                markers: _stops.asMap().entries.map((entry) {
                  final stop = entry.value;
                  final index = entry.key;
                  final lat = double.tryParse(stop['latitude'].toString()) ?? 0.0;
                  final lng = double.tryParse(stop['longitude'].toString()) ?? 0.0;
                  
                  return Marker(
                    point: LatLng(lat, lng),
                    width: 40,
                    height: 40,
                    child: GestureDetector(
                      onTap: () {
                        _showStopDetails(stop);
                      },
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)],
                            ),
                            child: const Icon(Icons.location_on_rounded, color: Color(0xFFFF6B00), size: 24),
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],
          ),
          
          if (_isLoading)
            const Center(child: CircularProgressIndicator(color: Color(0xFFFF6B00))),
          
          if (_stops.isEmpty && !_isLoading)
            Center(
              child: Container(
                padding: const EdgeInsets.all(24),
                margin: const EdgeInsets.symmetric(horizontal: 40),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20)],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.map_outlined, size: 64, color: Color(0xFFCBD5E1)),
                    const SizedBox(height: 16),
                    Text(
                      'No History Found',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Select a date to view historical tracking data and business stops.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        color: const Color(0xFF64748B),
                        height: 1.5,
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => _selectDate(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFFF6B00),
                        foregroundColor: Colors.white,
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        'Select Date',
                        style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
            ),

          if (_stops.isNotEmpty)
            Positioned(
              bottom: 20,
              left: 20,
              right: 20,
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 24, offset: const Offset(0, 8))],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFF7ED),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Icon(Icons.history_rounded, color: Color(0xFFFF6B00), size: 20),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Day Trip Summary',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF94A3B8),
                                ),
                              ),
                              Text(
                                '${_stops.length} Business Stops Recorded',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _showStopDetails(Map<String, dynamic> stop) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.location_on_rounded, color: Color(0xFFFF6B00), size: 24),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stop['location_name'] ?? 'Business Stop',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                          ),
                        ),
                        Text(
                          'Spent ${stop['duration_minutes'] ?? 0} minutes here',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFFFF6B00),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              const Divider(color: Color(0xFFF1F5F9)),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _detailItem('ARRIVED', _formatTime(stop['arrival_time'])),
                  _detailItem('DEPARTED', _formatTime(stop['departure_time'])),
                  _detailItem('DURATION', '${stop['duration_minutes'] ?? 0} m'),
                ],
              ),
              const SizedBox(height: 24),
            ],
          ),
        );
      },
    );
  }

  Widget _detailItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  String _formatTime(dynamic timeStr) {
    if (timeStr == null) return 'N/A';
    try {
      final dateTime = DateTime.parse(timeStr.toString()).toLocal();
      return DateFormat('hh:mm a').format(dateTime);
    } catch (e) {
      return timeStr.toString();
    }
  }
}
