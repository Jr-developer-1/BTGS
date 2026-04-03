import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'trip_timeline_screen.dart';
import 'local_travel_timeline_screen.dart';
import 'travel_story_screen.dart';
import 'trip_story_screen.dart';
import 'trip_summary_screen.dart';

import 'trip_planner_screen.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import '../components/trip_wallet_sheet.dart';
import 'create_trip_screen.dart';
import 'local_travel_screen.dart';
import '../components/claim_sheet.dart';
import '../services/expense_reminder_service.dart';
import '../components/forensic_camera.dart';
import 'dart:io';
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:ui' as ui;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;

class MyTripsScreen extends StatefulWidget {
  const MyTripsScreen({super.key});

  @override
  State<MyTripsScreen> createState() => _MyTripsScreenState();
}

class _MyTripsScreenState extends State<MyTripsScreen> {
  final TripService _tripService = TripService();
  List<Trip> _allTrips = [];
  List<Trip> _visibleTrips = [];
  String _filter = 'All Status';
  String _typeFilter = 'All Types';
  String _searchTerm = '';
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchTrips();
  }

  Future<void> _fetchTrips() async {
    setState(() => _isLoading = true);
    try {
      final trips = await _tripService.fetchTrips(search: _searchTerm);
      if (_searchTerm.trim().isEmpty) {
        try {
          await ExpenseReminderService.syncTripExpenseReminders(trips);
        } catch (notifErr) {
          debugPrint('Notification sync failed (non-critical): $notifErr');
        }
      }
      setState(() {
        _allTrips = trips;
        _applyFilters();
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to load trips: $e')));
      }
    }
  }

  String _formatCurrency(dynamic amount) {
    if (amount == null) return '₹0';
    double? numAmount;
    if (amount is num) {
      numAmount = amount.toDouble();
    } else if (amount is String) {
      // Remove any existing currency symbols or commas before parsing
      final cleanString = amount.replaceAll(RegExp(r'[^\d.]'), '');
      numAmount = double.tryParse(cleanString);
    }

    if (numAmount == null) return '₹$amount';

    final formatter = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹',
      decimalDigits: 0,
    );
    return formatter.format(numAmount);
  }

  void _applyFilters() {
    final term = _searchTerm.toLowerCase().trim();
    setState(() {
      _visibleTrips = _allTrips.where((t) {
        // Normalize status strings for comparison
        final rawStatus = t.status.trim().toLowerCase();
        final status = rawStatus.replaceAll(' ', '').replaceAll('-', '');

        // PERMANENT EXCLUSION of pre-approval/pending states as per user request
        final List<String> hideStates = [
          'pending',
          'submitted',
          'forwarded',
          'draft',
          'underprocess',
          'inprogress',
          'ongoing',
        ];
        bool isHidden =
            hideStates.contains(status) || status.contains('pending');

        if (isHidden) return false;

        final filterLabel = _filter.trim().toLowerCase();
        final filterClean = filterLabel.replaceAll(' ', '').replaceAll('-', '');

        bool matchesFilter = _filter == 'All Status' || _filter == 'All';

        if (!matchesFilter) {
          // Robust matching: exact cleaned match OR the raw status contains the filter string
          matchesFilter =
              (status == filterClean) || rawStatus.contains(filterClean);
        }

        bool matchesType = _typeFilter == 'All Types' || _typeFilter == 'All';
        if (!matchesType) {
          if (_typeFilter == 'Trip' && !t.considerAsLocal) matchesType = true;
          if (_typeFilter == 'Travel' && t.considerAsLocal) matchesType = true;
        }

        final matchesSearch =
            term.isEmpty ||
            t.purpose.toLowerCase().contains(term) ||
            t.id.toLowerCase().contains(term) ||
            t.destination.toLowerCase().contains(term);

        return matchesFilter && matchesSearch && matchesType;
      }).toList();
    });
  }

  void _onSearchChanged(String v) {
    _searchTerm = v;
    _fetchTrips();
  }

  void _onFilterChanged(String? v) {
    if (v == null) return;
    setState(() {
      _filter = v;
      _applyFilters();
    });
  }

  Future<File?> _processOdometerImage(File imageFile, Position position) async {
    try {
      final String currentTime = DateFormat(
        'yyyy-MM-dd HH:mm',
      ).format(DateTime.now());
      final String gpsLocation =
          "Lat: ${position.latitude.toStringAsFixed(4)}, Long: ${position.longitude.toStringAsFixed(4)}";

      final bytes = await imageFile.readAsBytes();
      final ui.Codec codec = await ui.instantiateImageCodec(bytes);
      final ui.FrameInfo frame = await codec.getNextFrame();
      final ui.Image image = frame.image;
      final recorder = ui.PictureRecorder();
      final canvas = Canvas(recorder);
      final paint = Paint();

      canvas.drawImage(image, Offset.zero, paint);
      final rectPaint = Paint()..color = Colors.black.withOpacity(0.5);
      canvas.drawRect(
        Rect.fromLTWH(
          0,
          image.height.toDouble() - 180,
          image.width.toDouble(),
          180,
        ),
        rectPaint,
      );

      final textStyle = TextStyle(
        color: Colors.white,
        fontSize: (image.width / 30).clamp(24, 80),
        fontWeight: FontWeight.bold,
      );
      final textPainterLoc = TextPainter(
        text: TextSpan(text: 'Location: $gpsLocation', style: textStyle),
        textDirection: ui.TextDirection.ltr,
      );
      textPainterLoc.layout();
      textPainterLoc.paint(canvas, Offset(40, image.height.toDouble() - 140));

      final textPainterTime = TextPainter(
        text: TextSpan(text: 'Time: $currentTime', style: textStyle),
        textDirection: ui.TextDirection.ltr,
      );
      textPainterTime.layout();
      textPainterTime.paint(canvas, Offset(40, image.height.toDouble() - 70));

      final picture = recorder.endRecording();
      final img = await picture.toImage(image.width, image.height);
      final data = await img.toByteData(format: ui.ImageByteFormat.png);

      if (data != null) {
        final directory = await getTemporaryDirectory();
        final String filePath = p.join(
          directory.path,
          'watermarked_odo_${DateTime.now().millisecondsSinceEpoch}.png',
        );
        final File watermarkedFile = File(filePath)
          ..writeAsBytesSync(data.buffer.asUint8List());
        return watermarkedFile;
      }
    } catch (e) {
      debugPrint('Error processing image: $e');
    }
    return null;
  }

  Future<Position?> _determinePosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    return await Geolocator.getCurrentPosition();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // Executive Mesh Blobs (Ultra-soft atmospheric layers)
          Positioned(
            top: 200,
            right: -100,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFA9052E).withOpacity(0.03),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: 100,
            left: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF3B82F6).withOpacity(0.02),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),

          Column(
            children: [
              _buildCustomHeader(),
              _buildToolbar(),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFFBB0633),
                        ),
                      )
                    : _visibleTrips.isEmpty
                    ? _buildEmptyState()
                    : ListView.builder(
                        padding: const EdgeInsets.fromLTRB(20, 10, 20, 100),
                        itemCount: _visibleTrips.length,
                        itemBuilder: (context, index) =>
                            _buildTripCard(_visibleTrips[index]),
                      ),
              ),
            ],
          ),

          // FAB positioned manually if needed, or use Scaffold's
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          showModalBottomSheet(
            context: context,
            backgroundColor: Colors.transparent,
            builder: (context) => Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(32),
                  topRight: Radius.circular(32),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'INITIATE NEW REQUEST',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF64748B),
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 32),
                  _buildRequestOption(
                    icon: Icons.flight_takeoff_rounded,
                    title: 'New Trip Request',
                    subtitle: 'Long distance travel with multiple stops',
                    color: const Color(0xFFA9052E),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const CreateTripScreen(),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 16),
                  _buildRequestOption(
                    icon: Icons.local_taxi_rounded,
                    title: 'New Travel Request',
                    subtitle: 'Monthly local conveyance and site visits',
                    color: const Color(0xFF0F1E2A),
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => LocalTravelScreen(onUploadComplete: _fetchTrips),
                        ),
                      );
                    },
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
          );
        },
        backgroundColor: const Color(0xFF0F1E2A),
        elevation: 12,
        highlightElevation: 4,
        icon: const Icon(Icons.add_rounded, color: Colors.white, size: 24),
        label: Text(
          'NEW REQUEST',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            color: Colors.white,
            fontSize: 13,
            letterSpacing: 0.5,
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      ),
    );
  }

  Widget _buildCustomHeader() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFA9052E),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -20,
            top: -20,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            left: -30,
            bottom: -30,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 15, 25, 30),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.12),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.airplane_ticket_rounded,
                      color: Color(0xFFBB0633),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'MY JOURNEYS',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.white.withOpacity(0.7),
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'Trip Directory',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildToolbar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFF1F5F9)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: TextField(
                    onChanged: _onSearchChanged,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                    ),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(
                        Icons.search_rounded,
                        size: 22,
                        color: Color(0xFFBB0633),
                      ),
                      hintText: 'Search destinations, IDs...',
                      hintStyle: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(vertical: 20),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Container(
                height: 60,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFF1F5F9)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _typeFilter,
                    icon: const Icon(
                      Icons.filter_list_rounded,
                      color: Color(0xFFBB0633),
                      size: 20,
                    ),
                    style: GoogleFonts.plusJakartaSans(
                      color: const Color(0xFF0F172A),
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                    ),
                    items: ['All Types', 'Trip', 'Travel']
                        .map(
                          (v) => DropdownMenuItem(
                            value: v,
                            child: Text(v.toUpperCase()),
                          ),
                        )
                        .toList(),
                    onChanged: (v) {
                      if (v != null)
                        setState(() {
                          _typeFilter = v;
                          _applyFilters();
                        });
                    },
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFF1F5F9)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.03),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _filter,
                isExpanded: true,
                icon: const Icon(
                  Icons.keyboard_arrow_down_rounded,
                  color: Color(0xFFBB0633),
                  size: 20,
                ),
                style: GoogleFonts.plusJakartaSans(
                  color: const Color(0xFF0F172A),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
                items: [
                  'All Status',
                  'Approved',
                  'On-Going',
                  'Completed',
                  'Settled',
                  'Cancelled',
                  'Rejected',
                ]
                    .map(
                      (v) => DropdownMenuItem(
                        value: v,
                        child: Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              margin: const EdgeInsets.only(right: 10),
                              decoration: BoxDecoration(
                                color: v == 'All Status'
                                    ? Colors.grey.shade300
                                    : _getStatusColor(v),
                                shape: BoxShape.circle,
                              ),
                            ),
                            Text(v),
                          ],
                        ),
                      ),
                    )
                    .toList(),
                onChanged: _onFilterChanged,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.airplane_ticket_rounded,
            size: 80,
            color: Colors.grey.shade200,
          ),
          const SizedBox(height: 16),
          Text(
            'No Trips Found',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'You haven\'t created any trips yet.',
            style: GoogleFonts.plusJakartaSans(
              color: Colors.black38,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRequestOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFF1F5F9)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(icon, color: color, size: 28),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF0F1E2A),
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.arrow_forward_ios_rounded,
                size: 14,
                color: Colors.grey.withOpacity(0.5),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _summaryTile(
    String label,
    String value, {
    bool badge = false,
    bool isBudget = false,
    IconData? icon,
  }) {
    String displayValue = value.trim();
    // Improved double symbol check: handle both literal and variant characters
    bool hasCurrency =
        displayValue.contains('₹') ||
        displayValue.contains('Rs') ||
        displayValue.contains('\u20B9');

    if (isBudget && !hasCurrency) {
      displayValue = '₹$displayValue';
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              if (icon != null) ...[
                Icon(icon, size: 12, color: Colors.black26),
                const SizedBox(width: 4),
              ],
              Text(
                label.toUpperCase(),
                style: GoogleFonts.inter(
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                  color: Colors.black26,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          if (badge)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: _getStatusColor(displayValue).withOpacity(0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                displayValue,
                style: GoogleFonts.inter(
                  color: _getStatusColor(displayValue),
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                ),
              ),
            )
          else
            Text(
              displayValue,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: isBudget
                    ? const Color(0xFFBB0633)
                    : const Color(0xFF0F172A),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
        ],
      ),
    );
  }

  Widget _buildTripCard(Trip t) {
    final statusColor = _getStatusColor(t.status);
    final bool canShowStory =
        t.status.toLowerCase() != 'draft' &&
        t.status.toLowerCase() != 'cancelled';

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(28),
        child: InkWell(
          onTap: t.status.toLowerCase() == 'settled'
              ? null
              : () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => TripSummaryScreen(trip: t)),
                ),
          borderRadius: BorderRadius.circular(28),
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Top Bar with decorative status indicator
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 8),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  color: statusColor,
                                  shape: BoxShape.circle,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                t.status.toUpperCase(),
                                style: GoogleFonts.plusJakartaSans(
                                  color: statusColor,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.0,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          t.id,
                          style: GoogleFonts.plusJakartaSans(
                            color: const Color(0xFF94A3B8),
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Body
                  Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          t.purpose,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF0F1E2A),
                            letterSpacing: -0.3,
                            height: 1.2,
                          ),
                        ),
                        const SizedBox(height: 16),
                        if (!t.considerAsLocal) ...[
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: const Color(0xFFF1F5F9),
                              ),
                            ),
                            child: Column(
                              children: [
                                Row(
                                  children: [
                                    _cardDetailIcon(
                                      Icons.person_outline_rounded,
                                      const Color(0xFF8B5CF6),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        t.employee,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF475569),
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 10),
                                  child: Divider(height: 1, color: Color(0xFFE2E8F0)),
                                ),
                                Row(
                                  children: [
                                    _cardDetailIcon(
                                      Icons.location_on_rounded,
                                      const Color(0xFFBB0633),
                                    ),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Text(
                                        '${t.source} → ${t.destination}',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF475569),
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                                const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 12),
                                  child: Divider(
                                    height: 1,
                                    color: Color(0xFFE2E8F0),
                                  ),
                                ),
                                Row(
                                  children: [
                                    _cardDetailIcon(
                                      Icons.calendar_month_rounded,
                                      const Color(0xFF3B82F6),
                                    ),
                                    const SizedBox(width: 12),
                                    Text(
                                      t.dates,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: const Color(0xFF475569),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                        ] else ...[
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: const Color(0xFFF1F5F9)),
                            ),
                            child: Row(
                              children: [
                                _cardDetailIcon(Icons.calendar_month_rounded, const Color(0xFF3B82F6)),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    t.dates,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF475569),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],
                        Row(
                          children: [
                            if (!t.considerAsLocal) ...[
                              Expanded(
                                child: _actionBtn(
                                  'DETAILS',
                                  Icons.east_rounded,
                                  const Color(0xFF0F1E2A),
                                  Colors.white,
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          TripSummaryScreen(trip: t),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: _actionBtn(
                                  'TIMELINE',
                                  Icons.history_rounded,
                                  const Color(0xFFF1F5F9),
                                  const Color(0xFF475569),
                                  () => Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => t.considerAsLocal
                                          ? LocalTravelTimelineScreen(tripId: t.id)
                                          : TripTimelineScreen(tripId: t.id),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Expanded(
                              child: _actionBtn(
                                t.considerAsLocal ? 'TRAVEL GRID' : 'TRIP GRID',
                                Icons.auto_awesome_rounded,
                                const Color(0xFFFDF2F4),
                                const Color(0xFFBB0633),
                                () => Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => t.considerAsLocal
                                        ? TravelStoryScreen(tripId: t.id)
                                        : TripStoryScreen(tripId: t.id),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              if (t.status.toLowerCase() == 'settled')
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(28),
                    ),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F1E2A),
                          borderRadius: BorderRadius.circular(20),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.2),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.check_circle_rounded,
                              color: Colors.white,
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'SETTLED',
                              style: GoogleFonts.plusJakartaSans(
                                color: Colors.white,
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.0,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _cardDetailIcon(IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Icon(icon, size: 14, color: color),
    );
  }

  Widget _actionBtn(
    String label,
    IconData icon,
    Color bg,
    Color text,
    VoidCallback onTap,
  ) {
    // Determine if it's a secondary button to apply a subtle border
    final bool isPrimary = bg == const Color(0xFF0F1E2A);

    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(100),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(100),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(100),
            border: isPrimary
                ? null
                : Border.all(color: text.withOpacity(0.12), width: 1.2),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 16, color: text),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: text,
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _modalActionButton(String label, IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: const Color(0xFFBB0633)),
            const SizedBox(width: 8),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF0F172A),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _cardActionButton({
    required String label,
    required IconData icon,
    required VoidCallback onPressed,
    bool isSecondary = false,
    Color? textColor,
  }) {
    return SizedBox(
      width: double.infinity,
      child: TextButton(
        onPressed: onPressed,
        style: TextButton.styleFrom(
          backgroundColor: Colors.white,
          side: const BorderSide(color: Color(0xFFF1F5F9)),
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: textColor ?? const Color(0xFF0F172A),
              ),
            ),
            Icon(icon, size: 18, color: textColor ?? const Color(0xFF0F172A)),
          ],
        ),
      ),
    );
  }

  PopupMenuItem<String> _menuItem(String value, IconData icon) {
    return PopupMenuItem(
      value: value,
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF64748B)),
          const SizedBox(width: 12),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontWeight: FontWeight.w700,
              fontSize: 13,
              color: const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status.toLowerCase()) {
      case 'approved':
        return const Color(0xFF10B981);
      case 'completed':
        return const Color(0xFF3B82F6);
      case 'on-going':
      case 'ongoing':
        return const Color(0xFFF59E0B);
      case 'cancelled':
        return const Color(0xFFEF4444);
      case 'pending':
        return const Color(0xFF6366F1);
      default:
        return const Color(0xFF64748B);
    }
  }
}
