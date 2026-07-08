import 'dart:async';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';
import '../services/api_service.dart';
import '../services/expense_reminder_service.dart';
import '../services/app_version_service.dart';
import '../constants/api_constants.dart';
import 'login_screen.dart';
import 'security_pin_screen.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  _SplashScreenState createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  late VideoPlayerController _videoController;
  bool _isVideoReady = false;
  bool _videoCompleted = false;

  @override
  void initState() {
    super.initState();

    try {
      _videoController = VideoPlayerController.asset(
        'assets/logo_video.mp4',
        videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
      );

      _videoController
          .initialize()
          .then((_) {
            if (!mounted) return;
            _videoController.setVolume(0.0);
            _videoController.setLooping(false);
            _videoController.play().catchError((e) {
              debugPrint('Video play error: $e');
            });

            _videoController.addListener(() {
              if (!mounted) return;
              if (_videoController.value.hasError) {
                debugPrint(
                  'Video player error: ${_videoController.value.errorDescription}',
                );
                _videoCompleted = true; // Skip video if it errors out
                return;
              }
              if (_videoController.value.isInitialized &&
                  !_videoCompleted &&
                  _videoController.value.position >=
                      _videoController.value.duration) {
                setState(() {
                  _videoCompleted = true;
                });
              }
            });

            setState(() {
              _isVideoReady = true;
            });
          })
          .catchError((e) {
            debugPrint('Video init error: $e');
            if (mounted) setState(() => _videoCompleted = true);
          });
    } catch (e) {
      debugPrint('Video controller setup error: $e');
      _videoCompleted = true;
    }

    // Start background services and navigate after a brief pause
    _initializeAndNavigate();
  }

  Future<void> _initializeAndNavigate() async {
    // 1. Initial services boot (Timezones, Notifs)
    try {
      await ExpenseReminderService.initialize().timeout(
        const Duration(seconds: 5),
      );
    } catch (e) {
      debugPrint('Startup service error (silent): $e');
    }

    // 2. Allow the splash experience to run for at least 2.5 seconds
    final minimumSplash = Future.delayed(const Duration(milliseconds: 2500));

    if (!mounted) return;

    // 3. App Version Check
    bool canProceed = await AppVersionService.checkVersionAndPrompt(context);
    await minimumSplash;

    if (canProceed && mounted) {
      if (_isVideoReady && !_videoCompleted) {
        await _waitForVideoCompletion();
      }
      if (mounted) {
        _navigateAfterSplash();
      }
    }
  }

  void _navigateAfterSplash() async {
    final apiService = ApiService();

    if (apiService.isAuthenticated) {
      final user = apiService.getUser() ?? {};
      final name = (user['name'] ?? user['username'] ?? '').toString();
      final role = (user['role'] ?? 'employee').toString().trim().toLowerCase();
      final email = (user['email'] ?? '').toString();
      final empId = (user['employee_id'] ?? '').toString();

      // Check if the user has a PIN configured on the server
      bool hasPin = false;
      try {
        final res = await apiService.get(ApiConstants.authHasPin, includeAuth: true);
        hasPin = res['has_pin'] == true;
      } catch (_) {
        // If API call fails (e.g. offline), default to setup mode
        hasPin = false;
      }

      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (context) => SecurityPinScreen(
            mode: hasPin ? PinMode.verify : PinMode.setup,
            username: name,
            userRole: role,
            email: email.isNotEmpty ? email : null,
            employeeId: empId,
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
    _videoController.dispose();
    super.dispose();
  }

  Future<void> _waitForVideoCompletion() async {
    if (!_videoController.value.isInitialized) return;

    final duration = _videoController.value.duration;
    if (duration == Duration.zero) return;

    // Safety timeout: don't wait more than 6 seconds total
    int attempts = 0;
    while (mounted && !_videoCompleted && attempts < 30) {
      await Future.delayed(const Duration(milliseconds: 200));
      attempts++;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [Color(0xFF56B0E2), Color(0xFF56B0E2)],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: Center(
          child: _isVideoReady && _videoController.value.isInitialized
              ? AspectRatio(
                  aspectRatio: _videoController.value.aspectRatio,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(24),
                    child: VideoPlayer(_videoController),
                  ),
                )
              : const CircularProgressIndicator(color: Colors.white),
        ),
      ),
    );
  }
}
