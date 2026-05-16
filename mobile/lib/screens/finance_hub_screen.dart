import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:file_picker/file_picker.dart';
import 'package:open_filex/open_filex.dart';
import 'dart:io';
import '../services/trip_service.dart';
import '../screens/settlements_screen.dart';

class FinanceHubScreen extends StatefulWidget {
  const FinanceHubScreen({super.key});

  @override
  State<FinanceHubScreen> createState() => _FinanceHubScreenState();
}

class _FinanceHubScreenState extends State<FinanceHubScreen> {
  final TripService _tripService = TripService();
  bool _isLoading = true;
  List<Map<String, dynamic>> _records = [];
  String _selectedTab = 'pending'; // pending, processing, completed, rejected
  final TextEditingController _searchController = TextEditingController();

  // Stats mirroring web
  int _pendingAuditCount = 0;
  double _settledTodayValue = 0.0;
  int _flaggedDisputedCount = 0;
  String _avgAuditTime = '2.4h';

  @override
  void initState() {
    super.initState();
    _fetchFinanceData();
  }

  Future<void> _fetchStats() async {
    try {
      final pendingCountData = await _tripService.fetchApprovals(tab: 'pending', source: 'hub');
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());
      final settledTodayData = await _tripService.fetchApprovals(tab: 'completed', source: 'hub', date: today);
      double todayTotal = 0;
      for (var item in settledTodayData) {
        final details = item['details'] ?? {};
        final amtStr = (details['executive_approved_amount'] ?? item['cost'] ?? '0').toString().replaceAll('₹', '').replaceAll(',', '');
        todayTotal += double.tryParse(amtStr) ?? 0;
      }
      final disputedData = await _tripService.fetchApprovals(tab: 'pending', source: 'hub', extraParams: {'is_disputed': 'true'});

      if (mounted) {
        setState(() {
          _pendingAuditCount = pendingCountData.length;
          _settledTodayValue = todayTotal;
          _flaggedDisputedCount = disputedData.length;
        });
      }
    } catch (e) {
      debugPrint('Error fetching stats: $e');
    }
  }

  Future<void> _fetchFinanceData() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
    });
    try {
      _fetchStats();
      final data = await _tripService.fetchApprovals(
        tab: _selectedTab,
        viewType: 'all',
        source: 'hub',
        search: _searchController.text,
      );

      if (mounted) {
        setState(() {
          _records = data;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to load records: $e')));
      }
    }
  }

  Future<void> _handleUnderProcess(dynamic id) async {
    try {
      await _tripService.performApproval(id, 'UnderProcess');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Marked as Under Process'), backgroundColor: Colors.orange),
        );
        _fetchFinanceData();
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Action failed: $e'), backgroundColor: Colors.red));
    }
  }

  Future<void> _handleExport({String? tabOverride}) async {
    final targetTab = tabOverride ?? _selectedTab;
    try {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Generating Finance Export...')));
      String? path = await _tripService.exportFinanceExcel(targetTab);
      if (path != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Export Complete!'),
            action: SnackBarAction(label: 'OPEN', onPressed: () => OpenFilex.open(path)),
          ),
        );
        await OpenFilex.open(path);
      }
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed: $e')));
    }
  }

  Future<void> _handleImport() async {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (context) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bulk Operations', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w900)),
            const SizedBox(height: 20),
            _buildModalOption(Icons.file_download_outlined, 'Export Pending Template', 'Download unpaid records', () {
              Navigator.pop(context);
              _handleExport(tabOverride: 'pending');
            }),
            _buildModalOption(Icons.check_circle_outline, 'Export Paid Template', 'Download processed records', () {
              Navigator.pop(context);
              _handleExport(tabOverride: 'completed');
            }),
            const Divider(height: 32),
            _buildModalOption(Icons.file_upload_outlined, 'Upload Updated Ledger', 'Update status via Excel', () async {
              Navigator.pop(context);
              await _performFileUpload();
            }, isPrimary: true),
          ],
        ),
      ),
    );
  }

  Future<void> _performFileUpload() async {
    try {
      FilePickerResult? result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['xlsx', 'xls']);
      if (result != null && result.files.single.path != null) {
        File file = File(result.files.single.path!);
        setState(() => _isLoading = true);
        final resp = await _tripService.importFinanceStatus(file);
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(resp['message'] ?? 'Import successful'), backgroundColor: Colors.green));
          _fetchFinanceData();
        }
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Import failed: $e'), backgroundColor: Colors.red));
    }
  }

  Widget _buildModalOption(IconData icon, String title, String sub, VoidCallback onTap, {bool isPrimary = false}) {
    return ListTile(
      onTap: onTap,
      leading: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: isPrimary ? const Color(0xFFBB0633).withOpacity(0.1) : Colors.grey[100],
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: isPrimary ? const Color(0xFFBB0633) : Colors.black87),
      ),
      title: Text(title, style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 14)),
      subtitle: Text(sub, style: GoogleFonts.inter(fontSize: 11, color: Colors.grey)),
      contentPadding: EdgeInsets.zero,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchFinanceData,
              color: const Color(0xFF0D9488),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  children: [
                    _buildActionBar(),
                    _buildKpiGrid(),
                    _buildFilterTabs(),
                    _buildSearchBox(),
                    _buildRecordList(),
                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionBar() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
      child: Row(
        children: [
          Expanded(
            child: _actionTile(
              Icons.library_add_rounded, 
              'BULK OPERATIONS', 
              const Color(0xFF0F172A),
              Colors.white,
              _handleImport
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _actionTile(
              Icons.sync_rounded, 
              'REFRESH', 
              const Color(0xFF0F172A),
              Colors.white,
              _fetchFinanceData
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: _actionTile(
              Icons.bolt_rounded, 
              'SETTLEMENTS', 
              const Color(0xFFBB0633),
              Colors.white,
              () => Navigator.push(context, MaterialPageRoute(builder: (context) => const SettlementsScreen()))
            ),
          ),
        ],
      ),
    );
  }

  Widget _actionTile(IconData icon, String label, Color bgColor, Color textColor, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: bgColor.withOpacity(0.2),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: textColor, size: 14),
              const SizedBox(width: 4),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                  color: textColor,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0D9488), Color(0xFF134E4A)], // Teal theme
        ),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(40),
          bottomRight: Radius.circular(40),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x330D9488),
            blurRadius: 20,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 16, 20, 16),
          child: Column(
            children: [
              Row(
                children: [
                   IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
                    onPressed: () => Navigator.pop(context),
                  ),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(Icons.account_balance_rounded, color: Color(0xFF0D9488), size: 24),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'FINANCIAL CONTROL HUB',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.white.withOpacity(0.7),
                            letterSpacing: 1.2,
                          ),
                        ),
                        Text(
                          'Finance Hub',
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
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildKpiGrid() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      child: GridView.count(
        crossAxisCount: 2,
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        crossAxisSpacing: 16,
        mainAxisSpacing: 16,
        childAspectRatio: 1.4,
        children: [
          _kpiCard(
            'Pending Audit', 
            _pendingAuditCount.toString(), 
            const Color(0xFFF59E0B), // Vibrant Amber
            Icons.timer_outlined
          ),
          _kpiCard(
            'Settled Today', 
            '₹${NumberFormat.compact().format(_settledTodayValue)}', 
            const Color(0xFF10B981), // Vibrant Green
            Icons.verified_rounded
          ),
          _kpiCard(
            'Disputed', 
            _flaggedDisputedCount.toString(), 
            const Color(0xFFEF4444), // Vibrant Red
            Icons.report_problem_outlined
          ),
          _kpiCard(
            'Avg Runtime', 
            _avgAuditTime, 
            const Color(0xFF3B82F6), // Vibrant Blue
            Icons.auto_graph_rounded
          ),
        ],
      ),
    );
  }

  Widget _kpiCard(String label, String value, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color, // Solid vivid color like the screenshot
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.3),
            blurRadius: 15,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            right: -10,
            top: -10,
            child: Icon(icon, size: 60, color: Colors.white.withOpacity(0.15)),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 16, color: Colors.white),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
                  Text(
                    label.toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 9,
                      fontWeight: FontWeight.w800,
                      color: Colors.white.withOpacity(0.8),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFilterTabs() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(
          children: [
            _tabItem('pending', 'Action Required', Icons.pending_actions_rounded),
            _tabItem('processing', 'Under Process', Icons.sync_rounded),
            _tabItem('completed', 'Transfer Done', Icons.assignment_turned_in_rounded),
            _tabItem('rejected', 'Rejected', Icons.cancel_outlined),
          ],
        ),
      ),
    );
  }

  Widget _tabItem(String key, String label, IconData icon) {
    bool isSelected = _selectedTab == key;
    return GestureDetector(
      onTap: () { setState(() { _selectedTab = key; }); _fetchFinanceData(); },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        margin: const EdgeInsets.only(right: 12),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0F172A) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 16, color: isSelected ? Colors.white : const Color(0xFF64748B)),
            const SizedBox(width: 8),
            Text(label, style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w800, color: isSelected ? Colors.white : const Color(0xFF64748B))),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBox() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: TextField(
          controller: _searchController,
          onSubmitted: (v) => _fetchFinanceData(),
          decoration: InputDecoration(
            hintText: 'Search by ID or Employee...',
            hintStyle: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
            border: InputBorder.none,
            icon: const Icon(Icons.search, size: 18, color: Color(0xFF0D9488)),
          ),
        ),
      ),
    );
  }

  Widget _buildRecordList() {
    if (_isLoading) return const Padding(padding: EdgeInsets.only(top: 60), child: Center(child: CircularProgressIndicator(color: Color(0xFFBB0633))));
    if (_records.isEmpty) return _buildEmptyState();
    return ListView.builder(
      shrinkWrap: true, physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      itemCount: _records.length,
      itemBuilder: (context, index) => _buildTransactionCard(_records[index]),
    );
  }

  Widget _buildTransactionCard(Map<String, dynamic> rec) {
    bool canProcess = _selectedTab == 'pending' || _selectedTab == 'processing';
    final details = rec['details'] ?? {};
    final isDisputed = details['is_disputed'] == true;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white, borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDisputed ? Colors.red.withOpacity(0.3) : const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        children: [
          if (isDisputed)
            Container(
              width: double.infinity, padding: const EdgeInsets.symmetric(vertical: 4),
              decoration: const BoxDecoration(color: Color(0xFFEF4444), borderRadius: BorderRadius.only(topLeft: Radius.circular(24), topRight: Radius.circular(24))),
              child: Text('DISPUTED', textAlign: TextAlign.center, style: GoogleFonts.plusJakartaSans(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.white)),
            ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Flexible(
                      child: _infoChip(Icons.numbers_rounded, rec['id']?.toString() ?? 'N/A'),
                    ),
                    const SizedBox(width: 8),
                    _statusBadge(rec['status'] ?? 'PENDING'),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    CircleAvatar(radius: 20, backgroundColor: const Color(0xFFF1F5F9), child: const Icon(Icons.person_rounded, size: 20, color: Color(0xFFBB0633))),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(rec['requester']?.toString().toUpperCase() ?? 'EMPLOYEE', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                          Text(details['trip_id']?.toString() ?? 'TRIP ID N/A', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B))),
                        ],
                      ),
                    ),
                  ],
                ),
                const Divider(height: 32, color: Color(0xFFF1F5F9)),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    _buildAmountInfo(rec),
                    if (canProcess)
                      Row(
                        children: [
                          if (_selectedTab == 'pending') ...[
                            _actionBtn(Icons.sync_rounded, Colors.orange, () => _handleUnderProcess(rec['id'])),
                            const SizedBox(width: 8),
                          ],
                          _actionBtn(Icons.check_rounded, const Color(0xFF10B981), () => _openTransferModal(rec)),
                          const SizedBox(width: 8),
                          _actionBtn(Icons.close_rounded, const Color(0xFFEF4444), () => _openRejectModal(rec)),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmountInfo(Map<String, dynamic> rec) {
    final details = rec['details'] ?? {};
    double gross = _cleanParse(details['executive_approved_amount'] ?? details['total_amount'] ?? rec['cost']);
    double adv = _cleanParse(details['total_advance_taken']);
    double wallet = _cleanParse(details['wallet_balance_used']);
    double net = gross - adv - wallet;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('NET PAYOUT', style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
        Text('₹${NumberFormat('#,##,###').format(net > 0 ? net : 0.0)}', style: GoogleFonts.plusJakartaSans(fontSize: 22, fontWeight: FontWeight.w900, color: const Color(0xFFBB0633))),
        if (adv > 0 || wallet > 0)
          Text('Gross: ₹${gross.toStringAsFixed(0)} | Adv: ₹${adv.toStringAsFixed(0)}', style: GoogleFonts.inter(fontSize: 9, color: Colors.grey)),
      ],
    );
  }

  Widget _actionBtn(IconData icon, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap, borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
        child: Icon(icon, color: color, size: 18),
      ),
    );
  }

  Widget _infoChip(IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        mainAxisSize: MainAxisSize.min, 
        children: [
          Icon(icon, size: 12, color: const Color(0xFF94A3B8)), 
          const SizedBox(width: 6), 
          Flexible(
            child: Text(
              label, 
              style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w800, color: const Color(0xFF475569)),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          )
        ]
      ),
    );
  }

  Widget _statusBadge(String status) {
    String s = status.toUpperCase();
    Color c = s.contains('PAID') || s.contains('COMPLETED') ? const Color(0xFF10B981) : (s.contains('REJECT') ? const Color(0xFFEF4444) : const Color(0xFF3B82F6));
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
      child: Text(s.replaceAll('_', ' '), style: GoogleFonts.plusJakartaSans(fontSize: 8.5, fontWeight: FontWeight.w900, color: c)),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(top: 60),
        child: Column(
          children: [
            const Icon(Icons.inbox_rounded, size: 48, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 16),
            Text('No records found', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
          ],
        ),
      ),
    );
  }

  double _cleanParse(dynamic val) {
    if (val == null) return 0.0;
    return double.tryParse(val.toString().replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
  }

  void _openTransferModal(Map<String, dynamic> rec) {
    String mode = 'NEFT';
    String txId = '';
    String remarks = '';
    DateTime transferDate = DateTime.now();

    final details = rec['details'] ?? {};
    double gross = _cleanParse(details['executive_approved_amount'] ?? details['total_amount'] ?? rec['cost']);
    double adv = _cleanParse(details['total_advance_taken']);
    double wallet = _cleanParse(details['wallet_balance_used']);
    double net = gross - adv - wallet;
    double finalAmt = net > 0 ? net : 0.0;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModal) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(context).viewInsets.bottom + 24),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.1), shape: BoxShape.circle),
                      child: const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF10B981), size: 24),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      'Fund Transfer Details',
                      style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A)),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('TRANSFER TO', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
                            const SizedBox(height: 4),
                            Text(
                              rec['requester']?.toString().toUpperCase() ?? 'EMPLOYEE',
                              style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w900, color: const Color(0xFFBB0633)),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Text('AMOUNT', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8))),
                          const SizedBox(height: 4),
                          Text(
                            '₹${NumberFormat('#,##,###').format(finalAmt)}',
                            style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w900, color: const Color(0xFF10B981)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                if (finalAmt > 0) ...[
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('MODE OF PAYMENT', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF64748B))),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                              decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: mode,
                                  isExpanded: true,
                                  icon: const Icon(Icons.keyboard_arrow_down_rounded, color: Color(0xFF64748B)),
                                  items: ['NEFT', 'Bank Transfer', 'UPI', 'Cash'].map((e) => DropdownMenuItem(value: e, child: Text(e, style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13)))).toList(),
                                  onChanged: (v) => setModal(() => mode = v!),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('TRANSFER DATE', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF64748B))),
                            const SizedBox(height: 8),
                            GestureDetector(
                              onTap: () async {
                                final picked = await showDatePicker(
                                  context: context,
                                  initialDate: transferDate,
                                  firstDate: DateTime(2000),
                                  lastDate: DateTime(2100),
                                  builder: (context, child) => Theme(
                                    data: Theme.of(context).copyWith(colorScheme: const ColorScheme.light(primary: Color(0xFFBB0633))),
                                    child: child!,
                                  ),
                                );
                                if (picked != null) setModal(() => transferDate = picked);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(DateFormat('dd-MM-yyyy').format(transferDate), style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13)),
                                    const Icon(Icons.calendar_today_rounded, size: 16, color: Color(0xFF64748B)),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (mode != 'Cash') ...[
                    const SizedBox(height: 20),
                    Text('TRANSACTION ID / REFERENCE', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF64748B))),
                    const SizedBox(height: 8),
                    TextField(
                      onChanged: (v) => txId = v,
                      style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
                      decoration: InputDecoration(
                        hintText: 'Enter NEFT Ref or UPI ID',
                        hintStyle: GoogleFonts.inter(color: Colors.grey[400], fontSize: 13),
                        filled: true,
                        fillColor: const Color(0xFFF1F5F9),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      ),
                    ),
                  ],
                ] else ...[
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: const Color(0xFFCCFBF1)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.check_circle_rounded, color: Color(0xFF0D9488), size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Fully Adjusted from Advance',
                                style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w800, color: const Color(0xFF115E59)),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                'This claim is completely covered by the employee\'s existing advance balance. No bank transfer is required.',
                                style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF134E4A), height: 1.4),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 20),
                Text('REMARKS', style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF64748B))),
                const SizedBox(height: 8),
                TextField(
                  onChanged: (v) => remarks = v,
                  style: GoogleFonts.plusJakartaSans(fontSize: 13, fontWeight: FontWeight.w600),
                  decoration: InputDecoration(
                    hintText: 'Add payment notes...',
                    hintStyle: GoogleFonts.inter(color: Colors.grey[400], fontSize: 13),
                    filled: true,
                    fillColor: const Color(0xFFF1F5F9),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(
                      child: TextButton(
                        onPressed: () => Navigator.pop(context),
                        style: TextButton.styleFrom(
                          backgroundColor: const Color(0xFF0F172A),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        ),
                        child: Text('Cancel', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w800)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ElevatedButton(
                        onPressed: () async {
                          Navigator.pop(context);
                          await _tripService.performApproval(rec['id'], 'Transfer', extraData: {
                            'payment_mode': mode,
                            'transaction_id': txId,
                            'remarks': remarks,
                            'payment_date': DateFormat('yyyy-MM-dd').format(transferDate),
                          });
                          _fetchFinanceData();
                        },
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFBB0633),
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          elevation: 0,
                        ),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                              const SizedBox(width: 8),
                              Text(finalAmt > 0 ? 'Confirm Transfer' : 'Confirm Reconciliation', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w800)),
                            ],
                          ),
                        ),
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

  void _openRejectModal(Map<String, dynamic> rec) {
    String reason = '';
    showModalBottomSheet(
      context: context, isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.of(context).viewInsets.bottom + 24),
        child: Column(
          mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Reject Request', style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.red)),
            const SizedBox(height: 20),
            TextField(onChanged: (v) => reason = v, decoration: const InputDecoration(labelText: 'Reason for Rejection')),
            const SizedBox(height: 24),
            SizedBox(width: double.infinity, child: ElevatedButton(
              onPressed: () async {
                if (reason.isEmpty) return;
                Navigator.pop(context);
                await _tripService.performApproval(rec['id'], 'RejectByFinance', extraData: {'remarks': reason});
                _fetchFinanceData();
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, padding: const EdgeInsets.all(16)),
              child: Text('CONFIRM REJECTION', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w800)),
            )),
          ],
        ),
      ),
    );
  }
}
