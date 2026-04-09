import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'travel_story_screen.dart';
import 'trip_story_screen.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import 'package:intl/intl.dart';

class TravelTimelineScreen extends StatefulWidget {
  final String tripId;
  const TravelTimelineScreen({super.key, required this.tripId});

  @override
  State<TravelTimelineScreen> createState() => _TravelTimelineScreenState();
}

class _TravelTimelineScreenState extends State<TravelTimelineScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  Trip? _trip;
  List<Map<String, dynamic>> _lifecycleSteps = [];

  final List<Color> _nodeColors = const [
    Color(0xFFF59E0B),
    Color(0xFF4F46E5),
    Color(0xFFEC4899),
    Color(0xFF10B981),
    Color(0xFF3B82F6),
    Color(0xFF14B8A6),
    Color(0xFF8B5CF6),
    Color(0xFFF97316),
  ];

  @override
  void initState() {
    super.initState();
    _fetchTripDetails();
  }

  Future<void> _fetchTripDetails() async {
    setState(() => _isLoading = true);
    try {
      final trip = await _tripService.fetchTripDetails(widget.tripId);
      setState(() {
        _trip = trip;
        _buildLifecycle();
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  void _buildLifecycle() {
    if (_trip == null) return;

    final recordedEvents = _trip!.lifecycleEvents;
    final isClosed = ['Approved', 'Settled', 'Rejected'].contains(_trip!.status);
    final approvalChain = _trip!.approvalChain ?? [];
    
    _lifecycleSteps = [];

    // 1. Request Sent
    final dynamic initEvent = recordedEvents.isNotEmpty ? recordedEvents[0] : null;
    String requestDate = 'Unknown';
    if (initEvent != null && initEvent['date'] != null) {
      try {
        DateTime parsed = DateTime.parse(initEvent['date']);
        requestDate = DateFormat('d MMM yyyy').format(parsed);
      } catch (e) {
        requestDate = initEvent['date'].toString().split(' ').first;
      }
    }

    _lifecycleSteps.add({
      'title': 'Request Sent',
      'subtitle': _trip!.employee.toString().isEmpty ? 'Requester' : _trip!.employee,
      'role': 'Request Initiator',
      'status': 'completed',
      'date': requestDate,
      'description': 'Travel request submitted for ${_trip!.destination}.',
      'icon': Icons.description_rounded,
    });

    // 2. Approval Chain
    if (approvalChain.isNotEmpty) {
      for (var person in approvalChain) {
        final name = (person['name'] ?? '').toString();
        final nameLower = name.toLowerCase();
        
        dynamic approvalEvent;
        for (var e in recordedEvents) {
          final tLower = (e['title'] ?? '').toString().toLowerCase();
          final dLower = (e['description'] ?? '').toString().toLowerCase();
          if (tLower.contains('approved by $nameLower') || dLower.contains('approved by $nameLower')) {
            approvalEvent = e;
            break;
          }
        }

        final isCurrentApprover = (_trip!.currentApproverName ?? '').toString().toLowerCase() == nameLower;

        String status = 'pending';
        String date = 'Pending';

        if (approvalEvent != null) {
          status = 'completed';
          try {
             DateTime d = DateTime.parse(approvalEvent['date']);
             date = DateFormat('d MMM yyyy').format(d);
          } catch(e) {
             date = approvalEvent['date'] ?? 'Completed';
          }
        } else if (isCurrentApprover && !isClosed) {
          status = 'current';
          date = 'Action Required';
        }

        _lifecycleSteps.add({
          'title': name,
          'subtitle': person['designation'] ?? '',
          'role': person['role'] == 'HR' ? 'HR Verification' : 'Manager Approval',
          'status': status,
          'date': date,
          'icon': person['role'] == 'HR' ? Icons.security_rounded : Icons.how_to_reg_rounded,
        });
      }
    } else {
      // Legacy Fallback
      for (int i = 1; i < recordedEvents.length; i++) {
        final event = recordedEvents[i];
        final title = (event['title'] ?? '').toString();
        final titleLower = title.toLowerCase();

        IconData icon = Icons.check_circle_rounded;
        String role = 'Manager Approval';
        String eventStatus = 'completed';
        String displayTitle = title.isEmpty ? 'Approved' : title;

        if (titleLower.contains('rejected') || (event['description']?.toString().toLowerCase().contains('rejected by') ?? false)) {
          icon = Icons.cancel_rounded;
          role = 'Rejected';
          eventStatus = 'rejected';
        } else if (titleLower.startsWith('hr approved by') || titleLower.contains('hr verification') || titleLower.contains('ticket booking')) {
          icon = Icons.security_rounded;
          role = 'HR Verification';
          final hrMatch = RegExp(r'hr approved by (.+)', caseSensitive: false).firstMatch(titleLower);
          displayTitle = hrMatch != null ? 'HR Approved by ${hrMatch.group(1)!.trim()}' : 'HR Verified';
        } else if (titleLower.startsWith('forwarded to')) {
          icon = Icons.groups_rounded;
          role = 'Escalated';
          displayTitle = title;
        } else if (titleLower.startsWith('approved by')) {
          icon = Icons.how_to_reg_rounded;
          role = 'Manager Approval';
          displayTitle = title;
        } else if (titleLower.contains('management approval')) {
          final nameMatch = RegExp(r'approved by ([A-Za-z\s.]+?)(?:\.|,|and|$)', caseSensitive: false).firstMatch(event['description']?.toString() ?? '');
          final approverName = nameMatch != null ? nameMatch.group(1)!.trim() : '';
          icon = Icons.how_to_reg_rounded;
          role = 'Manager Approval';
          displayTitle = approverName.isNotEmpty ? 'Approved by $approverName' : 'Manager Approved';
        }

        String dt = 'Completed';
        if (event['date'] != null) {
          try {
            DateTime d = DateTime.parse(event['date']);
            dt = DateFormat('d MMM yyyy').format(d);
          } catch (e) {
            dt = event['date'].split(' ').first;
          }
        }

        _lifecycleSteps.add({
          'title': displayTitle,
          'subtitle': '',
          'role': role,
          'status': eventStatus,
          'date': dt,
          'icon': icon,
        });
      }

      if (!isClosed) {
        _lifecycleSteps.add({
          'title': _trip!.currentApproverName ?? 'Approving Manager',
          'role': 'Manager Approval',
          'status': 'current',
          'date': 'Action Required',
          'icon': Icons.access_time_rounded,
        });
      }
    }

    // 3. Final Step
    if (_trip!.status == 'Approved' || _trip!.status == 'Settled' || _trip!.status == 'Completed') {
      _lifecycleSteps.add({
        'title': 'Final Approval',
        'role': 'Success',
        'status': 'completed',
        'date': 'Success',
        'icon': Icons.check_circle_rounded,
      });
    } else if (_trip!.status == 'Rejected') {
      _lifecycleSteps.add({
        'title': 'Rejected',
        'subtitle': _trip!.rejectedBy ?? '',
        'role': 'Rejected',
        'status': 'rejected',
        'date': 'Rejected',
        'icon': Icons.cancel_rounded,
      });
    } else {
      _lifecycleSteps.add({
        'title': 'Final Approval',
        'role': 'Endpoint',
        'status': 'pending',
        'date': 'Endpoint',
        'icon': Icons.check_circle_rounded,
      });
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
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black87),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('APPROVAL TIMELINE', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.grey, letterSpacing: 1.5)),
            Text(_trip?.tripId ?? 'Loading...', style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w900, color: Colors.black)),
          ],
        ),
        actions: [
           if (_trip != null)
           Padding(
             padding: const EdgeInsets.only(right: 16, top: 12),
             child: Text(_trip!.status, style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.bold, color: _trip!.status.contains('Approved') ? Colors.green : Colors.orange)),
           )
        ],
        centerTitle: false,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFBE123C)))
          : _trip == null
              ? const Center(child: Text('Trip not found'))
              : _buildProfessionalTimeline(),
    );
  }

  Widget _buildProfessionalTimeline() {
    final hasCurrentAction = _lifecycleSteps.any((s) => s['status'] == 'current');

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 40),
      child: Column(
        children: [
          const SizedBox(height: 20),
          _buildTripSummaryHeader(),
          const SizedBox(height: 30),
          // Horizontal timeline wrapper
          SizedBox(
            height: 480,
            child: Stack(
              children: [
                // Line across middle
                Align(
                  alignment: Alignment.center,
                  child: Container(
                    height: 3,
                    margin: const EdgeInsets.symmetric(horizontal: 20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [Colors.grey[200]!, Colors.grey[400]!, Colors.grey[200]!],
                      )
                    ),
                  ),
                ),
                // The scrolling nodes
                ListView.builder(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  itemCount: _lifecycleSteps.length,
                  itemBuilder: (context, index) {
                    return _buildTimelineNode(index);
                  },
                ),
              ],
            ),
          ),
          
          if (hasCurrentAction)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey[200]!),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 15, offset: const Offset(0, 5)),
                ],
              ),
              child: Row(
                children: [
                  const Icon(Icons.flight_takeoff_rounded, color: Color(0xFF475569)),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'This is your current stage. Please complete the necessary steps to proceed.',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF475569),
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  ElevatedButton(
                    onPressed: () {
                      if (_trip!.considerAsLocal) {
                        Navigator.push(context, MaterialPageRoute(builder: (context) => TravelStoryScreen(tripId: _trip!.tripId)));
                      } else {
                        Navigator.push(context, MaterialPageRoute(builder: (context) => TripStoryScreen(tripId: _trip!.tripId)));
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFBE123C),
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      elevation: 0,
                    ),
                    child: Text('Go to Actions', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.bold)),
                  )
                ],
              ),
            ),
            
          if (_trip!.status == 'Rejected' && _trip!.rejectionReason != null && _trip!.rejectionReason!.isNotEmpty)
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFFECACA)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Rejection Reason', style: GoogleFonts.plusJakartaSans(color: const Color(0xFFDC2626), fontWeight: FontWeight.w700, fontSize: 13)),
                        const SizedBox(height: 4),
                        Text(_trip!.rejectionReason!, style: GoogleFonts.plusJakartaSans(color: const Color(0xFF7F1D1D), fontSize: 12)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildTimelineNode(int index) {
    final step = _lifecycleSteps[index];
    final bool isEven = index % 2 == 0;
    
    Color themeColor = _nodeColors[index % _nodeColors.length];
    if (step['status'] == 'rejected') themeColor = Colors.red;
    if (step['status'] == 'pending') themeColor = Colors.grey[400]!;

    bool isCurrent = step['status'] == 'current';
    bool isPending = step['status'] == 'pending';
    bool isCompleted = step['status'] == 'completed';

    Widget textContent = Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (isEven && step['date'] != 'Unknown') ...[
          _badgeDate(step['date'], themeColor, isPending),
          const SizedBox(height: 6),
        ],
        
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: isCompleted ? themeColor.withOpacity(0.08) : isCurrent ? Colors.red[50] : Colors.grey[100],
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            step['role'].toString().toUpperCase(),
            style: GoogleFonts.plusJakartaSans(
              fontSize: 8,
              fontWeight: FontWeight.w800,
              color: isCompleted ? themeColor : isCurrent ? Colors.red[600] : Colors.grey[600],
              letterSpacing: 0.5,
            ),
          ),
        ),
        const SizedBox(height: 6),
        
        SizedBox(
          width: 140,
          child: Text(
            step['title'],
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: isPending ? Colors.grey[400] : Colors.blueGrey[900],
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        
        if (step['subtitle'] != null && step['subtitle'].toString().isNotEmpty) ...[
          const SizedBox(height: 2),
          Text(
            step['subtitle'],
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Colors.grey[600],
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
        
        if (!isEven && step['date'] != 'Unknown') ...[
          const SizedBox(height: 6),
          _badgeDate(step['date'], themeColor, isPending),
        ],
      ],
    );

    Widget iconCircle = Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        color: isPending ? Colors.grey[200] : Colors.white,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 3),
        boxShadow: isCurrent 
            ? [BoxShadow(color: Colors.red.withOpacity(0.3), blurRadius: 15, spreadRadius: 4)]
            : [BoxShadow(color: Colors.black.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Center(
        child: Icon(step['icon'], size: 20, color: isPending ? Colors.grey[500] : themeColor),
      ),
    );

    return Container(
      width: 180,
      margin: const EdgeInsets.symmetric(horizontal: 5),
      child: Column(
        children: [
          Expanded(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: isEven ? Padding(padding: const EdgeInsets.only(bottom: 10), child: textContent) : const SizedBox(),
            ),
          ),
          
          SizedBox(
            height: 60,
            child: Center(child: iconCircle),
          ),
          
          Expanded(
            child: Align(
              alignment: Alignment.topCenter,
              child: !isEven ? Padding(padding: const EdgeInsets.only(top: 10), child: textContent) : const SizedBox(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _badgeDate(String date, Color themeColor, bool isPending) {
    if (date.isEmpty) return const SizedBox();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.transparent,
      ),
      child: Text(
        date,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: Colors.grey[600],
        ),
      ),
    );
  }

  Widget _buildTripSummaryHeader() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('DESTINATION', style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white54, letterSpacing: 1)),
                  Text(_trip?.destination ?? 'TBD', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w900, color: Colors.white)),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _trip?.status.toUpperCase() ?? 'PENDING',
                  style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              _summaryItem(Icons.calendar_today_rounded, _trip?.dates ?? 'N/A'),
              const SizedBox(width: 20),
              _summaryItem(Icons.work_rounded, _trip?.purpose ?? 'N/A'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _summaryItem(IconData icon, String label) {
    return Row(
      children: [
        Icon(icon, size: 14, color: Colors.white54),
        const SizedBox(width: 8),
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.white70),
        ),
      ],
    );
  }
}
