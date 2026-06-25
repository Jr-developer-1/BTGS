import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/trip_service.dart';
import '../models/trip_model.dart';
import 'trip_timeline_screen.dart';
import 'local_travel_timeline_screen.dart';

class MyRequestsScreen extends StatefulWidget {
  final bool hideHeader;
  final int? enforceTab;

  const MyRequestsScreen({super.key, this.hideHeader = false, this.enforceTab});

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen>
    with SingleTickerProviderStateMixin {
  final TripService _tripService = TripService();

  List<Map<String, dynamic>> _trips = [];
  List<Map<String, dynamic>> _advances = [];
  List<Map<String, dynamic>> _claims = [];
  List<Map<String, dynamic>> _bulkBatches = [];

  // PAGINATION
  int _currentTripPage = 1;
  bool _hasMoreTrips = true;
  bool _isFetchingMoreTrips = false;
  final ScrollController _tripScrollController = ScrollController();

  String _viewMode = 'active';
  bool _isLoading = true;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    if (widget.enforceTab != null) {
      _viewMode = widget.enforceTab == 0 ? 'active' : 'historical';
    }
    _fetchData();
    _tripScrollController.addListener(_onTripScroll);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _tripScrollController.dispose();
    super.dispose();
  }

  void _onTripScroll() {
    if (_tripScrollController.position.pixels >=
            _tripScrollController.position.maxScrollExtent * 0.9 &&
        _hasMoreTrips &&
        !_isFetchingMoreTrips &&
        !_isLoading) {
      _loadMoreTrips();
    }
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _currentTripPage = 1;
      _hasMoreTrips = true;
    });
    try {
      // modular loading
      await Future.wait([
        _loadTrips(reset: true),
        _loadAdvances(),
        _loadBulkBatches(),
      ]);

      setState(() => _isLoading = false);
    } catch (e) {
      debugPrint('Error fetching requests: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to load requests')),
        );
      }
    }
  }

  Future<void> _loadTrips({bool reset = false}) async {
    final tripsData = await _tripService.fetchTrips(
      page: _currentTripPage,
      all: true,
    );

    if (tripsData.length < 5) _hasMoreTrips = false;

    final mappedTrips = tripsData
        .map(
          (t) => {
            'id': t.id,
            'title': t.purpose.isEmpty ? 'Travel Request' : t.purpose,
            'date': '${t.startDate} - ${t.endDate}',
            'amount':
                double.tryParse(
                  t.costEstimate.replaceAll(RegExp(r'[^0-9.]'), ''),
                ) ??
                0.0,
            'status': t.status,
            'type': 'trip',
            'consider_as_local': t.considerAsLocal,
            'rawObject': t,
          },
        )
        .toList();

    if (reset) {
      _trips = mappedTrips;
      // Also synthesize claims from page 1 trips
      _generateClaims(tripsData);

      // AUTO-FETCH NEXT PAGE for seamless loading
      if (_hasMoreTrips) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _loadMoreTrips(isAuto: true);
        });
      }
    } else {
      _trips.addAll(mappedTrips);
    }
  }

  void _generateClaims(List<Trip> tripsData) {
    final claimsList = <Map<String, dynamic>>[];
    for (var t in tripsData) {
      final expenses = t.totalExpenses ?? 0.0;
      if (expenses > 0) {
        String claimStatus = 'Submitted';
        if (t.status == 'Settled') {
          claimStatus = 'Settled';
        } else if ([
          'Pending Settlement',
          'Finance Review',
        ].contains(t.status)) {
          claimStatus = 'Processing';
        }

        claimsList.add({
          'id': 'CLM-${t.id.substring(4)}',
          'title': 'Claim for ${t.purpose}',
          'date': t.startDate,
          'amount': expenses,
          'status': claimStatus,
          'type': 'claim',
        });
      }
    }

    if (claimsList.isEmpty) {
      claimsList.addAll([
        {
          'id': 'CLM-2024-001',
          'title': 'Client Visit to Mumbai',
          'date': '21-02-2024',
          'amount': 15400.0,
          'status': 'Settled',
          'type': 'claim',
        },
        {
          'id': 'CLM-2024-002',
          'title': 'Audit in Delhi Office',
          'date': '25-02-2024',
          'amount': 8200.0,
          'status': 'Submitted',
          'type': 'claim',
        },
      ]);
    }
    _claims = claimsList;
  }

  Future<void> _loadMoreTrips({bool isAuto = false}) async {
    if (_isFetchingMoreTrips || !_hasMoreTrips) return;

    if (mounted) setState(() => _isFetchingMoreTrips = true);

    // Add a slight delay for "auto" loading to show the loader at the bottom
    if (isAuto) await Future.delayed(const Duration(milliseconds: 100));
    try {
      _currentTripPage++;
      await _loadTrips();
      if (mounted) {
        setState(() => _isFetchingMoreTrips = false);

        // CONTINUE AUTO-FETCHING until all trips are loaded
        if (_hasMoreTrips) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _loadMoreTrips(isAuto: true);
          });
        }
      }
    } catch (e) {
      debugPrint('Error loading more trips: $e');
      if (mounted) {
        setState(() {
          _isFetchingMoreTrips = false;
          // If we hit an "Invalid page" error, it means we've reached the end
          if (e.toString().contains('Invalid page') ||
              e.toString().contains('404')) {
            _hasMoreTrips = false;
          }
        });
      }
    }
  }

  Future<void> _loadAdvances() async {
    final advancesData = await _tripService.fetchUserAdvances();
    _advances = advancesData
        .map(
          (adv) => {
            'id':
                'ADV-${adv['id'] ?? (adv['trip']?.toString().substring(4) ?? 'REQ')}',
            'title': 'Advance for ${adv['trip'] ?? 'Trip'}',
            'date': DateFormat('dd-MM-yyyy').format(
              DateTime.tryParse(adv['created_at'] ?? '') ?? DateTime.now(),
            ),
            'amount':
                double.tryParse(adv['requested_amount']?.toString() ?? '0') ??
                0.0,
            'status': adv['status'] ?? 'Pending',
            'type': 'advance',
          },
        )
        .toList();
  }

  Future<void> _loadBulkBatches() async {
    try {
      final batchesData = await _tripService.fetchBulkActivities();
      _bulkBatches = batchesData.map((b) {
        final rows = (b['data_json'] as List?) ?? [];
        final entryCount = rows.where((r) {
          final d = r['date']?.toString() ?? '';
          return !d.toLowerCase().contains('instruc');
        }).length;
        return {
          'id': b['id']?.toString() ?? '',
          'title': b['file_name']?.toString() ?? 'Monthly Tour Plan',
          'date': b['created_at']?.toString().split('T').first ?? '',
          'amount': 0.0,
          'status': b['status']?.toString() ?? 'Submitted',
          'type': 'bulk',
          'entry_count': entryCount,
          'data_json': rows,
        };
      }).toList();
    } catch (_) {
      _bulkBatches = [];
    }
  }

  bool _isActiveStatus(String status) {
    final s = status.toLowerCase();
    return !['settled', 'rejected', 'cancelled', 'approved'].contains(s);
  }

  List<Map<String, dynamic>> _filterData(List<Map<String, dynamic>> data) {
    return data
        .where(
          (item) => _viewMode == 'active'
              ? _isActiveStatus(item['status'])
              : !_isActiveStatus(item['status']),
        )
        .toList();
  }

  String _formatCurrency(double amount) {
    return NumberFormat.simpleCurrency(
      name: 'INR',
      decimalDigits: 0,
    ).format(amount);
  }

  Color _getStatusColor(String status) {
    final s = status.toLowerCase().replaceAll(' ', '-');
    switch (s) {
      case 'settled':
        return const Color(0xFF10B981);
      case 'approved':
        return const Color(0xFF10B981);
      case 'pending':
        return const Color(0xFFF59E0B);
      case 'rejected':
        return const Color(0xFFEF4444);
      case 'cancelled':
        return const Color(0xFF64748B);
      case 'processing':
        return const Color(0xFF3B82F6);
      default:
        return const Color(0xFFBB0633);
    }
  }

  @override
  Widget build(BuildContext context) {
    final activeTrips = _filterData(_trips);
    final activeAdvances = _filterData(_advances);
    final activeClaims = _filterData(_claims);
    final activeBatches = _filterData(_bulkBatches);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // Executive Mesh Blobs
          Positioned(
            top: 250,
            right: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFA9052E).withOpacity(0.02),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Column(
            children: [
              if (!widget.hideHeader) _buildCustomHeader(),
              if (widget.enforceTab == null) _buildFilterSection(),
              _buildTabBarSection(
                activeTrips.length,
                activeAdvances.length,
                activeClaims.length,
                activeBatches.length,
              ),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFFBB0633),
                        ),
                      )
                    : TabBarView(
                        controller: _tabController,
                        children: [
                          _buildColumn(
                            activeTrips,
                            controller: _tripScrollController,
                            isTrip: true,
                          ),
                          _buildColumn(activeAdvances),
                          _buildColumn(activeClaims),
                          _buildBulkBatchColumn(activeBatches),
                        ],
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
      decoration: const BoxDecoration(
        color: Color(0xFFA9052E),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -20,
            top: -20,
            child: Container(
              width: 130,
              height: 130,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
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
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.assignment_rounded,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
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
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'My Requests',
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

  Widget _buildFilterSection() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
      child: Row(
        children: [
          Expanded(
            child: _buildFilterBtn(
              'active',
              Icons.access_time_filled_rounded,
              'Active Queue',
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: _buildFilterBtn(
              'historical',
              Icons.check_circle_rounded,
              'History',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBarSection(int tCount, int aCount, int cCount, int bCount) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: TabBar(
        controller: _tabController,
        labelColor: const Color(0xFFBB0633),
        unselectedLabelColor: const Color(0xFF64748B),
        indicatorColor: const Color(0xFFBB0633),
        indicatorWeight: 3,
        indicatorPadding: const EdgeInsets.symmetric(horizontal: 16),
        dividerColor: Colors.transparent,
        labelStyle: GoogleFonts.plusJakartaSans(
          fontWeight: FontWeight.w900,
          fontSize: 10,
          letterSpacing: 0.3,
        ),
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        tabs: [
          Tab(text: 'TRIPS ($tCount)'),
          Tab(text: 'ADV ($aCount)'),
          Tab(text: 'CLAIMS ($cCount)'),
          Tab(text: 'TOUR PLAN ($bCount)'),
        ],
      ),
    );
  }

  Widget _buildFilterBtn(String mode, IconData icon, String label) {
    final isActive = _viewMode == mode;
    return GestureDetector(
      onTap: () => setState(() => _viewMode = mode),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF0F1E2A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? const Color(0xFF0F1E2A) : const Color(0xFFF1F5F9),
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFF0F1E2A).withOpacity(0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ]
              : [],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 16,
              color: isActive ? Colors.white : const Color(0xFF64748B),
            ),
            const SizedBox(width: 10),
            Text(
              label.toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w900,
                color: isActive ? Colors.white : const Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildColumn(
    List<Map<String, dynamic>> items, {
    ScrollController? controller,
    bool isTrip = false,
  }) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.description_outlined,
                size: 40,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No journals found',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                color: const Color(0xFF0F172A),
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No ${_viewMode} requests in this category.',
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFF64748B),
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchData,
      color: const Color(0xFFBB0633),
      child: ListView.builder(
        controller: controller,
        padding: const EdgeInsets.all(20),
        itemCount: items.length + (isTrip && _hasMoreTrips ? 1 : 0),
        itemBuilder: (context, index) {
          if (isTrip && index == items.length) {
            return _isFetchingMoreTrips
                ? const Padding(
                    padding: EdgeInsets.symmetric(vertical: 20),
                    child: Center(
                      child: CircularProgressIndicator(
                        color: Color(0xFFBB0633),
                        strokeWidth: 2,
                      ),
                    ),
                  )
                : const SizedBox.shrink();
          }
          return _buildCard(items[index]);
        },
      ),
    );
  }

  Widget _buildCard(Map<String, dynamic> item) {
    final statusColor = _getStatusColor(item['status']);

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: () {
            if (item['type'] == 'trip') {
              final bool isLocal = item['consider_as_local'] == true;
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => isLocal
                      ? LocalTravelTimelineScreen(tripId: item['id'])
                      : TripTimelineScreen(tripId: item['id']),
                ),
              );
            }
          },
          borderRadius: BorderRadius.circular(24),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      item['id'],
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: statusColor.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        item['status'].toUpperCase(),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: statusColor,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  item['title'],
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF0F172A),
                    letterSpacing: -0.3,
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.calendar_today_rounded,
                        size: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      item['date'],
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Last Updated: Today',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    Text(
                      _formatCurrency(item['amount']),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFFBB0633),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBulkBatchColumn(List<Map<String, dynamic>> items) {
    if (items.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.calendar_month_outlined,
                size: 40,
                color: Color(0xFF94A3B8),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No Tour Plans',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 16,
                color: const Color(0xFF0F172A),
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'No Monthly Tour Plan submissions found.',
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFF64748B),
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchData,
      color: const Color(0xFFBB0633),
      child: ListView.builder(
        padding: const EdgeInsets.all(20),
        itemCount: items.length,
        itemBuilder: (context, index) => _buildBulkBatchCard(items[index]),
      ),
    );
  }

  Widget _buildBulkBatchCard(Map<String, dynamic> batch) {
    final statusColor = _getStatusColor(batch['status']);
    final entryCount = batch['entry_count'] ?? 0;
    final status = batch['status']?.toString() ?? 'Submitted';

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFFF1F2),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.calendar_month_rounded,
                        size: 16,
                        color: Color(0xFFBB0633),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Monthly Tour Plan',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      color: statusColor,
                      letterSpacing: 1.0,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              batch['title'],
              style: GoogleFonts.plusJakartaSans(
                fontSize: 15,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
                letterSpacing: -0.3,
              ),
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 10),
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            const SizedBox(height: 10),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(
                        Icons.calendar_today_rounded,
                        size: 12,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      batch['date'],
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    '$entryCount entries',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
