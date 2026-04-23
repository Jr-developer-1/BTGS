import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:intl/intl.dart';
import 'package:image/image.dart' as img;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:geolocator/geolocator.dart';
import 'dart:convert';
import '../components/forensic_camera.dart';
import '../services/master_service.dart';
import '../services/trip_service.dart';

class ExpenseFormScreen extends StatefulWidget {
  final String category;
  final String tripId;
  final dynamic expenseData;
  const ExpenseFormScreen({
    super.key,
    required this.category,
    required this.tripId,
    this.expenseData,
  });

  @override
  _ExpenseFormScreenState createState() => _ExpenseFormScreenState();
}

class _ExpenseFormScreenState extends State<ExpenseFormScreen> {
  bool _isProcessing = false;
  File? _image;
  File? _startOdoImage;
  File? _endOdoImage;
  String? _existingStartOdoUrl;
  String? _existingEndOdoUrl;
  final picker = ImagePicker();
  final TripService _tripService = TripService();
  final MasterService _masterService = MasterService();

  // Master Data Lists
  List<String> _masterTravelModes = [];
  List<String> _masterMealCategories = [];
  List<String> _masterMealTypes = [];
  List<String> _masterIncidentalTypes = [];
  List<String> _masterAccomTypes = [];
  List<String> _masterMealSources = [];
  List<String> _masterMealProviders = [];

  // Controllers and State
  final _formKey = GlobalKey<FormState>();
  final TextEditingController _amountController = TextEditingController();
  final TextEditingController _originController = TextEditingController();
  final TextEditingController _destController = TextEditingController();
  final TextEditingController _odoStartController = TextEditingController();
  final TextEditingController _odoEndController = TextEditingController();
  final TextEditingController _jobReportController = TextEditingController();
  final TextEditingController _incidentalAmountController =
      TextEditingController();
  final TextEditingController _totalDayController = TextEditingController();

  String? _incidentalCategory;
  File? _incidentalImage;
  double _fuelRate = 0.0; // Will be fetched from backend

  // Time and Date state
  DateTime _startDate = DateTime.now();
  DateTime _endDate = DateTime.now();
  TimeOfDay _startTime = TimeOfDay.now();
  TimeOfDay _endTime = TimeOfDay.now();

  // New Detailed Controllers
  final TextEditingController _restaurantController = TextEditingController();
  final TextEditingController _invoiceNoController = TextEditingController();
  final TextEditingController _hotelNameController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _nightsController = TextEditingController();
  final TextEditingController _carrierController = TextEditingController();
  final TextEditingController _pnrController = TextEditingController();
  final TextEditingController _ticketNoController = TextEditingController();
  final TextEditingController _locationController = TextEditingController();
  final TextEditingController _incidentalLocationController =
      TextEditingController();
  final TextEditingController _incidentalNotesController =
      TextEditingController();

  // New Dropdown States
  String? _mealCategory;
  String? _mealType;
  String? _mealSource;
  String? _mealProvider;
  String? _accomType;
  String? _travelMode;
  String? _bookedBy;
  bool _showIncidentalSection = false;

