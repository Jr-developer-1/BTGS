import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../constants/api_constants.dart';
import '../constants/module_constants.dart';
import '../models/module_model.dart';
import '../services/api_service.dart';
import '../services/location_tracking_service.dart';
import '../services/trip_service.dart';
import '../services/expense_reminder_service.dart';
import 'notifications_screen.dart';
import 'frs_attendance_screen.dart';
import 'frs_enrollment_screen.dart';
import 'profile_page.dart';
import 'guest_house_screen.dart';
import 'trip_approvals_screen.dart';
import 'my_trips_screen.dart';
import 'help_support_screen.dart';

/// Comprehensive role-based dashboard that displays modules as cards
class RoleBasedDashboard extends StatefulWidget {
  final String username;
  final String userRole;
  final String? email;

  const RoleBasedDashboard({
    super.key,
    required this.username,
    required this.userRole,
    this.email,
  });

  @override
  State<RoleBasedDashboard> createState() => _RoleBasedDashboardState();
}

class _RoleBasedDashboardState extends State<RoleBasedDashboard> {
  final ApiService _apiService = ApiService();
  final TripService _tripService = TripService();
  late List<NavigationModule> _mainModules;
  late List<NavigationModule> _managementModules;
  List<NotificationItem> _notifications = [];
  bool _isLoadingNotifs = true;
  int _currentIndex = 1; // Default to Dashboard (index 1)

  bool _isAccLoading = false;
  bool _frsVerifiedThisSession = false;
  bool _isFaceEnrolled = false;
  Map<String, dynamic>? _dashboardStats;
  bool _isLoadingStats = true;
  String? _empId;
  late String _refinedRole;

  Timer? _tripSyncTimer;

