import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  int _step = 1;
  final _employeeIdController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isLoading = false;
  bool _obscureNew = true;
  bool _obscureConfirm = true;

  bool _hasLength = false;
  bool _hasUpper = false;
  bool _hasNumber = false;
  bool _hasSpecial = false;

  @override
  void initState() {
    super.initState();
    _newPasswordController.addListener(_validatePassword);
  }

  void _validatePassword() {
    final pass = _newPasswordController.text;
    setState(() {
      _hasLength = pass.length >= 8 && pass.length <= 12;
      _hasUpper = RegExp(r'[A-Z]').hasMatch(pass);
      _hasNumber = RegExp(r'[0-9]').hasMatch(pass);
      _hasSpecial = RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(pass);
    });
  }

  bool get _allValid => _hasLength && _hasUpper && _hasNumber && _hasSpecial;

  @override
  void dispose() {
    _employeeIdController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _requestOtp() async {
    if (_employeeIdController.text.trim().isEmpty) return;

    setState(() => _isLoading = true);
    try {
      final apiService = ApiService();
      await apiService.post(
        '/api/auth/request-otp',
        body: {'employee_id': _employeeIdController.text.trim()},
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('OTP sent securely to your email address.'),
          backgroundColor: Colors.green,
        ),
      );
      setState(() => _step = 2);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyAndReset() async {
    if (!_allValid || _otpController.text.length != 6) return;
    if (_newPasswordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Passwords do not match.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final apiService = ApiService();
      await apiService.post(
        '/api/auth/reset-password-otp',
        body: {
          'employee_id': _employeeIdController.text.trim(),
          'otp': _otpController.text,
          'new_password': _newPasswordController.text,
        },
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Password updated successfully! You can login now.'),
          backgroundColor: Colors.green,
        ),
      );
      Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(e.toString().replaceAll('Exception: ', '')),
          backgroundColor: Colors.red,
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildRuleItem(String text, bool isValid) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(
            isValid ? Icons.check_circle_rounded : Icons.cancel_rounded,
            color: isValid ? Colors.green : Colors.grey,
            size: 16,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              text,
              style: GoogleFonts.inter(fontSize: 12, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputField(
    String label,
    String hint,
    TextEditingController controller, {
    bool obscureText = false,
    VoidCallback? onToggle,
    int? maxLength,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            fontSize: 11,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFFCCFBF1).withOpacity(0.3),
            borderRadius: BorderRadius.circular(16),
          ),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            maxLength: maxLength,
            style: GoogleFonts.plusJakartaSans(
              fontWeight: FontWeight.w700,
              fontSize: 15,
              color: const Color(0xFF134E4A),
              letterSpacing: maxLength == 6 ? 4 : 0,
            ),
            textAlign: maxLength == 6 ? TextAlign.center : TextAlign.start,
            decoration: InputDecoration(
              counterText: "",
              hintText: hint,
              hintStyle: GoogleFonts.inter(
                color: const Color(0xFF94A3B8),
                fontSize: 14,
                fontWeight: FontWeight.w500,
                letterSpacing: 0,
              ),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 20,
                vertical: 18,
              ),
              suffixIcon: onToggle != null
                  ? IconButton(
                      icon: Icon(
                        obscureText
                            ? Icons.visibility_off_rounded
                            : Icons.visibility_rounded,
                        color: const Color(0xFF64748B),
                        size: 20,
                      ),
                      onPressed: onToggle,
                    )
                  : null,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      appBar: AppBar(
        backgroundColor: const Color(0xFFF0FDFA),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Color(0xFF134E4A),
          ),
          onPressed: () => _step == 2 && !_isLoading
              ? setState(() => _step = 1)
              : Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 20),
            Text(
              'Password Recovery',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF134E4A),
                letterSpacing: -1,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              _step == 1
                  ? 'Enter your employee ID to receive a secure 6-digit OTP to your registered email.'
                  : 'An OTP was sent to your email. Please verify and construct a strong password.',
              style: GoogleFonts.inter(
                fontSize: 14,
                color: const Color(0xFF64748b),
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 40),

            if (_step == 1) ...[
              _buildInputField(
                'EMPLOYEE ID',
                'e.g. EMP12345',
                _employeeIdController,
              ),
              const SizedBox(height: 40),
            ] else ...[
              _buildInputField(
                '6-DIGIT OTP',
                '------',
                _otpController,
                maxLength: 6,
              ),
              const SizedBox(height: 24),
              _buildInputField(
                'NEW SECURE PASSWORD',
                'Create strong password',
                _newPasswordController,
                obscureText: _obscureNew,
                onToggle: () => setState(() => _obscureNew = !_obscureNew),
              ),

              if (_newPasswordController.text.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.shade200),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildRuleItem(
                        'Between 8 and 12 characters completely',
                        _hasLength,
                      ),
                      _buildRuleItem(
                        'At least one uppercase letter (A-Z)',
                        _hasUpper,
                      ),
                      _buildRuleItem(
                        'At least one numeric digit (0-9)',
                        _hasNumber,
                      ),
                      _buildRuleItem(
                        'At least one special character (!@#\$%^&*)',
                        _hasSpecial,
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 24),
              _buildInputField(
                'CONFIRM NEW PASSWORD',
                'Re-enter your new password',
                _confirmPasswordController,
                obscureText: _obscureConfirm,
                onToggle: () =>
                    setState(() => _obscureConfirm = !_obscureConfirm),
              ),
              const SizedBox(height: 40),
            ],

            SizedBox(
              width: double.infinity,
              height: 58,
              child: ElevatedButton(
                onPressed: _isLoading
                    ? null
                    : (_step == 1
                          ? _requestOtp
                          : (_allValid && _otpController.text.length == 6
                                ? _verifyAndReset
                                : null)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF134E4A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  elevation: 8,
                ),
                child: _isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    : Text(
                        _step == 1 ? 'SEND OTP' : 'VERIFY & RESET',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 1,
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
