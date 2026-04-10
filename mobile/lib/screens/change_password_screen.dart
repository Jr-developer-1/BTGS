import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';
import 'role_based_dashboard.dart';

class ChangePasswordScreen extends StatefulWidget {
  final bool isForced;
  final String? username;
  final String? userRole;
  final String? email;

  const ChangePasswordScreen({
    super.key,
    this.isForced = false,
    this.username,
    this.userRole,
    this.email,
  });

  @override
  State<ChangePasswordScreen> createState() => _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends State<ChangePasswordScreen> {
  final _currentPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _isLoading = false;
  bool _obscureCurrent = true;
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
    _currentPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _updatePassword() async {
    if (!_allValid) return;

    if (_newPasswordController.text != _confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('New passwords do not match.'), backgroundColor: Colors.red),
      );
      return;
    }

    setState(() => _isLoading = true);

    try {
      final apiService = ApiService();
      await apiService.post(
        ApiConstants.authChangePassword,
        body: {
          'current_password': _currentPasswordController.text,
          'new_password': _newPasswordController.text,
        },
      );

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Password changed successfully!'), backgroundColor: Colors.green),
      );

      if (widget.isForced) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (context) => RoleBasedDashboard(
              username: widget.username ?? 'User',
              userRole: widget.userRole ?? 'employee',
              email: widget.email,
            ),
          ),
        );
      } else {
        Navigator.pop(context);
      }
    } catch (e) {
      if (!mounted) return;
      String errorMsg = e.toString().replaceAll('Exception: ', '');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(errorMsg), backgroundColor: Colors.red),
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
            size: 18,
          ),
          const SizedBox(width: 8),
          Text(text, style: GoogleFonts.inter(fontSize: 12, color: Colors.black87)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: widget.isForced ? const SizedBox() : IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF134E4A)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.isForced ? 'Secure Your Account' : 'Change Password',
          style: GoogleFonts.plusJakartaSans(
            color: const Color(0xFF134E4A),
            fontWeight: FontWeight.w900,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            if (widget.isForced) ...[
              Text(
                'For your protection, please replace your temporary auto-generated password with a strong, permanent one.',
                textAlign: TextAlign.center,
                style: GoogleFonts.inter(color: Colors.red.shade900, fontSize: 13, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 16),
            ],
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(28),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF0D9488).withOpacity(0.06),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildPasswordField('Current / Temporary Password', _currentPasswordController, _obscureCurrent, () => setState(() => _obscureCurrent = !_obscureCurrent)),
                  const SizedBox(height: 24),
                  _buildPasswordField('New Secure Password', _newPasswordController, _obscureNew, () => setState(() => _obscureNew = !_obscureNew)),
                  
                  if (_newPasswordController.text.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.grey.shade50, borderRadius: BorderRadius.circular(12), border: Border.all(color: Colors.grey.shade200)),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildRuleItem('Between 8 and 12 characters completely', _hasLength),
                          _buildRuleItem('At least one uppercase letter (A-Z)', _hasUpper),
                          _buildRuleItem('At least one numeric digit (0-9)', _hasNumber),
                          _buildRuleItem('At least one special character (!@#\$%^&*)', _hasSpecial),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 24),
                  _buildPasswordField('Confirm New Password', _confirmPasswordController, _obscureConfirm, () => setState(() => _obscureConfirm = !_obscureConfirm)),
                ],
              ),
            ),
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              height: 58,
              child: ElevatedButton(
                onPressed: (_isLoading || !_allValid) ? null : _updatePassword,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF134E4A),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                  elevation: 8,
                ),
                child: _isLoading 
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Text(
                        'UPDATE PASSWORD',
                        style: GoogleFonts.plusJakartaSans(fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: 1),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordField(String label, TextEditingController controller, bool obscureText, VoidCallback onToggle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, fontSize: 11, color: const Color(0xFF94A3B8), letterSpacing: 1),
        ),
        const SizedBox(height: 10),
        Container(
          decoration: BoxDecoration(color: const Color(0xFFF0FDFA), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFCCFBF1))),
          child: TextField(
            controller: controller,
            obscureText: obscureText,
            style: GoogleFonts.plusJakartaSans(color: const Color(0xFF134E4A), fontWeight: FontWeight.w700, fontSize: 15),
            decoration: InputDecoration(
              hintText: '••••••••',
              hintStyle: GoogleFonts.inter(color: const Color(0xFF94A3B8), fontSize: 14, fontWeight: FontWeight.w500),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              suffixIcon: IconButton(icon: Icon(obscureText ? Icons.visibility_off_rounded : Icons.visibility_rounded, color: const Color(0xFF64748B), size: 20), onPressed: onToggle),
            ),
          ),
        ),
      ],
    );
  }
}
