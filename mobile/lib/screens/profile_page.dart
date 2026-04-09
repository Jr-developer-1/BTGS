import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import 'login_screen.dart';
import '../services/frs_service.dart';
import 'frs_enrollment_screen.dart';
import 'change_password_screen.dart';
import 'help_support_screen.dart';
import 'debug_logs_screen.dart';
import '../constants/module_constants.dart';
import '../components/responsive_image.dart';

class ProfilePage extends StatefulWidget {
  final String username;
  const ProfilePage({super.key, required this.username});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final ApiService _apiService = ApiService();
  bool _isLoading = true;
  Map<String, dynamic>? _profileData;
  Map<String, dynamic>? _userData;
  final FrsService _frsService = FrsService();

  @override
  void initState() {
    super.initState();
    _userData = _apiService.getUser();
    // Show UI immediately if we have ANY basic data from the session
    if (_userData != null) {
      _isLoading = false;
      if (_userData!['external_profile'] != null) {
        _profileData = _userData!['external_profile'];
      }
    }
    _initProfile();
  }

  Future<void> _initProfile() async {
    // If we already have some data, don't show the blocker loader
    if (_userData != null && mounted) {
      setState(() => _isLoading = false);
    }

    // Perform background refresh without blocking the initial UI render
    _runBackgroundRefresh();
  }

