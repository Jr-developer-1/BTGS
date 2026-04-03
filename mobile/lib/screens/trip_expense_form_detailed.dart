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
  List<String> _masterClasses = [];
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
  final TextEditingController _personsController = TextEditingController();
  final TextEditingController _vehicleNoController = TextEditingController();
  final TextEditingController _odoStartController = TextEditingController();
  final TextEditingController _odoEndController = TextEditingController();
  final TextEditingController _incidentalAmountController =
      TextEditingController();
  final TextEditingController _odoRateController = TextEditingController(
    text: '9.0',
  );
  final TextEditingController _addressController = TextEditingController();
  final TextEditingController _earlyCheckInController = TextEditingController();
  final TextEditingController _lateCheckOutController = TextEditingController();
  final TextEditingController _providerController = TextEditingController();
  final TextEditingController _driverNameController = TextEditingController();
  final TextEditingController _boardingPointController =
      TextEditingController();
  final TextEditingController _travelNoController =
      TextEditingController(); // Flight No / Train No

  // Dropdown States
  String? _mealCategory;
  String? _mealType;
  String? _accomType;
  String? _roomType;
  String? _travelMode;
  String? _travelSubType;
  String? _bookedBy;
  String? _bookingType;
  String? _travelStatus = 'Completed';
  String? _travelClass;
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
  List<String> _selfieImages = [];

  // Scheduled Timings for Outstation Travel (to match web)
  DateTime _scheduledStartDate = DateTime.now();
  DateTime _scheduledEndDate = DateTime.now();
  TimeOfDay _scheduledStartTime = TimeOfDay.now();
  TimeOfDay _scheduledEndTime = TimeOfDay.now();

  @override
  void initState() {
    super.initState();
    _loadMasters();
    if (widget.expenseData != null) {
      _loadExpenseData();
    } else {
      // Set defaults based on category
      if (widget.category == 'Local Travel') {
        _travelMode = 'Bike';
        _travelSubType = 'Own Bike';
        _fetchRates();
      }
    }
  }

  Future<void> _fetchRates() async {
    if (widget.category != 'Local Travel') return;

    final type = (_travelSubType == 'Own Car') ? '4 Wheeler' : '2 Wheeler';
    final rate = await _tripService.fetchFuelRate(type);
    if (rate != null) {
      setState(() {
        _odoRateController.text = rate.toStringAsFixed(2);
      });
    }
  }

  Future<void> _loadMasters() async {
    try {
      final results = await Future.wait([
        _masterService.getTravelModes(),
        _masterService.getBookingTypes(),
        _masterService.getLocalTravelModes(),
        _masterService.fetchMasterList(ApiConstants.masterStayTypes, 'results', 'stay_type'),
        _masterService.fetchMasterList(ApiConstants.masterRoomTypes, 'results', 'room_type'),
        _masterService.fetchMasterList(ApiConstants.masterMealCategories, 'results', 'category_name'),
        _masterService.fetchMasterList(ApiConstants.masterMealTypes, 'results', 'meal_type'),
      ]);

      if (mounted) {
        setState(() {
          _masterTravelModes = results[0];
          _masterBookingTypes = results[1];
          _masterLocalTravelModes = results[2];
          _masterStayTypes = results[3];
          _masterRoomTypes = results[4];
          _masterMealCategories = results[5];
          _masterMealTypes = results[6];
        });
        
        // Load classes if mode is already set
        if (_travelMode != null) {
          _loadClasses();
        }
      }
    } catch (e) {
      debugPrint('Error loading master data: $e');
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
    _amountController.text = exp['amount']?.toString() ?? '';

    var details = exp['details'] ?? {};
    if (details.isEmpty &&
        exp['description'] is String &&
        exp['description'].toString().startsWith('{')) {
      try {
        details = jsonDecode(exp['description']);
      } catch (e) {}
    }

    _jobReportController.text = exp['remarks'] ?? details['remarks'] ?? details['jobReport'] ?? (widget.category != 'Food' ? (details['purpose'] ?? '') : '');

    _originController.text = details['origin'] ?? '';
    _destController.text = details['destination'] ?? '';
    _invoiceNoController.text = details['invoiceNo'] ?? '';
    _restaurantController.text = details['restaurant'] ?? '';
    if (widget.category == 'Food') {
      _addressController.text = details['purpose'] ?? '';
    }
    if (widget.category == 'Accommodation') {
      _earlyCheckInController.text = (details['earlyCheckInCharges'] ?? '').toString();
      _lateCheckOutController.text = (details['lateCheckOutCharges'] ?? '').toString();
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
    _odoStartController.text = (details['odoStart'] ?? '').toString();
    _odoEndController.text = (details['odoEnd'] ?? '').toString();
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

    if (details['bookingDate'] != null)
      _bookingDate = DateTime.tryParse(details['bookingDate']) ?? _bookingDate;
    if (details['bookingTime'] != null)
      _bookingTime = _parseTime(details['bookingTime']);

    _mealCategory = details['mealCategory'];
    _mealType = details['mealType'];
    _accomType = details['accomType'];
    _roomType = details['roomType'];
    _travelMode = details['mode'];
    _travelSubType = details['subType'];
    _bookedBy = details['bookedBy'];
    _travelStatus = details['travelStatus'] ?? 'Completed';
    _travelClass = details['class'];
    _nightTravel = details['nightTravel'] ?? false;
    _isSharedMeal = details['isShared'] ?? false;

    final attachments = details['jobReportAttachments'];
    if (attachments is List) {
      _jobReportAttachments = List<String>.from(
        attachments.map((e) => e.toString()),
      );
    }

    final selfies = details['selfieImages'];
    if (selfies is List) {
      _selfieImages = List<String>.from(selfies.map((e) => e.toString()));
    }

    if (details['date'] != null)
      _startDate = DateTime.tryParse(details['date']) ?? _startDate;
    if (details['depDate'] != null)
      _startDate = DateTime.tryParse(details['depDate']) ?? _startDate;
    if (details['arrDate'] != null)
      _endDate = DateTime.tryParse(details['arrDate']) ?? _endDate;
    if (details['checkIn'] != null)
      _startDate = DateTime.tryParse(details['checkIn']) ?? _startDate;
    if (details['checkOut'] != null)
      _endDate = DateTime.tryParse(details['checkOut']) ?? _endDate;

    if (details['depTime'] != null) _startTime = _parseTime(details['depTime']);
    if (details['arrTime'] != null) _endTime = _parseTime(details['arrTime']);

    // Load Scheduled Timings
    if (details['scheduledDepDate'] != null)
      _scheduledStartDate = DateTime.tryParse(details['scheduledDepDate']) ?? _scheduledStartDate;
    if (details['scheduledArrDate'] != null)
      _scheduledEndDate = DateTime.tryParse(details['scheduledArrDate']) ?? _scheduledEndDate;
    if (details['scheduledDepTime'] != null)
      _scheduledStartTime = _parseTime(details['scheduledDepTime']);
    if (details['scheduledArrTime'] != null)
      _scheduledEndTime = _parseTime(details['scheduledArrTime']);
    if (details['mealTime'] != null)
      _startTime = _parseTime(details['mealTime']);

    if (widget.category == 'Local Travel') {
      _odoRateController.text = (details['odoRate'] ?? '9.0').toString();
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

      if (details['startDate'] != null)
        _startDate = DateTime.tryParse(details['startDate']) ?? _startDate;
      if (details['endDate'] != null)
        _endDate = DateTime.tryParse(details['endDate']) ?? _endDate;
      if (details['startTime'] != null)
        _startTime = _parseTime(details['startTime']);
      if (details['endTime'] != null) _endTime = _parseTime(details['endTime']);
    }
  }

  TimeOfDay _parseTime(String timeStr) {
    try {
      final parts = timeStr.split(':');
      if (parts.length >= 2) {
        int hour = int.parse(parts[0].replaceAll(RegExp(r'[^0-9]'), ''));
        int minute = int.parse(parts[1].split(' ')[0]);
        if (timeStr.toLowerCase().contains('pm') && hour < 12) hour += 12;
        if (timeStr.toLowerCase().contains('am') && hour == 12) hour = 0;
        return TimeOfDay(hour: hour, minute: minute);
      }
    } catch (e) {}
    return TimeOfDay.now();
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
            9.0;
        odoTotal = dist * rate;
        if (odoTotal > 0) {
          amount = odoTotal;
        }
      }

      final payload = {
        'trip': widget.tripId,
        'category': widget.category == 'Local Travel'
            ? 'Fuel'
            : widget.category,
        'amount': amount,
        'date': DateFormat('yyyy-MM-dd').format(_startDate),
        'remarks': _jobReportController.text,
        'description': jsonEncode(_buildDescription()),
        'receipt_image': jsonEncode(_jobReportAttachments),
      };

      // NEW: Handle correction of rejected bulk rows
      if (widget.expenseData != null && widget.expenseData['is_bulk_correction'] == true) {
        final batchId = widget.expenseData['batch_id'].toString();
        final rowIndex = widget.expenseData['row_index'];
        
        // Prepare row update data
        final rowUpdate = {
          ..._buildDescription(),
          'amount': amount,
          'date': DateFormat('yyyy-MM-dd').format(_startDate),
          'remarks': _jobReportController.text,
          '_status': 'Validated', // Reset status as it's now corrected
          '_remark': 'Corrected on mobile: ${_jobReportController.text}'
        };

        await _tripService.handleBulkBatchAction(
          batchId, 
          'UpdateItem',
          extraData: {
            'row_index': rowIndex,
            'new_data': rowUpdate
          }
        );
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Bulk row corrected and resubmitted'), backgroundColor: Colors.green),
        );
        Navigator.pop(context, true);
        return;
      }

      String? mainExpenseId;
      if (widget.expenseData != null) {
        mainExpenseId = widget.expenseData['id'].toString();
        await _tripService.updateExpense(mainExpenseId, payload);
      } else {
        final res = await _tripService.addExpense(payload);
        mainExpenseId = res['id']?.toString();
      }

      // Handle Incidentals separately as individual records
      if (widget.category == 'Local Travel' && _incidentals.isNotEmpty) {
        for (var inc in _incidentals) {
          final incAmount =
              double.tryParse(inc['amount']?.toString() ?? '0') ?? 0.0;
          if (incAmount > 0) {
            await _tripService.addExpense({
              'trip': widget.tripId,
              'category': 'Incidental',
              'amount': incAmount,
              'date': DateFormat('yyyy-MM-dd').format(_startDate),
              'remarks': 'Attached to ODO entry [${mainExpenseId ?? 'New'}]',
              'description': jsonEncode({
                'incidentalType': inc['category'] ?? 'Misc',
                'notes': _jobReportController.text,
                'parentOdoId': mainExpenseId,
              }),
              // If there's a bill for this incidental, it should be sent too
              'receipt_image': inc['bill'] != null
                  ? jsonEncode([inc['bill']])
                  : '[]',
            });
          }
        }
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
        'restaurant': _restaurantController.text,
        'mealTime': _startTime.format(context),
        'invoiceNo': _invoiceNoController.text,
        'isShared': _isSharedMeal,
        'persons': _personsController.text,
      });
    } else if (widget.category == 'Accommodation') {
      desc.addAll({
        'accomType': _accomType,
        'roomType': _roomType,
        'hotelName': _hotelNameController.text,
        'city': _cityController.text,
        'checkIn': DateFormat('yyyy-MM-dd').format(_startDate),
        'checkOut': DateFormat('yyyy-MM-dd').format(_endDate),
        'checkInTime': _startTime.format(context),
        'checkOutTime': _endTime.format(context),
        'nights': int.tryParse(_nightsController.text) ?? 1,
        'earlyCheckInCharges': _earlyCheckInController.text,
        'lateCheckOutCharges': _lateCheckOutController.text,
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

        // Scheduled Timings (Parity with Web)
        'scheduledDepDate': DateFormat('yyyy-MM-dd').format(_scheduledStartDate),
        'scheduledArrDate': DateFormat('yyyy-MM-dd').format(_scheduledEndDate),
        'scheduledDepTime': _scheduledStartTime.format(context),
        'scheduledArrTime': _scheduledEndTime.format(context),
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
        'odoStart': _odoStartController.text,
        'odoEnd': _odoEndController.text,
        'odoRate': _odoRateController.text,
        'odoStartImg': _odoStartImg,
        'odoEndImg': _odoEndImg,
        'odoStartLat': _odoStartLat,
        'odoStartLong': _odoStartLong,
        'odoEndLat': _odoEndLat,
        'odoEndLong': _odoEndLong,
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

    return desc;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text(
          '${widget.category} Details',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w800,
            fontSize: 16,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        centerTitle: true,
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

              if (!(widget.category == 'Local Travel' && _isTravelo))
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
    return _buildWebCard(
      title: 'OUTSTATION TRAVEL',
      icon: Icons.flight_takeoff_rounded,
      color: Colors.deepPurple,
      children: [
        Row(
          children: [
            Expanded(
              child: SearchableDropdown(
                label: 'TRAVEL MODE',
                value: _travelMode,
                icon: Icons.flight_takeoff_rounded,
                initialOptions: _masterTravelModes.isNotEmpty ? _masterTravelModes : ['Flight', 'Train', 'Intercity Bus', 'Intercity Cab', 'Others'],
                onChanged: (v) => setState(() {
                  _travelMode = v;
                  _masterClasses = [];
                  _travelClass = null;
                  _loadClasses();
                }),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SearchableDropdown(
                label: 'STATUS',
                value: _travelStatus,
                icon: Icons.info_outline_rounded,
                initialOptions: ['Completed', 'Pending', 'Cancelled'],
                onChanged: (v) => setState(() => _travelStatus = v),
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
        const Divider(),
        Text(
          'ROUTE & PROVIDER INFO',
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
              child: SearchableDropdown(
                label: 'FROM',
                value: _originController.text,
                icon: Icons.location_on_outlined,
                isLocation: true,
                onChanged: (v) => setState(() => _originController.text = v),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SearchableDropdown(
                label: 'TO',
                value: _destController.text,
                icon: Icons.location_on_outlined,
                isLocation: true,
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
                child: _buildTextFieldMini('AIRLINE NAME', _providerController),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildTextFieldMini('FLIGHT NO.', _travelNoController),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildTextFieldMini('TICKET NO.', _ticketNoController),
              ),
              const SizedBox(width: 12),
              Expanded(child: _buildTextFieldMini('PNR', _pnrController)),
            ],
          ),
          const SizedBox(height: 20),
          SearchableDropdown(
            label: 'TRAVEL CLASS',
            value: _travelClass,
            icon: Icons.airline_seat_recline_extra_rounded,
            initialOptions: ['Economy', 'Premium Economy', 'Business', 'First Class'],
            onChanged: (v) => setState(() => _travelClass = v),
          ),
        ] else if (_travelMode == 'Intercity Cab') ...[
          Row(
            children: [
              Expanded(
                child: _buildTextFieldMini(
                  'PROVIDER / VENDOR',
                  _providerController,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDropdownMini(
                  'VEHICLE TYPE',
                  _vehicleType,
                  ['Sedan', 'SUV', 'MUV', 'Hatchback'],
                  (v) => setState(() => _vehicleType = v),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _buildTextFieldMini('DRIVER NAME', _driverNameController),
        ] else ...[
          // Train, Bus, etc.
          Row(
            children: [
              Expanded(
                child: _buildTextFieldMini(
                  'PROVIDER / AGENT',
                  _providerController,
                ),
              ),
              if (_travelMode == 'Intercity Bus') ...[
                const SizedBox(width: 12),
                Expanded(
                  child: _buildTextFieldMini(
                    'BOARDING POINT',
                    _boardingPointController,
                  ),
                ),
              ],
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildTextFieldMini('TICKET NO.', _ticketNoController),
              ),
              const SizedBox(width: 12),
              Expanded(child: _buildTextFieldMini('PNR / REF', _pnrController)),
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
                  _travelMode == 'Train' ? 'TR NO.' : 'VEHICLE NO.',
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
                  _masterClasses.isNotEmpty 
                    ? _masterClasses 
                    : (_travelMode == 'Train'
                      ? ['Sleeper', '3AC', '2AC', '1AC', 'Chair Car', 'General']
                      : ['Sleeper', 'Semi Sleeper', 'AC', 'Non-AC', 'Volvo', 'Seater']),
                  (v) => setState(() => _travelClass = v),
                ),
              ),
              if (_travelMode == 'Train') ...[
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
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
                ),
              ],
            ],
          ),
        ],
        const SizedBox(height: 32),
        const Divider(),
        Text(
          'JOURNEY SCHEDULE',
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
        if (_travelMode == 'Flight' || _travelMode == 'Train') ...[
          const SizedBox(height: 20),
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
                  onChanged: (v) => setState(() => _mealIncluded = v ?? false),
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
        const SizedBox(height: 32),
        const Divider(),
        const SizedBox(height: 12),
        SearchableDropdown(
          label: 'BOOKED BY',
          value: _bookedBy,
          icon: Icons.person_outline_rounded,
          initialOptions: ['Self Booked', 'Company Booked'],
          onChanged: (v) => setState(() => _bookedBy = v),
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'AMOUNT',
          _amountController,
          prefix: '₹',
          keyboardType: TextInputType.number,
          icon: Icons.payments_outlined,
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'PURPOSE / REMARKS',
          _jobReportController,
          maxLines: 2,
        ),
      ],
    );
  }



  Widget _buildLocalTravelForm() {
    if (_isTravelo) return _buildTraveloLocalForm();
    return _buildTripLocalTravelForm();
  }

  Widget _buildTripLocalTravelForm() {
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
        9.0;
    double odoTotal = dist * rate;

    // Incidental sum is now 0 as it's removed from UI
    double dayTotal = odoTotal;

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
              colors: [Color(0xFF2563EB), Color(0xFF1E40AF)],
            ),
            borderRadius: BorderRadius.circular(32),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF2563EB).withOpacity(0.2),
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
                      color: Colors.white.withOpacity(0.7),
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
                        color: Colors.white.withOpacity(0.7),
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
          title: 'VEHICLE & MODE CONFIGURATION',
          icon: Icons.settings_suggest_rounded,
          color: Colors.blue,
          children: [
            Row(
              children: [
                Expanded(
                  child: SearchableDropdown(
                    label: 'MODE',
                    value: _travelMode,
                    icon: Icons.directions_car_filled_rounded,
                    initialOptions: _masterLocalTravelModes.isNotEmpty ? _masterLocalTravelModes : ['Bike', 'Car / Cab', 'Public Transport', 'Walk'],
                    onChanged: (v) => setState(() {
                      _travelMode = v;
                      _travelSubType = null;
                      _fetchRates();
                    }),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _buildDropdownMini(
                    'SUB-TYPE',
                    _travelSubType,
                    _travelMode == 'Bike'
                        ? ['Own Bike', 'Rental Bike', 'Ride Bike']
                        : _travelMode == 'Car / Cab'
                        ? ['Own Car', 'Company Car', 'Ride Hailing', 'Rental']
                        : _travelMode == 'Public Transport'
                        ? ['Auto', 'Metro', 'Bus']
                        : ['N/A'],
                    (v) => setState(() {
                      _travelSubType = v;
                      _fetchRates();
                    }),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            SearchableDropdown(
              label: 'BOOKING TYPE',
              value: _bookingType,
              icon: Icons.confirmation_number_rounded,
              initialOptions: _masterBookingTypes.isNotEmpty ? _masterBookingTypes : ['Online', 'Agent', 'Direct'],
              onChanged: (v) => setState(() => _bookingType = v),
            ),
          ],
        ),

        _buildWebCard(
          title: 'LOCATION & ODOMETER LOGS',
          icon: Icons.map_rounded,
          color: const Color(0xFF4F46E5),
          children: [
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
            ),
            const SizedBox(height: 32),
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
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Professional Insight Card
            Container(
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
                          SizedBox(
                            width: 60,
                            height: 24,
                            child: TextFormField(
                              controller: _odoRateController,
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
                              ),
                              onChanged: (v) => setState(() {}),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
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
                    ],
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
                        _selfieImages.add('data:image/jpeg;base64,${base64Encode(bytes)}');
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
        9.0;
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
                ),
              ),
            ),
            const SizedBox(height: 24),
            // Professional Insight Card
            Container(
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
                          SizedBox(
                            width: 60,
                            height: 24,
                            child: TextFormField(
                              controller: _odoRateController,
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
                              ),
                              onChanged: (v) => setState(() {}),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  const Divider(),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
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
                      TextButton.icon(
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (context) => JobReportComposerScreen(
                                travelId: widget.tripId,
                                initialReport: _jobReportController.text,
                                initialAttachments: _jobReportAttachments,
                                onSave: (text, attachments) async {
                                  setState(() {
                                    _jobReportController.text = text;
                                    _jobReportAttachments = attachments;
                                  });
                                },
                              ),
                            ),
                          );
                        },
                        icon: const Icon(Icons.edit_note_rounded, size: 18),
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
                            side: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
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
                      onTap: () => setState(
                        () => _incidentals.add({
                          'category': 'Toll',
                          'amount': '',
                          'bill': null,
                        }),
                      ),
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
                              ['Toll', 'Parking', 'Repairs', 'Cleaning'],
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
                            onPressed: () =>
                                setState(() => _incidentals.removeAt(index)),
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
          onChanged: (v) => setState(() => _incidentals[index]['amount'] = v),
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
  }) {
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
              child: _buildTextFieldMini(
                'LOCATION',
                locationController,
                hint: isStart ? 'Origin' : 'Destination',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: _buildTextFieldMini(
                'ODO READING',
                odoController,
                keyboardType: TextInputType.number,
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
                InkWell(
                  onTap: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const ForensicCamera()),
                    );
                    if (result != null && result is Map) {
                      final bytes = await File(result['path']).readAsBytes();
                      onImg('data:image/jpeg;base64,${base64Encode(bytes)}');
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
                      color: const Color(0xFFF8FAFC),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: odoImg != null
                            ? const Color(0xFF10B981)
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
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildFoodForm() {
    return _buildWebCard(
      title: 'FOOD & REFRESHMENTS',
      icon: Icons.restaurant_rounded,
      color: Colors.pink,
      children: [
        Row(
          children: [
            Expanded(
              child: SearchableDropdown(
                label: 'CATEGORY',
                value: _mealCategory,
                icon: Icons.category_rounded,
                initialOptions: _masterMealCategories.isNotEmpty ? _masterMealCategories : ['Self Meal', 'Working Meal', 'Client Hosted'],
                onChanged: (v) => setState(() => _mealCategory = v),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SearchableDropdown(
                label: 'MEAL TYPE',
                value: _mealType,
                icon: Icons.restaurant_menu_rounded,
                initialOptions: _masterMealTypes.isNotEmpty ? _masterMealTypes : ['Breakfast', 'Lunch', 'Dinner', 'Snacks'],
                onChanged: (v) => setState(() => _mealType = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'RESTAURANT / HOTEL',
          _restaurantController,
          icon: Icons.storefront_rounded,
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'ADDRESS',
          _addressController,
          icon: Icons.location_on_outlined,
          hint: 'Location Address',
        ),
        const SizedBox(height: 20),
        _buildTimePickerMini(
          'MEAL TIME',
          _startTime,
          (t) => setState(() => _startTime = t),
        ),
        const SizedBox(height: 20),
        if (_mealCategory == 'Working Meal' || _mealCategory == 'Client Hosted') ...[
          _buildTextFieldMini(
            'NO. OF PERSONS (PAX)',
            _personsController,
            keyboardType: TextInputType.number,
            icon: Icons.people_outline,
          ),
          const SizedBox(height: 20),
        ],
        _buildTextFieldMini(
          'AMOUNT',
          _amountController,
          prefix: '₹',
          keyboardType: TextInputType.number,
          icon: Icons.payments_outlined,
        ),
      ],
    );
  }

  Widget _buildAccommodationForm() {
    return _buildWebCard(
      title: 'ACCOMMODATION',
      icon: Icons.hotel_rounded,
      color: Colors.orange,
      children: [
        Row(
          children: [
            Expanded(
              child: SearchableDropdown(
                label: 'STAY TYPE',
                value: _accomType,
                icon: Icons.hotel_rounded,
                initialOptions: _masterStayTypes.isNotEmpty ? _masterStayTypes : ['Hotel Stay', 'Bavya Guest House', 'Self Stay', 'Client Provided', 'No Stay'],
                onChanged: (v) => setState(() => _accomType = v),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: SearchableDropdown(
                label: 'ROOM TYPE',
                value: _roomType,
                icon: Icons.meeting_room_rounded,
                initialOptions: _masterRoomTypes.isNotEmpty ? _masterRoomTypes : ['Standard', 'Deluxe', 'Executive', 'Suite', 'Guest House'],
                onChanged: (v) => setState(() => _roomType = v),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'HOTEL / PROPERTY NAME',
          _hotelNameController,
          icon: Icons.business_rounded,
        ),
        const SizedBox(height: 20),
        SearchableDropdown(
          label: 'CITY',
          value: _cityController.text,
          icon: Icons.location_city_rounded,
          isLocation: true,
          onChanged: (v) => setState(() => _cityController.text = v),
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _buildDatePickerMini('CHECK-IN', _startDate, (d) {
                setState(() => _startDate = d);
                _calculateNights();
              }),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildDatePickerMini('CHECK-OUT', _endDate, (d) {
                setState(() => _endDate = d);
                _calculateNights();
              }),
            ),
          ],
        ),
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _buildTextFieldMini(
                'NIGHTS',
                _nightsController,
                keyboardType: TextInputType.number,
                icon: Icons.nights_stay_outlined,
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
        const SizedBox(height: 20),
        Row(
          children: [
            Expanded(
              child: _buildTextFieldMini(
                'EARLY CHK-IN',
                _earlyCheckInController,
                keyboardType: TextInputType.number,
                icon: Icons.access_time_rounded,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildTextFieldMini(
                'LATE CHK-OUT',
                _lateCheckOutController,
                keyboardType: TextInputType.number,
                icon: Icons.access_time_filled_rounded,
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini('PURPOSE / ADDRESS', _jobReportController, maxLines: 2),
      ],
    );
  }

  Widget _buildIncidentalForm() {
    return _buildWebCard(
      title: 'INCIDENTAL / OTHERS',
      icon: Icons.receipt_long_rounded,
      color: Colors.grey,
      children: [
        _buildDropdownMini('EXPENSE TYPE', _mealCategory, [
          'Parking',
          'Toll',
          'Fuel',
          'Luggage',
          'Others',
        ], (v) => setState(() => _mealCategory = v)),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'LOCATION / DETAILS',
          _originController,
          icon: Icons.map_outlined,
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'AMOUNT',
          _amountController,
          prefix: '₹',
          keyboardType: TextInputType.number,
          icon: Icons.payments_outlined,
        ),
        const SizedBox(height: 20),
        _buildTextFieldMini(
          'DESCRIPTION / PURPOSE',
          _jobReportController,
          maxLines: 3,
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: color.withOpacity(0.05),
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(24),
                topRight: Radius.circular(24),
              ),
            ),
            child: Row(
              children: [
                Icon(icon, color: color, size: 20),
                const SizedBox(width: 12),
                Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    fontWeight: FontWeight.w900,
                    color: color,
                    letterSpacing: 0.5,
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
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
    Function(String)? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          keyboardType: keyboardType,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: const Color(0xFF1E293B),
          ),
          onChanged: (v) {
            if (onChanged != null) onChanged(v);
            setState(() {}); // Trigger calc update
          },
          decoration: InputDecoration(
            hintText: hint,
            prefixText: prefix,
            prefixIcon: icon != null
                ? Icon(icon, size: 18, color: const Color(0xFF94A3B8))
                : null,
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
          ),
          validator: (v) => v == null || v.isEmpty ? 'Required' : null,
        ),
      ],
    );
  }

  Widget _buildDropdownMini(
    String label,
    String? value,
    List<String> options,
    Function(String?) onChanged,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
            letterSpacing: 0.3,
          ),
        ),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: options.contains(value) ? value : null,
              isExpanded: true,
              hint: Text(
                'Select',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  color: const Color(0xFF94A3B8),
                ),
              ),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: const Color(0xFF1E293B),
              ),
              onChanged: onChanged,
              items: options
                  .map(
                    (String val) =>
                        DropdownMenuItem(value: val, child: Text(val)),
                  )
                  .toList(),
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
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () async {
            final d = await showDatePicker(
              context: context,
              initialDate: value,
              firstDate: DateTime(2023),
              lastDate: DateTime(2030),
            );
            if (d != null) onType(d);
          },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  DateFormat('dd MMM yyyy').format(value),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Icon(
                  Icons.calendar_month_rounded,
                  size: 18,
                  color: Color(0xFF94A3B8),
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
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
          ),
        ),
        const SizedBox(height: 8),
        InkWell(
          onTap: () async {
            final t = await showTimePicker(
              context: context,
              initialTime: value,
            );
            if (t != null) onType(t);
          },
          child: Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  value.format(context),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Icon(
                  Icons.access_time_rounded,
                  size: 18,
                  color: Color(0xFF94A3B8),
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
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'ADD ATTACHMENT / BILL',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: _pickerOption(
                    icon: Icons.camera_alt_rounded,
                    label: 'Camera',
                    color: const Color(0xFF4F46E5),
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
                          _jobReportAttachments.add('data:image/jpeg;base64,${base64Encode(bytes)}');
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
                    color: const Color(0xFF10B981),
                    onTap: () async {
                      Navigator.pop(context);
                      final XFile? image = await picker.pickImage(
                        source: ImageSource.gallery,
                        imageQuality: 70,
                      );
                      if (image != null) {
                        final bytes = await image.readAsBytes();
                        setState(() {
                          _jobReportAttachments.add('data:image/jpeg;base64,${base64Encode(bytes)}');
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
              'ATTACHMENTS / BILLS',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
            TextButton.icon(
              onPressed: _addAttachment,
              icon: const Icon(Icons.add_a_photo_rounded, size: 16),
              label: Text(
                'ADD',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
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
                  Icons.receipt_long_rounded,
                  color: const Color(0xFF94A3B8),
                  size: 32,
                ),
                const SizedBox(height: 12),
                Text(
                  'No bills or attachments added.',
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
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                        image: DecorationImage(
                          image: MemoryImage(
                            base64Decode(_jobReportAttachments[index]),
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
                            color: Colors.red,
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
