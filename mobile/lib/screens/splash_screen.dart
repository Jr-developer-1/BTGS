import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/expense_reminder_service.dart';
import '../services/app_version_service.dart';
import 'login_screen.dart';
import 'role_based_dashboard.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  _SplashScreenState createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(vsync: this, duration: const Duration(seconds: 2));
    _fadeAnimation = CurvedAnimation(parent: _animationController, curve: Curves.easeIn);
    _animationController.forward();

    // Start background services and navigate after a brief pause
    _initializeAndNavigate();
  }

  Future<void> _initializeAndNavigate() async {
    // 1. Initial services boot (Timezones, Notifs)
    try {
      await ExpenseReminderService.initialize().timeout(const Duration(seconds: 5));
    } catch (e) {
      debugPrint('Startup service error (silent): $e');
    }

    // 2. Allow logo to be visible for at least 2.5 seconds
    await Future.delayed(const Duration(milliseconds: 2500));

    if (!mounted) return;

    // 3. App Version Check
    bool canProceed = await AppVersionService.checkVersionAndPrompt(context);
    
    if (canProceed && mounted) {
      _navigateAfterSplash();
    }
  }

  void _navigateAfterSplash() {
    final apiService = ApiService();

    if (apiService.isAuthenticated) {
      final user = apiService.getUser() ?? {};
      final name  = (user['name'] ?? user['username'] ?? '').toString();
      final role  = (user['role'] ?? 'employee').toString().trim().toLowerCase();
      final email = (user['email'] ?? '').toString();

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => RoleBasedDashboard(
            username: name,
            userRole: role,
            email: email.isNotEmpty ? email : null,
          ),
        ),
      );
    } else {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
      );
    }
  }

  @override
  void dispose() {
    _animationController.dispose();
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Center(
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Image.asset(
                'assets/logo.png',
                height: 120,
                width: 120,
                errorBuilder: (context, error, stackTrace) => const Icon(Icons.business_rounded, color: Color(0xFF7C1D1D), size: 60),
              ),
              const SizedBox(height: 24),
              const CircularProgressIndicator(
                strokeWidth: 2,
                color: Color(0xFF7C1D1D),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
