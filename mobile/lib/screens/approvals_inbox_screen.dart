import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/trip_service.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';

Map<String, dynamic> _parseExpenseDescription(dynamic exp) {
  Map<String, dynamic> details = {};
  try {
    final descRaw = exp['description'];
    if (descRaw is String && descRaw.trim().startsWith('{')) {
      details = Map<String, dynamic>.from(jsonDecode(descRaw.trim()));
    } else if (descRaw is Map) {
      details = Map<String, dynamic>.from(descRaw);
    }
  } catch (_) {}

  // Prioritize explicit backend fields over legacy description string parsing
  if (exp['travel_mode'] != null && exp['travel_mode'].toString().isNotEmpty) {
    details['mode'] = exp['travel_mode'];
  }
  if (exp['class_type'] != null && exp['class_type'].toString().isNotEmpty) {
    details['class'] = exp['class_type'];
    details['classType'] = exp['class_type'];
  }
  if (exp['booking_reference'] != null && exp['booking_reference'].toString().isNotEmpty) {
    details['pnr'] = exp['booking_reference'];
    details['bookingRef'] = exp['booking_reference'];
  }
  if (exp['vehicle_type'] != null && exp['vehicle_type'].toString().isNotEmpty) {
    details['subType'] = exp['vehicle_type'];
    details['vehicleType'] = exp['vehicle_type'];
  }
  if (exp['booked_by'] != null && exp['booked_by'].toString().isNotEmpty) {
    details['bookedBy'] = exp['booked_by'];
  }
  if (exp['cancellation_status'] != null && exp['cancellation_status'].toString().isNotEmpty) {
    details['travelStatus'] = exp['cancellation_status'];
  }
  if (exp['cancellation_date'] != null && exp['cancellation_date'].toString().isNotEmpty) {
    details['cancellationDate'] = exp['cancellation_date'];
  }
  if (exp['refund_amount'] != null) {
    details['refundAmount'] = exp['refund_amount'].toString();
  }
  if (exp['cancellation_reason'] != null && exp['cancellation_reason'].toString().isNotEmpty) {
    details['cancellationReason'] = exp['cancellation_reason'];
  }
  if (exp['odo_start'] != null) {
    details['odoStart'] = exp['odo_start'].toString();
  }
  if (exp['odo_end'] != null) {
    details['odoEnd'] = exp['odo_end'].toString();
  }
  if (exp['distance'] != null) {
    details['totalKm'] = exp['distance'].toString();
  }
  return details;
}

class ApprovalsInboxScreen extends StatefulWidget {
  final bool hideHeader;
  final int? enforceTab;

  const ApprovalsInboxScreen({
    super.key,
    this.hideHeader = false,
    this.enforceTab,
  });

  @override
  State<ApprovalsInboxScreen> createState() => _ApprovalsInboxScreenState();
}

