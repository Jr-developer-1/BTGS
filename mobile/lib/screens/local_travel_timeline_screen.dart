import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';

class LocalTravelTimelineScreen extends StatefulWidget {
  final String tripId;
  const LocalTravelTimelineScreen({super.key, required this.tripId});

  @override
  State<LocalTravelTimelineScreen> createState() =>
      _LocalTravelTimelineScreenState();
}

class _LocalTravelTimelineScreenState extends State<LocalTravelTimelineScreen> {
  final TripService _tripService = TripService();
  Trip? trip;
  bool isLoading = true;
  List<Map<String, dynamic>> timelineSteps = [];

  @override
  void initState() {
    super.initState();
    _fetchTripDetails();
  }

  Future<void> _fetchTripDetails() async {
    try {
      final data = await _tripService.fetchTripDetails(widget.tripId);
      if (mounted) {
        setState(() {
          trip = data;
          _buildDynamicTimelineSteps();
          isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => isLoading = false);
    }
  }

  void _buildDynamicTimelineSteps() {
    if (trip == null) return;

    final recordedEvents = trip!.lifecycleEvents;
    final isClosed = [
      'Approved',
      'Settled',
      'Rejected',
      'Completed',
    ].contains(trip!.status);
    final approvalChain = trip!.approvalChain ?? [];

    List<Map<String, dynamic>> builtSteps = [];

    // 1. Request Sent
    final dynamic initEvent = recordedEvents.isNotEmpty
        ? recordedEvents[0]
        : null;
    String requestDate = 'Unknown';
    if (initEvent != null && initEvent['date'] != null) {
      try {
        requestDate = initEvent['date'].toString().split(' ').first;
      } catch (e) {
        requestDate = initEvent['date'].toString();
      }
    }

    builtSteps.add({
      'smallLabel': 'Request Sent',
      'capsuleText': requestDate,
      'status': 'completed',
      'icon': Icons.description_rounded,
      'color': const Color(0xFFF59E0B),
      'role': 'Request Initiator',
      'title': 'Request Sent',
    });

    // 2. Approval Chain
    if (approvalChain.isNotEmpty) {
      for (int i = 0; i < approvalChain.length; i++) {
        var person = approvalChain[i];
        final name = (person['name'] ?? '').toString();
        final nameLower = name.toLowerCase();

        dynamic approvalEvent;
        for (var e in recordedEvents) {
          final tLower = (e['title'] ?? '').toString().toLowerCase();
          final dLower = (e['description'] ?? '').toString().toLowerCase();
          if (tLower.contains('approved by $nameLower') ||
              dLower.contains('approved by $nameLower')) {
            approvalEvent = e;
            break;
          }
        }

        final isCurrentApprover =
            (trip!.currentApproverName ?? '').toString().toLowerCase() ==
            nameLower;

        String status = 'pending';
        String date = 'Pending';

        if (approvalEvent != null) {
          status = 'completed';
          try {
            date = approvalEvent['date'].toString().split(' ').first;
          } catch (e) {
            date = approvalEvent['date'] ?? 'Completed';
          }
        } else if (isCurrentApprover && !isClosed) {
          status = 'current';
          date = 'Action Required';
        }

        builtSteps.add({
          'smallLabel': name,
          'capsuleText': date,
          'status': status,
          'icon': person['role'] == 'HR'
              ? Icons.security_rounded
              : Icons.how_to_reg_rounded,
          'color': _getNodeColor(i + 1),
          'role': person['role'] == 'HR'
              ? 'HR Verification'
              : 'Manager Approval',
          'title': name,
        });
      }
    } else {
      // Legacy Fallback
      for (int i = 1; i < recordedEvents.length; i++) {
        final event = recordedEvents[i];
        final title = (event['title'] ?? '').toString();
        final titleLower = title.toLowerCase();

        String role = 'Manager Approval';
        String eventStatus = 'completed';
        String displayTitle = title.isEmpty ? 'Approved' : title;

        if (titleLower.contains('rejected') ||
            (event['description']?.toString().toLowerCase().contains(
                  'rejected by',
                ) ??
                false)) {
          role = 'Rejected';
          eventStatus = 'rejected';
        } else if (titleLower.startsWith('hr approved by') ||
            titleLower.contains('hr verification') ||
            titleLower.contains('ticket booking')) {
          role = 'HR Verification';
          final hrMatch = RegExp(
            r'hr approved by (.+)',
            caseSensitive: false,
          ).firstMatch(titleLower);
          displayTitle = hrMatch != null
              ? 'HR Approved by ${hrMatch.group(1)!.trim()}'
              : 'HR Verified';
        } else if (titleLower.startsWith('forwarded to')) {
          role = 'Escalated';
          displayTitle = title;
        } else if (titleLower.startsWith('approved by')) {
          role = 'Manager Approval';
          displayTitle = title;
        } else if (titleLower.contains('management approval')) {
          final nameMatch = RegExp(
            r'approved by ([A-Za-z\s.]+?)(?:\.|,|and|$)',
            caseSensitive: false,
          ).firstMatch(event['description']?.toString() ?? '');
          final approverName = nameMatch != null
              ? nameMatch.group(1)!.trim()
              : '';
          role = 'Manager Approval';
          displayTitle = approverName.isNotEmpty
              ? 'Approved by $approverName'
              : 'Manager Approved';
        }

        String dt = 'Completed';
        if (event['date'] != null) {
          dt = event['date'].split(' ').first;
        }

        builtSteps.add({
          'smallLabel': displayTitle,
          'capsuleText': dt,
          'status': eventStatus,
          'icon': _getIconForRole(role),
          'color': _getNodeColor(i),
          'role': role,
          'title': displayTitle,
        });
      }

      if (!isClosed) {
        builtSteps.add({
          'smallLabel': trip!.currentApproverName ?? 'Approving Manager',
          'capsuleText': 'Action Required',
          'status': 'current',
          'icon': Icons.access_time_rounded,
          'color': const Color(0xFF94A3B8),
          'role': 'Manager Approval',
          'title': trip!.currentApproverName ?? 'Approving Manager',
        });
      }
    }

    // Final Step
    if (trip!.status == 'Approved' ||
        trip!.status == 'Settled' ||
        trip!.status == 'Completed') {
      builtSteps.add({
        'smallLabel': 'Final Approval',
        'capsuleText': 'Success',
        'status': 'completed',
        'icon': Icons.check_circle_rounded,
        'color': const Color(0xFF3B82F6),
        'role': 'Success',
        'title': 'Final Approval',
      });
    } else if (trip!.status == 'Rejected') {
      builtSteps.add({
        'smallLabel': 'Rejected',
        'capsuleText': 'Rejected',
        'status': 'rejected',
        'icon': Icons.cancel_rounded,
        'color': Colors.red,
        'role': 'Rejected',
        'title': 'Rejected',
      });
    } else {
      builtSteps.add({
        'smallLabel': 'Final Approval',
        'capsuleText': 'Endpoint',
        'status': 'pending',
        'icon': Icons.check_circle_rounded,
        'color': Colors.grey,
        'role': 'Endpoint',
        'title': 'Final Approval',
      });
    }

    setState(() => timelineSteps = builtSteps);
  }

  Color _getNodeColor(int index) {
    final colors = [
      const Color(0xFFF59E0B),
      const Color(0xFF4F46E5),
      const Color(0xFFEC4899),
      const Color(0xFF10B981),
      const Color(0xFF3B82F6),
      const Color(0xFF14B8A6),
      const Color(0xFF8B5CF6),
      const Color(0xFFF97316),
    ];
    return colors[index % colors.length];
  }

  IconData _getIconForRole(String role) {
    if (role == 'HR Verification') return Icons.security_rounded;
    if (role == 'Rejected') return Icons.cancel_rounded;
    return Icons.how_to_reg_rounded;
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(color: Color(0xFFBB0633)),
        ),
      );
    }

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.chevron_left,
            color: Color(0xFF0F1E2A),
            size: 30,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Image.asset(
          'assets/bavya.png',
          height: 40,
          errorBuilder: (c, e, s) => const SizedBox(),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildProfessionalHeader(),
            const SizedBox(height: 20),
            if (trip!.status != 'Approved' &&
                trip!.status != 'Success' &&
                trip!.status != 'Settled' &&
                trip!.status != 'Rejected' &&
                trip!.status != 'Completed')
              _buildActionBox(),

            if (trip!.status == 'Rejected' &&
                trip!.rejectionReason != null &&
                trip!.rejectionReason!.isNotEmpty)
              Container(
                margin: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 16,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(
                      Icons.error_outline_rounded,
                      color: Color(0xFFEF4444),
                      size: 20,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Rejection Reason',
                            style: GoogleFonts.plusJakartaSans(
                              color: const Color(0xFFDC2626),
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            trip!.rejectionReason!,
                            style: GoogleFonts.plusJakartaSans(
                              color: const Color(0xFF7F1D1D),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 32),

            // Vertical Alternating Zigzag Timeline
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Stack(
                children: [
                  // Central vertical track
                  Positioned(
                    left: MediaQuery.of(context).size.width / 2 - 21,
                    top: 0,
                    bottom: 0,
                    child: Container(width: 2, color: const Color(0xFFE2E8F0)),
                  ),
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: timelineSteps.length,
                    itemBuilder: (context, index) {
                      return _buildVerticalNode(
                        timelineSteps[index],
                        index % 2 == 0,
                      );
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 100),
          ],
        ),
      ),
    );
  }

  Widget _buildProfessionalHeader() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0x0A000000),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFE11D48).withOpacity(0.05),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              trip?.id ?? '',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: const Color(0xFFE11D48),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Travel Timeline',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 26,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F1E2A),
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _buildBadge('STATUS', trip!.status, const Color(0xFF10B981)),
              const SizedBox(width: 20),
              _buildBadge('TRAVEL DATES', trip!.dates, const Color(0xFFE11D48)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionBox() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFDF2F4),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFBB0633).withOpacity(0.1)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.info_outline_rounded,
              color: Color(0xFFBB0633),
              size: 18,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Action required to proceed to next stage.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFFBB0633),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerticalNode(Map<String, dynamic> step, bool isLeft) {
    final Color color = step['color'] as Color;
    final halfWidth = (MediaQuery.of(context).size.width - 40) / 2 - 22 - 12;

    return Padding(
      padding: const EdgeInsets.only(bottom: 36),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          // Left side content or empty space
          SizedBox(
            width: halfWidth,
            child: isLeft
                ? _buildNodeCard(
                    step,
                    color,
                    Alignment.centerRight,
                    CrossAxisAlignment.end,
                  )
                : const SizedBox.shrink(),
          ),

          const SizedBox(width: 12),

          // Center dot
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: color,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: color.withOpacity(0.35),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Icon(
              step['icon'] as IconData,
              size: 20,
              color: Colors.white,
            ),
          ),

          const SizedBox(width: 12),

          // Right side content or empty space
          SizedBox(
            width: halfWidth,
            child: !isLeft
                ? _buildNodeCard(
                    step,
                    color,
                    Alignment.centerLeft,
                    CrossAxisAlignment.start,
                  )
                : const SizedBox.shrink(),
          ),
        ],
      ),
    );
  }

  Widget _buildNodeCard(
    Map<String, dynamic> step,
    Color color,
    Alignment alignment,
    CrossAxisAlignment crossAlign,
  ) {
    return Column(
      crossAxisAlignment: crossAlign,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(10),
            boxShadow: [
              BoxShadow(
                color: color.withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Text(
                step['role'] ?? '',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 8,
                  fontWeight: FontWeight.w900,
                  color: Colors.white.withOpacity(0.9),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                step['capsuleText'],
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        // Label below capsule
        Text(
          step['smallLabel'],
          textAlign: crossAlign == CrossAxisAlignment.end
              ? TextAlign.right
              : TextAlign.left,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF1E293B),
          ),
        ),
      ],
    );
  }
}
