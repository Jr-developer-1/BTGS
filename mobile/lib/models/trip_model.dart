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
  final List<Advance>? advances;
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
  final bool isBulkUpload;
  final List<dynamic>? approvalChain;
  final String? rejectedBy;
  final String? rejectionReason;
  final String createdAt;

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
    this.isBulkUpload = false,
    this.approvalChain,
    this.rejectedBy,
    this.rejectionReason,
    this.createdAt = '',
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
    String empName = json['user_name'] ?? json['creator_name'] ?? 'Employee';
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
      advances: (json['advances'] as List<dynamic>?)?.map((e) => Advance.fromJson(e)).toList(),
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
      currentApproverName:
          json['current_approver_name']?.toString() ??
          json['current_approver']?.toString(),
      activityBatches: parseJsonField(json['activity_batches']),
      isBulkUpload: json['is_bulk_upload'] ?? false,
      approvalChain: parseJsonField(json['approval_chain']),
      rejectedBy: json['rejected_by'],
      rejectionReason: json['rejection_reason'],
      createdAt: json['created_at'] ?? '',
    );
  }

  String? get claimStatus => claim?['status'];

  Trip copyWith({
    String? id,
    String? tripId,
    String? userId,
    String? purpose,
    String? destination,
    String? source,
    String? dates,
    String? startDate,
    String? endDate,
    String? status,
    String? costEstimate,
    String? travelMode,
    String? vehicleType,
    String? employee,
    String? title,
    String? projectCode,
    String? reportingManagerName,
    String? composition,
    String? tripLeader,
    String? leaderDesignation,
    String? leaderEmployeeId,
    List<dynamic>? members,
    List<dynamic>? lifecycleEvents,
    List<dynamic>? accommodationRequests,
    Map<String, dynamic>? odometer,
    double? totalApprovedAdvance,
    double? totalExpenses,
    double? walletBalance,
    List<Advance>? advances,
    List<dynamic>? expenses,
    List<dynamic>? jobReports,
    String? enRoute,
    Map<String, dynamic>? claim,
    dynamic currentApprover,
    String? userBankName,
    String? userAccountNo,
    String? userIfscCode,
    int? hierarchyLevel,
    bool? hasGhBooking,
    bool? hasVehicleBooking,
    bool? considerAsLocal,
    String? userBaseLocation,
    String? currentApproverName,
    List<dynamic>? activityBatches,
    bool? isBulkUpload,
    List<dynamic>? approvalChain,
    String? rejectedBy,
    String? rejectionReason,
    String? createdAt,
  }) {
    return Trip(
      id: id ?? this.id,
      tripId: tripId ?? this.tripId,
      userId: userId ?? this.userId,
      purpose: purpose ?? this.purpose,
      destination: destination ?? this.destination,
      source: source ?? this.source,
      dates: dates ?? this.dates,
      startDate: startDate ?? this.startDate,
      endDate: endDate ?? this.endDate,
      status: status ?? this.status,
      costEstimate: costEstimate ?? this.costEstimate,
      travelMode: travelMode ?? this.travelMode,
      vehicleType: vehicleType ?? this.vehicleType,
      employee: employee ?? this.employee,
      title: title ?? this.title,
      projectCode: projectCode ?? this.projectCode,
      reportingManagerName: reportingManagerName ?? this.reportingManagerName,
      composition: composition ?? this.composition,
      tripLeader: tripLeader ?? this.tripLeader,
      leaderDesignation: leaderDesignation ?? this.leaderDesignation,
      leaderEmployeeId: leaderEmployeeId ?? this.leaderEmployeeId,
      members: members ?? this.members,
      lifecycleEvents: lifecycleEvents ?? this.lifecycleEvents,
      accommodationRequests: accommodationRequests ?? this.accommodationRequests,
      odometer: odometer ?? this.odometer,
      totalApprovedAdvance: totalApprovedAdvance ?? this.totalApprovedAdvance,
      totalExpenses: totalExpenses ?? this.totalExpenses,
      walletBalance: walletBalance ?? this.walletBalance,
      advances: advances ?? this.advances,
      expenses: expenses ?? this.expenses,
      jobReports: jobReports ?? this.jobReports,
      enRoute: enRoute ?? this.enRoute,
      claim: claim ?? this.claim,
      currentApprover: currentApprover ?? this.currentApprover,
      userBankName: userBankName ?? this.userBankName,
      userAccountNo: userAccountNo ?? this.userAccountNo,
      userIfscCode: userIfscCode ?? this.userIfscCode,
      hierarchyLevel: hierarchyLevel ?? this.hierarchyLevel,
      hasGhBooking: hasGhBooking ?? this.hasGhBooking,
      hasVehicleBooking: hasVehicleBooking ?? this.hasVehicleBooking,
      considerAsLocal: considerAsLocal ?? this.considerAsLocal,
      userBaseLocation: userBaseLocation ?? this.userBaseLocation,
      currentApproverName: currentApproverName ?? this.currentApproverName,
      activityBatches: activityBatches ?? this.activityBatches,
      isBulkUpload: isBulkUpload ?? this.isBulkUpload,
      approvalChain: approvalChain ?? this.approvalChain,
      rejectedBy: rejectedBy ?? this.rejectedBy,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

class Advance {
  final int id;
  final String trip;
  final double requestedAmount;
  final String purpose;
  final String status;
  final DateTime? submittedAt;
  final String? currentApprover;

  Advance({
    required this.id,
    required this.trip,
    required this.requestedAmount,
    required this.purpose,
    required this.status,
    this.submittedAt,
    this.currentApprover,
  });

  factory Advance.fromJson(Map<String, dynamic> json) {
    return Advance(
      id: json['id'] ?? 0,
      trip: json['trip']?.toString() ?? '',
      requestedAmount: double.tryParse(json['requested_amount']?.toString() ?? '0') ?? 0.0,
      purpose: json['purpose'] ?? '',
      status: json['status'] ?? 'Draft',
      submittedAt: json['submitted_at'] != null ? DateTime.tryParse(json['submitted_at']) : null,
      currentApprover: json['current_approver_name'] ?? json['current_approver']?.toString(),
    );
  }
}