  @override
  void initState() {
    super.initState();
    _initializeSafe();
    // Periodically sync tracking (every 10 mins) in case trip status changes
    _tripSyncTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      LocationTrackingService.syncTrackingWithTrips();
    });
  }

  @override
  void dispose() {
    _tripSyncTimer?.cancel();
    super.dispose();
  }

  Future<void> _initializeSafe() async {
    try {
      _initializeModules();
    } catch (e) {
      debugPrint('INIT_SAFE_MODULES: $e');
    }

    try {
      _fetchNotifications();
    } catch (e) {
      debugPrint('INIT_SAFE_NOTIFS: $e');
    }

    try {
      _syncExpenseReminders();
    } catch (e) {
      debugPrint('INIT_SAFE_REMINDERS: $e');
    }

    // Move location sync to after the tree is built to avoid startup crashes
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      try {
        await LocationTrackingService.syncTrackingWithTrips();
      } catch (e) {
        debugPrint('INIT_SAFE_LOCATION: $e');
      }
    });

    try {
      _checkFrsStatus();
    } catch (e) {
      debugPrint('INIT_SAFE_FRS: $e');
    }

    try {
      _fetchDashboardData();
    } catch (e) {
      debugPrint('INIT_SAFE_DATA: $e');
    }
  }

  Future<void> _fetchDashboardData() async {
    setState(() => _isLoadingStats = true);
    try {
      final stats = await _tripService.fetchDashboardStats();
      if (mounted) {
        setState(() {
          _dashboardStats = stats;
          _isLoadingStats = false;
        });
      }
    } catch (e) {
      debugPrint('Failed to fetch dashboard stats: $e');
      if (mounted) setState(() => _isLoadingStats = false);
    }
  }

  void _checkFrsStatus() {
    final user = _apiService.getUser();
    if (user != null) {
      setState(() {
        _isFaceEnrolled = user['is_face_enrolled'] == true;
        _empId = (user['employee_id'] ?? user['emp_id'] ?? user['id'] ?? '')
            .toString();
      });
    }
  }

  Future<void> _enrollFRS() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const FrsEnrollmentScreen()),
    );
    if (result == true) {
      // Refresh status after enrollment
      await _apiService.fetchFreshUser();
      _checkFrsStatus();
    }
  }

  Future<void> _performFRS() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const FrsAttendanceScreen()),
    );

    if (result == true && mounted) {
      setState(() => _frsVerifiedThisSession = true);
    }
  }

  Future<void> _syncExpenseReminders() async {
    try {
      final trips = await _tripService.fetchTrips();
      await ExpenseReminderService.syncTripExpenseReminders(trips);
    } catch (e) {
      debugPrint('Failed to sync expense reminders: $e');
    }
  }

  Future<void> _fetchNotifications() async {
    setState(() => _isLoadingNotifs = true);
    try {
      final response = await _apiService.get(ApiConstants.notifications);
      if (mounted) {
        setState(() {
          _notifications = response is List
              ? (response)
                    .map(
                      (n) =>
                          NotificationItem.fromJson(n as Map<String, dynamic>),
                    )
                    .toList()
              : [];
          _isLoadingNotifs = false;
        });
      }
    } catch (e) {
      debugPrint("Failed to fetch notifications: $e");
      if (mounted) setState(() => _isLoadingNotifs = false);
    }
  }

  int get _unreadCount => _notifications.where((n) => n.unread).length;

  void _initializeModules() {
    final user = _apiService.getUser();
    final dept = user?['department']?.toString();
    final desig = user?['designation']?.toString();

    _refinedRole = ModuleConstants.normalizeRole(
      widget.userRole,
      dept: dept,
      desig: desig,
    );

    final allModules = ModuleConstants.getModulesForRole(_refinedRole);

    // Filter main vs management modules based on titles to preserve UI layout
    _mainModules = allModules
        .where(
          (m) =>
              m.title == 'Trips' ||
              m.title == 'My Requests' ||
              m.title == 'FRS Attendance' ||
              m.title == 'My Tracking' ||
              m.title == 'FRS Requests' ||
              m.title == 'Location Tracking' ||
              m.title == 'Job Report',
        )
        .toList();

    _managementModules = allModules
        .where(
          (m) =>
              m.title != 'Trips' &&
              m.title != 'My Requests' &&
              m.title != 'FRS Attendance' &&
              m.title != 'My Tracking' &&
              m.title != 'Location Tracking' &&
              m.title != 'FRS Requests' &&
              m.title != 'Job Report',
        )
        .toList();
  }

  bool _isNavigating = false;
  void _navigateToModule(NavigationModule module) {
    if (_isNavigating) return;

    if (module.title == 'Dashboard') {
      setState(() => _currentIndex = 1);
      return;
    }

    if (module.destinationScreen != null) {
      setState(() => _isNavigating = true);
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => module.destinationScreen!()),
      ).then((_) {
        if (mounted) setState(() => _isNavigating = false);
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${module.title} module coming soon'),
          backgroundColor: Colors.orange,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _currentIndex == 1, // Only allow pop if on Dashboard tab
      onPopInvoked: (didPop) {
        if (didPop) return;
        if (_currentIndex != 1) {
          setState(() => _currentIndex = 1);
        }
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF0FDFA),
        body: IndexedStack(
          index: _currentIndex,
          children: [
            const NotificationsScreen(),
            _buildDashboardHome(),
            ProfilePage(username: widget.username),
          ],
        ),
        bottomNavigationBar: _buildBottomNavBar(),
      ),
    );
  }

  Widget _buildFRSVerificationCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(
                width: 6,
                color: _frsVerifiedThisSession
                    ? const Color(0xFF10B981)
                    : const Color(0xFF7C1D1D),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color:
                              (_frsVerifiedThisSession
                                      ? const Color(0xFF10B981)
                                      : const Color(0xFF0D9488))
                                  .withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _frsVerifiedThisSession
                              ? Icons.verified_user
                              : Icons.face_unlock_rounded,
                          color: _frsVerifiedThisSession
                              ? const Color(0xFF10B981)
                              : const Color(0xFF0D9488),
                          size: 24,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _frsVerifiedThisSession
                                  ? 'Identity Verified'
                                  : 'Action Required',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                            Text(
                              _frsVerifiedThisSession
                                  ? 'Authenticated for this session'
                                  : 'Face Verification (FRS) required',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: const Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (!_frsVerifiedThisSession)
                        ElevatedButton(
                          onPressed: _performFRS,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0D9488),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                            ),
                            elevation: 0,
                          ),
                          child: Text(
                            'VERIFY',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDashboardHome() {
    return RefreshIndicator(
      onRefresh: () async {
        await _fetchDashboardData();
        await _fetchNotifications();
        await LocationTrackingService.syncTrackingWithTrips();
      },
      color: const Color(0xFFBB0633),
      child: Stack(
        children: [
          // Ambient background gradient for a "Designed" light feel
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [const Color(0xFFFFFFFF), const Color(0xFFF0FDFA)],
                ),
              ),
            ),
          ),
          // Executive Mesh Blobs (Ultra-soft atmospheric layers)
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
            top: 250,
            left: -150,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [Colors.orange.withOpacity(0.03), Colors.transparent],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: 100,
            right: -100,
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

          SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(),
                _buildWelcomeSection(),

                if (_isLoadingStats)
                  const Center(
                    child: Padding(
                      padding: EdgeInsets.all(40.0),
                      child: CircularProgressIndicator(
                        color: Color(0xFFBB0633),
                      ),
                    ),
                  )
                else if (_dashboardStats != null) ...[
                  _buildKpiGrid(),
                ],

                // Modules will be shown in ALL SERVICES grid below instead of dedicated header buttons
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Text(
                    'ALL SERVICES',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF94A3B8),
                      letterSpacing: 1.2,
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 8,
                  ),
                  child: _buildModulesGrid([
                    ..._mainModules,
                    ..._managementModules,
                  ]),
                ),
                const SizedBox(height: 100),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWelcomeSection() {
    final now = DateTime.now();
    final formatter = DateFormat('EEEE, d MMMM yyyy').format(now);

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 10, 20, 20),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  formatter.toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    color: const Color(0xFF94A3B8),
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Hello, ${widget.username}!', // Full username
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF0F1E2A),
                    letterSpacing: -1.0,
                    height: 1.1,
                  ),
                ),
                if (_empId != null && _empId!.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    'EMP ID: $_empId',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                      letterSpacing: 0.5,
                    ),
                  ),
                ],
              ],
            ),
          ),
          // Relocated Face Registration icon to the right of welcome message
          if (!_isFaceEnrolled)
            GestureDetector(
              onTap: _enrollFRS,
              child: Stack(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D9488).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.face_retouching_natural,
                      color: Color(0xFF0D9488),
                      size: 28,
                    ),
                  ),
                  Positioned(
                    right: 0,
                    top: 0,
                    child: Container(
                      width: 10,
                      height: 10,
                      decoration: const BoxDecoration(
                        color: Color(0xFFFFD700),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActionButtons() {
    final role = widget.userRole.toLowerCase();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      child: Row(
        children: [
          if (role == 'guesthouse_manager')
            Expanded(
              child: _buildHeaderBtn(
                'Manage Guest Houses',
                Icons.hotel,
                const Color(0xFF0D9488),
                () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const GuestHouseScreen()),
                ),
              ),
            )
          else if (role == 'fleet_manager')
            Expanded(
              child: _buildHeaderBtn(
                'Manage Fleet',
                Icons.directions_car,
                const Color(0xFF0D9488),
                () {}, // Fleet screen coming soon
              ),
            )
          else ...[
            if ([
              'reporting_authority',
              'hr',
              'finance',
              'admin',
              'cfo',
            ].contains(role)) ...[
              Expanded(
                child: _buildHeaderBtn(
                  'Reviews',
                  Icons.pending_actions,
                  Colors.amber[800]!,
                  () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const TripApprovalsScreen(),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: _buildHeaderBtn(
                'New Request',
                Icons.add_circle_outline,
                const Color(0xFF0D9488),
                () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const MyTripsScreen()),
                ), // Or specific create screen
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildHeaderBtn(
    String label,
    IconData icon,
    Color color,
    VoidCallback onTap,
  ) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          decoration: BoxDecoration(
            color: const Color(0xFF134E4A), // Deep Teal
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF134E4A).withOpacity(0.2),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiGrid() {
    final kpis = _dashboardStats?['kpis'] as List? ?? [];
    if (kpis.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'AT A GLANCE',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF334155).withOpacity(0.6),
                  letterSpacing: 1.2,
                ),
              ),
              const Icon(
                Icons.auto_awesome,
                color: Color(0xFF94A3B8),
                size: 18,
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.15, // Increased height to prevent overflow
            ),
            itemCount: kpis.length,
            itemBuilder: (context, index) {
              final kpi = kpis[index];
              final color = _getKpiColor(kpi['color']);

              return Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      color,
                      color.withBlue(color.blue + 20).withRed(color.red - 20),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: [
                    BoxShadow(
                      color: color.withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Stack(
                  clipBehavior: Clip.antiAlias,
                  children: [
                    Positioned(
                      top: -20,
                      left: -20,
                      child: Container(
                        width: 100,
                        height: 100,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: Colors.white.withOpacity(0.1),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  (kpi['title'] ?? '').toString().toUpperCase(),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: Colors.white.withOpacity(0.9),
                                    letterSpacing: 0.5,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  (kpi['value'] ?? '').toString(),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize:
                                        22, // Slightly smaller to fit better
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: -1.0,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  (kpi['label'] ?? '').toString(),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white.withOpacity(0.95),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.18),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.1),
                              ),
                            ),
                            child: Icon(
                              _getKpiIcon(kpi['icon']),
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildRecentActivity() {
    final activity = _dashboardStats?['recent_activity'] as List? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 32, 20, 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'RECENT TRIPS',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 1.2,
                ),
              ),
              TextButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const MyTripsScreen()),
                ),
                child: Text(
                  'View All',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0D9488),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (activity.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 20),
            child: Text('No recent activity found.'),
          )
        else
          ...activity.map(
            (item) => Container(
              margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 6),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(
                      Icons.business_center,
                      color: Color(0xFF64748B),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (item['title'] ?? '').toString(),
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                            fontSize: 13,
                          ),
                        ),
                        Text(
                          (item['subtitle'] ?? '').toString(),
                          style: GoogleFonts.inter(
                            color: const Color(0xFF64748B),
                            fontSize: 11,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        (item['amount'] ?? '').toString(),
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF0F172A),
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: _getStatusColor(
                            (item['status'] ?? '').toString(),
                          ).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          (item['status'] ?? '').toString().toUpperCase(),
                          style: GoogleFonts.inter(
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                            color: _getStatusColor(
                              (item['status'] ?? '').toString(),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Color _getStatusColor(String? status) {
    if (status == null) return const Color(0xFF64748B);
    switch (status.toLowerCase()) {
      case 'approved':
      case 'paid':
      case 'completed':
        return const Color(0xFF10B981);
      case 'pending':
        return Colors.orange;
      case 'rejected':
        return Colors.red;
      default:
        return const Color(0xFF64748B);
    }
  }

  Widget _buildWalletDisplay() {
    final balance = _dashboardStats?['wallet_balance'] ?? 0.0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.15)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            children: [
              const Icon(
                Icons.account_balance_wallet_rounded,
                color: Colors.white,
                size: 18,
              ),
              Positioned(
                right: 0,
                top: 0,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: Colors.amber,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: const Color(0xFF0D9488),
                      width: 1,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'WALLET',
                style: GoogleFonts.inter(
                  fontSize: 7,
                  fontWeight: FontWeight.w900,
                  color: Colors.white.withOpacity(0.7),
                  letterSpacing: 0.8,
                ),
              ),
              Text(
                "₹${NumberFormat('#,###').format(balance)}",
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 15,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFF134E4A), // Deep Teal
            Color(0xFF0F766E), // Teal Dark
            Color(0xFF0D9488), // Modern Teal
          ],
          stops: [0.0, 0.5, 1.0],
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Decorative Orbits
          Positioned(
            top: -50,
            right: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withOpacity(0.05),
                  width: 1,
                ),
              ),
            ),
          ),
          Positioned(
            top: -80,
            right: -80,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withOpacity(0.03),
                  width: 1,
                ),
              ),
            ),
          ),

          // Original Mesh Element (Polished)
          Positioned(
            right: -40,
            top: -20,
            bottom: -20,
            child: Container(
              width: 220,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(160),
                  bottomLeft: Radius.circular(160),
                ),
              ),
            ),
          ),

          Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              16 + MediaQuery.of(context).padding.top,
              20,
              24,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Premium Logo Container
                Container(
                  padding: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    // gradient: LinearGradient(
                    //   colors: [
                    //     Colors.white.withOpacity(0.5),
                    //     Colors.white.withOpacity(0.1),
                    //   ],
                    // ),
                    shape: BoxShape.circle,
                  ),
                  child: Container(
                    // padding: const EdgeInsets.all(10),
                    // decoration: const BoxDecoration(
                    //   color: Colors.white,
                    //   shape: BoxShape.circle,
                    // ),
                    child: Image.asset(
                      'assets/header-icon.png',
                      height: 54,
                      width: 54,
                      errorBuilder: (context, error, stackTrace) => const Icon(
                        Icons.insights_rounded,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Text(
                            'BTGS',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 24,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              color: Color(0xFF4ADE80), // Pulse Green
                              shape: BoxShape.circle,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'Governance Systems',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: Colors.white.withOpacity(0.7),
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                _buildWalletDisplay(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBottomNavBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      child: NavigationBarTheme(
        data: NavigationBarThemeData(
          indicatorColor: const Color(0xFF0D9488).withOpacity(0.1),
          labelTextStyle: MaterialStateProperty.resolveWith((states) {
            if (states.contains(MaterialState.selected)) {
              return GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF0D9488),
              );
            }
            return GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: const Color(0xFF64748B),
            );
          }),
          iconTheme: MaterialStateProperty.resolveWith((states) {
            if (states.contains(MaterialState.selected)) {
              return const IconThemeData(color: Color(0xFF0D9488), size: 26);
            }
            return const IconThemeData(color: Color(0xFF64748B), size: 24);
          }),
        ),
        child: NavigationBar(
          height: 70,
          backgroundColor: Colors.white,
          selectedIndex: _currentIndex,
          onDestinationSelected: (index) {
            if (index == 2) {
              // Trigger dropdown/menu for Account
              _showAccountMenu(context);
            } else {
              setState(() {
                _currentIndex = index;
              });
            }
          },
          destinations: [
            NavigationDestination(
              icon: Stack(
                children: [
                  const Icon(Icons.notifications_outlined),
                  if (_unreadCount > 0)
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0D9488),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '$_unreadCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              selectedIcon: Stack(
                children: [
                  const Icon(Icons.notifications_rounded),
                  if (_unreadCount > 0)
                    Positioned(
                      right: -2,
                      top: -2,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0D9488),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 16,
                          minHeight: 16,
                        ),
                        child: Text(
                          '$_unreadCount',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ),
                ],
              ),
              label: 'Alerts',
            ),
            const NavigationDestination(
              icon: Icon(Icons.grid_view_outlined),
              selectedIcon: Icon(Icons.grid_view_rounded),
              label: 'Home',
            ),
            const NavigationDestination(
              icon: Icon(Icons.person_outline_rounded),
              selectedIcon: Icon(Icons.person_rounded),
              label: 'Account',
            ),
          ],
        ),
      ),
    );
  }

  void _showAccountMenu(BuildContext context) {
    final RenderBox overlay =
        Overlay.of(context).context.findRenderObject() as RenderBox;

    showMenu<String>(
      context: context,
      position: RelativeRect.fromLTRB(
        overlay.size.width - 200,
        overlay.size.height - 180,
        20,
        0,
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      elevation: 10,
      color: Colors.white,
      items: [
        PopupMenuItem(
          value: 'profile',
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D9488).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.person_rounded,
                    color: Color(0xFF0D9488),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 14),
                Text(
                  'My Profile',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ),
        const PopupMenuDivider(height: 1),
        PopupMenuItem(
          value: 'help',
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.help_outline_rounded,
                    color: Colors.blue,
                    size: 18,
                  ),
                ),
                const SizedBox(width: 14),
                Text(
                  'Help & Support',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ).then((value) {
      if (value == 'profile') {
        setState(() {
          _currentIndex = 2;
        });
      } else if (value == 'help') {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => const HelpSupportScreen()),
        );
      }
    });
  }

  IconData _getKpiIcon(String iconName) {
    switch (iconName) {
      case 'Briefcase':
        return Icons.business_center_rounded;
      case 'CreditCard':
        return Icons.account_balance_wallet_rounded;
      case 'TrendingUp':
        return Icons.analytics_rounded;
      case 'Clock':
        return Icons.hourglass_top_rounded;
      default:
        return Icons.insights_rounded;
    }
  }

  Color _getKpiColor(String colorName) {
    switch (colorName) {
      case 'orange':
        return const Color(0xFF6D28D9); // Requested Purple
      case 'red':
        return const Color(0xFF1E3A8A); // Requested Navy Blue
      case 'magenta':
        return const Color(0xFFB91C1C); // Requested Red
      case 'yellow':
        return const Color(0xFFD97706); // Requested Orange
      // Fallbacks
      case 'purple':
        return const Color(0xFF8B5CF6);
      case 'navy':
        return const Color(0xFF1E3A8A);
      default:
        return const Color(0xFF3B82F6); // Professional Blue
    }
  }

  Widget _buildModulesGrid(List<NavigationModule> modules) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
        childAspectRatio:
            0.78, // Taller to accommodate larger icons without overflow
      ),
      itemCount: modules.length,
      itemBuilder: (context, index) {
        final module = modules[index];
        return _buildModuleCard(module);
      },
    );
  }

  Widget _buildModuleCard(NavigationModule module) {
    return GestureDetector(
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 15,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Stack(
          clipBehavior: Clip.antiAlias,
          children: [
            // Decorative Background Gradient (Mesh look)
            Positioned(
              top: -20,
              right: -20,
              child: Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      module.iconColor.withOpacity(0.06),
                      module.iconColor.withOpacity(0),
                    ],
                  ),
                  shape: BoxShape.circle,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: module.iconColor.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: module.iconColor.withOpacity(0.05),
                      ),
                    ),
                    child: Center(
                      child: Icon(
                        module.icon,
                        color: module.iconColor,
                        size: 24,
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    module.title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12, // Smaller title
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                      height: 1.1,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 6),
                  Text(
                    module.description,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 7, // Smaller description
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w700,
                      letterSpacing: 0.1,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            Positioned.fill(
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _navigateToModule(module),
                  borderRadius: BorderRadius.circular(24),
                  splashColor: module.iconColor.withOpacity(0.1),
                  highlightColor: module.iconColor.withOpacity(0.05),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Center(
        child: Column(
          children: [
            Icon(Icons.lock_outline, size: 48, color: Colors.grey[400]),
            const SizedBox(height: 16),
            Text(
              'No modules available',
              style: GoogleFonts.interTight(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
