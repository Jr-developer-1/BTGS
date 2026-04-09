import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/trip_service.dart';

class BulkResolveRejectionsScreen extends StatefulWidget {
  final String tripId;
  final String batchId;
  final List<dynamic> allRows;

  const BulkResolveRejectionsScreen({
    super.key,
    required this.tripId,
    required this.batchId,
    required this.allRows,
  });

  @override
  State<BulkResolveRejectionsScreen> createState() =>
      _BulkResolveRejectionsScreenState();
}

class _BulkResolveRejectionsScreenState
    extends State<BulkResolveRejectionsScreen> {
  final TripService _tripService = TripService();
  bool _isSubmitting = false;

  late List<Map<String, dynamic>> _rejectedRows;
  late List<Map<String, dynamic>> _approvedRows;

  // Controllers for editable fields in rejected rows
  final Map<int, RowControllers> _controllers = {};

  @override
  void initState() {
    super.initState();
    _splitRows();
  }

  void _splitRows() {
    _rejectedRows = [];
    _approvedRows = [];

    for (int i = 0; i < widget.allRows.length; i++) {
      final row = Map<String, dynamic>.from(widget.allRows[i]);
      final raw = (row['_status'] ?? row['status'] ?? 'Pending').toString().toLowerCase().trim();
      final isRejected = raw == 'rejected' || raw == 'fix required' || raw.contains('rejected');

      if (isRejected) {
        _rejectedRows.add({...row, '_original_index': i});
        _controllers[i] = RowControllers(row);
      } else {
        // Any row that is not explicitly rejected is shown in context
        _approvedRows.add({...row, '_original_index': i});
      }
    }
  }

  @override
  void dispose() {
    for (var c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _resubmit() async {
    setState(() => _isSubmitting = true);
    try {
      // Rebuild the full payload. 
      // Corrected rows get updated data and their status is cleared so they look "new" to the approver.
      // Already approved/validated rows are sent as-is, preserving their status so the manager doesn't have to re-evaluate them.
      final List<Map<String, dynamic>> finalPayload = [];

      for (int i = 0; i < widget.allRows.length; i++) {
        if (_controllers.containsKey(i)) {
          final originalRow = Map<String, dynamic>.from(widget.allRows[i]);
          final c = _controllers[i]!;
          
          final Map<String, dynamic> updatedRow = {
            ...originalRow,
            'date': DateFormat('yyyy-MM-dd').format(c.date),
            'start_time': _formatTime(c.startTime),
            'reach_time': _formatTime(c.reachTime),
            'origin_route': c.from.text,
            'destination_route': c.to.text,
            'visit_intent': c.purpose.text,
            'mode': c.mode.text,
            'subType': c.subType.text,
            'odo_start': c.odoStart.text,
            'odo_end': c.odoEnd.text,
          };

          // Remove internal status fields so backend treats it as new submission
          updatedRow.remove('_status');
          updatedRow.remove('_remark');
          updatedRow.remove('status');
          updatedRow.remove('remarks');

          finalPayload.add(updatedRow);
        }
      }

      await _tripService.uploadBulkJson(
        tripId: widget.tripId,
        jsonData: finalPayload, // Send all rows
        parentBatchId: widget.batchId,
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bulk batch resubmitted successfully'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed to resubmit: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _formatTime(TimeOfDay t) {
    return '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      appBar: AppBar(
        title: Text(
          'Bulk Resolve',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        centerTitle: true,
      ),
      body: CustomScrollView(
        slivers: [
          _buildInstructionHeader(),

          // Rejected Rows Section
          if (_rejectedRows.isNotEmpty) ...[
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 10, 20, 0),
                child: _sectionTitle(
                  'REJECTED ENTRIES (${_rejectedRows.length})',
                  Colors.red,
                ),
              ),
            ),
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) => _buildEditableRow(_rejectedRows[index]),
                childCount: _rejectedRows.length,
              ),
            ),
          ],

          const SliverPadding(padding: EdgeInsets.only(bottom: 120)),
        ],
      ),
      bottomNavigationBar: _buildResubmitBar(),
    );
  }

  Widget _buildInstructionHeader() {
    return SliverToBoxAdapter(
      child: Container(
        color: Colors.white,
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Below are the rejected entries that need correction. Once corrected, they will be sent for manager approval.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: const Color(0xFF64748B),
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String title, Color color) {
    return Row(
      children: [
        Container(
          width: 3,
          height: 12,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF64748B),
            letterSpacing: 1.1,
          ),
        ),
      ],
    );
  }

  Widget _buildEditableRow(Map<String, dynamic> row) {
    final int originalIdx = row['_original_index'];
    final controllers = _controllers[originalIdx]!;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Column 1: DATE
                    Expanded(
                      flex: 3,
                      child: _buildCell(
                        'DATE',
                        child: InkWell(
                          onTap: () => _pickDate(controllers),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              vertical: 10,
                              horizontal: 12,
                            ),
                            decoration: BoxDecoration(
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  DateFormat(
                                    'dd-MM-yyyy',
                                  ).format(controllers.date),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                                const Icon(
                                  Icons.calendar_today_outlined,
                                  size: 14,
                                  color: Color(0xFF64748B),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Column 2: ROUTE CORRECTION
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildCell(
                            'ROUTE CORRECTION',
                            child: const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 4),
                          _buildSmallTextField(controllers.from, 'FROM'),
                          const SizedBox(height: 8),
                          _buildSmallTextField(controllers.to, 'TO'),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Column 3: VEHICLE INFO
                    Expanded(
                      flex: 4,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildCell(
                            'VEHICLE INFO',
                            child: const SizedBox.shrink(),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(
                                Icons.pedal_bike_rounded,
                                size: 14,
                                color: Colors.blueGrey,
                              ),
                              const SizedBox(width: 4),
                              Expanded(
                                child: Text(
                                  controllers.mode.text.toUpperCase(),
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF1F5F9),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              'PURPOSE: ${controllers.purpose.text.toUpperCase()}',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 8,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF475569),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Column 4: TIME
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildCell('TIME', child: const SizedBox.shrink()),
                          const SizedBox(height: 4),
                          _buildSmallTimePicker(
                            controllers.startTime,
                            'START',
                            () => _pickTime(controllers, true),
                          ),
                          const SizedBox(height: 8),
                          _buildSmallTimePicker(
                            controllers.reachTime,
                            'REACH',
                            () => _pickTime(controllers, false),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 20),

                // Column 6: REJECTION REASON
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF2F2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFEE2E2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'REJECTION REMARK',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          color: const Color(0xFF991B1B),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        row['remarks'] ?? row['_remarks'] ?? row['_remark'] ?? 'No reason provided',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFFB91C1C),
                        ),
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

  Widget _buildSmallTextField(TextEditingController controller, String label) {
    return Row(
      children: [
        Text(
          '$label  ',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 8,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
          ),
        ),
        Expanded(
          child: Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFE2E8F0)),
              borderRadius: BorderRadius.circular(6),
            ),
            child: TextField(
              controller: controller,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
              decoration: const InputDecoration(
                border: InputBorder.none,
                isDense: true,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSmallTimePicker(
    TimeOfDay time,
    String label,
    VoidCallback onTap,
  ) {
    return Row(
      children: [
        Text(
          '$label ',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 8,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
          ),
        ),
        Expanded(
          child: InkWell(
            onTap: onTap,
            child: Container(
              height: 32,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFE2E8F0)),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _formatTime(time),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const Icon(
                    Icons.access_time,
                    size: 12,
                    color: Color(0xFF94A3B8),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCell(String label, {required Widget child}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 4),
        child,
      ],
    );
  }

  Future<void> _pickDate(RowControllers c) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: c.date,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => c.date = picked);
    }
  }

  Future<void> _pickTime(RowControllers c, bool isStart) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? c.startTime : c.reachTime,
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          c.startTime = picked;
        } else {
          c.reachTime = picked;
        }
      });
    }
  }

  Widget _buildResubmitBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 34),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 20),
        ],
      ),
      child: ElevatedButton(
        onPressed: _isSubmitting ? null : _resubmit,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF10B981),
          foregroundColor: Colors.white,
          minimumSize: const Size(double.infinity, 56),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: 4,
        ),
        child: _isSubmitting
            ? const CircularProgressIndicator(color: Colors.white)
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.send_rounded, size: 20),
                  const SizedBox(width: 12),
                  Text(
                    'RESUBMIT CORRECTED BATCH',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

class RowControllers {
  late TextEditingController from;
  late TextEditingController to;
  late TextEditingController purpose;
  late TextEditingController mode;
  late TextEditingController subType;
  late TextEditingController odoStart;
  late TextEditingController odoEnd;
  late DateTime date;
  late TimeOfDay startTime;
  late TimeOfDay reachTime;

  RowControllers(Map<String, dynamic> row) {
    final details = row['details'] ?? {};
    from = TextEditingController(
      text: (row['origin_route'] ?? row['from_location'] ?? details['origin'] ?? '').toString(),
    );
    to = TextEditingController(
      text: (row['destination_route'] ?? row['to_location'] ?? details['destination'] ?? '').toString(),
    );
    purpose = TextEditingController(
      text: (row['visit_intent'] ?? row['purpose'] ?? details['purpose'] ?? '').toString(),
    );
    mode = TextEditingController(
      text: (row['mode'] ?? details['mode'] ?? '').toString(),
    );
    subType = TextEditingController(
      text: (row['subType'] ?? row['vehicle_type'] ?? details['subType'] ?? '').toString(),
    );
    odoStart = TextEditingController(
      text: (row['odo_start'] ?? details['odoStart'] ?? '').toString(),
    );
    odoEnd = TextEditingController(
      text: (row['odo_end'] ?? details['odoEnd'] ?? '').toString(),
    );
    date = _parseDate(row['date']);
    startTime = _parseTime(row['start_time'] ?? row['time'] ?? '09:00');
    reachTime = _parseTime(row['reach_time'] ?? row['end_time'] ?? '10:00');
  }

  static DateTime _parseDate(dynamic date) {
    if (date == null || date == 'N/A' || date == '') return DateTime.now();
    final dStr = date.toString();

    // Try ISO format
    DateTime? dt = DateTime.tryParse(dStr);
    if (dt != null) return dt;

    // Try DD-MM-YYYY
    try {
      return DateFormat('dd-MM-yyyy').parse(dStr);
    } catch (_) {}

    // Try YYYY-MM-DD
    try {
      return DateFormat('yyyy-MM-dd').parse(dStr);
    } catch (_) {}

    return DateTime.now();
  }

  static TimeOfDay _parseTime(String timeStr) {
    try {
      // Handle full ISO timestamps
      if (timeStr.contains('T')) {
        final dt = DateTime.tryParse(timeStr);
        if (dt != null) return TimeOfDay.fromDateTime(dt);
      }

      String workingTime = timeStr.trim();
      if (workingTime.contains(' ')) {
        final parts = workingTime.split(' ');
        // If first part looks like date (YYYY-MM-DD or DD-MM-YYYY)
        if (parts[0].contains('-') || parts[0].contains('/')) {
          workingTime = parts.last;
        }
      }

      final parts = workingTime.split(':');
      if (parts.length >= 2) {
        int hour = int.parse(parts[0].replaceAll(RegExp(r'[^0-9]'), ''));
        int minute = int.parse(parts[1].replaceAll(RegExp(r'[^0-9]'), ''));

        if (workingTime.toLowerCase().contains('pm') && hour < 12) hour += 12;
        if (workingTime.toLowerCase().contains('am') && hour == 12) hour = 0;

        return TimeOfDay(hour: hour.clamp(0, 23), minute: minute.clamp(0, 59));
      }
    } catch (_) {}
    return const TimeOfDay(hour: 9, minute: 0);
  }

  void dispose() {
    from.dispose();
    to.dispose();
    purpose.dispose();
    mode.dispose();
    subType.dispose();
    odoStart.dispose();
    odoEnd.dispose();
  }
}
