import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:google_fonts/google_fonts.dart';
import 'trip_expense_form_detailed.dart';
import 'bulk_resolve_rejections_screen.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import '../services/api_service.dart';

class TravelStoryScreen extends StatefulWidget {
  final String tripId;
  const TravelStoryScreen({super.key, required this.tripId});

  @override
  State<TravelStoryScreen> createState() => _TravelStoryScreenState();
}

class _TravelStoryScreenState extends State<TravelStoryScreen> {
  final TripService _tripService = TripService();
  final ApiService _apiService = ApiService();
  final Map<String, String> _auditRemarks = {};
  bool _isLoading = true;
  bool _isActionLoading = false;
  Trip? _trip;
  List<dynamic> _expenses = [];
  List<dynamic> _bulkHistory = [];

  @override
  void initState() {
    super.initState();
    _fetchDetails();
  }

  Future<void> _fetchDetails() async {
    setState(() => _isLoading = true);
    try {
      final trip = await _tripService.fetchTripDetails(widget.tripId);
      final history = await _tripService.fetchBulkHistory(widget.tripId);
      setState(() {
        _trip = trip;
        _expenses = trip.expenses ?? [];
        _bulkHistory = history;
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error loading story: $e')));
      }
    }
  }

  bool _isApprover() {
    if (_trip == null) return false;
    final user = _apiService.getUser();
    if (user == null) return false;
    final currentApprover =
        _trip!.currentApprover ??
        (_trip!.claim != null ? _trip!.claim!['current_approver'] : null);
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
      final taskId = _trip!.claim != null
          ? "CLAIM-${_trip!.claim!['id']}"
          : _trip!.tripId;
      await _tripService.performApproval(taskId, action);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('$action successful'),
          backgroundColor: Colors.green,
        ),
      );
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF0D9488)),
            )
          : _trip == null
          ? const Center(child: Text('Story not found'))
          : _buildContent(),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
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
                _buildSectionHeader(
                  Icons.layers_rounded,
                  'TRAVEL CORE DETAILS',
                ),
                const SizedBox(height: 12),
                _buildOverviewCard(),
                const SizedBox(height: 24),
                _buildSectionHeader(
                  Icons.account_balance_wallet_rounded,
                  'DETAILED EXPENSE REGISTRY',
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
                if (_bulkHistory.isNotEmpty) ...[
                  const SizedBox(height: 24),
                  _buildSectionHeader(
                    Icons.history_rounded,
                    'BULK UPLOAD HISTORY',
                  ),
                  const SizedBox(height: 12),
                  _buildBulkHistorySection(),
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

  Widget _buildSectionHeader(IconData icon, String title) {
    return Row(
      children: [
        Icon(icon, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 8),
        Text(
          title.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
            letterSpacing: 1.2,
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
                        Flexible(
                          child: Container(
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
                              overflow: TextOverflow.ellipsis,
                              maxLines: 1,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Travel Story',
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
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildSectionHeader(
              Icons.currency_rupee_rounded,
              'FINANCIAL SUMMARY',
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
                  color: Color(0xFF0D9488),
                ),
                label: Text(
                  'TOP-UP',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0D9488),
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
              const Color(0xFF0D9488),
              const Color(0xFFF0FDFA),
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
          final mode =
              'N/A'; // Advance model doesn't have paymentMode yet, or use a default

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
                _trip!.considerAsLocal
                    ? (_trip!.userBaseLocation ?? _trip!.source)
                    : '${_trip!.source}\n→ ${_trip!.destination}',
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
          if (_trip!.userBankName != null) ...[
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

  Widget _buildExpenseSection() {
    final List<dynamic> sortedExpenses = [];

    // Track which bulk rows already have real Expense records to avoid duplicates
    final Set<String> existingBulkKeys = {};
    final Set<String> fallbackKeys = {};

    for (var exp in _expenses) {
      var details = exp['details'] ?? {};
      if (details.isEmpty &&
          exp['description'] is String &&
          exp['description'].toString().startsWith('{')) {
        try {
          details = jsonDecode(exp['description']);
        } catch (e) {}
      }

      // EXPLOSION LOGIC: If a manual expense has a list of incidentals,
      // we show them as separate cards in the grid for better visibility.
      List<dynamic> incidentals = [];
      if (details['incidentals'] is List) {
        incidentals = details['incidentals'];
      } else if (details['incidentalAmount'] != null &&
          (double.tryParse(details['incidentalAmount'].toString()) ?? 0) > 0) {
        // Handle legacy or simple form incidentals
        incidentals = [
          {
            'category': details['incidentalCategory'] ?? 'Incidental',
            'amount': details['incidentalAmount'],
          },
        ];
      }

      if (incidentals.isNotEmpty) {
        double totalIncAmount = 0;
        final List<dynamic> subCards = [];

        for (var inc in incidentals) {
          final amt = double.tryParse(inc['amount']?.toString() ?? '0') ?? 0;
          if (amt <= 0) continue;
          totalIncAmount += amt;

          // Create a "Visual Card" for the incidental
          subCards.add({
            ...exp,
            'is_sub_item': true,
            'amount': amt,
            'sub_type': inc['category'] ?? 'Incidental',
            'id': '${exp['id']}_inc_${inc['category']}_$amt',
          });
        }

        // Add the main record (with base amount)
        final double totalAmt =
            double.tryParse(exp['amount']?.toString() ?? '0') ?? 0;
        final baseAmt = (totalAmt - totalIncAmount).clamp(0, double.infinity);

        sortedExpenses.add({...exp, 'amount': baseAmt});

        // Add the incidental cards immediately after
        sortedExpenses.addAll(subCards);
      } else {
        // No incidentals, just add the record as is
        sortedExpenses.add(exp);
      }

      if (details['batch_id'] != null && details['row_index'] != null) {
        existingBulkKeys.add('${details['batch_id']}_${details['row_index']}');
      }

      // Fallback hook for legacy items created before batch_id was stored
      if (details['from_bulk_upload'] == true) {
        final origin = (details['origin'] ?? '')
            .toString()
            .trim()
            .toLowerCase();
        final dest = (details['destination'] ?? '')
            .toString()
            .trim()
            .toLowerCase();
        final date =
            (exp['date'] ??
                    ((details['time'] is Map)
                        ? details['time']['boardingDate']
                        : '') ??
                    '')
                .toString()
                .trim();
        fallbackKeys.add('${origin}_${dest}_$date');
      }
    }

    final List<Widget> batchActions = [];

    // Add rows from non-final bulk batches so they can be viewed/fixed
    for (var batch in _bulkHistory) {
      final batchStatus = (batch['status'] ?? '').toString();
      // We process ALL batches (including Resolved) to find approved rows
      dynamic dataJson = batch['data_json'];
      if (dataJson is String) {
        try {
          dataJson = jsonDecode(dataJson);
        } catch (e) {
          debugPrint('Error decoding data_json: $e');
        }
      }

      if (dataJson is List) {
        final List<dynamic> rows = dataJson;
        bool hasRejectedRow = false;

        // For resubmitted batches that are still pending manager approval,
        // only scan for rejections but never add rows to the expense grid.
        final bool isFreshResubmission =
            batchStatus == 'Submitted' &&
            (batch['batch_name'] ?? '').toString().startsWith('resubmitted_');

        for (int i = 0; i < rows.length; i++) {
          final row = rows[i];

          // Determine the effective status of this individual row
          // Priority: explicit _status > batch-level inference
          final String rawStatus = (() {
            final s = (row['_status'] ?? row['status'])?.toString();
            if (s != null && s.isNotEmpty) return s;
            // A Resolved batch means its non-rejected rows were approved
            if (batchStatus == 'Approved' || batchStatus == 'Resolved')
              return 'Approved';
            return 'Pending';
          })();

          final String lowRaw = rawStatus.toLowerCase().trim();
          final bool isValidated =
              lowRaw == 'validated' || lowRaw == 'ok' || lowRaw == 'approved';
          final isRowRejected =
              lowRaw == 'rejected' ||
              lowRaw == 'fix required' ||
              lowRaw.contains('rejected');

          final displayStatus = isRowRejected
              ? 'Rejected'
              : (isValidated ? 'Approved' : rawStatus);

          // Skip deduplication check and grid insertion for fresh resubmissions
          if (isFreshResubmission) {
            // Only track rejections to potentially show the banner
            if (isRowRejected) hasRejectedRow = true;
            continue;
          }

          final String bulkKey = '${batch['id']}_$i';
          if (existingBulkKeys.contains(bulkKey)) continue;

          final originKey = (row['origin_route'] ?? '')
              .toString()
              .trim()
              .toLowerCase();
          final destKey = (row['destination_route'] ?? '')
              .toString()
              .trim()
              .toLowerCase();
          final dateKey = (row['date'] ?? '').toString().trim();
          if (!isRowRejected &&
              fallbackKeys.contains('${originKey}_${destKey}_$dateKey'))
            continue;

          final syntheticRow = {
            'id': 'bulk_${batch['id']}_$i',
            'is_synthetic': true,
            'batch_id': batch['id'],
            'row_index': i,
            'date': row['date'] ?? 'N/A',
            'amount': row['amount'] ?? '0',
            'nature': 'Fuel',
            'status': displayStatus,
            'remarks': isRowRejected
                ? (row['_remarks'] ??
                      row['_remark'] ??
                      row['remarks'] ??
                      'Rejected by manager')
                : '',
            'details': {
              'origin': row['origin_route'],
              'destination': row['destination_route'],
              'start_time': row['start_time'],
              'reach_time': row['reach_time'],
              'odoStart': row['odo_start'],
              'mode': row['mode'],
              'purpose': row['visit_intent'],
              'batch_id': batch['id'],
              'row_index': i,
            },
          };

          if (isRowRejected) {
            if (batchStatus != 'Resolved') {
              hasRejectedRow = true;
              sortedExpenses.add(syntheticRow);
            }
          } else if (isValidated) {
            // Only show in the registry when fully approved
            sortedExpenses.add(syntheticRow);
          }
        }

        if (hasRejectedRow && batchStatus != 'Resolved') {
          batchActions.add(
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: GestureDetector(
                onTap: () async {
                  final refresh = await Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => BulkResolveRejectionsScreen(
                        tripId: widget.tripId,
                        batchId: (batch['id'] ?? '').toString(),
                        allRows: rows,
                      ),
                    ),
                  );
                  if (refresh == true) _fetchDetails();
                },
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: const Color(0xFFFECACA),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFEF4444).withOpacity(0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: const Icon(
                          Icons.error_outline_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Bulk Upload Rejections',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 15,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF991B1B),
                              ),
                            ),
                            Text(
                              'Action Required: Resubmit rejected rows',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFFEF4444).withOpacity(0.8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.all(8.0),
                        child: Icon(
                          Icons.arrow_forward_ios_rounded,
                          color: Color(0xFFEF4444),
                          size: 18,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }
      }
    }

    final List<dynamic> rejectedExpenses = sortedExpenses.where((e) {
      final status = (e['status'] ?? '').toString().toLowerCase().trim();
      return status == 'rejected' ||
          status == 'fix required' ||
          status.contains('rejected');
    }).toList();

    final List<dynamic> activeExpenses = sortedExpenses.where((e) {
      final status = (e['status'] ?? '').toString().toLowerCase().trim();
      return status != 'rejected' &&
          status != 'fix required' &&
          !status.contains('rejected');
    }).toList();

    activeExpenses.sort((a, b) {
      final statusA = (a['status'] ?? '').toString().toLowerCase().trim();
      final statusB = (b['status'] ?? '').toString().toLowerCase().trim();
      if (statusA == 'draft' && statusB != 'draft') return -1;
      if (statusA != 'draft' && statusB == 'draft') return 1;
      return 0;
    });

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (batchActions.isNotEmpty) ...batchActions,
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'DETAILED EXPENSE REGISTRY',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF64748B),
                letterSpacing: 1.2,
              ),
            ),
            _isOwner() &&
                    !_trip!.isBulkUpload &&
                    (_trip!.claim == null ||
                        ['draft', 'pending'].contains(
                          (_trip!.claim!['status'] ?? '')
                              .toString()
                              .toLowerCase(),
                        ))
                ? IconButton(
                    onPressed: () async {
                      final refresh = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => TripExpenseFormDetailedScreen(
                            category: _trip!.considerAsLocal
                                ? 'Local Travel'
                                : 'Food',
                            tripId: widget.tripId,
                          ),
                        ),
                      );
                      if (refresh == true) _fetchDetails();
                    },
                    icon: const Icon(
                      Icons.add_circle_rounded,
                      color: Color(0xFF0D9488),
                      size: 24,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                  )
                : const SizedBox.shrink(),
          ],
        ),
        const SizedBox(height: 16),

        if (activeExpenses.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(40),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFFF1F5F9)),
            ),
            child: Column(
              children: [
                Icon(
                  Icons.inventory_2_outlined,
                  size: 40,
                  color: Colors.grey.shade300,
                ),
                const SizedBox(height: 12),
                Text(
                  'No expense entries found',
                  style: GoogleFonts.plusJakartaSans(
                    color: Colors.grey.shade500,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          )
        else
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: activeExpenses.length,
            itemBuilder: (context, index) =>
                _buildExpenseCard(activeExpenses[index]),
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

  Widget _buildExpenseCard(dynamic expense) {
    var nature = expense['nature']?.toString() ?? 'Other';
    final amount = expense['amount']?.toString() ?? '0';
    final date = expense['date'] ?? 'N/A';
    final status = expense['status'] ?? 'Pending';
    final remarks = expense['remarks'];
    final bool isSubItem = expense['is_sub_item'] == true;

    var details = expense['details'] ?? {};
    if (details.isEmpty &&
        expense['description'] is String &&
        expense['description'].toString().startsWith('{')) {
      try {
        details = jsonDecode(expense['description']);
      } catch (e) {}
    }

    // Correcting nature mapping for detailed view matching
    String normalizedNature = nature;
    if (nature.toLowerCase() == 'fuel') normalizedNature = 'Local Travel';
    if (nature.toLowerCase() == 'others' ||
        nature.toLowerCase() == 'other' ||
        nature.toLowerCase() == 'miscellaneous')
      normalizedNature = 'Others';
    if (nature.toLowerCase() == 'incidental') normalizedNature = 'Incidental';

    // Smart override: if details contain any local conveyance/travel data,
    // always open Local Travel form regardless of stored nature
    final bool hasLocalCoveranceDataRaw =
        details['origin'] != null ||
        details['destination'] != null ||
        details['odoStart'] != null ||
        details['odo_start'] != null ||
        details['mode'] != null ||
        details['subType'] != null ||
        details['vehicle_type'] != null;

    final bool hasLocalConveyanceData = hasLocalCoveranceDataRaw && !isSubItem;

    if (hasLocalConveyanceData) normalizedNature = 'Local Travel';

    // Grid Column: Activity / Route Details (Bold Title + Subtext)
    String routeText = date;

    if (isSubItem) {
      routeText = 'Incidental: ${expense['sub_type']}';
      // Local conveyance — show mode + route
      String route =
          (details['origin'] != null && details['destination'] != null)
          ? '${details['origin']} → ${details['destination']}'
          : (remarks ?? 'Local movement');

      if (details['isPublicTransport'] == true ||
          details['mode']?.toString().toLowerCase() == 'public transport' ||
          details['mode']?.toString().toLowerCase() == 'others') {
        String sub = details['subType'] ?? details['vehicle_type'] ?? 'Others';
        route = "$route ($sub)";
        if (details['remainingRoute'] != null &&
            details['remainingRoute'].toString().isNotEmpty) {
          route = "$route\n${details['remainingRoute']}";
        }
      }
      routeText = route;
    } else if (!hasLocalConveyanceData &&
        (nature.toLowerCase().contains('other') ||
            nature.toLowerCase() == 'incidental')) {
      routeText = date;
    } else if (normalizedNature.toLowerCase() == 'travel') {
      String route =
          (details['origin'] != null && details['destination'] != null)
          ? '${details['origin']} → ${details['destination']}'
          : (remarks ?? 'Outstation Voyage');
      routeText = route;
    } else {
      routeText = date;
    }

    final String lowStatus = status.toString().toLowerCase().trim();
    final bool isRejected = lowStatus == 'rejected';
    final bool isApproved =
        lowStatus == 'approved' ||
        lowStatus == 'validated' ||
        lowStatus == 'ok';

    return Container(
      margin: EdgeInsets.fromLTRB(isSubItem ? 24 : 0, 0, 0, 12),
      decoration: BoxDecoration(
        color: isRejected
            ? const Color(0xFFFFF1F2)
            : (isSubItem ? const Color(0xFFF8FAFC) : Colors.white),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isRejected
              ? const Color(0xFFFECACA)
              : (isSubItem ? const Color(0xFFE2E8F0) : const Color(0xFFF1F5F9)),
          width: isSubItem ? 1.5 : 1,
        ),
        boxShadow: [
          if (!isSubItem)
            BoxShadow(color: Colors.black.withOpacity(0.01), blurRadius: 10),
        ],
      ),
      child: Column(
        children: [
          // If rejected, show why
          if (isRejected && (remarks != null || expense['hr_remarks'] != null))
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: const BoxDecoration(
                color: Color(0xFFEF4444),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(15),
                  topRight: Radius.circular(15),
                ),
              ),
              child: Text(
                'REJECTION REASON: ${remarks ?? expense['hr_remarks']}',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
            ),
          // THE REGISTRY GRID ROW (Matching Web)
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                // 1. CATEGORY ICON
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: isRejected
                        ? const Color(0xFFFFB2B2).withOpacity(0.2)
                        : (isSubItem
                              ? const Color(0xFFEEF2FF)
                              : const Color(0xFFF1F5F9)),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    isSubItem
                        ? Icons.toll_rounded
                        : (hasLocalConveyanceData
                              ? Icons.directions_car_filled_rounded
                              : _getNatureIcon(nature)),
                    size: 16,
                    color: isRejected
                        ? const Color(0xFFEF4444)
                        : (isSubItem
                              ? const Color(0xFF4F46E5)
                              : const Color(0xFF475569)),
                  ),
                ),
                const SizedBox(width: 12),

                // 2. ACTIVITY / ROUTE DETAILS (Expanded)
                Expanded(
                  flex: 4,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // ROUTE as the primary bold title
                      Text(
                        routeText,
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w900,
                          fontSize: 13,
                          color: isRejected
                              ? const Color(0xFF991B1B)
                              : const Color(0xFF0F172A),
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (hasLocalConveyanceData ||
                          normalizedNature.toLowerCase() == 'local travel')
                        Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                "${details['date'] ?? details['startDate'] ?? expense['date'] ?? 'N/A'}  •  ${details['startTime'] ?? details['start_time'] ?? '--:--'} - ${details['endTime'] ?? details['reach_time'] ?? details['end_time'] ?? '--:--'}",
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  color: isRejected
                                      ? const Color(0xFFEF4444).withOpacity(0.7)
                                      : const Color(0xFF64748B),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              if (!(details['isPublicTransport'] == true ||
                                      details['mode']
                                              ?.toString()
                                              .toLowerCase() ==
                                          'public transport') &&
                                  (details['odoStart'] != null ||
                                      details['odo_start'] != null))
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(
                                    "ODO: ${details['odoStart'] ?? details['odo_start'] ?? '0'} → ${details['odoEnd'] ?? details['odo_end'] ?? '0'}",
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 9,
                                      color: const Color(0xFF0D9488),
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      if (isRejected)
                        Text(
                          'FIX REQUIRED',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFFEF4444),
                            letterSpacing: 0.5,
                          ),
                        ),
                    ],
                  ),
                ),

                // 3. AMOUNT
                GestureDetector(
                  onTap: () async {
                    // Block editing when claim is submitted (unless the item is rejected)
                    final claimStatus = (_trip!.claim?['status'] ?? '')
                        .toString()
                        .toLowerCase();
                    final claimLocked =
                        _trip!.claim != null &&
                        claimStatus != 'draft' &&
                        claimStatus.isNotEmpty;

                    if (claimLocked && !isRejected) return; // read-only tap

                    if (expense['is_synthetic'] == true) {
                      if (isRejected) {
                        await _openSyntheticEdit(expense);
                      } else {
                        final refresh = await Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (context) => TripExpenseFormDetailedScreen(
                              category: normalizedNature,
                              tripId: widget.tripId,
                              expenseData: expense,
                            ),
                          ),
                        );
                        if (refresh == true) _fetchDetails();
                      }
                      return;
                    }
                    final refresh = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => TripExpenseFormDetailedScreen(
                          category: normalizedNature,
                          tripId: widget.tripId,
                          expenseData: expense,
                        ),
                      ),
                    );
                    if (refresh == true) _fetchDetails();
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
                          ? const Color(0xFFFEE2E2)
                          : const Color(0xFFF5F3FF),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: isApproved
                            ? const Color(0xFFBBF7D0)
                            : isRejected
                            ? const Color(0xFFFECACA)
                            : const Color(0xFFE0E7FF),
                      ),
                    ),
                    child: Text(
                      '₹$amount',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w900,
                        fontSize: 13,
                        color: isApproved
                            ? const Color(0xFF16A34A)
                            : isRejected
                            ? const Color(0xFFEF4444)
                            : const Color(0xFF4F46E5),
                        decoration:
                            (isApproved ||
                                isRejected ||
                                (_trip!.claim != null &&
                                    (_trip!.claim!['status'] ?? '')
                                            .toString()
                                            .toLowerCase() !=
                                        'draft'))
                            ? TextDecoration.none
                            : TextDecoration.underline,
                        decorationColor: const Color(0xFF4F46E5),
                      ),
                    ),
                  ),
                ),

                const SizedBox(width: 12),

                // Removed Status Pill per request
                const SizedBox(width: 4),
              ],
            ),
          ),

          // EDIT / ACTION STRIP
          // - Rejected expenses → Fix & Resubmit button
          // - Non-rejected synthetic rows (pending approval) → show badge, no button
          // - Normal non-approved → Edit button
          if (isRejected)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: _isActionLoading
                          ? null
                          : () async {
                              if (expense['is_synthetic'] == true) {
                                await _openSyntheticEdit(expense);
                                return;
                              }
                              // For real rejected expenses (claim-level rejection), open edit form
                              final refresh = await Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      TripExpenseFormDetailedScreen(
                                        category: normalizedNature,
                                        tripId: widget.tripId,
                                        expenseData: expense,
                                      ),
                                ),
                              );
                              if (refresh == true) _fetchDetails();
                            },
                      icon: const Icon(Icons.auto_fix_high_rounded, size: 14),
                      label: Text(
                        'Fix & Resubmit',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFFEF4444),
                        side: const BorderSide(color: Color(0xFFFFB2B2)),
                        backgroundColor: const Color(0xFFFFF1F2),
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
                        : () => _confirmDeleteExpense(context, expense),
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
            )
          else if (expense['is_synthetic'] == true &&
              !isRejected &&
              !isApproved)
            // Non-rejected bulk row still pending approval
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.hourglass_top_rounded,
                      size: 14,
                      color: Color(0xFF64748B),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Awaiting Manager Approval',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else if (!isApproved && !isRejected)
            Builder(
              builder: (context) {
                // Hide Edit/Delete when claim is submitted
                final claimStatus = (_trip!.claim?['status'] ?? '')
                    .toString()
                    .toLowerCase();
                final claimLocked =
                    _trip!.claim != null &&
                    claimStatus != 'draft' &&
                    claimStatus != 'pending' &&
                    claimStatus.isNotEmpty;
                if (claimLocked) return const SizedBox.shrink();
                return Padding(
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
                                            category: normalizedNature,
                                            tripId: widget.tripId,
                                            expenseData: expense,
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
                            : () => _confirmDeleteExpense(context, expense),
                        icon: const Icon(
                          Icons.delete_outline_rounded,
                          size: 14,
                        ),
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
                );
              },
            ),

          // EXPANDABLE DETAILS (For Audit / Internal Info)
          Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              dense: true,
              title: Text(
                'View Internal Details & Audit',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF64748B),
                ),
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Divider(height: 1),
                      const SizedBox(height: 12),
                      _buildDetailedNatureInfo(
                        normalizedNature,
                        details,
                        expense,
                      ),
                      const SizedBox(height: 12),
                      _buildAuditRemarkRow('RM', expense['rm_remarks']),
                      _buildAuditRemarkRow('HR', expense['hr_remarks']),
                      _buildAuditRemarkRow(
                        'FINANCE',
                        expense['finance_remarks'],
                      ),
                      if (expense['receipt_url'] != null ||
                          expense['receipt_image'] != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: _buildReceiptButton(
                            expense['receipt_url'] ?? expense['receipt_image'],
                          ),
                        ),
                      if (_isApprover()) ...[
                        const SizedBox(height: 16),
                        _buildAuditInputSection(expense),
                      ],
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

  Future<void> _openSyntheticEdit(dynamic expense) async {
    try {
      final batchId = expense['batch_id'].toString();

      // Find the actual batch from _bulkHistory to get all rows (Rejected & Approved)
      dynamic batch;
      for (var b in _bulkHistory) {
        if (b['id'].toString() == batchId) {
          batch = b;
          break;
        }
      }

      if (batch == null || batch['data_json'] == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: Batch data not found for ID: $batchId'),
          ),
        );
        return;
      }

      dynamic allRows = batch['data_json'];
      if (allRows is String) {
        try {
          allRows = jsonDecode(allRows);
        } catch (e) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error decoding batch records: $e')),
          );
          return;
        }
      }

      if (allRows is! List) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Error: Invalid bulk data format (not a list).'),
          ),
        );
        return;
      }

      final refresh = await Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => BulkResolveRejectionsScreen(
            tripId: widget.tripId,
            batchId: batchId,
            allRows: allRows,
          ),
        ),
      );
      if (refresh == true) _fetchDetails();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to open resubmission screen: $e')),
      );
    }
  }

  IconData _getNatureIcon(String nature) {
    switch (nature.toLowerCase()) {
      case 'fuel':
      case 'local travel':
        return Icons.directions_car_filled_rounded;
      case 'travel':
      case 'others':
        return Icons.commute_rounded;
      case 'food':
        return Icons.restaurant_rounded;
      case 'accommodation':
        return Icons.hotel_rounded;
      default:
        return Icons.receipt_long_rounded;
    }
  }

  Widget _buildGridStatusPill(dynamic status) {
    final s = status.toString().toLowerCase();
    Color c = const Color(0xFF64748B);
    if (s == 'approved') c = const Color(0xFF10B981);
    if (s == 'rejected') c = const Color(0xFFEF4444);
    if (s == 'pending') c = const Color(0xFFF59E0B);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: c.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: c.withOpacity(0.2)),
      ),
      child: Text(
        status.toString().toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 8,
          fontWeight: FontWeight.w900,
          color: c,
        ),
      ),
    );
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

  Widget _buildBulkHistorySection() {
    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _bulkHistory.length,
      itemBuilder: (context, index) {
        final batch = _bulkHistory[index];
        final String fileName = batch['file_name'] ?? 'Bulk Upload';
        final String date = batch['created_at']?.toString().split('T')[0] ?? '';
        final String status = batch['status'] ?? 'Pending';
        final String? remarks = batch['remarks'];
        final List<dynamic> dataJson = batch['data_json'] ?? [];
        final int totalEntries = dataJson.length;
        final int rejectedCount = dataJson
            .where((r) => r['_status'] == 'Rejected')
            .length;

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
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.table_chart_rounded,
                        size: 20,
                        color: Color(0xFF4F46E5),
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
                              Expanded(
                                child: Text(
                                  fileName,
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF1E293B),
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              _buildGridStatusPill(status),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '$date • $totalEntries items recorded',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (rejectedCount > 0 &&
                        batch['status'] != 'Resolved' &&
                        batch['status'] != 'Manager Approved' &&
                        batch['status'] != 'Approved')
                      Padding(
                        padding: const EdgeInsets.only(right: 12),
                        child: TextButton.icon(
                          onPressed: () =>
                              _openSyntheticEdit({'batch_id': batch['id']}),
                          icon: const Icon(
                            Icons.refresh_rounded,
                            size: 16,
                            color: Color(0xFFE11D48),
                          ),
                          label: Text(
                            'RESOLVE',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFFE11D48),
                              letterSpacing: 0.5,
                            ),
                          ),
                          style: TextButton.styleFrom(
                            backgroundColor: const Color(0xFFFFF1F2),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(8),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              if (rejectedCount > 0)
                Container(
                  width: double.infinity,
                  margin: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 4,
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
                        Icons.error_outline_rounded,
                        size: 14,
                        color: Color(0xFFEF4444),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '$rejectedCount items were rejected from this batch.',
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
              if (remarks != null && remarks.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          size: 14,
                          color: Color(0xFF64748B),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            remarks,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              color: const Color(0xFF475569),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  Widget _buildQuickApprovalActions() {
    final double totalClaimed = _expenses.fold(
      0.0,
      (s, e) => s + (double.tryParse(e['amount']?.toString() ?? '0') ?? 0),
    );
    final double approvedNet = _expenses
        .where((e) => e['status'] != 'Rejected')
        .fold(
          0.0,
          (s, e) => s + (double.tryParse(e['amount']?.toString() ?? '0') ?? 0),
        );
    final double rejectedTotal = _expenses
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
                      backgroundColor: const Color(0xFF0F172A),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 4,
                      shadowColor: const Color(0xFF0F172A).withOpacity(0.3),
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

  Widget _buildAuditInputSection(dynamic expense) {
    return Column(
      children: [
        TextField(
          onChanged: (val) => _auditRemarks[expense['id'].toString()] = val,
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
                onPressed: () => _handleItemAction(expense['id'], 'Rejected'),
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
              'Date',
              '${details['date'] ?? details['startDate'] ?? expense['date'] ?? 'N/A'}',
            ),
            _buildDetailRow(
              'Timing',
              '${details['startTime'] ?? details['start_time'] ?? '--:--'} - ${details['endTime'] ?? details['reach_time'] ?? details['end_time'] ?? '--:--'}',
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

  Widget _buildBulkRejectionsButton(List<dynamic> rejected) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFEE2E2)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: () => _openBulkResolutions(rejected),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEF4444),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.error_outline_rounded,
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
                        'BULK UPLOAD REJECTIONS',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF991B1B),
                          letterSpacing: 0.5,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${rejected.length} items were rejected. Fix and resubmit them at once.',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFFB91C1C).withOpacity(0.7),
                        ),
                      ),
                    ],
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: Color(0xFFEF4444),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _openBulkResolutions(List<dynamic> rejected) async {
    String? batchId;
    for (var exp in rejected) {
      if (exp['batch_id'] != null) {
        batchId = exp['batch_id']?.toString();
        break;
      }
    }

    if (batchId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No batch information found for rejections.'),
        ),
      );
      return;
    }

    // Find the actual batch from _bulkHistory to get all rows (Rejected & Approved)
    dynamic batch;
    for (var b in _bulkHistory) {
      if (b['id'].toString() == batchId) {
        batch = b;
        break;
      }
    }

    if (batch == null || batch['data_json'] == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error: Batch data not found for ID: $batchId'),
        ),
      );
      return;
    }

    dynamic allRows = batch['data_json'];
    if (allRows is String) {
      try {
        allRows = jsonDecode(allRows);
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error decoding batch records: $e')),
        );
        return;
      }
    }

    if (allRows is! List) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Error: Invalid bulk data format (not a list).'),
        ),
      );
      return;
    }

    final refresh = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BulkResolveRejectionsScreen(
          tripId: widget.tripId,
          batchId: batchId!,
          allRows: allRows,
        ),
      ),
    );
    if (refresh == true) _fetchDetails();
  }
}
