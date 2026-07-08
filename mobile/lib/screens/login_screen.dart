import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../constants/api_constants.dart';
import '../services/api_service.dart';
import '../constants/module_constants.dart';
import 'role_based_dashboard.dart';
import 'forgot_password_screen.dart';
import 'change_password_screen.dart';
import 'frs_enrollment_screen.dart';
import 'security_pin_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController _usernameController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  late VideoPlayerController _videoController;
  bool _isVideoReady = false;
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;
  String _appVersion =
      'v${ApiConstants.appVersion} (${ApiConstants.buildNumber})';

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
    _videoController = VideoPlayerController.asset('assets/logo_video.mp4')
      ..initialize().then((_) {
        _videoController.setVolume(0.0);
        _videoController.setLooping(true);
        _videoController.play();
        setState(() {
          _isVideoReady = true;
        });
      });
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _videoController.dispose();
    super.dispose();
  }

  Future<void> _loadAppVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() {
          _appVersion = 'v${packageInfo.version} (${packageInfo.buildNumber})';
        });
      }
    } catch (e) {
      debugPrint('Error loading app version: $e');
    }
  }

  Future<void> _signIn() async {
    setState(() => _errorMessage = null);
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Please enter both username and password');
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      final apiService = ApiService();
      String appVer = ApiConstants.appVersion;
      String buildNum = ApiConstants.buildNumber;
      try {
        final packageInfo = await PackageInfo.fromPlatform();
        appVer = packageInfo.version;
        buildNum = packageInfo.buildNumber;
      } catch (_) {}

      final response = await apiService.post(
        ApiConstants.authLogin,
        body: {
          'employee_id': username,
          'password': password,
          'is_mobile': true,
          'app_version': appVer,
          'build_number': buildNum,
        },
      );

      final token = response['token']?.toString() ?? '';
      final userDetails = response['user'] is Map
          ? Map<String, dynamic>.from(response['user'] as Map)
          : <String, dynamic>{};

      String role = _extractRole(response, userDetails);
      if (role.isEmpty && token.isNotEmpty) {
        role = _extractRoleFromToken(token);
      }
      role = ModuleConstants.normalizeRole(role);

      if (role == '' || role == 'null') {
        role = 'employee';
      }

      final userName = (userDetails['name'] ?? response['name'] ?? username)
          .toString();
      // Persist token + user to SharedPreferences (mirrors web app's localStorage)
      await apiService.setToken(token);
      await apiService.setUser(userDetails);

      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Logged in as $userName (Role: $role)'),
          backgroundColor: Colors.green,
          duration: const Duration(seconds: 2),
        ),
      );

      await Future.delayed(const Duration(milliseconds: 500));
      if (!mounted) return;

      final userEmail = (userDetails['email'] ?? '').toString();
      final empId = (userDetails['employee_id'] ?? response['employee_id'] ?? username).toString();
      final isFaceEnrolled = userDetails['is_face_enrolled'] == true;
      final bool requiresChange =
          response['requires_password_change'] == true ||
          userDetails['requires_password_change'] == true;

      if (requiresChange) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => ChangePasswordScreen(
              isForced: true,
              username: userName,
              userRole: role,
              email: userEmail.isNotEmpty ? userEmail : null,
            ),
          ),
        );
      } else {
        // Check if user already has a PIN set in the DB
        bool hasPin = false;
        try {
          final pinCheck = await apiService.get(ApiConstants.authHasPin, includeAuth: true);
          hasPin = pinCheck['has_pin'] == true;
        } catch (_) {
          hasPin = false;
        }

        if (!mounted) return;
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => SecurityPinScreen(
              mode: hasPin ? PinMode.verify : PinMode.setup,
              username: userName,
              userRole: role,
              email: userEmail.isNotEmpty ? userEmail : null,
              employeeId: empId,
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        String errorMsg = e.toString();
        if (errorMsg.startsWith('Exception: ')) {
          errorMsg = errorMsg.substring('Exception: '.length);
        }
        _errorMessage = errorMsg;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  String _extractRole(
    Map<String, dynamic> response,
    Map<String, dynamic> userDetails,
  ) {
    final possibleRole =
        userDetails['role'] ??
        response['role'] ??
        userDetails['role_name'] ??
        response['user_role'] ??
        '';

    if (possibleRole == null) return '';
    if (possibleRole is String) return possibleRole;
    if (possibleRole is Map) {
      return (possibleRole['name'] ?? possibleRole['role'] ?? '').toString();
    }
    return possibleRole.toString();
  }

  String _extractRoleFromToken(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return '';
      var payload = parts[1].replaceAll('-', '+').replaceAll('_', '/');
      while (payload.length % 4 != 0) {
        payload += '=';
      }
      final decoded = utf8.decode(base64Url.decode(payload));
      final tokenData = jsonDecode(decoded);
      return (tokenData['role'] ?? tokenData['user_role'] ?? '').toString();
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Background Decorative Elements
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                color: const Color(0xFF0D9488).withOpacity(0.05),
                shape: BoxShape.circle,
              ),
            ),
          ),

          // Video/Image Header Section
          Column(
            children: [
              Container(
                height: MediaQuery.of(context).size.height * 0.4,
                width: double.infinity,
                decoration: const BoxDecoration(
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(40),
                    bottomRight: Radius.circular(40),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(40),
                    bottomRight: Radius.circular(40),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (_isVideoReady && _videoController.value.isInitialized)
                        FittedBox(
                          fit: BoxFit.cover,
                          child: SizedBox(
                            width: _videoController.value.size.width,
                            height: _videoController.value.size.height,
                            child: VideoPlayer(_videoController),
                          ),
                        )
                      else
                        Container(
                          decoration: const BoxDecoration(
                            gradient: LinearGradient(
                              colors: [Color(0xFF0D9488), Color(0xFF0F766E)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                          ),
                        ),
                      // Sophisticated Overlay
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              Colors.black.withOpacity(0.4),
                              Colors.transparent,
                              const Color(0xFFF0FDFA).withOpacity(0.8),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const Spacer(),
            ],
          ),

          // Login Form
          SingleChildScrollView(
            child: Padding(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).size.height * 0.32,
              ),
              child: Column(
                children: [
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 24),
                    padding: const EdgeInsets.all(32),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(32),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withOpacity(0.1),
                          blurRadius: 40,
                          offset: const Offset(0, 20),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Sign In',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 28,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF134E4A), // Deep Teal
                            letterSpacing: -1,
                          ),
                        ),
                        // const SizedBox(height: 8),
                        // const SizedBox(height: 32),
                        if (_errorMessage != null) ...[
                          const SizedBox(height: 24),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(0.08),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.red.shade200),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  Icons.error_outline,
                                  color: Colors.red.shade600,
                                  size: 20,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    _errorMessage!,
                                    style: GoogleFonts.inter(
                                      color: Colors.red.shade700,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),
                        ] else
                          _buildInputLabel('USERNAME'),
                        const SizedBox(height: 10),
                        _buildTextField(
                          controller: _usernameController,
                          hintText: 'HR-EMP-1234',
                          icon: Icons.alternate_email_rounded,
                          forceUpperCase: true,
                        ),

                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildInputLabel('PASSWORD'),
                            GestureDetector(
                              onTap: () => Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) =>
                                      const ForgotPasswordScreen(),
                                ),
                              ),
                              child: Text(
                                'Forgot?',
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: const Color(0xFF0D9488),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        _buildTextField(
                          controller: _passwordController,
                          hintText: '••••••••',
                          isPassword: true,
                          obscureText: _obscurePassword,
                          onToggleVisibility: () => setState(
                            () => _obscurePassword = !_obscurePassword,
                          ),
                          icon: Icons.lock_open_rounded,
                        ),

                        // if (_errorMessage != null) ...[
                        //   const SizedBox(height: 24),
                        //   Container(
                        //     padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        //     decoration: BoxDecoration(
                        //       color: Colors.red.withOpacity(0.08),
                        //       borderRadius: BorderRadius.circular(12),
                        //       border: Border.all(color: Colors.red.shade200),
                        //     ),
                        //     child: Row(
                        //       children: [
                        //         Icon(Icons.error_outline, color: Colors.red.shade600, size: 20),
                        //         const SizedBox(width: 12),
                        //         Expanded(
                        //           child: Text(
                        //             _errorMessage!,
                        //             style: GoogleFonts.inter(
                        //               color: Colors.red.shade700,
                        //               fontSize: 13,
                        //               fontWeight: FontWeight.w600,
                        //             ),
                        //           ),
                        //         ),
                        //       ],
                        //     ),
                        //   ),
                        //   const SizedBox(height: 24),
                        // ] else
                        const SizedBox(height: 32),

                        SizedBox(
                          width: double.infinity,
                          height: 56,
                          child: ElevatedButton(
                            onPressed: _isLoading ? null : _signIn,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF0D9488),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(18),
                              ),
                              elevation: 8,
                              shadowColor: const Color(
                                0xFF0D9488,
                              ).withOpacity(0.3),
                            ),
                            child: _isLoading
                                ? const SizedBox(
                                    height: 24,
                                    width: 24,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 3,
                                    ),
                                  )
                                : Text(
                                    'SIGN IN',
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 16,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1,
                                    ),
                                  ),
                          ),
                        ),

                        const SizedBox(height: 24),
                        Center(
                          child: Text(
                            "New here? Contact HR for access",
                            style: GoogleFonts.inter(
                              color: const Color(0xFF94A3B8),
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 40),
                  Opacity(
                    opacity: 0.6,
                    child: Image.asset(
                      'assets/bavya logo.png',
                      height: 24,
                      fit: BoxFit.contain,
                    ),
                  ),
                  if (_appVersion.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Text(
                      _appVersion,
                      style: GoogleFonts.inter(
                        color: const Color(0xFF94A3B8),
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputLabel(String label) {
    return Text(
      label,
      style: GoogleFonts.inter(
        fontWeight: FontWeight.w900,
        fontSize: 10,
        color: const Color(0xFF94A3B8),
        letterSpacing: 1,
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hintText,
    bool isPassword = false,
    bool obscureText = false,
    VoidCallback? onToggleVisibility,
    IconData? icon,
    bool forceUpperCase = false,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: Colors.transparent, width: 2),
      ),
      child: TextFormField(
        controller: controller,
        obscureText: isPassword ? obscureText : false,
        enableInteractiveSelection: !isPassword,
        textCapitalization: forceUpperCase
            ? TextCapitalization.characters
            : TextCapitalization.none,
        inputFormatters: [
          if (forceUpperCase) UpperCaseTextFormatter(),
          if (forceUpperCase) FilteringTextInputFormatter.deny(RegExp(r'\s')),
          if (forceUpperCase)
            FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9\-]')),
          if (!isPassword) LengthLimitingTextInputFormatter(20),
          if (isPassword) NoPasteTextInputFormatter(),
          if (isPassword) LengthLimitingTextInputFormatter(15),
        ],
        style: GoogleFonts.plusJakartaSans(
          fontSize: 15,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF0F172A),
        ),
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: const Color(0xFF64748B), size: 20),
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    obscureText
                        ? Icons.visibility_off_rounded
                        : Icons.visibility_rounded,
                    color: const Color(0xFF64748B),
                    size: 20,
                  ),
                  onPressed: onToggleVisibility,
                )
              : null,
          hintText: hintText,
          hintStyle: GoogleFonts.inter(
            color: const Color(0xFF94A3B8),
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 20,
            vertical: 16,
          ),
        ),
      ),
    );
  }
}

class NoPasteTextInputFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    if (newValue.text.length - oldValue.text.length > 1) {
      return oldValue; // Reject pastes (any input > 1 character simultaneously)
    }
    return newValue;
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
