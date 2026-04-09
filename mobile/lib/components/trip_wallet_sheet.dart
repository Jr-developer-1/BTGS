import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/trip_model.dart';
import '../services/trip_service.dart';
import '../services/master_data_service.dart';
import 'dart:io';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:path_provider/path_provider.dart';
import 'package:intl/intl.dart';
import 'dart:convert';
import 'forensic_camera.dart';
import '../services/expense_reminder_service.dart';
import 'package:file_picker/file_picker.dart';
import 'package:open_filex/open_filex.dart';
import '../services/logger_service.dart';

class TripWalletSheet extends StatefulWidget {
  final Trip trip;
  final VoidCallback onUpdate;
  final String? initialView;
  final String? initialCategory;
  final Map<String, dynamic>? initialExpense;

  const TripWalletSheet({
    super.key,
    required this.trip,
    required this.onUpdate,
    this.initialView,
    this.initialCategory,
    this.initialExpense,
  });

  @override
  State<TripWalletSheet> createState() => _TripWalletSheetState();
}

class _TripWalletSheetState extends State<TripWalletSheet> {
  late String _view; // 'overview', 'request_advance', 'add_expense'
  bool _isLoading = false;
  bool _isSubmitting = false;
  bool _isLocating = false;
  late Trip _tripData;
  final TripService _tripService = TripService();
  final MasterDataService _masterDataService = MasterDataService();
  Map<String, dynamic> _masters = {};

  // Edit Mode State
  bool _isEditing = false;
  String? _editingExpenseId;
  bool _isFinalized = false;
  bool _isCompleted = false;

  // Form controllers
  final _advanceAmountController = TextEditingController();
  final _advancePurposeController = TextEditingController();

  final _expenseAmountController = TextEditingController();
  final _expenseRemarksController = TextEditingController();

  // Dynamic Category Controllers
  final _originController = TextEditingController();
  final _destController = TextEditingController();
  final _locationController = TextEditingController();
  final _hotelController = TextEditingController();
  final _cityController = TextEditingController();
  final _restaurantController = TextEditingController();
  final _paxController = TextEditingController();

  // Travel Specific
  final _providerController = TextEditingController();
  final _travelNoController = TextEditingController();
  final _pnrController = TextEditingController();
  final _boardingTimeController = TextEditingController();
  final _scheduledTimeController = TextEditingController();
  final _actualTimeController = TextEditingController();
  final _delayController = TextEditingController();
  final _tollController = TextEditingController();
  final _parkingController = TextEditingController();
  final _fuelController = TextEditingController();
  final _carrierNameController = TextEditingController();
  final _bookingTimeController = TextEditingController();
  final _invoiceNoController = TextEditingController();
  final _boardingPointController = TextEditingController();
  final _driverNameController = TextEditingController();
  final _startTimeController = TextEditingController();
  final _endTimeController = TextEditingController();
  final _vehicleNoController = TextEditingController();

  // Fuel Specific
  final _odoStartController = TextEditingController();
  final _odoEndController = TextEditingController();
  final _otherReasonController =
      TextEditingController(); // Added for Incidental

  final _earlyCheckInController = TextEditingController();
  final _lateCheckOutController = TextEditingController();
  final _stayPurposeController = TextEditingController(); // Added for Stay
  final _mealTimeController = TextEditingController();
  final _addressController = TextEditingController();
  
  bool _isBulkUploading = false;

  String _selectedCategory = 'Travel';
  String? _selectedMode;
  String? _selectedLocalMode;
  String? _selectedLocalSubType; // Added for web app parity
  String _vehicleType = 'Own';
  String _mealCategory = 'Self Meal';
  String _mealType = 'Lunch';
  String _roomType = 'Standard';
  String _tollType = 'Toll';
  String _bookingType = 'Self Booked';

  String _selectedClass = 'Economy';
  bool _mealIncluded = false;
  bool _excessBaggage = false;
  bool _isTatkal = false;
  DateTime _selectedDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  DateTime _bookingDate = DateTime.now();
  final List<String> _receiptImagePaths = [];
  String? _odoStartImg;
  String? _odoEndImg;
  double? _latitude;
  double? _longitude;
  double? _odoStartLat;
  double? _odoStartLong;
  double? _odoEndLat;
  double? _odoEndLong;
  String? _existingOdoStartBase64;
  String? _existingOdoEndBase64;
  List<String> _existingReceiptBase64s = [];

  bool _carryingLuggage = false;
  final _luggageWeightController = TextEditingController();

  final _ticketNoController = TextEditingController();
  final _rentalChargeController = TextEditingController();

  final List<String> _travelModes = [];
  final List<String> _bookedByOptions = [];
  final List<String> _localTravelModes = [];
  Map<String, List<String>> _localSubTypes = {};
  final List<String> _stayTypes = [];
  final List<String> _roomTypes = [];
  final List<String> _mealCategories = [];
  final Map<String, List<String>> _mealSubTypes = {};

  final List<Map<String, String>> _categories = [
    {'id': 'Travel', 'label': 'Long Distance Travel'},
    {'id': 'Local', 'label': 'Local Conveyance'},
    {'id': 'Food', 'label': 'Food & Refreshments'},
    {'id': 'Stay', 'label': 'Stay & Lodging'},
    {'id': 'Incidental', 'label': 'Incidental Expenses'},
  ];

  bool get _isLocked =>
      !['Draft', 'Rejected', null].contains(_tripData.claimStatus);

  bool get _isFullTrip => _tripData.tripId.startsWith('TRP-');

  List<Map<String, String>> get _filteredCategories {
    if (_isFullTrip) return _categories;
    return _categories.where((c) => c['id'] == 'Local').toList();
  }

