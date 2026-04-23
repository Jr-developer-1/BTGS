import '../screens/team_trip_details_screen.dart';
import '../screens/inbox_screen.dart';
import '../screens/outbox_screen.dart';
import '../screens/finance_hub_screen.dart';
import '../screens/cfo_room_screen.dart';
import '../screens/user_management_screen.dart';
import '../screens/guest_house_screen.dart';
import '../screens/api_management_screen.dart';
import '../screens/login_history_screen.dart';
import '../screens/admin_audit_logs_screen.dart';
import '../screens/job_report_screen.dart';
import 'package:flutter/material.dart';
import '../models/module_model.dart';
import '../screens/my_trips_screen.dart';
import '../screens/policy_center_screen.dart';
import '../screens/documents_screen.dart';
import '../screens/settlements_screen.dart';
import '../screens/fleet_management_screen.dart';
import '../screens/frs_attendance_screen.dart';
import '../screens/frs_requests_hub_screen.dart';
import '../screens/fuel_master_screen.dart';
import '../screens/route_master_screen.dart';
import '../screens/admin_master_management_screen.dart';
import '../screens/admin_masters_screen.dart';
import '../screens/location_codes_screen.dart';
import '../screens/advance_request_screen.dart';

/// Module constants matching the Header.jsx navigation structure
class ModuleConstants {
  static final List<String> allRoles = [
    'employee',
    'reporting_authority',
    'finance',
    'admin',
    'cfo',
    'guesthouse_manager',
    'hr',
    'management',
  ];

  /// Main navigation modules (based on mainNav in Header.jsx)
  static final List<NavigationModule> mainNavModules = [
    NavigationModule(
      title: 'Trips',
      description: 'Manage trips',
      icon: Icons.flight_rounded,
      backgroundColor: const Color(0xFFFFF1F2),
      iconColor: const Color(0xFFE11D48),
      allowedRoles: ['employee', 'reporting_authority', 'finance', 'admin'],
      destinationScreen: () => const MyTripsScreen(),
    ),
    NavigationModule(
      title: 'Inbox',
      description: 'Active requests & approvals',
      icon: Icons.inbox_rounded,
      backgroundColor: const Color(0xFFF3E5F5),
      iconColor: const Color(0xFF7B1FA2),
      allowedRoles: [
        'employee',
        'reporting_authority',
        'hr',
        'finance',
        'cfo',
        'admin',
      ],
      destinationScreen: () => const InboxScreen(),
    ),
    NavigationModule(
      title: 'Outbox',
      description: 'Historical records',
      icon: Icons.archive_rounded,
      backgroundColor: const Color(0xFFE0F2F1),
      iconColor: const Color(0xFF00897B),
      allowedRoles: [
        'employee',
        'reporting_authority',
        'hr',
        'finance',
        'cfo',
        'admin',
      ],
      destinationScreen: () => const OutboxScreen(),
    ),
  ];

