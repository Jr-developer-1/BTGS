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
      backgroundColor: const Color(0xFFF0FDFA),
      body: Stack(
        children: [
          // Background Mesh Blobs (Dashboard Style)
          Positioned(
            top: -150,
            right: -100,
            child: Container(
              width: 500,
              height: 500,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF0D9488).withOpacity(0.04),
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
                    const Color(0xFF2DD4BF).withOpacity(0.04),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),

          _isLoading
              ? const Center(
                  child: CircularProgressIndicator(color: Color(0xFF0D9488)),
                )
              : _trip == null
              ? const Center(
                  child: Text(
                    'Trip not found',
                    style: TextStyle(color: Color(0xFF134E4A)),
                  ),
                )
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
                                  const SizedBox(height: 100),
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
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFCCFBF1),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.chevron_left,
                        color: Color(0xFF0D9488),
                        size: 24,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'Journey Details',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF0D9488),
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  _buildStatusPill(_trip?.status ?? ''),
                ],
              ),
              const SizedBox(height: 24),
              if (_trip != null)
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFCCFBF1)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF0D9488).withOpacity(0.04),
                              blurRadius: 10,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.travel_explore_rounded,
                          color: Color(0xFF0D9488),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'REF ID: ${_trip!.id}',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF64748B),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _trip!.purpose,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 18,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF134E4A),
                                letterSpacing: -0.5,
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
          ),
        ),
      ),
    );
  }

  Widget _buildStatusPill(String status) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF134E4A),
        borderRadius: BorderRadius.circular(100),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF134E4A).withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
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
            color: const Color(0xFF0D9488).withOpacity(0.04),
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
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.timeline_rounded,
                  color: Color(0xFF0D9488),
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Text(
                'JOURNEY TIMELINE',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF134E4A),
                  letterSpacing: 1.0,
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

    IconData nodeIcon = status == 'completed'
        ? Icons.check_circle_rounded
        : (status == 'current'
              ? Icons.radio_button_checked_rounded
              : Icons.radio_button_unchecked_rounded);

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: status == 'current'
                      ? const Color(0xFF134E4A)
                      : (status == 'completed'
                            ? const Color(0xFF0D9488).withOpacity(0.1)
                            : const Color(0xFFF1F5F9)),
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Icon(
                    nodeIcon,
                    color: status == 'current'
                        ? Colors.white
                        : (status == 'completed'
                              ? const Color(0xFF0D9488)
                              : const Color(0xFF94A3B8)),
                    size: 20,
                  ),
                ),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    decoration: BoxDecoration(
                      color: status == 'completed'
                          ? const Color(0xFF0D9488).withOpacity(0.3)
                          : const Color(0xFFE2E8F0),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          step['title'],
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: status == 'pending'
                                ? const Color(0xFF94A3B8)
                                : const Color(0xFF134E4A),
                            letterSpacing: -0.3,
                          ),
                        ),
                      ),
                      _buildNodeStatusTag(status),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(
                        Icons.access_time_rounded,
                        size: 14,
                        color: status == 'pending'
                            ? const Color(0xFFCBD5E1)
                            : const Color(0xFF0D9488),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        step['date'],
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: status == 'pending'
                              ? const Color(0xFF94A3B8)
                              : const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    step['description'],
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      color: status == 'pending'
                          ? const Color(0xFF94A3B8)
                          : const Color(0xFF475569),
                      fontWeight: FontWeight.w500,
                      height: 1.5,
                    ),
                  ),
                  if (status == 'current') ...[
                    const SizedBox(height: 20),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.lightbulb_rounded,
                            color: Color(0xFF0D9488),
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Action required at this stage to progress.',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF0F766E),
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
      color = const Color(0xFF0D9488);
      bg = const Color(0xFFF0FDFA);
    } else if (status == 'current') {
      color = const Color(0xFF134E4A);
      bg = const Color(0xFFF1F5F9);
    } else {
      color = const Color(0xFF94A3B8);
      bg = const Color(0xFFF8FAFC);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withOpacity(0.1)),
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

  Widget _infoCard(
    String title,
    List<Widget> rows, {
    Color? bgColor,
    Color? borderColor,
    IconData? titleIcon,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: bgColor ?? Colors.white,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: borderColor ?? Colors.transparent),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (titleIcon != null) ...[
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(titleIcon, size: 18, color: const Color(0xFF0D9488)),
                ),
                const SizedBox(width: 12),
                Text(
                  title.toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF134E4A),
                    letterSpacing: 1.0,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
          ...rows,
        ],
      ),
    );
  }

  Widget _infoRow(
    IconData icon,
    String label,
    String value, {
    Color iconColor = const Color(0xFF0D9488),
    bool highlight = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Icon(icon, size: 18, color: iconColor),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label.toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: highlight ? FontWeight.w900 : FontWeight.w700,
                    color:
                        highlight
                            ? const Color(0xFF0D9488)
                            : const Color(0xFF134E4A),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOverviewCard() {
    return _infoCard('Journey Overview', [
      _infoRow(
        Icons.route_rounded,
        'Route',
        '${_trip!.source} → ${_trip!.destination}',
        iconColor: const Color(0xFF0D9488),
        highlight: true,
      ),
      _infoRow(
        Icons.commute_rounded,
        'Mode of Travel',
        _trip!.travelMode,
        iconColor: const Color(0xFF0D9488),
      ),
      _infoRow(
        Icons.account_balance_wallet_rounded,
        'Estimated Budget',
        '₹${_trip!.costEstimate}',
        iconColor: const Color(0xFF0D9488),
      ),
      _infoRow(
        Icons.badge_rounded,
        'Assigned Manager',
        _trip!.reportingManagerName ?? 'General Manager',
        iconColor: const Color(0xFF0D9488),
      ),
    ], titleIcon: Icons.info_outline_rounded);
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
          '${_trip!.odometer!['end_odo_reading'] ?? 'JOURNEY ACTIVE'}',
        ),
        if (_trip!.odometer!['end_odo_reading'] != null) ...[
          _infoRow(
            Icons.straight_rounded,
            'Net Distance',
            '${(double.tryParse(_trip!.odometer!['end_odo_reading'].toString()) ?? 0) - (double.tryParse(_trip!.odometer!['start_odo_reading'].toString()) ?? 0)} KM',
            highlight: true,
          ),
        ],
      ],
      bgColor: const Color(0xFFF0FDFA),
      borderColor: const Color(0xFFCCFBF1),
      titleIcon: Icons.auto_graph_rounded,
    );
  }

  Widget _buildHelpCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF134E4A), Color(0xFF0D9488)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF134E4A).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.support_agent_rounded,
                color: Colors.white,
                size: 24,
              ),
              const SizedBox(width: 12),
              Text(
                'Assistance Required?',
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            'If you experience any issues or need guidance regarding your travel approval, please reach out to the TGS Travel Desk.',
            style: GoogleFonts.plusJakartaSans(
              color: Colors.white.withOpacity(0.9),
              fontSize: 13,
              height: 1.6,
              fontWeight: FontWeight.w600,
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
        const SizedBox(height: 32),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.description_rounded,
                  color: Color(0xFF0D9488),
                  size: 20,
                ),
              ),
              const SizedBox(width: 14),
              Text(
                'TOUR PLAN ACTIVITIES',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF134E4A),
                  letterSpacing: 1.0,
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
            margin: const EdgeInsets.only(bottom: 20),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(32),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0D9488).withOpacity(0.04),
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
                        batch['file_name'] ?? 'Activity Schedule',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF134E4A),
                          letterSpacing: -0.5,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 5,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${filteredRows.length} RECORDS',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 8,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF0D9488),
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                ...filteredRows.take(5).map((r) => _buildMiniActivityRow(r)),
                if (filteredRows.length > 5) ...[
                  const SizedBox(height: 16),
                  Center(
                    child: Text(
                      '+ ${filteredRows.length - 5} ADDITIONAL ENTRIES',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 1.0,
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
      padding: const EdgeInsets.only(bottom: 20.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 4),
            width: 8,
            height: 8,
            decoration: const BoxDecoration(
              color: Color(0xFF0D9488),
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 16),
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
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  "${r['origin_route']} → ${r['destination_route']}",
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF134E4A),
                    letterSpacing: -0.2,
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
