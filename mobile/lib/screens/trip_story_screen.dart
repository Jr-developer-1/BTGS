import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:google_fonts/google_fonts.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import '../services/api_service.dart';
import 'trip_expense_grid_screen.dart';
import 'trip_expense_form_detailed.dart';

class TripStoryScreen extends StatefulWidget {
  final String tripId;
  const TripStoryScreen({super.key, required this.tripId});

  @override
  State<TripStoryScreen> createState() => _TripStoryScreenState();
}

class _TripStoryScreenState extends State<TripStoryScreen> {
  final TripService _tripService = TripService();
  final ApiService _apiService = ApiService();
  final Map<String, String> _auditRemarks = {};
  String _luggageWeight = '';
  String _luggageRemarks = '';

  void _showLuggageDialog() {
    final weightController = TextEditingController(text: _luggageWeight);
    final remarksController = TextEditingController(text: _luggageRemarks);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        actionsAlignment: MainAxisAlignment.spaceBetween,
        title: Row(
          children: [
            const Icon(Icons.luggage_rounded, color: Color(0xFFDB2777)),
            const SizedBox(width: 8),
            Text(
              'Additional Luggage',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w900,
                fontSize: 18,
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Luggage weight (in kg/grams) *',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF475569),
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: weightController,
                decoration: InputDecoration(
                  hintText: 'e.g., 5 kg',
                  hintStyle: GoogleFonts.plusJakartaSans(fontSize: 13),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Remarks *',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF475569),
                ),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: remarksController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Add any additional notes...',
                  hintStyle: GoogleFonts.plusJakartaSans(fontSize: 13),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          if (_luggageWeight.isNotEmpty)
            TextButton(
              onPressed: () {
                setState(() {
                  _luggageWeight = '';
                  _luggageRemarks = '';
                });
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Additional Luggage info cleared.'),
                    backgroundColor: Colors.green,
                  ),
                );
              },
              child: Text(
                'DELETE',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.bold,
                  color: Colors.red,
                ),
              ),
            )
          else
            const SizedBox.shrink(),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(
                  'CANCEL',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.bold,
                    color: Colors.grey,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: () {
                  if (weightController.text.trim().isEmpty ||
                      remarksController.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                          'Please enter both luggage weight and remarks.',
                        ),
                        backgroundColor: Colors.red,
                      ),
                    );
                    return;
                  }
                  setState(() {
                    _luggageWeight = weightController.text.trim();
                    _luggageRemarks = remarksController.text.trim();
                  });
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Additional Luggage info saved locally.'),
                      backgroundColor: Colors.green,
                    ),
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFDB2777),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
                child: Text(
                  'SAVE',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  bool _isLoading = true;
  bool _isActionLoading = false;
  Trip? _trip;

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails({bool showLoader = true}) async {
    debugPrint('STORY_SCREEN: _fetchDetails started, showLoader=$showLoader');
    if (showLoader) setState(() => _isLoading = true);
    try {
      final cleanId = widget.tripId.trim();
      debugPrint('STORY_SCREEN: Calling fetchTripDetails for id: $cleanId');
      final trip = await _tripService.fetchTripDetails(cleanId);
      debugPrint('STORY_SCREEN: fetchTripDetails returned. Trip ID: ${trip.id}');
      
      List<dynamic> manualExpenses = [];
      try {
        debugPrint('STORY_SCREEN: Calling fetchExpenses...');
        manualExpenses = await _tripService.fetchExpenses(tripId: cleanId);
        debugPrint('STORY_SCREEN: fetchExpenses returned ${manualExpenses.length} items');
      } catch (e) {
        debugPrint('STORY_SCREEN: fetchExpenses failed: $e');
        manualExpenses = trip.expenses ?? [];
      }

      if (mounted) {
        debugPrint('STORY_SCREEN: Setting state with trip and expenses.');
        setState(() {
          _trip = trip.copyWith(expenses: manualExpenses);
          _isLoading = false;
        });
        debugPrint('STORY_SCREEN: setState complete.');
      } else {
        debugPrint('STORY_SCREEN: Not mounted after fetch.');
      }
    } catch (e, stack) {
      debugPrint('STORY_SCREEN: EXCEPTION in _fetchDetails: $e');
      debugPrint('STORY_SCREEN: STACK TRACE: $stack');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error loading trip story: $e')));
      }
    }
  }

  bool _isApprover() {
    if (_trip == null) return false;
    final user = _apiService.getUser();
    if (user == null) return false;
    final currentApprover =
        _trip!.currentApprover ?? _trip!.claim?['current_approver'];
    return user['id'].toString() == currentApprover.toString();
  }

  bool _isOwner() {
    if (_trip == null) return false;
    final user = _apiService.getUser();
    if (user == null) return false;
    return user['id'].toString() == _trip!.userId.toString();
  }

  Future<void> _handleAction(String action) async {
    setState(() => _isActionLoading = true);
    try {
      if (action == 'Submit' && _trip!.claim == null) {
        // Create new claim initially
        await _tripService.createClaim({'trip': _trip!.id});
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Claim submitted successfully'),
            backgroundColor: Colors.green,
          ),
        );
      } else {
        // Process existing claim or other actions
        final taskId = _trip!.claim != null
            ? "CLAIM-${_trip!.claim!['id']}"
            : "TRIP-${_trip!.tripId}";
        await _tripService.performApproval(taskId, action);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$action successful'),
            backgroundColor: Colors.green,
          ),
        );
      }
      _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to $action: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() => _isActionLoading = false);
    }
  }

  Future<void> _handleItemAction(dynamic itemId, String itemStatus) async {
    if (_trip!.claim == null) return;
    try {
      final remarks = _auditRemarks[itemId.toString()] ?? "";
      await _tripService.performApproval(
        "CLAIM-${_trip!.claim!['id']}",
        'UpdateItem',
        extraData: {
          'item_id': itemId,
          'item_status': itemStatus,
          'remarks': remarks,
        },
      );
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Item updated'),
          backgroundColor: Colors.green,
        ),
      );
      _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to update item: $e'),
          backgroundColor: Colors.red,
        ),
      );
    }
  }

  Future<void> _handleDeleteExpense(dynamic expenseId) async {
    setState(() => _isActionLoading = true);
    try {
      await _tripService.deleteExpense(expenseId.toString());
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Expense record deleted successfully'),
          backgroundColor: Color(0xFF0F172A),
        ),
      );
      _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Failed to delete expense: $e'),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      setState(() => _isActionLoading = false);
    }
  }

  void _confirmDeleteExpense(BuildContext context, dynamic expense) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Delete Expense?',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        content: Text(
          'Are you sure you want to remove this expense record? This action cannot be undone.',
          style: GoogleFonts.plusJakartaSans(fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'CANCEL',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.grey,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _handleDeleteExpense(expense['id']);
            },
            child: Text(
              'DELETE',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.red,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF0D9488)),
            )
          : _trip == null
          ? const Center(child: Text('Trip not found'))
          : RefreshIndicator(
              onRefresh: () => _fetchDetails(showLoader: false),
              color: const Color(0xFF0D9488),
              child: _buildContent(),
            ),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildFinanceGrid(),
                if (_isApprover()) ...[
                  const SizedBox(height: 24),
                  _buildQuickApprovalActions(),
                ],
                const SizedBox(height: 24),
                _buildSectionHeader(Icons.layers_rounded, 'TRIP CORE DETAILS'),
                const SizedBox(height: 12),
                _buildOverviewCard(),
                if (_trip!.odometer != null) ...[
                  const SizedBox(height: 24),
                  _buildSectionHeader(
                    Icons.speed_rounded,
                    'ODOMETER TELEMETRY',
                  ),
                  const SizedBox(height: 12),
                  _buildOdoCard(),
                ],
                const SizedBox(height: 24),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: _buildSectionHeader(
                        Icons.account_balance_wallet_rounded,
                        'DETAILED EXPENSE REGISTRY',
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ElevatedButton(
                          onPressed: _showLuggageDialog,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDB2777),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
                            elevation: 0,
                          ),
                          child: Text(
                            'Additional Luggage',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ),
                        if (_trip!.claim == null ||
                            (_trip!.claim!['status'] ?? '')
                                    .toString()
                                    .toLowerCase() ==
                                'draft') ...[
                          const SizedBox(width: 8),
                          IconButton(
                            onPressed: () async {
                              final refresh = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => TripExpenseGridScreen(
                                    tripId: widget.tripId,
                                    hasAdditionalLuggage:
                                        _luggageWeight.isNotEmpty,
                                  ),
                                ),
                              );
                              if (refresh == true)
                                _fetchDetails(showLoader: false);
                            },
                            icon: const Icon(
                              Icons.add_circle_rounded,
                              size: 24,
                              color: Color(0xFF0F172A),
                            ),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                _buildExpenseSection(),
                if (_trip!.claim != null) ...[
                  const SizedBox(height: 24),
                  _buildSectionHeader(
                    Icons.check_circle_outline_rounded,
                    'SETTLEMENT & PAYOUT LIFECYCLE',
                  ),
                  const SizedBox(height: 12),
                  _buildSettlementCard(),
                ],
                if (_trip!.jobReports != null &&
                    _trip!.jobReports!.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  _buildSectionHeader(
                    Icons.description_outlined,
                    'JOB REPORTS',
                  ),
                  const SizedBox(height: 12),
                  _buildJobReportsSection(),
                ],
                const SizedBox(height: 32),
                _buildActionButtons(),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showTopUpModal() {
    final amountController = TextEditingController();
    final purposeController = TextEditingController();
    String paymentMode = 'Bank Transfer';
    bool isSubmitting = false;
    const double capacityLimit = 45000;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          decoration: const BoxDecoration(
            color: Color(0xFFF1F5F9),
            borderRadius: BorderRadius.vertical(top: Radius.circular(36)),
          ),
          padding: EdgeInsets.fromLTRB(
            0,
            12,
            0,
            MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 48,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey[400],
                      borderRadius: BorderRadius.circular(2.5),
                    ),
                  ),
                ),
                const SizedBox(height: 12),

                // Header with Close Icon
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFC01C2E).withOpacity(0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              widget.tripId,
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFFC01C2E),
                              ),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Trip Advance & Top-up',
                            style: GoogleFonts.interTight(
                              fontSize: 22,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF1E293B),
                              letterSpacing: -0.5,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            size: 20,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Web-style Balance Card
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: const Color(0xFF991B1B), // Dark Red
                      borderRadius: BorderRadius.circular(28),
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
                          'AVAILABLE TRIP BALANCE',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: Colors.white.withOpacity(0.7),
                            letterSpacing: 1.2,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '₹${_trip?.walletBalance?.toStringAsFixed(2) ?? '0.00'}',
                          style: GoogleFonts.interTight(
                            fontSize: 36,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                color: Colors.white,
                                size: 14,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'Low Balance Alert! Top up recommended.',
                                style: GoogleFonts.inter(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 20),
                          child: Divider(color: Colors.white24, height: 1),
                        ),
                        Row(
                          children: [
                            Expanded(
                              child: _webStatItem(
                                'Total Advances',
                                '₹${_trip?.totalApprovedAdvance?.toStringAsFixed(2) ?? '0.00'}',
                                Icons.arrow_upward_rounded,
                              ),
                            ),
                            Container(
                              width: 1,
                              height: 30,
                              color: Colors.white12,
                            ),
                            Expanded(
                              child: _webStatItem(
                                'Total Spent',
                                '₹${_trip?.totalExpenses?.toStringAsFixed(2) ?? '0.00'}',
                                Icons.arrow_downward_rounded,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(height: 24),

                // Form Section
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: Container(
                    padding: const EdgeInsets.all(24),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(28),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'AMOUNT (INR)',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: amountController,
                          keyboardType: TextInputType.number,
                          onChanged: (val) => setModalState(() {}),
                          decoration: _webInputDecoration(
                            Icons.currency_rupee_rounded,
                            'Enter amount',
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'PURPOSE / DESCRIPTION',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF64748B),
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 10),
                        TextField(
                          controller: purposeController,
                          maxLines: 3,
                          decoration: _webInputDecoration(
                            Icons.description_outlined,
                            'Why do you need this top up?',
                          ),
                        ),

                        const SizedBox(height: 32),

                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: isSubmitting
                                ? null
                                : () async {
                                    if (amountController.text.isEmpty ||
                                        purposeController.text.isEmpty) {
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        const SnackBar(
                                          content: Text(
                                            'Please fill all fields',
                                          ),
                                        ),
                                      );
                                      return;
                                    }
                                    setModalState(() => isSubmitting = true);
                                    try {
                                      await _tripService.requestAdvance(
                                        widget.tripId,
                                        double.parse(amountController.text),
                                        purposeController.text,
                                        paymentMode: paymentMode,
                                      );
                                      if (mounted) {
                                        Navigator.pop(context);
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          const SnackBar(
                                            content: Text(
                                              'Top-up request submitted',
                                            ),
                                            backgroundColor: Colors.green,
                                          ),
                                        );
                                        _fetchDetails();
                                      }
                                    } catch (e) {
                                      if (mounted)
                                        ScaffoldMessenger.of(
                                          context,
                                        ).showSnackBar(
                                          SnackBar(
                                            content: Text('Error: $e'),
                                            backgroundColor: Colors.red,
                                          ),
                                        );
                                    } finally {
                                      setModalState(() => isSubmitting = false);
                                    }
                                  },
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(
                                0xFFC01C2E,
                              ), // Crimson
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16),
                              ),
                              elevation: 0,
                            ),
                            child: isSubmitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.send_rounded,
                                        size: 18,
                                        color: Colors.white,
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        'Submit Request',
                                        style: GoogleFonts.inter(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w900,
                                          color: Colors.white,
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
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _webStatItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 12, color: Colors.white70),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w600,
                color: Colors.white70,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: Colors.white,
          ),
        ),
      ],
    );
  }

  InputDecoration _webInputDecoration(IconData icon, String hint) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 18, color: const Color(0xFF94A3B8)),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFC01C2E), width: 1.5),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _footerBtn(
                Icons.picture_as_pdf_rounded,
                'PDF STATEMENT',
                const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _footerBtn(
                Icons.table_view_rounded,
                'EXPORT EXCEL',
                const Color(0xFF1E293B),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: _footerBtn(
            Icons.print_rounded,
            'PRINT SUMMARY',
            const Color(0xFF64748B),
            outline: true,
          ),
        ),
      ],
    );
  }

  Widget _footerBtn(
    IconData icon,
    String label,
    Color color, {
    bool outline = false,
  }) {
    return ElevatedButton.icon(
      onPressed: () {},
      icon: Icon(icon, size: 18, color: outline ? color : Colors.white),
      label: Text(
        label,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: outline ? color : Colors.white,
        ),
      ),
      style: ElevatedButton.styleFrom(
        backgroundColor: outline ? Colors.white : color,
        foregroundColor: outline ? color : Colors.white,
        side: outline ? BorderSide(color: color.withOpacity(0.3)) : null,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: outline ? 0 : 2,
      ),
    );
  }

  Widget _buildQuickApprovalActions() {
    final expenses = _trip!.expenses ?? [];
    final double totalClaimed = expenses.fold(
      0.0,
      (s, e) => s + (double.tryParse(e['amount']?.toString() ?? '0') ?? 0),
    );
    final double approvedNet = expenses
        .where((e) => e['status'] != 'Rejected')
        .fold(
          0.0,
          (s, e) => s + (double.tryParse(e['amount']?.toString() ?? '0') ?? 0),
        );
    final double rejectedTotal = expenses
        .where((e) => e['status'] == 'Rejected')
        .fold(
          0.0,
          (s, e) => s + (double.tryParse(e['amount']?.toString() ?? '0') ?? 0),
        );

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: const BoxDecoration(
              color: Color(0xFFF8FAFC),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _summaryAuditBox(
                  'CLAIMED',
                  '₹${totalClaimed.toStringAsFixed(0)}',
                  const Color(0xFF64748B),
                ),
                _summaryAuditBox(
                  'APPROVED',
                  '₹${approvedNet.toStringAsFixed(0)}',
                  const Color(0xFF10B981),
                ),
                _summaryAuditBox(
                  'REJECTED',
                  '₹${rejectedTotal.toStringAsFixed(0)}',
                  const Color(0xFFEF4444),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isActionLoading
                        ? null
                        : () => _handleAction('Reject'),
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('REJECT ALL'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.red,
                      side: const BorderSide(color: Color(0xFFFFE4E6)),
                      backgroundColor: const Color(0xFFFFF1F2),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isActionLoading
                        ? null
                        : () => _handleAction('Approve'),
                    icon: const Icon(
                      Icons.check_circle_outline_rounded,
                      size: 18,
                    ),
                    label: const Text('FINAL APPROVE'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0D9488),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 4,
                      shadowColor: const Color(0xFF0D9488).withOpacity(0.3),
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

  Widget _summaryAuditBox(String label, String value, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 8,
            fontWeight: FontWeight.w800,
            color: color.withOpacity(0.7),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 8),
        Expanded(
          child: Text(
            title,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF64748B),
              letterSpacing: 1.2,
            ),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        ),
      ],
    );
  }

  Widget _buildHeader() {
    final double totalExpenses = _trip!.totalExpenses ?? 0;
    final double walletBalance = _trip!.walletBalance ?? 0;
    final bool isPayable = walletBalance < 0;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(32),
          bottomRight: Radius.circular(32),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      padding: const EdgeInsets.fromLTRB(16, 50, 16, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: const Icon(
                  Icons.arrow_back_ios_new_rounded,
                  color: Color(0xFF1E293B),
                  size: 18,
                ),
                onPressed: () => Navigator.pop(context),
              ),
              _officialReportTag(),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Image.asset(
                          'assets/bavya_logo.png',
                          height: 16,
                          errorBuilder: (c, e, s) => const Icon(
                            Icons.business_rounded,
                            size: 16,
                            color: Color(0xFF0D9488),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          width: 1,
                          height: 12,
                          color: const Color(0xFFE2E8F0),
                        ),
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            _trip!.tripId,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF64748B),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Trip Story',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 28,
                        fontWeight: FontWeight.w900,
                        color: const Color(0xFF0F172A),
                        letterSpacing: -0.5,
                      ),
                    ),
                    Text(
                      _trip!.purpose,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              _buildStatusPill(_trip!.status),
            ],
          ),
          const SizedBox(height: 24),
          _buildHeroStats(totalExpenses, walletBalance, isPayable),
          const SizedBox(height: 16),
          const SizedBox(height: 16),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _officialReportTag() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.verified_user_rounded,
            size: 12,
            color: Color(0xFF94A3B8),
          ),
          const SizedBox(width: 6),
          Text(
            'OFFICIAL REPORT',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF94A3B8),
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeroStats(double investment, double wallet, bool isPayable) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F766E),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F766E).withOpacity(0.2),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'TOTAL INVESTMENT',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: Colors.white.withOpacity(0.5),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '₹${investment.toStringAsFixed(2)}',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 20,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                  ),
                ),
              ],
            ),
          ),
          Container(width: 1, height: 32, color: Colors.white.withOpacity(0.1)),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'SETTLEMENT STATUS',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: Colors.white.withOpacity(0.5),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isPayable
                      ? 'Payable: ₹${wallet.abs().toStringAsFixed(2)}'
                      : 'Surplus: ₹${wallet.toStringAsFixed(2)}',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                    color: isPayable
                        ? const Color(0xFFF87171)
                        : const Color(0xFF34D399),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusPill(String status) {
    bool isApproved = status.toLowerCase().contains('approved');
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: isApproved ? const Color(0xFFDCFCE7) : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isApproved ? const Color(0xFFBBF7D0) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Text(
        status.toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 9,
          fontWeight: FontWeight.w900,
          color: isApproved ? const Color(0xFF166534) : const Color(0xFF475569),
        ),
      ),
    );
  }

  Widget _buildFinanceGrid() {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: _buildSectionHeader(
                Icons.currency_rupee_rounded,
                'FINANCIAL SUMMARY',
              ),
            ),
            if (!_isApprover() &&
                [
                  'on-going',
                  'approved',
                  'hr approved',
                ].contains(_trip!.status.toLowerCase()))
              TextButton.icon(
                onPressed: () => _showTopUpModal(),
                icon: const Icon(
                  Icons.add_circle_outline_rounded,
                  size: 14,
                  color: Color(0xFFBB0633),
                ),
                label: Text(
                  'TOP-UP',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFFBB0633),
                  ),
                ),
                style: TextButton.styleFrom(
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                ),
              ),
          ],
        ),
        const SizedBox(height: 12),
        Column(
          children: [
            _finBoxLarge(
              'APPROVED ADVANCE',
              '₹${_trip!.totalApprovedAdvance?.toStringAsFixed(0) ?? '0'}',
              const Color(0xFFBB0633),
              const Color(0xFFFFF1F2),
              Icons.account_balance_wallet_rounded,
              'Funds disbursed by HQ',
            ),
            const SizedBox(height: 12),
            _finBoxLarge(
              'RECORDED EXPENSES',
              '₹${_trip!.totalExpenses?.toStringAsFixed(0) ?? '0'}',
              const Color(0xFFF59E0B),
              const Color(0xFFFFFBEB),
              Icons.trending_up_rounded,
              'On-field spending',
            ),
            const SizedBox(height: 12),
            _finBoxLarge(
              'WALLET BALANCE',
              '${(_trip!.walletBalance ?? 0) < 0 ? '-' : ''}₹${_trip!.walletBalance?.abs().toStringAsFixed(0) ?? '0'}',
              (_trip!.walletBalance ?? 0) >= 0
                  ? const Color(0xFF10B981)
                  : const Color(0xFFEF4444),
              const Color(0xFFF8FAFC),
              Icons.credit_card_rounded,
              'Current available liquidity',
            ),
            _buildAdvanceRequestsList(),
          ],
        ),
      ],
    );
  }

  Widget _buildAdvanceRequestsList() {
    if (_trip!.advances == null || _trip!.advances!.isEmpty)
      return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 24),
        Row(
          children: [
            const Icon(
              Icons.history_rounded,
              size: 16,
              color: Color(0xFF64748B),
            ),
            const SizedBox(width: 8),
            Text(
              'ADVANCE REQUESTS HISTORY',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ..._trip!.advances!.map((adv) {
          final status = adv.status;
          final amount = adv.requestedAmount.toString();
          final date = adv.submittedAt?.toIso8601String().split('T')[0] ?? '';
          final mode = 'N/A'; // Advance model doesn't have paymentMode

          Color statusColor = const Color(0xFF64748B);
          if (status.toLowerCase().contains('approved'))
            statusColor = const Color(0xFF10B981);
          if (status.toLowerCase().contains('rejected'))
            statusColor = const Color(0xFFEF4444);
          if (status.toLowerCase().contains('submitted'))
            statusColor = const Color(0xFF3B82F6);

          return Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.account_balance_wallet_rounded,
                    size: 16,
                    color: statusColor,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '₹$amount via $mode',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        'Requested on $date',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status.toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 8,
                      fontWeight: FontWeight.w900,
                      color: statusColor,
                    ),
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ],
    );
  }

  Widget _finBoxLarge(
    String label,
    String value,
    Color primary,
    Color bg,
    IconData icon,
    String sub,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: primary.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              boxShadow: [
                BoxShadow(color: primary.withOpacity(0.1), blurRadius: 10),
              ],
            ),
            child: Icon(icon, color: primary, size: 20),
          ),
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: primary.withOpacity(0.7),
                    letterSpacing: 0.5,
                  ),
                ),
                Text(
                  value,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: primary,
                  ),
                ),
                Text(
                  sub,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: const Color(0xFF94A3B8),
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
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        children: [
          GridView.count(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisCount: 2,
            childAspectRatio: 2.2,
            mainAxisSpacing: 16,
            crossAxisSpacing: 16,
            children: [
              _gridDetailItem(
                Icons.route_rounded,
                'ROUTE',
                '${_trip!.source}\n→ ${_trip!.destination}',
                const Color(0xFFF59E0B),
              ),
              _gridDetailItem(
                Icons.calendar_today_rounded,
                'TIMELINE',
                _trip!.dates,
                const Color(0xFF3B82F6),
              ),
              _gridDetailItem(
                Icons.person_outline_rounded,
                'PERSONNEL',
                _trip!.employee,
                const Color(0xFF8B5CF6),
              ),
              _gridDetailItem(
                Icons.shield_outlined,
                'PROJECT',
                _trip!.projectCode ?? 'General',
                const Color(0xFF10B981),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _gridDetailItem(
            Icons.movie_filter_rounded,
            'PURPOSE',
            _trip!.purpose,
            const Color(0xFFEC4899),
            fullWidth: true,
          ),
          if (_trip!.userBankName != null &&
              _trip!.userBankName!.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.account_balance_rounded,
                    size: 14,
                    color: Color(0xFF64748B),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'Bank: ${_trip!.userBankName} (${_trip!.userAccountNo})',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF475569),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _gridDetailItem(
    IconData icon,
    String label,
    String value,
    Color color, {
    bool fullWidth = false,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withOpacity(0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 16, color: color),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 0.5,
                ),
              ),
              Text(
                value,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF1E293B),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOdoCard() {
    final start = _trip!.odometer?['start_odo_reading'] ?? '0';
    final end = _trip!.odometer?['end_odo_reading'] ?? 'Active';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(child: _odoItem('START READING', '$start KM')),
              Container(
                width: 1,
                height: 40,
                color: Colors.white.withOpacity(0.1),
              ),
              Expanded(
                child: _odoItem(
                  'END READING',
                  end == 'Active' ? 'ACTIVE' : '$end KM',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _odoItem(String label, String value) {
    return Column(
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white.withOpacity(0.5),
            fontSize: 9,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
          ),
        ),
      ],
    );
  }

  String _selectedCategory = 'All';
  final List<String> _categories = [
    'All',
    'Travel',
    'Local Travel',
    'Food',
    'Accommodation',
    'Incidental',
  ];

  Widget _buildExpenseSection() {
    final expenses = _trip!.expenses ?? [];
    if (expenses.isEmpty) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
        ),
        child: Column(
          children: [
            Icon(
              Icons.receipt_long_rounded,
              size: 40,
              color: Colors.grey.shade300,
            ),
            const SizedBox(height: 12),
            Text(
              'No expenses recorded yet',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.grey.shade500,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ],
        ),
      );
    }

    final filteredExpenses = _selectedCategory == 'All'
        ? expenses
        : expenses.where((e) {
            final nature = (e['nature'] ?? e['category'])
                ?.toString()
                .toLowerCase();
            if (_selectedCategory == 'Local Travel')
              return nature == 'fuel' || nature == 'local travel';
            if (_selectedCategory == 'Incidental')
              return nature == 'others' ||
                  nature == 'incidental' ||
                  nature == 'miscellaneous';
            return nature == _selectedCategory.toLowerCase();
          }).toList();

    return Column(
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: _categories.map((cat) {
              final isSelected = _selectedCategory == cat;
              return Padding(
                padding: const EdgeInsets.only(right: 8, bottom: 16),
                child: ChoiceChip(
                  label: Text(cat),
                  selected: isSelected,
                  onSelected: (val) {
                    if (val) setState(() => _selectedCategory = cat);
                  },
                  labelStyle: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: isSelected ? Colors.white : const Color(0xFF64748B),
                  ),
                  selectedColor: const Color(0xFF0F172A),
                  backgroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: isSelected ? 4 : 0,
                  pressElevation: 0,
                ),
              );
            }).toList(),
          ),
        ),
        if (filteredExpenses.isEmpty)
          Padding(
            padding: const EdgeInsets.all(32.0),
            child: Text(
              'No ${_selectedCategory} expenses found',
              style: GoogleFonts.plusJakartaSans(color: Colors.grey),
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: filteredExpenses.length,
            itemBuilder: (context, index) =>
                _buildExpenseCard(filteredExpenses[index]),
          ),
        if (_isOwner() &&
            (_trip!.claim == null ||
                _trip!.claim!['status'] == 'Draft' ||
                _trip!.claim!['status'] == 'Pending')) ...[
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _isActionLoading
                  ? null
                  : () => _handleAction('Submit'),
              icon: const Icon(Icons.send_rounded, size: 18),
              label: Text(
                'SUBMIT FOR CLAIM',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  letterSpacing: 1,
                ),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF10B981),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 20),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
                elevation: 4,
                shadowColor: const Color(0xFF10B981).withOpacity(0.3),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildExpenseCard(dynamic exp) {
    var nature = (exp['nature'] ?? exp['category'])?.toString() ?? 'Other';
    final amount = exp['amount'] ?? '0';
    final date = exp['date'] ?? '';
    final remarks = exp['remarks'];
    final status = exp['status'] ?? 'Pending';
    final isRejected = status.toString().toLowerCase() == 'rejected';
    final isApproved = status.toString().toLowerCase() == 'approved';
    var details = exp['details'] ?? {};
    if (details.isEmpty &&
        exp['description'] is String &&
        exp['description'].toString().startsWith('{')) {
      try {
        details = jsonDecode(exp['description']);
      } catch (e) {}
    }

    // Refine nature if it's stored as 'Others' but has travel data
    if ((nature == 'Others' || nature == 'Other') &&
        details['origin'] != null &&
        details['destination'] != null &&
        (details['mode'] != null || details['travel_mode'] != null)) {
      nature = 'Travel';
    }

    // Normalize nature for mobile labeling
    String displayNature = nature;
    if (nature.toLowerCase() == 'fuel') displayNature = 'Local Travel';
    if (nature.toLowerCase() == 'others' ||
        nature.toLowerCase() == 'other' ||
        nature.toLowerCase() == 'miscellaneous')
      displayNature = 'Others';
    if (nature.toLowerCase() == 'incidental') displayNature = 'Incidental';

    // Smart override: if details contain any local conveyance/travel data,
    // always open Local Travel form regardless of stored nature
    final bool hasLocalConveyanceData =
        details['origin'] != null ||
        details['destination'] != null ||
        details['odoStart'] != null ||
        details['odo_start'] != null ||
        details['mode'] != null ||
        details['subType'] != null ||
        details['vehicle_type'] != null;
    if (hasLocalConveyanceData) displayNature = 'Local Travel';

    // Construct "Activity / Route Details" summary to match web grid
    String mainDisplay = nature;
    String subDisplay = date;

    if (hasLocalConveyanceData ||
        nature.toLowerCase() == 'local travel' ||
        nature.toLowerCase() == 'fuel') {
      // Local conveyance — show mode + route
      String mode = details['mode'] ?? 'Bike';
      String subType = details['subType'] ?? 'Own Bike';
      String route =
          (details['origin'] != null && details['destination'] != null)
          ? '${details['origin']} → ${details['destination']}'
          : (remarks ?? 'Local Movement');

      mainDisplay =
          '${mode.isNotEmpty ? mode : 'Local'} - ${subType.isNotEmpty ? subType : 'Travel'}';
      subDisplay = route;
    } else if (!hasLocalConveyanceData &&
        (nature.toLowerCase().contains('other') ||
            nature.toLowerCase() == 'incidental')) {
      mainDisplay = (remarks != null && remarks.toString().trim().isNotEmpty)
          ? remarks.toString()
          : (nature.trim().isNotEmpty ? nature : 'Other Expense');
      subDisplay = date;
    } else if (nature.toLowerCase() == 'travel') {
      String mode = details['mode'] ?? 'Travel';
      String route =
          (details['origin'] != null && details['destination'] != null)
          ? '${details['origin']} → ${details['destination']}'
          : (remarks ?? 'Outstation Voyage');
      mainDisplay = mode.isNotEmpty ? mode : 'Travel';
      subDisplay = route;
    } else if (nature.toLowerCase() == 'food') {
      mainDisplay =
          (details['restaurant'] != null &&
              details['restaurant'].toString().isNotEmpty)
          ? details['restaurant']
          : (nature.isNotEmpty ? nature : 'Food & Refreshments');
      subDisplay = date;
    } else if (nature.toLowerCase() == 'accommodation') {
      mainDisplay =
          (details['hotelName'] != null &&
              details['hotelName'].toString().isNotEmpty)
          ? details['hotelName']
          : (nature.isNotEmpty ? nature : 'Accommodation');
      subDisplay = date;
    } else {
      mainDisplay = nature.trim().isNotEmpty ? nature : 'Other Expense';
      subDisplay = date;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: isRejected
            ? Border.all(color: Colors.red.withOpacity(0.3))
            : Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        children: [
          ListTile(
            leading: Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(15),
                border: Border.all(color: const Color(0xFFF1F5F9)),
              ),
              child: Icon(
                (hasLocalConveyanceData ||
                        nature.toLowerCase() == 'fuel' ||
                        nature.toLowerCase() == 'local travel')
                    ? Icons.directions_car_filled_rounded
                    : Icons.receipt_long_rounded,
                size: 20,
                color: const Color(0xFF0F172A),
              ),
            ),
            title: Text(
              mainDisplay,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: const Color(0xFF1E293B),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              subDisplay,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF94A3B8),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            trailing: GestureDetector(
              onTap:
                  (isApproved ||
                      (_trip!.claim != null &&
                          (_trip!.claim!['status'] ?? '')
                                  .toString()
                                  .toLowerCase() !=
                              'draft'))
                  ? null
                  : () async {
                      final refresh = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => TripExpenseFormDetailedScreen(
                            category: displayNature,
                            tripId: widget.tripId,
                            expenseData: exp,
                            hasAdditionalLuggage: _luggageWeight.isNotEmpty,
                          ),
                        ),
                      );
                      if (refresh == true) _fetchDetails(showLoader: false);
                    },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: isApproved
                      ? const Color(0xFFF0FDF4)
                      : isRejected
                      ? const Color(0xFFFFF1F2)
                      : const Color(0xFFF5F3FF),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: isApproved
                        ? const Color(0xFFBBF7D0)
                        : isRejected
                        ? const Color(0xFFFECACA)
                        : const Color(0xFFE0E7FF),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹$amount',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w900,
                        fontSize: 15,
                        color: isApproved
                            ? const Color(0xFF16A34A)
                            : isRejected
                            ? const Color(0xFFDC2626)
                            : const Color(0xFF4F46E5),
                        decoration:
                            (!isApproved &&
                                !isRejected &&
                                (_trip!.claim == null ||
                                    (_trip!.claim!['status'] ?? '')
                                            .toString()
                                            .toLowerCase() ==
                                        'draft'))
                            ? TextDecoration.underline
                            : TextDecoration.none,
                        decorationColor: const Color(0xFF4F46E5),
                      ),
                    ),
                    Text(
                      status.toString().toUpperCase(),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 7,
                        fontWeight: FontWeight.w800,
                        color: isApproved
                            ? const Color(0xFF10B981)
                            : isRejected
                            ? Colors.red
                            : const Color(0xFFF59E0B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          // EDIT / ACTION STRIP — only for non-approved expenses AND non-submitted claims
          if (!isApproved &&
              (_trip!.claim == null ||
                  (_trip!.claim!['status'] ?? '').toString().toLowerCase() ==
                      'draft'))
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isActionLoading
                          ? null
                          : () async {
                              final refresh = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      TripExpenseFormDetailedScreen(
                                        category: displayNature,
                                        tripId: widget.tripId,
                                        expenseData: exp,
                                        hasAdditionalLuggage:
                                            _luggageWeight.isNotEmpty,
                                      ),
                                ),
                              );
                              if (refresh == true) _fetchDetails();
                            },
                      icon: const Icon(Icons.edit_rounded, size: 14),
                      label: Text(
                        'Edit',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF4F46E5),
                        side: const BorderSide(color: Color(0xFFE0E7FF)),
                        backgroundColor: const Color(0xFFF5F3FF),
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                        minimumSize: const Size(0, 36),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  OutlinedButton.icon(
                    onPressed: _isActionLoading
                        ? null
                        : () => _confirmDeleteExpense(context, exp),
                    icon: const Icon(Icons.delete_outline_rounded, size: 14),
                    label: Text(
                      'Delete',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFFEF4444),
                      side: const BorderSide(color: Color(0xFFFEE2E2)),
                      backgroundColor: const Color(0xFFFFF1F2),
                      padding: const EdgeInsets.symmetric(
                        vertical: 8,
                        horizontal: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(10),
                      ),
                      minimumSize: const Size(0, 36),
                    ),
                  ),
                ],
              ),
            ),
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              title: Text(
                'View Internal Audit / Details',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF64748B),
                ),
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(height: 1, color: const Color(0xFFF1F5F9)),
                      const SizedBox(height: 12),
                      if (details.isNotEmpty)
                        _buildDetailedNatureInfo(displayNature, details, exp),
                      if (remarks != null && remarks.toString().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Container(
                            padding: const EdgeInsets.all(12),
                            width: double.infinity,
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0xFFF1F5F9),
                              ),
                            ),
                            child: Text(
                              'Emp Remarks: $remarks',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                color: const Color(0xFF475569),
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ),
                        ),
                      const SizedBox(height: 16),
                      _buildAuditRemarkRow('RM', exp['rm_remarks']),
                      _buildAuditRemarkRow('HR', exp['hr_remarks']),
                      _buildAuditRemarkRow('FINANCE', exp['finance_remarks']),
                      if (_isApprover()) ...[
                        const SizedBox(height: 20),
                        _buildAuditInputSection(exp),
                      ],
                      if (exp['receipt_image'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: _buildReceiptButton(exp['receipt_image']),
                        ),
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

  Widget _buildSettlementCard() {
    final claim = _trip!.claim ?? {};
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.15),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          _settleGridItem(
            'CLAIM STATUS',
            claim['status'] ?? 'No Claim Filed',
            isBadge: true,
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _settleGridItem(
                  'TRANSFERRED BY',
                  (claim['processed_by'] is Map
                      ? claim['processed_by']['name']
                      : (claim['processed_by']?.toString() ?? 'Waiting')),
                ),
              ),
              Expanded(
                child: _settleGridItem(
                  'TRANSACTION ID',
                  claim['transaction_id'] ?? 'N/A',
                ),
              ),
              Expanded(
                child: _settleGridItem(
                  'PAYOUT DATE',
                  claim['payment_date'] ?? 'N/A',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _settleGridItem(String label, String value, {bool isBadge = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 8,
            fontWeight: FontWeight.w800,
            color: Colors.white.withOpacity(0.4),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        if (isBadge)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              value.toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Colors.white,
              ),
            ),
          )
        else
          Text(
            value,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
            overflow: TextOverflow.ellipsis,
          ),
      ],
    );
  }

  Widget _buildDetailRow(String label, dynamic value) {
    if (value == null || value.toString().isEmpty || value.toString() == 'N/A')
      return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: const Color(0xFF94A3B8),
              fontWeight: FontWeight.w600,
            ),
          ),
          Expanded(
            child: Text(
              value.toString(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF334155),
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailedNatureInfo(String nature, Map details, dynamic expense) {
    switch (nature.toLowerCase()) {
      case 'travel':
      case 'others':
        return Column(
          children: [
            _buildDetailRow('Mode', details['mode'] ?? 'N/A'),
            _buildDetailRow(
              'Route',
              '${details['origin'] ?? 'N/A'} → ${details['destination'] ?? 'N/A'}',
            ),
            _buildDetailRow('Vehicle', details['carrier'] ?? 'N/A'),
            _buildDetailRow(
              'Scheduled',
              '${details['depDate'] ?? ''} ${details['boardingTime'] ?? ''}',
            ),
            _buildDetailRow(
              'Actual',
              '${details['arrDate'] ?? ''} ${details['actualTime'] ?? ''}',
            ),
            _buildDetailRow('Booking', details['bookedBy'] ?? 'N/A'),
            if (details['pnr'] != null) _buildDetailRow('PNR', details['pnr']),
            if (details['ticketNo'] != null)
              _buildDetailRow('Ticket', details['ticketNo']),
          ],
        );
      case 'local travel':
      case 'fuel':
        return Column(
          children: [
            _buildDetailRow(
              'Mode',
              '${details['mode'] ?? 'N/A'} (${details['subType'] ?? 'N/A'})',
            ),
            _buildDetailRow(
              'Route',
              '${details['origin'] ?? 'N/A'} → ${details['destination'] ?? 'N/A'}',
            ),
            if (details['odoStart'] != null) ...[
              _buildDetailRow('Odo Start', '${details['odoStart']} KM'),
              _buildDetailRow('Odo End', '${details['odoEnd'] ?? 'Active'} KM'),
              _buildDetailRow(
                'Distance',
                '${(double.tryParse(details['odoEnd']?.toString() ?? '0') ?? 0) - (double.tryParse(details['odoStart']?.toString() ?? '0') ?? 0)} KM',
              ),
            ],
            _buildDetailRow(
              'Timing',
              '${details['time']?['boardingTime'] ?? details['boardingTime'] ?? ''} - ${details['time']?['actualTime'] ?? details['actualTime'] ?? ''}',
            ),
            if (details['selfies'] != null &&
                (details['selfies'] as List).isNotEmpty) ...[
              _buildDetailRow(
                'Selfie Proofs',
                '${(details['selfies'] as List).length} Captured',
              ),
              const SizedBox(height: 8),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: (details['selfies'] as List)
                      .map((s) => _miniImageThumbnail(s.toString(), "Selfie"))
                      .toList(),
                ),
              ),
              const SizedBox(height: 12),
            ],
            if (details['odoStartImg'] != null || details['odoEndImg'] != null)
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    if (details['odoStartImg'] != null)
                      _miniImageThumbnail(details['odoStartImg'], "Start Odo"),
                    if (details['odoEndImg'] != null)
                      _miniImageThumbnail(details['odoEndImg'], "End Odo"),
                  ],
                ),
              ),
            if (expense['job_report_id'] != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: TextButton.icon(
                  onPressed: () {},
                  icon: const Icon(Icons.description_outlined, size: 14),
                  label: const Text(
                    'View Linked Job Report',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ),
          ],
        );
      case 'food':
        return Column(
          children: [
            _buildDetailRow('Category', details['mealCategory'] ?? 'N/A'),
            _buildDetailRow('Type', details['mealType'] ?? 'N/A'),
            _buildDetailRow('Restaurant', details['restaurant'] ?? 'N/A'),
            _buildDetailRow('Time', details['mealTime'] ?? 'N/A'),
            if (details['invoiceNo'] != null)
              _buildDetailRow('Invoice', details['invoiceNo']),
          ],
        );
      case 'accommodation':
        return Column(
          children: [
            _buildDetailRow('Type', details['accomType'] ?? 'N/A'),
            _buildDetailRow('Hotel', details['hotelName'] ?? 'N/A'),
            _buildDetailRow('City', details['city'] ?? 'N/A'),
            _buildDetailRow(
              'Check-In',
              '${details['checkIn'] ?? ''} ${details['checkInTime'] ?? ''}',
            ),
            _buildDetailRow(
              'Check-Out',
              '${details['checkOut'] ?? ''} ${details['checkOutTime'] ?? ''}',
            ),
            if (details['nights'] != null)
              _buildDetailRow('Nights', details['nights'].toString()),
          ],
        );
      case 'incidental':
        return Column(
          children: [
            _buildDetailRow('Type', details['incidentalType'] ?? 'N/A'),
            _buildDetailRow('Location', details['location'] ?? 'N/A'),
            if (details['otherReason'] != null)
              _buildDetailRow('Reason', details['otherReason']),
            if (details['description'] != null)
              _buildDetailRow('Description', details['description']),
          ],
        );
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildJobReportsSection() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _trip!.jobReports!.length,
      itemBuilder: (context, index) {
        final report = _trip!.jobReports![index];
        final String name = report['user_name'] ?? 'Personnel';
        final String date =
            report['created_at']?.toString().split('T')[0] ?? '';
        final String description = report['description'] ?? '';
        final String? attachment = report['attachment'];
        final String? auditRemarks = report['remarks'];

        return Container(
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
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
            children: [
              // Header like a mail header
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: const Color(0xFFF1F5F9),
                      child: Text(
                        name.isNotEmpty ? name[0].toUpperCase() : 'P',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                name,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF1E293B),
                                ),
                              ),
                              Text(
                                date,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ),
                          Text(
                            'via Mobile Activity Tracking',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1, color: Color(0xFFF1F5F9)),
              // Body content
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  description,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    color: const Color(0xFF475569),
                    height: 1.5,
                  ),
                ),
              ),
              // Audit Remarks if any
              if (auditRemarks != null && auditRemarks.isNotEmpty)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 8,
                  ),
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF1F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFFE4E6)),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.verified_user_rounded,
                        size: 14,
                        color: Color(0xFFBB0633),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Audit: $auditRemarks',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            color: const Color(0xFFBB0633),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              // Attachment segment
              if (attachment != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: InkWell(
                    onTap: () {
                      /* View PDF */
                    },
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEEF2FF),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: const Icon(
                              Icons.picture_as_pdf_rounded,
                              size: 20,
                              color: Color(0xFF4338CA),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Attachment_Report.pdf',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF1E293B),
                                  ),
                                ),
                                Text(
                                  'Tap to view proof document',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    color: const Color(0xFF64748B),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: Color(0xFF94A3B8),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAuditRemarkRow(String role, dynamic remark) {
    if (remark == null || remark.toString().isEmpty)
      return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              role,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 8,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF64748B),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              remark.toString(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                color: const Color(0xFF334155),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAuditInputSection(dynamic exp) {
    return Column(
      children: [
        TextField(
          onChanged: (val) => _auditRemarks[exp['id'].toString()] = val,
          decoration: InputDecoration(
            hintText: 'Add verdict remark...',
            hintStyle: GoogleFonts.plusJakartaSans(fontSize: 12),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.all(16),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => _handleItemAction(exp['id'], 'Rejected'),
                icon: const Icon(Icons.close_rounded, size: 16),
                label: const Text('REJECT ITEM'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.red,
                  side: const BorderSide(color: Color(0xFFFFE4E6)),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildReceiptButton(dynamic receipt) {
    return InkWell(
      onTap: () {
        /* View Full Image */
      },
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            const Icon(
              Icons.image_outlined,
              size: 20,
              color: Color(0xFF64748B),
            ),
            const SizedBox(width: 12),
            Text(
              'View Attached Receipt',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1E293B),
              ),
            ),
            const Spacer(),
            const Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: Color(0xFF94A3B8),
            ),
          ],
        ),
      ),
    );
  }

  Widget _miniImageThumbnail(String? imagePath, String label) {
    if (imagePath == null || imagePath.isEmpty) return const SizedBox.shrink();

    String path = imagePath.trim();
    // Handle JSON array string if needed (common for receipts)
    if (path.startsWith('[') && path.endsWith(']')) {
      try {
        final List<dynamic> list = jsonDecode(path);
        if (list.isNotEmpty) {
          path = list.first.toString().trim();
        }
      } catch (e) {
        // fallback to original string
      }
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
    try {
      if (path.startsWith('data:image')) {
        final base64String = path.split(',').last;
        imageWidget = Image.memory(
          base64Decode(base64String),
          fit: BoxFit.cover,
        );
      } else if (path.startsWith('/9j/') ||
          (path.length > 300 && !path.contains('/') && !path.contains(':'))) {
        imageWidget = Image.memory(base64Decode(path), fit: BoxFit.cover);
      } else {
        const String backendBase = 'http://192.168.1.138:4567';
        final String fullUrl = path.startsWith('http')
            ? path
            : '$backendBase${path.startsWith('/') ? '' : '/'}$path';
        imageWidget = Image.network(
          fullUrl,
          fit: BoxFit.cover,
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
    }

    return Container(
      margin: const EdgeInsets.only(right: 8),
      width: 65,
      height: 65,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.withOpacity(0.3)),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
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
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 8,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