  /// Management modules (based on managementNav in Header.jsx)
  static final List<NavigationModule> managementNavModules = [
    NavigationModule(
      title: 'Finance Hub',
      description: 'Finance management',
      icon: Icons.account_balance_rounded,
      backgroundColor: const Color(0xFFE8F5E9),
      iconColor: const Color(0xFF2E7D32),
      allowedRoles: ['finance', 'admin'],
      destinationScreen: () => const FinanceHubScreen(),
    ),
    NavigationModule(
      title: 'Settlements',
      description: 'Manage payments',
      icon: Icons.account_balance_wallet_rounded,
      backgroundColor: const Color(0xFFFFF3E0),
      iconColor: const Color(0xFFF57C00),
      allowedRoles: ['finance', 'admin'],
      destinationScreen: () => const SettlementsScreen(),
    ),
    NavigationModule(
      title: 'Documents',
      description: 'Document organizer',
      icon: Icons.folder_open_rounded,
      backgroundColor: const Color(0xFFE3F2FD),
      iconColor: const Color(0xFF1976D2),
      allowedRoles: [
        'employee',
        'reporting_authority',
        'finance',
        'admin',
        'cfo',
      ],
      destinationScreen: () => const DocumentsScreen(),
    ),
    NavigationModule(
      title: 'System Policy',
      description: 'Travel policies',
      icon: Icons.book_rounded,
      backgroundColor: const Color(0xFFF1F8E9),
      iconColor: const Color(0xFF388E3C),
      allowedRoles: [
        'employee',
        'reporting_authority',
        'finance',
        'admin',
        'cfo',
      ],
      destinationScreen: () => const PolicyCenterScreen(),
    ),
    NavigationModule(
      title: 'CFO Room',
      description: 'Executive overview',
      icon: Icons.insights_rounded,
      backgroundColor: const Color(0xFFF3E5F5),
      iconColor: const Color(0xFF7B1FA2),
      allowedRoles: ['cfo', 'admin'],
      destinationScreen: () => const CfoRoomScreen(),
    ),
    NavigationModule(
      title: 'User Management',
      description: 'Manage users',
      icon: Icons.people_rounded,
      backgroundColor: const Color(0xFFE3F2FD),
      iconColor: const Color(0xFF1976D2),
      allowedRoles: ['admin'],
      destinationScreen: () => const UserManagementScreen(),
    ),
    NavigationModule(
      title: 'Guest Houses',
      description: 'Manage stays',
      icon: Icons.business_rounded,
      backgroundColor: const Color(0xFFFFF9C4),
      iconColor: const Color(0xFFFBC02D),
      allowedRoles: ['admin', 'guesthouse_manager'],
      destinationScreen: () => const GuestHouseScreen(),
    ),
    NavigationModule(
      title: 'Fleet Management',
      description: 'Vehicle management',
      icon: Icons.directions_car_rounded,
      backgroundColor: const Color(0xFFE1F5FE),
      iconColor: const Color(0xFF0288D1),
      allowedRoles: ['admin', 'guesthouse_manager'],
      destinationScreen: () => const FleetManagementScreen(),
    ),
    NavigationModule(
      title: 'API Management',
      description: 'Keys & settings',
      icon: Icons.api_rounded,
      backgroundColor: const Color(0xFFE0F2F1),
      iconColor: const Color(0xFF00897B),
      allowedRoles: ['admin'],
      destinationScreen: () => const ApiManagementScreen(),
    ),
    NavigationModule(
      title: 'Fuel Masters',
      description: 'Reimbursement rates',
      icon: Icons.local_gas_station_rounded,
      backgroundColor: const Color(0xFFFDF2F2),
      iconColor: const Color(0xFFBB0633),
      allowedRoles: ['admin'],
      destinationScreen: () => const FuelMasterScreen(),
    ),
    NavigationModule(
      title: 'Master Management',
      description: 'Manage dynamic tables',
      icon: Icons.settings_applications_rounded,
      backgroundColor: const Color(0xFFF3E5F5),
      iconColor: const Color(0xFF7B1FA2),
      allowedRoles: ['admin'],
      destinationScreen: () => const AdminMasterManagementScreen(),
    ),
    NavigationModule(
      title: 'Admin Masters',
      description: 'Rules & Jurisdictions',
      icon: Icons.policy_rounded,
      backgroundColor: const Color(0xFFFFF3E0),
      iconColor: const Color(0xFFE65100),
      allowedRoles: ['admin'],
      destinationScreen: () => const AdminMastersScreen(),
    ),
    NavigationModule(
      title: 'Location Codes',
      description: 'System-wide geo master',
      icon: Icons.map_rounded,
      backgroundColor: const Color(0xFFE0F7FA),
      iconColor: const Color(0xFF006064),
      allowedRoles: ['admin'],
      destinationScreen: () => const LocationCodesScreen(),
    ),
    NavigationModule(
      title: 'Route Masters',
      description: 'Logistics network',
      icon: Icons.alt_route_rounded,
      backgroundColor: const Color(0xFFF0FDF4),
      iconColor: const Color(0xFF10B981),
      allowedRoles: ['admin'],
      destinationScreen: () => const RouteMasterScreen(),
    ),
    NavigationModule(
      title: 'Login History',
      description: 'Track activities',
      icon: Icons.history_rounded,
      backgroundColor: const Color(0xFFF5F5F5),
      iconColor: const Color(0xFF616161),
      allowedRoles: ['admin'],
      destinationScreen: () => const LoginHistoryScreen(),
    ),
    NavigationModule(
      title: 'Audit Logs',
      description: 'Security records',
      icon: Icons.shield_rounded,
      backgroundColor: const Color(0xFFE8EAF6),
      iconColor: const Color(0xFF3F51B5),
      allowedRoles: ['admin'],
      destinationScreen: () => const AdminAuditLogsScreen(),
    ),
    NavigationModule(
      title: 'Job Report',
      description: 'Activity consolidated',
      icon: Icons.assignment_turned_in_rounded,
      backgroundColor: const Color(0xFFF0FDF4),
      iconColor: const Color(0xFF16A34A),
      allowedRoles: allRoles,
      destinationScreen: () => const JobReportScreen(),
    ),
  ];

