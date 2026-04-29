import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import '../services/trip_service.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';
import 'travel_story_screen.dart';
import 'role_based_dashboard.dart';
import 'my_trips_screen.dart';
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
  final TextEditingController _projectController = TextEditingController();
  String _baseLocation = 'Vijayawada';
  String _baseLocationCode = 'VIJ';
  String _positionCode = 'EMP';
  List<Map<String, dynamic>> _projectList = [];
  bool _isLoadingProjects = false;

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
    _initFromSession();
    _updatePurposeFromMonth(_selectedMonth);
    _detectManager();
    _fetchProjects();
  }

  void _initFromSession() {
    final user = _apiService.getUser();
    final profile = user?['external_profile'];

    if (profile != null) {
      final String projectName = (profile['project']?['name'] ?? '').toString();
      String projectCode = (profile['project']?['code'] ?? '').toString();

      if (projectCode.isEmpty && projectName.isNotEmpty) {
        final numMatch = RegExp(r'(\d+)').firstMatch(projectName);
        projectCode = numMatch != null
            ? 'PROJ-${numMatch.group(1)}'
            : projectName.length > 6
            ? projectName.substring(0, 6).toUpperCase()
            : projectName.toUpperCase();
      }

      if (projectCode.isNotEmpty) {
        setState(() {
          _projectController.text = projectCode;
        });
      }

      // Pre-set location and position code from session if available
      final String? locName = profile['office']?['name']?.toString();
      if (locName != null) {
        _baseLocation = locName;
        _baseLocationCode = locName.length >= 3
            ? locName.substring(0, 3).toUpperCase()
            : 'VIJ';
      }

      final String? positionName = profile['position']?['name']?.toString();
      if (positionName != null) {
        final words = positionName
            .split(' ')
            .where((String w) => w.trim().isNotEmpty)
            .toList();
        if (words.isNotEmpty) {
          final firstWord = words[0];
          if (firstWord.length <= 3) {
            _positionCode = firstWord.toUpperCase();
          } else {
            _positionCode = words
                .map((String w) => w.isNotEmpty ? w[0] : '')
                .join('')
                .toUpperCase();
          }
        }
      }
    }
  }

  Future<void> _fetchProjects() async {
    setState(() => _isLoadingProjects = true);
    try {
      final projects = await _tripService.fetchProjects();
      setState(() {
        _projectList = projects;
        _isLoadingProjects = false;
      });
    } catch (e) {
      setState(() => _isLoadingProjects = false);
    }
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

    // Exact same ID extraction as ProfilePage for consistency
    final empId = user['employee_id'] ?? user['username'] ?? '';
    final myIdNormalized = _normalizeId(empId);

    try {
      // Background refresh of employee profile (similar to ProfilePage background refresh)
      final response = await _apiService.get(
        '${ApiConstants.baseUrl}/api/employees/?employee_code=${Uri.encodeComponent(empId.toString())}',
      );

      final systemUsers = (await _tripService.fetchUsers())
          .cast<Map<String, dynamic>>();

      List<dynamic> results = [];
      if (response is Map && response.containsKey('results')) {
        results = response['results'];
      }

      dynamic me;
      if (results.isNotEmpty) {
        final searchId = empId.toString().toLowerCase();
        final searchName = (user['name'] ?? '').toString().toLowerCase();

        for (var emp in results) {
          final code =
              (emp['employee_code'] ?? emp['employee']?['employee_code'] ?? '')
                  .toString()
                  .toLowerCase();
          final name = (emp['name'] ?? emp['employee']?['name'] ?? '')
              .toString()
              .toLowerCase();

          if ((searchId.isNotEmpty && code == searchId) ||
              (searchName.isNotEmpty && name == searchName)) {
            me = emp;
            break;
          }
        }
        me ??= results.first;
      }

      if (me != null) {
        final String locName = (me['office']?['name'] ?? 'Vijayawada')
            .toString();
        setState(() {
          _baseLocation = locName;
          _baseLocationCode = locName.length >= 3
              ? locName.substring(0, 3).toUpperCase()
              : 'VIJ';
        });

        // Derive Position Code (matches Profile detail logic)
        final String positionName = (me['position']?['name'] ?? 'Employee')
            .toString();
        final words = positionName
            .split(' ')
            .where((String w) => w.trim().isNotEmpty)
            .toList();
        if (words.isNotEmpty) {
          final firstWord = words[0];
          if (firstWord.length <= 3) {
            _positionCode = firstWord.toUpperCase();
          } else {
            _positionCode = words
                .map((String w) => w.isNotEmpty ? w[0] : '')
                .join('')
                .toUpperCase();
          }
        }

        // Project Resolution (Matches ProfilePage's derivedProjectCode logic)
        final String projectName = (me['project']?['name'] ?? '').toString();
        String projectCode = (me['project']?['code'] ?? '').toString();

        if (projectCode.isEmpty && projectName.isNotEmpty) {
          final numMatch = RegExp(r'(\d+)').firstMatch(projectName);
          projectCode = numMatch != null
              ? 'PROJ-${numMatch.group(1)}'
              : projectName.length > 6
              ? projectName.substring(0, 6).toUpperCase()
              : projectName.toUpperCase();
        }

        if (projectCode.isNotEmpty) {
          _projectController.text = projectCode;
        }

        // Manager Logic
        if (me['position']?['reporting_to'] != null &&
            (me['position']['reporting_to'] as List).isNotEmpty) {
          final managerInfo = me['position']['reporting_to'][0];
          final managerCode =
              managerInfo['employee_code'] ?? managerInfo['employee_id'];

          final systemMgr = systemUsers.firstWhere(
            (u) =>
                _normalizeId(u['employee_id']) == _normalizeId(managerCode) ||
                _normalizeId(u['username']) == _normalizeId(managerCode),
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
      if (mounted) {
        setState(() {
          _reportingManagerName = 'Error detecting manager';
          _isDetectingManager = false;
        });
      }
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
      return 'ITS-$project-$_positionCode-$monthAbbr$yearShort.xlsx';
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
                color: const Color(0xFF0D9488).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF0D9488),
                size: 64,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Tour Plan Created!',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w900,
                fontSize: 20,
                color: const Color(0xFF134E4A),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Tour plan request submitted.\nID: $tripId',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: const Color(0xFF64748B),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(
                      builder: (context) => const MyTripsScreen(),
                    ),
                    (route) => route.isFirst,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF134E4A),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                child: Text(
                  'GO TO MY TRIPS',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    color: Colors.white,
                    fontSize: 14,
                  ),
                ),
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
            fontWeight: FontWeight.w900,
            color: Colors.white,
            letterSpacing: 0.5,
          ),
        ),
        flexibleSpace: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
        ),
        iconTheme: const IconThemeData(color: Colors.white),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.help_outline_rounded),
            onPressed: () => Navigator.pushNamed(context, '/help'),
          ),
        ],
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildTourPlanContextCard(),
                  const SizedBox(height: 24),
                  _buildActivityLogCard(),
                  const SizedBox(height: 24),
                  _buildPolicyAcceptanceCard(),
                  const SizedBox(height: 40),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : _handleSubmit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF134E4A),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(18),
                        ),
                        elevation: 8,
                        shadowColor: const Color(0xFF134E4A).withOpacity(0.3),
                      ),
                      child: _isLoading
                          ? const CircularProgressIndicator(color: Colors.white)
                          : Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Icon(
                                  Icons.description_outlined,
                                  size: 20,
                                  color: Colors.white,
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  'SEND ITS FOR APPROVAL',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    fontSize: 13,
                                    letterSpacing: 1,
                                  ),
                                ),
                              ],
                            ),
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTourPlanContextCard() {
    return _premiumCard(
      title: 'Tour Plan Context',
      icon: Icons.business_center_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _sectionLabel('Traveler Detail (Auto-Filled)'),
          _buildTravelerDetail(),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('Settlement Month'),
                    _buildMonthPicker(),
                  ],
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionLabel('Project Code'),
                    _buildTextField(
                      controller: _projectController,
                      hint: 'Project Code',
                      enabled: false,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildDownloadTemplateButton(),
          const SizedBox(height: 24),
          _sectionLabel('Business Objective / Purpose'),
          _buildTextField(
            controller: _purposeController,
            hint: 'STATE THE BUSINESS OBJECTIVE FOR THIS MONTH\'S TRAVEL...',
            maxLines: 2,
            enabled: false,
            forceUpperCase: true,
            validator: (v) => v!.isEmpty ? 'Required' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildActivityLogCard() {
    return _premiumCard(
      title: 'Activity Log Upload',
      icon: Icons.list_alt_rounded,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildComplianceInfoBox(),
          const SizedBox(height: 16),
          _buildFileUploadZone(),
          const SizedBox(height: 16),
          _buildComplianceReminder(),
        ],
      ),
    );
  }

  Widget _buildPolicyAcceptanceCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: _buildPolicyCheckbox(),
    );
  }

  Widget _buildTravelerDetail() {
    final user = _apiService.getUser();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF0D9488).withOpacity(0.1),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.person_outline_rounded,
              color: Color(0xFF0D9488),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user?['name'] ?? 'Loading...',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        'ID: ${user?['employee_id'] ?? 'N/A'}',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ),
                    Text(
                      '• Self Service Mode',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w600,
                      ),
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

  Widget _buildDownloadTemplateButton() {
    return InkWell(
      onTap: _downloadTemplate,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFD1FAE5)),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFD1FAE5),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.download_rounded,
                color: Color(0xFF059669),
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                'Download ${_buildTemplateFilename()}',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF059669),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComplianceInfoBox() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDFA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFCCFBF1)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            color: Color(0xFF0D9488),
            size: 18,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Monthly tour plans require a validated bulk upload of day to day activities.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    color: const Color(0xFF134E4A),
                    fontWeight: FontWeight.w700,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'Need the Activity Log Template? You can download it from the Help & Support page.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    color: const Color(0xFF0D9488).withOpacity(0.8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFileUploadZone() {
    return InkWell(
      onTap: _pickFile,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 32),
        decoration: BoxDecoration(
          color: _selectedFile != null
              ? const Color(0xFFF0FDF4)
              : const Color(0xFFFAFAFA),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: _selectedFile != null
                ? const Color(0xFFBBF7D0)
                : const Color(0xFFF1F5F9),
            width: 2,
          ),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: _selectedFile != null
                    ? Colors.white
                    : const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: Icon(
                _selectedFile != null
                    ? Icons.check_circle_rounded
                    : Icons.cloud_upload_outlined,
                color: _selectedFile != null
                    ? const Color(0xFF22C55E)
                    : const Color(0xFF94A3B8),
                size: 32,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _selectedFile != null
                  ? _selectedFile!.path.split('/').last
                  : 'Upload Log File',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF475569),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              _selectedFile != null
                  ? 'Ready to Upload • ${(_selectedFile!.lengthSync() / 1024).toStringAsFixed(1)} KB'
                  : 'XLSX or XLS Only',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: _selectedFile != null
                    ? const Color(0xFF16A34A)
                    : const Color(0xFF94A3B8),
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComplianceReminder() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFEF3C7)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Color(0xFFD97706),
            size: 18,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'COMPLIANCE REMINDER',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF92400E),
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Activity dates must fall within the selected month.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    color: const Color(0xFF92400E),
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _premiumCard({
    required String title,
    required IconData icon,
    required Widget child,
  }) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 25,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 20, color: const Color(0xFF134E4A)),
              const SizedBox(width: 12),
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF134E4A),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          child,
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
    bool forceUpperCase = false,
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
        maxLines: maxLines, // Use the provided maxLines, not forced null
        enabled: enabled,
        validator: validator,
        textCapitalization: forceUpperCase
            ? TextCapitalization.characters
            : TextCapitalization.none,
        inputFormatters: forceUpperCase ? [UpperCaseTextFormatter()] : [],
        style: GoogleFonts.plusJakartaSans(
          fontSize: controller.text.length > 10 ? 12 : 14,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF0F172A),
        ),
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: GoogleFonts.plusJakartaSans(
            color: const Color(0xFF94A3B8),
            fontSize: 14,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: BorderSide.none,
          ),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 16,
          ),
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

class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}
