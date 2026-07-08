import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'trip_expense_form_detailed.dart';

class SelectCategoryScreen extends StatelessWidget {
  final String tripId;
  const SelectCategoryScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Select Category',
          style: GoogleFonts.interTight(
            color: Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 0.9,
          children: [
            _buildCategoryItem(context, 'Travel', Icons.flight_takeoff_rounded, const Color(0xFFE3F2FD), const Color(0xFF1976D2)),
            _buildCategoryItem(context, 'Accommodation', Icons.bed_rounded, const Color(0xFFE8F5E8), const Color(0xFF388E3C)),
            _buildCategoryItem(context, 'Food', Icons.fastfood_rounded, const Color(0xFFFFF3E0), const Color(0xFFF57C00)),
            _buildCategoryItem(context, 'Local Travel', Icons.directions_car_rounded, const Color(0xFFF3E5F5), const Color(0xFF7B1FA2)),
            _buildCategoryItem(context, 'Incidental', Icons.receipt_long_rounded, const Color(0xFFE8EAF6), const Color(0xFF3949AB)),
            _buildCategoryItem(context, 'Daily Allowance', Icons.currency_rupee_rounded, const Color(0xFFFCE4EC), const Color(0xFFC62828)),
            _buildCategoryItem(context, 'Others', Icons.more_horiz_rounded, const Color(0xFFF1F1F1), const Color(0xFF616161)),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryItem(BuildContext context, String title, IconData icon, Color bgColor, Color iconColor) {
    return GestureDetector(
      onTap: () {
        Navigator.push(
          context,
          MaterialPageRoute(builder: (context) => TripExpenseFormDetailedScreen(category: title, tripId: tripId)),
        );
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: bgColor,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: iconColor, size: 30),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: GoogleFonts.interTight(
                fontWeight: FontWeight.bold,
                fontSize: 14,
                color: Colors.black87,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
