import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';

class TripDetailsScreen extends StatefulWidget {
  final String tripId;
  const TripDetailsScreen({super.key, required this.tripId});

  @override
  State<TripDetailsScreen> createState() => _TripDetailsScreenState();
}

class _TripDetailsScreenState extends State<TripDetailsScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  Trip? _trip;
  List<Map<String, dynamic>> _lifecycleSteps = [];

  @override
  void initState() {
    super.initState();
    _fetchTripDetails();
  }

  Future<void> _fetchTripDetails() async {
    setState(() => _isLoading = true);
    try {
      final trip = await _tripService.fetchTripDetails(widget.tripId);
      _trip = trip;
      _buildLifecycle();
      setState(() => _isLoading = false);
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  void _buildLifecycle() {
    if (_trip == null) return;

    final recordedEvents = _trip!.lifecycleEvents;
    final standardSteps = [
      {'title': 'Trip Requested', 'required': true},
      {'title': 'Level 1 Approval', 'required': true},
      {'title': 'Level 2 Approval', 'required': false},
      {'title': 'Level 3 Approval', 'required': false},
      {'title': 'Ticket Booking', 'required': true},
      {'title': 'Journey Started', 'required': true},
      {'title': 'Journey Ended', 'required': true},
      {'title': 'Settlement', 'required': true},
    ];

    bool sequenceBroken = false;
    _lifecycleSteps = [];

    for (var s in standardSteps) {
      final title = s['title'] as String;
      final matchingEvent = recordedEvents.firstWhere(
        (e) => e['title'] == title,
        orElse: () => null,
      );

      if (matchingEvent != null &&
          matchingEvent['status'] == 'completed' &&
          !sequenceBroken) {
        _lifecycleSteps.add({
          'title': title,
          'status': 'completed',
          'date': matchingEvent['date'] ?? 'Completed',
          'description': matchingEvent['description'] ?? title,
          'icon': Icons.check_circle_rounded,
        });
        continue;
      }

      if (matchingEvent != null &&
          matchingEvent['status'] == 'in-progress' &&
          !sequenceBroken) {
        sequenceBroken = true;
        _lifecycleSteps.add({
          'title': title,
          'status': 'current',
          'date': matchingEvent['date'] ?? 'In Progress',
          'description': matchingEvent['description'] ?? title,
          'icon': Icons.priority_high_rounded,
        });
        continue;
      }

      if (!sequenceBroken && s['required'] == true) {
        sequenceBroken = true;
        String desc = 'Pending action.';
        if (title == 'Journey Started')
          desc = 'Ready to start. Please record start odometer.';
        else if (title == 'Journey Ended')
          desc = 'Journey in progress. Please record end odometer to finish.';
        else if (title == 'Settlement')
          desc = 'Trip completed. Please submit expenses and settlement.';
        else if (title == 'Ticket Booking')
          desc = 'Waiting for ticket details.';
        else if (title == 'Level 1 Approval')
          desc = 'Awaiting manager approval.';
        else if (title == 'Level 2 Approval')
          desc = 'Awaiting Senior Manager (L2) approval.';
        else if (title == 'Level 3 Approval')
          desc = 'Awaiting Director (L3) approval.';

        _lifecycleSteps.add({
          'title': title,
          'status': 'current',
          'date': 'Action Required',
          'description': desc,
          'icon': Icons.priority_high_rounded,
        });
        continue;
      }

      _lifecycleSteps.add({
        'title': title,
        'status': 'pending',
        'date': sequenceBroken
            ? 'Waiting...'
            : (s['required'] == false ? 'Optional' : 'Waiting...'),
        'description': sequenceBroken
            ? 'Awaiting completion of previous steps.'
            : (s['required'] == false ? 'Optional step.' : 'Awaiting start.'),
        'icon': Icons.radio_button_unchecked_rounded,
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6), // Dashboard light gray
      body: Stack(
        children: [
          // Ultra-soft mesh blobs
          Positioned(
            top: -150,
            right: -100,
            child: Container(
              width: 500,
              height: 500,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFA9052E).withOpacity(0.04),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: 50,
            left: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF3B82F6).withOpacity(0.03),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),

          _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xFFBB0633)),
                )
              : _trip == null
              ? const Center(child: Text('Trip not found'))
              : Column(
                  children: [
                    _buildCustomHeader(),
                    Expanded(
                      child: SingleChildScrollView(
                        physics: const BouncingScrollPhysics(),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const SizedBox(height: 24),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20,
                              ),
                              child: Column(
                                children: [
                                  _buildOverviewCard(),
                                  const SizedBox(height: 24),
                                  _buildTimeline(),
                                  _buildActivitiesSection(),
                                  if (_trip!.odometer != null) ...[
                                    const SizedBox(height: 24),
                                    _buildTelemetryCard(),
                                  ],
                                  const SizedBox(height: 24),
                                  _buildHelpCard(),
                                  const SizedBox(height: 60),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
        ],
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
        children: [
          Positioned(
            right: -50,
            top: -50,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 15, 25, 30),
              child: Column(
                children: [
                  Row(
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
                      // Brand Identity (Matching Dashboard)
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: const Icon(
                          Icons.public_rounded,
                          color: Color(0xFFBB0633),
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'GOVERNANCE HUB',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: Colors.white.withOpacity(0.7),
                                letterSpacing: 1.2,
                              ),
                            ),
                            Text(
                              'Journey Trace',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: -0.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      _buildStatusPill(_trip?.status ?? ''),
                    ],
                  ),
                  if (_trip != null) ...[
                    const SizedBox(height: 25),
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(24),
                        border: Border.all(
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.pin_drop_rounded,
                              color: Color(0xFFBB0633),
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _trip!.id,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white70,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  _trip!.purpose,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill(String status) {
    Color color;
    switch (status.toLowerCase()) {
      case 'approved':
        color = const Color(0xFF10B981);
        break;
      case 'completed':
        color = const Color(0xFF3B82F6);
        break;
      case 'on-going':
        color = const Color(0xFFF59E0B);
        break;
      case 'rejected':
        color = const Color(0xFFEF4444);
        break;
      default:
        color = Colors.white70;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.15),
        borderRadius: BorderRadius.circular(100),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Text(
        status.toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontWeight: FontWeight.w900,
          color: Colors.white,
          fontSize: 9,
          letterSpacing: 1.0,
        ),
      ),
    );
  }

  Widget _buildTimeline() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFBB0633).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.timeline_rounded,
                  color: Color(0xFFBB0633),
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Text(
                'Journey Timeline',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0F1E2A),
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 32),
          ...List.generate(_lifecycleSteps.length, (idx) => _timelineNode(idx)),
        ],
      ),
    );
  }

  Widget _timelineNode(int idx) {
    final step = _lifecycleSteps[idx];
    final isLast = idx == _lifecycleSteps.length - 1;
    final status = step['status'];

    Color nodeColor;
    IconData nodeIcon = status == 'completed'
        ? Icons.check_circle_rounded
        : (status == 'current'
              ? Icons.access_time_filled_rounded
              : Icons.radio_button_unchecked_rounded);

    if (status == 'completed')
      nodeColor = const Color(0xFF10B981);
    else if (status == 'current')
      nodeColor = const Color(0xFFBB0633);
    else
      nodeColor = const Color(0xFFE2E8F0);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: status == 'current'
                      ? nodeColor
                      : (status == 'completed'
                            ? const Color(0xFFECFDF5)
                            : const Color(0xFFF8FAFC)),
                  borderRadius: BorderRadius.circular(14),
                  boxShadow: status == 'current'
                      ? [
                          BoxShadow(
                            color: nodeColor.withOpacity(0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ]
                      : null,
                ),
                child: Center(
                  child: Icon(
                    nodeIcon,
                    color: status == 'current'
                        ? Colors.white
                        : (status == 'completed'
                              ? const Color(0xFF10B981)
                              : Colors.black12),
                    size: 20,
                  ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2.5,
                    color: status == 'completed'
                        ? const Color(0xFFD1FAE5)
                        : const Color(0xFFF1F5F9),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 30),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          step['title'],
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                            color: status == 'current'
                                ? nodeColor
                                : (status == 'completed'
                                      ? const Color(0xFF1E293B)
                                      : const Color(0xFF64748B)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      _buildNodeStatusTag(status),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(
                        Icons.calendar_today_rounded,
                        size: 10,
                        color: Colors.black26,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        step['date'],
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.black38,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    step['description'],
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      color: Colors.black54,
                      fontWeight: FontWeight.w500,
                      height: 1.4,
                    ),
                  ),
                  if (status == 'current') ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFFAFA),
                        border: Border.all(color: const Color(0xFFFFEAEA)),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.01),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                      child: Column(
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(top: 2),
                                child: Icon(
                                  Icons.flight_takeoff_rounded,
                                  size: 20,
                                  color: Color(0xFF7C1D1D),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Text(
                                  'This is your current stage. Please complete the necessary steps to proceed.',
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF7C1D1D),
                                    height: 1.5,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton(
                              onPressed: () => Navigator.pop(context),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFFBB0633),
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              child: Text(
                                'Go to Actions',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 13,
                                  color: Colors.white,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNodeStatusTag(String status) {
    String label = status.toUpperCase();
    if (status == 'current') label = 'ACTION REQUIRED';

    Color color;
    Color bg;
    if (status == 'completed') {
      color = Colors.green.shade600;
      bg = Colors.green.shade50;
    } else if (status == 'current') {
      color = const Color(0xFF7C1D1D);
      bg = const Color(0xFFFEF2F2);
    } else {
      color = Colors.black26;
      bg = const Color(0xFFF1F5F9);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 8,
          fontWeight: FontWeight.w900,
          color: color,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildOverviewCard() {
    return _infoCard('Trip Overview', [
      _infoRow(
        Icons.map_rounded,
        'Route',
        '${_trip!.source} → ${_trip!.destination}',
        iconColor: Colors.orange,
      ),
      _infoRow(
        Icons.work_rounded,
        'Travel Mode',
        _trip!.travelMode,
        iconColor: Colors.blue,
      ),
      _infoRow(
        Icons.trending_up_rounded,
        'Estimated Cost',
        '₹${_trip!.costEstimate}',
        iconColor: Colors.purple,
      ),
      _infoRow(
        Icons.shield_rounded,
        'Reporting Manager',
        _trip!.reportingManagerName ?? 'Assigned',
        iconColor: Colors.green,
      ),
    ]);
  }

  Widget _buildTelemetryCard() {
    return _infoCard(
      'Odometer Telemetry',
      [
        _infoRow(
          Icons.speed_rounded,
          'Start Reading',
          '${_trip!.odometer!['start_odo_reading']} KM',
        ),
        _infoRow(
          Icons.flag_rounded,
          'End Reading',
          '${_trip!.odometer!['end_odo_reading'] ?? 'In Progress'}',
        ),
        if (_trip!.odometer!['end_odo_reading'] != null) ...[
          _infoRow(
            Icons.route_rounded,
            'Total Distance',
            '${(double.tryParse(_trip!.odometer!['end_odo_reading'].toString()) ?? 0) - (double.tryParse(_trip!.odometer!['start_odo_reading'].toString()) ?? 0)} KM',
            highlight: true,
          ),
        ],
      ],
      bgColor: const Color(0xFFFFFAFA),
      borderColor: const Color(0xFFFFEAEA),
      titleIcon: Icons.speed_rounded,
    );
  }

  Widget _buildHelpCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(28),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.help_outline_rounded,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 10),
              Text(
                'Need Help?',
                style: GoogleFonts.interTight(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'If you\'re stuck at any stage, please contact your travel desk or reporting manager.',
            style: GoogleFonts.inter(
              color: Colors.white70,
              fontSize: 13,
              height: 1.5,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActivitiesSection() {
    if (_trip?.activityBatches == null || _trip!.activityBatches!.isEmpty)
      return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFBB0633).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.receipt_long_rounded,
                  color: Color(0xFFBB0633),
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Text(
                'Tour Plan Activities',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0F1E2A),
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        ...(_trip!.activityBatches!.map((batch) {
          final rows = (batch['data_json'] as List?) ?? [];
          final filteredRows = rows.where((r) {
            final dateStr = r['date']?.toString() ?? '';
            return !dateStr.toLowerCase().contains('instruc');
          }).toList();

          return Container(
            margin: const EdgeInsets.only(bottom: 16),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withOpacity(0.04),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Text(
                        batch['file_name'] ?? 'Monthly Activity List',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF0F172A),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${filteredRows.length} ENTRIES',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                ...filteredRows.take(8).map((r) => _buildMiniActivityRow(r)),
                if (filteredRows.length > 8) ...[
                  const SizedBox(height: 12),
                  Center(
                    child: Text(
                      '+ ${filteredRows.length - 8} more activities',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          );
        })),
      ],
    );
  }

  Widget _buildMiniActivityRow(dynamic r) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 6,
            height: 6,
            decoration: const BoxDecoration(
              color: Color(0xFFBB0633),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  r['date']?.toString() ?? '',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
                Text(
                  "${r['origin_route']} → ${r['destination_route']}",
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF475569),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _infoCard(
    String title,
    List<Widget> children, {
    Color? bgColor,
    Color? borderColor,
    IconData? titleIcon,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: bgColor ?? Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: borderColor ?? const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (titleIcon != null) ...[
                Icon(titleIcon, size: 18, color: const Color(0xFF0F172A)),
                const SizedBox(width: 10),
              ],
              Text(
                title,
                style: GoogleFonts.interTight(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  Widget _infoRow(
    IconData icon,
    String label,
    String value, {
    bool highlight = false,
    Color? iconColor,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: highlight
                  ? const Color(0xFFFEF2F2)
                  : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(
              icon,
              size: 16,
              color: highlight
                  ? const Color(0xFF7C1D1D)
                  : (iconColor ?? Colors.black26),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Colors.black26,
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  value,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: highlight ? FontWeight.w900 : FontWeight.w700,
                    color: highlight
                        ? const Color(0xFF7C1D1D)
                        : const Color(0xFF0F172A),
                  ),
                ),
              ],
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
        return const Color(0xFFF59E0B);
      case 'cancelled':
      case 'rejected':
        return const Color(0xFFEF4444);
      default:
        return const Color(0xFF64748B);
    }
  }
}
