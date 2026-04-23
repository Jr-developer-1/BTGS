import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import 'my_trips_screen.dart';

class AdvanceRequestScreen extends StatefulWidget {
  const AdvanceRequestScreen({super.key});

  @override
  State<AdvanceRequestScreen> createState() => _AdvanceRequestScreenState();
}

class _AdvanceRequestScreenState extends State<AdvanceRequestScreen> {
  final TripService _tripService = TripService();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _purposeController = TextEditingController();
  
  bool _isLoading = true;
  bool _isSubmitting = false;
  List<Trip> _trips = [];
  String? _selectedTripId;
  static const double _capacityLimit = 45000.0;

  @override
  void initState() {
    super.initState();
    _fetchTrips();
  }

  Future<void> _fetchTrips() async {
    setState(() => _isLoading = true);
    try {
      final trips = await _tripService.fetchTrips();
      setState(() {
        _trips = trips.where((t) => ['Submitted', 'Approved', 'On-going', 'HR Approved'].contains(t.status)).toList();
        if (_trips.isNotEmpty) {
          _selectedTripId = _trips.first.id;
        }
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
         ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error loading trips: $e')));
      }
    }
  }

  Future<void> _handleSubmit() async {
    if (_selectedTripId == null || _amountController.text.isEmpty || _purposeController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      await _tripService.requestAdvance(
        _selectedTripId!,
        double.parse(_amountController.text),
        _purposeController.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Advance request submitted successfully'), backgroundColor: Colors.green),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Submission failed: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    double? currentAmount = double.tryParse(_amountController.text);
    bool showCfoAlert = currentAmount != null && currentAmount > _capacityLimit;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Request Advance',
          style: GoogleFonts.interTight(
            color: const Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
            fontSize: 18,
          ),
        ),
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF0F172A)))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildFormSection(showCfoAlert),
                const SizedBox(height: 24),
                _buildCapacityCard(),
              ],
            ),
          ),
    );
  }

  Widget _buildFormSection(bool showCfoAlert) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _fieldLabel('Associated Trip'),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: _selectedTripId,
                isExpanded: true,
                items: _trips.map((t) => DropdownMenuItem(
                  value: t.id,
                  child: Text('${t.tripId} - ${t.destination}', style: GoogleFonts.inter(fontSize: 14)),
                )).toList(),
                onChanged: (val) => setState(() => _selectedTripId = val),
              ),
            ),
          ),
          const SizedBox(height: 20),
          _fieldLabel('Requested Amount (INR)'),
          const SizedBox(height: 8),
          TextField(
            controller: _amountController,
            keyboardType: TextInputType.number,
            onChanged: (val) => setState(() {}),
            decoration: _inputDecoration(Icons.currency_rupee_rounded, '0.00'),
          ),
          const SizedBox(height: 20),
          _fieldLabel('Reason / Remittance Details'),
          const SizedBox(height: 8),
          TextField(
            controller: _purposeController,
            maxLines: 4,
            decoration: _inputDecoration(Icons.description_outlined, 'e.g. For food and transport'),
          ),
          
          if (showCfoAlert) ...[
            const SizedBox(height: 20),
            _cfoAlert(),
          ],

          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                elevation: 0,
              ),
              child: _isSubmitting 
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : Text('SUBMIT REQUEST', style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 15, color: Colors.white, letterSpacing: -0.2)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCapacityCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9).withOpacity(0.5),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet_rounded, size: 20, color: Color(0xFF475569)),
              const SizedBox(width: 10),
              Text(
                'Recovery Capacity',
                style: GoogleFonts.interTight(fontSize: 16, fontWeight: FontWeight.w900, color: const Color(0xFF1E293B)),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _capacityRow('F&F Payable', '₹25,000'),
          const SizedBox(height: 12),
          _capacityRow('Asset Value', '₹20,000'),
          const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
          _capacityRow('Total Capacity', '₹45,000', isTotal: true),
        ],
      ),
    );
  }

  Widget _fieldLabel(String label) {
    return Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: FontWeight.w800, color: const Color(0xFF64748B)));
  }

  InputDecoration _inputDecoration(IconData icon, String hint) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: Icon(icon, size: 20, color: const Color(0xFF94A3B8)),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF0F172A), width: 1.5)),
    );
  }

  Widget _cfoAlert() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFFFEF2F2), borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFFEE2E2))),
      child: Row(
        children: [
          const Icon(Icons.security_rounded, color: Color(0xFFB91C1C), size: 18),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('CFO Approval Required', style: GoogleFonts.inter(fontWeight: FontWeight.w800, fontSize: 13, color: const Color(0xFF991B1B))),
                const SizedBox(height: 2),
                Text('Amount exceeds ₹45,000 recovery capacity.', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFFB91C1C))),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _capacityRow(String label, String value, {bool isTotal = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 13, fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600, color: isTotal ? const Color(0xFF1E293B) : const Color(0xFF64748B))),
        Text(value, style: GoogleFonts.inter(fontSize: isTotal ? 16 : 14, fontWeight: FontWeight.w900, color: isTotal ? const Color(0xFF0F172A) : const Color(0xFF334155))),
      ],
    );
  }
}
