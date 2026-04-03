import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:path_provider/path_provider.dart';
import '../services/trip_service.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';
import 'travel_story_screen.dart';
import 'package:open_filex/open_filex.dart';

class LocalTravelScreen extends StatefulWidget {
  final VoidCallback? onUploadComplete;
  const LocalTravelScreen({super.key, this.onUploadComplete});

  @override
  State<LocalTravelScreen> createState() => _LocalTravelScreenState();
}

class _LocalTravelScreenState extends State<LocalTravelScreen> {
  final _formKey = GlobalKey<FormState>();
  final TripService _tripService = TripService();
  final ApiService _apiService = ApiService();

  final TextEditingController _purposeController = TextEditingController();
  final TextEditingController _projectController = TextEditingController(
    text: 'General',
  );
  String _baseLocation = 'Vijayawada';
  String _baseLocationCode = 'VIJ';

  String _selectedMonth = DateFormat('yyyy-MM').format(DateTime.now());
  bool _isLoading = false;
  bool _isDetectingManager = true;
  String _reportingManagerName = 'Loading...';
  String? _reportingManagerId;
  File? _selectedFile;
  bool _policyAccepted = false;

  @override
  void initState() {
    super.initState();
    _updatePurposeFromMonth(_selectedMonth);
    _detectManager();
  }

  void _updatePurposeFromMonth(String yearMonth) {
    try {
      final parts = yearMonth.split('-');
      final year = int.parse(parts[0]);
      final month = int.parse(parts[1]);
      final date = DateTime(year, month, 1);
      final monthAbbr = DateFormat('MMM').format(date).toUpperCase();
      final yearShort = year.toString().substring(2);
      _purposeController.text = 'MMU ITS $monthAbbr$yearShort';
    } catch (e) {
      _purposeController.text = 'MMU INSPECTION TRAVEL SCHEDULE';
    }
  }

  String _normalizeId(dynamic id) {
    if (id == null) return '';
    return id
        .toString()
        .toLowerCase()
        .trim()
        .replaceAll(RegExp(r'^[a-z]+-?'), '')
        .replaceAll(RegExp(r'^0+'), '');
  }

  Future<void> _detectManager() async {
    final user = _apiService.getUser();
    if (user == null) return;
    final myId = _normalizeId(user['employee_id'] ?? user['username']);

    try {
      final empRes = await _tripService.getReportingManager();
      final allEmps = (empRes['results'] as List? ?? [])
          .cast<Map<String, dynamic>>();

      final systemUsersRes = await _tripService.fetchUsers();
      final systemUsers = systemUsersRes.cast<Map<String, dynamic>>();

      final me = allEmps.firstWhere(
        (e) => _normalizeId(e['employee']?['employee_code']) == myId,
        orElse: () => {},
      );

      if (me.isNotEmpty) {
        final locName = me['office']?['name'] ?? 'Vijayawada';
        setState(() {
          _baseLocation = locName;
          _baseLocationCode = locName.length >= 3
              ? locName.substring(0, 3).toUpperCase()
              : 'VIJ';
        });
        // Auto-fill project from employee profile
        final projectName = me['project']?['name'] ?? '';
        if (projectName.isNotEmpty) {
          final numMatch = RegExp(r'(\d+)').firstMatch(projectName);
          if (numMatch != null) {
            _projectController.text = 'PROJ-${numMatch.group(1)}';
          } else {
            _projectController.text = projectName
                .toString()
                .toUpperCase()
                .substring(
                  0,
                  projectName.toString().length >= 6
                      ? 6
                      : projectName.toString().length,
                );
          }
        }

        if (me['position']?['reporting_to'] != null &&
            (me['position']['reporting_to'] as List).isNotEmpty) {
          final managerInfo = me['position']['reporting_to'][0];
          final managerCode =
              managerInfo['employee_code'] ?? managerInfo['employee_id'];

          final systemMgr = systemUsers.firstWhere(
            (u) => _normalizeId(u['employee_id']) == _normalizeId(managerCode),
            orElse: () => {},
          );

          if (systemMgr.isNotEmpty) {
            setState(() {
              _reportingManagerId = systemMgr['id'].toString();
              _reportingManagerName = systemMgr['name'] ?? 'Assigned Manager';
              _isDetectingManager = false;
            });
          } else {
            setState(() {
              _reportingManagerName = 'Routing Automatically';
              _isDetectingManager = false;
            });
          }
        } else {
          setState(() {
            _reportingManagerName = 'Routing Automatically';
            _isDetectingManager = false;
          });
        }
      } else {
        setState(() {
          _reportingManagerName = 'Profile Missing';
          _isDetectingManager = false;
        });
      }
    } catch (e) {
      setState(() {
        _reportingManagerName = 'Error detecting manager';
        _isDetectingManager = false;
      });
    }
  }

