import 'dart:convert';

class Trip {
  final String id;
  final String tripId;
  final String userId;
  final String purpose;
  final String destination;
  final String source;
  final String dates;
  final String startDate;
  final String endDate;
  final String status;
  final String costEstimate;
  final String travelMode;
  final String vehicleType;
  final String employee;
  final String title;
  final String? projectCode;
  final String? reportingManagerName;
  final String? composition;
  final String? tripLeader;
  final String? leaderDesignation;
  final String? leaderEmployeeId;
  final List<dynamic> members;
  final List<dynamic> lifecycleEvents;
  final List<dynamic>? accommodationRequests;
  final Map<String, dynamic>? odometer;
  final double? totalApprovedAdvance;
  final double? totalExpenses;
  final double? walletBalance;
  final List<dynamic>? advances;
  final List<dynamic>? expenses;
  final List<dynamic>? jobReports;
  final String? enRoute;
  final Map<String, dynamic>? claim;
  final dynamic currentApprover;
  final String? userBankName;
  final String? userAccountNo;
  final String? userIfscCode;
  final int hierarchyLevel;
  final bool hasGhBooking;
  final bool hasVehicleBooking;
  final bool considerAsLocal;
  final String? userBaseLocation;
  final String? currentApproverName;
  final List<dynamic>? activityBatches;

  Trip({
    required this.id,
    required this.tripId,
    required this.userId,
    required this.purpose,
    required this.destination,
    required this.source,
    required this.dates,
    required this.startDate,
    required this.endDate,
    required this.status,
    required this.costEstimate,
    required this.travelMode,
    required this.vehicleType,
    required this.employee,
    required this.title,
    this.projectCode,
    this.reportingManagerName,
    this.composition,
    this.tripLeader,
    this.leaderDesignation,
    this.leaderEmployeeId,
    required this.members,
    required this.lifecycleEvents,
    this.accommodationRequests,
    this.odometer,
    this.totalApprovedAdvance,
    this.totalExpenses,
    this.walletBalance,
    this.advances,
    this.expenses,
    this.jobReports,
    this.enRoute,
    this.claim,
    this.currentApprover,
    this.userBankName,
    this.userAccountNo,
    this.userIfscCode,
    this.hierarchyLevel = 1,
    this.hasGhBooking = false,
    this.hasVehicleBooking = false,
    this.considerAsLocal = false,
    this.userBaseLocation,
    this.currentApproverName,
    this.activityBatches,
  });

  factory Trip.fromJson(Map<String, dynamic> json) {
    List<dynamic> parseJsonField(dynamic field) {
      if (field == null) return [];
      if (field is List) return field;
      if (field is String) {
        try {
          return jsonDecode(field);
        } catch (e) {
          return [];
        }
      }
      return [];
    }

    final membersList = parseJsonField(json['members']);
    String empName = json['creator_name'] ?? 'Employee';
    String? leaderDesignation;
    String? leaderEmpId;

    if (membersList.isNotEmpty && membersList[0] is Map) {
      final lead = membersList[0];
      empName = lead['name'] ?? lead['username'] ?? empName;
      leaderDesignation = lead['designation'] ?? lead['role'];
      leaderEmpId = lead['employee_id'] ?? lead['id']?.toString();
    } else {
      leaderDesignation = json['creator_designation'] ?? json['creator_role'];
      leaderEmpId = json['creator_employee_id']?.toString();
    }

    double parseDouble(dynamic value) {
      if (value == null) return 0.0;
      if (value is num) return value.toDouble();
      if (value is String) return double.tryParse(value) ?? 0.0;
      return 0.0;
    }

    return Trip(
      id: json['id']?.toString() ?? json['trip_id']?.toString() ?? '',
      tripId: json['trip_id']?.toString() ?? '',
      userId: json['user']?.toString() ?? '',
      purpose: json['purpose'] ?? '',
      destination: json['destination'] ?? '',
      source: json['source'] ?? '',
      dates: "${json['start_date']} - ${json['end_date']}",
      startDate: json['start_date'] ?? '',
      endDate: json['end_date'] ?? '',
      status: json['status'] ?? 'Pending',
      costEstimate: json['cost_estimate']?.toString() ?? '0',
      travelMode: json['travel_mode'] ?? '',
      vehicleType: json['vehicle_type'] ?? '',
      employee: empName,
      title: json['purpose'] ?? 'Trip',
      projectCode: json['project_code'],
      reportingManagerName: json['reporting_manager_name'],
      composition: json['composition'],
      tripLeader: json['trip_leader'],
      leaderDesignation: leaderDesignation,
      leaderEmployeeId: leaderEmpId,
      members: membersList,
      lifecycleEvents: parseJsonField(json['lifecycle_events']),
      accommodationRequests: parseJsonField(json['accommodation_requests']),
      odometer: json['odometer'],
      totalApprovedAdvance: parseDouble(json['total_approved_advance']),
      totalExpenses: parseDouble(json['total_expenses']),
      walletBalance: parseDouble(json['wallet_balance']),
      advances: parseJsonField(json['advances']),
      expenses: parseJsonField(json['expenses']),
      jobReports: parseJsonField(json['job_reports']),
      enRoute: json['en_route'],
      claim: json['claim'],
      currentApprover: json['current_approver'],
      userBankName: json['user_bank_name'] ?? json['bank_name'],
      userAccountNo: json['user_account_no'] ?? json['bank_account_no'],
      userIfscCode: json['user_ifsc_code'] ?? json['bank_ifsc_code'],
      hierarchyLevel: json['hierarchy_level'] ?? 1,
      hasGhBooking: json['has_gh_booking'] ?? false,
      hasVehicleBooking: json['has_vehicle_booking'] ?? false,
      considerAsLocal: json['consider_as_local'] ?? false,
      userBaseLocation: json['user_base_location'],
      currentApproverName: json['current_approver_name']?.toString() ?? json['current_approver']?.toString(),
      activityBatches: parseJsonField(json['activity_batches']),
    );
  }

  String? get claimStatus => claim?['status'];
}