  @override
  void initState() {
    super.initState();
    _view = widget.initialView ?? 'overview';
    _tripData = widget.trip;
    if (!_isFullTrip) {
      _selectedCategory = 'Local';
      _selectedLocalMode = 'Bike';
      _selectedLocalSubType = 'Own Bike';
    } else {
      _selectedCategory = _mapInitialCategory(widget.initialCategory) ?? 'Food';
    }
    _loadMasterData();
    _refreshTripData();
    _cleanupExpiredDrafts();

    // Handle initial expense for direct editing
    if (widget.initialExpense != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _editExpense(widget.initialExpense!);
      });
    }
  }

  Future<void> _loadMasterData() async {
    try {
      final masters = await _masterDataService.fetchMasters();
      if (mounted) {
        setState(() {
          _masters = masters;
          
          // Populate lists from fetched masters
          _travelModes.clear();
          _travelModes.addAll((masters['travelModes'] as List<dynamic>? ?? []).cast<String>());
          
          _bookedByOptions.clear();
          _bookedByOptions.addAll((masters['bookingTypes'] as List<dynamic>? ?? []).cast<String>());
          
          _localTravelModes.clear();
          _localTravelModes.addAll((masters['localTravelModes'] as List<dynamic>? ?? []).cast<String>());
          
          _stayTypes.clear();
          _stayTypes.addAll((masters['stayTypes'] as List<dynamic>? ?? []).cast<String>());
          
          _roomTypes.clear();
          _roomTypes.addAll((masters['roomTypes'] as List<dynamic>? ?? []).cast<String>());
          
          _mealCategories.clear();
          _mealCategories.addAll((masters['mealCategories'] as List<dynamic>? ?? []).cast<String>());
          
          // Initialize meal subtypes
          _initializeMealSubTypes();
        });
      }
    } catch (e) {
      LoggerService.log('Error loading master data: $e', isError: true);
      // Fallback to defaults already set
    }
  }

  void _initializeMealSubTypes() {
    _mealSubTypes.clear();
    _mealSubTypes['Self Meal'] = (
      _masters['mealTypes'] as List<dynamic>? ?? []
    ).cast<String>().toList();
    _mealSubTypes['Working Meal'] = [
      'Working Breakfast', 'Working Lunch', 'Official Dinner'
    ];
    _mealSubTypes['Client Hosted'] = [
      'Hosted by Employee', 'Hosted by Client'
    ];
  }

  String? _mapInitialCategory(String? cat) {
    if (cat == null) return null;
    switch (cat.toLowerCase()) {
      case 'travel':
      case 'long distance travel':
        return 'Travel';
      case 'local':
      case 'local travel':
      case 'local conveyance':
        return 'Local';
      case 'food':
      case 'food & refreshments':
        return 'Food';
      case 'accommodation':
      case 'stay':
      case 'stay & lodging':
        return 'Stay';
      case 'incidental':
      case 'incidental expenses':
      case 'toll & parking':
      case 'toll':
        return 'Incidental';
      default:
        return null;
    }
  }

  Future<void> _handleDownloadTemplate() async {
    setState(() => _isLoading = true);
    try {
      final bytes = await _tripService.downloadBulkTemplate();
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/bulk_local_travel_template.xlsx');
      await file.writeAsBytes(bytes);
      
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Template downloaded! Opening...')),
        );
        await OpenFilex.open(file.path);
      }
    } catch (e) {
      LoggerService.log('ERR DOWNLOADING TEMPLATE: $e', isError: true);
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Download failed: $e')),
        );
      }
    }
  }

  Future<void> _handleBulkUpload() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['xlsx', 'xls'],
      );

      if (result != null && result.files.single.path != null) {
        setState(() => _isBulkUploading = true);
        final file = File(result.files.single.path!);
        await _tripService.uploadBulkLocalConveyance(_tripData.id, file);
        
        if (mounted) {
          setState(() {
            _isBulkUploading = false;
            _view = 'overview';
          });
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Bulk upload successful!'),
              backgroundColor: Colors.green,
            ),
          );
          _refreshTripData();
          widget.onUpdate();
        }
      }
    } catch (e) {
      LoggerService.log('ERR BULK UPLOAD: $e', isError: true);
      setState(() => _isBulkUploading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Upload failed: $e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Future<void> _refreshTripData() async {
    setState(() => _isLoading = true);
    try {
      final updatedTrip = await _tripService.fetchTripDetails(widget.trip.id);
      setState(() {
        _tripData = updatedTrip;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _captureReceipt() async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ForensicCamera()),
    );

    if (result != null && result is Map<String, dynamic>) {
      setState(() {
        _receiptImagePaths.add(result['path']);
        _latitude ??= result['latitude'];
        _longitude ??= result['longitude'];
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Forensic Receipt Captured!')),
      );
    }
  }

  Future<void> _pickFromGallery() async {
    final ImagePicker picker = ImagePicker();
    final List<XFile> images = await picker.pickMultiImage();

    if (images.isNotEmpty) {
      if (_latitude == null) {
        final pos = await _determinePosition();
        if (pos != null) {
          setState(() {
            _latitude = pos.latitude;
            _longitude = pos.longitude;
          });
        }
      }

      setState(() {
        for (var img in images) {
          _receiptImagePaths.add(img.path);
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${images.length} images added from gallery!')),
      );
    }
  }

  void _showImageSourcePicker() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'CHOOSE SOURCE',
              style: GoogleFonts.inter(
                fontWeight: FontWeight.w900,
                fontSize: 13,
                color: const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _sourceButton(
                  Icons.camera_alt_rounded,
                  'FORENSIC CAMERA',
                  const Color(0xFF7C1D1D),
                  () {
                    Navigator.pop(context);
                    _captureReceipt();
                  },
                ),
                _sourceButton(
                  Icons.photo_library_rounded,
                  'GALLERY',
                  const Color(0xFF1E293B),
                  () {
                    Navigator.pop(context);
                    _pickFromGallery();
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  Widget _sourceButton(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: color, size: 28),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _captureOdoPhoto(bool isStart) async {
    final result = await Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const ForensicCamera()),
    );

    if (result != null && result is Map<String, dynamic>) {
      setState(() {
        if (isStart) {
          _odoStartImg = result['path'];
          _odoStartLat = result['latitude'];
          _odoStartLong = result['longitude'];
        } else {
          _odoEndImg = result['path'];
          _odoEndLat = result['latitude'];
          _odoEndLong = result['longitude'];
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Forensic ${isStart ? 'Start' : 'End'} Odo Captured!'),
        ),
      );
    }
  }

  Future<Position?> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please enable Location Services.')),
        );
      }
      return null;
    }

    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }

    if (permission == LocationPermission.deniedForever) return null;

    return await Geolocator.getCurrentPosition(
      desiredAccuracy: LocationAccuracy.medium,
    );
  }

  Future<void> _handleRequestAdvance() async {
    if (_advanceAmountController.text.isEmpty ||
        _advancePurposeController.text.isEmpty)
      return;

    setState(() => _isSubmitting = true);
    try {
      await _tripService.requestAdvance(
        _tripData.id,
        double.parse(_advanceAmountController.text),
        _advancePurposeController.text,
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Advance request submitted!')),
        );
        setState(() {
          _view = 'overview';
          _isSubmitting = false;
        });
        _refreshTripData();
        widget.onUpdate();
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
    }
  }

  bool _isOdoForm() {
    if (_selectedCategory != 'Local') return false;
    return [
      'Own Car',
      'Company Car',
      'Self Drive Rental',
      'Own Bike',
      'Rental Bike',
    ].contains(_selectedLocalSubType);
  }

  Future<void> _handleAddExpense({bool finalizeSubmit = false}) async {
    bool isOdo = _isOdoForm();

    // For non-odo forms, enforce basic validation as they are submitted as "Completed" immediately
    if (!isOdo) {
      if (_expenseAmountController.text.isEmpty) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Please enter amount')));
        return;
      }
    }

    setState(() => _isSubmitting = true);
    try {
      String? receiptBase64;
      if (_receiptImagePaths.isNotEmpty) {
        List<String> base64s = [];
        for (var path in _receiptImagePaths) {
          if (path == 'PROXIED_STILL_VALID')
            continue; // Should not happen with current logic but safe to have
          final bytes = await File(path).readAsBytes();
          base64s.add('data:image/jpeg;base64,${base64Encode(bytes)}');
        }
        // If we have existing ones and didn't add new ones yet, or want to combine:
        // For simplicity, if user adds NEW images, we use them. If none new, use existing.
        if (base64s.isEmpty && _existingReceiptBase64s.isNotEmpty) {
          receiptBase64 = _existingReceiptBase64s.join('|');
        } else {
          receiptBase64 = base64s.join('|');
        }
      } else if (_existingReceiptBase64s.isNotEmpty) {
        receiptBase64 = _existingReceiptBase64s.join('|');
      }

      String? odoStartBase64;
      if (_odoStartImg != null) {
        if (_odoStartImg == 'PROXIED_STILL_VALID') {
          odoStartBase64 = _existingOdoStartBase64;
        } else {
          final bytes = await File(_odoStartImg!).readAsBytes();
          odoStartBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        }
      }

      String? odoEndBase64;
      if (_odoEndImg != null) {
        if (_odoEndImg == 'PROXIED_STILL_VALID') {
          odoEndBase64 = _existingOdoEndBase64;
        } else {
          final bytes = await File(_odoEndImg!).readAsBytes();
          odoEndBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        }
      }

      final Map<String, dynamic> detailMap = {
        'remarks': _expenseRemarksController.text,
        'invoiceNo': _invoiceNoController.text,
      };

      if (_selectedCategory == 'Travel') {
        detailMap.addAll({
          'origin': _originController.text,
          'destination': _destController.text,
          'mode': _selectedMode,
          'bookedBy': _bookingType,
          'provider': _providerController.text,
          'ticketNo': _ticketNoController.text, // Corrected split
          'travelNo': _travelNoController.text, // Added travelNo
          'pnr': _pnrController.text,
          'carrierName': _carrierNameController.text,
          'class': _selectedClass,
          'bookingDate': DateFormat('yyyy-MM-dd').format(_bookingDate),
          'bookingTime': _bookingTimeController.text,
          'depDate': DateFormat('yyyy-MM-dd').format(_selectedDate),
          'arrDate': DateFormat('yyyy-MM-dd').format(_endDate),
          'mealIncluded': _mealIncluded,
          'excessBaggage': _excessBaggage,
          'isTatkal': _isTatkal,
          'boardingPoint': _boardingPointController.text,
          'driverName': _driverNameController.text,
          'toll': _tollController.text,
          'parking': _parkingController.text,
          'fuel': _fuelController.text,
          'rentalCharge': _rentalChargeController.text,
          'time': {
            'boardingTime': _boardingTimeController.text,
            'scheduledTime': _scheduledTimeController.text,
            'actualTime': _actualTimeController.text,
            'delay': int.tryParse(_delayController.text) ?? 0,
          },
        });
      } else if (_selectedCategory == 'Local') {
        detailMap['endDate'] = _endDate.toIso8601String().split('T')[0];
        detailMap['origin'] = _originController.text;
        detailMap['destination'] = _destController.text;
        detailMap['mode'] = _selectedLocalMode;
        detailMap['subType'] = _selectedLocalSubType;
        detailMap['bookedBy'] = _bookingType;
        detailMap['startTime'] = _startTimeController.text;
        detailMap['endTime'] = _endTimeController.text;
        detailMap['provider'] = _providerController.text;

        // Toll & Parking visible for: Own Car, Self Drive Rental, Own Bike, Company Car, Rented Car (With Driver), Pool Vehicle
        if ([
          'Own Car',
          'Self Drive Rental',
          'Own Bike',
          'Company Car',
          'Rented Car (With Driver)',
          'Pool Vehicle',
        ].contains(_selectedLocalSubType)) {
          detailMap['toll'] = _tollController.text;
          detailMap['parking'] = _parkingController.text;
        }

        // Fuel visible for: Own Car, Self Drive Rental, Own Bike
        if ([
          'Own Car',
          'Self Drive Rental',
          'Own Bike',
        ].contains(_selectedLocalSubType)) {
          detailMap['fuel'] = _fuelController.text;
        }
        bool shouldIncludeOdo = false;
        if (_selectedLocalMode == 'Bike') {
          shouldIncludeOdo = [
            'Own Bike',
            'Rental Bike',
          ].contains(_selectedLocalSubType);
        } else if (_selectedLocalMode == 'Car / Cab') {
          shouldIncludeOdo = [
            'Own Car',
            'Company Car',
            'Self Drive Rental',
          ].contains(_selectedLocalSubType);
        }

        if (shouldIncludeOdo) {
          detailMap['odoStart'] = _odoStartController.text;
          detailMap['odoEnd'] = _odoEndController.text;
          detailMap['odoStartImg'] = odoStartBase64;
          detailMap['odoEndImg'] = odoEndBase64;
          detailMap['odoStartLat'] = _odoStartLat;
          detailMap['odoStartLong'] = _odoStartLong;
          detailMap['odoEndLat'] = _odoEndLat;
          detailMap['odoEndLong'] = _odoEndLong;
        }
      } else if (_selectedCategory == 'Food') {
        detailMap.addAll({
          'mealCategory': _mealCategory,
          'mealType': _mealType,
          'mealTime': _mealTimeController.text,
          'pax': int.tryParse(_paxController.text) ?? 1,
          'persons': _paxController.text,
          'restaurant': _restaurantController.text,
          'invoiceNo': _invoiceNoController.text,
          'purpose': _addressController.text,
        });
      } else if (_selectedCategory == 'Stay') {
        int nights = _endDate.difference(_selectedDate).inDays;
        detailMap.addAll({
          'accomType': _selectedMode,
          'hotelName': _hotelController.text,
          'city': _cityController.text,
          'purpose': _stayPurposeController.text,
          'roomType': _roomType,
          'depDate': DateFormat('yyyy-MM-dd').format(_selectedDate),
          'endDate': DateFormat('yyyy-MM-dd').format(_endDate), // Legacy key
          'arrDate': DateFormat('yyyy-MM-dd').format(_endDate),
          'nights': nights > 0 ? nights : 0,
          'earlyCheckInCharges': _earlyCheckInController.text,
          'lateCheckOutCharges': _lateCheckOutController.text,
        });
      } else if (_selectedCategory == 'Incidental') {
        detailMap.addAll({
          'date': DateFormat('yyyy-MM-dd').format(_selectedDate),
          'incidentalType': _tollType,
          'location': _locationController.text,
          'otherReason': _tollType == 'Others'
              ? _otherReasonController.text
              : '',
          'description': _tollType == 'Others'
              ? _expenseRemarksController.text
              : '',
          'notes': _tollType != 'Others' ? _expenseRemarksController.text : '',
        });
      }

      // 24-Hour Timer Logic
      // If End Odo is captured for the first time, set the timestamp
      bool isNowFinalized = false;
      String? endOdoTimestamp;

      if (_selectedCategory == 'Local' && _odoEndImg != null) {
        // Checking if it was already finalized in a previous edit
        if (!_isFinalized) {
          endOdoTimestamp = DateTime.now().toIso8601String();
          isNowFinalized = true;
        } else {
          // Keep existing timestamp if already finalized
          isNowFinalized = true;
        }
      }

      bool isNowCompleted = _isCompleted || finalizeSubmit || !isOdo;

      // Map mobile categories to backend categories to avoid 400 Bad Request
      String backendCategory = _selectedCategory;
      if (_selectedCategory == 'Travel')
        backendCategory = 'Others';
      else if (_selectedCategory == 'Local')
        backendCategory = 'Fuel';
      else if (_selectedCategory == 'Stay')
        backendCategory = 'Accommodation';

      // Backend expects receipt_image as a JSON-encoded list of base64 strings
      String receiptImagesJson = jsonEncode([]);
      if (receiptBase64 != null) {
        receiptImagesJson = jsonEncode([receiptBase64]);
      }

      final Map<String, dynamic> payload = {
        'category': backendCategory,
        'date': _selectedDate.toIso8601String().split('T')[0],
        'amount': double.tryParse(_expenseAmountController.text) ?? 0.0,
        'description': jsonEncode({
          ...detailMap,
          'isFinalized': isNowFinalized,
          'isCompleted': isNowCompleted,
          'endOdoSubmittedAt':
              endOdoTimestamp ?? (detailMap['endOdoSubmittedAt'] ?? null),
        }),
        'receipt_image': receiptImagesJson,
        'latitude': _latitude ?? 0.0,
        'longitude': _longitude ?? 0.0,
        'trip': int.tryParse(_tripData.id) ?? _tripData.id, // Try as int first
      };

      // Handle Fixed Fields for ITS- (Local Travel) entries
      if (!_isFullTrip && backendCategory == 'Fuel') {
        payload['description'] = jsonEncode({
          ...detailMap,
          'mode': 'Bike',
          'subType': 'Own Bike',
          'bookedBy': 'Self Booked',
          'isFinalized': isNowFinalized,
          'isCompleted': isNowCompleted,
          'endOdoSubmittedAt':
              endOdoTimestamp ?? (detailMap['endOdoSubmittedAt'] ?? null),
        });
      }

      Map<String, dynamic> result;
      if (_isEditing && _editingExpenseId != null) {
        result = await _tripService.updateExpense(_editingExpenseId!, payload);
      } else {
        result = await _tripService.addExpense(payload);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              _isEditing
                  ? 'Detail updated!'
                  : 'Detail saved! You can now continue editing or close.',
            ),
            backgroundColor: const Color(0xFF166534),
          ),
        );

        // Trigger safety notification if start odo was just captured and saved to draft
        if (_odoStartImg != null && _odoStartImg != 'PROXIED_STILL_VALID') {
          // Use the local travel mode if available, otherwise fallback to trip mode
          String notifyMode = _selectedLocalMode ?? _tripData.travelMode;
          ExpenseReminderService.showSafetyNotification(notifyMode).catchError(
            (e) => debugPrint('Error sending safety notification: $e'),
          );
        }

        // Handle 24h Submission Reminder
        if (_editingExpenseId != null) {
          if (finalizeSubmit) {
            // User finally submitted the form - cancel the 22h warning
            ExpenseReminderService.cancelSubmissionReminder(
              _editingExpenseId!,
            ).catchError(
              (e) => debugPrint('Error cancelling submission reminder: $e'),
            );
          } else if (isNowFinalized) {
            // End odometer was just saved for the first time - schedule the 22h warning
            String loc = _destController.text.isNotEmpty
                ? _destController.text
                : 'selected journey';
            ExpenseReminderService.scheduleSubmissionReminder(
              _editingExpenseId!,
              loc,
            ).catchError(
              (e) => debugPrint('Error scheduling submission reminder: $e'),
            );
          }
        }

        setState(() {
          _isSubmitting = false;
          _isEditing = true; // Become editable form
          _editingExpenseId = result['id']?.toString();
          _isFinalized = isNowFinalized;
          _isCompleted = isNowCompleted;

          // Once saved, we can mark the images as "proxied" so we don't refire notification on every update
          if (_odoStartImg != null) _odoStartImg = 'PROXIED_STILL_VALID';
          if (_odoEndImg != null) _odoEndImg = 'PROXIED_STILL_VALID';
        });

        _refreshTripData();
        widget.onUpdate();
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to record expense: $e')));
    }
  }

  Future<void> _handleDeleteExpense() async {
    if (_editingExpenseId == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Delete Expense',
          style: GoogleFonts.inter(fontWeight: FontWeight.w900),
        ),
        content: const Text(
          'Are you sure you want to delete this expense entry?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Delete',
              style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold),
            ),
          ),
        ],
      ),
    );

    if (confirm != true) return;

    setState(() => _isSubmitting = true);
    try {
      await _tripService.deleteExpense(_editingExpenseId!);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Expense deleted successfully'),
            backgroundColor: Colors.red,
          ),
        );
        widget.onUpdate();
        Navigator.pop(context);
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted)
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to delete expense: $e')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildHeader(),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: _isLoading
                  ? const Center(
                      child: Padding(
                        padding: EdgeInsets.all(40),
                        child: CircularProgressIndicator(),
                      ),
                    )
                  : _buildContent(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    final leaderName = _tripData.employee ?? 'Employee';
    final designation = _tripData.leaderDesignation ?? 'Staff';
    final empId = _tripData.leaderEmployeeId ?? '00000';

    return Container(
      padding: const EdgeInsets.fromLTRB(25, 20, 25, 15),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(100),
                    ),
                    child: Text(
                      _tripData.id,
                      style: GoogleFonts.inter(
                        color: const Color(0xFF7C1D1D),
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Advance & Expenses',
                    style: GoogleFonts.interTight(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              IconButton(
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close_rounded, color: Colors.black54),
                style: IconButton.styleFrom(
                  backgroundColor: const Color(0xFFF1F5F9),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF7C1D1D).withOpacity(0.1),
                  radius: 18,
                  child: const Icon(
                    Icons.person_rounded,
                    size: 18,
                    color: Color(0xFF7C1D1D),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        leaderName,
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      Text(
                        '$designation | ID: $empId',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildContent() {
    if (_view == 'overview') return _buildOverview();
    if (_view == 'request_advance') return _buildRequestAdvance();
    if (_view == 'add_expense') return _buildAddExpense();
    return Container();
  }

  Widget _buildOverview() {
    final balance = _tripData.walletBalance ?? 0.0;
    final isLow = balance < 500;

    return Column(
      children: [
        // Balance Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: isLow ? const Color(0xFF991B1B) : const Color(0xFF0B2844),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color:
                    (isLow ? const Color(0xFF991B1B) : const Color(0xFF0B2844))
                        .withOpacity(0.3),
                blurRadius: 20,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            children: [
              Text(
                'Available Trip Balance',
                style: GoogleFonts.inter(
                  color: Colors.white70,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                '₹${balance.toStringAsFixed(0)}',
                style: GoogleFonts.inter(
                  color: Colors.white,
                  fontSize: 36,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.white10,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isLow ? Icons.error_outline : Icons.check_circle_outline,
                      color: Colors.white,
                      size: 14,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      isLow ? 'Low Balance Alert!' : 'Balance is healthy',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  Expanded(
                    child: _statItem(
                      Icons.arrow_upward_rounded,
                      'Total Advances',
                      '+ ₹${(_tripData.totalApprovedAdvance ?? 0).toStringAsFixed(0)}',
                    ),
                  ),
                  Container(width: 1, height: 30, color: Colors.white10),
                  Expanded(
                    child: _statItem(
                      Icons.arrow_downward_rounded,
                      'Total Spent',
                      '- ₹${(_tripData.totalExpenses ?? 0).toStringAsFixed(0)}',
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        // Actions
        Row(
          children: [
            Expanded(
              child: _actionBtn(
                Icons.currency_rupee_rounded,
                'Top Up',
                const Color(0xFF0B2844),
                () => setState(() => _view = 'request_advance'),
              ),
            ),
            const SizedBox(width: 16),
            // Expanded(
            //   child: _actionBtn(
            //     Icons.add_rounded,
            //     'Add Expense',
            //     const Color(0xFF7C1D1D),
            //     () {
            //       _clearForm();
            //       setState(() => _view = 'add_expense');
            //     },
            //   ),
            // ),
          ],
        ),
        const SizedBox(height: 30),
        // Activity
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Trip Activity',
              style: GoogleFonts.interTight(
                fontSize: 16,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
              ),
            ),
            const Icon(Icons.history_rounded, size: 18, color: Colors.black38),
          ],
        ),
        const SizedBox(height: 16),
        _buildActivityList(),
      ],
    );
  }

  Widget _statItem(IconData icon, String label, String value) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 12, color: Colors.white70),
            const SizedBox(width: 4),
            Text(
              label,
              style: GoogleFonts.inter(
                color: Colors.white70,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: GoogleFonts.inter(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }

  Widget _actionBtn(
    IconData icon,
    String label,
    Color color,
    VoidCallback onTap,
  ) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withOpacity(0.1)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(
              label,
              style: GoogleFonts.inter(
                color: color,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActivityList() {
    final activities = <Map<String, dynamic>>[];
    double safeDouble(dynamic val) {
      if (val == null) return 0.0;
      if (val is num) return val.toDouble();
      if (val is String) return double.tryParse(val) ?? 0.0;
      return 0.0;
    }

    if (_tripData.advances != null) {
      for (var a in _tripData.advances!) {
        activities.add({
          'type': 'advance',
          'title': 'Advance: ${a['purpose']}',
          'date': a['created_at'] ?? 'N/A',
          'amount': safeDouble(a['requested_amount']),
          'status': a['status'] ?? 'Submitted',
        });
      }
    }
    if (_tripData.expenses != null) {
      for (var e in _tripData.expenses!) {
        Map<String, dynamic> detail = {};
        try {
          if (e['description'] != null) detail = jsonDecode(e['description']);
        } catch (_) {}

        final displayCategory = e['category'] ?? 'Expense';
        bool isFinalized = detail['isFinalized'] ?? false;
        bool isCompleted = detail['isCompleted'] ?? false;
        bool isOdoForm =
            (displayCategory == 'Local' || displayCategory == 'Fuel') &&
            [
              'Own Car',
              'Company Car',
              'Self Drive Rental',
              'Own Bike',
              'Rental Bike',
            ].contains(detail['subType']);

        String? expiresIn;
        if (isOdoForm &&
            isFinalized &&
            detail['endOdoSubmittedAt'] != null &&
            !isCompleted) {
          try {
            final submittedAt = DateTime.parse(detail['endOdoSubmittedAt']);
            final now = DateTime.now();
            final diff = now.difference(submittedAt);
            if (diff.inHours >= 24) {
              // Automatically delete or skip if > 24h
              // _tripService.deleteExpense(e['id'].toString()); // Risky to do inside build
              continue;
            } else {
              final remaining = const Duration(hours: 24) - diff;
              expiresIn = "${remaining.inHours}h ${remaining.inMinutes % 60}m";
            }
          } catch (_) {}
        }

        String subtitle = '';

        if (displayCategory == 'Travel' || displayCategory == 'Others') {
          subtitle =
              '${detail['origin'] ?? ''} ➔ ${detail['destination'] ?? ''} | ${detail['mode'] ?? ''}${detail['pnr'] != null ? ' | PNR: ${detail['pnr']}' : ''}';
        } else if (displayCategory == 'Local' || displayCategory == 'Fuel') {
          subtitle =
              '${detail['location'] ?? 'Local Travel'} | ${detail['mode'] ?? ''}${detail['subType'] != null ? ' (${detail['subType']})' : ''}';
        } else if (displayCategory == 'Stay' ||
            displayCategory == 'Accommodation') {
          subtitle =
              '${detail['hotelName'] ?? ''}, ${detail['city'] ?? ''} | ${detail['roomType'] ?? ''}';
        }

        String displayTitle = displayCategory;
        if (displayTitle == 'Others')
          displayTitle = 'Travel';
        else if (displayTitle == 'Fuel')
          displayTitle = 'Local Conveyance';
        else if (displayTitle == 'Accommodation')
          displayTitle = 'Stay & Lodging';

        activities.add({
          'id': e['id'],
          'type': 'expense',
          'title': displayTitle,
          'subtitle': subtitle,
          'date': e['date'] ?? 'N/A',
          'amount': safeDouble(e['amount']),
          'status': 'Recorded',
          'raw_data': e,
          'expires_in': expiresIn,
          'is_completed': isCompleted,
          'is_odo_form': isOdoForm,
        });
      }
    }

    if (activities.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(40),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: const Color(0xFFF1F5F9),
            style: BorderStyle.none,
          ),
        ),
        child: Center(
          child: Text(
            'No transactions recorded yet.',
            style: GoogleFonts.inter(
              color: Colors.black38,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            ),
          ),
        ),
      );
    }

    activities.sort((a, b) => b['date'].compareTo(a['date']));

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: activities.length,
      separatorBuilder: (_, __) => const SizedBox(height: 12),
      itemBuilder: (context, index) {
        final act = activities[index];
        final isAdvance = act['type'] == 'advance';
        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF1F5F9)),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isAdvance
                          ? const Color(0xFFDCFCE7)
                          : const Color(0xFFF1F5F9),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Icon(
                        isAdvance
                            ? Icons.arrow_upward_rounded
                            : Icons.receipt_long_rounded,
                        size: 18,
                        color: isAdvance
                            ? const Color(0xFF166534)
                            : const Color(0xFF475569),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          act['title'],
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF1E293B),
                          ),
                        ),
                        if (act['subtitle'] != null &&
                            act['subtitle'].toString().isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text(
                              act['subtitle'],
                              style: GoogleFonts.inter(
                                fontSize: 10,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ),
                        const SizedBox(height: 4),
                        Text(
                          act['date'],
                          style: GoogleFonts.inter(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.black26,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        '₹${act['amount'].toStringAsFixed(0)}',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w900,
                          color: isAdvance
                              ? const Color(0xFF166534)
                              : const Color(0xFF0F172A),
                        ),
                      ),
                      if (!isAdvance)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (act['is_odo_form'] == true &&
                                act['is_completed'] != true)
                              IconButton(
                                onPressed: () => _editExpense(act['raw_data']),
                                icon: const Icon(
                                  Icons.edit_note_rounded,
                                  size: 18,
                                  color: Color(0xFF3B82F6),
                                ),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                              ),
                            if (act['is_odo_form'] == true &&
                                act['is_completed'] != true)
                              const SizedBox(width: 8),
                            IconButton(
                              onPressed: () => _deleteExpense(act['id']),
                              icon: const Icon(
                                Icons.delete_outline_rounded,
                                size: 18,
                                color: Color(0xFFEF4444),
                              ),
                              padding: EdgeInsets.zero,
                              constraints: const BoxConstraints(),
                            ),
                          ],
                        ),
                    ],
                  ),
                ],
              ),
              if (act['expires_in'] != null)
                Padding(
                  padding: const EdgeInsets.only(top: 8, left: 52),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.timer_outlined,
                        size: 12,
                        color: Color(0xFF7C1D1D),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'Expires in ${act['expires_in']}',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF7C1D1D),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _editExpense(Map<String, dynamic> expense) {
    Map<String, dynamic> detail = {};
    try {
      if (expense['description'] != null)
        detail = jsonDecode(expense['description']);
    } catch (_) {}

    setState(() {
      _view = 'add_expense';
      _isEditing = true;
      _editingExpenseId = expense['id'].toString();

      // Reverse map backend categories to mobile categories
      String cat = expense['category'] ?? 'Travel';
      if (cat == 'Others')
        cat = 'Travel';
      else if (cat == 'Fuel')
        cat = 'Local';
      else if (cat == 'Accommodation')
        cat = 'Stay';
      _selectedCategory = cat;
      _expenseAmountController.text = (expense['amount'] ?? 0).toString();
      _expenseRemarksController.text = detail['remarks'] ?? '';
      _invoiceNoController.text = detail['invoiceNo'] ?? '';
      _isFinalized = detail['isFinalized'] ?? false;
      _isCompleted = detail['isCompleted'] ?? false;

      // Populate Category Specifics
      _originController.text = detail['origin'] ?? '';
      _destController.text = detail['destination'] ?? '';
      _locationController.text = detail['location'] ?? '';
      _hotelController.text = detail['hotelName'] ?? '';
      _cityController.text = detail['city'] ?? '';
      _restaurantController.text = detail['restaurant'] ?? '';
      _paxController.text =
          (detail['pax'] ?? detail['persons'] ?? '1').toString();
      _providerController.text = detail['provider'] ?? '';
      _travelNoController.text = detail['travelNo'] ?? '';
      _pnrController.text = detail['pnr'] ?? '';
      _boardingTimeController.text = detail['time']?['boardingTime'] ?? '';
      _scheduledTimeController.text = detail['time']?['scheduledTime'] ?? '';
      _actualTimeController.text = detail['time']?['actualTime'] ?? '';
      _delayController.text = (detail['time']?['delay'] ?? '0').toString();
      _tollController.text = (detail['toll'] ?? '').toString();
      _parkingController.text = (detail['parking'] ?? '').toString();
      _fuelController.text = (detail['fuel'] ?? '').toString();
      _carrierNameController.text = detail['carrierName'] ?? '';
      _bookingTimeController.text = detail['bookingTime'] ?? '';
      _invoiceNoController.text = detail['invoiceNo'] ?? '';
      _boardingPointController.text = detail['boardingPoint'] ?? '';
      _driverNameController.text = detail['driverName'] ?? '';
      _startTimeController.text = detail['startTime'] ?? '';
      _endTimeController.text = detail['endTime'] ?? '';
      _odoStartController.text = (detail['odoStart'] ?? '').toString();
      _odoEndController.text = (detail['odoEnd'] ?? '').toString();
      _otherReasonController.text = detail['otherReason'] ?? '';
      _earlyCheckInController.text =
          (detail['earlyCheckInCharges'] ?? '').toString();
      _lateCheckOutController.text =
          (detail['lateCheckOutCharges'] ?? '').toString();
      _stayPurposeController.text = detail['purpose'] ?? '';
      _mealTimeController.text = detail['mealTime'] ?? '';
      _addressController.text = detail['purpose'] ?? '';

      _selectedMode = detail['mode'] ?? detail['accomType'];
      _selectedLocalMode = detail['mode'];
      _selectedLocalSubType = detail['subType'];
      _bookingType = detail['bookedBy'] ?? 'Self Booked';
      _selectedClass = detail['class'] ?? 'Economy';
      _mealIncluded = detail['mealIncluded'] ?? false;
      _excessBaggage = detail['excessBaggage'] ?? false;
      _isTatkal = detail['isTatkal'] ?? false;
      _mealCategory = detail['mealCategory'] ?? 'Self Meal';
      _mealType = detail['mealType'] ?? 'Lunch';
      _roomType = detail['roomType'] ?? 'Standard';
      _tollType = detail['incidentalType'] ?? 'Toll';

      try {
        if (detail['depDate'] != null)
          _selectedDate = DateTime.parse(detail['depDate']);
        if (detail['arrDate'] != null)
          _endDate = DateTime.parse(detail['arrDate']);
        if (detail['bookingDate'] != null)
          _bookingDate = DateTime.parse(detail['bookingDate']);
      } catch (_) {}

      // Images
      _receiptImagePaths.clear();
      _existingReceiptBase64s = [];
      if (expense['receipt_image'] != null) {
        if (expense['receipt_image'] is List) {
          _existingReceiptBase64s = List<String>.from(expense['receipt_image']);
        } else if (expense['receipt_image'] is String) {
          try {
            final decoded = jsonDecode(expense['receipt_image']);
            if (decoded is List)
              _existingReceiptBase64s = List<String>.from(decoded);
          } catch (_) {}
        }
      }

      // Odo Photos (Temporary placeholders if we had them)
      _existingOdoStartBase64 = detail['odoStartImg'];
      _existingOdoEndBase64 = detail['odoEndImg'];
      _odoStartImg = _existingOdoStartBase64 != null
          ? 'PROXIED_STILL_VALID'
          : null;
      _odoEndImg = _existingOdoEndBase64 != null ? 'PROXIED_STILL_VALID' : null;
    });
  }

  Future<void> _deleteExpense(dynamic id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Expense?'),
        content: const Text('Are you sure you want to remove this record?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await _tripService.deleteExpense(id.toString());
        _refreshTripData();
        widget.onUpdate();
      } catch (e) {
        if (mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  Widget _buildRequestAdvance() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              onPressed: () => setState(() => _view = 'overview'),
              icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18),
            ),
            const SizedBox(width: 8),
            Text(
              'Request New Advance',
              style: GoogleFonts.interTight(
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),
        _formField(
          'Amount (INR)',
          TextField(
            controller: _advanceAmountController,
            keyboardType: TextInputType.number,
            decoration: _inputDecoration(
              Icons.currency_rupee_rounded,
              'Enter amount',
            ),
          ),
        ),
        const SizedBox(height: 20),
        _formField(
          'Purpose / Description',
          TextField(
            controller: _advancePurposeController,
            maxLines: 4,
            decoration: _inputDecoration(null, 'Why do you need this top up?'),
          ),
        ),
        const SizedBox(height: 30),
        SizedBox(
          width: double.infinity,
          height: 60,
          child: ElevatedButton(
            onPressed: _isSubmitting ? null : _handleRequestAdvance,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7C1D1D),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(18),
              ),
            ),
            child: _isSubmitting
                ? const CircularProgressIndicator(color: Colors.white)
                : Text(
                    'Submit Request',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildAddExpense() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: 24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                _isEditing ? 'Edit Expense' : 'Add Expense Detail',
                style: GoogleFonts.interTight(
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF0F172A),
                ),
              ),
              if (_isEditing)
                TextButton.icon(
                  onPressed: () {
                    _clearForm();
                    setState(() {
                      _view = 'overview';
                      _isEditing = false;
                      _editingExpenseId = null;
                    });
                  },
                  icon: const Icon(
                    Icons.check_circle_outline_rounded,
                    size: 18,
                  ),
                  label: Text(
                    'DONE',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                  ),
                  style: TextButton.styleFrom(foregroundColor: Colors.green),
                ),
            ],
          ),
        ),

        // NATURE Section (Luggage + Category)
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'NATURE',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: Colors.blueGrey.withOpacity(0.6),
                    letterSpacing: 1.2,
                  ),
                ),
                Row(
                  children: [
                    Text(
                      'Luggage?',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.blueGrey,
                      ),
                    ),
                    Transform.scale(
                      scale: 0.7,
                      child: Switch(
                        value: _carryingLuggage,
                        onChanged: (v) => setState(() => _carryingLuggage = v),
                        activeColor: const Color(0xFF3B82F6),
                      ),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (_carryingLuggage) ...[
              TextField(
                controller: _luggageWeightController,
                keyboardType: TextInputType.number,
                decoration: _inputDecoration(null, 'Weight (Kg)'),
              ),
              const SizedBox(height: 12),
            ],
            _categoryPicker(),
          ],
        ),

        const SizedBox(height: 24),
        const Divider(color: Color(0xFFF1F5F9)),
        const SizedBox(height: 24),

        // Category Specific Fields
        if (_selectedCategory == 'Travel') ...[
          // Segment 1
          _formField(
            'DATES (BOOK - JOURNEY)',
            Column(
              children: [
                _formField(
                  'BOOKING DATE & TIME',
                  Row(
                    children: [
                      Expanded(
                        child: InkWell(
                          onTap: () async {
                            final d = await showDatePicker(
                              context: context,
                              initialDate: _bookingDate,
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now().add(
                                const Duration(days: 365),
                              ),
                            );
                            if (d != null) setState(() => _bookingDate = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 15,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  DateFormat('dd-MM-yyyy').format(_bookingDate),
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                const Icon(
                                  Icons.calendar_month_outlined,
                                  size: 16,
                                  color: Colors.black26,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _bookingTimeController,
                          decoration: _inputDecorationSuffix(
                            Icons.access_time_outlined,
                            'HH:MM',
                          ),
                          readOnly: true,
                          onTap: () async {
                            final t = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.now(),
                            );
                            if (t != null)
                              _bookingTimeController.text =
                                  "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _formField(
            'MODE & TYPE',
            Column(
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _selectedMode,
                  hint: Text(
                    'Select Mode',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: Colors.black26,
                    ),
                  ),
                  items: _travelModes
                      .map(
                        (m) => DropdownMenuItem(
                          value: m,
                          child: Text(
                            m,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() {
                    _selectedMode = v!;
                    if (_selectedMode == 'Flight')
                      _selectedClass = 'Economy';
                    else if (_selectedMode == 'Train')
                      _selectedClass = 'Sleeper';
                    else if (_selectedMode == 'Intercity Bus')
                      _selectedClass = 'Volvo';
                    else if (_selectedMode == 'Intercity Cab')
                      _selectedClass = 'Sedan';
                    else if (_selectedMode == 'Intercity Car')
                      _selectedClass = 'Own Car';
                  }),
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Colors.black26,
                  ),
                  decoration: _inputDecoration(null, ''),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _bookingType,
                  items: _bookedByOptions
                      .map(
                        (m) => DropdownMenuItem(
                          value: m,
                          child: Text(
                            m,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    setState(() {
                      _bookingType = v!;
                      if (_bookingType == 'Company Booked') {
                        _expenseAmountController.text = '0';
                      }
                    });
                  },
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Colors.black26,
                  ),
                  decoration: _inputDecoration(null, ''),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Segment 3
          _formField(
            'ROUTE & CARRIER INFO',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _originController,
                        decoration: _inputDecoration(
                          null,
                          _selectedMode == 'Flight'
                              ? 'From Airport'
                              : (_selectedMode == 'Intercity Cab'
                                    ? 'From Location'
                                    : 'From'),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _destController,
                        decoration: _inputDecoration(
                          null,
                          _selectedMode == 'Flight'
                              ? 'To Airport'
                              : (_selectedMode == 'Intercity Cab'
                                    ? 'To Location'
                                    : 'To'),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                if (_selectedMode == 'Intercity Bus')
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: TextField(
                      controller: _boardingPointController,
                      decoration: _inputDecoration(null, 'Boarding Point'),
                    ),
                  ),
                if (_selectedMode == 'Flight') ...[
                  TextField(
                    controller: _providerController,
                    decoration: _inputDecoration(null, 'Airline Name'),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _travelNoController,
                          decoration: _inputDecoration(null, 'Flight No.'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _ticketNoController,
                          decoration: _inputDecoration(null, 'Ticket Number'),
                        ),
                      ),
                    ],
                  ),
                ] else if (_selectedMode == 'Train') ...[
                  TextField(
                    controller: _carrierNameController,
                    decoration: _inputDecoration(null, 'Train Name'),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _travelNoController,
                          decoration: _inputDecoration(null, 'Train No.'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _ticketNoController,
                          decoration: _inputDecoration(null, 'Ticket No.'),
                        ),
                      ),
                    ],
                  ),
                ] else if (_selectedMode == 'Intercity Bus') ...[
                  TextField(
                    controller: _carrierNameController,
                    decoration: _inputDecoration(null, 'Bus Operator'),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _ticketNoController,
                          decoration: _inputDecoration(null, 'Ticket No.'),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _pnrController,
                          decoration: _inputDecoration(null, 'PNR'),
                        ),
                      ),
                    ],
                  ),
                ] else if (_selectedMode == 'Intercity Cab') ...[
                  TextField(
                    controller: _providerController,
                    decoration: _inputDecoration(null, 'Provider / Vendor'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _driverNameController,
                    decoration: _inputDecoration(null, 'Driver Name'),
                  ),
                ] else if (_selectedMode == 'Intercity Car') ...[
                  TextField(
                    controller: _providerController,
                    decoration: _inputDecoration(null, 'Provider / Agent'),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _carrierNameController,
                    decoration: _inputDecoration(null, 'Carrier Name'),
                  ),
                ],

                if (['Flight', 'Train'].contains(_selectedMode)) ...[
                  const SizedBox(height: 8),
                  TextField(
                    controller: _pnrController,
                    decoration: _inputDecoration(
                      null,
                      _selectedMode == 'Train' ? 'PNR / Ref.' : 'PNR',
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: (() {
                          final items = _selectedMode == 'Flight'
                              ? [
                                  'Economy',
                                  'Premium Economy',
                                  'Business',
                                  'First',
                                ]
                              : (_selectedMode == 'Train'
                                    ? [
                                        'Sleeper',
                                        '3AC',
                                        '2AC',
                                        '1AC',
                                        'Chair Car',
                                        'General',
                                      ]
                                    : (_selectedMode == 'Intercity Bus'
                                          ? [
                                              'Sleeper',
                                              'Semi Sleeper',
                                              'AC',
                                              'Non-AC',
                                              'Volvo',
                                              'Seater',
                                            ]
                                          : (_selectedMode == 'Intercity Cab'
                                                ? [
                                                    'Sedan',
                                                    'SUV',
                                                    'MUV',
                                                    'Hatchback',
                                                  ]
                                                : [
                                                    'Own Car',
                                                    'Company Car',
                                                    'Rental Car (With Driver)',
                                                    'Self Drive Rental',
                                                    'Pool Vehicle',
                                                  ])));
                          return items.contains(_selectedClass)
                              ? _selectedClass
                              : items[0];
                        })(),
                        items:
                            (_selectedMode == 'Flight'
                                    ? [
                                        'Economy',
                                        'Premium Economy',
                                        'Business',
                                        'First',
                                      ]
                                    : (_selectedMode == 'Train'
                                          ? [
                                              'Sleeper',
                                              '3AC',
                                              '2AC',
                                              '1AC',
                                              'Chair Car',
                                              'General',
                                            ]
                                          : (_selectedMode == 'Intercity Bus'
                                                ? [
                                                    'Sleeper',
                                                    'Semi Sleeper',
                                                    'AC',
                                                    'Non-AC',
                                                    'Volvo',
                                                    'Seater',
                                                  ]
                                                : (_selectedMode ==
                                                          'Intercity Cab'
                                                      ? [
                                                          'Sedan',
                                                          'SUV',
                                                          'MUV',
                                                          'Hatchback',
                                                        ]
                                                      : [
                                                          'Own Car',
                                                          'Company Car',
                                                          'Rental Car (With Driver)',
                                                          'Self Drive Rental',
                                                          'Pool Vehicle',
                                                        ]))))
                                .map(
                                  (c) => DropdownMenuItem(
                                    value: c,
                                    child: Text(
                                      c,
                                      style: GoogleFonts.inter(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                        onChanged: (v) => setState(() => _selectedClass = v!),
                        decoration: _inputDecorationSuffix(
                          null,
                          _selectedMode == 'Intercity Bus'
                              ? 'Bus Type'
                              : (_selectedMode == 'Intercity Cab' ||
                                        _selectedMode == 'Intercity Car'
                                    ? 'Type'
                                    : 'Cls'),
                        ),
                      ),
                    ),
                    if (_selectedMode != 'Intercity Cab' &&
                        _selectedMode != 'Intercity Car') ...[
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _providerController,
                          decoration: _inputDecoration(null, 'Vendor / Agent'),
                        ),
                      ),
                    ],
                  ],
                ),
                if (_selectedMode == 'Intercity Car') ...[
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _formField(
                          'TOLL',
                          TextField(
                            controller: _tollController,
                            keyboardType: TextInputType.number,
                            decoration: _inputDecoration(null, '0.00'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _formField(
                          'PARKING',
                          TextField(
                            controller: _parkingController,
                            keyboardType: TextInputType.number,
                            decoration: _inputDecoration(null, '0.00'),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: _formField(
                          'FUEL',
                          TextField(
                            controller: _fuelController,
                            keyboardType: TextInputType.number,
                            decoration: _inputDecoration(null, '0.00'),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: _formField(
                          'RENTAL CHG',
                          TextField(
                            controller: _rentalChargeController,
                            keyboardType: TextInputType.number,
                            decoration: _inputDecoration(null, '0.00'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Segment 4
          _formField(
            'JOURNEY SCHEDULE',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _formField(
                        'DEP. DATE',
                        InkWell(
                          onTap: () async {
                            final d = await showDatePicker(
                              context: context,
                              initialDate: _selectedDate,
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now().add(
                                const Duration(days: 365),
                              ),
                            );
                            if (d != null) setState(() => _selectedDate = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 15,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  DateFormat(
                                    'dd-MM-yyyy',
                                  ).format(_selectedDate),
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                const Icon(
                                  Icons.calendar_month_outlined,
                                  size: 16,
                                  color: Colors.black26,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _formField(
                        'ARR. DATE',
                        InkWell(
                          onTap: () async {
                            final d = await showDatePicker(
                              context: context,
                              initialDate: _endDate,
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now().add(
                                const Duration(days: 365),
                              ),
                            );
                            if (d != null) setState(() => _endDate = d);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 15,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xFFF8FAFC),
                              border: Border.all(
                                color: const Color(0xFFE2E8F0),
                              ),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  DateFormat('dd-MM-yyyy').format(_endDate),
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                                const Icon(
                                  Icons.calendar_month_outlined,
                                  size: 16,
                                  color: Colors.black26,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _formField(
                        'DEP. TIME',
                        TextField(
                          controller: _boardingTimeController,
                          decoration: _inputDecorationSuffix(
                            Icons.access_time_outlined,
                            'HH:MM',
                          ),
                          readOnly: true,
                          onTap: () async {
                            final t = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.now(),
                            );
                            if (t != null)
                              _boardingTimeController.text =
                                  "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                          },
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _formField(
                        'ARR. TIME',
                        TextField(
                          controller: _scheduledTimeController,
                          decoration: _inputDecorationSuffix(
                            Icons.access_time_outlined,
                            'HH:MM',
                          ),
                          readOnly: true,
                          onTap: () async {
                            final t = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.now(),
                            );
                            if (t != null)
                              _scheduledTimeController.text =
                                  "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                          },
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _formField(
                        'ACT. TIME',
                        TextField(
                          controller: _actualTimeController,
                          decoration: _inputDecorationSuffix(
                            Icons.access_time_outlined,
                            'HH:MM',
                          ),
                          readOnly: true,
                          onTap: () async {
                            final t = await showTimePicker(
                              context: context,
                              initialTime: TimeOfDay.now(),
                            );
                            if (t != null)
                              _actualTimeController.text =
                                  "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                          },
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _formField(
                        'DELAY (MINS)',
                        TextField(
                          controller: _delayController,
                          keyboardType: TextInputType.number,
                          decoration: _inputDecorationSuffix(null, 'Minutes'),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (_selectedMode == 'Flight') ...[
                      _checkboxItem(
                        'Meal?',
                        _mealIncluded,
                        (v) => setState(() => _mealIncluded = v!),
                      ),
                      const SizedBox(width: 16),
                      _checkboxItem(
                        'Baggage?',
                        _excessBaggage,
                        (v) => setState(() => _excessBaggage = v!),
                      ),
                    ],
                    if (_selectedMode == 'Train') ...[
                      _checkboxItem(
                        'Tatkal?',
                        _isTatkal,
                        (v) => setState(() => _isTatkal = v!),
                      ),
                      const SizedBox(width: 16),
                      _checkboxItem(
                        'Meal Provided?',
                        _mealIncluded,
                        (v) => setState(() => _mealIncluded = v!),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 10), // small gap before Expense
        ] else if (_selectedCategory == 'Local') ...[
          _formField(
            'DATES (START - END)',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final d = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(
                              const Duration(days: 365),
                            ),
                          );
                          if (d != null) setState(() => _selectedDate = d);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 15,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                DateFormat('dd-MM-yyyy').format(_selectedDate),
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const Icon(
                                Icons.calendar_month_outlined,
                                size: 16,
                                color: Colors.black26,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final d = await showDatePicker(
                            context: context,
                            initialDate: _endDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(
                              const Duration(days: 365),
                            ),
                          );
                          if (d != null) setState(() => _endDate = d);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 15,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                DateFormat('dd-MM-yyyy').format(_endDate),
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const Icon(
                                Icons.calendar_month_outlined,
                                size: 16,
                                color: Colors.black26,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'MODE & TYPE',
            Column(
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _selectedLocalMode,
                  hint: Text(
                    'Select Mode',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: Colors.black26,
                    ),
                  ),
                  items: _localTravelModes
                      .map(
                        (m) => DropdownMenuItem(
                          value: m,
                          child: Text(
                            m,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: _isFullTrip
                      ? (v) {
                          setState(() {
                            _selectedLocalMode = v!;
                            _selectedLocalSubType =
                                null; // Reset subtype on mode change
                          });
                        }
                      : null,
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Colors.black26,
                  ),
                  decoration: _inputDecoration(null, ''),
                ),
                if (_selectedLocalMode != null) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value: _selectedLocalSubType,
                    hint: Text(
                      'Select Sub-Type',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: Colors.black26,
                      ),
                    ),
                    items: (_localSubTypes[_selectedLocalMode] ?? [])
                        .map(
                          (m) => DropdownMenuItem(
                            value: m,
                            child: Text(
                              m,
                              style: GoogleFonts.inter(
                                fontWeight: FontWeight.w700,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        )
                        .toList(),
                    onChanged: _isFullTrip
                        ? (v) {
                            setState(() {
                              _selectedLocalSubType = v!;
                            });
                          }
                        : null,
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Colors.black26,
                    ),
                    decoration: _inputDecoration(null, ''),
                  ),
                ],
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _bookingType,
                  hint: Text(
                    'Select Booked By',
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: Colors.black26,
                    ),
                  ),
                  items: _bookedByOptions
                      .map(
                        (m) => DropdownMenuItem(
                          value: m,
                          child: Text(
                            m,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) {
                    setState(() {
                      _bookingType = v!;
                      if (_bookingType == 'Company Booked') {
                        _expenseAmountController.text = '0';
                      }
                    });
                  },
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Colors.black26,
                  ),
                  decoration: _inputDecoration(null, ''),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'LOCATION',
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _originController,
                    decoration: _inputDecoration(null, 'From Location'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: _destController,
                    decoration: _inputDecoration(null, 'To Location'),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'TRACKING (TIME / ODO)',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _startTimeController,
                        decoration: _inputDecorationSuffix(
                          Icons.access_time_outlined,
                          'Start Time',
                        ),
                        readOnly: true,
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: TimeOfDay.now(),
                          );
                          if (t != null)
                            _startTimeController.text =
                                "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _endTimeController,
                        decoration: _inputDecorationSuffix(
                          Icons.access_time_outlined,
                          'End Time',
                        ),
                        readOnly: true,
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: TimeOfDay.now(),
                          );
                          if (t != null)
                            _endTimeController.text =
                                "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                        },
                      ),
                    ),
                  ],
                ),
                if (_selectedLocalMode == 'Bike') ...[
                  if ([
                    'Own Bike',
                    'Rental Bike',
                  ].contains(_selectedLocalSubType)) ...[
                    const SizedBox(height: 12),
                    _buildOdoCaptureFields(),
                  ],
                ] else if (_selectedLocalMode == 'Car / Cab') ...[
                  if ([
                    'Own Car',
                    'Company Car',
                    'Self Drive Rental',
                  ].contains(_selectedLocalSubType)) ...[
                    const SizedBox(height: 12),
                    _buildOdoCaptureFields(),
                  ],
                ],
              ],
            ),
          ),
          if (_selectedLocalMode != 'Public Transport' &&
              _selectedLocalMode != null) ...[
            if ([
              'Own Car',
              'Self Drive Rental',
              'Own Bike',
              'Company Car',
              'Rented Car (With Driver)',
              'Pool Vehicle',
            ].contains(_selectedLocalSubType)) ...[
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _formField(
                      'TOLL',
                      TextField(
                        controller: _tollController,
                        keyboardType: TextInputType.number,
                        decoration: _inputDecoration(null, '0.00'),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _formField(
                      'PARKING',
                      TextField(
                        controller: _parkingController,
                        keyboardType: TextInputType.number,
                        decoration: _inputDecoration(null, '0.00'),
                      ),
                    ),
                  ),
                ],
              ),
            ],
            if ([
              'Own Car',
              'Self Drive Rental',
              'Own Bike',
            ].contains(_selectedLocalSubType)) ...[
              const SizedBox(height: 12),
              _formField(
                'FUEL',
                TextField(
                  controller: _fuelController,
                  keyboardType: TextInputType.number,
                  decoration: _inputDecoration(null, '0.00'),
                ),
              ),
            ],
          ],
        ] else if (_selectedCategory == 'Food') ...[
          _formField(
            'DATE & TIME',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final d = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(
                              const Duration(days: 365),
                            ),
                          );
                          if (d != null) setState(() => _selectedDate = d);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 15,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                DateFormat('dd-MM-yyyy').format(_selectedDate),
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const Icon(
                                Icons.calendar_month_outlined,
                                size: 16,
                                color: Colors.black26,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _mealTimeController,
                        decoration: _inputDecorationSuffix(
                          Icons.access_time_outlined,
                          'HH:MM',
                        ),
                        readOnly: true,
                        onTap: () async {
                          final t = await showTimePicker(
                            context: context,
                            initialTime: TimeOfDay.now(),
                          );
                          if (t != null)
                            _mealTimeController.text =
                                "${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}";
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'MEAL INFO',
            Column(
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value: _mealCategories.contains(_mealCategory)
                      ? _mealCategory
                      : 'Self Meal',
                  items: _mealCategories
                      .map(
                        (m) => DropdownMenuItem(
                          value: m,
                          child: Text(
                            m,
                            style: GoogleFonts.inter(
                              fontWeight: FontWeight.w700,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                  onChanged: (v) => setState(() {
                    _mealCategory = v!;
                    _mealType = _mealSubTypes[_mealCategory]![0];
                    if (_mealCategory != 'Self Meal') {
                      _expenseAmountController.text = '0';
                      _restaurantController.clear();
                      _addressController.clear();
                      _invoiceNoController.clear();
                      _receiptImagePaths.clear();
                    }
                  }),
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Colors.black26,
                  ),
                  decoration: _inputDecoration(null, 'Meal Category'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Opacity(
                        opacity: _mealCategory == 'Self Meal' ? 1.0 : 0.5,
                        child: DropdownButtonFormField<String>(
                          isExpanded: true,
                          value:
                              _mealSubTypes[_mealCategory]!.contains(_mealType)
                              ? _mealType
                              : _mealSubTypes[_mealCategory]![0],
                          items: _mealSubTypes[_mealCategory]!
                              .map(
                                (m) => DropdownMenuItem(
                                  value: m,
                                  child: Text(
                                    m,
                                    style: GoogleFonts.inter(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              )
                              .toList(),
                          onChanged: _mealCategory == 'Self Meal'
                              ? (v) => setState(() => _mealType = v!)
                              : null,
                          icon: const Icon(
                            Icons.keyboard_arrow_down_rounded,
                            color: Colors.black26,
                          ),
                          decoration: _inputDecoration(null, 'Meal Type'),
                        ),
                      ),
                    ),
                    if (_mealCategory != 'Self Meal') ...[
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 1,
                        child: TextField(
                          controller: _paxController,
                          keyboardType: TextInputType.number,
                          decoration: _inputDecoration(null, 'Pax'),
                        ),
                      ),
                    ],
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'RESTAURANT & ADDRESS',
            Column(
              children: [
                Opacity(
                  opacity: _mealCategory == 'Self Meal' ? 1.0 : 0.5,
                  child: TextField(
                    controller: _restaurantController,
                    readOnly: _mealCategory != 'Self Meal',
                    decoration: _inputDecoration(
                      null,
                      'Restaurant / Hotel Name',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Opacity(
                  opacity: _mealCategory == 'Self Meal' ? 1.0 : 0.5,
                  child: TextField(
                    controller: _addressController,
                    readOnly: _mealCategory != 'Self Meal',
                    decoration: _inputDecoration(null, 'Location Address'),
                  ),
                ),
              ],
            ),
          ),
        ] else if (_selectedCategory == 'Stay') ...[
          _formField(
            'DATES (IN - OUT)',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final d = await showDatePicker(
                            context: context,
                            initialDate: _selectedDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(
                              const Duration(days: 365),
                            ),
                          );
                          if (d != null) setState(() => _selectedDate = d);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 15,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                DateFormat('dd-MM-yyyy').format(_selectedDate),
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const Icon(
                                Icons.calendar_month_outlined,
                                size: 16,
                                color: Colors.black26,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: InkWell(
                        onTap: () async {
                          final d = await showDatePicker(
                            context: context,
                            initialDate: _endDate,
                            firstDate: DateTime(2020),
                            lastDate: DateTime.now().add(
                              const Duration(days: 365),
                            ),
                          );
                          if (d != null) setState(() => _endDate = d);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 15,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF8FAFC),
                            border: Border.all(color: const Color(0xFFE2E8F0)),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                DateFormat('dd-MM-yyyy').format(_endDate),
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                              const Icon(
                                Icons.calendar_month_outlined,
                                size: 16,
                                color: Colors.black26,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'LODGING INFO',
            Column(
              children: [
                DropdownButtonFormField<String>(
                  isExpanded: true,
                  value:
                      [
                        'Hotel Stay',
                        'Bavya Guest House',
                        'Client Provided',
                        'Self Stay',
                        'No Stay',
                      ].contains(_selectedMode)
                      ? _selectedMode
                      : 'Hotel Stay',
                  items:
                      [
                            'Hotel Stay',
                            'Bavya Guest House',
                            'Client Provided',
                            'Self Stay',
                            'No Stay',
                          ]
                          .map(
                            (m) => DropdownMenuItem(
                              value: m,
                              child: Text(
                                m,
                                style: GoogleFonts.inter(
                                  fontWeight: FontWeight.w700,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          )
                          .toList(),
                  onChanged: (v) => setState(() => _selectedMode = v!),
                  icon: const Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: Colors.black26,
                  ),
                  decoration: _inputDecoration(null, 'Stay Type'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _hotelController,
                  decoration: _inputDecoration(null, 'Hotel Name'),
                ),
                if (![
                  'No Stay',
                  'Self Stay',
                  'Client Provided',
                ].contains(_selectedMode)) ...[
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    value:
                        [
                          'Standard',
                          'Deluxe',
                          'Executive',
                          'Suite',
                          'Guest House',
                        ].contains(_roomType)
                        ? _roomType
                        : 'Standard',
                    items:
                        [
                              'Standard',
                              'Deluxe',
                              'Executive',
                              'Suite',
                              'Guest House',
                            ]
                            .map(
                              (m) => DropdownMenuItem(
                                value: m,
                                child: Text(
                                  m,
                                  style: GoogleFonts.inter(
                                    fontWeight: FontWeight.w700,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                    onChanged: (v) => setState(() => _roomType = v!),
                    icon: const Icon(
                      Icons.keyboard_arrow_down_rounded,
                      color: Colors.black26,
                    ),
                    decoration: _inputDecoration(null, 'Room Type'),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'CITY & PURPOSE',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _cityController,
                        decoration: _inputDecoration(null, 'City'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: TextField(
                        controller: _stayPurposeController,
                        decoration: _inputDecoration(null, 'Purpose'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'ADDITIONAL CHARGES',
            Row(
              children: [
                Expanded(
                  child: _formField(
                    'EARLY CHK-IN',
                    TextField(
                      controller: _earlyCheckInController,
                      keyboardType: TextInputType.number,
                      decoration: _inputDecoration(null, '0.00'),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: _formField(
                    'LATE CHK-OUT',
                    TextField(
                      controller: _lateCheckOutController,
                      keyboardType: TextInputType.number,
                      decoration: _inputDecoration(null, '0.00'),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ] else if (_selectedCategory == 'Incidental') ...[
          _formField(
            'DATE',
            InkWell(
              onTap: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _selectedDate,
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (d != null) setState(() => _selectedDate = d);
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 15,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      DateFormat('dd-MM-yyyy').format(_selectedDate),
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                    const Icon(
                      Icons.calendar_month_outlined,
                      size: 16,
                      color: Colors.black26,
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          _formField(
            'INCIDENTAL DETAILS',
            Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: DropdownButtonFormField<String>(
                        isExpanded: true,
                        value: (_masters['incidentalTypes'] as List<dynamic>? ?? []).contains(_tollType)
                            ? _tollType
                            : null,
                        items: (_masters['incidentalTypes'] as List<dynamic>? ?? [
                                  'Parking Charges',
                                  'Toll Charges',
                                  'Fuel (Own Vehicle)',
                                  'Luggage Charges',
                                  'Porter Charges',
                                  'Internet / WiFi',
                                  'Others',
                                ]).map(
                                  (m) => DropdownMenuItem(
                                    value: m.toString(),
                                    child: Text(
                                      m.toString(),
                                      style: GoogleFonts.inter(
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                )
                                .toList(),
                        onChanged: (v) => setState(() => _tollType = v!),
                        icon: const Icon(
                          Icons.keyboard_arrow_down_rounded,
                          color: Colors.black26,
                        ),
                        decoration: _inputDecoration(null, 'Expense Type'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 2,
                      child: TextField(
                        controller: _locationController,
                        decoration: _inputDecoration(null, 'Location'),
                      ),
                    ),
                  ],
                ),
                if (_tollType == 'Others') ...[
                  const SizedBox(height: 12),
                  TextField(
                    controller: _otherReasonController,
                    decoration: _inputDecoration(
                      null,
                      'Reason for Others (Mandatory)',
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],

        const SizedBox(height: 24),
        _formField(
          'EXPENSE',
          Column(
            children: [
              Row(
                children: [
                  Expanded(
                    flex: 3,
                    child: _formField(
                      'BASE AMOUNT',
                      TextField(
                        controller: _expenseAmountController,
                        keyboardType: TextInputType.number,
                        readOnly:
                            (_selectedCategory == 'Travel' &&
                                _bookingType == 'Company Booked') ||
                            (_selectedCategory == 'Food' &&
                                _mealCategory != 'Self Meal'),
                        onTap: () {
                          if (_selectedCategory == 'Travel' &&
                              _bookingType == 'Company Booked') {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Company booked travel has zero personal expense.',
                                ),
                              ),
                            );
                          } else if (_selectedCategory == 'Food' &&
                              _mealCategory != 'Self Meal') {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text(
                                  'Hosted meals have zero personal expense.',
                                ),
                              ),
                            );
                          }
                        },
                        decoration: _inputDecoration(
                          Icons.currency_rupee_rounded,
                          '0.00',
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    flex: 2,
                    child: _formField(
                      'INV NO.',
                      TextField(
                        controller: _invoiceNoController,
                        decoration: _inputDecoration(null, 'Invoice Number'),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _formField(
                _selectedCategory == 'Incidental'
                    ? (_tollType == 'Others'
                          ? 'DESCRIPTION'
                          : 'REMARKS / DETAILS')
                    : 'REMARKS',
                TextField(
                  controller: _expenseRemarksController,
                  maxLines: 2,
                  decoration: _inputDecoration(
                    null,
                    _selectedCategory == 'Incidental'
                        ? (_tollType == 'Others'
                              ? 'Detailed explanation'
                              : 'Additional info')
                        : 'Purpose or specific details...',
                  ),
                ),
              ),
            ],
          ),
        ),
        _formField(
          'UPLOAD RECEIPTS',
          Column(
            children: [
              if (_receiptImagePaths.isNotEmpty) ...[
                SizedBox(
                  height: 100,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    itemCount: _receiptImagePaths.length + 1,
                    itemBuilder: (context, index) {
                      if (index == _receiptImagePaths.length) {
                        return Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: InkWell(
                            onTap: () => _showImageSourcePicker(),
                            child: Container(
                              width: 100,
                              decoration: BoxDecoration(
                                color: const Color(0xFFF8FAFC),
                                border: Border.all(
                                  color: const Color(0xFFE2E8F0),
                                ),
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: const Icon(
                                Icons.add_a_photo_rounded,
                                color: Color(0xFF94A3B8),
                              ),
                            ),
                          ),
                        );
                      }
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: Stack(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: Image.file(
                                File(_receiptImagePaths[index]),
                                width: 100,
                                height: 100,
                                fit: BoxFit.cover,
                              ),
                            ),
                            Positioned(
                              right: 4,
                              top: 4,
                              child: InkWell(
                                onTap: () => setState(
                                  () => _receiptImagePaths.removeAt(index),
                                ),
                                child: Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: const BoxDecoration(
                                    color: Colors.red,
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.close_rounded,
                                    size: 14,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 12),
              ] else
                GestureDetector(
                  onTap: _isLocating ? null : _showImageSourcePicker,
                  child: Container(
                    height: 120,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF8FAFC),
                      border: Border.all(
                        color: const Color(0xFFE2E8F0),
                        width: 1,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.add_a_photo_rounded,
                          size: 24,
                          color: Color(0xFF94A3B8),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'TAP TO ADD BILLS',
                          style: GoogleFonts.inter(
                            fontWeight: FontWeight.w800,
                            color: const Color(0xFF94A3B8),
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: _latitude != null
                ? const Color(0xFFDCFCE7)
                : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(100),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _latitude != null
                    ? Icons.location_on_rounded
                    : Icons.gps_off_rounded,
                size: 12,
                color: _latitude != null
                    ? const Color(0xFF166534)
                    : Colors.black38,
              ),
              const SizedBox(width: 4),
              Text(
                _latitude != null ? 'Location Verified' : 'GPS Required',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: _latitude != null
                      ? const Color(0xFF166534)
                      : Colors.black38,
                ),
              ),
            ],
          ),
        ),
        if (_isEditing && !_isLocked) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            height: 40,
            child: TextButton.icon(
              onPressed: _isSubmitting ? null : _handleDeleteExpense,
              icon: const Icon(
                Icons.delete_outline_rounded,
                color: Colors.red,
                size: 18,
              ),
              label: Text(
                'DELETE ENTRY',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: Colors.red,
                  letterSpacing: 1,
                ),
              ),
              style: TextButton.styleFrom(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.red.withOpacity(0.2)),
                ),
              ),
            ),
          ),
        ],
        const SizedBox(height: 30),
        if (_isOdoForm()) ...[
          if (_isEditing && _isFinalized && !_isCompleted) ...[
            SizedBox(
              width: double.infinity,
              height: 60,
              child: ElevatedButton(
                onPressed: _isSubmitting
                    ? null
                    : () => _handleAddExpense(finalizeSubmit: true),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'FINISH & SUBMIT',
                            style: GoogleFonts.inter(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: Colors.white,
                            ),
                          ),
                          Text(
                            'This will stop the 24h timer',
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 12),
          ],
          SizedBox(
            width: double.infinity,
            height: 60,
            child: ElevatedButton(
              onPressed: _isSubmitting
                  ? null
                  : () => _handleAddExpense(finalizeSubmit: false),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C1D1D),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                elevation: 0,
              ),
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text(
                      _isEditing ? 'Update Draft' : 'Save Draft',
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ] else
          SizedBox(
            width: double.infinity,
            height: 60,
            child: ElevatedButton(
              onPressed: _isSubmitting ? null : () => _handleAddExpense(),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C1D1D),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(18),
                ),
                elevation: 0,
              ),
              child: _isSubmitting
                  ? const CircularProgressIndicator(color: Colors.white)
                  : Text(
                      'Add Detail',
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
      ],
    );
  }

  Widget _formField(String label, Widget child) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (label.isNotEmpty) ...[
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF64748B),
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
        ],
        child,
      ],
    );
  }

  Widget _buildOdoCaptureFields() {
    // Start ODO is locked if we are editing an existing record
    bool isStartLocked =
        _isEditing &&
        (_odoStartController.text.isNotEmpty || _odoStartImg != null);

    // End ODO is locked if we are editing and it was already previously captured
    bool isEndPreviouslyCaptured = _isEditing && _isFinalized;
    bool isEndDisabled = _odoStartImg == null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (_vehicleType != 'Service') ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: isStartLocked
                        ? Colors.black.withOpacity(0.05)
                        : const Color(0xFFF8FAFC),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'STA',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                          color: isStartLocked
                              ? Colors.black26
                              : const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _odoStartController,
                          enabled: !isStartLocked,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            hintText: '0',
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: isStartLocked
                            ? null
                            : () => _captureOdoPhoto(true),
                        icon: Icon(
                          Icons.camera_alt_outlined,
                          size: 16,
                          color: isStartLocked
                              ? Colors.black12
                              : (_odoStartImg != null
                                    ? Colors.green
                                    : Colors.black38),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: (isEndDisabled || isEndPreviouslyCaptured)
                        ? Colors.black.withOpacity(0.05)
                        : const Color(0xFFF8FAFC),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      Text(
                        'END',
                        style: GoogleFonts.inter(
                          fontWeight: FontWeight.w800,
                          fontSize: 11,
                          color: (isEndDisabled || isEndPreviouslyCaptured)
                              ? Colors.black26
                              : const Color(0xFF64748B),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _odoEndController,
                          enabled: !isEndDisabled && !isEndPreviouslyCaptured,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            hintText: '0',
                          ),
                        ),
                      ),
                      IconButton(
                        onPressed: (isEndDisabled || isEndPreviouslyCaptured)
                            ? null
                            : () => _captureOdoPhoto(false),
                        icon: Icon(
                          Icons.camera_alt_outlined,
                          size: 16,
                          color: (isEndDisabled || isEndPreviouslyCaptured)
                              ? Colors.black12
                              : (_odoEndImg != null
                                    ? Colors.green
                                    : Colors.black38),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          if (_odoStartImg == null)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 4),
              child: Text(
                'CAPTURE START PHOTO',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF7C1D1D).withOpacity(0.6),
                ),
              ),
            )
          else if (_odoEndImg == null && !isEndPreviouslyCaptured)
            Padding(
              padding: const EdgeInsets.only(top: 8, left: 4),
              child: Text(
                'CAPTURE END PHOTO TO UNLOCK 24H WINDOW',
                style: GoogleFonts.inter(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Colors.blue.withOpacity(0.6),
                ),
              ),
            ),
        ],
      ],
    );
  }

  InputDecoration _inputDecoration(IconData? icon, String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: Colors.black26,
      ),
      prefixIcon: icon != null
          ? Icon(icon, size: 14, color: Colors.black26)
          : null,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
    );
  }

  InputDecoration _inputDecorationSuffix(IconData? icon, String hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.inter(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: Colors.black26,
      ),
      suffixIcon: icon != null
          ? Icon(icon, size: 14, color: Colors.black26)
          : null,
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 15),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
      ),
    );
  }

  Widget _checkboxItem(String label, bool value, Function(bool?) onChanged) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: Checkbox(
            value: value,
            onChanged: onChanged,
            activeColor: const Color(0xFF7C1D1D),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF475569),
          ),
        ),
      ],
    );
  }

  Widget _categoryPicker() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _formField(
          'EXPENSE TYPE',
          DropdownButtonFormField<String>(
            isExpanded: true,
            value: _selectedCategory,
            items: _filteredCategories
                .map(
                  (c) => DropdownMenuItem(
                    value: c['id'],
                    child: Text(
                      c['label'] ?? '',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                      ),
                    ),
                  ),
                )
                .toList(),
            onChanged: (v) {
              if (v != null) {
                setState(() {
                  _selectedCategory = v;
                  _expenseAmountController.clear();
                  // Reset defaults
                  _selectedMode = null;
                  _selectedLocalMode = null;
                  _selectedLocalSubType = null;
                  _bookingType = 'Self Booked';
                  if (_selectedCategory == 'Travel') {
                    _selectedMode = 'Flight';
                    _selectedClass = 'Economy';
                  } else if (_selectedCategory == 'Local') {
                    _selectedLocalMode = 'Car / Cab';
                  } else if (_selectedCategory == 'Food') {
                    _mealType = 'Self Meal';
                  } else if (_selectedCategory == 'Stay') {
                    _roomType = 'Standard';
                  }
                });
              }
            },
            icon: const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: Colors.black26,
            ),
            decoration: _inputDecoration(Icons.category_rounded, 'Select Type'),
          ),
        ),
        if (_selectedCategory == 'Local' && _isFullTrip) ...[
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isLoading ? null : _handleDownloadTemplate,
                  icon: const Icon(Icons.download_rounded, size: 16),
                  label: Text(
                    'TEMPLATE',
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF3B82F6),
                    side: const BorderSide(color: Color(0xFF3B82F6)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: _isBulkUploading ? null : _handleBulkUpload,
                  icon: const Icon(Icons.upload_file_rounded, size: 16),
                  label: _isBulkUploading
                      ? const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.green,
                          ),
                        )
                      : Text(
                          'BULK UPLOAD',
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.green,
                    side: const BorderSide(color: Colors.green),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  void _clearForm() {
    _expenseAmountController.clear();
    _expenseRemarksController.clear();
    _invoiceNoController.clear();
    _boardingPointController.clear();
    _driverNameController.clear();
    _startTimeController.clear();
    _endTimeController.clear();
    _originController.clear();
    _destController.clear();
    _restaurantController.clear();
    _paxController.clear();
    _providerController.clear();
    _travelNoController.clear();
    _pnrController.clear();
    _boardingTimeController.clear();
    _scheduledTimeController.clear();
    _actualTimeController.clear();
    _delayController.clear();
    _tollController.clear();
    _parkingController.clear();
    _fuelController.clear();
    _ticketNoController.clear();
    _rentalChargeController.clear();
    _mealTimeController.clear();
    _addressController.clear();
    _bookingTimeController.clear();
    _carrierNameController.clear();
    _odoStartController.clear();
    _odoEndController.clear();
    _otherReasonController.clear();
    _earlyCheckInController.clear();
    _lateCheckOutController.clear();
    _stayPurposeController.clear();
    _hotelController.clear();
    _cityController.clear();
    _vehicleNoController.clear();
    _isTatkal = false;
    _receiptImagePaths.clear();
    _odoStartImg = null;
    _odoEndImg = null;
    _existingOdoStartBase64 = null;
    _existingOdoEndBase64 = null;
    _existingReceiptBase64s = [];
    _odoStartLat = null;
    _odoStartLong = null;
    _odoEndLat = null;
    _odoEndLong = null;
    _latitude = null;
    _longitude = null;
    _isEditing = false;
    _editingExpenseId = null;
    _isFinalized = false;
  }

  Future<void> _cleanupExpiredDrafts() async {
    if (_tripData.expenses == null) return;

    // We iterate through expenses and delete those that have expired
    // to keep the registry clean as per the 24h rule.
    for (var e in _tripData.expenses!) {
      try {
        if (e['description'] != null) {
          final Map<String, dynamic> detail = jsonDecode(e['description']);
          if (detail['isFinalized'] == true &&
              detail['endOdoSubmittedAt'] != null &&
              detail['isCompleted'] != true) {
            final submittedAt = DateTime.parse(detail['endOdoSubmittedAt']);
            final diff = DateTime.now().difference(submittedAt);
            if (diff.inHours >= 24) {
              await _tripService.deleteExpense(e['id'].toString());
            }
          }
        }
      } catch (_) {}
    }
  }
}
