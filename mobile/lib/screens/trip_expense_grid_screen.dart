import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/trip_service.dart';
import 'trip_expense_form_detailed.dart';

class TripExpenseGridScreen extends StatefulWidget {
  final String tripId;
  const TripExpenseGridScreen({super.key, required this.tripId});

  @override
  _TripExpenseGridScreenState createState() => _TripExpenseGridScreenState();
}

class _TripExpenseGridScreenState extends State<TripExpenseGridScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  List<dynamic> _expenses = [];

  @override
  void initState() {
    super.initState();
    _fetchExpenses();
  }

  Future<void> _fetchExpenses() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    try {
      final trip = await _tripService.fetchTripDetails(widget.tripId);
      if (!mounted) return;
      setState(() {
        _expenses = trip.expenses ?? [];
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Trip Expense Grid', 
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 16)),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, size: 20),
            onPressed: _fetchExpenses,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
        : RefreshIndicator(
            onRefresh: _fetchExpenses,
            child: SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
              child: Column(
                children: [
                  _buildCategorySection('OUTSTATION TRAVEL', 'Travel', const Color(0xFF6366F1), Icons.flight_takeoff_rounded),
                  _buildCategorySection('LOCAL CONVEYANCE', 'Local Travel', const Color(0xFF4F46E5), Icons.directions_car_filled_rounded),
                  _buildCategorySection('FOOD & REFRESHMENTS', 'Food', const Color(0xFFEC4899), Icons.restaurant_rounded),
                  _buildCategorySection('ACCOMMODATION', 'Accommodation', const Color(0xFFF59E0B), Icons.hotel_rounded),
                  _buildCategorySection('INCIDENTAL / OTHERS', 'Incidental', const Color(0xFF64748B), Icons.receipt_long_rounded),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
    );
  }

  Widget _buildCategorySection(String title, String category, Color color, IconData icon) {
    final filteredExpenses = _expenses.where((e) {
      final nature = (e['nature'] ?? e['category'])?.toString().toLowerCase();
      if (category == 'Local Travel') return nature == 'fuel' || nature == 'local travel';
      if (category == 'Incidental') return nature == 'others' || nature == 'incidental' || nature == 'miscellaneous';
      if (category == 'Travel') return nature == 'travel' || nature == 'outstation' || nature == 'outstation travel';
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
          )
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
                        letterSpacing: 0.8
                      )
                    ),
                  ],
                ),
                Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(12),
                    onTap: () => _openAddForm(category),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      child: Row(
                        children: [
                          Icon(Icons.add_circle_outline_rounded, size: 14, color: color),
                          const SizedBox(width: 4),
                          Text('ADD', 
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w800, 
                              fontSize: 10,
                              color: color
                            )
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              ],
            ),
          ),
          if (filteredExpenses.isEmpty)
            Padding(
              padding: const EdgeInsets.all(32),
              child: Center(
                child: Text('No entries found for $category', 
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11, 
                    color: const Color(0xFF94A3B8),
                    fontWeight: FontWeight.w500
                  )
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
                return _buildExpenseRow(category, exp, color, index == filteredExpenses.length - 1);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildExpenseRow(String category, dynamic exp, Color themeColor, bool isLast) {
    Map<String, dynamic> desc = {};
    try {
      if (exp['description'] is String) {
        desc = jsonDecode(exp['description'] ?? '{}');
      } else {
        desc = exp['description'] ?? {};
      }
    } catch (e) {}

    final amount = double.tryParse(exp['amount']?.toString() ?? '0') ?? 0;
    final date = DateTime.tryParse(exp['date']?.toString() ?? DateTime.now().toString()) ?? DateTime.now();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _openEditForm(category, exp),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: isLast ? null : Border(bottom: BorderSide(color: const Color(0xFFF1F5F9))),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_getIconForExp(category, desc), size: 16, color: const Color(0xFF64748B)),
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
                        color: const Color(0xFF1E293B)
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
                            fontWeight: FontWeight.w500
                          ),
                        ),
                        if (desc['subType'] != null) ...[
                          Text(' • ', style: TextStyle(color: Colors.grey.withOpacity(0.3), fontSize: 10)),
                          Text(desc['subType'].toString().toUpperCase(),
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 9, 
                              color: themeColor,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.5
                            ),
                          ),
                        ]
                      ],
                    ),
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
                      color: const Color(0xFF0F172A)
                    ),
                  ),
                  const Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFFCBD5E1)),
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
    if (mode.contains('car') || mode.contains('cab')) return Icons.directions_car_rounded;
    if (mode.contains('bike')) return Icons.directions_bike_rounded;
    
    return Icons.receipt_long_rounded;
  }

  String _getExpenseMainDisplay(dynamic exp) {
    try {
      Map<String, dynamic> desc = {};
      if (exp['description'] is String) {
        desc = jsonDecode(exp['description'] ?? '{}');
      } else {
        desc = exp['description'] ?? {};
      }

      if (exp['category']?.toString().toLowerCase() == 'fuel' || exp['category']?.toString().toLowerCase() == 'local travel') {
         return '${desc['origin'] ?? 'Start'} → ${desc['destination'] ?? 'End'}';
      }
      if (desc['origin'] != null && desc['destination'] != null) {
        return '${desc['origin']} → ${desc['destination']}';
      }
      if (desc['hotelName'] != null) return desc['hotelName'];
      if (desc['restaurant'] != null) return desc['restaurant'];
      
      return exp['remarks'] ?? exp['category'] ?? 'Trip Expense';
    } catch (e) {
      return exp['remarks'] ?? exp['category'] ?? 'Trip Expense';
    }
  }

  void _openAddForm(String category) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => TripExpenseFormDetailedScreen(category: category, tripId: widget.tripId)),
    );
    if (result == true) _fetchExpenses();
  }

  void _openEditForm(String category, dynamic exp) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => TripExpenseFormDetailedScreen(category: category, tripId: widget.tripId, expenseData: exp)),
    );
    if (result == true) _fetchExpenses();
  }
}