  /// Mobile Specific Modules (not in Header.jsx but required)
  static final List<NavigationModule> mobileSpecificModules = [
    NavigationModule(
      title: 'FRS Attendance',
      description: 'Daily verification',
      icon: Icons.face_unlock_rounded,
      backgroundColor: const Color(0xFFE8EAF6),
      iconColor: const Color(0xFF3F51B5),
      allowedRoles: allRoles, // Global per instructions
      destinationScreen: () => const FrsAttendanceScreen(),
    ),
    NavigationModule(
      title: 'Location Tracking',
      description: 'Real-time team tracking',
      icon: Icons.gps_fixed_rounded,
      backgroundColor: const Color(0xFFE0F2FE),
      iconColor: const Color(0xFF0369A1),
      allowedRoles: allRoles, // Global per instructions
      destinationScreen: () => const TeamTripDetailsScreen(),
    ),
    NavigationModule(
      title: 'FRS Requests',
      description: 'Manager Approvals',
      icon: Icons.security_rounded,
      backgroundColor: const Color(0xFFFEE2E2),
      iconColor: const Color(0xFFBB0633),
      allowedRoles: allRoles, // Global per instructions
      destinationScreen: () => const FrsRequestsHubScreen(),
    ),
  ];

  static List<NavigationModule> getModulesForRole(String? userRole) {
    final normalizedRole = normalizeRole(userRole);
    List<NavigationModule> result = [];

    // 1. Add matching mainNav
    result.addAll(
      mainNavModules.where((m) => m.allowedRoles.contains(normalizedRole)),
    );

    // 2. Add matching managementNav
    // Note: The list is a static field of the class, so we must access it as ModuleConstants.managementNavModules
    // Wait, since we are inside the static method `getModulesForRole`, we can access `managementNavModules` directly.
    result.addAll(
      managementNavModules.where(
        (m) => m.allowedRoles.contains(normalizedRole),
      ),
    );

    // 3. Add matching mobile specific
    result.addAll(
      mobileSpecificModules.where(
        (m) => m.allowedRoles.contains(normalizedRole),
      ),
    );

    return result;
  }

  /// Normalize role exactly mapping to web's Header.jsx logic
  static String normalizeRole(String? role, {String? dept, String? desig}) {
    if (role == null) return 'employee';

    final rawRole = role.toLowerCase();
    final department = dept?.toLowerCase() ?? '';
    final designation = desig?.toLowerCase() ?? '';

    // Header.jsx EXACT LOGIC:
    if (rawRole == 'admin') return 'admin';
    if (department.contains('finance') ||
        designation.contains('finance') ||
        rawRole == 'finance')
      return 'finance';
    if (department.contains('hr') ||
        designation.contains('hr') ||
        rawRole == 'hr')
      return 'hr';
    if (department.contains('cfo') ||
        designation.contains('cfo') ||
        rawRole == 'cfo')
      return 'cfo';

    // Fuzzy mapping for reporting_authority (backend specific)
    final normalized = rawRole.replaceAll(RegExp(r'[^a-z0-9_]'), '');
    if (normalized.contains('reporting') ||
        normalized.contains('manager') ||
        normalized.contains('supervisor') ||
        normalized.contains('lead') ||
        normalized.contains('director') ||
        normalized.contains('head') ||
        normalized.contains('approver') ||
        normalized.contains('officer') ||
        normalized.contains('authority')) {
      return 'reporting_authority';
    }

    if (normalized.contains('management') || normalized.contains('mgmt')) {
      return 'management';
    }

    if (normalized.contains('guesthouse') || normalized.contains('cro')) {
      return 'guesthouse_manager';
    }

    if (normalized.contains('employee') ||
        normalized.contains('oe') ||
        normalized.contains('staff')) {
      return 'employee';
    }

    return normalized.isEmpty ? 'employee' : normalized;
  }

  static bool isManagementRole(String? role, {String? dept, String? desig}) {
    final normalized = normalizeRole(role, dept: dept, desig: desig);
    return [
      'admin',
      'reporting_authority',
      'hr',
      'management',
      'cfo',
    ].contains(normalized);
  }
}