  Future<void> _pickFile() async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: ['xlsx', 'xls'],
    );
    if (result != null && result.files.single.path != null) {
      setState(() => _selectedFile = File(result.files.single.path!));
    }
  }

  String _buildTemplateFilename() {
    try {
      final parts = _selectedMonth.split('-');
      final year = int.parse(parts[0]);
      final month = int.parse(parts[1]);
      final date = DateTime(year, month, 1);
      final monthAbbr = DateFormat('MMM').format(date).toUpperCase();
      final yearShort = year.toString().substring(2);
      final project = _projectController.text.isNotEmpty
          ? _projectController.text
          : 'GENERAL';
      return 'ITS-$project-$_baseLocationCode-$monthAbbr$yearShort.xlsx';
    } catch (_) {
      return 'ITS-template.xlsx';
    }
  }

  Future<void> _downloadTemplate() async {
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Downloading template...'),
          duration: Duration(seconds: 2),
        ),
      );
      final bytes = await _tripService.downloadBulkTemplate();
      final directory = await getApplicationDocumentsDirectory();
      final filename = _buildTemplateFilename();
      final filePath = '${directory.path}/$filename';
      final file = File(filePath);
      await file.writeAsBytes(bytes);

      if (mounted) {
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Template saved: $filename'),
            backgroundColor: Colors.green,
            duration: const Duration(seconds: 5),
            action: SnackBarAction(
              label: 'OPEN',
              textColor: Colors.white,
              onPressed: () => OpenFilex.open(filePath),
            ),
          ),
        );

        // Auto-open for better UX
        await OpenFilex.open(filePath);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (_selectedFile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please upload the activities file'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (!_policyAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You must accept the travel policy to proceed'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    // Calculate start/end date for the month
    final parts = _selectedMonth.split('-');
    final year = int.parse(parts[0]);
    final month = int.parse(parts[1]);
    final startDate = DateTime(year, month, 1);
    final endDate = DateTime(year, month + 1, 0);

    final payload = {
      'source': _baseLocation,
      'destination': _baseLocation,
      'start_date': DateFormat('yyyy-MM-dd').format(startDate),
      'end_date': DateFormat('yyyy-MM-dd').format(endDate),
      'composition': 'Solo',
      'purpose': _purposeController.text.toUpperCase(),
      'travel_mode': 'Car / Jeep / Van',
      'project_code': _projectController.text,
      'consider_as_local': true,
      if (_reportingManagerId != null)
        'reporting_manager': int.tryParse(_reportingManagerId!),
    };

    try {
      final trip = await _tripService.createTrip(payload);

      // Upload the activities file
      try {
        await _tripService.uploadBulkLocalConveyance(
          trip.tripId,
          _selectedFile!,
        );
      } catch (uploadError) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Trip created, but file upload failed: $uploadError',
              ),
              backgroundColor: Colors.orange,
            ),
          );
        }
      }

      if (mounted) {
        setState(() => _isLoading = false);
        _showSuccessDialog(trip.tripId);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  void _showSuccessDialog(String tripId) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF10B981),
                size: 64,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Tour Plan Created!',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w900,
                fontSize: 20,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Tour plan request submitted.\nID: $tripId',
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context); // Dialog
                Navigator.pop(context); // Screen
                if (widget.onUploadComplete != null) {
                  widget.onUploadComplete!();
                }
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => TravelStoryScreen(tripId: tripId),
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 14,
                ),
              ),
              child: const Text(
                'VIEW STORY',
                style: TextStyle(color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          'New Tour Plan',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFFA9052E),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildInfoCard(),
                  const SizedBox(height: 32),
                  _sectionLabel('Business Objective / Purpose'),
                  _buildTextField(
                    controller: _purposeController,
                    hint:
                        'STATE THE BUSINESS OBJECTIVE FOR THIS MONTH\'S TRAVEL...',
                    maxLines: 2,
                    enabled: false,
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 24),
                  _sectionLabel('Project Code'),
                  _buildTextField(
                    controller: _projectController,
                    hint: 'General',
                    enabled: false,
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 24),
                  _sectionLabel('Target Month'),
                  _buildMonthPicker(),
                  const SizedBox(height: 32),
                  _buildFileUploadSection(),
                  const SizedBox(height: 24),
                  _buildPolicyCheckbox(),
                  const SizedBox(height: 40),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFFBB0633),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        elevation: 4,
                      ),
                      child: _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Text(
                              'INITIATE TOUR PLAN SETTLEMENT',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                                fontSize: 13,
                              ),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, left: 4),
      child: Text(
        text,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w800,
          color: const Color(0xFF64748B),
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    int maxLines = 1,
    bool enabled = true,
    String? Function(String?)? validator,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: enabled
            ? Colors.white
            : const Color(0xFFF1F5F9).withOpacity(0.5),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: TextFormField(
        controller: controller,
        maxLines: maxLines,
        enabled: enabled,
        validator: validator,
        style: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF0F172A),
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.plusJakartaSans(
            color: const Color(0xFF94A3B8),
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.all(20),
        ),
      ),
    );
  }

  Widget _buildMonthPicker() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedMonth,
          isExpanded: true,
          items: List.generate(13, (index) {
            final now = DateTime.now();
            final date = DateTime(now.year, now.month + index, 1);
            final val = DateFormat('yyyy-MM').format(date);
            final display = DateFormat('MMMM yyyy').format(date);
            return DropdownMenuItem(
              value: val,
              child: Text(
                display,
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700),
              ),
            );
          }),
          onChanged: (v) {
            if (v != null) {
              setState(() => _selectedMonth = v);
              _updatePurposeFromMonth(v);
            }
          },
        ),
      ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFF0F1E2A), const Color(0xFF1E293B)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        children: [
          _infoRow(
            Icons.person_outline,
            'Requestor',
            _apiService.getUser()?['name'] ?? 'Self',
          ),
          const Divider(color: Colors.white12, height: 24),
          _infoRow(
            Icons.account_tree_outlined,
            'Reporting to',
            _reportingManagerName,
          ),
          const Divider(color: Colors.white12, height: 24),
          _infoRow(
            Icons.directions_car_outlined,
            'Travel Mode',
            'Car / Jeep / Van (Local)',
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Icon(icon, color: Colors.white60, size: 20),
        const SizedBox(width: 12),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white60,
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
            Text(
              value,
              style: GoogleFonts.plusJakartaSans(
                color: Colors.white,
                fontSize: 13,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFileUploadSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
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
          Text(
            'Activity Log Upload',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blue.withOpacity(0.1)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.info_outline, color: Colors.blue, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Monthly tour plans require a validated bulk upload of daily activities.',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          color: Colors.blue.shade900,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 8),
                      GestureDetector(
                        onTap: _downloadTemplate,
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: const Color(0xFF10B981).withOpacity(0.3),
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.download_rounded,
                                color: Color(0xFF059669),
                                size: 16,
                              ),
                              const SizedBox(width: 6),
                              Flexible(
                                child: Text(
                                  'Download ${_buildTemplateFilename()}',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 11,
                                    color: const Color(0xFF059669),
                                    fontWeight: FontWeight.w700,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          InkWell(
            onTap: _pickFile,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: const Color(0xFFCBD5E1),
                  style: BorderStyle.solid,
                ),
              ),
              child: Center(
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _selectedFile != null
                            ? const Color(0xFF10B981).withOpacity(0.1)
                            : Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.05),
                            blurRadius: 10,
                          ),
                        ],
                      ),
                      child: Icon(
                        _selectedFile != null
                            ? Icons.check_circle_rounded
                            : Icons.upload_file_rounded,
                        color: _selectedFile != null
                            ? const Color(0xFF10B981)
                            : const Color(0xFF64748B),
                        size: 24,
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      _selectedFile != null
                          ? _selectedFile!.path.split('/').last.split('\\').last
                          : 'Tap to upload activities (.xlsx)',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: _selectedFile != null
                            ? const Color(0xFF10B981)
                            : const Color(0xFF475569),
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPolicyCheckbox() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _policyAccepted
            ? const Color(0xFFF1F8FF)
            : const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: _policyAccepted
              ? const Color(0xFFBFDBFE)
              : const Color(0xFFFED7AA),
        ),
      ),
      child: CheckboxListTile(
        value: _policyAccepted,
        onChanged: (val) => setState(() => _policyAccepted = val ?? false),
        title: Text(
          'I accept the Travel & Expense Policy',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: _policyAccepted
                ? const Color(0xFF1E3A8A)
                : const Color(0xFF9A3412),
          ),
        ),
        controlAffinity: ListTileControlAffinity.leading,
        contentPadding: EdgeInsets.zero,
        activeColor: const Color(0xFF3B82F6),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
      ),
    );
  }
}