class _ApprovalsInboxScreenState extends State<ApprovalsInboxScreen>
    with SingleTickerProviderStateMixin {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  List<Map<String, dynamic>> _tasks = [];
  Map<String, dynamic> _counts = {
    'total': 0,
    'advances': 0,
    'trips': 0,
    'claims': 0,
  };
  String _activeTab = 'pending';
  String _filterType = 'all';
  String _viewType = 'special'; // 'special' or 'monthly'
  final Set<String> _selectedIds = {}; // for batch actions parity with web
  final TextEditingController _searchController = TextEditingController();
  Map<String, dynamic>? _currentUser;
  final Map<int, Map<String, String>> _batchRowEdits = {};
  bool _isActionLoading = false;
  bool isFinanceHead = false;
  bool isFinanceExec = false;
  bool isHR = false;
  bool isFinance = false;
  final Map<String, String> _batchAmounts = {}; // batchId -> amount
  final Map<String, TextEditingController> _batchControllers =
      {}; // batchId -> controller
  final Set<String> _expandedBatchIds = {}; // for collapsible batch cards

  // PAGINATION CONTROLS
  final ScrollController _scrollController = ScrollController();
  int _currentPage = 1;
  bool _hasMore = true;
  bool _isFetchingMore = false;
  DateTime? _selectedDate;

  final List<Map<String, dynamic>> _filterOptions = [
    {'value': 'all', 'label': 'All'},
    {'value': 'trip', 'label': 'Trip'},
    {'value': 'expense', 'label': 'Expense'},
    {'value': 'advance', 'label': 'Advance'},
    {'value': 'mileage', 'label': 'Mileage'},
    {'value': 'dispute', 'label': 'Dispute'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.enforceTab != null) {
      _activeTab = widget.enforceTab == 0 ? 'pending' : 'history';
    }
    _currentUser = ApiService().getUser();
    _computeRoles();
    _fetchData();
    _scrollController.addListener(_onScroll);
  }

  void _computeRoles() {
    final role = _currentUser?['role_name']?.toString().toLowerCase() ?? '';
    final dept = _currentUser?['department']?.toString().toLowerCase() ?? '';
    final desig = _currentUser?['designation']?.toString().toLowerCase() ?? '';

    isFinanceHead =
        (dept.contains('finance') && dept.contains('head')) ||
        (desig.contains('finance') && desig.contains('head')) ||
        role == 'cfo' ||
        role.contains('cfo');

    isFinance =
        dept.contains('finance') ||
        desig.contains('finance') ||
        role.contains('finance') ||
        isFinanceHead;

    isFinanceExec = isFinance && !isFinanceHead;

    isHR = dept.contains('hr') ||
        desig.contains('hr') ||
        role == 'hr' ||
        role.contains('hr') ||
        dept.contains('human resources') ||
        desig.contains('human resources') ||
        role.contains('human resources') ||
        dept.contains('human resource') ||
        desig.contains('human resource') ||
        role.contains('human resource');
  }

  @override
  void dispose() {
    _scrollController.dispose();
    _searchController.dispose();
    for (var controller in _batchControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
            _scrollController.position.maxScrollExtent * 0.9 &&
        _hasMore &&
        !_isFetchingMore &&
        !_isLoading) {
      _fetchMoreData();
    }
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _currentPage = 1;
      _hasMore = true;
    });
    try {
      final counts = await _tripService.fetchApprovalCounts();
      List<Map<String, dynamic>> finalTasks = [];

      finalTasks = await _tripService.fetchApprovals(
        tab: _activeTab,
        type: _filterType,
        viewType: _viewType,
        search: _searchController.text,
        date: _selectedDate != null
            ? DateFormat('yyyy-MM-dd').format(_selectedDate!)
            : null,
      );

      // Disable pagination/infinite scroll as per requirement to show all records
      _hasMore = false;

      // FRONTEND-SIDE FILTERING (Safeguard)
      // 1. Ensure Bulk Uploads NEVER appear in the 'special' (Special Requests) tab
      // 2. Hide Bulk Upload (Yellow) cards for all Finance users as they use Blue Claim cards
      final isFinance = isFinanceExec || isFinanceHead;
      if (_viewType == 'special' || isFinance) {
        finalTasks = finalTasks.where((t) {
          final isBatch =
              t['type'] == 'Bulk Upload' ||
              t['id']?.toString().startsWith('BATCH-') == true;
          return !isBatch;
        }).toList();
      }

      // Ensure correct labels for Monthly Tour Plan tab
      if (_viewType == 'monthly') {
        finalTasks = finalTasks.map((t) {
          if (t['type'] == 'Bulk Upload' ||
              t['id']?.toString().startsWith('BATCH-') == true) {
            t['type'] = 'Monthly Tour Plan';
          }
          if (t['type'] == null) t['type'] = 'Monthly Tour Plan';
          return t;
        }).toList();
      }
      if (mounted) {
        setState(() {
          _counts = counts;
          _tasks = finalTasks;
          _isLoading = false;
        });

        // AUTO-FETCH NEXT PAGE for seamless loading
        if (_hasMore) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _fetchMoreData(isAuto: true);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        _showError('Failed to load tasks: $e');
      }
    }
  }

  Future<void> _fetchMoreData({bool isAuto = false}) async {
    if (_isFetchingMore || !_hasMore) return;

    if (mounted) setState(() => _isFetchingMore = true);

    // Add a slight delay for "auto" loading to show the loader at the bottom
    if (isAuto) await Future.delayed(const Duration(milliseconds: 100));
    try {
      _currentPage++;
      final moreTasks = await _tripService.fetchApprovals(
        tab: _activeTab,
        type: _filterType,
        viewType: _viewType,
        search: _searchController.text,
        page: _currentPage,
      );

      if (moreTasks.isEmpty || moreTasks.length < 5) {
        _hasMore = false;
      }

      List<Map<String, dynamic>> processedMore = moreTasks;

      // FRONTEND-SIDE FILTERING (Safeguard)
      // 1. Ensure Bulk Uploads NEVER appear in the 'special' tab
      // 2. Hide Bulk Upload (Yellow) cards for all Finance users
      final isFinance = isFinanceExec || isFinanceHead;
      if (_viewType == 'special' || isFinance) {
        processedMore = processedMore.where((t) {
          final isBatch =
              t['type'] == 'Bulk Upload' ||
              t['id']?.toString().startsWith('BATCH-') == true;
          return !isBatch;
        }).toList();
      }

      // Ensure correct labels for Monthly Tour Plan tab
      if (_viewType == 'monthly') {
        processedMore = processedMore.map((t) {
          if (t['type'] == 'Bulk Upload' ||
              t['id']?.toString().startsWith('BATCH-') == true) {
            t['type'] = 'Monthly Tour Plan';
          }
          if (t['type'] == null) t['type'] = 'Monthly Tour Plan';
          return t;
        }).toList();
      }

      if (mounted) {
        setState(() {
          _tasks.addAll(processedMore);
          _isFetchingMore = false;
        });

        // CONTINUE AUTO-FETCHING until all records are loaded
        if (_hasMore) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            _fetchMoreData(isAuto: true);
          });
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isFetchingMore = false;
          // If we hit an "Invalid page" error, it means we've reached the end
          if (e.toString().contains('Invalid page') ||
              e.toString().contains('404')) {
            _hasMore = false;
          }
        });
        if (!_hasMore) return; // Silent stop for end of pages
        _showError('Failed to load more: $e');
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: const Color(0xFFEF4444),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  void _handleFilterChange(String type) {
    setState(() => _filterType = type);
    _fetchData();
  }

  Future<void> _handleAction(
    String id,
    String action, {
    Map<String, dynamic>? extra,
  }) async {
    try {
      final Map<String, dynamic> finalExtra = {
        ...?extra,
        if (_batchAmounts.containsKey(id)) ...{
          'executive_approved_amount': _batchAmounts[id],
          'approved_amount': _batchAmounts[id],
        },
      };

      if (id.startsWith('BATCH-') && action.toLowerCase() != 'markread') {
        final batchId = id.replaceAll('BATCH-', '');
        String backendAction = action.toLowerCase();
        if (backendAction == 'approvevalid') {
          backendAction = 'approve';
        } else if (backendAction == 'rejectall') {
          backendAction = 'reject';
        }
        await _tripService.handleBulkBatchAction(
          batchId,
          backendAction,
          extraData: finalExtra,
        );
      } else {
        await _tripService.performApproval(id, action, extraData: finalExtra);
      }
      // mirror web toast wording EXACTLY: "Request Approved successfully"
      String verb;
      switch (action.toLowerCase()) {
        case 'approve':
        case 'approvevalid':
          verb = action.toLowerCase() == 'approvevalid'
              ? 'Approved Valid Entries'
              : 'Approved';
          break;
        case 'reject':
        case 'rejectall':
        case 'rejectbyfinance':
          verb = action.toLowerCase() == 'rejectall'
              ? 'Rejected All Entries'
              : 'Rejected';
          break;
        case 'pay':
          verb = 'Paid';
          break;
        case 'markread':
          verb = 'Marked as Read';
          break;
        default:
          verb = '${action}ed';
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Request $verb successfully'),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      setState(() => _selectedIds.clear());
      _fetchData();
    } catch (e) {
      String message = e.toString();
      if (e.toString().contains('Unauthorized')) {
        message = 'Your session has expired. Please login again.';
      } else if (e.toString().contains('authorized')) {
        message = 'You are not authorized to perform this action.';
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(message),
          backgroundColor: const Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
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
                    const Color(0xFF0D9488).withOpacity(0.04),
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
              _buildFilterToggleSection(),
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF0D9488),
                        ),
                      )
                    : RefreshIndicator(
                        onRefresh: _fetchData,
                        color: const Color(0xFF0D9488),
                        child: _tasks.isEmpty
                            ? _buildEmptyState()
                            : ListView.builder(
                                controller: _scrollController,
                                padding: const EdgeInsets.all(20),
                                itemCount: _tasks.length + (_hasMore ? 1 : 0),
                                itemBuilder: (context, index) {
                                  if (index == _tasks.length) {
                                    return _isFetchingMore
                                        ? const Padding(
                                            padding: EdgeInsets.symmetric(
                                              vertical: 20,
                                            ),
                                            child: Center(
                                              child: CircularProgressIndicator(
                                                color: Color(0xFF0D9488),
                                                strokeWidth: 2,
                                              ),
                                            ),
                                          )
                                        : const SizedBox.shrink();
                                  }
                                  return _buildTaskCard(_tasks[index]);
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

  Widget _buildCustomHeader() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
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
                      Icons.verified_user_rounded,
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
                          'EXECUTIVE CONTROL',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.white.withOpacity(0.7),
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'Approval Inbox',
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
                  if (_selectedDate != null)
                    IconButton(
                      icon: const Icon(
                        Icons.close_rounded,
                        color: Colors.white,
                      ),
                      onPressed: () {
                        setState(() => _selectedDate = null);
                        _fetchData();
                      },
                    ),
                  IconButton(
                    icon: Icon(
                      Icons.calendar_month_rounded,
                      color: _selectedDate != null
                          ? const Color(0xFFFDE68A)
                          : Colors.white,
                    ),
                    onPressed: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: _selectedDate ?? DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2100),
                        builder: (context, child) {
                          return Theme(
                            data: Theme.of(context).copyWith(
                              colorScheme: const ColorScheme.light(
                                primary: Color(0xFF0D9488),
                                onPrimary: Colors.white,
                                onSurface: Color(0xFF0F172A),
                              ),
                            ),
                            child: child!,
                          );
                        },
                      );
                      if (picked != null) {
                        setState(() => _selectedDate = picked);
                        _fetchData();
                      }
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterToggleSection() {
    return Padding(
      padding: EdgeInsets.fromLTRB(16, widget.hideHeader ? 8 : 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!widget.hideHeader) ...[
            Row(
              children: [
                Expanded(
                  child: _buildToggleBtn(
                    'pending',
                    Icons.access_time_filled_rounded,
                    'Active Queue',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildToggleBtn(
                    'history',
                    Icons.check_circle_rounded,
                    'History',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
          // Special Requests / Monthly Tour Plan
          if (_canSeeMonthlyTourPlan())
            Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Row(
                children: [
                  Expanded(child: _categoryBtn('special', 'Special Requests')),
                  Expanded(child: _categoryBtn('monthly', 'Monthly Tour Plan')),
                ],
              ),
            ),
          const SizedBox(height: 10),
          // ── Label + Date chip + Type dropdown ──────────────────────────
          Row(
            children: [
              Text(
                '${_activeTab.toUpperCase()} APPROVALS',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0D9488),
                  letterSpacing: 0.8,
                ),
              ),
              const Spacer(),
              // ── Date chip ──────────────────────────────────────────────
              GestureDetector(
                onTap: () async {
                  final picked = await showDatePicker(
                    context: context,
                    initialDate: _selectedDate ?? DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2100),
                    builder: (ctx, child) => Theme(
                      data: Theme.of(ctx).copyWith(
                        colorScheme: const ColorScheme.light(
                          primary: Color(0xFF0D9488),
                          onPrimary: Colors.white,
                          onSurface: Color(0xFF0F172A),
                        ),
                      ),
                      child: child!,
                    ),
                  );
                  if (picked != null) {
                    setState(() => _selectedDate = picked);
                    _fetchData();
                  }
                },
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: _selectedDate != null
                        ? const Color(0xFFFEF3C7)
                        : Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: _selectedDate != null
                          ? const Color(0xFFF59E0B)
                          : const Color(0xFFCCFBF1),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.calendar_month_rounded,
                        size: 13,
                        color: _selectedDate != null
                            ? const Color(0xFFF59E0B)
                            : const Color(0xFF0D9488),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _selectedDate != null
                            ? DateFormat('MMM dd').format(_selectedDate!)
                            : 'Date',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: _selectedDate != null
                              ? const Color(0xFF92400E)
                              : const Color(0xFF0D9488),
                        ),
                      ),
                      if (_selectedDate != null) ...[
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () {
                            setState(() => _selectedDate = null);
                            _fetchData();
                          },
                          child: const Icon(
                            Icons.close_rounded,
                            size: 12,
                            color: Color(0xFFF59E0B),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              // ── Type dropdown ──────────────────────────────────────────
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: const Color(0xFFCCFBF1)),
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _filterType,
                    isDense: true,
                    icon: const Icon(
                      Icons.arrow_drop_down_rounded,
                      color: Color(0xFF0D9488),
                      size: 20,
                    ),
                    style: GoogleFonts.plusJakartaSans(
                      color: const Color(0xFF134E4A),
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                    dropdownColor: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    items: _filterOptions
                        .map(
                          (f) => DropdownMenuItem<String>(
                            value: f['value'],
                            child: Text(f['label']!),
                          ),
                        )
                        .toList(),
                    onChanged: (v) {
                      if (v != null) _handleFilterChange(v);
                    },
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  bool _canSeeMonthlyTourPlan() {
    // All authenticated users in the inbox should be able to see both categories
    return _currentUser != null;
  }

  Widget _categoryBtn(String type, String label) {
    bool isSelected = _viewType == type;
    return GestureDetector(
      onTap: () {
        setState(() => _viewType = type);
        _fetchData();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF134E4A) : Colors.transparent,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: FontWeight.w900,
            color: isSelected ? Colors.white : const Color(0xFF64748B),
          ),
        ),
      ),
    );
  }

  Widget _buildToggleBtn(String mode, IconData icon, String label) {
    final isActive = _activeTab == mode;
    return GestureDetector(
      onTap: () {
        setState(() {
          _activeTab = mode;
        });
        _fetchData();
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF134E4A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isActive ? const Color(0xFF134E4A) : const Color(0xFFE2E8F0),
          ),
          boxShadow: isActive
              ? [
                  BoxShadow(
                    color: const Color(0xFF134E4A).withOpacity(0.3),
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

  // _buildTypeFilterSection is now inlined in _buildFilterToggleSection
  Widget _buildTypeFilterSection_UNUSED() {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 10, 20, 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '$_activeTab Approvals'.toUpperCase(),
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF0D9488),
              letterSpacing: 1.0,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFCCFBF1)),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0D9488).withOpacity(0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (_selectedDate != null)
                  IconButton(
                    icon: const Icon(
                      Icons.close_rounded,
                      color: Color(0xFF0D9488),
                      size: 18,
                    ),
                    onPressed: () {
                      setState(() => _selectedDate = null);
                      _fetchData();
                    },
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  ),
                IconButton(
                  icon: Icon(
                    Icons.calendar_month_rounded,
                    color: _selectedDate != null
                        ? const Color(0xFFF59E0B)
                        : const Color(0xFF0D9488),
                    size: 18,
                  ),
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: _selectedDate ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime(2100),
                      builder: (context, child) {
                        return Theme(
                          data: Theme.of(context).copyWith(
                            colorScheme: const ColorScheme.light(
                              primary: Color(0xFF0D9488),
                              onPrimary: Colors.white,
                              onSurface: Color(0xFF0F172A),
                            ),
                          ),
                          child: child!,
                        );
                      },
                    );
                    if (picked != null) {
                      setState(() => _selectedDate = picked);
                      _fetchData();
                    }
                  },
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  constraints: const BoxConstraints(),
                ),
                Flexible(
                  child: Text(
                    _selectedDate != null
                        ? DateFormat('MMM dd').format(_selectedDate!)
                        : 'DATE',
                    style: GoogleFonts.plusJakartaSans(
                      color: const Color(0xFF0D9488),
                      fontWeight: FontWeight.w700,
                      fontSize: 10,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 4),
                Container(height: 16, width: 1, color: const Color(0xFFCCFBF1)),
                Flexible(
                  flex: 2,
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _filterType,
                      isExpanded: true,
                      icon: const Icon(
                        Icons.arrow_drop_down_rounded,
                        color: Color(0xFF0D9488),
                        size: 24,
                      ),
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF134E4A),
                        fontWeight: FontWeight.w800,
                        fontSize: 11,
                      ),
                      dropdownColor: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      items: _filterOptions.map((filter) {
                        return DropdownMenuItem<String>(
                          value: filter['value'],
                          child: Text(
                            filter['label'],
                            style: const TextStyle(fontSize: 11),
                          ),
                        );
                      }).toList(),
                      onChanged: (String? newValue) {
                        if (newValue != null) {
                          _handleFilterChange(newValue);
                        }
                      },
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

  Widget _buildTaskCard(Map<String, dynamic> task) {
    if (task['type'] != 'Monthly Tour Plan' && (
        task['type'] == 'Bulk Upload' ||
        task['id']?.toString().startsWith('BATCH-') == true)) {
      return _buildBulkBatchSection(task);
    }
    final bool isHistory = _activeTab == 'history';
    final String statusStr = (task['status'] ?? '').toString().toLowerCase();
    final statusColor = statusStr.contains('approved')
        ? Colors.green
        : (statusStr.contains('rejected')
              ? Colors.red
              : (statusStr.contains('resubmitted')
                    ? Colors.deepOrange
                    : const Color(0xFFF59E0B)));

    final bool isClaim =
        task['type']?.toString().toLowerCase().contains('claim') == true ||
        task['id']?.toString().toUpperCase().startsWith('CLAIM-') == true;

    Color cardBg = Colors.white;
    Color cardBorder = const Color(0xFFF1F5F9);
    Color accentColor = const Color(0xFF0D9488);
    Color shadowColor = const Color(0xFF0F172A).withOpacity(0.03);

    if (isClaim) {
      cardBg = const Color(0xFFF0F9FF);
      cardBorder = const Color(0xFF7DD3FC);
      accentColor = const Color(0xFF0369A1);
      shadowColor = const Color(0xFF0369A1).withOpacity(0.04);
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: cardBg,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: cardBorder, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: shadowColor,
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24),
        child: InkWell(
          onTap: () => _showTaskDetails(task),
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
                      (task['type'] == 'Bulk Upload' && task['trip_id'] != null)
                          ? task['trip_id']
                          : (task['id'] ?? 'N/A'),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF94A3B8),
                        letterSpacing: 0.5,
                      ),
                    ),
                    if (isHistory)
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
                          task['status']?.toString().toUpperCase() ?? '',
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
                Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: isClaim
                          ? const Color(0xFFE0F2FE)
                          : const Color(0xFFF1F5F9),
                      child: Text(
                        (task['requester']?.toString() ?? '?')[0].toUpperCase(),
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w900,
                          fontSize: 14,
                          color: isClaim
                              ? const Color(0xFF0369A1)
                              : const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            task['requester'] ?? 'User',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF0F172A),
                              letterSpacing: -0.3,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            task['type']?.toString().toUpperCase() ?? 'REQUEST',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 9,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.0,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  task['purpose'] ?? '',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    color: const Color(0xFF475569),
                    fontWeight: FontWeight.w600,
                    height: 1.4,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(
                          Icons.calendar_today_rounded,
                          size: 12,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          task['date'] ?? '',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    if (isClaim)
                      Text(
                        (task['details']?['executive_approved_amount'] != null &&
                                double.tryParse(
                                      task['details']?['executive_approved_amount']
                                              .toString() ??
                                          '0',
                                    )! >
                                    0)
                            ? '₹${NumberFormat('#,##,###.##').format(double.parse(task['details']['executive_approved_amount'].toString()))}'
                            : (task['cost'] ?? '₹0'),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                          color: accentColor,
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

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Color(0xFFF0FDFA),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.verified_user_rounded,
              size: 40,
              color: Color(0xFF0D9488),
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'All caught up!',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No pending approvals found for your review.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              color: const Color(0xFF64748B),
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  void _showTaskDetails(Map<String, dynamic> task) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.9,
        maxChildSize: 0.9,
        minChildSize: 0.5,
        builder: (context, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(32),
              topRight: Radius.circular(32),
            ),
          ),
          child: _TaskDetailsContent(
            task: task,
            isHistory: _activeTab == 'history',
            onAction: (action, {Map<String, dynamic>? extra}) {
              Navigator.pop(context);
              _handleAction(task['id'], action, extra: extra);
            },
            onRefresh: _fetchData, // Pass refresh callback
          ),
        ),
      ),
    );
  }

  // ─── Monthly Tour Plan / Bulk Activity Batch ─────────────────────────────

  List<dynamic> _extractBatchRows(Map<String, dynamic> task) {
    // 1. Try top-level data_json first (direct BATCH- items)
    dynamic raw = task['data_json'];
    if (raw != null) {
      if (raw is List && raw.isNotEmpty) return raw;
      // data_json may arrive as a JSON string — decode it
      if (raw is String && raw.isNotEmpty) {
        try {
          final decoded = jsonDecode(raw);
          if (decoded is List && decoded.isNotEmpty) return decoded;
        } catch (_) {}
      }
    }

    // 2. Merge rows from ALL activity_batches (not just index 0)
    //    The first batch may be a parent/header with no rows; real data is in later ones.
    final batches = task['details']?['activity_batches'];
    if (batches is List && batches.isNotEmpty) {
      final merged = <dynamic>[];
      for (final b in batches) {
        dynamic bRaw = b['data_json'];
        if (bRaw is List) {
          merged.addAll(bRaw);
        } else if (bRaw is String && bRaw.isNotEmpty) {
          try {
            final decoded = jsonDecode(bRaw);
            if (decoded is List) merged.addAll(decoded);
          } catch (_) {}
        }
      }
      if (merged.isNotEmpty) return merged;
    }
    return [];
  }

  Widget _buildBulkBatchSection(Map<String, dynamic> task) {
    final List<dynamic> rows = _extractBatchRows(task);
    final taskId = task['id']?.toString() ?? '';
    final isClaim = taskId.startsWith('CLAIM-');

    final List<Map<String, dynamic>> indexedRows = [];
    for (int i = 0; i < rows.length; i++) {
      final r = Map<String, dynamic>.from(rows[i] as Map);
      r['_original_index_in_batch'] = i;
      indexedRows.add(r);
    }

    final filteredRows = indexedRows.where((r) {
      final dateStr = r['date']?.toString() ?? '';
      return !dateStr.toLowerCase().contains('instruc');
    }).toList();

    final String batchStatus = task['status']?.toString() ?? 'Pending Approval';
    final bool isResubmittedBatch = batchStatus.toLowerCase().contains('resubmitted');
    
    final displayRows = filteredRows.where((r) {
      if (isResubmittedBatch) {
        final rowStatus = (r['_status'] ?? r['status'] ?? '').toString().toLowerCase().trim();
        final isValidated = rowStatus == 'validated' || rowStatus == 'ok' || rowStatus == 'approved';
        return !isValidated;
      }
      return true;
    }).toList();

    final List<dynamic> allExpenses =
        (task['details']?['expenses'] as List?) ?? [];

    final String tripId = task['trip_id']?.toString() ?? 'N/A';
    final String requester = task['requester']?.toString() ?? 'Unknown';
    final String batchId =
        task['id']?.toString() ?? 'BATCH-${task['db_id'] ?? task['batch_id']}';

    final bool isExpanded = _expandedBatchIds.contains(batchId);

    final bool hasRowWiseEditing = (() {
      final String type = task['type'] ?? '';
      final details = task['details'] ?? {};

      if (type == 'Money Top-up / Advance') return false;
      final List expenses = details['expenses'] is List ? details['expenses'] : [];
      return expenses.isNotEmpty;
    })();

    final bool canEdit =
        (task['details']?['permissions']?['can_edit_amount'] ??
            task['permissions']?['can_edit_amount']) ??
        isFinanceExec;

    // Initialize amount and controller for Finance Executive if not already set
    // Initialize amount and controller based on Admin-defined permissions
    if (canEdit && !_batchControllers.containsKey(batchId)) {
      final dynamic details = task['details'] ?? {};
      final execRaw =
          (task['executive_approved_amount'] ??
                  details['executive_approved_amount'])
              ?.toString();
      final execVal = double.tryParse(execRaw ?? '0') ?? 0.0;

      String initialValue;
      if (execRaw != null && execVal > 0) {
        initialValue = execRaw;
      } else {
        initialValue =
            details['requested_amount']?.toString() ??
            task['cost']?.toString().replaceAll('₹', '').replaceAll(',', '') ??
            '';
      }
      _batchAmounts[batchId] = initialValue;
      _batchControllers[batchId] = TextEditingController(text: initialValue);
    }

    final String currentExecAmount =
        _batchAmounts[batchId] ?? _batchControllers[batchId]?.text ?? '';

    final bool isBatch = taskId.startsWith('BATCH-');

    Color bgColor = Colors.white;
    Color borderColor = const Color(0xFFF1F5F9);
    Color iconColor = const Color(0xFF0D9488);
    Color iconBgColor = const Color(0xFF0D9488).withOpacity(0.06);
    Color shadowColor = const Color(0xFF0F172A).withOpacity(0.04);

    if (isBatch) {
      bgColor = const Color(0xFFFFFBEB);
      borderColor = const Color(0xFFFBBF24);
      iconColor = const Color(0xFFD97706);
      iconBgColor = const Color(0xFFFEF3C7);
      shadowColor = const Color(0xFFD97706).withOpacity(0.06);
    } else if (isClaim) {
      bgColor = const Color(0xFFF0F9FF);
      borderColor = const Color(0xFF7DD3FC);
      iconColor = const Color(0xFF0369A1);
      iconBgColor = const Color(0xFFE0F2FE);
      shadowColor = const Color(0xFF0369A1).withOpacity(0.06);
    }

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: borderColor, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: shadowColor,
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header / Summary Card
          InkWell(
            onTap: () {
              setState(() {
                if (isExpanded) {
                  _expandedBatchIds.remove(batchId);
                } else {
                  _expandedBatchIds.add(batchId);
                }
              });
            },
            borderRadius: BorderRadius.circular(24),
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: iconBgColor,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          isClaim
                              ? Icons.receipt_long_rounded
                              : Icons.upload_file_rounded,
                          color: iconColor,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isBatch ? 'Bulk Upload Submitted' : requester,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 16,
                                fontWeight: FontWeight.w900,
                                color: isBatch
                                    ? const Color(0xFF92400E)
                                    : const Color(0xFF0F172A),
                              ),
                            ),
                            if (isBatch)
                              Text(
                                'by $requester',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFFB45309),
                                ),
                              ),
                            const SizedBox(height: 2),
                            Text(
                              'Trip ID: $tripId',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                            if (isExpanded) ...[
                              if ((task['purpose'] ?? '')
                                  .toString()
                                  .isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(
                                  task['purpose'].toString(),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFFBB0633),
                                  ),
                                ),
                              ],
                              const SizedBox(height: 4),
                              Row(
                                children: [
                                  Icon(
                                    Icons.summarize_rounded,
                                    size: 12,
                                    color: iconColor.withOpacity(0.7),
                                  ),
                                  const SizedBox(width: 4),
                                  Flexible(
                                    child: Text(
                                      '${displayRows.length} daily entries',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        color: iconColor,
                                      ),
                                    ),
                                  ),
                                  if (task['file_name'] != null) ...[
                                    const SizedBox(width: 8),
                                    const Text(
                                      '•',
                                      style: TextStyle(color: Colors.grey),
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'File: ${task['file_name']}',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w600,
                                          color: const Color(0xFF64748B),
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            ],
                          ],
                        ),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Builder(
                            builder: (context) {
                              final batchStatus =
                                  task['status']?.toString() ??
                                  'Pending Approval';
                              final isApproved = batchStatus
                                  .toLowerCase()
                                  .contains('approved');
                              final isRejected = batchStatus
                                  .toLowerCase()
                                  .contains('rejected');
                              final isResubmitted = batchStatus
                                  .toLowerCase()
                                  .contains('resubmitted');
                              final badgeBg = isApproved
                                  ? const Color(0xFFDCFCE7)
                                  : isRejected
                                  ? const Color(0xFFFEE2E2)
                                  : isResubmitted
                                  ? const Color(0xFFFEF3C7)
                                  : const Color(0xFFF1F5F9);
                              final badgeColor = isApproved
                                  ? const Color(0xFF16A34A)
                                  : isRejected
                                  ? const Color(0xFFDC2626)
                                  : isResubmitted
                                  ? const Color(0xFFD97706)
                                  : const Color(0xFF64748B);
                              return Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: badgeBg,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  batchStatus,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w900,
                                    color: badgeColor,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 12),
                          if (isClaim &&
                              (task['cost'] ?? '').toString().isNotEmpty &&
                              task['cost'] != '—' &&
                              task['cost'] != '0')
                            Text(
                              task['cost'].toString(),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF0F172A),
                              ),
                            ),
                          const SizedBox(height: 4),
                          Icon(
                            isExpanded
                                ? Icons.keyboard_arrow_up_rounded
                                : Icons.keyboard_arrow_down_rounded,
                            color: const Color(0xFF94A3B8),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isClaim
                                ? Icons.payments_outlined
                                : Icons.route_outlined,
                            size: 14,
                            color: const Color(0xFF94A3B8),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isClaim
                                ? '${allExpenses.length} Expense Items'
                                : '${displayRows.length} Activities',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF475569),
                            ),
                          ),
                        ],
                      ),
                      if (isClaim)
                        Text(
                          task['date']?.toString() ?? '',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF94A3B8),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),

          if (isExpanded) ...[
            const Divider(height: 1, color: Color(0xFFF1F5F9)),
            Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  // EXPENSES BREAKDOWN (for Claims)
                  if (allExpenses.isNotEmpty) ...[
                    Row(
                      children: [
                        const Icon(
                          Icons.payments_outlined,
                          size: 14,
                          color: Color(0xFF64748B),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'EXPENSES BREAKDOWN',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _buildExpenseBreakdown(allExpenses),
                    const SizedBox(height: 20),
                    if (filteredRows.isNotEmpty) ...[
                      const Divider(height: 1, color: Color(0xFFF1F5F9)),
                      const SizedBox(height: 20),
                    ],
                  ],

                  if (filteredRows.isNotEmpty) ...[
                    Row(
                      children: [
                        const Icon(
                          Icons.route_outlined,
                          size: 14,
                          color: Color(0xFF64748B),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'TRAVEL MOVEMENTS',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ...displayRows.map((row) {
                      final idx = row['_original_index_in_batch'] as int;
                      return _buildBulkRowCard(idx, row, task);
                    }),
                  ],

                  // Executive Amount Adjustment Field (Moved outside filteredRows check)
                  if (canEdit &&
                      [
                        'PENDING',
                        'PENDING_HR',
                        'SUBMITTED',
                        'MANAGER APPROVED',
                        'RESUBMITTED',
                        'FORWARDED',
                        'PENDING_EXECUTIVE',
                        'PENDING_HEAD',
                        'APPROVED',
                        'HR APPROVED',
                        'REJECTED_BY_HEAD',
                        'PENDING_FINAL_RELEASE',
                      ].contains(task['status']?.toString().toUpperCase())) ...[
                    const SizedBox(height: 32),
                    const Divider(height: 1, color: Color(0xFFF1F5F9)),
                    const SizedBox(height: 24),
                    Text(
                      'Total Valid Expense (Gross)',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Text(
                          '₹',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            enabled: !hasRowWiseEditing,
                            keyboardType: const TextInputType.numberWithOptions(
                              decimal: true,
                            ),
                            decoration: InputDecoration(
                              hintText: '0.00',
                              filled: hasRowWiseEditing,
                              fillColor: hasRowWiseEditing ? const Color(0xFFE2E8F0) : null,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 8,
                              ),
                            ),
                            controller: _batchControllers[batchId],
                            onChanged: (v) {
                              double entered = double.tryParse(v) ?? 0.0;
                              final rawRequested =
                                  task['details']?['requested_amount']
                                      ?.toString() ??
                                  task['cost']?.toString() ??
                                  '0';
                              final requestedStr = rawRequested
                                  .replaceAll('₹', '')
                                  .replaceAll(',', '')
                                  .trim();
                              double requested =
                                  double.tryParse(requestedStr) ?? 0.0;

                              if (entered > requested) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      'Amount cannot exceed requested ₹$requested',
                                    ),
                                    backgroundColor: Colors.red,
                                    duration: const Duration(seconds: 2),
                                  ),
                                );
                                // Clamp to requested
                                String clamped = requested.toStringAsFixed(2);
                                _batchAmounts[batchId] = clamped;
                                _batchControllers[batchId]?.text = clamped;
                                _batchControllers[batchId]?.selection =
                                    TextSelection.fromPosition(
                                      TextPosition(offset: clamped.length),
                                    );
                              } else {
                                _batchAmounts[batchId] = v;
                              }
                              setState(() {});
                            },
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: hasRowWiseEditing ? const Color(0xFF64748B) : const Color(0xFF10B981),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],

                  // Dynamic Recommendation Card (visible to any subsequent level)
                  Builder(
                    builder: (context) {
                      final rawInherited =
                          (task['executive_approved_amount'] ??
                                  task['details']?['executive_approved_amount'])
                              ?.toString();
                      final inheritedAmt =
                          double.tryParse(rawInherited ?? '0') ?? 0.0;

                      if (inheritedAmt <= 0) return const SizedBox.shrink();

                      return Column(
                        children: [
                          const SizedBox(height: 24),
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0F9FF),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFBAE6FD),
                              ),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    task['workflow_label'] ??
                                        'Previous Level Recommendation',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF0369A1),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  '₹${inheritedAmt.toStringAsFixed(2)}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w900,
                                    color: const Color(0xFFBB0633),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    },
                  ),

                  const SizedBox(height: 20),

                  // Action Buttons
                  if (task['is_intimation'] == true)
                    if (task['can_mark_read'] == true &&
                        _activeTab != 'history')
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () =>
                                _handleAction(task['id'], 'MarkRead'),
                            icon: const Icon(
                              Icons.mark_email_read_rounded,
                              size: 20,
                            ),
                            label: Text(
                              'Mark as Read',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w900,
                                fontSize: 14,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFA9052E),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              elevation: 0,
                            ),
                          ),
                        ),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFD1FAE5),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(
                                  Icons.check_circle_rounded,
                                  color: Color(0xFF059669),
                                  size: 16,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'Acknowledged (Outbox)',
                                  style: GoogleFonts.plusJakartaSans(
                                    color: const Color(0xFF059669),
                                    fontWeight: FontWeight.w700,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )
                  else if (_activeTab != 'history')
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () =>
                                _handleAction(task['id'], 'Approve'),
                            icon: const Icon(
                              Icons.check_circle_rounded,
                              size: 20,
                            ),
                            label: Text(
                              canEdit
                                  ? 'Verify & Approve (₹$currentExecAmount)'
                                  : (isFinanceExec || isFinanceHead)
                                  ? 'Authorize Payment (₹$currentExecAmount)'
                                  : 'Approve All',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                              ),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              elevation: 0,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () =>
                                _handleAction(task['id'], 'Reject'),
                            icon: const Icon(Icons.cancel_rounded, size: 20),
                            label: Text(
                              'Reject All',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w900,
                                fontSize: 13,
                              ),
                            ),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: const Color(0xFFEF4444),
                              side: const BorderSide(color: Color(0xFFFEE2E2)),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
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
        ],
      ),
    );
  }

  IconData _getCategoryIcon(String category) {
    category = category.toLowerCase();
    if (category.contains('mileage') || category.contains('fuel')) {
      return Icons.local_gas_station_rounded;
    }
    if (category.contains('toll')) return Icons.toll_rounded;
    if (category.contains('parking')) return Icons.local_parking_rounded;
    if (category.contains('food') || category.contains('meal')) {
      return Icons.restaurant_rounded;
    }
    if (category.contains('room') || category.contains('hotel')) {
      return Icons.hotel_rounded;
    }
    if (category.contains('repair')) return Icons.build_rounded;
    return Icons.payments_rounded;
  }

  Widget _buildBulkRowCard(
    int idx,
    Map<String, dynamic> row,
    Map<String, dynamic> task,
  ) {
    final bool isHistory = _activeTab == 'history';
    final editState = _batchRowEdits[idx] ?? {};
    final rowStatus = editState['status'] ?? row['_status']?.toString() ?? '';
    final isRejected = rowStatus == 'Rejected';
    final isValidated = rowStatus == 'Validated' || rowStatus == 'OK';
    final startTime = row['start_time']?.toString() ?? '';
    final reachTime =
        row['reach_time']?.toString() ?? row['end_time']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isRejected
            ? const Color(0xFFFFF1F2)
            : isValidated
            ? const Color(0xFFF0FDF4)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isRejected
              ? const Color(0xFFFECACA)
              : isValidated
              ? const Color(0xFFBBF7D0)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Row(
                    children: [
                      const Icon(
                        Icons.calendar_today_rounded,
                        size: 13,
                        color: Color(0xFF94A3B8),
                      ),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          row['date']?.toString() ?? '',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF0F172A),
                          ),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
                if ((row['expense_amount'] ?? '0').toString() != '0')
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFBB0633).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '₹${row['expense_amount']}',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFFBB0633),
                      ),
                    ),
                  ),
                if (isRejected)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'REJECTED',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  )
                else if (isValidated)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'VALIDATED',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                if ((task['details']['deviated_indices'] as List?)?.contains(
                      idx,
                    ) ==
                    true) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'DEVIATED',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FROM',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        row['origin_route']?.toString() ?? '-',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(
                    Icons.arrow_forward_rounded,
                    color: Color(0xFFBB0633),
                    size: 16,
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'TO',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        row['destination_route']?.toString() ?? '-',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _timeChip('START', startTime),
                const SizedBox(width: 8),
                const Icon(
                  Icons.arrow_right_alt_rounded,
                  color: Color(0xFF94A3B8),
                  size: 18,
                ),
                const SizedBox(width: 8),
                _timeChip('REACH', reachTime),
                const SizedBox(width: 12),
                if ((row['incidental_amount'] ?? '0').toString() != '0')
                  _miniExpensePill(
                    'I: ₹${row['incidental_amount']}',
                    Icons.receipt_outlined,
                  ),
                if ((row['odo_total'] ?? '0').toString() != '0') ...[
                  const SizedBox(width: 6),
                  _miniExpensePill(
                    'M: ₹${row['odo_total']}',
                    Icons.local_gas_station_rounded,
                  ),
                ],
                const Spacer(),
                if ((row['visit_intent'] ?? '').toString().isNotEmpty)
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        row['visit_intent']?.toString() ?? '',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF475569),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (row['jobReportAttachments'] != null ||
              row['odoStartImg'] != null ||
              row['odoEndImg'] != null) ...[
            const SizedBox(height: 12),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    if (row['odoStartImg'] != null)
                      _miniImageThumbnail(row['odoStartImg'], "Start"),
                    if (row['odoEndImg'] != null)
                      _miniImageThumbnail(row['odoEndImg'], "End"),
                    if (row['jobReportAttachments'] != null)
                      ...(row['jobReportAttachments'] as List)
                          .map(
                            (s) => _miniImageThumbnail(s.toString(), "Job Pic"),
                          )
                          .toList(),
                  ],
                ),
              ),
            ),
          ],
          // Show remarks from server or from locally-saved rejection (before next refresh)
          if ((row['_remarks'] ?? editState['remark'] ?? '')
              .toString()
              .isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 13,
                      color: Color(0xFFEF4444),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        (row['_remarks'] ?? editState['remark'] ?? '')
                            .toString(),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFFDC2626),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          // Hide action buttons once this row is rejected or validated (from server OR locally)
          // Also hide them if this is an Expense Claim (where activities are already final context)
          if (!isHistory &&
              rowStatus != 'Rejected' &&
              !isValidated &&
              rowStatus != 'Approved' &&
              !(task['type']?.toString() ?? '').toLowerCase().contains(
                'claim',
              ) &&
              !(task['is_intimation'] == true)) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isActionLoading
                          ? null
                          : () async {
                              // Enforce mandatory rejection reason via dialog
                              final remark = await _showRemarksDialog();
                              if (remark == null || remark.isEmpty) return;

                              setState(() => _isActionLoading = true);
                              try {
                                await _tripService.performApproval(
                                  task['id'],
                                  'UpdateBatchRow',
                                  extraData: {
                                    'row_index': idx,
                                    'row_status': 'Rejected',
                                    'remarks': remark,
                                  },
                                );
                                // Update local state so the remark shows immediately
                                setState(() {
                                  _batchRowEdits[idx] = {
                                    ...(_batchRowEdits[idx] ?? {}),
                                    'status': 'Rejected',
                                    'remark': 'Rejected by You: $remark',
                                  };
                                });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: const Text(
                                        'Row rejected and reason saved',
                                      ),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Failed to reject row: $e'),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted)
                                  setState(() => _isActionLoading = false);
                              }
                            },
                      icon: const Icon(Icons.close_rounded, size: 14),
                      label: Text(
                        'Reject',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Color(0xFFFECACA)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isActionLoading
                          ? null
                          : () async {
                              setState(() => _isActionLoading = true);
                              try {
                                await _tripService.performApproval(
                                  task['id'],
                                  'UpdateBatchRow',
                                  extraData: {
                                    'row_index': idx,
                                    'row_status': 'Validated',
                                    'remarks': '',
                                  },
                                );
                                setState(() {
                                  _batchRowEdits[idx] = {
                                    ...(_batchRowEdits[idx] ?? {}),
                                    'status': 'Validated',
                                  };
                                });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: const Text(
                                        'Row validated successfully',
                                      ),
                                      backgroundColor: const Color(0xFF10B981),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Failed to validate row: $e',
                                      ),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted)
                                  setState(() => _isActionLoading = false);
                              }
                            },
                      icon: const Icon(Icons.check_rounded, size: 14),
                      label: _isActionLoading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Text(
                              'Validate',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }

  Widget _miniExpensePill(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: const Color(0xFF64748B)),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF475569),
            ),
          ),
        ],
      ),
    );
  }

  Widget _timeChip(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 8,
            color: const Color(0xFF94A3B8),
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            value.isEmpty ? '--:--' : value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Future<String?> _showRemarksDialog() async {
    String remark = '';
    return showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            'Rejection Reason',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Please enter the reason for rejection:',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                autofocus: true,
                onChanged: (v) => remark = v,
                decoration: InputDecoration(
                  hintText: 'Required for rejection...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, null),
              child: Text(
                'Cancel',
                style: GoogleFonts.plusJakartaSans(
                  color: const Color(0xFF64748B),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, remark.trim()),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFBB0633),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                'Confirm Rejection',
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildExpenseBreakdown(dynamic expensesData) {
    if (expensesData == null) return const SizedBox.shrink();
    final List expenses = expensesData as List;
    return Column(
      children: expenses
          .map(
            (exp) => Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          exp['category'] ?? exp['nature'] ?? 'Other',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        exp['date'] ?? '',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: () {
                          final String rawDesc =
                              exp['description']?.toString() ?? '';
                          String description = rawDesc;

                          if (rawDesc.isNotEmpty) {
                            try {
                              final d = _parseExpenseDescription(exp);

                              // Extract meaningful location info
                              final String origin =
                                  d['origin']?.toString() ?? '';
                              final String dest =
                                  (d['destination'] ??
                                          d['location'] ??
                                          d['hotelName'] ??
                                          d['hotel_name'] ??
                                          '')
                                      .toString();

                              final String category = (exp['category'] ?? '').toString().toLowerCase();
                              if (category == 'others' || category == 'other') {
                                final String nature = (d['nature'] ?? d['incidentalType'] ?? '').toString();
                                final String justification = (d['justification'] ?? d['notes'] ?? d['remarks'] ?? d['purpose'] ?? '').toString();
                                if (nature.isNotEmpty && justification.isNotEmpty) {
                                  description = "$nature: $justification";
                                } else if (nature.isNotEmpty) {
                                  description = nature;
                                } else if (justification.isNotEmpty) {
                                  description = justification;
                                } else {
                                  description = "Others";
                                }
                              } else if (origin.isNotEmpty || dest.isNotEmpty) {
                                description =
                                    origin.isNotEmpty && dest.isNotEmpty
                                    ? "$origin → $dest"
                                    : (origin.isNotEmpty ? origin : dest);
                              } else if (d['purpose'] != null &&
                                  d['purpose'].toString().isNotEmpty) {
                                description = d['purpose'].toString();
                              } else {
                                description = "Trip Segment Details";
                              }

                              // Add distance/remarks if available
                              if (d['odoStart'] != null &&
                                  d['odoEnd'] != null) {
                                try {
                                  final start = double.parse(
                                    d['odoStart'].toString(),
                                  );
                                  final end = double.parse(
                                    d['odoEnd'].toString(),
                                  );
                                  description +=
                                      " (${(end - start).toStringAsFixed(1)} km)";
                                } catch (_) {}
                              }

                              if (d['remarks'] != null &&
                                  d['remarks'].toString().isNotEmpty &&
                                  d['remarks'].toString().toLowerCase() !=
                                      'null') {
                                description += "\nNote: ${d['remarks']}";
                              }
                            } catch (e) {
                              description = "Activity Details";
                            }
                          }

                          return Text(
                            description,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F172A),
                            ),
                          );
                        }(),
                      ),
                      Text(
                        '₹${exp['amount']}',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  if (exp['receipt_image'] != null &&
                      exp['receipt_image'].toString() != '[]' &&
                      exp['receipt_image'].toString().isNotEmpty &&
                      exp['receipt_image'].toString() != 'null') ...[
                    const SizedBox(height: 8),
                    _miniImageThumbnail(
                      exp['receipt_image'].toString(),
                      "Receipt",
                    ),
                  ],
                  // ── PLANNED vs ACTUAL DEVIATION ─────────────────────────
                  if (exp['is_deviated'] == true) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color:
                            (exp['deviation_reason']?.toString() ?? '')
                                .startsWith('[Skipped]')
                            ? const Color(0xFFFEF2F2)
                            : const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color:
                              (exp['deviation_reason']?.toString() ?? '')
                                  .startsWith('[Skipped]')
                              ? const Color(0xFFFCA5A5)
                              : const Color(0xFFF59E0B),
                          width: 1.2,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? Icons.remove_circle_outline_rounded
                                    : Icons.warning_amber_rounded,
                                size: 13,
                                color:
                                    (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? const Color(0xFFEF4444)
                                    : const Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? 'NOT VISITED'
                                    : 'ROUTE DEVIATION',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color:
                                      (exp['deviation_reason']?.toString() ??
                                              '')
                                          .startsWith('[Skipped]')
                                      ? const Color(0xFF991B1B)
                                      : const Color(0xFF92400E),
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          // Planned row
                          if ((exp['planned_origin']?.toString() ?? '')
                                  .isNotEmpty ||
                              (exp['planned_destination']?.toString() ?? '')
                                  .isNotEmpty) ...[
                            Text(
                              'PLANNED',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE2E8F0),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      exp['planned_origin']?.toString() ?? '-',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 6),
                                  child: Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 12,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE2E8F0),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      exp['planned_destination']?.toString() ??
                                          '-',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                          ],
                          // Actual row
                          if ((exp['deviation_target']?.toString() ?? '')
                              .isNotEmpty) ...[
                            Text(
                              'ACTUAL WENT',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF0D9488),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFCCFBF1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                exp['deviation_target']?.toString() ?? '-',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F766E),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                          // Reason
                          if ((exp['deviation_reason']?.toString() ?? '')
                              .isNotEmpty) ...[
                            Text(
                              'REASON',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              exp['deviation_reason']?.toString() ?? '',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color:
                                    (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? const Color(0xFF991B1B)
                                    : const Color(0xFF92400E),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  // ────────────────────────────────────────────────────────
                  () {
                    final String rawDesc = exp['description']?.toString() ?? '';
                    try {
                      final details = _parseExpenseDescription(exp);
                      if (details.isEmpty) return const SizedBox.shrink();
                      if (details['odoStart'] == null &&
                          details['odoEnd'] == null &&
                          details['odoStartImg'] == null &&
                          details['odoEndImg'] == null &&
                          details['mode'] == null &&
                          details['classType'] == null &&
                          details['class'] == null &&
                          details['pnr'] == null &&
                          details['bookingRef'] == null &&
                          details['subType'] == null &&
                          details['vehicleType'] == null &&
                          details['bookedBy'] == null &&
                          details['travelStatus'] == null &&
                          details['cancellationDate'] == null &&
                          details['refundAmount'] == null &&
                          details['cancellationReason'] == null &&
                          (details['selfies'] == null ||
                              (details['selfies'] as List).isEmpty)) {
                        return const SizedBox.shrink();
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8.0),
                            child: Divider(height: 1),
                          ),
                          Wrap(
                            spacing: 12,
                            runSpacing: 8,
                            children: [
                              if (details['odoStart'] != null && details['odoStart'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Odo Start',
                                  '${details['odoStart']} km',
                                ),
                              if (details['odoEnd'] != null && details['odoEnd'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Odo End',
                                  '${details['odoEnd']} km',
                                ),
                              if (details['mode'] != null && details['mode'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Mode',
                                  details['mode'].toString(),
                                ),
                              if (details['vehicleType'] != null && details['vehicleType'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Vehicle Type',
                                  details['vehicleType'].toString(),
                                ),
                              if (details['classType'] != null && details['classType'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Class',
                                  details['classType'].toString(),
                                ),
                              if (details['pnr'] != null && details['pnr'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'PNR/Booking Ref',
                                  details['pnr'].toString(),
                                ),
                              if (details['bookedBy'] != null && details['bookedBy'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Booked By',
                                  details['bookedBy'].toString(),
                                ),
                              if (details['travelStatus'] != null && details['travelStatus'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Travel Status',
                                  details['travelStatus'].toString(),
                                ),
                              if (details['refundAmount'] != null && details['refundAmount'].toString().isNotEmpty && double.tryParse(details['refundAmount'].toString()) != 0)
                                _miniInfoBlock(
                                  'Refund Amount',
                                  '₹${details['refundAmount']}',
                                ),
                              if (details['cancellationDate'] != null && details['cancellationDate'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Cancellation Date',
                                  details['cancellationDate'].toString(),
                                ),
                              if (details['cancellationReason'] != null && details['cancellationReason'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Cancellation Reason',
                                  details['cancellationReason'].toString(),
                                ),
                            ],
                          ),
                          () {
                            final List? incidentals =
                                details['incidentals'] as List?;
                            if (incidentals == null || incidentals.isEmpty) {
                              return const SizedBox.shrink();
                            }
                            return Container(
                              margin: const EdgeInsets.only(top: 12),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9).withOpacity(0.5),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.receipt_long_rounded,
                                        size: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        "INCIDENTAL BREAKDOWN",
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: const Color(0xFF64748B),
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ...incidentals.map(
                                    (inc) => Padding(
                                      padding: const EdgeInsets.only(bottom: 4),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            inc['category']?.toString() ??
                                                'Other',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: const Color(0xFF475569),
                                            ),
                                          ),
                                          Text(
                                            '₹${inc['amount']}',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w900,
                                              color: const Color(0xFF0F172A),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }(),
                          if (details['odoStartImg'] != null ||
                              details['odoEndImg'] != null ||
                              details['jobReportAttachments'] != null ||
                              (details['selfies'] != null &&
                                  (details['selfies'] as List).isNotEmpty)) ...[
                            const SizedBox(height: 8),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  if (details['odoStartImg'] != null)
                                    _miniImageThumbnail(
                                      details['odoStartImg'],
                                      "Start",
                                    ),
                                  if (details['odoEndImg'] != null)
                                    _miniImageThumbnail(
                                      details['odoEndImg'],
                                      "End",
                                    ),
                                  if (details['selfies'] != null)
                                    ...(details['selfies'] as List)
                                        .map(
                                          (s) => _miniImageThumbnail(
                                            s.toString(),
                                            "Selfie",
                                          ),
                                        )
                                        .toList(),
                                  if (details['jobReportAttachments'] != null)
                                    ...(details['jobReportAttachments'] as List)
                                        .map(
                                          (s) => _miniImageThumbnail(
                                            s.toString(),
                                            "Job Pic",
                                          ),
                                        )
                                        .toList(),
                                ],
                              ),
                            ),
                          ],
                        ],
                      );
                    } catch (e) {
                      return const SizedBox.shrink();
                    }
                  }(),
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _miniInfoBlock(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            color: Colors.grey,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _miniImageThumbnail(dynamic imageInput, String label) {
    if (imageInput == null) return const SizedBox.shrink();
    String path = '';
    if (imageInput is List) {
      if (imageInput.isEmpty) return const SizedBox.shrink();
      path = imageInput.first.toString().trim();
    } else {
      path = imageInput.toString().trim();
      if (path.isEmpty || path == 'null' || path == '[]' || path == '[""]')
        return const SizedBox.shrink();
      if (path.startsWith('[') && path.endsWith(']')) {
        try {
          final decoded = jsonDecode(path);
          if (decoded is List && decoded.isNotEmpty)
            path = decoded.first.toString().trim();
          else if (decoded is String)
            path = decoded.trim();
        } catch (e) {}
      }
    }
    if (path.isEmpty || path == 'null' || path == '[]' || path == '[""]')
      return const SizedBox.shrink();
    path = path
        .replaceFirst(RegExp(r"^\[u'"), '')
        .replaceFirst(RegExp(r"^u'"), '')
        .replaceFirst(RegExp(r"^'"), '');
    path = path
        .replaceFirst(RegExp(r"'\]$"), '')
        .replaceFirst(RegExp(r"'$"), '');
    Widget imageWidget;
    Widget largeImageWidget;
    try {
      if (path.startsWith('data:image')) {
        final base64String = path.split(',').last;
        final bytes = base64Decode(base64String);
        imageWidget = Image.memory(
          bytes,
          fit: BoxFit.cover,
        );
        largeImageWidget = Image.memory(
          bytes,
          fit: BoxFit.contain,
        );
      } else if (path.startsWith('/9j/') ||
          path.startsWith('iVBORw0KG') ||
          (path.length > 300 && !path.contains('/') && !path.contains(':'))) {
        final bytes = base64Decode(path);
        imageWidget = Image.memory(bytes, fit: BoxFit.cover);
        largeImageWidget = Image.memory(bytes, fit: BoxFit.contain);
      } else {
        final String backendBase = ApiConstants.baseUrl;
        final String fullUrl = path.startsWith('http')
            ? path
            : '$backendBase${path.startsWith('/') ? '' : '/'}$path';
        imageWidget = Image.network(
          fullUrl,
          fit: BoxFit.cover,
          errorBuilder: (c, e, s) =>
              const Icon(Icons.broken_image, size: 20, color: Colors.grey),
        );
        largeImageWidget = Image.network(
          fullUrl,
          fit: BoxFit.contain,
          errorBuilder: (c, e, s) =>
              const Icon(Icons.broken_image, size: 20, color: Colors.grey),
        );
      }
    } catch (e) {
      imageWidget = const Icon(
        Icons.error_outline,
        size: 20,
        color: Colors.red,
      );
      largeImageWidget = imageWidget;
    }
    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (context) => Dialog(
            backgroundColor: Colors.black,
            insetPadding: const EdgeInsets.all(10),
            child: Stack(
              alignment: Alignment.center,
              children: [
                InteractiveViewer(
                  panEnabled: true,
                  minScale: 0.5,
                  maxScale: 4.0,
                  child: largeImageWidget,
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: IconButton(
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 30,
                    ),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        width: 60,
        height: 60,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.withOpacity(0.3)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Stack(
            children: [
              Positioned.fill(child: imageWidget),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  color: Colors.black.withOpacity(0.5),
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TaskDetailsContent extends StatefulWidget {
  final Map<String, dynamic> task;
  final bool isHistory;
  final Function(String action, {Map<String, dynamic>? extra}) onAction;
  final VoidCallback onRefresh; // New property

  const _TaskDetailsContent({
    required this.task,
    required this.isHistory,
    required this.onAction,
    required this.onRefresh,
  });

  @override
  State<_TaskDetailsContent> createState() => _TaskDetailsContentState();
}

class _TaskDetailsContentState extends State<_TaskDetailsContent> {
  final TripService _tripService = TripService();
  Map<String, String> itemRemarks = {};
  bool _isActionLoading = false;

  // cached user + roles (mirrors web logic)
  Map<String, dynamic>? _currentUser;
  bool isFinanceHead = false;
  bool isFinanceExec = false;
  bool isHR = false;
  bool isFinance = false;

  bool get canEditAmount => (widget.task['details']?['permissions']?['can_edit_amount'] ?? widget.task['permissions']?['can_edit_amount']) == true;

  bool get isClaim {
    final type = widget.task['type']?.toString().toLowerCase();
    final id = widget.task['id']?.toString().toUpperCase();
    return (type?.contains('claim') == true) || (id?.startsWith('CLAIM-') == true);
  }

  // allowance compliance state
  Map<String, dynamic>? allowanceData;
  bool allowanceLoading = false;
  Map<dynamic, Map<String, dynamic>> hrDecisions = {};

  // finance-related state for approvals
  String execAmount = '';
  TextEditingController? _detailExecController;
  String paymentMode = '';
  String transactionId = '';
  String? receiptFile;
  String? _errorMessage;

  @override
  void dispose() {
    _detailExecController?.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _currentUser = ApiService().getUser();
    _computeRoles();
    _fetchAllowance();

    // Prefill amount exactly like web: Use previously edited amount if available, else requested amount
    final dynamic details = widget.task['details'] ?? {};
    final execRaw =
        (widget.task['executive_approved_amount'] ??
                details['executive_approved_amount'])
            ?.toString();
    final execVal = double.tryParse(execRaw ?? '0') ?? 0.0;

    if (execRaw != null && execVal > 0) {
      execAmount = execRaw;
    } else {
      execAmount =
          details['requested_amount']?.toString() ??
          widget.task['cost']
              ?.toString()
              .replaceAll('₹', '')
              .replaceAll(',', '') ??
          '';
    }
    _detailExecController = TextEditingController(text: execAmount);
  }

  void _computeRoles() {
    final role = _currentUser?['role_name']?.toString().toLowerCase() ?? '';
    final dept = _currentUser?['department']?.toString().toLowerCase() ?? '';
    final desig = _currentUser?['designation']?.toString().toLowerCase() ?? '';

    isFinanceHead =
        (dept.contains('finance') && dept.contains('head')) ||
        (desig.contains('finance') && desig.contains('head')) ||
        role == 'cfo' ||
        role.contains('cfo');

    isFinance =
        dept.contains('finance') ||
        desig.contains('finance') ||
        role.contains('finance') ||
        isFinanceHead;

    isFinanceExec = isFinance && !isFinanceHead;

    isHR = dept.contains('hr') ||
        desig.contains('hr') ||
        role == 'hr' ||
        role.contains('hr') ||
        dept.contains('human resources') ||
        desig.contains('human resources') ||
        role.contains('human resources') ||
        dept.contains('human resource') ||
        desig.contains('human resource') ||
        role.contains('human resource');
  }

  Future<void> _fetchAllowance() async {
    final dbId = widget.task['db_id'] ?? widget.task['id'];
    if ((widget.task['type'] == 'Expense Claim' || widget.task['type'] == 'Monthly Tour Plan') && (isHR || isFinance || canEditAmount) && dbId != null) {
      setState(() {
        allowanceLoading = true;
      });
      try {
        final ApiService apiService = ApiService();
        final response = await apiService.get('/api/claims/$dbId/compute-allowance/');
        if (response != null && response is Map<String, dynamic>) {
          setState(() {
            allowanceData = response;
            
            final List? expenseAllowances = response['expense_allowances'] as List?;
            final List? expenses = widget.task['details']?['expenses'] as List?;
            
            if (expenses != null && expenseAllowances != null) {
              for (var e in expenses) {
                final ea = expenseAllowances.firstWhere(
                  (item) => item['expense_id'].toString() == e['id'].toString(),
                  orElse: () => null,
                );
                if (ea != null) {
                  e['allowed_amount'] = ea['allowed_amount'];
                  if (e['hr_amount_source'] == null && e['finance_amount_source'] == null) {
                    e['policy_note'] = ea['policy_note'];
                  }
                  e['city_type_resolved'] = ea['city_type'];
                }
              }
            }

            final initialDecisions = <dynamic, Map<String, dynamic>>{};
            if (expenseAllowances != null) {
              for (var ea in expenseAllowances) {
                final expId = ea['expense_id'];
                final exp = expenses?.firstWhere(
                  (e) => e['id'].toString() == expId.toString(),
                  orElse: () => null,
                );
                
                double? savedAmt;
                String? savedSource;
                
                if (isFinance) {
                  if (exp != null && exp['finance_selected_amount'] != null) {
                    savedAmt = double.tryParse(exp['finance_selected_amount'].toString());
                    savedSource = exp['finance_amount_source']?.toString() ?? 'manual';
                  } else if (exp != null && exp['hr_selected_amount'] != null) {
                    savedAmt = double.tryParse(exp['hr_selected_amount'].toString());
                    savedSource = 'allowed';
                  }
                } else {
                  if (exp != null && exp['hr_selected_amount'] != null) {
                    savedAmt = double.tryParse(exp['hr_selected_amount'].toString());
                    savedSource = exp['hr_amount_source']?.toString() ?? 'allowed';
                  }
                }
                
                final String savedNote = (isFinance 
                  ? (exp?['finance_remarks'] ?? exp?['policy_note'] ?? ea['policy_note'] ?? '') 
                  : (exp?['policy_note'] ?? ea['policy_note'] ?? '')).toString();
                
                final claimedAmt = double.tryParse(ea['claimed_amount']?.toString() ?? '0') ?? 0.0;
                final allowedAmt = ea['allowed_amount'] != null ? (double.tryParse(ea['allowed_amount'].toString()) ?? 0.0) : null;
                final exceedsLimit = ea['exceeds_limit'] == true;
                
                initialDecisions[expId] = {
                  'amount': savedAmt ?? (exceedsLimit ? (allowedAmt ?? claimedAmt) : claimedAmt),
                  'source': savedSource ?? (exceedsLimit ? 'allowed' : 'claimed'),
                  'note': savedNote,
                  'error': '',
                };
              }
            }
            hrDecisions = initialDecisions;
          });
        }
      } catch (err) {
        debugPrint("Failed to fetch claim allowance: $err");
      } finally {
        setState(() {
          allowanceLoading = false;
        });
      }
    } else {
      setState(() {
        allowanceData = null;
        hrDecisions = {};
      });
    }
  }

  void handleDecisionChange(dynamic expenseId, String field, dynamic value) {
    setState(() {
      final current = hrDecisions[expenseId] != null
          ? Map<String, dynamic>.from(hrDecisions[expenseId]!)
          : {'amount': 0.0, 'source': 'claimed', 'note': '', 'error': ''};
      current[field] = value;

      final expenseAllowances = allowanceData?['expense_allowances'] as List?;
      final ea = expenseAllowances?.firstWhere(
        (a) => a['expense_id'].toString() == expenseId.toString(),
        orElse: () => null,
      );

      final claimed = ea != null ? (double.tryParse(ea['claimed_amount']?.toString() ?? '0') ?? 0.0) : 0.0;
      final allowed = ea != null && ea['allowed_amount'] != null
          ? (double.tryParse(ea['allowed_amount'].toString()) ?? 0.0)
          : null;

      _errorMessage = null; // Clear general error banner on interaction

      if (field == 'amount') {
        final valFloat = double.tryParse(value.toString()) ?? 0.0;
        if (double.tryParse(value.toString()) == null) {
          current['error'] = 'Please enter a valid number';
        } else if (valFloat > claimed) {
          current['error'] = 'Cannot exceed claimed amount (₹$claimed)';
        } else if (valFloat < 0) {
          current['error'] = 'Amount cannot be negative';
        } else if (allowed != null && claimed > allowed && valFloat < allowed) {
          current['error'] = 'Amount cannot be less than policy limit (₹$allowed)';
        } else {
          current['error'] = '';
        }
      } else if (field == 'source') {
        final amt = value == 'claimed'
            ? claimed
            : (value == 'allowed' ? (allowed ?? claimed) : current['amount']);

        if (value == 'manual') {
          final valFloat = double.tryParse(amt.toString()) ?? 0.0;
          if (double.tryParse(amt.toString()) == null) {
            current['error'] = 'Please enter a valid number';
          } else if (valFloat > claimed) {
            current['error'] = 'Cannot exceed claimed amount (₹$claimed)';
          } else if (valFloat < 0) {
            current['error'] = 'Amount cannot be negative';
          } else if (allowed != null && claimed > allowed && valFloat < allowed) {
            current['error'] = 'Amount cannot be less than policy limit (₹$allowed)';
          } else {
            current['error'] = '';
          }
        } else {
          current['error'] = '';
        }
      } else if (field == 'note') {
        if (value.toString().trim().isNotEmpty && current['error'] == 'Policy deviation note is mandatory for adjustments') {
          current['error'] = '';
        }
      }

      hrDecisions[expenseId] = current;
    });
  }

  Future<void> saveExpenseDecision(dynamic expenseId) async {
    final dec = hrDecisions[expenseId];
    if (dec == null) return;

    if (dec['error'] != null && dec['error'].toString().isNotEmpty) {
      setState(() {
        _errorMessage = dec['error'].toString();
      });
      return;
    }

    if (dec['source'] != 'claimed' && (dec['note'] == null || dec['note'].toString().trim().isEmpty)) {
      setState(() {
        _errorMessage = 'Policy deviation note is mandatory for adjustments';
        dec['error'] = 'Policy deviation note is mandatory for adjustments';
      });
      return;
    }

    setState(() {
      _isActionLoading = true;
      _errorMessage = null;
    });
    try {
      final dbId = widget.task['db_id'] ?? widget.task['id'];
      final String amtField = isFinance ? 'finance_selected_amount' : 'hr_selected_amount';
      
      final payload = {
        'expense_decisions': [
          {
            'expense_id': expenseId,
            amtField: double.tryParse(dec['amount'].toString()) ?? 0.0,
            'source': dec['source'],
            'note': dec['note'],
            'policy_note': dec['note'],
          }
        ]
      };

      final response = isFinance
          ? await _tripService.financeDecide(dbId, payload)
          : await _tripService.hrDecide(dbId, payload);

      if (response != null) {
        if (response['errors'] != null && (response['errors'] as List).isNotEmpty) {
          final errMsg = response['errors'][0]['error'] ?? 'Failed to save decision';
          setState(() {
            _errorMessage = errMsg.toString();
          });
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(isFinance ? 'Finance decision saved successfully' : 'HR decision saved successfully'),
              backgroundColor: const Color(0xFF10B981),
            ),
          );

          // Update the local task object in-place so the UI reflects the change immediately
          if (widget.task['details'] != null && widget.task['details']['expenses'] != null) {
            final List expenses = widget.task['details']['expenses'] as List;
            for (var e in expenses) {
              if (e['id'].toString() == expenseId.toString()) {
                setState(() {
                  if (isFinance) {
                    e['finance_selected_amount'] = double.tryParse(dec['amount'].toString());
                    e['finance_amount_source'] = dec['source'];
                  } else {
                    e['hr_selected_amount'] = double.tryParse(dec['amount'].toString());
                    e['hr_amount_source'] = dec['source'];
                    e['hr_selected_by_role'] = isHR 
                        ? 'HR' 
                        : (widget.task['details']?['reporting_manager_name'] == _currentUser?['name'] 
                            ? 'Reporting Manager' 
                            : (_currentUser?['designation'] ?? 'Reporting Manager'));
                  }
                  e['policy_note'] = dec['note'];
                });
                break;
              }
            }
          }

          final dynamic newApprovedTotal = response['final_approved_total'];
          if (newApprovedTotal != null) {
            setState(() {
              execAmount = newApprovedTotal.toString();
              if (_detailExecController != null) {
                _detailExecController!.text = execAmount;
              }
              widget.task['executive_approved_amount'] = newApprovedTotal;
              if (widget.task['details'] != null) {
                widget.task['details']['executive_approved_amount'] = newApprovedTotal;
                widget.task['details']['approved_amount'] = newApprovedTotal;
              }
            });
          }

          widget.onRefresh();
          _fetchAllowance();
        }
      }
    } catch (err) {
      setState(() {
        _errorMessage = 'Failed to save HR decision: $err';
      });
      debugPrint("Failed to save HR decision: $err");
    } finally {
      setState(() => _isActionLoading = false);
    }
  }

  Future<String?> _showRemarksDialog() async {
    String remark = '';
    return showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            'Rejection Reason',
            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Please enter the reason for rejection:',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  color: const Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                autofocus: true,
                onChanged: (v) => remark = v,
                decoration: InputDecoration(
                  hintText: 'Required for rejection...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                maxLines: 3,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, null),
              child: Text(
                'Cancel',
                style: GoogleFonts.plusJakartaSans(
                  color: const Color(0xFF64748B),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, remark.trim()),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFBB0633),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: Text(
                'Confirm Rejection',
                style: GoogleFonts.plusJakartaSans(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  void _handleItemAction(dynamic itemId, String status) async {
    String finalRemark = itemRemarks[itemId.toString()] ?? '';

    if (status == 'Rejected') {
      final remark = await _showRemarksDialog();
      if (remark == null || remark.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Rejection reason is mandatory'),
            backgroundColor: const Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        );
        return;
      }
      finalRemark = remark;
      // Sync the local state as well
      itemRemarks[itemId.toString()] = finalRemark;
    }

    setState(() => _isActionLoading = true);
    try {
      await _tripService.performApproval(
        widget.task['id'],
        'UpdateItem',
        extraData: {
          'item_id': itemId,
          'item_status': status,
          'remarks': finalRemark,
        },
      );
      // Update local task object in-place so status updates instantly in the UI
      if (widget.task['details'] != null && widget.task['details']['expenses'] != null) {
        final List expenses = widget.task['details']['expenses'] as List;
        for (var e in expenses) {
          if (e['id'].toString() == itemId.toString()) {
            setState(() {
              e['status'] = status;
              if (isHR) {
                e['hr_remarks'] = finalRemark;
              } else if (isFinance) {
                e['finance_remarks'] = finalRemark;
              }
            });
            break;
          }
        }
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Item ${status.toLowerCase()}ed with feedback'),
          backgroundColor: const Color(0xFF10B981),
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
        ),
      );
      widget.onRefresh(); // Trigger main screen refresh
    } catch (e) {
      setState(() {
        _errorMessage = 'Failed to update item: $e';
      });
    } finally {
      if (mounted) setState(() => _isActionLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final task = widget.task;
    final String type = task['type'] ?? '';
    final details = task['details'] ?? {};
    final Set<String> renderedBatchIds = {};

    final bool hasRowWiseEditing = (() {
      if (type == 'Money Top-up / Advance') return false;
      final List expenses = details['expenses'] is List ? details['expenses'] : [];
      return expenses.isNotEmpty;
    })();

    return Column(
      children: [
        Container(
          width: 40,
          height: 4,
          margin: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
          child: Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: const Color(0xFFF1F5F9),
                child: Text(
                  (task['requester']?.toString() ?? '?')[0].toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w900,
                    fontSize: 18,
                    color: const Color(0xFF0F172A),
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      task['requester'] ?? 'Requester',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    Text(
                      '$type Request',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
              ),
            ],
          ),
        ),
        const Divider(height: 32),
        if (_errorMessage != null) ...[
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF2F2),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFFCA5A5)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _errorMessage!,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF991B1B),
                    ),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Color(0xFF991B1B), size: 16),
                  onPressed: () {
                    setState(() {
                      _errorMessage = null;
                    });
                  },
                  constraints: const BoxConstraints(),
                  padding: EdgeInsets.zero,
                ),
              ],
            ),
          ),
        ],
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (details['has_deviations'] == true) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF7ED),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: const Color(0xFFFFEDD5)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(
                              Icons.warning_amber_rounded,
                              color: Color(0xFFD97706),
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'TRAVEL PLAN DEVIATIONS',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF92400E),
                                letterSpacing: 1,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          details['deviation_summary'] ??
                              'User deviated from the planned route.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: const Color(0xFFB45309),
                            fontWeight: FontWeight.w600,
                            height: 1.5,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Divider(color: Color(0xFFFFEDD5)),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'PLANNED ROUTE',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF92400E),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${details['planned_origin'] ?? 'N/A'} → ${details['planned_destination'] ?? 'N/A'}',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF78350F),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.arrow_forward_rounded,
                              color: Color(0xFFD97706),
                              size: 16,
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'ACTUAL ROUTE',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 9,
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF92400E),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${details['source'] ?? 'N/A'} → ${details['destination'] ?? 'N/A'}',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w700,
                                      color: const Color(0xFF78350F),
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
                  const SizedBox(height: 24),
                ],
                _buildInfoGrid(task),
                // Dynamic Finance Editing: Show edit field if permission is granted from Admin configuration
                if (isClaim &&
                    (widget.task['permissions']?['can_edit_amount'] == true ||
                     widget.task['details']?['permissions']?['can_edit_amount'] ==
                         true)) ...[
                  const SizedBox(height: 32),
                  Text(
                    'Audit Finalization (Edit Amount)',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Text(
                        '₹',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Expanded(
                        child: TextField(
                          enabled: !hasRowWiseEditing,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: InputDecoration(
                            hintText: '0.00',
                            filled: hasRowWiseEditing,
                            fillColor: hasRowWiseEditing ? const Color(0xFFE2E8F0) : null,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                          ),
                          controller: _detailExecController,
                          onChanged: (v) {
                            double entered = double.tryParse(v) ?? 0.0;
                            final rawRequested =
                                widget.task['details']?['requested_amount']
                                    ?.toString() ??
                                widget.task['cost']?.toString() ??
                                '0';
                            final requestedStr = rawRequested
                                .replaceAll('₹', '')
                                .replaceAll(',', '')
                                .trim();
                            double requested =
                                double.tryParse(requestedStr) ?? 0.0;

                            if (entered > requested) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    'Amount cannot exceed requested ₹$requested',
                                  ),
                                  backgroundColor: Colors.red,
                                  duration: const Duration(seconds: 2),
                                ),
                              );
                              // Clamp to requested
                              setState(
                                () => execAmount = requested.toStringAsFixed(2),
                              );
                            } else {
                              setState(() => execAmount = v);
                            }
                          },
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 16,
                            fontWeight: FontWeight.w900,
                            color: hasRowWiseEditing ? const Color(0xFF64748B) : const Color(0xFF10B981),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Builder(
                    builder: (context) {
                      final advTaken =
                          double.tryParse(
                            widget.task['details']?['total_advance_taken']
                                    ?.toString() ??
                                '0',
                          ) ??
                          0.0;
                      final walletUsed =
                          double.tryParse(
                            widget.task['details']?['wallet_balance_used']
                                    ?.toString() ??
                                '0',
                          ) ??
                          0.0;
                      final totalDeductions = advTaken + walletUsed;

                      final currentGross = double.tryParse(execAmount) ?? 0.0;
                      final netPayout = (currentGross - totalDeductions).clamp(
                        0.0,
                        double.infinity,
                      );

                      if (totalDeductions > 0 && (type == 'Expense Claim' || type == 'Monthly Tour Plan')) {
                        return Container(
                          margin: const EdgeInsets.only(top: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(
                              color: const Color(0xFFCBD5E1),
                              style: BorderStyle.solid,
                            ),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Wallet/Advance Deductions:',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: const Color(0xFF64748B),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    '-₹${totalDeductions.toStringAsFixed(2)}',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 11,
                                      color: const Color(0xFFEF4444),
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Container(
                                height: 1,
                                color: const Color(0xFFE2E8F0),
                              ),
                              const SizedBox(height: 6),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    'Net Payout to Bank:',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 13,
                                      color: const Color(0xFF0F172A),
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  Text(
                                    '₹${netPayout.toStringAsFixed(2)}',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 14,
                                      color: const Color(0xFFBB0633),
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        );
                      }
                      return const SizedBox.shrink();
                    },
                  ),
                  const SizedBox(height: 4),
                  Text(
                    hasRowWiseEditing
                        ? '* This field is auto-calculated from row-wise approvals/adjustments below.'
                        : '* Enter the total approved expenses. Deductions are handled automatically.',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                ] else if (isClaim &&
                    ((widget.task['executive_approved_amount'] ??
                        widget.task['details']?['executive_approved_amount']) !=
                    null)) ...[
                  const SizedBox(height: 32),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Previous Level Recommendation',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Text(
                          '₹${widget.task['executive_approved_amount'] ?? widget.task['details']?['executive_approved_amount']}',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFFBB0633),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 32),
                Text(
                  'Request Objective',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  task['purpose'] ?? '',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    color: const Color(0xFF475569),
                    height: 1.6,
                    fontWeight: FontWeight.w600,
                  ),
                ),

                 // ── Monthly Tour Plan (Bulk Batch) ───────────────────────────
                // Hide daily activities on Expense Claims as requested (already validated in bulk flow)
                if (type == 'Monthly Tour Plan' ||
                    task['data_json'] != null) ...[
                  (() {
                    final bId = (task['db_id'] ?? task['id'])?.toString();
                    if (bId != null) renderedBatchIds.add(bId);
                    return const SizedBox.shrink();
                  })(),
                  const SizedBox(height: 32),
                  _buildBulkBatchSection(task),
                ],

                // ── Trip/Claim Activity Batches ──────────────────────────────
                // Hide daily activities on Expense Claims as requested
                if (details['activity_batches'] != null &&
                    (details['activity_batches'] as List).isNotEmpty) ...[
                  for (var batch in (details['activity_batches'] as List)) ...[
                    if (() {
                      final bId = (batch['db_id'] ?? batch['id'])?.toString();
                      if (bId != null) {
                        if (renderedBatchIds.contains(bId) ||
                            renderedBatchIds.contains('BATCH-$bId') ||
                            renderedBatchIds.any((id) => id.toString().contains(bId))) {
                          return false;
                        }
                        renderedBatchIds.add(bId);
                      }
                      final fName = batch['file_name']?.toString().toLowerCase();
                      final taskFile = task['file_name']?.toString().toLowerCase();
                      final taskPurpose = task['purpose']?.toString().toLowerCase();
                      if (fName != null) {
                        if (taskFile != null && (taskFile.contains(fName) || fName.contains(taskFile))) {
                          return false;
                        }
                        if (taskPurpose != null && (taskPurpose.contains(fName) || fName.contains(taskPurpose))) {
                          return false;
                        }
                      }
                      return true;
                    }()) ...[
                      const SizedBox(height: 32),
                      _buildBulkBatchSection(Map<String, dynamic>.from(batch)),
                    ],
                  ],
                ],

                if (type == 'Trip' && details.isNotEmpty) ...[
                  const SizedBox(height: 32),
                  Text(
                    'Trip Itinerary',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildItinerary(details),
                  const SizedBox(height: 32),
                  Text(
                    'Travel Details',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildTravelDetails(details),
                ],

                if (type == 'Money Top-up / Advance' && details.isNotEmpty) ...[
                  const SizedBox(height: 32),
                  Text(
                    'Advance Request',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildAdvanceDetails(details),
                ],

                if (type == 'Dispute' && details.isNotEmpty) ...[
                  const SizedBox(height: 32),
                  Text(
                    'Dispute Details',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildDisputeDetails(details),
                ],

                if (details['expenses'] != null &&
                    (details['expenses'] as List).isNotEmpty) ...[
                  const SizedBox(height: 32),
                  Text(
                    'Expense Breakdown',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildExpenseBreakdown((details['expenses'] as List)),
                ],

                if (details['odometer'] != null) ...[
                  const SizedBox(height: 32),
                  Text(
                    'Mileage Log',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 16),
                  _buildMileageLog(details['odometer']),
                ],

                const SizedBox(height: 32),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDF4),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFDCFCE7)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.verified_user_rounded,
                        color: Color(0xFF16A34A),
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Validated against corporate travel policy & grade limits.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF166534),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
        _buildBottomActions(),
      ],
    );
  }

  Widget _buildInfoGrid(Map<String, dynamic> task) {
    final isClaim = task['type']?.toString().contains('Claim') == true ||
        task['type']?.toString().contains('Plan') == true;
    final claimedAmount = task['details']?['requested_amount'] ?? task['details']?['total_amount'];

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _infoBlock('Request Type', task['type'] ?? 'N/A'),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _infoBlock(
                  isClaim ? 'Net Payout' : 'Estimated Cost',
                  task['cost'] ?? '0',
                ),
              ),
            ],
          ),
          if (isClaim && claimedAmount != null) ...[
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _infoBlock(
                    'Employee Claimed Amount',
                    '₹${double.tryParse(claimedAmount.toString())?.toStringAsFixed(2) ?? claimedAmount}',
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _infoBlock('Submitted Date', task['date'] ?? 'N/A'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _infoBlock('Risk Score', task['risk'] ?? 'Low'),
                ),
                const SizedBox(width: 16),
                const Spacer(),
              ],
            ),
          ] else ...[
            const SizedBox(height: 16),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _infoBlock('Submitted Date', task['date'] ?? 'N/A'),
                ),
                const SizedBox(width: 16),
                Expanded(child: _infoBlock('Risk Score', task['risk'] ?? 'Low')),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _infoBlock(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            color: const Color(0xFF94A3B8),
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  void _triggerAction(String action) async {
    Map<String, dynamic> extra = {};
    if (action.toLowerCase().startsWith('reject')) {
      final remarks = await _showRemarksDialog();
      if (remarks == null || remarks.isEmpty) return;
      extra['remarks'] = remarks;
    }
    // include exec/payout data when relevant
    if (action == 'Pay') {
      extra['payment_mode'] = paymentMode;
      extra['transaction_id'] = transactionId;
      if (receiptFile != null) extra['receipt_file'] = receiptFile;
    }
    if (execAmount.isNotEmpty) extra['executive_approved_amount'] = execAmount;

    String? actionToPerform = action;

    // Check if this is a bulk activity batch (Monthly Tour Plan or nested activity batches)
    final bool isBulk = widget.task['data_json'] != null;

    if (isBulk) {
      if (action == 'Approve') {
        actionToPerform = 'ApproveValid';
      } else if (action == 'Reject') {
        actionToPerform = 'RejectAll';
      }
    }

    widget.onAction(actionToPerform, extra: extra.isEmpty ? null : extra);
  }

  Widget _buildBottomActions() {
    final status = widget.task['status']?.toString() ?? '';
    if (isFinanceExec && status == 'PENDING_FINAL_RELEASE') {
      return _buildPayoutController();
    }

    if (widget.task['is_intimation'] == true) {
      if (widget.task['can_mark_read'] == true && !widget.isHistory) {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
            border: const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
          ),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _triggerAction('MarkRead'),
              icon: const Icon(Icons.mark_email_read_rounded, size: 20),
              label: Text(
                'Mark as Read',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFA9052E),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                elevation: 8,
                shadowColor: const Color(0xFFA9052E).withOpacity(0.4),
              ),
            ),
          ),
        );
      } else {
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 20,
                offset: const Offset(0, -4),
              ),
            ],
            border: const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
          ),
          child: Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: const Color(0xFFD1FAE5),
                borderRadius: BorderRadius.circular(30),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.check_circle_rounded,
                    color: Color(0xFF059669),
                    size: 18,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    'Acknowledged (Outbox)',
                    style: GoogleFonts.plusJakartaSans(
                      color: const Color(0xFF059669),
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      }
    }

    if (widget.isHistory) {
      return const SizedBox.shrink();
    }

    String rejectLabel = isFinanceExec ? 'Return to HR' : 'Reject';
    String approveLabel;

    // Detect if this is a bulk batch
    final bool isBulk = widget.task['data_json'] != null;

    final bool canEdit = (widget.task['details']?['permissions']?['can_edit_amount'] ??
        widget.task['permissions']?['can_edit_amount']) == true;

    if (isClaim) {
      if (canEdit) {
        approveLabel = 'Verify & Approve (₹$execAmount)';
      } else if (isFinanceHead || isFinanceExec) {
        approveLabel = 'Authorize Payment (₹$execAmount)';
      } else if (isBulk) {
        approveLabel = 'Authorize Valid Entries';
      } else {
        approveLabel = 'Approve';
      }
    } else {
      approveLabel = 'Approve';
    }

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
        border: const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              onPressed: () => _triggerAction('Reject'),
              icon: const Icon(Icons.cancel_outlined, size: 20),
              label: Text(
                rejectLabel,
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.red,
                side: const BorderSide(color: Color(0xFFFFE4E6)),
                backgroundColor: const Color(0xFFFFF1F2),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: ElevatedButton.icon(
              onPressed: () => _triggerAction('Approve'),
              icon: const Icon(Icons.check_circle_outline_rounded, size: 20),
              label: Text(
                approveLabel,
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: 0.5,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFBB0633),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                elevation: 8,
                shadowColor: const Color(0xFFBB0633).withOpacity(0.4),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPayoutController() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, -4),
          ),
        ],
        border: const Border(top: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Payment Release',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 18,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: paymentMode.isEmpty ? null : paymentMode,
            items: [
              const DropdownMenuItem(
                value: 'BANK_TRANSFER',
                child: Text('Bank Transfer'),
              ),
              if (double.tryParse(execAmount) != null &&
                  double.parse(execAmount) < 10000)
                const DropdownMenuItem(
                  value: 'CASH',
                  child: Text('Cash Payment'),
                ),
            ],
            decoration: const InputDecoration(
              labelText: 'Payment Mode',
              border: OutlineInputBorder(),
            ),
            onChanged: (v) {
              setState(() => paymentMode = v ?? '');
            },
          ),
          if (paymentMode == 'BANK_TRANSFER') ...[
            const SizedBox(height: 12),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Transaction/Reference',
                border: OutlineInputBorder(),
              ),
              onChanged: (v) => setState(() => transactionId = v),
            ),
          ],
          if (paymentMode == 'CASH') ...[
            const SizedBox(height: 12),
            TextButton(
              onPressed: () async {
                // simple file picker: using showModalBottomSheet with file input is complex on mobile; skipping details for now
                // once file picked remember to `setState(() => receiptFile = <data>)` so button state updates
              },
              child: Text(
                receiptFile == null ? 'Upload Receipt' : 'Receipt Attached',
              ),
            ),
          ],
          const SizedBox(height: 20),
          Center(
            child: ElevatedButton.icon(
              onPressed:
                  (paymentMode.isEmpty ||
                      (paymentMode == 'BANK_TRANSFER' && transactionId.isEmpty))
                  ? null
                  : () => _triggerAction('Pay'),
              icon: const Icon(Icons.check_circle_outline_rounded, size: 20),
              label: Text(
                'Release Payment (₹$execAmount)',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF16A34A),
                padding: const EdgeInsets.symmetric(
                  vertical: 16,
                  horizontal: 24,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ─── Monthly Tour Plan / Bulk Activity Batch ─────────────────────────────

  final Map<int, Map<String, String>> _batchRowEdits = {};

  Widget _buildBulkBatchSection(Map<String, dynamic> task) {
    final List<dynamic> rows = task['data_json'] ?? [];
    final String fileName =
        task['file_name']?.toString() ??
        task['purpose']?.toString() ??
        'Monthly Tour Plan';

    final List<Map<String, dynamic>> indexedRows = [];
    for (int i = 0; i < rows.length; i++) {
      final r = Map<String, dynamic>.from(rows[i] as Map);
      r['_original_index_in_batch'] = i;
      indexedRows.add(r);
    }

    final filteredRows = indexedRows.where((r) {
      final dateStr = r['date']?.toString() ?? '';
      return !dateStr.toLowerCase().contains('instruc');
    }).toList();

    final String batchStatus = task['status']?.toString() ?? 'Pending Approval';
    final bool isResubmittedBatch = batchStatus.toLowerCase().contains('resubmitted');
    
    final displayRows = filteredRows.where((r) {
      if (isResubmittedBatch) {
        final rowStatus = (r['_status'] ?? r['status'] ?? '').toString().toLowerCase().trim();
        final isValidated = rowStatus == 'validated' || rowStatus == 'ok' || rowStatus == 'approved';
        return !isValidated;
      }
      return true;
    }).toList();

    if (displayRows.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Text(
          'No activity entries found.',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 13,
            color: const Color(0xFF64748B),
            fontWeight: FontWeight.w600,
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(
              Icons.calendar_month_rounded,
              color: Color(0xFFBB0633),
              size: 18,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Daily Activities — ${displayRows.length} Entries',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          fileName,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            color: const Color(0xFF94A3B8),
            fontWeight: FontWeight.w700,
          ),
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 16),
        ...displayRows.map((row) {
          final idx = row['_original_index_in_batch'] as int;
          return _buildBulkRowCard(idx, row, task);
        }),
      ],
    );
  }

  Widget _buildBulkRowCard(
    int idx,
    Map<String, dynamic> row,
    Map<String, dynamic> task,
  ) {
    final editState = _batchRowEdits[idx] ?? {};
    final rowStatus = editState['status'] ?? row['_status']?.toString() ?? '';
    final isRejected = rowStatus == 'Rejected';
    final isValidated = rowStatus == 'Validated' || rowStatus == 'OK';
    final startTime = row['start_time']?.toString() ?? '';
    final reachTime =
        row['reach_time']?.toString() ?? row['end_time']?.toString() ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isRejected
            ? const Color(0xFFFFF1F2)
            : isValidated
            ? const Color(0xFFF0FDF4)
            : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isRejected
              ? const Color(0xFFFECACA)
              : isValidated
              ? const Color(0xFFBBF7D0)
              : const Color(0xFFE2E8F0),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.calendar_today_rounded,
                      size: 13,
                      color: Color(0xFF94A3B8),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      row['date']?.toString() ?? '',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                  ],
                ),
                if (isRejected)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'REJECTED',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  )
                else if (isValidated)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'VALIDATED',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'FROM',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        row['origin_route']?.toString() ?? '-',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 8),
                  child: Icon(
                    Icons.arrow_forward_rounded,
                    color: Color(0xFFBB0633),
                    size: 16,
                  ),
                ),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'TO',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        row['destination_route']?.toString() ?? '-',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.end,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: Row(
              children: [
                _timeChip('START', startTime),
                const SizedBox(width: 8),
                const Icon(
                  Icons.arrow_right_alt_rounded,
                  color: Color(0xFF94A3B8),
                  size: 18,
                ),
                const SizedBox(width: 8),
                _timeChip('REACH', reachTime),
                const SizedBox(width: 12),
                if ((row['incidental_amount'] ?? '0').toString() != '0')
                  _miniExpensePill(
                    'I: ₹${row['incidental_amount']}',
                    Icons.receipt_outlined,
                  ),
                if ((row['odo_total'] ?? '0').toString() != '0') ...[
                  const SizedBox(width: 6),
                  _miniExpensePill(
                    'M: ₹${row['odo_total']}',
                    Icons.local_gas_station_rounded,
                  ),
                ],
                const Spacer(),
                if ((row['visit_intent'] ?? '').toString().isNotEmpty)
                  Flexible(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        row['visit_intent']?.toString() ?? '',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF475569),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          // Show remarks from server or from locally-saved rejection (before next refresh)
          if ((row['_remarks'] ?? editState['remark'] ?? '')
              .toString()
              .isNotEmpty) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0xFFFECACA)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.info_outline_rounded,
                      size: 13,
                      color: Color(0xFFEF4444),
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        (row['_remarks'] ?? editState['remark'] ?? '')
                            .toString(),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFFDC2626),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
          // Also hide them if this is an Expense Claim (where activities are already final context)
          if (!widget.isHistory &&
              rowStatus != 'Rejected' &&
              !(widget.task['type']?.toString() ?? '').toLowerCase().contains(
                'claim',
              ) &&
              !(widget.task['is_intimation'] == true)) ...[
            const SizedBox(height: 10),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 14),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isActionLoading
                          ? null
                          : () async {
                              // Enforce mandatory rejection reason via dialog
                              final remark = await _showRemarksDialog();
                              if (remark == null || remark.isEmpty) return;

                              setState(() => _isActionLoading = true);
                              try {
                                await _tripService.performApproval(
                                  task['id'],
                                  'UpdateBatchRow',
                                  extraData: {
                                    'row_index': idx,
                                    'row_status': 'Rejected',
                                    'remarks': remark,
                                  },
                                );
                                // Update local state so the remark shows immediately
                                setState(() {
                                  _batchRowEdits[idx] = {
                                    ...(_batchRowEdits[idx] ?? {}),
                                    'status': 'Rejected',
                                    'remark': 'Rejected by You: $remark',
                                  };
                                });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: const Text(
                                        'Row rejected and reason saved',
                                      ),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Failed to reject row: $e'),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted)
                                  setState(() => _isActionLoading = false);
                              }
                            },
                      icon: const Icon(Icons.close_rounded, size: 14),
                      label: Text(
                        'Reject',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.red,
                        side: const BorderSide(color: Color(0xFFFECACA)),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: _isActionLoading
                          ? null
                          : () async {
                              setState(() => _isActionLoading = true);
                              try {
                                await _tripService.performApproval(
                                  task['id'],
                                  'UpdateBatchRow',
                                  extraData: {
                                    'row_index': idx,
                                    'row_status': 'Validated',
                                    'remarks': '',
                                  },
                                );
                                setState(() {
                                  _batchRowEdits[idx] = {
                                    ...(_batchRowEdits[idx] ?? {}),
                                    'status': 'Validated',
                                  };
                                });
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: const Text(
                                        'Row validated successfully',
                                      ),
                                      backgroundColor: const Color(0xFF10B981),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } catch (e) {
                                if (mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        'Failed to validate row: $e',
                                      ),
                                      backgroundColor: const Color(0xFFEF4444),
                                      behavior: SnackBarBehavior.floating,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                    ),
                                  );
                                }
                              } finally {
                                if (mounted)
                                  setState(() => _isActionLoading = false);
                              }
                            },
                      icon: const Icon(Icons.check_rounded, size: 14),
                      label: _isActionLoading
                          ? const SizedBox(
                              width: 14,
                              height: 14,
                              child: CircularProgressIndicator(
                                color: Colors.white,
                                strokeWidth: 2,
                              ),
                            )
                          : Text(
                              'Validate',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                              ),
                            ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ] else ...[
            const SizedBox(height: 14),
          ],
        ],
      ),
    );
  }

  Widget _miniExpensePill(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: const Color(0xFF64748B)),
          const SizedBox(width: 4),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF475569),
            ),
          ),
        ],
      ),
    );
  }

  Widget _timeChip(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 8,
            color: const Color(0xFF94A3B8),
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Text(
            value.isEmpty ? '--:--' : value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildItinerary(Map<String, dynamic> details) {
    return Row(
      children: [
        _itineraryPoint('From', details['source'] ?? 'N/A'),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 20),
          child: Icon(Icons.arrow_forward_rounded, color: Color(0xFFBB0633)),
        ),
        _itineraryPoint('To', details['destination'] ?? 'N/A'),
      ],
    );
  }

  Widget _itineraryPoint(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: const Color(0xFF94A3B8),
              fontWeight: FontWeight.w800,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
              letterSpacing: -0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTravelDetails(Map<String, dynamic> details) {
    return Wrap(
      spacing: 16,
      runSpacing: 16,
      children: [
        _detailBox('Mode', details['travel_mode']),
        _detailBox('Vehicle', details['vehicle_type']),
        _detailBox('Composition', details['composition']),
        _detailBox('Starts', details['start_date']),
        _detailBox('Ends', details['end_date']),
      ],
    );
  }

  Widget _detailBox(String label, dynamic value) {
    if (value == null) return const SizedBox.shrink();
    return Container(
      width: 140,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              color: const Color(0xFF94A3B8),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          Text(
            value.toString(),
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAdvanceDetails(Map<String, dynamic> details) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF991B1B), Color(0xFF7F1D1D)],
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF991B1B).withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            'REQUESTED ADVANCE',
            style: GoogleFonts.plusJakartaSans(
              color: Colors.white.withOpacity(0.7),
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            '₹${details['requested_amount']}',
            style: GoogleFonts.plusJakartaSans(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.w900,
              letterSpacing: -1.0,
            ),
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Trip: ${details['trip_destination']} (${details['trip_id']})',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDisputeDetails(Map<String, dynamic> details) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _infoBlock('Category', details['category'] ?? 'N/A'),
          const SizedBox(height: 16),
          Text(
            'Reason',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              color: const Color(0xFF94A3B8),
              fontWeight: FontWeight.w800,
              letterSpacing: 0.5,
            ),
          ),
          Text(
            details['reason'] ?? 'N/A',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              color: const Color(0xFFBB0633),
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildExpenseBreakdown(dynamic expensesData) {
    if (expensesData == null) return const SizedBox.shrink();
    final List expenses = expensesData as List;
    return Column(
      children: expenses
          .map(
            (exp) => Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          exp['category'] ?? exp['nature'] ?? 'Other',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF64748B),
                          ),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        exp['date'] ?? '',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFF94A3B8),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: () {
                          final String rawDesc =
                              exp['description']?.toString() ?? '';
                          String description = rawDesc;

                          if (rawDesc.isNotEmpty) {
                            try {
                              final d = _parseExpenseDescription(exp);

                              // Extract meaningful location info
                              final String origin =
                                  d['origin']?.toString() ?? '';
                              final String dest =
                                  (d['destination'] ??
                                          d['location'] ??
                                          d['hotelName'] ??
                                          d['hotel_name'] ??
                                          '')
                                      .toString();

                              final String category = (exp['category'] ?? '').toString().toLowerCase();
                              if (category == 'others' || category == 'other') {
                                final String nature = (d['nature'] ?? d['incidentalType'] ?? '').toString();
                                final String justification = (d['justification'] ?? d['notes'] ?? d['remarks'] ?? d['purpose'] ?? '').toString();
                                if (nature.isNotEmpty && justification.isNotEmpty) {
                                  description = "$nature: $justification";
                                } else if (nature.isNotEmpty) {
                                  description = nature;
                                } else if (justification.isNotEmpty) {
                                  description = justification;
                                } else {
                                  description = "Others";
                                }
                              } else if (origin.isNotEmpty || dest.isNotEmpty) {
                                description =
                                    origin.isNotEmpty && dest.isNotEmpty
                                    ? "$origin → $dest"
                                    : (origin.isNotEmpty ? origin : dest);
                              } else if (d['purpose'] != null &&
                                  d['purpose'].toString().isNotEmpty) {
                                description = d['purpose'].toString();
                              } else {
                                description = "Trip Segment Details";
                              }

                              // Add distance/remarks if available
                              if (d['odoStart'] != null &&
                                  d['odoEnd'] != null) {
                                try {
                                  final start = double.parse(
                                    d['odoStart'].toString(),
                                  );
                                  final end = double.parse(
                                    d['odoEnd'].toString(),
                                  );
                                  description +=
                                      " (${(end - start).toStringAsFixed(1)} km)";
                                } catch (_) {}
                              }

                              if (d['remarks'] != null &&
                                  d['remarks'].toString().isNotEmpty &&
                                  d['remarks'].toString().toLowerCase() !=
                                      'null') {
                                description += "\nNote: ${d['remarks']}";
                              }
                            } catch (e) {
                              description = "Activity Details";
                            }
                          }

                          return Text(
                            description,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF0F172A),
                            ),
                          );
                        }(),
                      ),
                      Text(
                        '₹${exp['amount']}',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ],
                  ),
                  if (exp['receipt_image'] != null &&
                      exp['receipt_image'].toString() != '[]' &&
                      exp['receipt_image'].toString().isNotEmpty &&
                      exp['receipt_image'].toString() != 'null') ...[
                    const SizedBox(height: 8),
                    _miniImageThumbnail(
                      exp['receipt_image'].toString(),
                      "Receipt",
                    ),
                  ],
                  // ── PLANNED vs ACTUAL DEVIATION ─────────────────────────
                  if (exp['is_deviated'] == true) ...[
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color:
                            (exp['deviation_reason']?.toString() ?? '')
                                .startsWith('[Skipped]')
                            ? const Color(0xFFFEF2F2)
                            : const Color(0xFFFFFBEB),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color:
                              (exp['deviation_reason']?.toString() ?? '')
                                  .startsWith('[Skipped]')
                              ? const Color(0xFFFCA5A5)
                              : const Color(0xFFF59E0B),
                          width: 1.2,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? Icons.remove_circle_outline_rounded
                                    : Icons.warning_amber_rounded,
                                size: 13,
                                color:
                                    (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? const Color(0xFFEF4444)
                                    : const Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 5),
                              Text(
                                (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? 'NOT VISITED'
                                    : 'ROUTE DEVIATION',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w900,
                                  color:
                                      (exp['deviation_reason']?.toString() ??
                                              '')
                                          .startsWith('[Skipped]')
                                      ? const Color(0xFF991B1B)
                                      : const Color(0xFF92400E),
                                  letterSpacing: 0.5,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          // Planned row
                          if ((exp['planned_origin']?.toString() ?? '')
                                  .isNotEmpty ||
                              (exp['planned_destination']?.toString() ?? '')
                                  .isNotEmpty) ...[
                            Text(
                              'PLANNED',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE2E8F0),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      exp['planned_origin']?.toString() ?? '-',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                                const Padding(
                                  padding: EdgeInsets.symmetric(horizontal: 6),
                                  child: Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 12,
                                    color: Color(0xFF94A3B8),
                                  ),
                                ),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 5,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFE2E8F0),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      exp['planned_destination']?.toString() ??
                                          '-',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                          ],
                          // Actual row
                          if ((exp['deviation_target']?.toString() ?? '')
                              .isNotEmpty) ...[
                            Text(
                              'ACTUAL WENT',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF0D9488),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 5,
                              ),
                              decoration: BoxDecoration(
                                color: const Color(0xFFCCFBF1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                exp['deviation_target']?.toString() ?? '-',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F766E),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                          // Reason
                          if ((exp['deviation_reason']?.toString() ?? '')
                              .isNotEmpty) ...[
                            Text(
                              'REASON',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF94A3B8),
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              exp['deviation_reason']?.toString() ?? '',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color:
                                    (exp['deviation_reason']?.toString() ?? '')
                                        .startsWith('[Skipped]')
                                    ? const Color(0xFF991B1B)
                                    : const Color(0xFF92400E),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                  () {
                    final String rawDesc = exp['description']?.toString() ?? '';
                    try {
                      final details = _parseExpenseDescription(exp);
                      if (details.isEmpty) return const SizedBox.shrink();
                      if (details['odoStart'] == null &&
                          details['odoEnd'] == null &&
                          details['odoStartImg'] == null &&
                          details['odoEndImg'] == null &&
                          details['mode'] == null &&
                          details['classType'] == null &&
                          details['class'] == null &&
                          details['pnr'] == null &&
                          details['bookingRef'] == null &&
                          details['subType'] == null &&
                          details['vehicleType'] == null &&
                          details['bookedBy'] == null &&
                          details['travelStatus'] == null &&
                          details['cancellationDate'] == null &&
                          details['refundAmount'] == null &&
                          details['cancellationReason'] == null &&
                          (details['selfies'] == null ||
                              (details['selfies'] as List).isEmpty)) {
                        return const SizedBox.shrink();
                      }

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 8.0),
                            child: Divider(height: 1),
                          ),
                          Wrap(
                            spacing: 12,
                            runSpacing: 8,
                            children: [
                              if (details['odoStart'] != null && details['odoStart'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Odo Start',
                                  '${details['odoStart']} km',
                                ),
                              if (details['odoEnd'] != null && details['odoEnd'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Odo End',
                                  '${details['odoEnd']} km',
                                ),
                              if (details['mode'] != null && details['mode'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Mode',
                                  details['mode'].toString(),
                                ),
                              if (details['vehicleType'] != null && details['vehicleType'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Vehicle Type',
                                  details['vehicleType'].toString(),
                                ),
                              if (details['classType'] != null && details['classType'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Class',
                                  details['classType'].toString(),
                                ),
                              if (details['pnr'] != null && details['pnr'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'PNR/Booking Ref',
                                  details['pnr'].toString(),
                                ),
                              if (details['bookedBy'] != null && details['bookedBy'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Booked By',
                                  details['bookedBy'].toString(),
                                ),
                              if (details['travelStatus'] != null && details['travelStatus'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Travel Status',
                                  details['travelStatus'].toString(),
                                ),
                              if (details['refundAmount'] != null && details['refundAmount'].toString().isNotEmpty && double.tryParse(details['refundAmount'].toString()) != 0)
                                _miniInfoBlock(
                                  'Refund Amount',
                                  '₹${details['refundAmount']}',
                                ),
                              if (details['cancellationDate'] != null && details['cancellationDate'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Cancellation Date',
                                  details['cancellationDate'].toString(),
                                ),
                              if (details['cancellationReason'] != null && details['cancellationReason'].toString().isNotEmpty)
                                _miniInfoBlock(
                                  'Cancellation Reason',
                                  details['cancellationReason'].toString(),
                                ),
                            ],
                          ),
                          () {
                            final List? incidentals =
                                details['incidentals'] as List?;
                            if (incidentals == null || incidentals.isEmpty) {
                              return const SizedBox.shrink();
                            }
                            return Container(
                              margin: const EdgeInsets.only(top: 12),
                              padding: const EdgeInsets.all(10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFF1F5F9).withOpacity(0.5),
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      const Icon(
                                        Icons.receipt_long_rounded,
                                        size: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        "INCIDENTAL BREAKDOWN",
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 9,
                                          fontWeight: FontWeight.w800,
                                          color: const Color(0xFF64748B),
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  ...incidentals.map(
                                    (inc) => Padding(
                                      padding: const EdgeInsets.only(bottom: 4),
                                      child: Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            inc['category']?.toString() ??
                                                'Other',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: const Color(0xFF475569),
                                            ),
                                          ),
                                          Text(
                                            '₹${inc['amount']}',
                                            style: GoogleFonts.plusJakartaSans(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w900,
                                              color: const Color(0xFF0F172A),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }(),
                          if (details['odoStartImg'] != null ||
                              details['odoEndImg'] != null ||
                              details['jobReportAttachments'] != null ||
                              (details['selfies'] != null &&
                                  (details['selfies'] as List).isNotEmpty)) ...[
                            const SizedBox(height: 8),
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  if (details['odoStartImg'] != null)
                                    _miniImageThumbnail(
                                      details['odoStartImg'],
                                      "Start",
                                    ),
                                  if (details['odoEndImg'] != null)
                                    _miniImageThumbnail(
                                      details['odoEndImg'],
                                      "End",
                                    ),
                                  if (details['selfies'] != null)
                                    ...(details['selfies'] as List)
                                        .map(
                                          (s) => _miniImageThumbnail(
                                            s.toString(),
                                            "Selfie",
                                          ),
                                        )
                                        .toList(),
                                  if (details['jobReportAttachments'] != null)
                                    ...(details['jobReportAttachments'] as List)
                                        .map(
                                          (s) => _miniImageThumbnail(
                                            s.toString(),
                                            "Job Pic",
                                          ),
                                        )
                                        .toList(),
                                ],
                              ),
                            ),
                          ],
                        ],
                      );
                    } catch (e) {
                      return const SizedBox.shrink();
                    }
                  }(),
                  () {
                    final pFin = exp['finance_remarks']?.toString();
                    final pHr = exp['hr_remarks']?.toString();
                    final pRm = exp['rm_remarks']?.toString();
                    final hasRemarks =
                        (pFin != null && pFin.isNotEmpty) ||
                        (pHr != null && pHr.isNotEmpty) ||
                        (pRm != null && pRm.isNotEmpty);

                    return Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(top: 12),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (pFin != null && pFin.isNotEmpty)
                            Text.rich(
                              TextSpan(
                                children: [
                                  const TextSpan(
                                    text: 'Fin: ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  TextSpan(text: pFin),
                                ],
                              ),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: const Color(0xFF475569),
                              ),
                            ),
                          if (pHr != null && pHr.isNotEmpty)
                            Text.rich(
                              TextSpan(
                                children: [
                                  const TextSpan(
                                    text: 'HR: ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  TextSpan(text: pHr),
                                ],
                              ),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: const Color(0xFF475569),
                              ),
                            ),
                          if (pRm != null && pRm.isNotEmpty)
                            Text.rich(
                              TextSpan(
                                children: [
                                  const TextSpan(
                                    text: 'RM: ',
                                    style: TextStyle(
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  TextSpan(text: pRm),
                                ],
                              ),
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: const Color(0xFF475569),
                              ),
                            ),
                          if (!hasRemarks)
                            Text(
                              'No remarks',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: const Color(0xFF94A3B8),
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                        ],
                      ),
                    );
                  }(),
                  if ((widget.task['type'] == 'Expense Claim' || widget.task['type'] == 'Monthly Tour Plan') && (isHR || isFinance || canEditAmount)) ...[
                    if (allowanceLoading)
                      const Center(
                        child: Padding(
                          padding: EdgeInsets.symmetric(vertical: 20.0),
                          child: CircularProgressIndicator(),
                        ),
                      )
                    else () {
                      final ea = allowanceData?['expense_allowances']?.firstWhere(
                        (a) => a['expense_id'].toString() == exp['id'].toString(),
                        orElse: () => null,
                      );
                      final dec = hrDecisions[exp['id']];
                      if (ea == null || dec == null) return const SizedBox.shrink();

                      final claimedVal = double.tryParse(ea['claimed_amount']?.toString() ?? '0') ?? 0.0;
                      final allowedVal = ea['allowed_amount'] != null
                          ? (double.tryParse(ea['allowed_amount'].toString()) ?? 0.0)
                          : null;
                      final exceedsLimit = ea['exceeds_limit'] == true;
                      final isWithinLimit = (allowedVal == null || claimedVal <= allowedVal) && !exceedsLimit;

                      String allowedLabel = 'Allowed Amount';
                      String allowedValueText = allowedVal != null ? '₹${allowedVal.toStringAsFixed(2)}' : 'No Cap';
                      Color allowedColor = exceedsLimit ? const Color(0xFFF59E0B) : const Color(0xFF10B981);

                      final String hrRole = exp['hr_selected_by_role']?.toString() ?? 'HR';
                      final String hrRoleLabel = hrRole == 'HR' ? 'HR Approved' : '$hrRole Recommended';

                      if (isFinance) {
                        if (exp['finance_selected_amount'] != null) {
                          allowedLabel = isFinanceHead ? 'Finance Exec Rec' : 'Finance Approved';
                          allowedValueText = '₹${double.parse(exp['finance_selected_amount'].toString()).toStringAsFixed(2)}';
                          allowedColor = const Color(0xFF10B981);
                        } else if (exp['hr_selected_amount'] != null) {
                          allowedLabel = hrRoleLabel;
                          allowedValueText = '₹${double.parse(exp['hr_selected_amount'].toString()).toStringAsFixed(2)}';
                          allowedColor = const Color(0xFFF59E0B);
                        }
                      } else if (isHR) {
                        if (exp['hr_selected_amount'] != null) {
                          allowedLabel = hrRoleLabel;
                          allowedValueText = '₹${double.parse(exp['hr_selected_amount'].toString()).toStringAsFixed(2)}';
                          allowedColor = const Color(0xFF10B981);
                        }
                      }

                      return Container(
                        width: double.infinity,
                        margin: const EdgeInsets.only(top: 20),
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      Icons.shield_outlined,
                                      size: 16,
                                      color: isWithinLimit ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      isFinance ? "Finance Policy & Approval" : "HR Policy & Approval",
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: const Color(0xFF1E293B),
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  'City: ${ea['city_type'] ?? 'Others'}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            const Divider(height: 1, color: Color(0xFFE2E8F0)),
                            const SizedBox(height: 12),
                            
                            if (exceedsLimit) ...[
                              Container(
                                padding: const EdgeInsets.all(12),
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFEF2F2),
                                  border: Border.all(color: const Color(0xFFFEE2E2)),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(Icons.warning_amber_rounded, size: 16, color: Color(0xFFEF4444)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Policy Violation: ${ea['policy_note'] ?? "Restricted travel mode, class, or vehicle type selected."}',
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF991B1B),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

                            Row(
                              children: [
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Claimed',
                                          style: GoogleFonts.plusJakartaSans(fontSize: 9, color: const Color(0xFF64748B), fontWeight: FontWeight.w700),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '₹${claimedVal.toStringAsFixed(2)}',
                                          style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF334155)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          allowedLabel,
                                          style: GoogleFonts.plusJakartaSans(fontSize: 9, color: const Color(0xFF64748B), fontWeight: FontWeight.w700),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          allowedValueText,
                                          style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: allowedColor),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                      border: Border.all(color: const Color(0xFFE2E8F0)),
                                    ),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Policy details',
                                          style: GoogleFonts.plusJakartaSans(fontSize: 9, color: const Color(0xFF64748B), fontWeight: FontWeight.w700),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          ea['policy_note'] ?? 'No policy note.',
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700, color: const Color(0xFF475569)),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),

                            if (isWithinLimit) ...[
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.all(10),
                                margin: const EdgeInsets.only(bottom: 12),
                                decoration: BoxDecoration(
                                  color: const Color(0xFFECFDF5),
                                  border: Border.all(color: const Color(0xFFA7F3D0)),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '✓ Claimed amount is within policy limit.',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF065F46),
                                  ),
                                ),
                              ),
                            ],
                            Text(
                              'Select Claim Approval Option:',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF475569),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      handleDecisionChange(exp['id'], 'source', 'claimed');
                                      handleDecisionChange(exp['id'], 'amount', claimedVal.toString());
                                    },
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: dec['source'] == 'claimed' ? const Color(0xFF1E293B) : Colors.white,
                                      side: BorderSide(color: dec['source'] == 'claimed' ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                    ),
                                    child: Text(
                                      'Use Claimed (₹${claimedVal.toStringAsFixed(0)})',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: dec['source'] == 'claimed' ? Colors.white : const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      handleDecisionChange(exp['id'], 'source', 'allowed');
                                      if (isFinance && exp['hr_selected_amount'] != null) {
                                        handleDecisionChange(exp['id'], 'amount', exp['hr_selected_amount'].toString());
                                      } else {
                                        handleDecisionChange(exp['id'], 'amount', (allowedVal ?? claimedVal).toString());
                                      }
                                    },
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: dec['source'] == 'allowed' ? const Color(0xFF1E293B) : Colors.white,
                                      side: BorderSide(color: dec['source'] == 'allowed' ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                    ),
                                    child: Text(
                                      isFinance && exp['hr_selected_amount'] != null
                                          ? 'Use $hrRoleLabel (₹${double.parse(exp['hr_selected_amount'].toString()).toStringAsFixed(0)})'
                                          : 'Use Allowed (₹${(allowedVal ?? claimedVal).toStringAsFixed(0)})',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: dec['source'] == 'allowed' ? Colors.white : const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: OutlinedButton(
                                    onPressed: () {
                                      handleDecisionChange(exp['id'], 'source', 'manual');
                                    },
                                    style: OutlinedButton.styleFrom(
                                      backgroundColor: dec['source'] == 'manual' ? const Color(0xFF1E293B) : Colors.white,
                                      side: BorderSide(color: dec['source'] == 'manual' ? const Color(0xFF1E293B) : const Color(0xFFCBD5E1)),
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                      padding: const EdgeInsets.symmetric(vertical: 8),
                                    ),
                                    child: Text(
                                      'Manual Adjust',
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: dec['source'] == 'manual' ? Colors.white : const Color(0xFF475569),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            
                            if (dec['source'] == 'manual') ...[
                              TextField(
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: InputDecoration(
                                  labelText: 'Approved Amount (₹)',
                                  hintText: 'Enter custom amount',
                                  labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  errorText: dec['error'] != null && dec['error'].toString().isNotEmpty && !dec['error'].toString().contains('note') ? dec['error'] : null,
                                ),
                                controller: TextEditingController(text: dec['amount']?.toString() ?? '')..selection = TextSelection.fromPosition(
                                  TextPosition(offset: (dec['amount']?.toString() ?? '').length),
                                ),
                                onChanged: (v) {
                                  handleDecisionChange(exp['id'], 'amount', v);
                                },
                              ),
                              const SizedBox(height: 12),
                            ],

                            TextField(
                              maxLines: 2,
                              decoration: InputDecoration(
                                labelText: dec['source'] == 'claimed' ? 'Policy Deviation Note (Optional)' : 'Policy Deviation Note (Mandatory)',
                                labelStyle: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700),
                                hintText: 'Enter reason for policy deviation...',
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                errorText: dec['error'] != null && dec['error'].toString().isNotEmpty && dec['error'].toString().contains('note') ? dec['error'] : null,
                              ),
                              controller: TextEditingController(text: dec['note']?.toString() ?? '')..selection = TextSelection.fromPosition(
                                TextPosition(offset: (dec['note']?.toString() ?? '').length),
                              ),
                              onChanged: (v) {
                                handleDecisionChange(exp['id'], 'note', v);
                              },
                            ),
                            const SizedBox(height: 12),

                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: _isActionLoading ? null : () => saveExpenseDecision(exp['id']),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF10B981),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                child: _isActionLoading
                                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                    : Text(
                                        'Save Decision',
                                        style: GoogleFonts.plusJakartaSans(
                                          color: Colors.white,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }(),
                  ] else if (!widget.isHistory) ...[
                    const SizedBox(height: 16),
                    TextField(
                      onChanged: (v) => itemRemarks[exp['id'].toString()] = v,
                      decoration: InputDecoration(
                        hintText: 'Add justification...',
                        hintStyle: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          color: const Color(0xFFCBD5E1),
                          fontWeight: FontWeight.w600,
                        ),
                        filled: true,
                        fillColor: const Color(0xFFF8FAFC),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 10,
                        ),
                      ),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () =>
                                _handleItemAction(exp['id'], 'Rejected'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Color(0xFFFFE4E6)),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              'Reject Item',
                              style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 0.5),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: ElevatedButton(
                            onPressed: () =>
                                _handleItemAction(exp['id'], 'Approved'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              elevation: 0,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                            ),
                            child: Text(
                              'Approve Item',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          )
          .toList(),
    );
  }

  Widget _buildMileageLog(Map<String, dynamic> odo) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _odoReading('Start Reading', odo['start_reading']?.toString() ?? '0'),
          const Icon(
            Icons.arrow_forward_rounded,
            color: Color(0xFF94A3B8),
            size: 20,
          ),
          _odoReading('End Reading', odo['end_reading']?.toString() ?? '0'),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFBB0633),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              '${odo['total_km'] ?? 0} KM',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _odoReading(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            color: const Color(0xFF94A3B8),
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        Text(
          '$value KM',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }

  Widget _miniInfoBlock(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            color: Colors.grey,
            fontWeight: FontWeight.w700,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _miniImageThumbnail(dynamic imageInput, String label) {
    if (imageInput == null) return const SizedBox.shrink();

    String path = '';
    if (imageInput is List) {
      if (imageInput.isEmpty) return const SizedBox.shrink();
      path = imageInput.first.toString().trim();
    } else {
      path = imageInput.toString().trim();
      if (path.isEmpty || path == 'null' || path == '[]' || path == '[""]') {
        return const SizedBox.shrink();
      }

      // Handle JSON array string if needed (common for receipts)
      if (path.startsWith('[') && path.endsWith(']')) {
        try {
          final decoded = jsonDecode(path);
          if (decoded is List && decoded.isNotEmpty) {
            path = decoded.first.toString().trim();
          } else if (decoded is String) {
            path = decoded.trim();
          }
        } catch (e) {
          // fallback to original string
        }
      }
    }

    if (path.isEmpty || path == 'null' || path == '[]' || path == '[""]') {
      return const SizedBox.shrink();
    }

    // Clean legacy formats [u'path'] or ['path'] or 'path'
    path = path
        .replaceFirst(RegExp(r"^\[u'"), '')
        .replaceFirst(RegExp(r"^u'"), '')
        .replaceFirst(RegExp(r"^'"), '');
    path = path
        .replaceFirst(RegExp(r"'\]$"), '')
        .replaceFirst(RegExp(r"'$"), '');

    Widget imageWidget;
    Widget largeImageWidget;
    try {
      if (path.startsWith('data:image')) {
        final base64String = path.split(',').last;
        final bytes = base64Decode(base64String);
        imageWidget = Image.memory(
          bytes,
          fit: BoxFit.cover,
        );
        largeImageWidget = Image.memory(
          bytes,
          fit: BoxFit.contain,
        );
      } else if (path.startsWith('/9j/') ||
          path.startsWith('iVBORw0KG') ||
          (path.length > 300 && !path.contains('/') && !path.contains(':'))) {
        final bytes = base64Decode(path);
        imageWidget = Image.memory(bytes, fit: BoxFit.cover);
        largeImageWidget = Image.memory(bytes, fit: BoxFit.contain);
      } else {
        final String backendBase = ApiConstants.baseUrl;
        final String fullUrl = path.startsWith('http')
            ? path
            : '$backendBase${path.startsWith('/') ? '' : '/'}$path';
        imageWidget = Image.network(
          fullUrl,
          fit: BoxFit.cover,
          errorBuilder: (c, e, s) =>
              const Icon(Icons.broken_image, size: 20, color: Colors.grey),
        );
        largeImageWidget = Image.network(
          fullUrl,
          fit: BoxFit.contain,
          errorBuilder: (c, e, s) =>
              const Icon(Icons.broken_image, size: 20, color: Colors.grey),
        );
      }
    } catch (e) {
      imageWidget = const Icon(
        Icons.error_outline,
        size: 20,
        color: Colors.red,
      );
      largeImageWidget = imageWidget;
    }

    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (context) => Dialog(
            backgroundColor: Colors.black,
            insetPadding: const EdgeInsets.all(10),
            child: Stack(
              alignment: Alignment.center,
              children: [
                InteractiveViewer(
                  panEnabled: true,
                  minScale: 0.5,
                  maxScale: 4.0,
                  child: largeImageWidget,
                ),
                Positioned(
                  top: 10,
                  right: 10,
                  child: IconButton(
                    icon: const Icon(
                      Icons.close,
                      color: Colors.white,
                      size: 30,
                    ),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
              ],
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        width: 60,
        height: 60,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: Colors.grey.withOpacity(0.3)),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(10),
          child: Stack(
            children: [
              Positioned.fill(child: imageWidget),
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  color: Colors.black.withOpacity(0.5),
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: Colors.white, fontSize: 8),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