  Future<void> _runBackgroundRefresh() async {
    try {
      final freshUser = await _refreshUserData();
      if (freshUser != null) {
        await _fetchDetailedProfile();
      } else {
        // If auth/profile refresh fails, still attempt to fetch the detailed employee profile
        await _fetchDetailedProfile();
      }
      if (mounted) setState(() => _isLoading = false);
    } catch (e) {
      debugPrint("Background refresh failed: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<Map<String, dynamic>?> _refreshUserData() async {
    try {
      final freshUser = await _apiService.fetchFreshUser();
      if (mounted) {
        setState(() {
          _userData = freshUser;
        });
      }
      return freshUser;
    } catch (e) {
      debugPrint("Failed to refresh user data: $e");
      return null;
    }
  }

  Future<void> _fetchDetailedProfile() async {
    try {
      final empId = _userData?['employee_id'] ?? _userData?['username'] ?? widget.username;
      if (empId == null || empId.toString().isEmpty) {
        return;
      }

      final response = await _apiService.get(
        '/api/employees/?employee_code=${Uri.encodeComponent(empId.toString())}',
      );

      List<dynamic> results = [];
      if (response is Map && response.containsKey('results')) {
        results = response['results'];
      }

      dynamic matchedEmployee;
      if (results.isNotEmpty) {
        final searchId = empId.toString().toLowerCase();
        final searchName = (_userData?['name'] ?? widget.username).toString().toLowerCase();

        for (var emp in results) {
          final code = (emp['employee_code'] ?? emp['employee']?['employee_code'] ?? '').toString().toLowerCase();
          final name = (emp['name'] ?? emp['employee']?['name'] ?? '').toString().toLowerCase();

          if ((searchId.isNotEmpty && code == searchId) || (searchName.isNotEmpty && name == searchName)) {
            matchedEmployee = emp;
            break;
          }
        }
        matchedEmployee ??= results.first;
      }

      if (mounted) {
        setState(() {
          _profileData = matchedEmployee ?? _userData?['external_profile'];
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Profile fetch error: $e");
      if (mounted) {
        setState(() {
          if (_profileData == null && _userData != null && _userData!['external_profile'] != null) {
            _profileData = _userData!['external_profile'];
          }
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final employeeName =
        _profileData?['name'] ??
        _profileData?['employee']?['name'] ??
        _userData?['name'] ??
        widget.username;
    final employeeCode =
        _profileData?['employee_code'] ??
        _profileData?['employee']?['employee_code'] ??
        _userData?['username'] ??
        widget.username;
    final photo = _profileData?['photo'] ?? _profileData?['employee']?['photo'];
    final phone =
        _profileData?['phone'] ??
        _profileData?['employee']?['phone'] ??
        _userData?['phone'] ??
        '';
    final email =
        _profileData?['email'] ??
        _profileData?['employee']?['email'] ??
        _userData?['email'] ??
        '';

    final designation =
        _profileData?['role'] ??
        _profileData?['position']?['name'] ??
        _userData?['external_profile']?['position']?['name'] ??
        _userData?['designation'] ??
        _userData?['role'] ??
        '';
    final department =
        _profileData?['department'] ??
        _profileData?['position']?['department'] ??
        _userData?['external_profile']?['position']?['department'] ??
        _userData?['department'] ??
        '';
    final section =
        _profileData?['section'] ??
        _profileData?['position']?['section'] ??
        _userData?['external_profile']?['position']?['section'] ??
        '';
    List<dynamic> managers =
        _profileData?['positions_details']?[0]?['reporting_to'] ??
        _profileData?['reporting_to'] ??
        _profileData?['position']?['reporting_to'] ??
        _userData?['external_profile']?['positions_details']?[0]?['reporting_to'] ??
        _userData?['external_profile']?['reporting_to'] ??
        _userData?['external_profile']?['position']?['reporting_to'] ??
        [];

    if (managers.isEmpty) {
      if (_userData?['reporting_manager'] != null) {
        managers.add({'name': _userData!['reporting_manager'], 'role': 'Reporting Manager'});
      }
      if (_userData?['senior_manager'] != null) {
        managers.add({'name': _userData!['senior_manager'], 'role': 'Senior Manager'});
      }
      if (_userData?['hod_director'] != null) {
        managers.add({'name': _userData!['hod_director'], 'role': 'HOD / Director'});
      }
    }

    final projectName =
        _profileData?['project']?['name'] ??
        _userData?['external_profile']?['project']?['name'] ??
        '';

    String derivedProjectCode =
        _profileData?['project']?['code'] ??
        _userData?['external_profile']?['project']?['code'] ??
        '';

    if (derivedProjectCode.isEmpty && projectName.isNotEmpty) {
      final numMatch = RegExp(r'(\d+)').firstMatch(projectName);
      derivedProjectCode = numMatch != null
          ? 'PROJ-${numMatch.group(1)}'
          : projectName.length > 6
              ? projectName.substring(0, 6).toUpperCase()
              : projectName.toUpperCase();
    }

    final projectCode = derivedProjectCode;

    final officeName =
        _profileData?['office']?['name'] ??
        _userData?['external_profile']?['office']?['name'] ??
        '';
    final officeLevel =
        _profileData?['office']?['level']?.toString() ??
        _userData?['external_profile']?['office']?['level']?.toString() ??
        _userData?['office_level']?.toString() ??
        '';
    final district =
        _profileData?['office']?['geo_location']?['district'] ??
        _userData?['external_profile']?['office']?['geo_location']?['district'] ??
        '';
    final state =
        _profileData?['office']?['geo_location']?['state'] ??
        _userData?['external_profile']?['office']?['geo_location']?['state'] ??
        '';
    final country =
        _profileData?['office']?['geo_location']?['country'] ??
        _userData?['external_profile']?['office']?['geo_location']?['country'] ??
        '';

    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF0D9488)),
            )
          : Stack(
              children: [
                Positioned.fill(
                  child: Container(
                    decoration: const BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Color(0xFFFFFFFF), Color(0xFFF0FDFA)],
                      ),
                    ),
                  ),
                ),
                Positioned(
                  top: -150,
                  right: -100,
                  child: Container(
                    width: 500,
                    height: 500,
                    decoration: BoxDecoration(
                      gradient: RadialGradient(
                        colors: [
                          const Color(0xFF0D9488).withOpacity(0.04),
                          Colors.transparent,
                        ],
                      ),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
                RefreshIndicator(
                  onRefresh: _runBackgroundRefresh,
                  color: const Color(0xFF0D9488),
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverAppBar(
                        expandedHeight: 70,
                        floating: false,
                        pinned: true,
                        elevation: 0,
                        backgroundColor: Colors.white.withOpacity(0.9),
                        surfaceTintColor: Colors.transparent,
                        automaticallyImplyLeading: false,
                        flexibleSpace: FlexibleSpaceBar(
                          titlePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                          title: Text(
                            'MY PROFILE',
                            style: GoogleFonts.plusJakartaSans(
                              color: const Color(0xFF134E4A),
                              fontWeight: FontWeight.w900,
                              fontSize: 16,
                              letterSpacing: 1,
                            ),
                          ),
                          background: Container(color: Colors.white.withOpacity(0.5)),
                        ),
                      ),
                      SliverToBoxAdapter(
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(20, 10, 20, 40),
                          child: Column(
                            children: [
                              _buildPremiumIdentityCard(
                                employeeName,
                                designation,
                                employeeCode,
                                department,
                                email,
                                phone,
                                photo,
                              ),
                              const SizedBox(height: 24),
                              _buildInfoSection(
                                title: 'Organization',
                                icon: Icons.business_center_rounded,
                                color: const Color(0xFF0D9488),
                                children: [
                                  _buildInfoItem('Department', department),
                                  _buildInfoItem('Section', section),
                                  _buildInfoItem('Project Name', projectName),
                                  _buildInfoItem('Project Code', projectCode),
                                ],
                                managers: managers,
                              ),
                              const SizedBox(height: 16),
                              _buildInfoSection(
                                title: 'Location',
                                icon: Icons.location_on_rounded,
                                color: const Color(0xFF0D9488),
                                children: [
                                  _buildInfoItem('Office Name', officeName),
                                  _buildInfoItem('Base Level', officeLevel),
                                  _buildInfoItem('District', district),
                                  _buildInfoItem(
                                    'State, Country',
                                    '$state${state.isNotEmpty ? ", " : ""}$country',
                                  ),
                                ],
                              ),
                              const SizedBox(height: 32),
                              _buildFaceUpdateButton(),
                              if (ModuleConstants.normalizeRole(_userData?['role']) == 'admin') ...[
                                const SizedBox(height: 12),
                                _buildDiagnosticsButton(),
                              ],
                              const SizedBox(height: 12),
                              _buildLogoutButton(),
                              const SizedBox(height: 60),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildPremiumIdentityCard(
    String name,
    String role,
    String code,
    String dept,
    String email,
    String phone,
    String? photo,
  ) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.06),
            blurRadius: 30,
            offset: const Offset(0, 15),
          ),
        ],
      ),
      child: Column(
        children: [
          Stack(
            alignment: Alignment.topCenter,
            children: [
              Container(
                height: 120,
                width: double.infinity,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF134E4A), Color(0xFF0D9488)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 60),
                child: Stack(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(4),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF0D9488).withOpacity(0.2),
                            blurRadius: 20,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(60),
                        child: ResponsiveImage(
                          imageData: photo,
                          width: 110,
                          height: 110,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: 5,
                      right: 5,
                      child: Container(
                        width: 24,
                        height: 24,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                        ),
                        child: const Icon(Icons.check, color: Colors.white, size: 12),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Column(
              children: [
                Text(
                  name,
                  textAlign: TextAlign.center,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF134E4A),
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF0FDFA),
                    borderRadius: BorderRadius.circular(100),
                    border: Border.all(color: const Color(0xFFCCFBF1)),
                  ),
                  child: Text(
                    role.toUpperCase(),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      color: const Color(0xFF0D9488),
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                Wrap(
                  alignment: WrapAlignment.center,
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _idBadge(Icons.fingerprint_rounded, code),
                    _idBadge(Icons.account_tree_rounded, dept),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Divider(color: Color(0xFFF1F5F9), height: 1),
                ),
                _contactInfo(Icons.alternate_email_rounded, 'Personal Email', email),
                const SizedBox(height: 16),
                _contactInfo(Icons.phone_iphone_rounded, 'Mobile Contact', phone),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _idBadge(IconData icon, String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDFA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFCCFBF1)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: const Color(0xFF0D9488)),
          const SizedBox(width: 8),
          Text(
            text,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF134E4A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _contactInfo(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDFA),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFCCFBF1)),
          ),
          child: Icon(icon, size: 18, color: const Color(0xFF0D9488)),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label.toUpperCase(),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value.isEmpty ? '--' : value,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF134E4A),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildInfoSection({
    required String title,
    required IconData icon,
    required Color color,
    required List<Widget> children,
    List<dynamic>? managers,
  }) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDFA),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: const Color(0xFF0D9488)),
              ),
              const SizedBox(width: 12),
              Text(
                title.toUpperCase(),
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF134E4A),
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          ...children.expand((c) => [c, const SizedBox(height: 16)]).toList()..removeLast(),
          if (managers != null && managers.isNotEmpty) ...[
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: Divider(color: Color(0xFFF1F5F9)),
            ),
            Text(
              'REPORTING AUTHORITY',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF94A3B8),
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 20),
            ...managers.map((m) => _managerTile(m)).toList(),
          ],
        ],
      ),
    );
  }

  Widget _buildInfoItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value.isEmpty ? '--' : value,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF134E4A),
          ),
        ),
      ],
    );
  }

  Widget _managerTile(dynamic m) {
    final name = (m is Map ? (m['name'] ?? m['employee_name'] ?? 'Unknown') : 'Unknown').toString();
    final role = (m is Map ? (m['role'] ?? m['position_name'] ?? '') : '').toString();
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: const Color(0xFFF0FDFA),
            child: Text(
              name[0].toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFF0D9488),
                fontWeight: FontWeight.w900,
                fontSize: 14,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF134E4A),
                  ),
                ),
                if (role.isNotEmpty)
                  Text(
                    role,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      color: const Color(0xFF64748B),
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

  Widget _buildFaceUpdateButton() {
    final bool isFaceEnrolled = _userData?['is_face_enrolled'] == true;
    final bool isResetAllowed = _userData?['allow_photo_reset'] == true;
    final bool hasManager = _userData?['reporting_manager'] != null;
    final bool needsRequest = isFaceEnrolled && !isResetAllowed && hasManager;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        onTap: () => _handleFaceUpdateAction(!needsRequest),
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF134E4A), Color(0xFF0D9488)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0D9488).withOpacity(0.2),
                blurRadius: 15,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.face_retouching_natural_rounded, color: Colors.white, size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      !isFaceEnrolled ? 'Face Registration' : (needsRequest ? 'Request Update' : 'Re-enroll Face'),
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      !isFaceEnrolled ? 'Secure your session now' : 'Update your biometric data',
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white.withOpacity(0.8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 14),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLogoutButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        onTap: () {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
              title: Text(
                'SIGN OUT',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                  color: const Color(0xFF134E4A),
                  letterSpacing: 1,
                ),
              ),
              content: Text(
                'Are you sure you want to end your current session?',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: const Color(0xFF64748B),
                  fontWeight: FontWeight.w500,
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'CANCEL',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () async {
                    await _apiService.clearToken();
                    if (mounted) {
                      Navigator.of(context).pushAndRemoveUntil(
                        MaterialPageRoute(builder: (context) => const LoginScreen()),
                        (route) => false,
                      );
                    }
                  },
                  child: Text(
                    'LOGOUT',
                    style: GoogleFonts.plusJakartaSans(
                      color: const Color(0xFFEF4444),
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
          );
        },
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFFEE2E2)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444), size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Logout Session',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF134E4A),
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'Sign out of your account securely',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFFCBD5E1), size: 14),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDiagnosticsButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => const DebugLogsScreen())),
        borderRadius: BorderRadius.circular(24),
        child: Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.terminal_rounded, color: Color(0xFF64748B), size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'System Diagnostics',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF134E4A),
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'View technical logs and status',
                      style: GoogleFonts.plusJakartaSans(
                        color: const Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Color(0xFFCBD5E1), size: 14),
            ],
          ),
        ),
      ),
    );
  }

  void _handleFaceUpdateAction(bool isResetAllowed) async {
    if (isResetAllowed) {
      final result = await Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const FrsEnrollmentScreen()),
      );
      if (result == true) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Face updated successfully')),
          );
        }
      }
    } else {
      final TextEditingController reasonController = TextEditingController();
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
          title: Text(
            'REQUEST PHOTO UPDATE',
            style: GoogleFonts.plusJakartaSans(
              fontWeight: FontWeight.w900,
              fontSize: 18,
              color: const Color(0xFF134E4A),
              letterSpacing: 1,
            ),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Please provide a reason to reset your face data for manager approval.',
                style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF64748B), fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 20),
              TextField(
                controller: reasonController,
                style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF134E4A)),
                decoration: InputDecoration(
                  hintText: 'e.g., Changed appearance...',
                  hintStyle: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 14),
                  filled: true,
                  fillColor: const Color(0xFFF0FDFA),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFCCFBF1))),
                ),
                maxLines: 4,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'CANCEL',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: const Color(0xFF94A3B8)),
              ),
            ),
            ElevatedButton(
              onPressed: () async {
                if (reasonController.text.trim().isEmpty) return;
                try {
                  await _frsService.requestPhotoUpdate(reasonController.text);
                  if (mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Request sent to manager.')),
                    );
                  }
                } catch (e) {
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(e.toString()), backgroundColor: Colors.red),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0D9488),
                foregroundColor: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: Text(
                'SUBMIT REQUEST',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, fontSize: 13, letterSpacing: 0.5),
              ),
            ),
          ],
        ),
      );
    }
  }
}