  Future<void> _submitEntry() async {
    setState(() => _isProcessing = true);

    try {
      final bool isLocal =
          widget.category == 'Local Travel' || widget.category == 'Fuel';
      double totalAmount = 0.0;
      double odoStart = 0.0;
      double odoEnd = 0.0;
      double distance = 0.0;
      double incidentalAmount = 0.0;

      if (isLocal) {
        odoStart = double.tryParse(_odoStartController.text) ?? 0.0;
        odoEnd = double.tryParse(_odoEndController.text) ?? 0.0;
        distance = (odoEnd - odoStart).clamp(0.0, double.infinity);
        final double odoAmount = distance * _fuelRate;
        incidentalAmount =
            double.tryParse(_incidentalAmountController.text) ?? 0.0;
        totalAmount = odoAmount + incidentalAmount; // Sum up for grid display
      } else {
        totalAmount = double.tryParse(_amountController.text) ?? 0.0;
      }

      final bool isTrip = widget.tripId.toUpperCase().startsWith('TRP-');

      final Map<String, dynamic> payload = {
        'trip': widget.tripId,
        'date': DateFormat('yyyy-MM-dd').format(_startDate),
        'category': widget.category == 'Local Travel'
            ? 'Fuel'
            : (widget.category == 'Others' ? 'Others' : widget.category),
        'amount': totalAmount,
        if (isLocal) ...{
          'travel_mode': isTrip ? (_travelMode ?? 'Bike') : 'Bike',
          'vehicle_type': isTrip
              ? (_travelMode == 'Bike'
                    ? 'Own Bike'
                    : (_travelMode == 'Car / Cab'
                          ? (_bookedBy == 'Company Paid'
                                ? 'Company Car'
                                : 'Own Car')
                          : null))
              : 'Own Bike',
          'odo_start': odoStart,
          'odo_end': odoEnd,
          'distance': distance,
          'booked_by': isTrip ? (_bookedBy ?? 'Self Paid') : 'Self Paid',
        },
        'remarks': _jobReportController.text,
        'description': jsonEncode(
          isLocal
              ? {
                  'origin': _originController.text,
                  'destination': _destController.text,
                  'odoStart': odoStart,
                  'odoEnd': odoEnd,
                  'odoStartImg': _startOdoImage?.path ?? _existingStartOdoUrl,
                  'odoEndImg': _endOdoImage?.path ?? _existingEndOdoUrl,
                  'boardingTime': _startTime.format(context),
                  'actualTime': _endTime.format(context),
                  'startDate': DateFormat('yyyy-MM-dd').format(_startDate),
                  'endDate': DateFormat('yyyy-MM-dd').format(_endDate),
                  'jobReport': _jobReportController.text,
                  'incidentalCategory': _incidentalCategory,
                  'incidentalAmount': incidentalAmount,
                  'totalKm': distance,
                  'mode': isTrip ? (_travelMode ?? 'Bike') : 'Bike',
                  'subType': isTrip
                      ? (_travelMode == 'Bike'
                            ? 'Own Bike'
                            : (_travelMode == 'Car / Cab'
                                  ? (_bookedBy == 'Company Paid'
                                        ? 'Company Car'
                                        : 'Own Car')
                                  : 'Default'))
                      : 'Own Bike',
                  'bookedBy': isTrip ? (_bookedBy ?? 'Self Paid') : 'Self Paid',
                  'remarks': _jobReportController.text,
                }
              : (widget.category == 'Food'
                    ? {
                        'mealCategory': _mealCategory,
                        'mealType': _mealType,
                        'mealSource': _mealSource,
                        'provider': _mealProvider,
                        'hotelName': _hotelNameController.text,
                        'restaurant': _restaurantController.text,
                        'mealTime': _startTime.format(context),
                        'invoiceNo': _invoiceNoController.text,
                        'purpose': _jobReportController.text,
                        'date': DateFormat('yyyy-MM-dd').format(_startDate),
                      }
                    : (widget.category == 'Accommodation'
                          ? {
                              'accomType': _accomType,
                              'hotelName': _hotelNameController.text,
                              'city': _cityController.text,
                              'checkIn': DateFormat(
                                'yyyy-MM-dd',
                              ).format(_startDate),
                              'checkInTime': _startTime.format(context),
                              'checkOut': DateFormat(
                                'yyyy-MM-dd',
                              ).format(_endDate),
                              'checkOutTime': _endTime.format(context),
                              'nights':
                                  int.tryParse(_nightsController.text) ?? 1,
                              'purpose': _jobReportController.text,
                            }
                          : (widget.category == 'Outstation Travel' ||
                                    widget.category == 'Travel'
                                ? {
                                    'mode': _travelMode,
                                    'origin': _originController.text,
                                    'destination': _destController.text,
                                    'carrier': _carrierController.text,
                                    'depDate': DateFormat(
                                      'yyyy-MM-dd',
                                    ).format(_startDate),
                                    'boardingTime': _startTime.format(context),
                                    'arrDate': DateFormat(
                                      'yyyy-MM-dd',
                                    ).format(_endDate),
                                    'actualTime': _endTime.format(context),
                                    'bookedBy': _bookedBy,
                                    'pnr': _pnrController.text,
                                    'ticketNo': _ticketNoController.text,
                                    'purpose': _jobReportController.text,
                                    'remarks': _jobReportController.text,
                                  }
                                : (widget.category == 'Incidental'
                                      ? {
                                          'incidentalType': _incidentalCategory,
                                          'location':
                                              _incidentalLocationController
                                                  .text,
                                          'notes':
                                              _incidentalNotesController.text,
                                          'date': DateFormat(
                                            'yyyy-MM-dd',
                                          ).format(_startDate),
                                          'amount': totalAmount,
                                        }
                                      : {
                                          'purpose': _jobReportController.text,
                                          'details': 'Added via Mobile App',
                                          'date': DateFormat(
                                            'yyyy-MM-dd',
                                          ).format(_startDate),
                                          'location': _locationController.text,
                                          'incidentalType': _incidentalCategory,
                                        })))),
        ),
      };

      if (widget.expenseData != null) {
        await _tripService.updateExpense(
          widget.expenseData['id'].toString(),
          payload,
        );
      } else {
        await _tripService.addExpense(payload);
      }

      if (mounted) {
        Navigator.pop(context, true);
 // Return true to signal refresh
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.expenseData != null
                  ? 'Entry updated successfully'
                  : 'Expense entry submitted successfully',
            ),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red),
        );
      }
    } finally {
      if (mounted) setState(() => _isProcessing = false);
    }
  }

  Future<Position?> _determinePosition() async {
    bool serviceEnabled;
    LocationPermission permission;

    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) {
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Location Services Disabled'),
            content: const Text(
              'Please enable location services to capture the GPS watermark on your receipt.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
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

    return await Geolocator.getCurrentPosition();
  }

  Future<void> _getImage({String type = 'generic'}) async {
    if (_isProcessing) return;

    // Use Forensic Camera for ODO photos
    if (type == 'startOdo' || type == 'endOdo' || type == 'incidentalBill') {
      final result = await Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const ForensicCamera()),
      );

      if (result != null && result['path'] != null) {
        setState(() {
          if (type == 'startOdo') {
            _startOdoImage = File(result['path']);
          } else if (type == 'endOdo') {
            _endOdoImage = File(result['path']);
          } else if (type == 'incidentalBill') {
            _incidentalImage = File(result['path']);
          }
        });
      }
      return;
    }

    setState(() {
      _isProcessing = true;
    });

    try {
      final Position? position = await _determinePosition();
      if (position == null) {
        setState(() => _isProcessing = false);
        return;
      }

      final pickedFile = await picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 50,
      );

      if (pickedFile != null) {
        final File imageFile = File(pickedFile.path);
        final String currentTime = DateFormat(
          'yyyy-MM-dd HH:mm',
        ).format(DateTime.now());
        final String gpsLocation =
            "Lat: ${position.latitude.toStringAsFixed(4)}, Long: ${position.longitude.toStringAsFixed(4)}";

        // Load image
        final bytes = await imageFile.readAsBytes();
        img.Image? originalImage = img.decodeImage(bytes);

        if (originalImage != null) {
          // Draw watermark background... (existing logic remains for generic)
          img.fillRect(
            originalImage,
            x1: 0,
            y1: originalImage.height - 150,
            x2: originalImage.width,
            y2: originalImage.height,
            color: img.ColorRgba8(0, 0, 0, 150),
          );

          img.drawString(
            originalImage,
            'Location: $gpsLocation',
            font: img.arial24,
            x: 20,
            y: originalImage.height - 100,
            color: img.ColorRgba8(255, 255, 255, 255),
          );
          img.drawString(
            originalImage,
            'Time: $currentTime',
            font: img.arial24,
            x: 20,
            y: originalImage.height - 50,
            color: img.ColorRgba8(255, 255, 255, 255),
          );

          final directory = await getTemporaryDirectory();
          final String fileName = 'watermarked_${p.basename(imageFile.path)}';
          final String filePath = p.join(directory.path, fileName);
          final watermarkedFile = File(filePath)
            ..writeAsBytesSync(img.encodeJpg(originalImage));

          setState(() {
            _image = watermarkedFile;
          });
        }
      }
    } catch (e) {
      debugPrint('Error processing image: $e');
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  Future<void> _fetchAndSetFuelRate() async {
    // Determine vehicle type from travel mode or default to 2 Wheeler
    final vehicleType = (_travelMode == 'Car / Cab')
        ? '4 Wheeler'
        : '2 Wheeler';
    final rate = await _tripService.fetchFuelRate(vehicleType);
    if (mounted && rate != null) {
      setState(() {
        _fuelRate = rate;
      });
      _calculateTotal();
    }
  }

  @override
  void initState() {
    super.initState();
    _odoStartController.addListener(() => _calculateTotal());
    _odoEndController.addListener(() => _calculateTotal());
    _incidentalAmountController.addListener(() => _calculateTotal());
    _originController.addListener(() => setState(() {}));

    // Fetch fuel rate from backend for Local Travel / Fuel categories
    final bool isLocal =
        widget.category == 'Local Travel' || widget.category == 'Fuel';
    if (isLocal) {
      _fetchAndSetFuelRate();
    }

    if (widget.expenseData != null) {
      final data = widget.expenseData;
      _amountController.text = data['amount']?.toString() ?? '';

      // Handle details if present
      dynamic details = data['details'] ?? {};
      if ((details is! Map || details.isEmpty) &&
          data['description'] is String &&
          data['description'].toString().startsWith('{')) {
        try {
          details = jsonDecode(data['description']);
        } catch (e) {
          details = {};
        }
      } else if (details is! Map) {
        details = {};
      }

      _originController.text = details['origin'] ?? '';
      _destController.text = details['destination'] ?? '';
      _odoStartController.text =
          (details['odoStart'] ?? details['odo_start'])?.toString() ?? '';
      _odoEndController.text =
          (details['odoEnd'] ?? details['odo_end'])?.toString() ?? '';

      _existingStartOdoUrl = details['odoStartImg'];
      _existingEndOdoUrl = details['odoEndImg'];

      _jobReportController.text =
          data['remarks'] ??
          details['purpose'] ??
          details['jobReport'] ??
          details['job_report'] ??
          '';
      _incidentalCategory = details['incidentalCategory'];
      _incidentalAmountController.text =
          (details['incidentalAmount'] ?? details['amount'] ?? '').toString();
      _incidentalLocationController.text = details['location'] ?? '';
      _incidentalNotesController.text =
          (details['notes'] ??
                  details['description'] ??
                  details['remarks'] ??
                  '')
              .toString();

      if (_incidentalAmountController.text.isNotEmpty &&
          _incidentalAmountController.text != '0') {
        _showIncidentalSection = true;
      }

      // Detailed pre-filling
      _restaurantController.text = details['restaurant'] ?? '';
      _invoiceNoController.text = details['invoiceNo'] ?? '';
      _hotelNameController.text = details['hotelName'] ?? '';
      _cityController.text = details['city'] ?? '';
      _nightsController.text = details['nights']?.toString() ?? '';
      _carrierController.text = details['carrier'] ?? '';
      _pnrController.text = details['pnr'] ?? '';
      _ticketNoController.text = details['ticketNo'] ?? '';
      _locationController.text = details['location'] ?? '';

      _mealCategory = details['mealCategory'];
      _mealType = details['mealType'];
      _mealSource = details['mealSource'];
      _mealProvider = details['provider'] ?? details['mealProvider'];
      _hotelNameController.text = details['hotelName'] ?? '';
      _restaurantController.text = details['restaurant'] ?? '';
      _accomType = details['accomType'];
      _travelMode = details['mode'] ?? details['travel_mode'];
      _bookedBy = details['bookedBy'] ?? details['booked_by'];

      if (data['date'] != null) {
        try {
          _startDate = DateTime.parse(data['date']);
        } catch (_) {}
      }

      if (details['boardingTime'] != null ||
          details['start_time'] != null ||
          details['startTime'] != null ||
          details['checkInTime'] != null ||
          details['mealTime'] != null) {
        try {
          final timeStr =
              details['boardingTime'] ??
              details['startTime'] ??
              details['start_time'] ??
              details['checkInTime'] ??
              details['mealTime'];
          final parts = timeStr.split(':');
          _startTime = TimeOfDay(
            hour: int.parse(parts[0]),
            minute: int.parse(parts[1]),
          );
        } catch (_) {}
      }
      if (details['actualTime'] != null ||
          details['end_time'] != null ||
          details['endTime'] != null ||
          details['checkOutTime'] != null) {
        try {
          final timeStr =
              details['actualTime'] ??
              details['endTime'] ??
              details['end_time'] ??
              details['checkOutTime'];
          final parts = timeStr.split(':');
          _endTime = TimeOfDay(
            hour: int.parse(parts[0]),
            minute: int.parse(parts[1]),
          );
        } catch (_) {}
      }

      if (details['endDate'] != null ||
          details['checkOut'] != null ||
          details['arrDate'] != null) {
        try {
          _endDate = DateTime.parse(
            details['endDate'] ?? details['checkOut'] ?? details['arrDate'],
          );
        } catch (_) {}
      }
    }
    _calculateTotal();
    _loadMasters();
  }

  Future<void> _loadMasters() async {
    try {
      final results = await Future.wait([
        _masterService.fetchMasterList('/api/travel-mode-masters/', 'mode_name', 'results'),
        _masterService.fetchMasterList('/api/meal-category-masters/', 'category_name', 'results'),
        _masterService.fetchMasterList('/api/meal-type-masters/', 'meal_type', 'results'),
        _masterService.fetchMasterList('/api/incidental-type-masters/', 'expense_type', 'results'),
        _masterService.fetchMasterList('/api/stay-type-masters/', 'stay_type', 'results'),
        _masterService.fetchMasterList('/api/meal-source-masters/', 'source_name', 'results'),
        _masterService.fetchMasterList('/api/meal-provider-masters/', 'provider_name', 'results'),
      ]);

      if (mounted) {
        setState(() {
          _masterTravelModes = results[0];
          _masterMealCategories = results[1];
          _masterMealTypes = results[2];
          _masterIncidentalTypes = results[3];
          _masterAccomTypes = results[4];
          _masterMealSources = (results[5] as List).map((e) => e.toString()).toList();
          _masterMealProviders = (results[6] as List).map((e) => e.toString()).toList();
        });
      }
    } catch (e) {
      debugPrint('Error loading master data: $e');
    }
  }

  void _calculateTotal() {
    final double start = double.tryParse(_odoStartController.text) ?? 0.0;
    final double end = double.tryParse(_odoEndController.text) ?? 0.0;
    final double incidental =
        double.tryParse(_incidentalAmountController.text) ?? 0.0;

    final dist = (end - start).clamp(0.0, double.infinity);
    final total = (dist * _fuelRate) + incidental;

    setState(() {
      _totalDayController.text = total.toStringAsFixed(2);
    });
  }

  @override
  Widget build(BuildContext context) {
    bool isLocal =
        widget.category == 'Local Travel' || widget.category == 'Fuel';
    bool startInfoEntered =
        _odoStartController.text.isNotEmpty &&
        _originController.text.isNotEmpty &&
        (_startOdoImage != null ||
            (_existingStartOdoUrl != null && _existingStartOdoUrl!.isNotEmpty));

    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      appBar: AppBar(
        title: Text(
          widget.expenseData != null
              ? 'Edit ${widget.category}'
              : 'Add ${widget.category}',
          style: GoogleFonts.plusJakartaSans(
            fontWeight: FontWeight.w900,
            fontSize: 18,
            color: const Color(0xFF134E4A),
            letterSpacing: -0.5,
          ),
        ),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF134E4A),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        shadowColor: Colors.transparent,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(0xFFCCFBF1)),
        ),
        actions: [
          if (widget.expenseData != null)
            IconButton(
              icon: const Icon(
                Icons.delete_outline_rounded,
                color: Colors.redAccent,
              ),
              onPressed: () => _confirmDelete(),
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (isLocal) ...[
                _buildWebCard(
                  title: 'LOCATION & ODOMETER LOGS',
                  subtitle: widget.tripId.toUpperCase().startsWith('TRP-')
                      ? 'Trip Local Conveyance'
                      : 'Local Conveyance Entry',
                  color: const Color(0xFF0D9488),
                  children: [
                    if (widget.tripId.toUpperCase().startsWith('TRP-')) ...[
                      Row(
                        children: [
                          Expanded(
                            child: _buildDropdownMini(
                              'MODE',
                              _travelMode,
                              _masterTravelModes,
                              (v) => setState(() => _travelMode = v),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: _buildDropdownMini(
                              'BOOKED BY',
                              _bookedBy,
                              ['Self Paid', 'Company Paid'], // Often hardcoded on web too, but keeping consistent
                              (v) => setState(() => _bookedBy = v),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],
                    _buildLogBlock(
                      label: 'START',
                      color: const Color(0xFF0D9488),
                      bgColor: const Color(0xFFF0FDFA),
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
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildTimePickerMini(
                                'TIME',
                                _startTime,
                                (t) => setState(() => _startTime = t),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildTextFieldMini(
                          'LOCATION',
                          _originController,
                          hint: 'Start location...',
                        ),
                        const SizedBox(height: 12),
                        _buildOdoFieldMini(
                          'ODO READING',
                          _odoStartController,
                          _startOdoImage,
                          () => _getImage(type: 'startOdo'),
                          existingUrl: _existingStartOdoUrl,
                          enabled:
                              (_startDate.day == DateTime.now().day &&
                              _startDate.month == DateTime.now().month &&
                              _startDate.year == DateTime.now().year),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Opacity(
                      opacity: startInfoEntered ? 1.0 : 0.4,
                      child: AbsorbPointer(
                        absorbing: !startInfoEntered,
                        child: _buildLogBlock(
                          label: 'END',
                          color: const Color(0xFF16A34A),
                          bgColor: const Color(0xFFF1FAF5),
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: _buildDatePickerMini(
                                    'DATE',
                                    _endDate,
                                    (d) => setState(() => _endDate = d),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: _buildTimePickerMini(
                                    'TIME',
                                    _endTime,
                                    (t) => setState(() => _endTime = t),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            _buildTextFieldMini(
                              'LOCATION',
                              _destController,
                              hint: 'End location...',
                            ),
                            const SizedBox(height: 12),
                            _buildOdoFieldMini(
                              'ODO READING',
                              _odoEndController,
                              _endOdoImage,
                              () => _getImage(type: 'endOdo'),
                              existingUrl: _existingEndOdoUrl,
                              enabled:
                                  (_endDate.day == DateTime.now().day &&
                                  _endDate.month == DateTime.now().month &&
                                  _endDate.year == DateTime.now().year),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF0FDFA),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: const Color(0xFFCCFBF1)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Calc. Odo Expense: ₹${((double.tryParse(_odoEndController.text) ?? 0.0) - (double.tryParse(_odoStartController.text) ?? 0.0)).clamp(0.0, double.infinity) * _fuelRate}',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF0D9488),
                            ),
                          ),
                          TextButton.icon(
                            onPressed: () {},
                            icon: const Icon(Icons.edit_note, size: 14),
                            label: Text(
                              'Write Job Report',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 10,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            style: TextButton.styleFrom(
                              padding: EdgeInsets.zero,
                              minimumSize: const Size(0, 0),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                if (!_showIncidentalSection)
                  Center(
                    child: TextButton.icon(
                      onPressed: () =>
                          setState(() => _showIncidentalSection = true),
                      icon: const Icon(
                        Icons.add_circle_outline_rounded,
                        size: 20,
                      ),
                      label: Text(
                        'ADD INCIDENTAL EXPENSES',
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF0D9488),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: const BorderSide(
                            color: Color(0xFF0D9488),
                            width: 1.5,
                          ),
                        ),
                      ),
                    ),
                  )
                else
                  _buildWebCard(
                    title: 'INCIDENTAL EXPENSES (OPTIONAL)',
                    color: const Color(0xFF0F766E),
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'INCIDENTAL DETAILS',
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(
                              Icons.close_rounded,
                              size: 18,
                              color: Colors.grey,
                            ),
                            onPressed: () => setState(() {
                              _showIncidentalSection = false;
                              _incidentalAmountController.clear();
                            }),
                            constraints: const BoxConstraints(),
                            padding: EdgeInsets.zero,
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Expanded(
                            flex: 2,
                            child: _buildDropdownMini(
                              'CATEGORY',
                              _incidentalCategory,
                              _masterIncidentalTypes,
                              (v) => setState(() => _incidentalCategory = v),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            flex: 1,
                            child: _buildTextFieldMini(
                              'COST',
                              _incidentalAmountController,
                              prefix: '₹',
                              keyboardType: TextInputType.number,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      _buildTextFieldMini(
                        'LOCATION',
                        _incidentalLocationController,
                        hint: 'Where this occurred...',
                      ),
                      const SizedBox(height: 16),
                      _buildTextFieldMini(
                        'REMARKS / NOTES',
                        _incidentalNotesController,
                        maxLines: 2,
                        hint: 'Additional info...',
                      ),
                      const SizedBox(height: 16),
                      _buildImagePickerMini(
                        'UPLOAD BILL',
                        _incidentalImage,
                        () => _getImage(type: 'incidentalBill'),
                      ),
                    ],
                  ),
                const SizedBox(height: 24),
                Align(
                  alignment: Alignment.centerRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF134E4A), Color(0xFF0D9488)],
                      ),
                      borderRadius: BorderRadius.circular(30),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF134E4A).withOpacity(0.25),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'DAY TOTAL  ',
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white.withOpacity(0.8),
                            fontSize: 10,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1,
                          ),
                        ),
                        Text(
                          '₹${_totalDayController.text}',
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
                    ),
                  ),
                            ] else if (widget.category == 'Food') ...[
                Builder(
                  builder: (context) {
                    final isSelfMeal = _mealCategory == 'Self Meal';
                    final sourceLower = _mealSource?.toLowerCase() ?? '';
                    final showSource = isSelfMeal;
                    final showProvider = isSelfMeal && sourceLower == 'online';
                    final showHotel = isSelfMeal && (sourceLower == 'hotel' || sourceLower == 'online');
                    final showRestaurant = isSelfMeal && sourceLower == 'restaurant';

                    return _buildWebCard(
                      title: 'MEAL TRANSACTION DETAILS',
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
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _buildDropdownMini(
                                'CATEGORY',
                                _mealCategory,
                                _masterMealCategories,
                                (v) => setState(() {
                                  _mealCategory = v;
                                  if (v != 'Self Meal') {
                                    _amountController.text = '0.00';
                                  }
                                }),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildDropdownMini(
                                'TYPE',
                                _mealType,
                                _masterMealTypes,
                                (v) => setState(() => _mealType = v),
                              ),
                            ),
                          ],
                        ),
                        if (showSource) ...[
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: _buildDropdownMini(
                                  'SOURCE',
                                  _mealSource,
                                  _masterMealSources,
                                  (v) => setState(() => _mealSource = v),
                                ),
                              ),
                              if (showProvider) ...[
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _buildDropdownMini(
                                    'PROVIDER',
                                    _mealProvider,
                                    _masterMealProviders,
                                    (v) => setState(() => _mealProvider = v),
                                  ),
                                ),
                              ] else
                                const Spacer(),
                            ],
                          ),
                        ],
                        if (showHotel) ...[
                          const SizedBox(height: 16),
                          _buildTextFieldMini(
                            sourceLower == 'online' ? 'HOTEL / OUTLET NAME' : 'HOTEL NAME',
                            _hotelNameController,
                            hint: 'Enter name...',
                          ),
                        ],
                        if (showRestaurant) ...[
                          const SizedBox(height: 16),
                          _buildTextFieldMini(
                            'RESTAURANT NAME',
                            _restaurantController,
                            hint: 'Enter restaurant name...',
                          ),
                        ],
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: _buildTextFieldMini(
                                'INVOICE NO',
                                _invoiceNoController,
                                hint: 'Optional',
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _buildTextFieldMini(
                                'AMOUNT',
                                _amountController,
                                prefix: '₹',
                                keyboardType: TextInputType.number,
                                enabled: isSelfMeal,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        _buildTextFieldMini(
                          'PURPOSE / NOTES',
                          _jobReportController,
                          maxLines: 2,
                        ),
                        const SizedBox(height: 16),
                        _buildImagePickerMini(
                          'UPLOAD INVOICE / BILL',
                          _image,
                          () => _getImage(),
                        ),
                      ],
                    );
                  }
                ),
              ] else if (widget.category == 'Accommodation') ...[
                _buildWebCard(
                  title: 'STAY & LODGING LOGS',
                color: const Color(0xFF0EA5E9),
                  children: [
                    _buildDropdownMini(
                      'ACCOMMODATION TYPE',
                      _accomType,
                      _masterAccomTypes,
                      (v) => setState(() => _accomType = v),
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'HOTEL / PROPERTY NAME',
                      _hotelNameController,
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini('CITY / LOCATION', _cityController),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _buildDatePickerMini(
                            'CHECK-IN',
                            _startDate,
                            (d) => setState(() => _startDate = d),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildDatePickerMini(
                            'CHECK-OUT',
                            _endDate,
                            (d) => setState(() => _endDate = d),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: _buildTextFieldMini(
                            'TOTAL NIGHTS',
                            _nightsController,
                            keyboardType: TextInputType.number,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _buildTextFieldMini(
                            'AMOUNT PAID',
                            _amountController,
                            prefix: '₹',
                            keyboardType: TextInputType.number,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'REMARKS',
                      _jobReportController,
                      maxLines: 2,
                    ),
                    const SizedBox(height: 16),
                    _buildImagePickerMini(
                      'UPLOAD BILL',
                      _image,
                      () => _getImage(),
                    ),
                  ],
                ),
              ] else if (widget.category == 'Outstation Travel' ||
                  widget.category == 'Travel') ...[
                _buildWebCard(
                  title: 'TRAVEL BOOKING DETAILS',
                  color: const Color(0xFF0F766E),
                  children: [
                    _buildLogBlock(
                      label: 'BOOKING INFO',
                      color: const Color(0xFF0F766E),
                      bgColor: const Color(0xFFF0FDFA),
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _buildDropdownMini(
                                'MODE',
                                _travelMode,
                                _masterTravelModes,
                                (v) => setState(() => _travelMode = v),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildDropdownMini(
                                'BOOKED BY',
                                _bookedBy,
                                ['Self Paid', 'Company Paid'],
                                (v) => setState(() => _bookedBy = v),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: _buildTextFieldMini(
                                'PNR / REF.',
                                _pnrController,
                                hint: 'PNR No.',
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildTextFieldMini(
                                'TICKET NO.',
                                _ticketNoController,
                                hint: 'Ticket No.',
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildLogBlock(
                      label: 'ROUTE & CARRIER',
                      color: const Color(0xFF3B82F6),
                      bgColor: const Color(0xFFEFF6FF),
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _buildTextFieldMini(
                                'FROM',
                                _originController,
                                hint: 'Origin',
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildTextFieldMini(
                                'TO',
                                _destController,
                                hint: 'Destination',
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        _buildTextFieldMini(
                          'CARRIER NAME',
                          _carrierController,
                          hint: 'Airline / Train / Bus Name',
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildLogBlock(
                      label: 'JOURNEY SCHEDULE',
                      color: const Color(0xFF10B981),
                      bgColor: const Color(0xFFECFDF5),
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: _buildDatePickerMini(
                                'DEP. DATE',
                                _startDate,
                                (d) => setState(() => _startDate = d),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildTimePickerMini(
                                'DEP. TIME',
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
                                'ARR. DATE',
                                _endDate,
                                (d) => setState(() => _endDate = d),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildTimePickerMini(
                                'ARR. TIME',
                                _endTime,
                                (t) => setState(() => _endTime = t),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildLogBlock(
                      label: 'EXPENSE & PURPOSE',
                      color: const Color(0xFFEF4444),
                      bgColor: const Color(0xFFFEF2F2),
                      children: [
                        _buildTextFieldMini(
                          'AMOUNT',
                          _amountController,
                          prefix: '₹',
                          keyboardType: TextInputType.number,
                          hint: '0.00',
                        ),
                        const SizedBox(height: 12),
                        _buildTextFieldMini(
                          'NATURE OF VISIT / PURPOSE',
                          _jobReportController,
                          maxLines: 3,
                          hint: 'Purpose of travel...',
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _buildImagePickerMini(
                      'ATTACH TICKET / INVOICE',
                      _image,
                      () => _getImage(),
                    ),
                  ],
                ),
              ] else if (widget.category == 'Incidental') ...[
                _buildWebCard(
                  title: 'INCIDENTAL EXPENSE LOGS',
                  color: const Color(0xFFF59E0B),
                  children: [
                    _buildDatePickerMini(
                      'DATE',
                      _startDate,
                      (d) => setState(() => _startDate = d),
                    ),
                    const SizedBox(height: 16),
                    _buildDropdownMini(
                      'EXPENSE TYPE',
                      _incidentalCategory,
                      _masterIncidentalTypes,
                      (v) => setState(() => _incidentalCategory = v),
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'LOCATION',
                      _incidentalLocationController,
                      hint: 'Where this occurred...',
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'AMOUNT',
                      _amountController,
                      hint: '0.00',
                      keyboardType: TextInputType.number,
                      prefix: '₹',
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'REMARKS / DETAILS',
                      _incidentalNotesController,
                      hint: 'Additional information...',
                      maxLines: 4,
                    ),
                    const SizedBox(height: 16),
                    _buildImagePickerMini(
                      'UPLOAD BILL',
                      _image,
                      () => _getImage(),
                    ),
                  ],
                ),
              ] else ...[
                _buildWebCard(
                  title: 'LOG EXPENSE - OTHERS',
                  color: const Color(0xFF64748B),
                  children: [
                    _buildDatePickerMini(
                      'DATE',
                      _startDate,
                      (d) => setState(() => _startDate = d),
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'AMOUNT',
                      _amountController,
                      hint: '0.00',
                      keyboardType: TextInputType.number,
                      prefix: '₹',
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'LOCATION',
                      _locationController,
                      hint: 'City / Site name...',
                    ),
                    const SizedBox(height: 16),
                    _buildTextFieldMini(
                      'PURPOSE',
                      _jobReportController,
                      hint: 'Enter the purpose of this expense...',
                      maxLines: 4,
                    ),
                    const SizedBox(height: 16),
                    _buildImagePickerMini(
                      'ATTACH RECEIPT',
                      _image,
                      () => _getImage(),
                    ),
                  ],
                ),
              ],
              const SizedBox(height: 40),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: _isProcessing ? null : _submitEntry,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF134E4A),
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
                            fontSize: 13,
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

  // --- NEW WEB-STYLE UI HELPERS ---

  Widget _buildWebCard({
    required String title,
    String? subtitle,
    required Color color,
    required List<Widget> children,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFCCFBF1)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Container(
              width: 5,
              decoration: BoxDecoration(
                color: color,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(16),
                  bottomLeft: Radius.circular(16),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 12,
                                fontWeight: FontWeight.w900,
                                color: const Color(0xFF1E293B),
                                letterSpacing: 0.5,
                              ),
                            ),
                            if (subtitle != null) ...[
                              const SizedBox(height: 2),
                              Text(
                                subtitle,
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w600,
                                  color: const Color(0xFF94A3B8),
                                ),
                              ),
                            ],
                          ],
                        ),
                        if (widget.expenseData != null)
                          const Icon(
                            Icons.delete_outline_rounded,
                            size: 18,
                            color: Color(0xFFE2E8F0),
                          ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    ...children,
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLogBlock({
    required String label,
    required Color color,
    required Color bgColor,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 9,
                  fontWeight: FontWeight.w900,
                  color: color,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }

  Future<void> _confirmDelete() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(
          'Delete Expense',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800),
        ),
        content: const Text(
          'Are you sure you want to delete this expense entry?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('CANCEL'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('DELETE'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      setState(() => _isProcessing = true);
      try {
        await _tripService.deleteExpense(widget.expenseData['id'].toString());
        if (mounted) Navigator.pop(context, true);
      } catch (e) {
        if (mounted)
          ScaffoldMessenger.of(
            context,
          ).showSnackBar(SnackBar(content: Text('Error: $e')));
      } finally {
        if (mounted) setState(() => _isProcessing = false);
      }
    }
  }

  // --- EXISTING MINI UI HELPERS ---

  Widget _buildTextFieldMini(
    String label,
    TextEditingController controller, {
    String? hint,
    String? prefix,
    int maxLines = 1,
    TextInputType? keyboardType,
    bool enabled = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 4),
        Container(
          decoration: BoxDecoration(
            color: enabled ? const Color(0xFFF0FDFA) : const Color(0xFFCCFBF1),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: enabled ? const Color(0xFFCCFBF1) : const Color(0xFFE2E8F0)),
          ),
          child: TextField(
            controller: controller,
            maxLines: maxLines,
            keyboardType: keyboardType,
            enabled: enabled,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: enabled ? Colors.black : const Color(0xFF94A3B8),
            ),
            decoration: InputDecoration(
              hintText: hint,
              prefixText: prefix,
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 8,
              ),
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
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 4),
        InkWell(
          onTap: () async {
            final d = await showDatePicker(
              context: context,
              initialDate: value,
              firstDate: DateTime(2020),
              lastDate: DateTime(2030),
            );
            if (d != null) onType(d);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  DateFormat('dd-MM-yyyy').format(value),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Icon(
                  Icons.calendar_today_rounded,
                  size: 12,
                  color: Color(0xFF64748B),
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
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 4),
        InkWell(
          onTap: () async {
            final t = await showTimePicker(
              context: context,
              initialTime: value,
            );
            if (t != null) onType(t);
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  value.format(context),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Icon(
                  Icons.access_time_rounded,
                  size: 12,
                  color: Color(0xFF64748B),
                ),
              ],
            ),
          ),
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
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 4),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDFA),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFFCCFBF1)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              hint: const Text('Select...', style: TextStyle(fontSize: 12)),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.black,
              ),
              icon: const Icon(Icons.keyboard_arrow_down_rounded, size: 16),
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

  Widget _buildOdoFieldMini(
    String label,
    TextEditingController controller,
    File? image,
    VoidCallback onCapture, {
    String? existingUrl,
    bool enabled = true,
  }) {
    bool hasImage =
        image != null || (existingUrl != null && existingUrl.isNotEmpty);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            Expanded(
              child: Container(
                height: 38,
                decoration: BoxDecoration(
                  color: enabled ? Colors.white : const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: enabled
                        ? const Color(0xFFE2E8F0)
                        : const Color(0xFFCBD5E1),
                  ),
                ),
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  enabled: enabled,
                  onChanged: (v) => _calculateTotal(),
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: enabled ? Colors.black : const Color(0xFF94A3B8),
                  ),
                  decoration: const InputDecoration(
                    hintText: '0',
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: (hasImage || !enabled) ? null : onCapture,
              child: Container(
                height: 38,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: hasImage
                      ? const Color(0xFFDCFCE7)
                      : !enabled
                      ? const Color(0xFFF1F5F9)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: hasImage
                        ? const Color(0xFF16A34A).withOpacity(0.3)
                        : !enabled
                        ? const Color(0xFFCBD5E1)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      hasImage
                          ? Icons.check_circle_rounded
                          : Icons.camera_alt_rounded,
                      size: 14,
                      color: hasImage
                          ? const Color(0xFF16A34A)
                          : const Color(0xFF64748B),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      hasImage
                          ? (existingUrl != null && existingUrl.isNotEmpty
                                ? 'Saved'
                                : 'Captured')
                          : 'Capture',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: hasImage
                            ? const Color(0xFF15803D)
                            : const Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildImagePickerMini(
    String label,
    File? image,
    VoidCallback onCapture,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(height: 6),
        InkWell(
          onTap: onCapture,
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: const Color(0xFFF0FDFA),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: image != null
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.check_circle_rounded,
                        color: Color(0xFF16A34A),
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Bill Uploaded',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF15803D),
                        ),
                      ),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.cloud_upload_outlined,
                        color: Color(0xFF94A3B8),
                        size: 16,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        'Upload Receipt / Photo',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

class SelectCategoryScreen extends StatelessWidget {
  final String tripId;
  const SelectCategoryScreen({super.key, required this.tripId});

  @override
  Widget build(BuildContext context) {
    final bool isTrip = tripId.toUpperCase().startsWith('TRP-');

    final List<String> categories = isTrip
        ? [
            'Local Travel',
            'Outstation Travel',
            'Food',
            'Accommodation',
            'Incidental',
            'Others',
          ]
        : ['Local Travel', 'Incidental', 'Others'];

    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Color(0xFF0D9488),
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Select Category',
          style: GoogleFonts.plusJakartaSans(
            color: const Color(0xFF134E4A),
            fontWeight: FontWeight.w900,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        centerTitle: true,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(0xFFCCFBF1)),
        ),
      ),
      body: GridView.builder(
        padding: const EdgeInsets.all(20),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 16,
          mainAxisSpacing: 16,
          childAspectRatio: 1.2,
        ),
        itemCount: categories.length,
        itemBuilder: (context, index) {
          final category = categories[index];
          return _buildCategoryCard(context, category, () {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) =>
                    ExpenseFormScreen(category: category, tripId: tripId),
              ),
            );
          });
        },
      ),
    );
  }

  Widget _buildCategoryCard(
    BuildContext context,
    String title,
    VoidCallback onTap,
  ) {
    IconData icon;
    switch (title) {
      case 'Local Travel':
        icon = Icons.directions_car_filled_rounded;
        break;
      case 'Outstation Travel':
        icon = Icons.flight_takeoff_rounded;
        break;
      case 'Food':
        icon = Icons.restaurant_menu_rounded;
        break;
      case 'Accommodation':
        icon = Icons.hotel_rounded;
        break;
      case 'Fuel':
        icon = Icons.local_gas_station_rounded;
        break;
      case 'Others':
        icon = Icons.category_rounded;
        break;
      case 'Incidental':
        icon = Icons.receipt_long_rounded;
        break;
      default:
        icon = Icons.error_outline_rounded;
    }

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 40, color: const Color(0xFF0D9488)),
            const SizedBox(height: 12),
            Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF134E4A),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ExpenseReviewScreen extends StatelessWidget {
  const ExpenseReviewScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Colors.black,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Expense Review',
          style: GoogleFonts.interTight(
            color: Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                _buildReviewItem('Travel', '\$120.00', '20 Dec 2023'),
                _buildReviewItem('DA', '\$45.00', '21 Dec 2023'),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Total Claim Amount',
                      style: TextStyle(fontWeight: FontWeight.w500),
                    ),
                    const Text(
                      '\$165.00',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFEF7139),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFEF7139),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
                      'Submit Claim',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReviewItem(String category, String amount, String date) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                category,
                style: GoogleFonts.interTight(
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              Text(
                date,
                style: GoogleFonts.inter(fontSize: 12, color: Colors.black38),
              ),
            ],
          ),
          Text(
            amount,
            style: GoogleFonts.inter(fontWeight: FontWeight.bold, fontSize: 16),
          ),
        ],
      ),
    );
  }
}
