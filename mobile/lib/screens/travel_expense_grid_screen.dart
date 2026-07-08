import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/trip_service.dart';
import 'trip_expense_form_detailed.dart';
import 'bulk_resolve_rejections_screen.dart';

class TravelExpenseGridScreen extends StatefulWidget {
  final String tripId;
  const TravelExpenseGridScreen({super.key, required this.tripId});

  @override
  _TravelExpenseGridScreenState createState() =>
      _TravelExpenseGridScreenState();
}

class _TravelExpenseGridScreenState extends State<TravelExpenseGridScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  List<dynamic> _expenses = [];

  Map<String, dynamic> _parseDescription(dynamic exp) {
    Map<String, dynamic> details = {};
    try {
      final descRaw = exp['description'];
      if (descRaw is String && descRaw.startsWith('{')) {
        details = Map<String, dynamic>.from(jsonDecode(descRaw));
      } else if (descRaw is Map) {
        details = Map<String, dynamic>.from(descRaw);
      }
    } catch (_) {}

    // Restore stripped fields from top-level database columns
    if (details['mode'] == null && exp['travel_mode'] != null) {
      details['mode'] = exp['travel_mode'];
    }
    if (details['class'] == null && exp['class_type'] != null) {
      details['class'] = exp['class_type'];
    }
    if (details['classType'] == null && exp['class_type'] != null) {
      details['classType'] = exp['class_type'];
    }
    if (details['pnr'] == null && exp['booking_reference'] != null) {
      details['pnr'] = exp['booking_reference'];
    }
    if (details['bookingRef'] == null && exp['booking_reference'] != null) {
      details['bookingRef'] = exp['booking_reference'];
    }
    if (details['subType'] == null && exp['vehicle_type'] != null) {
      details['subType'] = exp['vehicle_type'];
    }
    if (details['vehicleType'] == null && exp['vehicle_type'] != null) {
      details['vehicleType'] = exp['vehicle_type'];
    }
    if (details['bookedBy'] == null && exp['booked_by'] != null) {
      details['bookedBy'] = exp['booked_by'];
    }
    if (details['odoStart'] == null && exp['odo_start'] != null) {
      details['odoStart'] = exp['odo_start'].toString();
    }
    if (details['odoEnd'] == null && exp['odo_end'] != null) {
      details['odoEnd'] = exp['odo_end'].toString();
    }
    if (details['totalKm'] == null && exp['distance'] != null) {
      details['totalKm'] = exp['distance'].toString();
    }
    return details;
  }

  List<dynamic> _rejectedExpenses = [];
  final Map<int, bool> _isSavingReport = {};
  String? _claimStatus;

  // Locked when a claim has been submitted (status present)
  bool get _isLocked {
    final s = (_claimStatus ?? '').toLowerCase().trim();
    return s.isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  Future<void> _fetchExpenses() async {
    setState(() => _isLoading = true);
    try {
      final trip = await _tripService.fetchTripDetails(widget.tripId);
      final all = trip.expenses ?? [];

      setState(() {
        _claimStatus = trip.claimStatus;
        _rejectedExpenses = all.where((e) {
          final s = (e['status'] ?? '').toString().toLowerCase().trim();
          return s == 'rejected' ||
              s == 'fix required' ||
              s.contains('rejected');
        }).toList();
        _expenses = all.where((e) {
          final s = (e['status'] ?? '').toString().toLowerCase().trim();
          return s != 'rejected' &&
              s != 'fix required' &&
              !s.contains('rejected');
        }).toList();

        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      appBar: AppBar(
        title: Text(
          'Journey Log',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w900,
            fontSize: 18,
            color: const Color(0xFF134E4A),
            letterSpacing: -0.5,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF134E4A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(0xFFCCFBF1)),
        ),
        actions: [
          IconButton(
            icon: const Icon(
              Icons.refresh_rounded,
              size: 22,
              color: Color(0xFF0D9488),
            ),
            onPressed: _fetchExpenses,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(
                color: Color(0xFF0D9488),
                strokeWidth: 2,
              ),
            )
          : SingleChildScrollView(
              child: Column(
                children: [
                  _buildStatsSection(),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 24,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_isLocked) _buildLockedBanner(),
                        Text(
                          'EXPENSE CATEGORIES',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF94A3B8),
                            letterSpacing: 1.5,
                          ),
                        ),
                        const SizedBox(height: 16),
                        _buildCategoryCard(
                          'LOCAL CONVEYANCE',
                          'Local Travel',
                          const Color(0xFF0D9488),
                          Icons.directions_car_filled_rounded,
                        ),
                        const SizedBox(height: 20),
                        _buildCategoryCard(
                          'INCIDENTAL EXPENSES',
                          'Incidental',
                          const Color(0xFF0F766E),
                          Icons.receipt_long_rounded,
                        ),
                        const SizedBox(height: 30),
                        if (_rejectedExpenses.isNotEmpty) ...[
                          _buildBulkRejectionsButton(),
                          const SizedBox(height: 60),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildLockedBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFED7AA)),
      ),
      child: Row(
        children: [
          const Icon(Icons.lock_rounded, size: 16, color: Color(0xFFD97706)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Claim submitted (${_claimStatus ?? ''}) — expenses are locked for editing.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF92400E),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBulkRejectionsButton() {
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
          onTap: _openBulkResolutions,
          child: Padding(
            padding: const EdgeInsets.all(20),
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
                        '${_rejectedExpenses.length} items need correction and resubmission',
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

  void _openBulkResolutions() async {
    // Find a batch ID to use. If multiple batches, we might need a more complex selection,
    // but typically rejections are handled per batch.
    String? batchId;
    for (var exp in _rejectedExpenses) {
      if (exp['batch_id'] != null) {
        batchId = exp['batch_id'].toString();
        break;
      }
    }

    if (batchId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No batch information found for rejected items.'),
        ),
      );
      return;
    }

    // When opening bulk resolution, we pass all rows belonging to that batch if possible,
    // but here we just pass the rejected items if we don't have the full batch info.
    // However, the BulkResolveRejectionsScreen expects allRows to split them.

    // For now, let's navigate to a screen that handles these specific rejected items.
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => BulkResolveRejectionsScreen(
          tripId: widget.tripId,
          batchId: batchId!,
          allRows:
              _rejectedExpenses, // Just pass the rejected ones if that's all we want to show
        ),
      ),
    );

    if (result == true) _fetchExpenses();
  }

  Widget _buildStatsSection() {
    double totalKm = 0;
    double totalExp = 0;

    for (var e in _expenses) {
      final cat = e['category']?.toString().toLowerCase();
      if (cat == 'fuel' || cat == 'local travel') {
        final desc = _parseDescription(e);
        final start = double.tryParse(desc['odoStart']?.toString() ?? '0') ?? 0;
        final end = double.tryParse(desc['odoEnd']?.toString() ?? '0') ?? 0;
        totalKm += (end - start).clamp(0, 99999);
      }
      totalExp += double.tryParse(e['amount']?.toString() ?? '0') ?? 0;
    }

    return Container(
      width: double.infinity,
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF134E4A), Color(0xFF0D9488)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF134E4A).withOpacity(0.2),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceAround,
          children: [
            _buildStatItem(
              'TOTAL DISTANCE',
              '${totalKm.toStringAsFixed(1)} KM',
              Icons.add_road_rounded,
            ),
            Container(
              width: 1,
              height: 40,
              color: Colors.white.withOpacity(0.15),
            ),
            _buildStatItem(
              'TOTAL COST',
              '₹${totalExp.toStringAsFixed(0)}',
              Icons.account_balance_wallet_rounded,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Colors.white.withOpacity(0.5), size: 16),
        const SizedBox(height: 8),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white.withOpacity(0.5),
            fontSize: 8,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }

  Widget _buildCategoryCard(
    String title,
    String category,
    Color color,
    IconData icon,
  ) {
    final categoryExpenses = _expenses.where((e) {
      final cat = e['category']?.toString().toLowerCase();
      if (category == 'Local Travel')
        return cat == 'fuel' || cat == 'local travel';
      if (category == 'Incidental') {
        final desc = _parseDescription(e);
        final bool hasTravelData =
            desc['origin'] != null &&
            desc['destination'] != null &&
            desc['mode'] != null;
        return (cat == 'others' ||
                cat == 'incidental' ||
                cat == 'miscellaneous') &&
            !hasTravelData;
      }
      return cat == category.toLowerCase();
    }).toList();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.04),
            blurRadius: 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 18),
              ),
              const SizedBox(width: 12),
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF134E4A),
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (categoryExpenses.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 28),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFCCFBF1)),
              ),
              child: Center(
                child: Text(
                  'No journeys logged for this category',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF0D9488),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            )
          else
            ...categoryExpenses.map((exp) => _buildExpenseTile(category, exp)),
        ],
      ),
    );
  }

  Widget _buildExpenseTile(String category, dynamic exp) {
    final desc = _parseDescription(exp);
    final bool isDA = desc['nature'] == 'Daily Allowance';
    final String actualCategory = isDA ? 'Daily Allowance' : category;
    final subType = desc['subType']?.toString() ?? 'N/A';
    final mode = desc['mode']?.toString() ?? (desc['isPublicTransport'] == true ? 'PUBLIC TRANSPORT' : 'Local');
    final odoStart = desc['odoStart']?.toString() ?? '';
    final odoEnd = desc['odoEnd']?.toString() ?? '';
    final odoRate = desc['odoRate']?.toString() ?? '0.0';
    final jobReport = desc['jobReport']?.toString() ?? '';
    final expenseId = exp['id'];
    final isSaving = _isSavingReport[expenseId] == true;

    double dist = 0;
    if (odoStart.isNotEmpty && odoEnd.isNotEmpty) {
      dist = ((double.tryParse(odoEnd) ?? 0) - (double.tryParse(odoStart) ?? 0))
          .clamp(0, 99999);
    }
    final odoExpense = dist * (double.tryParse(odoRate) ?? 0.0);

    bool hasReport = jobReport.isNotEmpty;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FFFE),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFCCFBF1)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.03),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // ── Expense info row (tap to edit) ──
          Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(20),
              ),
              onTap: _isLocked ? null : () => _openEditForm(actualCategory, exp),
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                child: Row(
                  children: [
                    Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        color: const Color(0xFFF8FAFC),
                        shape: BoxShape.circle,
                        border: Border.all(color: const Color(0xFFF1F5F9)),
                      ),
                      child: Center(
                        child: Icon(
                          isDA
                              ? Icons.assignment_turned_in_rounded
                              : subType.contains('Car')
                                  ? Icons.directions_car_rounded
                                  : subType.contains('Bike')
                                      ? Icons.directions_bike_rounded
                                      : Icons.directions_bus_rounded,
                          size: 20,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _getExpenseMainDisplay(exp),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF134E4A),
                            ),
                          ),
                          if (category == 'Local Travel') ...[
                            const SizedBox(height: 3),
                            Wrap(
                              children: [
                                Text(
                                  '${mode.toUpperCase()} - ${subType.toUpperCase()}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF0D9488),
                                  ),
                                ),
                                if (odoStart.isNotEmpty) ...[
                                  Text(
                                    '  •  ',
                                    style: TextStyle(
                                      color: Colors.grey.shade400,
                                      fontSize: 9,
                                    ),
                                  ),
                                  Text(
                                    '₹$odoRate/km',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 9,
                                      color: const Color(0xFF0F766E),
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                  Text(
                                    '  •  ',
                                    style: TextStyle(
                                      color: Colors.grey.shade400,
                                      fontSize: 9,
                                    ),
                                  ),
                                  Text(
                                    '${dist.toStringAsFixed(1)} KM',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 9,
                                      color: const Color(0xFF64748B),
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            if (desc['otherReason'] != null &&
                                desc['otherReason']
                                    .toString()
                                    .trim()
                                    .isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                'Reason: ${desc['otherReason']}',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.orange.shade800,
                                ),
                              ),
                            ],
                          ],
                          const SizedBox(height: 2),
                          Text(
                            DateFormat(
                              'dd MMM yyyy',
                            ).format(DateTime.parse(exp['date'])),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '₹${exp['amount']}',
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w900,
                        fontSize: 18,
                        color: const Color(0xFF134E4A),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // ── Job Report bar (mirrors web "Calc. Odo Expense" + job report button) ──
          Container(
            margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                // ODO calc (mirrors web "Calc. Odo Expense: ₹X")
                Expanded(
                  child: RichText(
                    text: TextSpan(
                      children: [
                        TextSpan(
                          text: isDA ? 'Daily Allowance: ' : 'Calc. Odo Expense: ',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF475569),
                          ),
                        ),
                        TextSpan(
                          text: isDA ? '₹${exp['amount']}' : '₹${odoExpense.toStringAsFixed(2)}',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF0D9488),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // "Job Report Saved" green badge
                if (hasReport) ...[
                  Container(
                    margin: const EdgeInsets.only(right: 8),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFDCFCE7),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.description_rounded,
                          size: 11,
                          color: Color(0xFF16A34A),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'Saved',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 9,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF15803D),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // Write / Edit Job Report button — hidden when locked
                if (!_isLocked)
                  isSaving
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () => _openJobReportSheet(exp),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 6,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF0FDFA),
                              border: Border.all(
                                color: const Color(0xFFCCFBF1),
                              ),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  hasReport
                                      ? Icons.edit_note_rounded
                                      : Icons.article_outlined,
                                  size: 13,
                                  color: const Color(0xFF0D9488),
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  hasReport
                                      ? 'Edit Report'
                                      : 'Write Job Report',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF0D9488),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                else
                  const Icon(
                    Icons.lock_outline_rounded,
                    size: 14,
                    color: Color(0xFFD97706),
                  ),
              ],
            ),
          ),

          // ── Report snippet preview ──
          if (hasReport)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
              child: Text(
                jobReport,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  color: const Color(0xFF64748B),
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _getExpenseMainDisplay(dynamic exp) {
    try {
      final cat = exp['category']?.toString().toLowerCase();
      final desc = _parseDescription(exp);

      if (desc['nature'] == 'Daily Allowance') {
        return 'Daily Allowance';
      }
      if (cat == 'fuel' || cat == 'local travel') {
        String origin = desc['origin'] ?? 'Start';
        String dest = desc['destination'] ?? 'End';
        return '$origin → $dest';
      }
      return exp['remarks'] ?? exp['category'] ?? 'Expense';
    } catch (e) {
      return exp['remarks'] ?? 'Expense';
    }
  }

  void _openJobReportSheet(Map<String, dynamic> exp) {
    final desc = _parseDescription(exp);
    final controller = TextEditingController(text: desc['jobReport'] ?? '');
    final expenseId = exp['id'];

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
        ),
        padding: EdgeInsets.fromLTRB(
          24,
          24,
          24,
          MediaQuery.of(context).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'JOURNEY JOB REPORT',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: const Icon(Icons.close_rounded),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              maxLines: 5,
              decoration: InputDecoration(
                hintText:
                    'Enter specific work details performed during this journey...',
                hintStyle: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: const Color(0xFF94A3B8),
                ),
                filled: true,
                fillColor: const Color(0xFFF0FDFA),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: Color(0xFFCCFBF1)),
                ),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 54,
              child: ElevatedButton(
                onPressed: () async {
                  Navigator.pop(context);
                  setState(() => _isSavingReport[expenseId] = true);

                  try {
                    desc['jobReport'] = controller.text;
                    await _tripService.updateExpense(expenseId.toString(), {
                      'description': jsonEncode(desc),
                      'remarks': controller.text,
                    });
                    _fetchExpenses();
                  } catch (e) {
                    ScaffoldMessenger.of(
                      context,
                    ).showSnackBar(SnackBar(content: Text('Error: $e')));
                  } finally {
                    setState(() => _isSavingReport[expenseId] = false);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF134E4A),
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                ),
                child: Text(
                  'SAVE REPORT',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openEditForm(String category, dynamic exp) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => TripExpenseFormDetailedScreen(
          category: category,
          tripId: widget.tripId,
          expenseData: exp,
        ),
      ),
    );
    if (result == true) _fetchExpenses();
  }
}
