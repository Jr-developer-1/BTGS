import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/trip_service.dart';
import 'trip_expense_form_detailed.dart';

class TripExpenseGridScreen extends StatefulWidget {
  final String tripId;
  final bool hasAdditionalLuggage;
  const TripExpenseGridScreen({
    super.key,
    required this.tripId,
    this.hasAdditionalLuggage = false,
  });

  @override
  _TripExpenseGridScreenState createState() => _TripExpenseGridScreenState();
}

class _TripExpenseGridScreenState extends State<TripExpenseGridScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  List<dynamic> _expenses = [];
  String? _claimStatus;

  // A claim has been submitted when claimStatus is set (not null/empty)
  bool get _isLocked {
    final s = (_claimStatus ?? '').toLowerCase().trim();
    return s.isNotEmpty;
  }

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  bool _hasChanged = false;

  Future<void> _fetchExpenses({
    bool showLoader = true,
    bool isUpdate = false,
  }) async {
    if (!mounted) return;
    if (isUpdate) _hasChanged = true;
    if (showLoader) setState(() => _isLoading = true);
    try {
      final trip = await _tripService.fetchTripDetails(widget.tripId);
      final manualExpenses = await _tripService.fetchExpenses(
        tripId: widget.tripId,
      );

      if (!mounted) return;
      setState(() {
        _expenses = manualExpenses.isNotEmpty
            ? manualExpenses
            : (trip.expenses ?? []);
        _claimStatus = trip.claimStatus;
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        Navigator.pop(context, _hasChanged);
        return false;
      },
      child: Scaffold(
        backgroundColor: const Color(0xFFF0FDFA),
        appBar: AppBar(
          title: Text(
            'Trip Expense Grid',
            style: GoogleFonts.plusJakartaSans(
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          backgroundColor: Colors.white,
          foregroundColor: Colors.black,
          elevation: 0,
          centerTitle: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: () => Navigator.pop(context, _hasChanged),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh_rounded, size: 20),
              onPressed: () => _fetchExpenses(showLoader: false),
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
            : RefreshIndicator(
                onRefresh: () => _fetchExpenses(showLoader: false),
                child: SingleChildScrollView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 20,
                  ),
                  child: Column(
                    children: [
                      if (_isLocked) _buildLockedBanner(),
                      _buildCategorySection(
                        'OUTSTATION TRAVEL',
                        'Travel',
                        const Color(0xFF0D9488),
                        Icons.flight_takeoff_rounded,
                      ),
                      _buildCategorySection(
                        'LOCAL CONVEYANCE',
                        'Local Travel',
                        const Color(0xFF0891B2),
                        Icons.directions_car_filled_rounded,
                      ),
                      _buildCategorySection(
                        'FOOD & REFRESHMENTS',
                        'Food',
                        const Color(0xFF0EA5E9),
                        Icons.restaurant_rounded,
                      ),
                      _buildCategorySection(
                        'ACCOMMODATION',
                        'Accommodation',
                        const Color(0xFF0284C7),
                        Icons.hotel_rounded,
                      ),
                      _buildCategorySection(
                        'INCIDENTAL / OTHERS',
                        'Incidental',
                        const Color(0xFF0369A1),
                        Icons.receipt_long_rounded,
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
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
    if (details['travelStatus'] == null && exp['cancellation_status'] != null) {
      details['travelStatus'] = exp['cancellation_status'];
    }
    if (details['cancellationDate'] == null &&
        exp['cancellation_date'] != null) {
      details['cancellationDate'] = exp['cancellation_date'];
    }
    if (details['refundAmount'] == null && exp['refund_amount'] != null) {
      details['refundAmount'] = exp['refund_amount'].toString();
    }
    if (details['cancellationReason'] == null &&
        exp['cancellation_reason'] != null) {
      details['cancellationReason'] = exp['cancellation_reason'];
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

  Widget _buildCategorySection(
    String title,
    String category,
    Color color,
    IconData icon,
  ) {
    final filteredExpenses = _expenses.where((e) {
      String nature =
          (e['nature'] ?? e['category'])?.toString().toLowerCase() ?? '';

      // Look into description to see if it's actually Travel data stored as Others
      Map<String, dynamic> details = _parseDescription(e);

      bool isOthers =
          nature == 'others' || nature == 'other' || nature == 'miscellaneous';
      bool hasTravelData =
          details['origin'] != null &&
          details['destination'] != null &&
          details['mode'] != null;

      if (category == 'Travel') {
        return nature == 'travel' ||
            nature == 'outstation' ||
            nature == 'outstation travel' ||
            (isOthers && hasTravelData);
      }

      if (category == 'Local Travel') {
        bool isFuel = nature == 'fuel' || nature == 'local travel';
        return isFuel;
      }

      if (category == 'Incidental') {
        // Only include in Incidental if it's NOT Travel data
        return (nature == 'others' ||
                nature == 'incidental' ||
                nature == 'miscellaneous') &&
            !hasTravelData;
      }

      return nature == category.toLowerCase();
    }).toList();

    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0).withOpacity(0.5)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 15,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: color.withOpacity(0.05),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(icon, color: color, size: 18),
                    const SizedBox(width: 12),
                    Text(
                      title,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: color,
                        letterSpacing: 0.8,
                      ),
                    ),
                  ],
                ),
                if (!_isLocked)
                  Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _openAddForm(category),
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 6,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.add_circle_outline_rounded,
                              size: 14,
                              color: color,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'ADD',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w800,
                                fontSize: 10,
                                color: color,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  )
                else
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.lock_outline_rounded,
                          size: 12,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'LOCKED',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                            color: const Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (filteredExpenses.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Text(
                  'No entries found for $category',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    color: const Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            )
          else
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filteredExpenses.length,
              itemBuilder: (context, index) {
                final exp = filteredExpenses[index];
                return _buildExpenseRow(
                  category,
                  exp,
                  color,
                  index == filteredExpenses.length - 1,
                );
              },
            ),
        ],
      ),
    );
  }

  Widget _buildExpenseRow(
    String category,
    dynamic exp,
    Color themeColor,
    bool isLast,
  ) {
    Map<String, dynamic> desc = _parseDescription(exp);

    final amountStr = exp['amount']?.toString() ?? '0';
    final amount =
        double.tryParse(amountStr.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
    final date =
        DateTime.tryParse(
          exp['date']?.toString() ?? DateTime.now().toString(),
        ) ??
        DateTime.now();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _isLocked ? null : () => _openEditForm(category, exp),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: isLast
                ? null
                : Border(bottom: BorderSide(color: const Color(0xFFF1F5F9))),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: themeColor.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _getIconForExp(category, desc),
                  size: 16,
                  color: themeColor,
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
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Text(
                          DateFormat('dd MMM yyyy').format(date),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            color: const Color(0xFF94A3B8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        if (desc['subType'] != null) ...[
                          Text(
                            ' • ',
                            style: TextStyle(
                              color: Colors.grey.withOpacity(0.3),
                              fontSize: 10,
                            ),
                          ),
                          Text(
                            desc['subType'].toString().toUpperCase(),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 9,
                              color: themeColor,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (desc['is_deviated'] == true) ...[
                      const SizedBox(height: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFEF2F2),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: const Color(0xFFFECACA)),
                        ),
                        child: Text(
                          'FLAGGED DEVIATION',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 8,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFFDC2626),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '₹${amount.toStringAsFixed(0)}',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w900,
                      fontSize: 14,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  if (_isLocked)
                    const Icon(
                      Icons.lock_outline_rounded,
                      size: 14,
                      color: Color(0xFFD97706),
                    )
                  else
                    const Icon(
                      Icons.chevron_right_rounded,
                      size: 16,
                      color: Color(0xFFCBD5E1),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getIconForExp(String category, Map<String, dynamic> desc) {
    if (category == 'Food') return Icons.lunch_dining_rounded;
    if (category == 'Accommodation') return Icons.meeting_room_rounded;
    if (category == 'Incidental') return Icons.more_horiz_rounded;

    final mode = desc['mode']?.toString().toLowerCase() ?? '';
    if (mode.contains('flight')) return Icons.flight_rounded;
    if (mode.contains('train')) return Icons.train_rounded;
    if (mode.contains('car') || mode.contains('cab'))
      return Icons.directions_car_rounded;
    if (mode.contains('bike')) return Icons.directions_bike_rounded;

    return Icons.receipt_long_rounded;
  }

  String _getExpenseMainDisplay(dynamic exp) {
    try {
      Map<String, dynamic> desc = _parseDescription(exp);

      final category = (exp['category'] ?? exp['nature'] ?? '')
          .toString()
          .toLowerCase();
      final remarks = exp['remarks']?.toString() ?? '';

      // 1. Local Travel / Fuel
      if (category == 'fuel' || category == 'local travel') {
        final origin = desc['origin']?.toString() ?? '';
        final dest = desc['destination']?.toString() ?? '';
        if (origin.isNotEmpty || dest.isNotEmpty) {
          return '${origin.isNotEmpty ? origin : 'Start'} → ${dest.isNotEmpty ? dest : 'End'}';
        }
        return remarks.isNotEmpty ? remarks : 'Local Movement';
      }

      // 2. Outstation Travel
      if (desc['origin'] != null && desc['destination'] != null) {
        final origin = desc['origin']?.toString() ?? '';
        final dest = desc['destination']?.toString() ?? '';
        if (origin.isNotEmpty || dest.isNotEmpty) {
          if (desc['is_deviated'] == true && desc['deviation_target'] != null) {
            return '${origin} → ${desc['deviation_target']}';
          }
          return '${origin.isNotEmpty ? origin : 'Start'} → ${dest.isNotEmpty ? dest : 'End'}';
        }
      }

      // 3. Hotel / Restaurant specific fallbacks
      if (desc['hotelName'] != null &&
          desc['hotelName'].toString().trim().isNotEmpty) {
        return desc['hotelName'].toString();
      }
      if (desc['restaurant'] != null &&
          desc['restaurant'].toString().trim().isNotEmpty) {
        return desc['restaurant'].toString();
      }

      // 4. Default fallbacks
      if (remarks.trim().isNotEmpty) return remarks.trim();

      final String catName =
          exp['category']?.toString() ?? exp['nature']?.toString() ?? '';
      if (catName.trim().isNotEmpty) return catName.trim();

      return 'Trip Expense';
    } catch (e) {
      return 'Trip Expense';
    }
  }

  void _openAddForm(String category) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => TripExpenseFormDetailedScreen(
          category: category,
          tripId: widget.tripId,
          hasAdditionalLuggage: widget.hasAdditionalLuggage,
        ),
      ),
    );
    if (result == true) _fetchExpenses(isUpdate: true);
  }

  void _openEditForm(String category, dynamic exp) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => TripExpenseFormDetailedScreen(
          category: category,
          tripId: widget.tripId,
          expenseData: exp,
          hasAdditionalLuggage: widget.hasAdditionalLuggage,
        ),
      ),
    );
    if (result == true) _fetchExpenses(isUpdate: true);
  }
}
