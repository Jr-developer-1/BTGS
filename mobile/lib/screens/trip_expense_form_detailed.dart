import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'dart:io';
import '../constants/api_constants.dart';
import '../services/trip_service.dart';
import '../services/master_service.dart';
import '../components/forensic_camera.dart';
import '../components/searchable_dropdown.dart';
import 'job_report_composer_screen.dart';

class TripExpenseFormDetailedScreen extends StatefulWidget {
  final String category;
  final String tripId;
  final dynamic expenseData;
  const TripExpenseFormDetailedScreen({
    super.key,
    required this.category,
    required this.tripId,
    this.expenseData,
  });

  @override
  _TripExpenseFormDetailedScreenState createState() =>
      _TripExpenseFormDetailedScreenState();
}

class _TripExpenseFormDetailedScreenState
    extends State<TripExpenseFormDetailedScreen> {
  bool get _isTravelo => widget.tripId.toLowerCase().startsWith('its');
  bool _isProcessing = false;
  final picker = ImagePicker();
  final TripService _tripService = TripService();
  final MasterService _masterService = MasterService();

  // Master Data Lists
  List<String> _masterTravelModes = [];
  List<String> _masterBookingTypes = [];
  List<String> _masterLocalTravelModes = [];
  List<String> _masterStayTypes = [];
  List<String> _masterRoomTypes = [];
  List<String> _masterMealCategories = [];
  List<String> _masterMealTypes = [];
  List<String> _masterMealSources = [];
  List<String> _masterMealProviders = [];
  List<String> _masterStayBookingTypes = [];
  List<String> _masterStayBookingSources = [];
  List<String> _masterClasses = [];
  List<String> _masterIncidentalTypes = [];        // all types
  List<String> _masterGeneralIncidentalTypes = [];  // category == 'general_incidental'
  List<String> _masterTravelIncidentalTypes = [];   // category == 'travel_incidental'
  List<String> _masterLocalIncidentalTypes = [];    // category == 'local_conveyance'
  List<String> _masterTicketStatuses = [];
  List<String> _masterQuotaTypes = [];
  List<String> _masterVehicles = [];
  List<String> _masterOperators = [];
  List<String> _masterProviders = [];
  List<String> _masterLocations = [];
  List<Map<String, dynamic>> _masterLocalSubTypesRaw = [];
  bool get isStartFieldsComplete =>
      _originController.text.isNotEmpty &&
      _odoStartController.text.isNotEmpty &&
      _odoStartImg != null;

  final _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _originController = TextEditingController();
  final TextEditingController _destController = TextEditingController();
  final TextEditingController _jobReportController = TextEditingController();
  final TextEditingController _invoiceNoController = TextEditingController();
  final TextEditingController _restaurantController = TextEditingController();
  final TextEditingController _hotelNameController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _nightsController = TextEditingController();
  final TextEditingController _carrierController = TextEditingController();
  final TextEditingController _pnrController = TextEditingController();
  final TextEditingController _ticketNoController = TextEditingController();
  final TextEditingController _seatNoController = TextEditingController();
  final TextEditingController _travelNoController = TextEditingController();
  final TextEditingController _personsController = TextEditingController();
  final TextEditingController _vehicleNoController = TextEditingController();
  final TextEditingController _odoStartController = TextEditingController();
  final TextEditingController _odoEndController = TextEditingController();
  final TextEditingController _incidentalAmountController =
      TextEditingController();
  // Rate is fetched from backend (Fuel Management). Default to 0.00
  final TextEditingController _odoRateController = TextEditingController(
    text: '0.00',
  );
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _earlyCheckInController = TextEditingController();
  final TextEditingController _lateCheckOutController = TextEditingController();
  final TextEditingController _providerController = TextEditingController();
  final TextEditingController _driverNameController = TextEditingController();
  final TextEditingController _boardingPointController =
      TextEditingController();
  final TextEditingController _remainingRouteController =
      TextEditingController();
  final TextEditingController _bookingIdController = TextEditingController();
  final TextEditingController _cancellationChargesController = TextEditingController();
  final TextEditingController _noShowChargesController = TextEditingController();
  final TextEditingController _baseFareController = TextEditingController();
  final TextEditingController _reasonController = TextEditingController();
  bool _isPublicTransport = false;

  // Dropdown States
  String? _mealCategory;
  String? _mealType;
  String? _mealSource;
  String? _mealProvider;
  String? _bookingSource;
  String? _accomType;
  String? _roomType;
  String? _travelMode;
  String? _travelSubType;
  String? _bookedBy;
  String? _bookingType;
  String? _travelStatus = 'Completed';
  String? _travelClass;
  String? _ticketStatus;
  String? _quotaType;
  String? _incidentalType;
  bool _nightTravel = false;
  bool _isSharedMeal = false;
  String? _odoStartImg;
  String? _odoEndImg;
  String? _incidentalCategory;
  String? _incidentalBill;
  double? _odoStartLat;
  double? _odoStartLong;
  double? _odoEndLat;
  double? _odoEndLong;
  double? _rate2W; // fetched from backend
  double? _rate4W; // fetched from backend
  List<Map<String, dynamic>> _incidentals = [];

  bool _mealIncluded = false;
  bool _excessBaggage = false;
  bool _isTatkal = false;
  String? _vehicleType;
  DateTime _bookingDate = DateTime.now();
  TimeOfDay _bookingTime = TimeOfDay.now();

  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  TimeOfDay _startTime = TimeOfDay.now();
  TimeOfDay _endTime = TimeOfDay.now();
  List<String> _jobReportAttachments = [];
  List<String> _expenseBills = [];
  List<String> _selfieImages = [];

  // Scheduled Timings for Outstation Travel (to match web)
  DateTime _scheduledStartDate = DateTime.now();
  DateTime _scheduledEndDate = DateTime.now();
  TimeOfDay _scheduledStartTime = TimeOfDay.now();
  TimeOfDay _scheduledEndTime = TimeOfDay.now();
  List<String> _auditTrail = [];

  int? _batchId;
  int? _rowIndex;
  bool _fromBulkUpload = false;
  bool _isDeviated = false;
  String? _deviationReason;
  String? _deviationTarget;
  String? _plannedOrigin;
  String? _plannedDestination;

  // Granular Masters
  List<String> _masterAirlines = [];
  List<String> _masterBusOperators = [];
  List<String> _masterFlightProviders = [];
  List<String> _masterTrainProviders = [];
  List<String> _masterBusProviders = [];
  List<String> _masterCabProviders = [];
  List<Map<String, dynamic>> _masterLocalProvidersRaw = [];

  @override
  void initState() {
    super.initState();
    _loadMasters();
    if (widget.expenseData != null) {
      _loadExpenseData();
      if (widget.category == 'Local Travel') {
        _fetchRates();
      }
    } else {
      if (widget.category == 'Local Travel') {
        _travelMode = 'Bike';
        _travelSubType = 'Own Bike';
        _isPublicTransport = false;
        _fetchRates();
      }
    }
    _odoStartController.addListener(_updateFormTotal);
    _odoEndController.addListener(_updateFormTotal);
    _odoRateController.addListener(_updateFormTotal);
    _amountController.addListener(_updateFormTotal);
  }

  void _updateFormTotal() {
    double incidentalSum = 0.0;
    for (var inc in _incidentals) {
      incidentalSum += double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
    }

    if (widget.category == 'Local Travel') {
      final isOwnVehicle =
          _travelSubType == 'Own Car' || _travelSubType == 'Own Bike';

      final start =
          double.tryParse(
            _odoStartController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
          ) ??
          0;
      final end =
          double.tryParse(
            _odoEndController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
          ) ??
          0;
      final rate =
          double.tryParse(
            _odoRateController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
          ) ??
          0;

      if (isOwnVehicle && end > start) {
        final total = (end - start) * rate;
        final finalAmount = total + incidentalSum;
        // For Local Travel, the _amountController reflects the FINAL TOTAL (odo + inc)
        if (_amountController.text != finalAmount.toStringAsFixed(2)) {
          _amountController.removeListener(_updateFormTotal);
          _amountController.text = finalAmount.toStringAsFixed(2);
          _amountController.addListener(_updateFormTotal);
        }
      } else if (_isPublicTransport) {
        // For Public Transport (OTHERS tab), the amount is manual entry.
        // We do NOT auto-set here to avoid overwriting user input.
      }
      // For hired rides (Ride Bike, Ride Hailing, etc.) — do NOT auto-set
      // the amount. The user enters the fare manually from the receipt/bill.
    } else if (widget.category == 'Travel' ||
        widget.category == 'Outstation Travel') {
      // For Outstation Travel, _amountController is just the FARE.
    } else if (widget.category == 'Accommodation') {
      final base = double.tryParse(_baseFareController.text) ?? 0.0;
      final early = double.tryParse(_earlyCheckInController.text) ?? 0.0;
      final late = double.tryParse(_lateCheckOutController.text) ?? 0.0;
      final total = base + early + late;
      
      if (_amountController.text != total.toStringAsFixed(2)) {
        _amountController.text = total.toStringAsFixed(2);
      }
    }
    
    if (mounted) setState(() {});
  }

  Future<void> _fetchRates() async {
    if (widget.category != 'Local Travel') return;
    // Fetch both rates upfront (mirrors web app)
    final r2 = await _tripService.fetchFuelRate('2 Wheeler');
    final r4 = await _tripService.fetchFuelRate('4 Wheeler');
    if (mounted) {
      setState(() {
        _rate2W = r2;
        _rate4W = r4;
        // Set default display rate based on current sub-type
        _updateRateForSubType(_travelSubType);
      });
    }
  }

  void _updateRateForSubType(String? subType) {
    double? rate;
    if (subType == 'Own Car') rate = _rate4W;
    if (subType == 'Own Bike') rate = _rate2W;
    _odoRateController.text = (rate ?? 0.0).toStringAsFixed(2);
  }

  void _handleStatusChange(String? newStatus) {
    if (newStatus == null || newStatus == _travelStatus) return;

    setState(() {
      final oldStatus = _travelStatus ?? 'Completed';
      _travelStatus = newStatus;

      // Add to audit trail
      final timestamp = DateTime.now().toString();
      _auditTrail.add(
        '[$timestamp] Status changed from $oldStatus to $newStatus',
      );

      // Logic parity with web: Swap amounts based on status
      if (newStatus == 'Cancelled') {
        // Save current fare to baseFare if not already saved
        if (oldStatus == 'Completed' || oldStatus == 'Rescheduled') {
          _baseFareController.text = _amountController.text;
        }
        _amountController.text = _cancellationChargesController.text;
      } else if (newStatus == 'No-Show') {
        if (oldStatus == 'Completed' || oldStatus == 'Rescheduled') {
          _baseFareController.text = _amountController.text;
        }
        _amountController.text = _noShowChargesController.text;
      } else if (oldStatus == 'Cancelled' || oldStatus == 'No-Show') {
        // Reverting to Completed/Rescheduled
        _amountController.text = _baseFareController.text;
      }
    });
  }

  Future<void> _loadMasters() async {
    Future<List<String>> safeFetch(Future<List<String>> future) async {
      try {
        return await future;
      } catch (e) {
        print('FETCH_ERROR: $e');
        return [];
      }
    }

    Future<List<Map<String, dynamic>>> safeFetchRaw(
        Future<List<Map<String, dynamic>>> future) async {
      try {
        return await future;
      } catch (e) {
        print('FETCH_RAW_ERROR: $e');
        return [];
      }
    }

    try {
      final results = await Future.wait([
        safeFetch(_masterService.getTravelModes()), // 0
        safeFetch(_masterService.getBookingTypes()), // 1
        safeFetch(_masterService.getLocalTravelModes()), // 2
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterStayTypes,
          'results',
          'stay_type',
        )), // 3
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterRoomTypes,
          'results',
          'room_type',
        )), // 4
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterMealCategories,
          'results',
          'category_name',
        )), // 5
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterMealTypes,
          'results',
          'meal_type',
        )), // 6
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterMealSources,
          'results',
          'source_name',
        )), // 7
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterMealProviders,
          'results',
          'provider_name',
        )), // 8
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterStayBookingTypes,
          'results',
          'booking_type',
        )), // 9
        safeFetch(_masterService.fetchMasterList(
          ApiConstants.masterStayBookingSources,
          'results',
          'source_name',
        )), // 10
        safeFetch(_masterService.getIncidentalTypes()), // 11
        safeFetch(_masterService.fetchMasterList(
            ApiConstants.masterTicketStatus, 'results', 'status_name')), // 12
        safeFetch(_masterService.fetchMasterList(
            ApiConstants.masterQuotaTypes, 'results', 'quota_name')), // 13
        safeFetch(_masterService.getVehicles()), // 14
        safeFetch(_masterService.getOperators()), // 15
        safeFetch(_masterService.getProviders()), // 16
        safeFetch(_masterService.getLocationsPool()), // 17
        safeFetchRaw(_masterService.getLocalSubTypesRaw()), // 18
        safeFetchRaw(_masterService.getOperatorsRaw()), // 19
        safeFetchRaw(_masterService.getProvidersRaw()), // 20
        safeFetchRaw(_masterService.getLocalProvidersRaw()), // 21
      ]);

      String toTC(String s) => s
          .split(' ')
          .map((w) =>
              w.isEmpty ? '' : w[0].toUpperCase() + w.substring(1).toLowerCase())
          .join(' ');

      // --- Fetch & split incidental types by category ---
      await _masterService.getIncidentalTypesRaw().then((raw) {
        final all = raw.map((m) => toTC(m['expense_type']?.toString() ?? '')).where((s) => s.isNotEmpty).toList();
        final general = raw.where((m) => m['category'] == 'general_incidental').map((m) => toTC(m['expense_type']?.toString() ?? '')).where((s) => s.isNotEmpty).toList();
        final travel = raw.where((m) => m['category'] == 'travel_incidental').map((m) => toTC(m['expense_type']?.toString() ?? '')).where((s) => s.isNotEmpty).toList();
        final local = raw.where((m) => m['category'] == 'local_conveyance').map((m) => toTC(m['expense_type']?.toString() ?? '')).where((s) => s.isNotEmpty).toList();
        if (mounted) {
          setState(() {
            _masterIncidentalTypes = all;
            _masterGeneralIncidentalTypes = general;
            _masterTravelIncidentalTypes = travel;
            _masterLocalIncidentalTypes = local;
          });
        }
      });

      if (mounted) {
        setState(() {
          _masterTravelModes = results[0] as List<String>;
          _masterBookingTypes = results[1] as List<String>;
          _masterLocalTravelModes = results[2] as List<String>;
          _masterStayTypes = results[3] as List<String>;
          _masterRoomTypes = results[4] as List<String>;
          _masterMealCategories = results[5] as List<String>;
          _masterMealTypes = results[6] as List<String>;
          _masterMealSources = results[7] as List<String>;
          _masterMealProviders = results[8] as List<String>;
          _masterStayBookingTypes = results[9] as List<String>;
          _masterStayBookingSources = results[10] as List<String>;
          _masterTicketStatuses = results[12] as List<String>;
          _masterQuotaTypes = results[13] as List<String>;
          _masterVehicles = results[14] as List<String>;
          _masterOperators = results[15] as List<String>;
          _masterProviders = results[16] as List<String>;
          _masterLocations = results[17] as List<String>;
          _masterLocalSubTypesRaw = results[18] as List<Map<String, dynamic>>;

          // Process Raw Operators & Providers for mode-specific lists
          final ops = results[19] as List<Map<String, dynamic>>;
          _masterAirlines = ops.where((m) => m['is_flight'] == true).map((m) => toTC(m['operator_name']?.toString() ?? '')).toList();
          _masterBusOperators = ops.where((m) => m['is_bus'] == true).map((m) => toTC(m['operator_name']?.toString() ?? '')).toList();

          final provs = results[20] as List<Map<String, dynamic>>;
          _masterFlightProviders = provs.where((m) => m['is_flight'] == true).map((m) => toTC(m['provider_name']?.toString() ?? '')).toList();
          _masterTrainProviders = provs.where((m) => m['is_train'] == true).map((m) => toTC(m['provider_name']?.toString() ?? '')).toList();
          _masterBusProviders = provs.where((m) => m['is_bus'] == true).map((m) => toTC(m['provider_name']?.toString() ?? '')).toList();
          _masterCabProviders = provs.where((m) => m['is_intercity_cab'] == true).map((m) => toTC(m['provider_name']?.toString() ?? '')).toList();

          _masterLocalProvidersRaw = results[21] as List<Map<String, dynamic>>;
        });

        if (_travelMode != null) {
          _loadClasses();
        }
      }
    } catch (e) {
      debugPrint('Error in _loadMasters: $e');
    }
  }

  Future<void> _loadClasses() async {
    if (_travelMode == null) return;
    final classes = await _masterService.getTravelClasses(_travelMode!);
    if (mounted) {
      setState(() {
        _masterClasses = classes;
      });
    }
  }

  void _loadExpenseData() {
    final exp = widget.expenseData;
    final initialAmount = exp['amount']?.toString() ?? '';
    _amountController.text =
        (initialAmount == '0.0' || initialAmount == '0.00' || initialAmount == '0')
            ? ''
            : initialAmount;

    var details = exp['details'] ?? {};
    if (details.isEmpty &&
        exp['description'] is String &&
        exp['description'].toString().startsWith('{')) {
      try {
        details = jsonDecode(exp['description']);
      } catch (e) {}
    }

    _batchId = details['batch_id'] != null
        ? int.tryParse(details['batch_id'].toString())
        : null;
    _rowIndex = details['row_index'] != null
        ? int.tryParse(details['row_index'].toString())
        : null;
    _fromBulkUpload =
        details['from_bulk_upload'] == true ||
        details['from_bulk_upload'] == 'true';
    _isDeviated = details['is_deviated'] == true || details['is_deviated'] == 'true' || exp['is_deviated'] == true;
    _deviationReason = details['deviation_reason'] ?? exp['deviation_reason'];
    _deviationTarget = details['deviation_target'] ?? exp['deviation_target'];
    _plannedOrigin = exp['planned_origin'] ?? details['from_city'] ?? details['origin'];
    _plannedDestination = exp['planned_destination'] ?? details['to_city'] ?? details['destination'];

    _jobReportController.text =
        exp['remarks'] ?? details['remarks'] ?? details['jobReport'] ?? '';

    _originController.text = details['origin'] ?? '';
    _destController.text = details['destination'] ?? '';
    _invoiceNoController.text = details['invoiceNo'] ?? '';
    _restaurantController.text = details['restaurant'] ?? '';
    if (widget.category == 'Food') {
      _addressController.text = details['purpose'] ?? '';
    }
    if (widget.category == 'Accommodation') {
      _earlyCheckInController.text = (details['earlyCheckInCharges'] ?? '')
          .toString();
      _lateCheckOutController.text = (details['lateCheckOutCharges'] ?? '')
          .toString();
    }
    _hotelNameController.text = details['hotelName'] ?? '';
    _cityController.text = details['city'] ?? '';
    _nightsController.text = (details['nights'] ?? '').toString();
    _carrierController.text = details['carrier'] ?? '';
    _pnrController.text = details['pnr'] ?? '';
    _ticketNoController.text = details['ticketNo'] ?? '';
    _seatNoController.text = details['seatNo'] ?? '';
    _personsController.text = (details['persons'] ?? '').toString();
    _vehicleNoController.text = details['vehicleNo'] ?? '';
    // Only set ODO values if they are non-zero (zero means not yet entered)
    final rawOdoStart = double.tryParse(details['odoStart']?.toString() ?? '');
    _odoStartController.text = (rawOdoStart != null && rawOdoStart > 0)
        ? rawOdoStart.toStringAsFixed(0)
        : '';
    final rawOdoEnd = double.tryParse(details['odoEnd']?.toString() ?? '');
    _odoEndController.text = (rawOdoEnd != null && rawOdoEnd > 0)
        ? rawOdoEnd.toStringAsFixed(0)
        : '';
    _odoStartImg = details['odoStartImg'];
    _odoEndImg = details['odoEndImg'];
    _odoStartLat = double.tryParse(details['odoStartLat']?.toString() ?? '');
    _odoStartLong = double.tryParse(details['odoStartLong']?.toString() ?? '');
    _odoEndLat = double.tryParse(details['odoEndLat']?.toString() ?? '');
    _odoEndLong = double.tryParse(details['odoEndLong']?.toString() ?? '');

    _providerController.text = details['provider'] ?? '';
    _driverNameController.text = details['driverName'] ?? '';
    _boardingPointController.text = details['boardingPoint'] ?? '';
    _travelNoController.text = (details['travelNo'] ?? details['trainNo'] ?? '')
        .toString();
    _vehicleType = details['vehicleType'];
    _mealIncluded =
        details['mealIncluded'] == 'Yes' || details['mealIncluded'] == true;
    _excessBaggage =
        details['excessBaggage'] == 'Yes' || details['excessBaggage'] == true;
    _isTatkal = details['isTatkal'] == true;
    _bookingIdController.text = details['bookingId'] ?? '';
    _ticketStatus = details['ticketStatus'];
    _quotaType = details['quotaType'];

    if (details['checkInTime'] != null) _startTime = _parseTime(details['checkInTime']);
    if (details['checkOutTime'] != null) _endTime = _parseTime(details['checkOutTime']);

    if (details['bookingDate'] != null)
      _bookingDate = DateTime.tryParse(details['bookingDate']) ?? _bookingDate;
    if (details['bookingTime'] != null)
      _bookingTime = _parseTime(details['bookingTime']);

    _mealCategory = details['mealCategory'];
    _mealType = details['mealType'];
    _mealSource = details['mealSource'];
    _mealProvider = details['provider'] ?? details['mealProvider'];
    _hotelNameController.text = details['hotelName'] ?? '';
    _restaurantController.text = details['restaurant'] ?? '';
    _accomType = details['accomType'];
    _roomType = details['roomType'];
    _bookingType = details['bookingType'];
    _bookingSource = details['bookingSource'];
    _incidentalType = details['incidentalType'];
    _cityController.text = details['location'] ?? '';
    _invoiceNoController.text = details['invoiceNo'] ?? '';
    _reasonController.text = details['otherReason'] ?? '';
    _jobReportController.text = details['notes'] ?? details['purpose'] ?? '';
    _bookingIdController.text = details['bookingId'] ?? '';
    _earlyCheckInController.text = (details['earlyCheckInCharges'] ?? '').toString();
    _lateCheckOutController.text = (details['lateCheckOutCharges'] ?? '').toString();
    _baseFareController.text = (details['baseAmount'] ?? (widget.category == 'Accommodation' ? exp['amount'] : '')).toString();
    _jobReportController.text = details['remarks'] ?? details['purpose'] ?? '';
    
    // Timeline Restore for Accommodation
    if (details['scheduledCheckInDate'] != null) _scheduledStartDate = _parseDate(details['scheduledCheckInDate']);
    if (details['scheduledCheckOutDate'] != null) _scheduledEndDate = _parseDate(details['scheduledCheckOutDate']);
    if (details['scheduledCheckInTime'] != null) _scheduledStartTime = _parseTime(details['scheduledCheckInTime']);
    if (details['scheduledCheckOutTime'] != null) _scheduledEndTime = _parseTime(details['scheduledCheckOutTime']);
    
    if (details['actualCheckInDate'] != null) _startDate = _parseDate(details['actualCheckInDate']);
    if (details['actualCheckOutDate'] != null) _endDate = _parseDate(details['actualCheckOutDate']);
    if (details['actualCheckInTime'] != null) _startTime = _parseTime(details['actualCheckInTime']);
    if (details['actualCheckOutTime'] != null) _endTime = _parseTime(details['actualCheckOutTime']);
    _travelMode = details['mode'];
    _travelSubType = details['subType'];
    _bookedBy = details['bookedBy'];
    _travelStatus = details['travelStatus'] ?? 'Completed';
    _travelClass = details['class'];
    _nightTravel = details['nightTravel'] ?? false;
    _isSharedMeal = details['isShared'] ?? false;

    // SEPARATE LOADS: Job Report Attachments vs Main Expense Bills
    _jobReportAttachments = [];
    _expenseBills = [];

    // Main Receipts (Bills)
    final receiptImg = exp['receipt_image'];
    if (receiptImg != null && receiptImg is String && receiptImg != '[]') {
      try {
        _expenseBills = List<String>.from(jsonDecode(receiptImg));
      } catch (e) {}
    } else if (receiptImg is List) {
      _expenseBills = List<String>.from(receiptImg);
    }

    // Job Report Proofs
    final attachments = details['jobReportAttachments'];
    if (attachments is List) {
      _jobReportAttachments = List<String>.from(
        attachments.map((e) => e.toString()),
      );
    }

    // Legacy fallback (moving to bills if found in generic attachments)
    final commonAttachments = details['attachments'];
    if (commonAttachments != null &&
        commonAttachments is List &&
        _expenseBills.isEmpty) {
      _expenseBills = List<String>.from(
        commonAttachments.map((e) => e.toString()),
      );
    }

    final selfies = details['selfieImages'];
    if (selfies is List) {
      _selfieImages = List<String>.from(selfies.map((e) => e.toString()));
    }

    if (details['date'] != null)
      _startDate = _parseDate(details['date']);
    else if (exp['date'] != null)
      _startDate = _parseDate(exp['date']);
    if (details['depDate'] != null) _startDate = _parseDate(details['depDate']);
    if (details['arrDate'] != null) _endDate = _parseDate(details['arrDate']);
    if (details['checkIn'] != null) _startDate = _parseDate(details['checkIn']);
    if (details['checkOut'] != null) _endDate = _parseDate(details['checkOut']);

    if (details['depTime'] != null) _startTime = _parseTime(details['depTime']);
    if (details['arrTime'] != null) _endTime = _parseTime(details['arrTime']);

    // Load Scheduled Timings
    if (details['scheduledDepDate'] != null)
      _scheduledStartDate = _parseDate(details['scheduledDepDate']);
    if (details['scheduledArrDate'] != null)
      _scheduledEndDate = _parseDate(details['scheduledArrDate']);
    if (details['scheduledDepTime'] != null)
      _scheduledStartTime = _parseTime(details['scheduledDepTime']);
    if (details['scheduledArrTime'] != null)
      _scheduledEndTime = _parseTime(details['scheduledArrTime']);
    if (details['mealTime'] != null)
      _startTime = _parseTime(details['mealTime']);

    if (details['cancellationCharges'] != null)
      _cancellationChargesController.text = details['cancellationCharges'].toString();
    if (details['noShowCharges'] != null)
      _noShowChargesController.text = details['noShowCharges'].toString();
    if (details['baseFare'] != null)
      _baseFareController.text = details['baseFare'].toString();
    if (details['auditTrail'] is List)
      _auditTrail = List<String>.from(details['auditTrail']);

    if (widget.category == 'Local Travel') {
      // Restore previously saved rate if available; the async _fetchRates()
      // call (triggered in initState) will overwrite this with the live backend
      // value once it resolves — so do NOT fall back to any hardcoded value.
      if (details['odoRate'] != null) {
        _odoRateController.text = details['odoRate'].toString();
      }
      _incidentalAmountController.text = (details['incidentalAmount'] ?? '')
          .toString();
      _incidentalCategory = details['incidentalCategory'];
      _incidentalBill = details['incidentalBill'];

      // Load multi-incidentals if present
      if (details['incidentals'] is List) {
        _incidentals = List<Map<String, dynamic>>.from(details['incidentals']);
      } else if (_incidentalCategory != null &&
          _incidentalAmountController.text.isNotEmpty) {
        // Migration/Fallback
        _incidentals = [
          {
            'category': _incidentalCategory,
            'amount': _incidentalAmountController.text,
            'bill': _incidentalBill,
          },
        ];
      }

      // Outstation Travel Incidentals (Parity with Web)
      if (details['travelIncidentals'] is List) {
        _incidentals = List<Map<String, dynamic>>.from(details['travelIncidentals']);
      }

      // If incidentals are included in the main amount, subtract them for the fare field display
      if (_incidentals.isNotEmpty &&
          _travelSubType != 'Own Car' &&
          _travelSubType != 'Own Bike') {
        double totalAmount =
            double.tryParse(exp['amount']?.toString() ?? '0') ?? 0.0;
        double incidentalSum = 0.0;
        for (var inc in _incidentals) {
          incidentalSum +=
              double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
        }
        double baseAmount = totalAmount - incidentalSum;
        _amountController.text =
            baseAmount > 0 ? baseAmount.toStringAsFixed(2) : '0.00';
      }

      if (details['startDate'] != null)
        _startDate = _parseDate(details['startDate']);
      else if (details['date'] != null)
        _startDate = _parseDate(details['date']);
      else if (exp['date'] != null)
        _startDate = _parseDate(exp['date']);

      if (details['endDate'] != null)
        _endDate = _parseDate(details['endDate']);
      else if (details['date'] != null)
        _endDate = _parseDate(details['date']);
      else if (exp['date'] != null)
        _endDate = _parseDate(exp['date']);

      // Timing with nesting and naming fallbacks
      final timing = details['time'];
      if (details['startTime'] != null)
        _startTime = _parseTime(details['startTime'].toString());
      else if (details['start_time'] != null)
        _startTime = _parseTime(details['start_time'].toString());
      else if (timing is Map && timing['boardingTime'] != null)
        _startTime = _parseTime(timing['boardingTime'].toString());

      if (details['endTime'] != null)
        _endTime = _parseTime(details['endTime'].toString());
      else if (details['reach_time'] != null)
        _endTime = _parseTime(details['reach_time'].toString());
      else if (details['end_time'] != null)
        _endTime = _parseTime(details['end_time'].toString());
      else if (timing is Map && timing['actualTime'] != null)
        _endTime = _parseTime(timing['actualTime'].toString());
      else
        _endTime = _startTime; // Fallback to start time so it's not "now"
    }
  }

  DateTime _parseDate(dynamic date) {
    if (date == null || date == 'N/A' || date == '') return DateTime.now();
    final dStr = date.toString();

    // Try ISO format (YYYY-MM-DD)
    DateTime? dt = DateTime.tryParse(dStr);
    if (dt != null) return dt;

    // Try DD-MM-YYYY
    try {
      return DateFormat('dd-MM-yyyy').parse(dStr);
    } catch (_) {}

    // Try YYYY-MM-DD explicitly
    try {
      return DateFormat('yyyy-MM-dd').parse(dStr);
    } catch (_) {}

    return DateTime.now();
  }

  TimeOfDay _parseTime(String timeStr) {
    try {
      // Handle full ISO timestamps or space-separated date-times
      if (timeStr.contains('T')) {
        final dt = DateTime.tryParse(timeStr);
        if (dt != null) return TimeOfDay.fromDateTime(dt);
      }

      String workingTime = timeStr.trim();
      if (workingTime.contains(' ')) {
        final parts = workingTime.split(' ');
        // If first part looks like date (YYYY-MM-DD or DD-MM-YYYY)
        if (parts[0].contains('-') || parts[0].contains('/')) {
          workingTime = parts.last;
        }
      }

      // Now workingTime should be "HH:mm:ss..." or "HH:mm AM/PM"
      final parts = workingTime.split(':');
      if (parts.length >= 2) {
        int hour = int.parse(parts[0].replaceAll(RegExp(r'[^0-9]'), ''));
        int minute = int.parse(parts[1].replaceAll(RegExp(r'[^0-9]'), ''));

        if (workingTime.toLowerCase().contains('pm') && hour < 12) hour += 12;
        if (workingTime.toLowerCase().contains('am') && hour == 12) hour = 0;

        return TimeOfDay(hour: hour.clamp(0, 23), minute: minute.clamp(0, 59));
      }
    } catch (_) {}
    return const TimeOfDay(hour: 9, minute: 0);
  }

  String _mapCategory(String cat) {
    switch (cat) {
      case 'Local Travel':
      case 'Fuel':
        return 'Fuel';
      case 'Travel':
      case 'Outstation Travel':
        return 'Others';
      case 'Food':
        return 'Food';
      case 'Accommodation':
        return 'Accommodation';
      case 'Incidental':
        return 'Incidental';
      default:
        return cat;
    }
  }

  void _calculateNights() {
    final diff = _endDate.difference(_startDate).inDays;
    _nightsController.text = diff.clamp(1, 100).toString();
  }

  Future<void> _submitEntry() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isProcessing = true);
    try {
      double amount = double.tryParse(_amountController.text) ?? 0.0;
      double odoTotal = 0.0;

      if (widget.category == 'Local Travel') {
        final isOwnVehicle =
            _travelSubType == 'Own Car' || _travelSubType == 'Own Bike';

        double startOdo =
            double.tryParse(
              _odoStartController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
            ) ??
            0;
        double endOdo =
            double.tryParse(
              _odoEndController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
            ) ??
            0;
        double dist = (endOdo - startOdo).clamp(0, 99999);

        // Sum up all incidentals to add to the main record's total amount
        double incidentalSum = 0.0;
        for (var inc in _incidentals) {
          incidentalSum +=
              double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
        }

        if (isOwnVehicle) {
          final rate = _travelSubType == 'Own Car'
              ? (_rate4W ?? double.tryParse(_odoRateController.text) ?? 0.0)
              : (_rate2W ?? double.tryParse(_odoRateController.text) ?? 0.0);

          odoTotal = dist * rate;
          amount = odoTotal + incidentalSum; // Sum them up for the grid card
        } else {
          // For Ride Hailing/PT etc., _amountController is the base fare/cost
          amount = (double.tryParse(_amountController.text) ?? 0.0) +
              incidentalSum;
        }
      } else if (widget.category == 'Travel' ||
          widget.category == 'Outstation Travel') {
        double incidentalSum = 0.0;
        for (var inc in _incidentals) {
          incidentalSum +=
              double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
        }
        amount = (double.tryParse(_amountController.text) ?? 0.0) + incidentalSum;
      }

      final payload = {
        'trip': widget.tripId,
        'category': _mapCategory(widget.category),
        'amount': amount,
        'date': DateFormat('yyyy-MM-dd').format(_startDate),
        'description': jsonEncode(_buildDescription()),
        'receipt_image': jsonEncode(_expenseBills),

        // Essential Top-Level Fields for consistent DB storage
        'travel_mode': _travelMode,
        'class_type': _travelClass,
        'booking_reference': _pnrController.text,
        'refundable_flag': false, // or add a toggle if needed in UI
        'meal_included_flag': _mealIncluded,
        'vehicle_type': _vehicleType,
        'odo_start': double.tryParse(_odoStartController.text.replaceAll(RegExp(r'[^0-9.]'), '')),
        'odo_end': double.tryParse(_odoEndController.text.replaceAll(RegExp(r'[^0-9.]'), '')),
        'distance': (double.tryParse(_odoEndController.text.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0) - (double.tryParse(_odoStartController.text.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0),
      };

      // NEW: Handle correction of rejected bulk rows
      if (widget.expenseData != null &&
          widget.expenseData['is_bulk_correction'] == true) {
        final batchId = widget.expenseData['batch_id'].toString();
        final rowIndex = widget.expenseData['row_index'];

        final rowUpdate = {
          ..._buildDescription(),
          'amount': amount,
          'date': DateFormat('yyyy-MM-dd').format(_startDate),
          'remarks': _jobReportController.text,
          '_status': 'Validated',
          '_remark': 'Corrected on mobile: ${_jobReportController.text}',
        };

        await _tripService.handleBulkBatchAction(
          batchId,
          'UpdateItem',
          extraData: {'row_index': rowIndex, 'new_data': rowUpdate},
        );

        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Bulk row corrected and resubmitted'),
            backgroundColor: Colors.green,
          ),
        );
        Navigator.pop(context, true);
        return;
      }

      if (widget.expenseData != null) {
        await _tripService.updateExpense(
          widget.expenseData['id'].toString(),
          payload,
        );
      } else {
        await _tripService.addExpense(payload);
      }

      Navigator.pop(context, true);
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
      );
    } finally {
      setState(() => _isProcessing = false);
    }
  }

  Map<String, dynamic> _buildDescription() {
    final Map<String, dynamic> desc = {
      'purpose': widget.category == 'Food'
          ? _addressController.text
          : _jobReportController.text,
      'date': DateFormat('yyyy-MM-dd').format(_startDate),
    };

    if (widget.category == 'Food') {
      desc.addAll({
        'mealCategory': _mealCategory,
        'mealType': _mealType,
        'mealSource': _mealSource,
        'provider': _mealProvider,
        'hotelName': _hotelNameController.text,
        'restaurant': _restaurantController.text,
        'mealTime': _startTime.format(context),
        'invoiceNo': _invoiceNoController.text,
        'isShared': _isSharedMeal,
        'persons': _personsController.text,
        'date': DateFormat('yyyy-MM-dd').format(_startDate),
      });
    } else if (widget.category == 'Accommodation') {
      desc.addAll({
        'accomType': _accomType,
        'hotelName': _hotelNameController.text,
        'city': _cityController.text,
        'bookingType': _bookingType,
        'bookingSource': _bookingSource,
        'bookingId': _bookingIdController.text,
        'baseAmount': _baseFareController.text,
        'earlyCheckInCharges': _earlyCheckInController.text,
        'lateCheckOutCharges': _lateCheckOutController.text,
        
        'scheduledCheckInDate': DateFormat('yyyy-MM-dd').format(_scheduledStartDate),
        'scheduledCheckOutDate': DateFormat('yyyy-MM-dd').format(_scheduledEndDate),
        'scheduledCheckInTime': _scheduledStartTime.format(context),
        'scheduledCheckOutTime': _scheduledEndTime.format(context),
        
        'actualCheckInDate': DateFormat('yyyy-MM-dd').format(_startDate),
        'actualCheckOutDate': DateFormat('yyyy-MM-dd').format(_endDate),
        'actualCheckInTime': _startTime.format(context),
        'actualCheckOutTime': _endTime.format(context),
        
        'nights': int.tryParse(_nightsController.text) ?? 1,
        'remarks': _jobReportController.text,
      });
    } else if (widget.category == 'Travel' ||
        widget.category == 'Outstation Travel') {
      desc.addAll({
        'mode': _travelMode,
        'origin': _originController.text,
        'destination': _destController.text,
        'depDate': DateFormat('yyyy-MM-dd').format(_startDate),
        'arrDate': DateFormat('yyyy-MM-dd').format(_endDate),
        'time': {
          'boardingTime': _startTime.format(context),
          'actualTime': _endTime.format(context),
        },
        'depTime': _startTime.format(context),
        'arrTime': _endTime.format(context),
        'boardingTime': _startTime.format(context),
        'actualTime': _endTime.format(context),
        'carrier': _carrierController.text,
        'bookedBy': _bookedBy,
        'pnr': _pnrController.text,
        'ticketNo': _ticketNoController.text,
        'class': _travelClass,
        'travelStatus': _travelStatus,
        'provider': _providerController.text,
        'driverName': _driverNameController.text,
        'boardingPoint': _boardingPointController.text,
        'travelNo': _travelNoController.text,
        'vehicleType': _vehicleType,
        'mealIncluded': _mealIncluded,
        'excessBaggage': _excessBaggage,
        'isTatkal': _isTatkal,
        'bookingDate': DateFormat('yyyy-MM-dd').format(_bookingDate),
        'bookingTime': _bookingTime.format(context),
        'bookingId': _bookingIdController.text,
        'ticketStatus': _ticketStatus,
        'quotaType': _quotaType,
        'seatNo': _seatNoController.text,
        'travelIncidentals': _incidentals,

        // Scheduled Timings (Parity with Web)
        'scheduledDepDate': DateFormat(
          'yyyy-MM-dd',
        ).format(_scheduledStartDate),
        'scheduledArrDate': DateFormat('yyyy-MM-dd').format(_scheduledEndDate),
        'scheduledDepTime': _scheduledStartTime.format(context),
        'scheduledArrTime': _scheduledEndTime.format(context),
        'cancellationCharges': _cancellationChargesController.text,
        'noShowCharges': _noShowChargesController.text,
        'baseFare': _baseFareController.text,
        'auditTrail': _auditTrail,
      });
    } else if (widget.category == 'Local Travel') {
      desc.addAll({
        'origin': _originController.text,
        'destination': _destController.text,
        'startTime': _startTime.format(context),
        'endTime': _endTime.format(context),
        'startDate': DateFormat('yyyy-MM-dd').format(_startDate),
        'endDate': DateFormat('yyyy-MM-dd').format(_endDate),
        'mode': _travelMode,
        'subType': _travelSubType,
        'isPublicTransport': _isPublicTransport,
        'remainingRoute': _remainingRouteController.text,
        'odoStart': _isPublicTransport ? '' : _odoStartController.text,
        'odoEnd': _isPublicTransport ? '' : _odoEndController.text,
        'odoRate': _isPublicTransport ? '' : _odoRateController.text,
        'odoStartImg': _isPublicTransport ? null : _odoStartImg,
        'odoEndImg': _isPublicTransport ? null : _odoEndImg,
        'odoStartLat': _isPublicTransport ? null : _odoStartLat,
        'odoStartLong': _isPublicTransport ? null : _odoStartLong,
        'odoEndLat': _isPublicTransport ? null : _odoEndLat,
        'odoEndLong': _isPublicTransport ? null : _odoEndLong,
        'travelStatus': _travelStatus,
        'time': {
          'boardingTime': _startTime.format(context),
          'actualTime': _endTime.format(context),
        },
      });

      if (!_isTravelo) {
        desc['bookedBy'] = _bookedBy;
      } else {
        desc['vehicleNo'] = _vehicleNoController.text;
        desc['incidentals'] = _incidentals;
        desc['nightTravel'] = _nightTravel;
      }
    }

    desc['jobReport'] = _jobReportController.text;
    desc['remarks'] = _jobReportController.text;
    desc['jobReportAttachments'] = _jobReportAttachments;
    desc['selfies'] = _selfieImages;

    if (_fromBulkUpload) {
      desc['from_bulk_upload'] = true;
    }
    desc['is_deviated'] = _isDeviated;
    if (_deviationReason != null) desc['deviation_reason'] = _deviationReason;
    if (_deviationTarget != null) desc['deviation_target'] = _deviationTarget;
    if (_plannedOrigin != null) desc['planned_origin'] = _plannedOrigin;
    if (_plannedDestination != null) desc['planned_destination'] = _plannedDestination;

    if (_batchId != null) {
      desc['batch_id'] = _batchId;
    }
    if (_rowIndex != null) {
      desc['row_index'] = _rowIndex;
    }

    return desc;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      appBar: AppBar(
        title: Text(
          '${widget.category} Details'.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w900,
            fontSize: 16,
            letterSpacing: 1,
            color: Colors.white,
          ),
        ),
        backgroundColor: const Color(0xFF0F766E),
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              if (widget.category == 'Travel' ||
                  widget.category == 'Outstation Travel')
                _buildTravelForm(),
              if (widget.category == 'Local Travel') _buildLocalTravelForm(),
              if (widget.category == 'Food') _buildFoodForm(),
              if (widget.category == 'Accommodation') _buildAccommodationForm(),
              if (widget.category == 'Incidental' ||
                  widget.category == 'Others')
                _buildIncidentalForm(),

              if (!(widget.category == 'Local Travel' && _isTravelo && !_isPublicTransport))
                _buildAttachmentSection(),
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isProcessing ? null : _submitEntry,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0F172A),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                    elevation: 0,
                  ),
                  child: _isProcessing
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          widget.expenseData != null
                              ? 'SAVE CHANGES'
                              : 'SUBMIT ENTRY',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                            letterSpacing: 1,
                          ),
                        ),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTravelForm() {
    return Column(
      children: [
        _buildWebCard(
          title: 'BOOKING DETAILS',
          icon: Icons.confirmation_number_outlined,
          color: Colors.blue,
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDropdownMini(
                    'BOOKED BY',
                    _bookedBy,
                    _masterBookingTypes,
                    (v) => setState(() => _bookedBy = v),
                    icon: Icons.person_outline_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTextFieldMini(
                    'BOOKING ID',
                    _bookingIdController,
                    icon: Icons.tag_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'BOOKING DATE',
                    _bookingDate,
                    (d) => setState(() => _bookingDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'BOOKING TIME',
                    _bookingTime,
                    (t) => setState(() => _bookingTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildDropdownMini(
                    'TICKET STATUS',
                    _ticketStatus,
                    _masterTicketStatuses.isNotEmpty 
                      ? _masterTicketStatuses 
                      : ['Confirmed', 'Waitlist', 'RAC', 'Cancelled'],
                    (v) => setState(() => _ticketStatus = v),
                    icon: Icons.confirmation_number_rounded,
                  ),
                ),
                if (_travelMode != 'Train') ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDropdownMini(
                      'TRAVEL STATUS',
                      _travelStatus,
                      const [
                        'Completed',
                        'Pending',
                        'Cancelled',
                        'Rescheduled',
                        'No-Show'
                      ],
                      (v) => _handleStatusChange(v),
                      icon: Icons.info_outline_rounded,
                    ),
                  ),
                ],
                if (_travelMode == 'Train') ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDropdownMini(
                      'QUOTA TYPE',
                      _quotaType,
                      _masterQuotaTypes,
                      (v) => setState(() => _quotaType = v),
                      icon: Icons.people_outline_rounded,
        ),
                  ),
                ],
              ],
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'ROUTE & TRAVEL DETAILS',
          icon: Icons.route_outlined,
          color: Colors.orange,
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDropdownMini(
                    'TRAVEL MODE',
                    _travelMode,
                    _masterTravelModes,
                    (v) => setState(() {
                      _travelMode = v;
                      _masterClasses = [];
                      _travelClass = null;
                      _loadClasses();
                    }),
                    icon: Icons.flight_takeoff_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                const Spacer(),
              ],
            ),
            const SizedBox(height: 20),
            if (_travelStatus == 'Cancelled')
              _buildTextFieldMini(
                'CANCELLATION CHARGES',
                _cancellationChargesController,
                prefix: '₹',
                keyboardType: TextInputType.number,
                icon: Icons.money_off_rounded,
                onChanged: (v) {
                  _amountController.text = v;
                },
              )
            else if (_travelStatus == 'No-Show')
              _buildTextFieldMini(
                'NO-SHOW CHARGES',
                _noShowChargesController,
                prefix: '₹',
                keyboardType: TextInputType.number,
                icon: Icons.person_off_rounded,
                onChanged: (v) {
                  _amountController.text = v;
                },
              )
            else
              _buildTextFieldMini(
                'TICKET FARE',
                _amountController,
                prefix: '₹',
                keyboardType: TextInputType.number,
                icon: Icons.payments_outlined,
                onChanged: (v) {
                  _baseFareController.text = v;
                },
              ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: SearchableDropdown(
                    label: 'FROM',
                    value: _originController.text,
                    icon: Icons.location_on_outlined,
                    isLocation: true,
                    initialOptions: _masterLocations,
                    onChanged: (v) =>
                        setState(() => _originController.text = v),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SearchableDropdown(
                    label: 'TO',
                    value: _destController.text,
                    icon: Icons.location_on_outlined,
                    isLocation: true,
                    initialOptions: _masterLocations,
                    onChanged: (v) => setState(() => _destController.text = v),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (_travelMode == 'Flight') ...[
              Row(
                children: [
                  Expanded(
                    child: SearchableDropdown(
                      label: 'AIRLINE NAME',
                      value: _carrierController.text,
                      icon: Icons.flight_takeoff_rounded,
                      initialOptions: _masterAirlines,
                      onChanged: (v) => setState(() => _carrierController.text = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDropdownMini(
                      'TRAVEL AGENT / PROVIDER',
                      _providerController.text,
                      _masterFlightProviders,
                      (v) => setState(() => _providerController.text = v ?? ''),
                      icon: Icons.business_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildTextFieldMini(
                      'FLIGHT NO.',
                      _travelNoController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextFieldMini(
                      'TICKET NO.',
                      _ticketNoController,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildDropdownMini(
                      'TRAVEL CLASS',
                      _travelClass,
                      _masterClasses,
                      (v) => setState(() => _travelClass = v),
                      icon: Icons.airline_seat_recline_extra_rounded,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextFieldMini(
                      'SEAT NO.',
                      _seatNoController,
                      icon: Icons.event_seat_rounded,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              _buildTextFieldMini('PNR / BOOKING REF', _pnrController),
            ] else if (_travelMode == 'Intercity Cab') ...[
              const SizedBox(height: 20),
              Row(
                children: [
                Expanded(
                  child: _buildDropdownMini(
                    'PROVIDER / VENDOR',
                    _providerController.text,
                    _masterCabProviders,
                    (v) => setState(() => _providerController.text = v ?? ''),
                    icon: Icons.business_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDropdownMini(
                    'CAB TYPE',
                    _vehicleType,
                    _masterVehicles,
                    (v) => setState(() => _vehicleType = v ?? ''),
                    icon: Icons.directions_car_rounded,
                  ),
                ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildTextFieldMini(
                      'DRIVER NAME',
                      _driverNameController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextFieldMini(
                      'VEHICLE NO.',
                      _travelNoController,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              SearchableDropdown(
                label: 'BOARDING POINT',
                value: _boardingPointController.text,
                icon: Icons.pin_drop_outlined,
                isLocation: true,
                initialOptions: _masterLocations,
                onChanged: (v) => setState(() => _boardingPointController.text = v),
              ),
            ] else ...[
              // Train, Bus, etc.
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: SearchableDropdown(
                      label: _travelMode == 'Bus' ? 'OPERATOR NAME' : 'PROVIDER / AGENT',
                      value: (_travelMode == 'Bus') ? _carrierController.text : _providerController.text,
                      icon: Icons.business_rounded,
                      initialOptions: (_travelMode == 'Bus') ? _masterBusOperators : (_travelMode == 'Train' ? _masterTrainProviders : (_travelMode == 'Bus' ? _masterBusProviders : _masterProviders)),
                      onChanged: (v) => setState(() {
                         if (_travelMode == 'Bus') _carrierController.text = v;
                         else _providerController.text = v;
                      }),
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (_travelMode == 'Bus')
                    Expanded(
                      child: SearchableDropdown(
                        label: 'BOOKING AGENT',
                        value: _providerController.text,
                        icon: Icons.support_agent_rounded,
                        initialOptions: _masterBusProviders,
                        onChanged: (v) => setState(() => _providerController.text = v),
                      ),
                    )
                  else
                    const Spacer(),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: SearchableDropdown(
                      label: 'BOARDING POINT',
                      value: _boardingPointController.text,
                      icon: Icons.pin_drop_outlined,
                      isLocation: true,
                      initialOptions: _masterLocations,
                      onChanged: (v) =>
                          setState(() => _boardingPointController.text = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  const Spacer(),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildTextFieldMini(
                      'TICKET NO.',
                      _ticketNoController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextFieldMini('PNR / REF', _pnrController),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildTextFieldMini(
                      _travelMode == 'Train' ? 'TRAIN NAME' : 'CARRIER NAME',
                      _carrierController,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextFieldMini(
                      _travelMode == 'Train' ? 'TR NO.' : 'CARRIER NO.',
                      _travelNoController,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildDropdownMini(
                      _travelMode == 'Intercity Bus' ? 'BUS TYPE' : 'CLASS',
                      _travelClass,
                      _masterClasses,
                      (v) => setState(() => _travelClass = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextFieldMini(
                      'SEAT / BERTH NO.',
                      _seatNoController,
                      icon: Icons.event_seat_rounded,
                    ),
                  ),
                ],
              ),
              if (_travelMode == 'Train') ...[
                const SizedBox(height: 12),
                Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'TATKAL?',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Switch.adaptive(
                        value: _isTatkal,
                        onChanged: (v) => setState(() => _isTatkal = v),
                        activeColor: Colors.deepPurple,
                      ),
                    ],
                  ),
                ),
              ],
            ],
            const SizedBox(height: 20),
            if (_travelMode == 'Flight' || _travelMode == 'Train') ...[
              Row(
                children: [
                  Expanded(
                    child: CheckboxListTile(
                      title: Text(
                        'MEAL INCLUDED?',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      value: _mealIncluded,
                      onChanged: (v) =>
                          setState(() => _mealIncluded = v ?? false),
                      controlAffinity: ListTileControlAffinity.leading,
                      contentPadding: EdgeInsets.zero,
                      dense: true,
                    ),
                  ),
                  if (_travelMode == 'Flight')
                    Expanded(
                      child: CheckboxListTile(
                        title: Text(
                          'EXCESS BAGGAGE?',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        value: _excessBaggage,
                        onChanged: (v) =>
                            setState(() => _excessBaggage = v ?? false),
                        controlAffinity: ListTileControlAffinity.leading,
                        contentPadding: EdgeInsets.zero,
                        dense: true,
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'JOURNEY SCHEDULE',
          icon: Icons.schedule_outlined,
          color: Colors.purple,
          children: [
            Text(
              'ACTUAL TIMINGS',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'ACTUAL DEP DATE',
                    _startDate,
                    (d) => setState(() => _startDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'ACTUAL DEP TIME',
                    _startTime,
                    (t) => setState(() => _startTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'ACTUAL ARR DATE',
                    _endDate,
                    (d) => setState(() => _endDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'ACTUAL ARR TIME',
                    _endTime,
                    (t) => setState(() => _endTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 12),
            Text(
              'SCHEDULED TIMINGS (PER TICKET)',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Colors.grey,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'SCHED DEP DATE',
                    _scheduledStartDate,
                    (d) => setState(() => _scheduledStartDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'SCHED DEP TIME',
                    _scheduledStartTime,
                    (t) => setState(() => _scheduledStartTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'SCHED ARR DATE',
                    _scheduledEndDate,
                    (d) => setState(() => _scheduledEndDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'SCHED ARR TIME',
                    _scheduledEndTime,
                    (t) => setState(() => _scheduledEndTime = t),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'COST & REMARKS',
          icon: Icons.payments_outlined,
          color: Colors.green,
          children: [
            _buildTextFieldMini(
              'FARE / TICKET AMOUNT',
              _amountController,
              prefix: '₹',
              keyboardType: TextInputType.number,
              icon: Icons.payments_outlined,
              onChanged: (v) => setState(() {}),
            ),
            const SizedBox(height: 20),
            _buildTextFieldMini(
              'PURPOSE / REMARKS',
              _jobReportController,
              maxLines: 2,
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildIncidentalSection(),
      ],
    );
  }

  Widget _buildIncidentalSection() {
    return _buildWebCard(
      title: 'INCIDENTAL EXPENSES',
      icon: Icons.receipt_long_rounded,
      color: Colors.deepOrange,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'ITEMIZED LIST',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Colors.grey,
              ),
            ),
            TextButton.icon(
              onPressed: () => setState(() {
                _incidentals.add({
                  'category': null,
                  'amount': '',
                  'bill': null,
                });
              }),
              icon: const Icon(Icons.add_circle_outline_rounded, size: 16),
              label: Text(
                'ADD ITEM',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_incidentals.isEmpty)
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 20),
              child: Text(
                'No incidental items added',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: Colors.grey,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          )
        else
          ...List.generate(_incidentals.length, (index) {
            final inc = _incidentals[index];
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.withOpacity(0.05),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.grey.withOpacity(0.1)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        flex: 2,
                        child: _buildDropdownMini(
                          'CATEGORY',
                          inc['category'],
                          (() {
                            if (widget.category == 'Local Travel') {
                              return _masterLocalIncidentalTypes.isNotEmpty ? _masterLocalIncidentalTypes : _masterIncidentalTypes;
                            }
                            if (widget.category == 'Travel' || widget.category == 'Outstation Travel') {
                              return _masterTravelIncidentalTypes.isNotEmpty ? _masterTravelIncidentalTypes : _masterIncidentalTypes;
                            }
                            return _masterGeneralIncidentalTypes.isNotEmpty ? _masterGeneralIncidentalTypes : _masterIncidentalTypes;
                          })(),
                          (v) => setState(
                            () => _incidentals[index]['category'] = v,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1,
                        child: _buildIncidentalValueField('COST', index),
                      ),
                      const SizedBox(width: 4),
                      _buildIncidentalBillButton(index),
                      IconButton(
                        onPressed: () =>
                            setState(() => _incidentals.removeAt(index)),
                        icon: const Icon(
                          Icons.delete_outline_rounded,
                          color: Colors.red,
                          size: 18,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }),
        const Divider(),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'TOTAL AMOUNT',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w900,
                fontSize: 14,
                color: Colors.blueGrey[800],
              ),
            ),
            Text(
              '₹${(_incidentals.fold<double>(0.0, (sum, item) => sum + (double.tryParse(item['amount']?.toString() ?? '0') ?? 0)) + (double.tryParse(_amountController.text) ?? 0)).toStringAsFixed(2)}',
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w900,
                fontSize: 18,
                color: Colors.blue[700],
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildLocalTravelForm() {
    if (_isTravelo) return _buildTraveloLocalForm();
    return _buildTripLocalTravelForm();
  }

  Widget _buildTripLocalTravelForm() {
    final isOwnVehicle = _travelSubType == 'Own Car' || _travelSubType == 'Own Bike';
    final showOdoCard = isOwnVehicle;

    final start = double.tryParse(_odoStartController.text.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
    final end = double.tryParse(_odoEndController.text.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
    final rate = double.tryParse(_odoRateController.text.replaceAll(RegExp(r'[^0-9.]'), '')) ?? 0.0;
    final dist = (end - start).clamp(0.0, 99999.0);
    final odoTotal = dist * rate;

    double incidentalSum = 0.0;
    for (var inc in _incidentals) {
      incidentalSum += double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
    }

    final totalAmount = isOwnVehicle 
        ? (odoTotal + incidentalSum) 
        : (double.tryParse(_amountController.text) ?? 0.0) + incidentalSum;


    return Column(
      children: [
        // 1. TRANSPORT DETAILS
        _buildWebCard(
          title: 'TRANSPORT DETAILS',
          icon: Icons.directions_car_filled_rounded,
          color: const Color(0xFF4F46E5),
          children: [
            _buildDropdownMini(
              'MODE',
              _travelMode,
              _masterLocalTravelModes,
              (v) => setState(() {
                _travelMode = v ?? '';
                _travelSubType = null;
                _fetchRates();
              }),
              icon: Icons.commute_rounded,
            ),
            if (_travelMode != null && _travelMode!.isNotEmpty) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildDropdownMini(
                      'SUB-TYPE',
                      _travelSubType,
                      (() {
                        final mode = _travelMode?.toLowerCase() ?? '';
                        if (mode == 'public transport') {
                          return _masterLocalProvidersRaw
                              .where((p) => p['is_metro'] == true || p['is_bus'] == true)
                              .map((p) => p['provider_name']?.toString() ?? '')
                              .toList();
                        }
                        return _masterLocalSubTypesRaw.where((m) {
                          if (mode == 'bike') return m['is_bike'] == true;
                          if (mode == 'car') return m['is_car'] == true;
                          if (mode == 'auto') return m['is_auto'] == true;
                          return true;
                        }).map((m) => m['sub_type']?.toString() ?? m['sub_type_name']?.toString() ?? '').where((s) => s.isNotEmpty).toList();
                      })(),
                      (v) => setState(() {
                        _travelSubType = v;
                        _updateRateForSubType(v ?? '');
                        _updateFormTotal();
                      }),
                      icon: Icons.merge_type_rounded,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDropdownMini(
                      'BOOKING TYPE',
                      _bookingType,
                      _masterBookingTypes,
                      (v) => setState(() => _bookingType = v ?? ''),
                      icon: Icons.confirmation_number_rounded,
                    ),
                  ),
                ],
              ),
              if (['Pooling', 'Uber', 'Ola', 'Rental', 'App Based Cab'].map((s) => s.toLowerCase()).contains(_travelSubType?.toLowerCase())) ...[
                const SizedBox(height: 20),
                _buildDropdownMini(
                  'PROVIDER',
                  _providerController.text,
                  _masterLocalProvidersRaw.where((p) {
                    final m = _travelMode?.toLowerCase() ?? '';
                    if (m == 'bike') return p['is_bike'] == true;
                    if (m == 'car') return p['is_car'] == true;
                    if (m == 'auto') return p['is_auto'] == true;
                    return true;
                  }).map((p) => p['provider_name']?.toString() ?? '').toList(),
                  (v) => setState(() => _providerController.text = v ?? ''),
                  icon: Icons.business_rounded,
                ),
              ],
            ],
          ],
        ),
        const SizedBox(height: 20),

        // 2. LOCATION
        _buildWebCard(
          title: 'LOCATION',
          icon: Icons.map_rounded,
          color: const Color(0xFF0EA5E9),
          children: [
            SearchableDropdown(
              label: 'FROM LOCATION',
              value: _originController.text,
              icon: Icons.location_on_rounded,
              isLocation: true,
              initialOptions: _masterLocations,
              onChanged: (v) => setState(() => _originController.text = v),
              enabled: !_isTravelo,
            ),
            const SizedBox(height: 20),
            SearchableDropdown(
              label: 'TO LOCATION',
              value: _destController.text,
              icon: Icons.flag_rounded,
              isLocation: true,
              initialOptions: _masterLocations,
              onChanged: (v) => setState(() => _destController.text = v),
              enabled: !_isTravelo,
            ),
          ],
        ),
        const SizedBox(height: 20),
        // 3. DATE & TIME
        _buildWebCard(
          title: 'DATE & TIME',
          icon: Icons.calendar_today_rounded,
          color: const Color(0xFF8B5CF6),
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini('START DATE', _startDate, (d) => setState(() => _startDate = d)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDatePickerMini('END DATE', _endDate, (d) => setState(() => _endDate = d)),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildTimePickerMini('START TIME', _startTime, (t) => setState(() => _startTime = t)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini('END TIME', _endTime, (t) => setState(() => _endTime = t)),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 20),
            // START SECTION — only if own vehicle (ODO is needed)
            // For hired rides (Ride Bike, Ride Hailing, etc.) show bill upload instead
        // 4. TRACKING (ODO) - Only for own/company vehicles
        if (showOdoCard) ...[
          _buildWebCard(
            title: 'TRACKING (ODO)',
            icon: Icons.speed_rounded,
            color: const Color(0xFF10B981),
            children: [
              _buildOdoSegment(
                label: 'START ODOMETER',
                color: const Color(0xFF4F46E5),
                date: _startDate,
                time: _startTime,
                locationController: _originController,
                odoController: _odoStartController,
                odoImg: _odoStartImg,
                onDate: (d) => setState(() => _startDate = d),
                onTime: (t) => setState(() => _startTime = t),
                onImg: (img) => setState(() => _odoStartImg = img),
                isStart: true,
                isEnabled: true,
                isLocationEnabled: false,
              ),
              const SizedBox(height: 16),
              const Divider(height: 32),
              _buildOdoSegment(
                label: 'END ODOMETER',
                color: const Color(0xFF10B981),
                date: _endDate,
                time: _endTime,
                locationController: _destController,
                odoController: _odoEndController,
                odoImg: _odoEndImg,
                onDate: (d) => setState(() => _endDate = d),
                onTime: (t) => setState(() => _endTime = t),
                onImg: (img) => setState(() => _odoEndImg = img),
                isStart: false,
                isEnabled: true,
                isLocationEnabled: false,
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('TOTAL DISTANCE', style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w900, color: const Color(0xFF166534))),
                    Text('${dist.toStringAsFixed(1)} KM', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w900, color: const Color(0xFF15803D))),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
        ],
        const SizedBox(height: 20),

        // 5. EXPENSE & BILLING
        _buildWebCard(
          title: 'EXPENSE & BILLING',
          icon: Icons.currency_rupee_rounded,
          color: const Color(0xFFF59E0B),
          children: [
            if (isOwnVehicle) ...[
               Row(
                 mainAxisAlignment: MainAxisAlignment.spaceBetween,
                 children: [
                   Text('Fuel Reimbursement', style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.grey[600])),
                   Text('₹${odoTotal.toStringAsFixed(2)}', style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.bold)),
                 ],
               ),
               const Divider(height: 24),
            ],
            
            _buildIncidentalSection(),
            const SizedBox(height: 20),
            
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isOwnVehicle ? 'TOTAL REIMBURSABLE' : 'TOTAL FARE AMOUNT',
                        style: GoogleFonts.plusJakartaSans(fontSize: 9, fontWeight: FontWeight.w800, color: const Color(0xFF64748B), letterSpacing: 0.5),
                      ),
                      Text(
                        '₹${totalAmount.toStringAsFixed(2)}',
                        style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w900, color: const Color(0xFF0F172A)),
                      ),
                    ],
                  ),
                  if (!isOwnVehicle)
                    SizedBox(
                      width: 120,
                      child: _buildTextFieldMini(
                        'EDIT FARE',
                        _amountController,
                        prefix: '₹',
                        keyboardType: TextInputType.number,
                        onChanged: (v) => setState(() {}),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),


        _buildWebCard(
          title: 'SELFIE VERIFICATION',
          icon: Icons.camera_front_rounded,
          color: Colors.teal,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'SELFIE IMAGES',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF64748B),
                    letterSpacing: 0.5,
                  ),
                ),
                TextButton.icon(
                  onPressed: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (context) => const ForensicCamera(),
                      ),
                    );
                    if (result != null &&
                        result is Map &&
                        result['path'] != null) {
                      final bytes = await File(result['path']).readAsBytes();
                      setState(() {
                        _selfieImages.add(
                          'data:image/jpeg;base64,${base64Encode(bytes)}',
                        );
                      });
                    }
                  },
                  icon: const Icon(Icons.add_a_photo_rounded, size: 16),
                  label: Text(
                    'ADD SELFIE',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (_selfieImages.isEmpty)
              Container(
                padding: const EdgeInsets.all(24),
                width: double.infinity,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: const Color(0xFFE2E8F0),
                    style: BorderStyle.solid,
                  ),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.face_retouching_natural_rounded,
                      color: const Color(0xFF94A3B8),
                      size: 32,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Take a selfie image for verification',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF64748B),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 10,
                ),
                itemCount: _selfieImages.length,
                itemBuilder: (context, index) {
                  return Stack(
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(12),
                        child: Image.memory(
                          base64Decode(_selfieImages[index]),
                          fit: BoxFit.cover,
                          width: double.infinity,
                          height: double.infinity,
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 4,
                        child: InkWell(
                          onTap: () =>
                              setState(() => _selfieImages.removeAt(index)),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: Colors.black54,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.close,
                              color: Colors.white,
                              size: 14,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
          ],
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildTraveloLocalForm() {
    bool isStartFieldsComplete =
        _originController.text.isNotEmpty &&
        _odoStartController.text.isNotEmpty &&
        _odoStartImg != null;

    double startOdo =
        double.tryParse(
          _odoStartController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
        ) ??
        0;
    double endOdo =
        double.tryParse(
          _odoEndController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
        ) ??
        0;
    double dist = (endOdo - startOdo).clamp(0, 99999);
    double rate =
        double.tryParse(
          _odoRateController.text.replaceAll(RegExp(r'[^0-9.]'), ''),
        ) ??
        0.0;
    double odoTotal = dist * rate;

    double incidentalSum = 0.0;
    for (var inc in _incidentals) {
      incidentalSum += double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
    }
    double dayTotal = odoTotal + incidentalSum;

    return Column(
      children: [
        // Premium Form Header - Live Dashboard Look
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
            ),
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withOpacity(0.2),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ESTIMATED TOTAL',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white.withOpacity(0.6),
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${dayTotal.toStringAsFixed(2)}',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 24,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Column(
                  children: [
                    Text(
                      '${dist.toStringAsFixed(1)} KM',
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white,
                        fontWeight: FontWeight.w900,
                        fontSize: 16,
                      ),
                    ),
                    Text(
                      'DISTANCE',
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white.withOpacity(0.6),
                        fontWeight: FontWeight.w800,
                        fontSize: 8,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),

        _buildWebCard(
          title: 'LOCATION & ODOMETER LOGS',
          icon: Icons.map_rounded,
          color: const Color(0xFF4F46E5),
          children: [
            if (_isTravelo && !_isDeviated) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFF7ED),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFFFEDD5)),
                ),
                child: Column(
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.info_outline_rounded, color: Color(0xFFD97706), size: 16),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Planned locations are locked. Use buttons below to record changes.',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: const Color(0xFF92400E),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: _showDeviationDialog,
                            icon: const Icon(Icons.alt_route_rounded, size: 14),
                            label: const Text('DEVIATE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _showSkipDialog,
                            icon: const Icon(Icons.cancel_outlined, size: 14),
                            label: const Text('NOT VISITED', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Colors.red),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            if (_isDeviated) ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFF0FDF4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: const Color(0xFFBBF7D0)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 16),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Deviated: ${_deviationTarget ?? ""} - ${_deviationReason ?? ""}',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF166534),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
            // CATEGORY SELECTOR (Vehicle vs Public Transport)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() {
                        _isPublicTransport = false;
                        if (_travelMode == 'Public Transport' || _travelMode == null) {
                          _travelMode = 'Bike';
                          _travelSubType = 'Own Bike';
                          _updateRateForSubType(_travelSubType);
                        }
                        _updateFormTotal();
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: !_isPublicTransport ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: !_isPublicTransport ? [
                            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))
                          ] : [],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.directions_car_rounded, size: 16, color: !_isPublicTransport ? const Color(0xFF4F46E5) : const Color(0xFF64748B)),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                'VEHICLE (ODO)',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: !_isPublicTransport ? const Color(0xFF4F46E5) : const Color(0xFF64748B),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  Expanded(
                    child: InkWell(
                      onTap: () => setState(() {
                        _isPublicTransport = true;
                        if (_travelMode != 'Public Transport') {
                          _travelMode = 'Public Transport';
                          _travelSubType = 'Auto';
                        }
                        // Clear 0.00 if present to show hint
                        if (_amountController.text == '0.00' || _amountController.text == '0') {
                          _amountController.text = '';
                        }
                        _updateFormTotal();
                      }),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        decoration: BoxDecoration(
                          color: _isPublicTransport ? Colors.white : Colors.transparent,
                          borderRadius: BorderRadius.circular(12),
                          boxShadow: _isPublicTransport ? [
                            BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))
                          ] : [],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.directions_bus_rounded, size: 16, color: _isPublicTransport ? const Color(0xFF4F46E5) : const Color(0xFF64748B)),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                'OTHERS (BUS/AUTO)',
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: _isPublicTransport ? const Color(0xFF4F46E5) : const Color(0xFF64748B),
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            if (!_isPublicTransport) ...[
               if (['Own Car', 'Company Car', 'Own Bike', 'Self Drive Rental'].contains(_travelSubType)) ...[
                 // START SECTION
              _buildOdoSegment(
                label: 'START JOURNEY DETAILS',
                color: const Color(0xFF4F46E5),
                date: _startDate,
                time: _startTime,
                locationController: _originController,
                odoController: _odoStartController,
                odoImg: _odoStartImg,
                onDate: (d) => setState(() => _startDate = d),
                onTime: (t) => setState(() => _startTime = t),
                onImg: (img) => setState(() => _odoStartImg = img),
                isStart: true,
                isEnabled: true,
                isLocationEnabled: !_isTravelo,
              ),
              const SizedBox(height: 32),
              // Functional Divider
              Row(
                children: [
                  Expanded(child: Divider(color: Colors.grey.withOpacity(0.1))),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Icon(
                      Icons.arrow_downward_rounded,
                      size: 16,
                      color: Colors.grey.withOpacity(0.3),
                    ),
                  ),
                  Expanded(child: Divider(color: Colors.grey.withOpacity(0.1))),
                ],
              ),
              const SizedBox(height: 32),
              // END SECTION
              AbsorbPointer(
                absorbing: !isStartFieldsComplete,
                child: Opacity(
                  opacity: isStartFieldsComplete ? 1.0 : 0.5,
                  child: _buildOdoSegment(
                    label: 'END JOURNEY DETAILS',
                    color: const Color(0xFF10B981),
                    date: _endDate,
                    time: _endTime,
                    locationController: _destController,
                    odoController: _odoEndController,
                    odoImg: _odoEndImg,
                    onDate: (d) => setState(() => _endDate = d),
                    onTime: (t) => setState(() => _endTime = t),
                    onImg: (img) => setState(() => _odoEndImg = img),
                    isStart: false,
                    isEnabled: isStartFieldsComplete,
                    isLocationEnabled: !_isTravelo,
                  ),
                ),
              ),
            ],
              ] else ...[
                 Center(
                   child: Padding(
                     padding: const EdgeInsets.all(24.0),
                     child: Column(
                       children: [
                         Icon(Icons.info_outline_rounded, size: 48, color: Colors.grey.withOpacity(0.3)),
                         const SizedBox(height: 12),
                         Text(
                           'ODO tracking is not required for this mode.',
                           style: GoogleFonts.plusJakartaSans(color: Colors.grey, fontSize: 12),
                         ),
                       ],
                     ),
                   ),
                 ),
              ],
          ],
        ),
        if (_isPublicTransport)
          _buildWebCard(
            title: 'CONVEYANCE LOGS',
            icon: Icons.alt_route_rounded,
            color: const Color(0xFF0D9488),
            children: [
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: _buildDatePickerMini('DATE', _startDate, (d) => setState(() => _startDate = d)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: _buildTimePickerMini('TIME', _startTime, (t) => setState(() => _startTime = t)),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildModernTextField(
                      label: 'ORIGIN',
                      controller: _originController,
                      hint: 'Starting point',
                      icon: Icons.location_on_rounded,
                      enabled: !_isTravelo,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildModernTextField(
                      label: 'DESTINATION',
                      controller: _destController,
                      hint: 'Target location',
                      icon: Icons.flag_rounded,
                      enabled: !_isTravelo,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: _buildDropdownMini(
                      'TYPE / PUBLIC MODE',
                      _travelSubType,
                      const ['Auto', 'Bus', 'Taxi', 'Metro', 'Rickshaw', 'Other'],
                      (v) => setState(() => _travelSubType = v),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: (_travelSubType == 'Auto' || _isPublicTransport) 
                      ? _buildTextFieldMini(
                        'AMOUNT (₹)',
                        _amountController,
                        keyboardType: TextInputType.number,
                        hint: 'Enter cost',
                        icon: Icons.currency_rupee_rounded,
                        )
                      : const SizedBox.shrink(),
                  ),
                ],
              ),
            ],
          ),
            
        // Web parity: Incidental section only for vehicle owners
        if (!_isPublicTransport && ['Own Car', 'Company Car', 'Own Bike', 'Company Bike'].contains(_travelSubType))
           _buildIncidentalSection(),
           
        const SizedBox(height: 24),
        // Professional Insight Card
        Builder(
          builder: (context) {
            final isOwnVehicle =
                _travelSubType == 'Own Car' || _travelSubType == 'Own Bike';
            return Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'ODO DISTANCE',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w800,
                              fontSize: 9,
                              color: const Color(0xFF64748B),
                              letterSpacing: 0.5,
                            ),
                          ),
                          Text(
                            '${dist.toStringAsFixed(1)} KM',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w900,
                              fontSize: 16,
                              color: const Color(0xFF4F46E5),
                            ),
                          ),
                        ],
                      ),
                      Container(
                        width: 1,
                        height: 30,
                        color: const Color(0xFFE2E8F0),
                      ),
                      if (isOwnVehicle) ...[
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'ODO RATE (₹/KM)',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w800,
                                fontSize: 9,
                                color: const Color(0xFF64748B),
                                letterSpacing: 0.5,
                              ),
                            ),
                            Text(
                              '₹${_odoRateController.text.isNotEmpty ? _odoRateController.text : '-'}/km',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w900,
                                fontSize: 16,
                                color: const Color(0xFF10B981),
                              ),
                            ),
                          ],
                        ),
                      ] else ...[
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'AMOUNT (₹)',
                              style: GoogleFonts.plusJakartaSans(
                                fontWeight: FontWeight.w800,
                                fontSize: 9,
                                color: const Color(0xFF64748B),
                                letterSpacing: 0.5,
                              ),
                            ),
                            SizedBox(
                              width: 100,
                              height: 28,
                              child: TextFormField(
                                controller: _amountController,
                                keyboardType: TextInputType.number,
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 16,
                                  color: const Color(0xFF4F46E5),
                                ),
                                textAlign: TextAlign.right,
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  contentPadding: EdgeInsets.zero,
                                  hintText: '0',
                                  prefixText: '₹',
                                ),
                                onChanged: (v) => setState(() {}),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ],
                  ),
                  if (isOwnVehicle) ...[
                    const SizedBox(height: 12),
                    const Divider(),
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'ODOMETER EXPENSE',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w800,
                                  fontSize: 9,
                                  color: const Color(0xFF64748B),
                                  letterSpacing: 0.5,
                                ),
                              ),
                              Text(
                                '₹${odoTotal.toStringAsFixed(2)}',
                                style: GoogleFonts.plusJakartaSans(
                                  fontWeight: FontWeight.w900,
                                  fontSize: 18,
                                  color: const Color(0xFF10B981),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        TextButton.icon(
                          onPressed: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    JobReportComposerScreen(
                                      travelId: widget.tripId,
                                      initialReport:
                                          _jobReportController.text,
                                      initialAttachments:
                                          _jobReportAttachments,
                                      onSave: (text, attachments) async {
                                        setState(() {
                                          _jobReportController.text = text;
                                          _jobReportAttachments =
                                              attachments;
                                        });
                                      },
                                    ),
                              ),
                            );
                          },
                          icon: const Icon(
                            Icons.edit_note_rounded,
                            size: 18,
                          ),
                          label: Text(
                            'WRITE REPORT',
                            style: GoogleFonts.plusJakartaSans(
                              fontWeight: FontWeight.w900,
                              fontSize: 11,
                              letterSpacing: 0.5,
                            ),
                          ),
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF334155),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 16,
                              vertical: 8,
                            ),
                            backgroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: const BorderSide(
                                color: Color(0xFFE2E8F0),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ] else ...[
                    const SizedBox(height: 12),
                    const Divider(),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(
                          Icons.info_outline_rounded,
                          size: 14,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Fare/cost amount to be entered manually for this travel type.',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              color: const Color(0xFF94A3B8),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            );
          },
        ),
        
        // INCIDENTAL SECTION
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 12),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'INCIDENTAL EXPENSES (OPTIONAL)',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF64748B),
                      letterSpacing: 1,
                    ),
                  ),
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () {
                        setState(() {
                          _incidentals.add({
                            'category': 'Toll',
                            'amount': '',
                            'bill': null,
                          });
                        });
                        _updateFormTotal();
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF4F46E5).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.add_rounded,
                              color: Color(0xFF4F46E5),
                              size: 14,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'ADD NEW',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 9,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF4F46E5),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_incidentals.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 40),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFF1F5F9)),
                ),
                child: Column(
                  children: [
                    Icon(
                      Icons.add_card_rounded,
                      color: const Color(0xFFCBD5E1),
                      size: 32,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'No incidental expenses logged',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              )
            else
              ...List.generate(_incidentals.length, (index) {
                final inc = _incidentals[index];
                return Container(
                  margin: const EdgeInsets.only(bottom: 12),
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.04),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Expanded(
                            flex: 2,
                            child: _buildDropdownMini(
                              'CATEGORY',
                              inc['category'],
                              _masterIncidentalTypes.isNotEmpty
                                  ? _masterIncidentalTypes
                                  : ['Toll', 'Parking', 'Repairs', 'Cleaning', 'Other'],
                              (v) => setState(
                                () => _incidentals[index]['category'] = v,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            flex: 1,
                            child: _buildIncidentalValueField('COST', index),
                          ),
                          const SizedBox(width: 8),
                          _buildIncidentalBillButton(index),
                          const SizedBox(width: 4),
                          IconButton(
                            onPressed: () {
                              setState(() => _incidentals.removeAt(index));
                              _updateFormTotal();
                            },
                            icon: const Icon(
                              Icons.delete_outline_rounded,
                              color: Colors.redAccent,
                              size: 18,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              }),
          ],
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildIncidentalValueField(String label, int index) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: _incidentals[index]['amount'].toString(),
          keyboardType: TextInputType.number,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
          onChanged: (v) {
            _incidentals[index]['amount'] = v;
            _updateFormTotal();
          },
          decoration: InputDecoration(
            prefixText: '₹',
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildIncidentalBillButton(int index) {
    final hasBill = _incidentals[index]['bill'] != null;
    return Column(
      children: [
        Text(
          'Bill',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () async {
            final result = await Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const ForensicCamera()),
            );
            if (result != null && result is Map) {
              final bytes = await File(result['path']).readAsBytes();
              setState(() => _incidentals[index]['bill'] = base64Encode(bytes));
            }
          },
          child: Container(
            height: 48,
            width: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: hasBill ? Colors.blue : const Color(0xFFE2E8F0),
              ),
            ),
            child: Icon(
              hasBill ? Icons.check_circle_rounded : Icons.camera_alt_rounded,
              size: 20,
              color: hasBill ? Colors.blue : const Color(0xFF94A3B8),
            ),
          ),
        ),
      ],
    );
  }

  void _showDeviationDialog() {
    final reasonCtrl = TextEditingController(text: _deviationReason);
    final targetCtrl = TextEditingController(text: _deviationTarget);
    final actualFromCtrl = TextEditingController(text: _originController.text);
    final actualToCtrl = TextEditingController(text: _destController.text);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'RECORD DEVIATION',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, fontSize: 16),
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Provide details for the actual route taken.',
                style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.grey),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Reason for Deviation',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: targetCtrl,
                decoration: const InputDecoration(
                  labelText: 'Visited Person / Office',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: actualFromCtrl,
                decoration: const InputDecoration(
                  labelText: 'Actual From (Location)',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: actualToCtrl,
                decoration: const InputDecoration(
                  labelText: 'Actual To (Location)',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () {
              if (reasonCtrl.text.trim().isEmpty) return;
              setState(() {
                _isDeviated = true;
                _deviationReason = reasonCtrl.text.trim();
                _deviationTarget = targetCtrl.text.trim();
                _originController.text = actualFromCtrl.text.trim();
                _destController.text = actualToCtrl.text.trim();
              });
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Deviation recorded. Locations updated.')),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF59E0B)),
            child: const Text('CONFIRM', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showSkipDialog() {
    final reasonCtrl = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'MARK AS NOT VISITED',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, fontSize: 16, color: Colors.red),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Marking this stop as cancelled. Amount will be set to 0.',
              style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: reasonCtrl,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Reason for Cancellation',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('CANCEL'),
          ),
          ElevatedButton(
            onPressed: () {
              if (reasonCtrl.text.trim().isEmpty) return;
              setState(() {
                _isDeviated = true;
                _deviationReason = '[Skipped] ${reasonCtrl.text.trim()}';
                _travelStatus = 'Cancelled';
                _amountController.text = '0';
              });
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Stop marked as Not Visited.'), backgroundColor: Colors.red),
              );
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('MARK CANCELLED', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Widget _buildOdoSegment({
    required String label,
    required Color color,
    required DateTime date,
    required TimeOfDay time,
    required TextEditingController locationController,
    required TextEditingController odoController,
    String? odoImg,
    required Function(DateTime) onDate,
    required Function(TimeOfDay) onTime,
    required Function(String) onImg,
    required bool isStart,
    required bool isEnabled,
    bool isLocationEnabled = true,
  }) {
    final now = DateTime.now();
    final bool isDateToday =
        date.year == now.year && date.month == now.month && date.day == now.day;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 4,
              height: 12,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            Text(
              label.toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: color,
                letterSpacing: 1,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              flex: 3,
              child: _buildDatePickerMini('DATE', date, onDate),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: _buildTimePickerMini('TIME', time, onTime),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Expanded(
              flex: 3,
              child: SearchableDropdown(
                label: 'LOCATION',
                value: locationController.text,
                hint: isStart ? 'Origin' : 'Destination',
                icon: Icons.location_on_outlined,
                enabled: isLocationEnabled,
                isLocation: true,
                initialOptions: _masterLocations,
                onChanged: (v) => setState(() => locationController.text = v),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: _buildTextFieldMini(
                'ODO READING',
                odoController,
                keyboardType: TextInputType.number,
                hint: 'e.g. 12345',
                enabled: isDateToday,
              ),
            ),
            const SizedBox(width: 8),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'ODO PHOTO',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 9,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8),
                  ),
                ),
                const SizedBox(height: 8),
                AbsorbPointer(
                  absorbing: odoImg != null || !isDateToday,
                  child: InkWell(
                    onTap: (odoImg != null || !isDateToday)
                        ? null
                        : () async {
                            final result = await Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (_) => const ForensicCamera(),
                              ),
                            );
                            if (result != null && result is Map) {
                              final bytes = await File(
                                result['path'],
                              ).readAsBytes();
                              onImg(
                                'data:image/jpeg;base64,${base64Encode(bytes)}',
                              );
                              setState(() {
                                if (isStart) {
                                  _odoStartLat = result['latitude'];
                                  _odoStartLong = result['longitude'];
                                } else {
                                  _odoEndLat = result['latitude'];
                                  _odoEndLong = result['longitude'];
                                }
                              });
                            }
                          },
                    child: Container(
                      height: 48,
                      width: 80,
                      decoration: BoxDecoration(
                        color: odoImg != null
                            ? const Color(0xFFDCFCE7)
                            : !isDateToday
                            ? const Color(0xFFF1F5F9)
                            : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: odoImg != null
                              ? const Color(0xFF10B981)
                              : !isDateToday
                              ? const Color(0xFFCBD5E1)
                              : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: odoImg != null
                          ? const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.check_circle_rounded,
                                  size: 14,
                                  color: Color(0xFF10B981),
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Captured',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF10B981),
                                  ),
                                ),
                              ],
                            )
                          : Center(
                              child: Icon(
                                Icons.camera_alt_rounded,
                                size: 18,
                                color: const Color(0xFF94A3B8),
                              ),
                            ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFoodForm() {
    final isSelfMeal = _mealCategory == 'Self Meal';
    final sourceLower = _mealSource?.toLowerCase() ?? '';
    final showSource = isSelfMeal;
    final showProvider = isSelfMeal && sourceLower == 'online';
    final showHotel = isSelfMeal && (sourceLower == 'hotel' || sourceLower == 'online');
    final showRestaurant = isSelfMeal && sourceLower == 'restaurant';

    return Column(
      children: [
        _buildWebCard(
          title: 'DATE & TIME',
          icon: Icons.calendar_today_rounded,
          color: const Color(0xFF0D9488),
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'DATE',
                    _startDate,
                    (d) => setState(() => _startDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'TIME',
                    _startTime,
                    (t) => setState(() => _startTime = t),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'MEAL INFO',
          icon: Icons.coffee_rounded,
          color: const Color(0xFF0EA5E9),
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDropdownMini(
                    'MEAL TYPE',
                    _mealType,
                    _masterMealTypes,
                    (v) => setState(() => _mealType = v ?? ''),
                    icon: Icons.restaurant_menu_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'MEAL TIME',
                    _startTime,
                    (t) => setState(() => _startTime = t),
                  ),
                ),
              ],
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'MEAL CATEGORY & SOURCE',
          icon: Icons.receipt_rounded,
          color: const Color(0xFF0284C7),
          children: [
            _buildDropdownMini(
              'CATEGORY',
              _mealCategory,
              _masterMealCategories,
              (v) => setState(() {
                _mealCategory = v ?? '';
                if (v != 'Self Meal') {
                  _amountController.text = '0.00';
                }
              }),
              icon: Icons.category_rounded,
            ),
            if (showSource) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _buildDropdownMini(
                      'SOURCE',
                      _mealSource,
                      _masterMealSources,
                      (v) => setState(() => _mealSource = v ?? ''),
                      icon: Icons.source_rounded,
                    ),
                  ),
                  if (showProvider) ...[
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildDropdownMini(
                        'PROVIDER',
                        _mealProvider,
                        _masterMealProviders,
                        (v) => setState(() => _mealProvider = v ?? ''),
                        icon: Icons.delivery_dining_rounded,
                      ),
                    ),
                  ],
                ],
              ),
            ],
            if (showHotel) ...[
              const SizedBox(height: 20),
              _buildTextFieldMini(
                sourceLower == 'online' ? 'HOTEL / OUTLET NAME' : 'HOTEL NAME',
                _hotelNameController,
                icon: Icons.storefront_rounded,
                hint: 'Enter name...',
              ),
            ],
            if (showRestaurant) ...[
              const SizedBox(height: 20),
              _buildTextFieldMini(
                'RESTAURANT NAME',
                _restaurantController,
                icon: Icons.restaurant_rounded,
                hint: 'Enter restaurant name...',
              ),
            ],
            if (_mealCategory == 'Working Meal' ||
                _mealCategory == 'Client Hosted') ...[
              const SizedBox(height: 20),
              _buildTextFieldMini(
                'NO. OF PERSONS (PAX)',
                _personsController,
                keyboardType: TextInputType.number,
                icon: Icons.people_outline,
              ),
            ],
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'EXPENSE',
          icon: Icons.currency_rupee_rounded,
          color: const Color(0xFF0369A1),
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildTextFieldMini(
                    'INVOICE NO',
                    _invoiceNoController,
                    hint: 'Optional',
                    icon: Icons.receipt_long_rounded,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTextFieldMini(
                    'AMOUNT',
                    _amountController,
                    prefix: '₹',
                    keyboardType: TextInputType.number,
                    icon: Icons.payments_outlined,
                    enabled: isSelfMeal,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }


  Widget _buildAccommodationForm() {
    final showBookingId = _bookingType == 'Online Booking';
    final showBookingSource = _bookingType != 'Walkin' && _bookingType != null;

    return Column(
      children: [
        _buildWebCard(
          title: 'STAY TIMELINE',
          icon: Icons.history_edu_rounded,
          color: const Color(0xFF64748B),
          children: [
            Text(
              'SCHEDULED',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF64748B),
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'CHECK-IN DATE',
                    _scheduledStartDate,
                    (d) => setState(() => _scheduledStartDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'CHECK-IN TIME',
                    _scheduledStartTime,
                    (t) => setState(() => _scheduledStartTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'CHECK-OUT DATE',
                    _scheduledEndDate,
                    (d) => setState(() => _scheduledEndDate = d),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'CHECK-OUT TIME',
                    _scheduledEndTime,
                    (t) => setState(() => _scheduledEndTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            const Divider(),
            const SizedBox(height: 20),
            Text(
              'ACTUAL',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0D9488),
                letterSpacing: 1,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'CHECK-IN DATE',
                    _startDate,
                    (d) => setState(() {
                      _startDate = d;
                      _calculateNights();
                    }),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'CHECK-IN TIME',
                    _startTime,
                    (t) => setState(() => _startTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: _buildDatePickerMini(
                    'CHECK-OUT DATE',
                    _endDate,
                    (d) => setState(() {
                      _endDate = d;
                      _calculateNights();
                    }),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTimePickerMini(
                    'CHECK-OUT TIME',
                    _endTime,
                    (t) => setState(() => _endTime = t),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.nights_stay_rounded,
                      size: 14, color: Color(0xFF64748B)),
                  const SizedBox(width: 8),
                  Text(
                    'NIGHTS: ',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  Text(
                    _nightsController.text,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'LODGING INFO',
          icon: Icons.hotel_rounded,
          color: const Color(0xFF0EA5E9),
          children: [
            _buildDropdownMini(
              'STAY TYPE',
              _accomType,
              _masterStayTypes,
              (v) => setState(() => _accomType = v ?? ''),
              icon: Icons.hotel_rounded,
            ),
            const SizedBox(height: 20),
            if (['Hotel Stay', 'Guest House'].contains(_accomType)) ...[
              _buildTextFieldMini(
                _accomType == 'Guest House' ? 'GUEST HOUSE INFO' : 'HOTEL NAME',
                _hotelNameController,
                icon: Icons.store_mall_directory_rounded,
                hint: 'Enter name...',
              ),
              const SizedBox(height: 20),
              _buildTextFieldMini(
                'CITY',
                _cityController,
                icon: Icons.location_city_rounded,
                hint: 'Enter city',
              ),
              const SizedBox(height: 20),
            ],
            _buildTextFieldMini(
              'REMARKS',
              _jobReportController,
              icon: Icons.edit_note_rounded,
              hint: 'Enter remarks',
              maxLines: 2,
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'BOOKING DETAILS',
          icon: Icons.confirmation_number_rounded,
          color: const Color(0xFF0284C7),
          children: [
            Row(
              children: [
                Expanded(
                  child: _buildDropdownMini(
                    'BOOKING TYPE',
                    _bookingType,
                    _masterStayBookingTypes,
                    (v) => setState(() {
                      _bookingType = v ?? '';
                      if (v == 'Company Booking') {
                        _baseFareController.text = '0.00';
                        _earlyCheckInController.text = '0.00';
                        _lateCheckOutController.text = '0.00';
                        _updateFormTotal();
                      }
                    }),
                    icon: Icons.book_online_rounded,
                  ),
                ),
                if (showBookingSource) ...[
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildDropdownMini(
                      'BOOKING SOURCE',
                      _bookingSource,
                      _masterStayBookingSources,
                      (v) => setState(() => _bookingSource = v ?? ''),
                      icon: Icons.source_outlined,
                    ),
                  ),
                ],
              ],
            ),
            if (showBookingId) ...[
              const SizedBox(height: 20),
              _buildTextFieldMini(
                'BOOKING ID',
                _bookingIdController,
                icon: Icons.confirmation_number_outlined,
                hint: 'Enter Online Booking ID',
              ),
            ],
          ],
        ),
        const SizedBox(height: 20),
        _buildWebCard(
          title: 'EXPENSE & BILLING',
          icon: Icons.currency_rupee_rounded,
          color: const Color(0xFF0369A1),
          children: [
            _buildTextFieldMini(
              'BASE AMOUNT',
              _baseFareController,
              prefix: '₹',
              keyboardType: TextInputType.number,
              icon: Icons.payments_outlined,
              enabled: _bookingType != 'Company Booking',
              onChanged: (v) => _updateFormTotal(),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _buildTextFieldMini(
                    'EARLY CHECK-IN',
                    _earlyCheckInController,
                    prefix: '₹',
                    keyboardType: TextInputType.number,
                    icon: Icons.more_time_rounded,
                    onChanged: (v) => _updateFormTotal(),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTextFieldMini(
                    'LATE CHECK-OUT',
                    _lateCheckOutController,
                    prefix: '₹',
                    keyboardType: TextInputType.number,
                    icon: Icons.history_rounded,
                    onChanged: (v) => _updateFormTotal(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFCCFBF1)),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'TOTAL AMOUNT',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF134E4A),
                    ),
                  ),
                  Text(
                    '₹${_amountController.text}',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0D9488),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }



  Widget _buildIncidentalForm() {
    final showOtherReason = _incidentalType?.toLowerCase() == 'others';

    // Pick the right subset based on which form we're in, matching web app logic:
    //   - Outstation / Business Trip  → general_incidental
    //   - Local Travel               → local_conveyance
    //   - otherwise fallback to all
    List<String> incidentalOptions;
    final cat = widget.category.toLowerCase();
    if (cat.contains('local')) {
      incidentalOptions = _masterLocalIncidentalTypes.isNotEmpty
          ? _masterLocalIncidentalTypes
          : _masterIncidentalTypes;
    } else if (cat.contains('outstation') || cat.contains('travel')) {
      incidentalOptions = _masterTravelIncidentalTypes.isNotEmpty
          ? _masterTravelIncidentalTypes
          : _masterIncidentalTypes;
    } else {
      // General / Incidental category
      incidentalOptions = _masterGeneralIncidentalTypes.isNotEmpty
          ? _masterGeneralIncidentalTypes
          : _masterIncidentalTypes;
    }

    return _buildWebCard(
      title: 'INCIDENTAL EXPENSE',
      icon: Icons.miscellaneous_services_rounded,
      color: Colors.blueGrey,
      children: [
        Row(
          children: [
            Expanded(
              child: _buildDatePickerMini(
                'DATE',
                _startDate,
                (d) => setState(() => _startDate = d),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTimePickerMini(
                'TIME',
                _startTime,
                (t) => setState(() => _startTime = t),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _buildDropdownMini(
                'INCIDENTAL TYPE',
                _incidentalType,
                incidentalOptions,
                (v) => setState(() => _incidentalType = v ?? ''),
                icon: Icons.category_outlined,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTextFieldMini(
                'INVOICE NO',
                _invoiceNoController,
                icon: Icons.receipt_long_rounded,
                hint: 'Optional',
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _buildTextFieldMini(
                'LOCATION',
                _cityController,
                icon: Icons.location_on_rounded,
                hint: 'Enter location',
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTextFieldMini(
                'AMOUNT',
                _amountController,
                prefix: '₹',
                keyboardType: TextInputType.number,
                icon: Icons.payments_outlined,
              ),
            ),
          ],
        ),
        if (showOtherReason) ...[
          const SizedBox(height: 20),
          _buildTextFieldMini(
            'REASON',
            _reasonController,
            icon: Icons.help_outline_rounded,
            hint: 'Why this expense?',
          ),
        ],
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'REMARKS / DETAILS',
          _jobReportController,
          maxLines: 2,
          icon: Icons.edit_note_rounded,
          hint: 'Add a short note...',
        ),
      ],
    );
  }

  // UI HELPERS
  Widget _buildWebCard({
    required String title,
    required IconData icon,
    required Color color,
    required List<Widget> children,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(28),
                topRight: Radius.circular(28),
              ),
              border: Border(
                bottom: BorderSide(
                  color: const Color(0xFFCCFBF1).withOpacity(0.5),
                ),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: color.withOpacity(0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(icon, color: color, size: 16),
                ),
                const SizedBox(width: 14),
                Text(
                  title.toUpperCase(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: const Color(0xFF134E4A),
                    letterSpacing: 1,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(24),
            child: Column(children: children),
          ),
        ],
      ),
    );
  }

  Widget _buildTextFieldMini(
    String label,
    TextEditingController controller, {
    String? hint,
    String? prefix,
    int maxLines = 1,
    TextInputType? keyboardType,
    IconData? icon,
    bool enabled = true,
    Function(String)? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          keyboardType: keyboardType,
          enabled: enabled,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: enabled ? const Color(0xFF134E4A) : const Color(0xFF94A3B8),
          ),
          onChanged: (v) {
            if (onChanged != null) onChanged(v);
            setState(() {});
          },
          decoration: InputDecoration(
            hintText: hint,
            prefixText: prefix,
            prefixIcon: icon != null
                ? Icon(icon, size: 18, color: const Color(0xFF0F766E))
                : null,
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF0F766E), width: 1.5),
            ),
            errorStyle: GoogleFonts.plusJakartaSans(
              fontSize: 10,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildModernTextField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    String? hint,
    Function(String)? onChanged,
    bool enabled = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          onChanged: onChanged,
          enabled: enabled,
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.bold,
            fontSize: 15,
          ),
          decoration: InputDecoration(
            hintText: hint,
            prefixIcon: Icon(icon, size: 18),
            filled: true,
            fillColor: enabled ? Colors.white : Colors.grey.withOpacity(0.05),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownMini(
    String label,
    String? value,
    List<String> options,
    Function(String?) onChanged, {
    IconData? icon,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 6),
        Container(
          height: 48,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDFA),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFCCFBF1)),
          ),
          child: InkWell(
            onTap: () {}, // Handled by PopupMenuButton
            borderRadius: BorderRadius.circular(16),
            child: Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16, color: const Color(0xFF0D9488)),
                  const SizedBox(width: 8),
                ],
                Expanded(
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      hoverColor: Colors.transparent,
                      splashColor: Colors.transparent,
                      highlightColor: Colors.transparent,
                    ),
                    child: PopupMenuButton<String>(
                      initialValue: value,
                      tooltip: 'Select $label',
                      onSelected: onChanged,
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 150),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      offset: const Offset(0, 48), // Opens right below the field
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              (value == null || value!.isEmpty) ? 'Select' : value!,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 14,
                                fontWeight: (value == null || value!.isEmpty)
                                    ? FontWeight.w500
                                    : FontWeight.w700,
                                color: (value == null || value!.isEmpty)
                                    ? const Color(0xFF94A3B8)
                                    : const Color(0xFF134E4A),
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: Color(0xFF0D9488),
                            size: 18,
                          ),
                        ],
                      ),
                      itemBuilder: (context) => options
                          .map(
                            (String val) => PopupMenuItem(
                              value: val,
                              child: Text(
                                val,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF134E4A),
                                ),
                              ),
                            ),
                          )
                          .toList(),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDatePickerMini(
    String label,
    DateTime value,
    Function(DateTime) onType,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: () async {
            final d = await showDatePicker(
              context: context,
              initialDate: value,
              firstDate: DateTime(2023),
              lastDate: DateTime(2030),
              builder: (context, child) {
                return Theme(
                  data: Theme.of(context).copyWith(
                    colorScheme: const ColorScheme.light(
                      primary: Color(0xFF0D9488),
                      onPrimary: Colors.white,
                      onSurface: Color(0xFF134E4A),
                    ),
                  ),
                  child: child!,
                );
              },
            );
            if (d != null) onType(d);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  DateFormat('dd MMM yyyy').format(value),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF134E4A),
                  ),
                ),
                const Icon(
                  Icons.calendar_today_rounded,
                  size: 18,
                  color: Color(0xFF0D9488),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTimePickerMini(
    String label,
    TimeOfDay value,
    Function(TimeOfDay) onType,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: () async {
            final t = await showTimePicker(
              context: context,
              initialTime: value,
            );
            if (t != null) onType(t);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  value.format(context),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF134E4A),
                  ),
                ),
                const Icon(
                  Icons.access_time_filled_rounded,
                  size: 18,
                  color: Color(0xFF0D9488),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Future<void> _addAttachment() async {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFE2E8F0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'ADD ATTACHMENT / BILL',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF134E4A),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _pickerOption(
                    icon: Icons.camera_alt_rounded,
                    label: 'Camera',
                    color: const Color(0xFF0D9488),
                    onTap: () async {
                      Navigator.pop(context);
                      final result = await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => const ForensicCamera(),
                        ),
                      );
                      if (result != null &&
                          result is Map &&
                          result['path'] != null) {
                        final bytes = await File(result['path']).readAsBytes();
                        setState(() {
                          _expenseBills.add(
                            'data:image/jpeg;base64,${base64Encode(bytes)}',
                          );
                        });
                      }
                    },
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _pickerOption(
                    icon: Icons.photo_library_rounded,
                    label: 'Gallery',
                    color: const Color(0xFF0D9488),
                    onTap: () async {
                      Navigator.pop(context);
                      final XFile? image = await picker.pickImage(
                        source: ImageSource.gallery,
                        imageQuality: 70,
                      );
                      if (image != null) {
                        final bytes = await image.readAsBytes();
                        setState(() {
                          _expenseBills.add(
                            'data:image/jpeg;base64,${base64Encode(bytes)}',
                          );
                        });
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _pickerOption({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          color: color.withOpacity(0.05),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: color.withOpacity(0.1)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 32),
            const SizedBox(height: 12),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w800,
                fontSize: 13,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttachmentSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'EXPENSE BILLS / RECEIPTS',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF94A3B8),
                letterSpacing: 1,
              ),
            ),
            TextButton.icon(
              onPressed: _addAttachment,
              icon: const Icon(
                Icons.add_a_photo_rounded,
                size: 16,
                color: Color(0xFF0D9488),
              ),
              label: Text(
                'ADD BILL',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0D9488),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_expenseBills.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.receipt_long_rounded,
                  color: Color(0xFF0D9488),
                  size: 32,
                ),
                const SizedBox(height: 12),
                Text(
                  'No bills or slips added.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF94A3B8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 100,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _expenseBills.length,
              itemBuilder: (context, index) {
                return Stack(
                  children: [
                    Container(
                      margin: const EdgeInsets.only(right: 12),
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                        image: DecorationImage(
                          image: MemoryImage(
                            base64Decode(
                              _expenseBills[index].contains(',')
                                  ? _expenseBills[index].split(',').last
                                  : _expenseBills[index],
                            ),
                          ),
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 4,
                      right: 16,
                      child: GestureDetector(
                        onTap: () =>
                            setState(() => _expenseBills.removeAt(index)),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Color(0xFF0D9488),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close,
                            color: Colors.white,
                            size: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        const SizedBox(height: 32),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'ACTIVITY PROOFS (JOB REPORT)',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF94A3B8),
                letterSpacing: 1,
              ),
            ),
            TextButton.icon(
              onPressed: () async {
                showModalBottomSheet(
                  context: context,
                  backgroundColor: Colors.transparent,
                  builder: (context) => Container(
                    decoration: const BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(32),
                      ),
                    ),
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFFE2E8F0),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'ADD ACTIVITY PROOF',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: const Color(0xFF134E4A),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          children: [
                            Expanded(
                              child: _pickerOption(
                                icon: Icons.camera_alt_rounded,
                                label: 'Camera',
                                color: const Color(0xFF0D9488),
                                onTap: () async {
                                  Navigator.pop(context);
                                  final result = await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) =>
                                          const ForensicCamera(),
                                    ),
                                  );
                                  if (result != null &&
                                      result is Map &&
                                      result['path'] != null) {
                                    final bytes = await File(
                                      result['path'],
                                    ).readAsBytes();
                                    setState(() {
                                      _jobReportAttachments.add(
                                        'data:image/jpeg;base64,${base64Encode(bytes)}',
                                      );
                                    });
                                  }
                                },
                              ),
                            ),
                            const SizedBox(width: 16),
                            Expanded(
                              child: _pickerOption(
                                icon: Icons.photo_library_rounded,
                                label: 'Gallery',
                                color: const Color(0xFF0D9488),
                                onTap: () async {
                                  Navigator.pop(context);
                                  final XFile? image = await picker.pickImage(
                                    source: ImageSource.gallery,
                                    imageQuality: 70,
                                  );
                                  if (image != null) {
                                    final bytes = await image.readAsBytes();
                                    setState(() {
                                      _jobReportAttachments.add(
                                        'data:image/jpeg;base64,${base64Encode(bytes)}',
                                      );
                                    });
                                  }
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 24),
                      ],
                    ),
                  ),
                );
              },
              icon: const Icon(
                Icons.add_task_rounded,
                size: 16,
                color: Color(0xFF0D9488),
              ),
              label: Text(
                'ADD PROOF',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0D9488),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_jobReportAttachments.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            width: double.infinity,
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Column(
              children: [
                const Icon(
                  Icons.assignment_turned_in_rounded,
                  color: Color(0xFF0D9488),
                  size: 32,
                ),
                const SizedBox(height: 12),
                Text(
                  'No activity proofs added.',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF94A3B8),
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          )
        else
          SizedBox(
            height: 100,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              itemCount: _jobReportAttachments.length,
              itemBuilder: (context, index) {
                return Stack(
                  children: [
                    Container(
                      margin: const EdgeInsets.only(right: 12),
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                        image: DecorationImage(
                          image: MemoryImage(
                            base64Decode(
                              _jobReportAttachments[index].contains(',')
                                  ? _jobReportAttachments[index].split(',').last
                                  : _jobReportAttachments[index],
                            ),
                          ),
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                    Positioned(
                      top: 4,
                      right: 16,
                      child: GestureDetector(
                        onTap: () => setState(
                          () => _jobReportAttachments.removeAt(index),
                        ),
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: const BoxDecoration(
                            color: Color(0xFF0D9488),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close,
                            color: Colors.white,
                            size: 12,
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
      ],
    );
  }

}
