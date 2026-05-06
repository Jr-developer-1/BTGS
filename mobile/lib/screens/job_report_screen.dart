import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import '../services/trip_service.dart';
import '../services/api_service.dart';

class JobReportScreen extends StatefulWidget {
  const JobReportScreen({super.key});

  @override
  State<JobReportScreen> createState() => _JobReportScreenState();
}

class _JobReportScreenState extends State<JobReportScreen> {
  final TripService _tripService = TripService();
  final ApiService _apiService = ApiService();
  
  bool _isLoading = true;
  List<Map<String, dynamic>> _reports = [];
  List<Map<String, dynamic>> _users = [];
  List<Map<String, dynamic>> _batchesToApprove = [];
  List<Map<String, dynamic>> _myOwnBatches = [];
  List<Map<String, dynamic>> _teamBatchHistory = [];
  
  Map<String, dynamic>? _currentUser;
  String? _selectedEmployee;
  DateTime _startDate = DateTime.now().subtract(const Duration(days: 30));
  DateTime _endDate = DateTime.now();
  
  String? _expandedRowId;
  int? _expandedBatchId;

  @override
  void initState() {
    super.initState();
    _currentUser = _apiService.getUser();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      await Future.wait([
        _fetchUsers(),
        _fetchReports(),
        _fetchBatches(),
      ]);
    } catch (e) {
      debugPrint("Error loading data: $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _fetchUsers() async {
    final users = await _tripService.fetchUsers();
    setState(() => _users = users);
  }

  Future<void> _fetchReports() async {
    final all = await _tripService.fetchExpenses();
    
    // Filter locally like the web app
    final filtered = all.where((exp) {
      final matchesEmployee = _selectedEmployee == null || 
          _selectedEmployee == '' ||
          exp['trip_user_id']?.toString() == _selectedEmployee ||
          exp['user_id']?.toString() == _selectedEmployee;
      
      final expDate = DateTime.tryParse(exp['date'] ?? '') ?? DateTime(1970);
      final matchesDate = expDate.isAfter(_startDate.subtract(const Duration(days: 1))) && 
                         expDate.isBefore(_endDate.add(const Duration(days: 1)));
      
      return matchesEmployee && matchesDate;
    }).toList();

    filtered.sort((a, b) => (b['date'] ?? '').compareTo(a['date'] ?? ''));
    setState(() => _reports = filtered);
  }

  Future<void> _fetchBatches() async {
    final all = await _tripService.fetchBulkActivities();
    final userId = _currentUser?['id']?.toString();
    final role = (_currentUser?['role_name'] ?? '').toString().toLowerCase();
    final isAdminOrExec = ['admin', 'it-admin', 'superuser', 'coo', 'cfo', 'finance'].any((kw) => role.contains(kw));

    setState(() {
      _batchesToApprove = all.where((b) => 
        b['status'] == 'Submitted' && b['current_approver']?.toString() == userId
      ).toList();

      _myOwnBatches = all.where((b) => b['user']?.toString() == userId).toList();

      _teamBatchHistory = all.where((b) {
        final isProcessed = b['status'] == 'Approved' || b['status'] == 'Rejected';
        final wasApprover = b['current_approver']?.toString() == userId;
        final isNotOwnedByMe = b['user']?.toString() != userId;
        return isProcessed && (wasApprover || (isAdminOrExec && isNotOwnedByMe));
      }).toList();
    });
  }

  Future<void> _handleBatchAction(String batchId, String action) async {
    try {
      await _tripService.handleBulkBatchAction(batchId, action);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Batch ${action}d successfully')),
      );
      _fetchBatches();
      _fetchReports();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Action failed: $e')),
      );
    }
  }

  Map<String, dynamic> _parseDescription(dynamic desc) {
    if (desc is Map<String, dynamic>) return desc;
    if (desc is String) {
      try {
        return json.decode(desc);
      } catch (e) {
        return {};
      }
    }
    return {};
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'Activity Tracking',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0F172A),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadData,
          ),
        ],
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: Color(0xFFBB0633)))
        : SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeaderInfo(),
                const SizedBox(height: 20),
                if (_batchesToApprove.isNotEmpty) ...[
                  _buildBatchSection('Review Pending Batches', _batchesToApprove, const Color(0xFF3B82F6), true),
                  const SizedBox(height: 20),
                ],
                if (_teamBatchHistory.isNotEmpty) ...[
                  _buildBatchSection('Team Activity History', _teamBatchHistory, const Color(0xFF1E293B), false),
                  const SizedBox(height: 20),
                ],
                if (_myOwnBatches.isNotEmpty) ...[
                  _buildBatchSection('My Activity Status', _myOwnBatches, const Color(0xFFBB0633), false),
                  const SizedBox(height: 20),
                ],
                _buildFilterCard(),
                const SizedBox(height: 20),
                _buildReportTable(),
                const SizedBox(height: 40),
              ],
            ),
          ),
    );
  }

  Widget _buildHeaderInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Activity Tracking',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
        Text(
          'Consolidated view of all local travel and site tasks',
          style: GoogleFonts.inter(
            fontSize: 14,
            color: const Color(0xFF64748B),
          ),
        ),
      ],
    );
  }

  Widget _buildBatchSection(String title, List<Map<String, dynamic>> batches, Color color, bool isActionable) {
    return Container(
      decoration: BoxDecoration(
        color: color.withOpacity(0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.upload, color: color, size: 20),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    color: color,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...batches.map((batch) => _buildBatchItem(batch, color, isActionable)),
        ],
      ),
    );
  }

  Widget _buildBatchItem(Map<String, dynamic> batch, Color color, bool isActionable) {
    bool isExpanded = _expandedBatchId == batch['id'];
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          ListTile(
            title: Text(
              '${batch['user_name']} - ${batch['file_name']}',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13),
            ),
            subtitle: Text(
              'Trip: ${batch['trip_id_display']} • ${DateFormat('dd MMM yyyy').format(DateTime.parse(batch['created_at']))}',
              style: GoogleFonts.inter(fontSize: 11),
            ),
            trailing: !isActionable ? _buildStatusChip(batch['status']) : null,
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 8, 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (isActionable) ...[
                  TextButton(
                    onPressed: () => _handleBatchAction(batch['id'].toString(), 'reject'),
                    child: Text(
                      'Reject',
                      style: GoogleFonts.inter(
                        color: const Color(0xFF0F172A),
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  TextButton(
                    onPressed: () => _handleBatchAction(batch['id'].toString(), 'approve'),
                    child: Text(
                      'Approve Batch',
                      style: GoogleFonts.inter(
                        color: const Color(0xFF0F172A),
                        fontWeight: FontWeight.w800,
                        fontSize: 14,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                ],
                InkWell(
                  onTap: () {
                    setState(() {
                      _expandedBatchId = isExpanded ? null : batch['id'];
                    });
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'View Data',
                          style: GoogleFonts.inter(
                            color: const Color(0xFF3B82F6),
                            fontWeight: FontWeight.w700,
                            fontSize: 14,
                          ),
                        ),
                        Icon(
                          isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                          color: const Color(0xFF3B82F6),
                          size: 20,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (isExpanded) _buildBatchData(batch),
        ],
      ),
    );
  }

  Widget _buildBatchData(Map<String, dynamic> batch) {
    final data = batch['data_json'] as List?;
    if (data == null || data.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12),
      margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Text(
              'Excel Entries Preview',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF64748B),
              ),
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingRowHeight: 45,
              dataRowHeight: 50,
              columnSpacing: 24,
              horizontalMargin: 16,
              headingRowColor: WidgetStateProperty.all(const Color(0xFFF8FAFC)),
              columns: [
                _buildDataColumn('DATE'),
                _buildDataColumn('PURPOSE'),
                _buildDataColumn('FROM LOCATION'),
                _buildDataColumn('TO LOCATION'),
              ],
              rows: data.map((rowMap) {
                final row = rowMap as Map<String, dynamic>;
                
                return DataRow(cells: [
                  _buildDataCell(row['date']?.toString() ?? '-'),
                  _buildDataCell(row['visit_intent']?.toString() ?? '-'),
                  _buildDataCell(row['origin_route']?.toString() ?? '-'),
                  _buildDataCell(row['destination_route']?.toString() ?? '-'),
                ]);
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  DataColumn _buildDataColumn(String label) {
    return DataColumn(
      label: Text(
        label,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF475569),
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  DataCell _buildDataCell(String value) {
    return DataCell(
      Text(
        value,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          color: const Color(0xFF1E293B),
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildFilterCard() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 15,
            offset: const Offset(0, 5),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          DropdownButtonFormField<String>(
            value: _selectedEmployee,
            decoration: _inputDecoration('Employee Name', Icons.person),
            items: [
              const DropdownMenuItem(value: '', child: Text('All Employees')),
              ..._users.map((u) => DropdownMenuItem(
                value: u['employee_id']?.toString(),
                child: Text('${u['name']} (${u['employee_id']})'),
              )),
            ],
            onChanged: (val) {
              setState(() => _selectedEmployee = val);
            },
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _startDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _startDate = date);
                  },
                  child: InputDecorator(
                    decoration: _inputDecoration('Start Period', Icons.calendar_today),
                    child: Text(DateFormat('dd MMM yyyy').format(_startDate)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: InkWell(
                  onTap: () async {
                    final date = await showDatePicker(
                      context: context,
                      initialDate: _endDate,
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now(),
                    );
                    if (date != null) setState(() => _endDate = date);
                  },
                  child: InputDecorator(
                    decoration: _inputDecoration('End Period', Icons.calendar_today),
                    child: Text(DateFormat('dd MMM yyyy').format(_endDate)),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _fetchReports,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                'Generate Report',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReportTable() {
    if (_reports.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(40.0),
          child: Column(
            children: [
              Icon(Icons.dashboard_outlined, size: 64, color: Colors.grey.withOpacity(0.3)),
              const SizedBox(height: 16),
              Text('No Records Found', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.bold)),
              Text('Try adjusting filters', style: GoogleFonts.inter(color: Colors.grey)),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _reports.length,
      itemBuilder: (context, index) {
        final r = _reports[index];
        final id = r['id'].toString();
        bool isExpanded = _expandedRowId == id;
        final details = _parseDescription(r['description']);
        final isLocalTravel = r['category'] == 'Fuel' || r['category'] == 'Local Travel';

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF1F5F9)),
          ),
          child: Column(
            children: [
              Theme(
                data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  key: PageStorageKey(id),
                  initiallyExpanded: isExpanded,
                  onExpansionChanged: (val) => setState(() => _expandedRowId = val ? id : null),
                  tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  title: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(
                          isLocalTravel ? Icons.map_sharp : Icons.article,
                          size: 18,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              DateFormat('dd MMM yyyy').format(DateTime.parse(r['date'])),
                              style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B)),
                            ),
                            Text(
                              r['user_name'] ?? 'User',
                              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                      if (r['odo_start'] != null)
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '${r['distance']} KM',
                              style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: const Color(0xFFBB0633)),
                            ),
                            Text(
                              '${r['odo_start']} → ${r['odo_end']}',
                              style: GoogleFonts.plusJakartaSans(fontSize: 10, color: Colors.grey),
                            ),
                          ],
                        ),
                    ],
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 8.0, left: 42),
                    child: Text(
                      details['natureOfVisit'] ?? details['description'] ?? 'Field Visit',
                      style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: const Color(0xFF334155)),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  children: [
                    _buildExpandedDetail(r, details),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildExpandedDetail(Map<String, dynamic> r, Map<String, dynamic> details) {
    final selfies = details['selfies'] as List? ?? [];
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(
        color: Color(0xFFF8FAFC),
        borderRadius: BorderRadius.only(bottomLeft: Radius.circular(16), bottomRight: Radius.circular(16)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildDetailRow('Movement Mode', r['travel_mode']?.toString() ?? 'N/A'),
          _buildDetailRow('Vehicle Type', r['vehicle_type']?.toString() ?? 'N/A'),
          _buildDetailRow('Route', '${details['origin'] ?? details['fromLocation'] ?? 'Start'} → ${details['destination'] ?? details['toLocation'] ?? 'End'}'),
          _buildDetailRow('Visit Intent', details['purpose'] ?? 'Official Task'),
          const Divider(height: 24),
          Text('VISUAL EVIDENCE', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.grey, letterSpacing: 1)),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                if (details['odoStartImg'] != null) _buildEvidenceChip('Start ODO', details['odoStartImg']),
                if (details['odoEndImg'] != null) _buildEvidenceChip('End ODO', details['odoEndImg']),
                ...selfies.map((s) => _buildEvidenceChip('Task Selfie', s)),
                if (details['jobReportAttachments'] != null)
                  ...(details['jobReportAttachments'] as List).map((s) => _buildEvidenceChip('Job Pic', s.toString())).toList(),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text('REMARKS', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.grey, letterSpacing: 1)),
          const SizedBox(height: 8),
          Text(details['remarks'] ?? 'No specific remarks provided.', style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF475569))),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF64748B))),
          Text(value, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
        ],
      ),
    );
  }

  Widget _buildEvidenceChip(String label, String? source) {
    if (source == null || source.isEmpty) return const SizedBox.shrink();
    
    final fullUrl = _apiService.getImageUrl(source);
    final isBase64 = fullUrl.startsWith('data:');
    
    ImageProvider imageProvider;
    if (isBase64) {
      try {
        final base64String = fullUrl.split(',').last;
        imageProvider = MemoryImage(base64Decode(base64String));
      } catch (e) {
        imageProvider = const AssetImage('assets/placeholder.png');
      }
    } else {
      imageProvider = NetworkImage(fullUrl);
    }

    return GestureDetector(
      onTap: () {
        showDialog(
          context: context,
          builder: (_) => Dialog(
            backgroundColor: Colors.transparent,
            child: InteractiveViewer(
              child: Image(
                image: imageProvider,
                errorBuilder: (context, error, stackTrace) => Container(
                  color: Colors.white,
                  padding: const EdgeInsets.all(20),
                  child: const Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.broken_image, size: 64, color: Colors.grey),
                      SizedBox(height: 8),
                      Text('Failed to load image'),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
      child: Container(
        margin: const EdgeInsets.only(right: 12),
        width: 100,
        height: 120,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          children: [
            Expanded(
              child: Image(
                image: imageProvider,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => const Center(
                  child: Icon(Icons.broken_image, color: Colors.grey),
                ),
              ),
            ),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 4),
              color: Colors.white,
              child: Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, size: 20, color: const Color(0xFFBB0633).withOpacity(0.7)),
      filled: true,
      fillColor: const Color(0xFFF8FAFC),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );
  }

  Widget _buildStatusChip(String? status) {
    final color = _getStatusColorValue(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status?.toUpperCase() ?? '',
        style: GoogleFonts.inter(
          fontSize: 9,
          fontWeight: FontWeight.w900,
          color: color,
        ),
      ),
    );
  }

  Color _getStatusColorValue(String? status) {
    switch (status?.toLowerCase()) {
      case 'approved': return Colors.green;
      case 'rejected': return Colors.red;
      case 'submitted': return Colors.orange;
      default: return Colors.grey;
    }
  }
}
