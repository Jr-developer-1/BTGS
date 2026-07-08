import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../constants/api_constants.dart';
import '../services/api_service.dart';
import 'role_based_dashboard.dart';
import 'forgot_password_screen.dart';

enum PinMode { setup, verify }

class SecurityPinScreen extends StatefulWidget {
  final PinMode mode;
  final String username;
  final String userRole;
  final String? email;
  final String employeeId;

  const SecurityPinScreen({
    super.key,
    required this.mode,
    required this.username,
    required this.userRole,
    this.email,
    required this.employeeId,
  });

  @override
  State<SecurityPinScreen> createState() => _SecurityPinScreenState();
}

class _SecurityPinScreenState extends State<SecurityPinScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  // App brand colors matching Login / Change Password / My Trips flow
  static const Color _primary = Color(0xFF0D9488);
  static const Color _primaryDark = Color(0xFF134E4A);
  static const Color _bg = Color(0xFFF0FDFA);
  static const Color _slate = Color(0xFF94A3B8);
  static const Color _inputBg = Color(0xFFF1F5F9);
  static const Color _borderTeal = Color(0xFFCCFBF1);

  late PinMode _currentMode;
  bool _isVerifyingPassword = false;

  String _pin = '';
  String _firstPin = '';
  bool _isConfirming = false;
  String _statusText = '';
  String _errorText = '';
  bool _isError = false;
  bool _isBusy = false;

  // For password verification flow (when PIN is forgotten)
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;
  String? _passwordErrorText;

  @override
  void initState() {
    super.initState();
    _currentMode = widget.mode;
    _shakeController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _shakeAnimation = Tween<double>(begin: 0.0, end: 16.0)
        .chain(CurveTween(curve: Curves.elasticIn))
        .animate(_shakeController);
    _resetState();
  }

  void _resetState() {
    setState(() {
      _pin = '';
      _isError = false;
      _errorText = '';
      _isBusy = false;
      _passwordController.clear();
      _passwordErrorText = null;
      if (_currentMode == PinMode.setup) {
        _isConfirming = false;
        _firstPin = '';
        _statusText = 'Create your 4-digit Security PIN';
      } else {
        _statusText = 'Enter your PIN to continue';
      }
    });
  }

  @override
  void dispose() {
    _shakeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _triggerShake() {
    HapticFeedback.vibrate();
    setState(() {
      _isError = true;
      _pin = '';
      _isBusy = false;
    });
    _shakeController.forward(from: 0.0).then((_) {
      if (mounted) setState(() => _isError = false);
    });
  }

  void _onKeyPress(String val) {
    if (_pin.length >= 4 || _isBusy) return;
    HapticFeedback.lightImpact();
    setState(() {
      _pin += val;
      _errorText = '';
    });
    if (_pin.length == 4) {
      Future.delayed(const Duration(milliseconds: 200), () {
        if (mounted) _handlePinCompletion();
      });
    }
  }

  void _onBackspace() {
    if (_pin.isEmpty || _isBusy) return;
    HapticFeedback.selectionClick();
    setState(() {
      _pin = _pin.substring(0, _pin.length - 1);
      _errorText = '';
    });
  }

  Future<void> _handlePinCompletion() async {
    if (_isBusy) return;
    setState(() => _isBusy = true);

    final api = ApiService();

    if (_currentMode == PinMode.setup) {
      if (!_isConfirming) {
        setState(() {
          _firstPin = _pin;
          _pin = '';
          _isConfirming = true;
          _statusText = 'Re-enter PIN to confirm';
          _isBusy = false;
        });
      } else {
        if (_pin == _firstPin) {
          try {
            await api.post(
              ApiConstants.authSetPin,
              body: {'pin': _pin},
              includeAuth: true,
            );
            if (!mounted) return;
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                content: Text('Security PIN configured successfully!'),
                backgroundColor: _primary,
              ),
            );
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (_) => RoleBasedDashboard(
                  username: widget.username,
                  userRole: widget.userRole,
                  email: widget.email,
                ),
              ),
            );
          } catch (e) {
            setState(() {
              _errorText = 'Failed to save PIN. Please try again.';
              _isBusy = false;
              _pin = '';
            });
          }
        } else {
          setState(() => _errorText = 'PINs do not match. Try again.');
          _triggerShake();
          Future.delayed(const Duration(milliseconds: 900), () {
            if (mounted) _resetState();
          });
        }
      }
    } else {
      try {
        final res = await api.post(
          ApiConstants.authVerifyPin,
          body: {'pin': _pin},
          includeAuth: true,
        );
        if (res['valid'] == true) {
          if (!mounted) return;
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (_) => RoleBasedDashboard(
                username: widget.username,
                userRole: widget.userRole,
                email: widget.email,
              ),
            ),
          );
        } else {
          setState(() => _errorText = 'Incorrect PIN. Please try again.');
          _triggerShake();
        }
      } catch (e) {
        setState(() => _errorText = 'Incorrect PIN. Please try again.');
        _triggerShake();
      }
    }
  }

  Future<void> _handlePasswordVerification() async {
    final password = _passwordController.text.trim();
    if (password.isEmpty) return;

    setState(() {
      _isBusy = true;
      _passwordErrorText = null;
    });

    try {
      await ApiService().post(
        ApiConstants.authLogin,
        body: {
          'employee_id': widget.employeeId,
          'password': password,
        },
      );
      if (!mounted) return;
      setState(() {
        _isVerifyingPassword = false;
        _currentMode = PinMode.setup;
        _resetState();
      });
    } catch (e) {
      String msg = 'Incorrect password. Please try again.';
      final errStr = e.toString().toLowerCase();
      if (errStr.contains('upgrade') || errStr.contains('version') || errStr.contains('update')) {
        msg = 'A newer version of the mobile app is available. Please update the app.';
      }
      setState(() {
        _isBusy = false;
        _passwordErrorText = msg;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _bg,
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // Background top orbits
          Positioned(
            top: -80,
            right: -80,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                color: _primary.withOpacity(0.06),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            top: -40,
            left: -60,
            child: Container(
              width: 180,
              height: 180,
              decoration: BoxDecoration(
                color: _primary.withOpacity(0.04),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SafeArea(
            child: _isVerifyingPassword
                ? _buildPasswordVerificationView()
                : _buildPinInputView(),
          ),
        ],
      ),
    );
  }

  // Beautiful, responsive full-screen password verification page
  Widget _buildPasswordVerificationView() {
    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 36),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: _primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.lock_reset_rounded,
              color: _primary,
              size: 36,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Reset Security PIN',
            style: GoogleFonts.plusJakartaSans(
              color: _primaryDark,
              fontSize: 26,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter your account password to verify identity and configure a new security PIN.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: _slate,
              fontSize: 14,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 36),
          // Form Card matching standard pages
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF0F172A).withOpacity(0.06),
                  blurRadius: 20,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'PASSWORD',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                    color: _slate,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  decoration: BoxDecoration(
                    color: _bg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: _borderTeal),
                  ),
                  child: TextField(
                    controller: _passwordController,
                    obscureText: _obscurePassword,
                    style: GoogleFonts.plusJakartaSans(
                      color: _primaryDark,
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                    ),
                    decoration: InputDecoration(
                      hintText: '••••••••',
                      hintStyle: GoogleFonts.inter(
                        color: _slate,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 18,
                      ),
                      suffixIcon: IconButton(
                        icon: Icon(
                          _obscurePassword
                              ? Icons.visibility_off_rounded
                              : Icons.visibility_rounded,
                          color: const Color(0xFF64748B),
                          size: 20,
                        ),
                        onPressed: () => setState(
                          () => _obscurePassword = !_obscurePassword,
                        ),
                      ),
                    ),
                  ),
                ),
                if (_passwordErrorText != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
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
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _passwordErrorText!,
                            style: GoogleFonts.inter(
                              color: Colors.red.shade700,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 40),
          // Action button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isBusy ? null : _handlePasswordVerification,
              style: ElevatedButton.styleFrom(
                backgroundColor: _primaryDark,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                elevation: 4,
              ),
              child: _isBusy
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2.5,
                      ),
                    )
                  : Text(
                      'VERIFY PASSWORD',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 16),
          // Cancel and Forgot Password row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              TextButton(
                onPressed: () {
                  setState(() {
                    _isVerifyingPassword = false;
                    _resetState();
                  });
                },
                child: Text(
                  'Back to PIN Screen',
                  style: GoogleFonts.inter(
                    color: _slate,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              TextButton(
                onPressed: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ForgotPasswordScreen(),
                    ),
                  );
                },
                child: Text(
                  'Forgot Password?',
                  style: GoogleFonts.inter(
                    color: _primary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // Beautiful numeric keypad PIN view
  Widget _buildPinInputView() {
    return Column(
      children: [
        const SizedBox(height: 40),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: _primary.withOpacity(0.1),
            shape: BoxShape.circle,
          ),
          child: const Icon(
            Icons.lock_rounded,
            color: _primary,
            size: 36,
          ),
        ),
        const SizedBox(height: 20),
        Text(
          _currentMode == PinMode.setup ? 'Setup PIN' : 'Welcome Back',
          style: GoogleFonts.plusJakartaSans(
            color: _primaryDark,
            fontSize: 26,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          widget.username,
          style: GoogleFonts.inter(
            color: _slate,
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 28),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 40),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            color: _primary.withOpacity(0.07),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            _statusText,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: _primaryDark,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        const SizedBox(height: 36),
        // Dots showing progress
        AnimatedBuilder(
          animation: _shakeAnimation,
          builder: (context, child) => Transform.translate(
            offset: Offset(
              _isError
                  ? _shakeAnimation.value * sin(_shakeController.value * pi * 6)
                  : 0.0,
              0.0,
            ),
            child: child,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (index) {
              final filled = index < _pin.length;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                curve: Curves.easeOut,
                margin: const EdgeInsets.symmetric(horizontal: 14),
                width: 22,
                height: 22,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _isError
                      ? Colors.red.shade400
                      : (filled ? _primary : Colors.transparent),
                  border: Border.all(
                    color: _isError
                        ? Colors.red.shade400
                        : (filled ? _primary : _slate.withOpacity(0.4)),
                    width: 2,
                  ),
                  boxShadow: filled && !_isError
                      ? [
                          BoxShadow(
                            color: _primary.withOpacity(0.3),
                            blurRadius: 8,
                            spreadRadius: 1,
                          )
                        ]
                      : null,
                ),
              );
            }),
          ),
        ),
        SizedBox(
          height: 44,
          child: Center(
            child: _isBusy
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: _primary,
                      strokeWidth: 2.5,
                    ),
                  )
                : (_errorText.isNotEmpty
                    ? Text(
                        _errorText,
                        style: GoogleFonts.inter(
                          color: Colors.red.shade600,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      )
                    : const SizedBox.shrink()),
          ),
        ),
        const Spacer(),
        // Numeric keypad card
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withOpacity(0.07),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              _buildKeyRow(['1', '2', '3']),
              const SizedBox(height: 12),
              _buildKeyRow(['4', '5', '6']),
              const SizedBox(height: 12),
              _buildKeyRow(['7', '8', '9']),
              const SizedBox(height: 12),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  SizedBox(
                    width: 72,
                    height: 64,
                    child: _currentMode == PinMode.setup
                        ? _buildActionButton(
                            icon: Icons.refresh_rounded,
                            onTap: _resetState,
                          )
                        : const SizedBox.shrink(),
                  ),
                  _buildDigitButton('0'),
                  SizedBox(
                    width: 72,
                    height: 64,
                    child: _buildActionButton(
                      icon: Icons.backspace_outlined,
                      onTap: _onBackspace,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  if (_currentMode == PinMode.setup) {
                    Navigator.pop(context);
                  } else {
                    setState(() {
                      _isVerifyingPassword = true;
                      _passwordController.clear();
                      _passwordErrorText = null;
                    });
                  }
                },
                child: Text(
                  _currentMode == PinMode.setup ? 'Cancel' : 'Forgot PIN?',
                  style: GoogleFonts.inter(
                    color: _primary,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
      ],
    );
  }

  Widget _buildKeyRow(List<String> keys) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: keys.map(_buildDigitButton).toList(),
    );
  }

  Widget _buildDigitButton(String val) {
    return InkWell(
      onTap: () => _onKeyPress(val),
      borderRadius: BorderRadius.circular(36),
      child: Container(
        width: 72,
        height: 64,
        decoration: BoxDecoration(
          color: _inputBg,
          borderRadius: BorderRadius.circular(18),
        ),
        alignment: Alignment.center,
        child: Text(
          val,
          style: GoogleFonts.plusJakartaSans(
            color: _primaryDark,
            fontSize: 24,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Container(
        decoration: BoxDecoration(
          color: _inputBg,
          borderRadius: BorderRadius.circular(18),
        ),
        alignment: Alignment.center,
        child: Icon(icon, color: _slate, size: 22),
      ),
    );
  }
}
