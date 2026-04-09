import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'services/api_service.dart';
import 'services/expense_reminder_service.dart';
import 'screens/splash_screen.dart';
import 'services/location_tracking_service.dart';
import 'package:flutter/foundation.dart';
import 'services/logger_service.dart';

void main() async {
  // 1. Setup Early Global Error Handling
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    LoggerService.log(
      'FLUTTER ERROR: ${details.exceptionAsString()}\nSTACK: ${details.stack}',
      isError: true,
    );
  };

  PlatformDispatcher.instance.onError = (error, stack) {
    LoggerService.log('PLATFORM ERROR: $error\nSTACK: $stack', isError: true);
    return true;
  };

  WidgetsFlutterBinding.ensureInitialized();
  LoggerService.log('APP STARTING: Manual Boot sequence init.');

  try {
    LoggerService.log('BOOTSTRAP: Initializing Location Service...');
    await LocationTrackingService.initializeService();
    LoggerService.log('BOOTSTRAP: Location Service Configured.');

    LoggerService.log('BOOTSTRAP: Requesting GPS access on launch...');
    await LocationTrackingService.ensureLocationAccess();
    LoggerService.log('BOOTSTRAP: GPS prompt completed.');
  } catch (e) {
    LoggerService.log(
      'BOOTSTRAP: Location Service Init Error: $e',
      isError: true,
    );
  }

  try {
    LoggerService.log('BOOTSTRAP: Restoring session...');
    await ApiService.loadSession();
    LoggerService.log('BOOTSTRAP: Session restored.');

    LoggerService.log('BOOTSTRAP: Initializing Expense Reminders...');
    await ExpenseReminderService.initialize();
    LoggerService.log('BOOTSTRAP: Expense Reminders Ready.');
  } catch (e) {
    LoggerService.log('BOOTSTRAP: Initialization Error: $e', isError: true);
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TGS Travel',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        primarySwatch: Colors.red,
        primaryColor: const Color(0xFFBB0633),
        fontFamily: GoogleFonts.plusJakartaSans().fontFamily,
      ),
      home: const SplashScreen(),
    );
  }
}
