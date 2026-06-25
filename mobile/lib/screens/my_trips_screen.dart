import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'trip_timeline_screen.dart';
import 'travel_story_screen.dart';
import 'trip_story_screen.dart';
import 'trip_summary_screen.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import 'create_trip_screen.dart';
import 'local_travel_screen.dart';
import '../services/api_service.dart';

class MyTripsScreen extends StatefulWidget {
  const MyTripsScreen({super.key});

  @override
  State<MyTripsScreen> createState() => _MyTripsScreenState();
}

class _MyTripsScreenState extends State<MyTripsScreen> {
  final TripService _tripService = TripService();
  final ApiService _apiService = ApiService();
  List<Trip> _allTrips = [];
  List<Trip> _visibleTrips = [];
  String _filter = 'All Status';
  String _typeFilter = 'All Types';
  String _searchTerm = '';
  bool _isLoading = true;

  // PAGINATION CONTROLS
  final ScrollController _scrollController = ScrollController();
  int _currentPage = 1;
  bool _hasMore = true;
  bool _isFetchingMore = false;

  @override
  void initState() {
    super.initState();
    _fetchTrips();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent * 0.9 &&
        _hasMore &&
        !_isFetchingMore &&
        !_isLoading) {
      _fetchMoreTrips();
    }
  }

  Future<void> _fetchTrips() async {
    setState(() {
      _isLoading = true;
      _currentPage = 1;
      _hasMore = true;
    });
    try {
      final trips = await _tripService.fetchTrips(
        search: _searchTerm,
        page: _currentPage,
      );
      
      if (trips.length < 5) {
        _hasMore = false;
      }

      setState(() {
        _allTrips = trips;
        _applyFilters();
        _isLoading = false;
      });

      // AUTO-FETCH NEXT PAGE for seamless loading
      if (_hasMore) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fetchMoreTrips(isAuto: true);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to load trips: $e')));
      }
    }
  }

  Future<void> _fetchMoreTrips({bool isAuto = false}) async {
    if (_isFetchingMore || !_hasMore) return;
    
    if (mounted) setState(() => _isFetchingMore = true);
    
    // Add a slight delay for "auto" loading to show the loader at the bottom
    if (isAuto) await Future.delayed(const Duration(milliseconds: 100));
    try {
      _currentPage++;
      final more = await _tripService.fetchTrips(
        search: _searchTerm,
        page: _currentPage,
      );

      if (more.isEmpty || more.length < 5) {
        _hasMore = false;
      }

      setState(() {
        _allTrips.addAll(more);
        _applyFilters();
        _isFetchingMore = false;
      });

      // CONTINUE AUTO-FETCHING until all records are loaded
      if (_hasMore) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _fetchMoreTrips(isAuto: true);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFetchingMore = false;
          // If we hit an "Invalid page" error, it means we've reached the end
          if (e.toString().contains('Invalid page') || e.toString().contains('404')) {
            _hasMore = false;
          }
        });
        if (!_hasMore) return; // Silent stop for end of pages
        debugPrint('Error fetching more trips: $e');
      }
    }
  }

  String _getDisplayStatus(String backendStatus) {
    if (backendStatus.isEmpty) return 'Pending';
    final s = backendStatus.trim().toLowerCase();

    if (['settled', 'completed', 'paid', 'transferred'].contains(s)) {
      return 'Settled';
    }

    if (['approved', 'claim submitted', 'manager approved', 'hr approved', 'under process', 'partially completed', 'forwarded'].contains(s)) {
      return 'Approved';
    }

    if (s == 'resubmitted') {
      return 'Resubmitted';
    }

    if (['pending', 'submitted', 'draft', 'pending_hr', 'pending_executive', 'pending_head', 'pending_final_release'].contains(s)) {
      return 'Pending';
    }

    if (s.contains('pending')) return 'Pending';
    if (s.contains('reject')) return 'Rejected';

    return 'Approved';
  }

  void _applyFilters() {
    final term = _searchTerm.toLowerCase().trim();
    setState(() {
      _visibleTrips = _allTrips.where((t) {
        final displayStatus = _getDisplayStatus(t.status);
        if (displayStatus == 'Pending') return false;

        bool matchesFilter = _filter == 'All Status' || _filter == 'All';
        if (!matchesFilter) {
          matchesFilter = (displayStatus.toLowerCase() == _filter.toLowerCase()) || 
                          (t.status.toLowerCase() == _filter.toLowerCase());
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

      // Final sort for priority: Approved/Completed first, Settled last
      _visibleTrips.sort((a, b) {
        int getPriority(String status) {
          final s = status.toLowerCase();
          // Priority 1: Actionable / Pending Approval / Resubmitted / Claim Submitted
          if (s.contains('pending') || s == 'approved' || s == 'manager approved' || s == 'hr approved' || s == 'resubmitted' || s == 'claim submitted') return 1;
          // Priority 3: Finalized / Settled
          if (['settled', 'paid', 'completed', 'transferred', 'completed & settled'].any((term) => s.contains(term))) return 3;
          // Priority 2: Intermediate states (Under Process, etc.)
          return 2;
        }

        final pA = getPriority(a.status);
        final pB = getPriority(b.status);
        if (pA != pB) return pA.compareTo(pB);
        // Use created_at if available for newest first, otherwise maintain stability
        return b.createdAt.compareTo(a.createdAt);
      });
    });
  }

  void _onSearchChanged(String v) {
    _searchTerm = v;
    _fetchTrips();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      body: Stack(
        children: [
          // Premium ambient background (Matches Dashboard's new teal airy feel)
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFFFFFFFF),
                    const Color(0xFFF0FDFA),
                  ],
                ),
              ),
            ),
          ),
          // Executive Mesh Blobs (Atmospheric layers matching Dashboard)
          Positioned(
            top: -100,
            right: -80,
            child: Container(
              width: 400,
              height: 400,
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
            bottom: 100,
            left: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF0D9488).withOpacity(0.03),
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
                          color: Color(0xFF0D9488),
                          strokeWidth: 3,
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchTrips,
                        color: const Color(0xFF0D9488),
                        child: _visibleTrips.isEmpty
                            ? _buildEmptyState()
                            : ListView.builder(
                                controller: _scrollController,
                                padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                                itemCount: _visibleTrips.length + (_hasMore ? 1 : 0),
                                itemBuilder: (context, index) {
                                  if (index == _visibleTrips.length) {
                                    return _isFetchingMore
                                        ? const Padding(
                                            padding: EdgeInsets.symmetric(vertical: 20),
                                            child: Center(
                                              child: CircularProgressIndicator(
                                                color: Color(0xFF0D9488),
                                                strokeWidth: 2,
                                              ),
                                            ),
                                          )
                                        : const SizedBox.shrink();
                                  }
                                  return _buildTripCard(_visibleTrips[index]);
                                },
                              ),
                      ),
              ),
            ],
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showNewRequestBottomSheet,
        backgroundColor: const Color(0xFF134E4A), // Deep Teal FAB
        elevation: 8,
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: Text(
          'NEW REQUEST',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w900,
            fontSize: 13,
            letterSpacing: 1,
            color: Colors.white,
          ),
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    );
  }

  Widget _buildCustomHeader() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
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
                        color: const Color(0xFFCCFBF1), // Light Teal background
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(Icons.chevron_left, color: Color(0xFF0D9488)),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Text(
                      'My Trips & Travel',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF0D9488),
                        fontSize: 25,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1, // Reduced slightly for better fit
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              // Removed SizedBox(height: 24)
              // Text(
              //   'Professional\nTravel Logs',
              //   style: GoogleFonts.plusJakartaSans(
              //     color: const Color(0xFF134E4A),
              //     fontSize: 32,
              //     fontWeight: FontWeight.w900,
              //     letterSpacing: -1.0,
              //     height: 1.1,
              //   ),
              // ),
              // const SizedBox(height: 8),
              // Text(
              //   'Track and manage your mobility requests',
              //   style: GoogleFonts.inter(
              //     color: const Color(0xFF64748B),
              //     fontSize: 14,
              //     fontWeight: FontWeight.w500,
              //   ),
              // ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToolbar() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF1F5F9)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: TextField(
              onChanged: _onSearchChanged,
              decoration: InputDecoration(
                hintText: 'Search trips...',
                hintStyle: GoogleFonts.plusJakartaSans(
                  color: const Color(0xFF94A3B8),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
                prefixIcon: const Icon(Icons.search, color: Color(0xFF0D9488), size: 22),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildFilterDropdown(
                  label: _typeFilter,
                  icon: Icons.category_rounded,
                  onTap: () => _showFilterBottomSheet(
                    'Type',
                    ['All Types', 'Trip', 'Travel'],
                    _typeFilter,
                    (v) {
                      setState(() {
                        _typeFilter = v;
                        _applyFilters();
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildFilterDropdown(
                  label: _filter,
                  icon: Icons.tune_rounded,
                  onTap: () => _showFilterBottomSheet(
                    'Status',
                    ['All Status', 'Approved', 'Settled', 'Rejected', 'Resubmitted'],
                    _filter,
                    (v) {
                      setState(() {
                        _filter = v;
                        _applyFilters();
                      });
                    },
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterDropdown({required String label, required IconData icon, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFCCFBF1)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF0D9488)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF134E4A),
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const Icon(Icons.keyboard_arrow_down, size: 18, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  Widget _buildTripCard(Trip t) {
    final statusColor = _getStatusColor(t.status);
    final isLocal = t.considerAsLocal;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => TripSummaryScreen(trip: t)),
          ),
          child: Stack(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isLocal ? const Color(0xFFEEF2FF) : const Color(0xFFF0FDFA),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            isLocal ? 'LOCAL TRAVEL' : 'BUSINESS TRIP',
                            style: GoogleFonts.plusJakartaSans(
                              color: isLocal ? const Color(0xFF4F46E5) : const Color(0xFF0D9488),
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: statusColor.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _getDisplayStatus(t.status).toUpperCase(),
                            style: GoogleFonts.inter(
                              color: statusColor,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Text(
                      t.purpose,
                      style: GoogleFonts.outfit(
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF134E4A),
                        letterSpacing: -0.5,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'ID: ${t.id}',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 20),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    if (!isLocal) ...[
                      _buildInfoBlock(Icons.location_on_rounded, 'DESTINATION', t.destination),
                      const SizedBox(width: 12),
                      Container(width: 1, height: 30, color: const Color(0xFFCCFBF1)),
                      const SizedBox(width: 12),
                    ],
                    _buildInfoBlock(Icons.calendar_month_rounded, isLocal ? 'MONTH' : 'DATES', t.dates),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  children: [
                    if (!isLocal) ...[
                      Expanded(
                        child: _buildSecondaryButton(
                          'Timeline',
                          Icons.history_toggle_off_rounded,
                          () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => TripTimelineScreen(tripId: t.id),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                    ],
                    Expanded(
                      child: _buildPrimaryButton(
                        'View Story',
                        Icons.auto_awesome_rounded,
                        () => Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => isLocal
                                ? TravelStoryScreen(tripId: t.id)
                                : TripStoryScreen(tripId: t.id),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
                ],
              ),
              if (_getDisplayStatus(t.status).toLowerCase() == 'settled')
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.5),
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: Center(
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.black.withOpacity(0.7),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.lock_rounded, color: Colors.white, size: 16),
                            const SizedBox(width: 8),
                            Text(
                              'Journey Completed',
                              style: GoogleFonts.plusJakartaSans(
                                color: Colors.white,
                                fontWeight: FontWeight.w900,
                                fontSize: 10,
                                letterSpacing: 1
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

  Widget _buildInfoBlock(IconData icon, String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 14, color: const Color(0xFF0D9488)),
              const SizedBox(width: 6),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  color: const Color(0xFF94A3B8),
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: GoogleFonts.inter(
              color: const Color(0xFF134E4A),
              fontSize: 13,
              fontWeight: FontWeight.w700,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryButton(String label, IconData icon, VoidCallback onTap) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: const Color(0xFF0D9488),
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.2),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSecondaryButton(String label, IconData icon, VoidCallback onTap) {
    return Container(
      height: 48,
      decoration: BoxDecoration(
        color: const Color(0xFF134E4A),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 18),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFF0D9488).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.explore_off_rounded, size: 64, color: Color(0xFF0D9488)),
            ),
            const SizedBox(height: 24),
            Text(
              'No Journeys Found',
              style: GoogleFonts.outfit(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF134E4A),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Your travel history is currently empty. Start a new request to begin your adventure.',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                fontSize: 15,
                color: const Color(0xFF64748B),
                fontWeight: FontWeight.w500,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showNewRequestBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        padding: const EdgeInsets.fromLTRB(24, 12, 24, 40),
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
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'INITIATE REQUEST',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF94A3B8),
                letterSpacing: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            _buildRequestOption(
              icon: Icons.business_center_rounded,
              title: 'New Trip Request',
              subtitle: 'Inter-city travel & planning',
              color: const Color(0xFF0D9488),
              onTap: () {
                final user = _apiService.getUser();
                final permissions = user?['role_permissions'] as Map<String, dynamic>?;
                final canCreateTrip = permissions?['can_create_trip'] != false;
                
                if (!canCreateTrip) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Access Restricted: Your role does not have permission to initiate New Trip Requests'),
                      backgroundColor: Colors.red,
                    ),
                  );
                  return;
                }
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const CreateTripScreen()));
              },
            ),
            const SizedBox(height: 12),
            Builder(
              builder: (context) {
                final user = _apiService.getUser();
                final permissions = user?['role_permissions'] as Map<String, dynamic>?;
                final canCreateTourPlan = permissions?['can_create_tour_plan'] == true;
                
                return _buildRequestOption(
                  icon: Icons.local_taxi_rounded,
                  title: 'New Tour Plan',
                  subtitle: 'Monthly site visits & conveyance',
                  color: canCreateTourPlan ? const Color(0xFF134E4A) : Colors.grey,
                  isLocked: !canCreateTourPlan,
                  onTap: () {
                    if (!canCreateTourPlan) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Access Restricted: Your role does not have permission to initiate New Tour Plans'),
                          backgroundColor: Colors.red,
                        ),
                      );
                      return;
                    }
                    Navigator.pop(context);
                    Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => LocalTravelScreen(onUploadComplete: _fetchTrips)),
                    );
                  },
                );
              }
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRequestOption({
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
    required VoidCallback onTap,
    bool isLocked = false,
  }) {
    return InkWell(
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
              child: Icon(isLocked ? Icons.lock_outline_rounded : icon, color: color, size: 28),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF134E4A),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios_rounded, size: 14, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }

  void _showFilterBottomSheet(String title, List<String> options, String current, Function(String) onSelect) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (context) => Container(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Filter by $title',
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF134E4A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 20),
            ...options.map((option) {
              final isSelected = option == current;
              return InkWell(
                onTap: () {
                  onSelect(option);
                  Navigator.pop(context);
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
                  margin: const EdgeInsets.only(bottom: 8),
                  decoration: BoxDecoration(
                    color: isSelected ? const Color(0xFF0D9488).withOpacity(0.05) : Colors.transparent,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isSelected ? const Color(0xFF0D9488).withOpacity(0.3) : Colors.transparent),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        option,
                        style: GoogleFonts.inter(
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? const Color(0xFF0D9488) : const Color(0xFF64748B),
                        ),
                      ),
                      if (isSelected) const Icon(Icons.check_circle_rounded, size: 20, color: Color(0xFF0D9488)),
                    ],
                  ),
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    final s = _getDisplayStatus(status).toLowerCase();
    switch (s) {
      case 'settled':
        return const Color(0xFF10B981);
      case 'approved':
        return const Color(0xFF10B981);
      case 'resubmitted':
        return Colors.orange;
      case 'rejected':
        return const Color(0xFFEF4444);
      case 'ongoing':
        return Colors.orange;
      default:
        return const Color(0xFF0D9488);
    }
  }
}
