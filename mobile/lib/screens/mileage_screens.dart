import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'dart:io';
import 'package:intl/intl.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:ui' as ui;
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import '../services/trip_service.dart';
import '../models/trip_model.dart';

class StartJourneyScreen extends StatefulWidget {
  const StartJourneyScreen({super.key});

  @override
  State<StartJourneyScreen> createState() => _StartJourneyScreenState();
}

class _StartJourneyScreenState extends State<StartJourneyScreen> {
  final TripService _tripService = TripService();
  List<Trip> _trips = [];
  Trip? _selectedTrip;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchTrips();
  }

  Future<void> _fetchTrips() async {
    try {
      final allTrips = await _tripService.fetchTrips();
      setState(() {
        _trips = allTrips.where((t) {
          final isAuthorized = ['Approved', 'On-Going'].contains(t.status);
          final isVehicleTrip = t.travelMode.toLowerCase().contains('vehicle');
          return isAuthorized && isVehicleTrip;
        }).toList();
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

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
          'Mileage Capture',
          style: GoogleFonts.interTight(
            color: const Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFF7C1D1D)),
            )
          : Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'RECORD MILEAGE',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Colors.black26,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Vehicle Journey Tracker',
                    style: GoogleFonts.interTight(
                      fontSize: 24,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 24),

                  if (_trips.isEmpty)
                    _buildLockedState()
                  else ...[
                    _buildTripSelector(),
                    const SizedBox(height: 24),
                    _buildStatusIndicator(),
                    const SizedBox(height: 24),
                    _buildActionCard(context),
                  ],
                ],
              ),
            ),
    );
  }

  Widget _buildLockedState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(30),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 2,
          style: BorderStyle.solid,
        ),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF7C1D1D).withOpacity(0.05),
                  blurRadius: 20,
                ),
              ],
            ),
            child: const Icon(
              Icons.lock_clock_rounded,
              size: 48,
              color: Color(0xFF7C1D1D),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            'Capture Locked',
            style: GoogleFonts.interTight(
              fontSize: 20,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'No Approved vehicle journeys found. You can only track mileage for authorized vehicle trips.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              color: Colors.black45,
              fontWeight: FontWeight.w600,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF1F5F9),
                foregroundColor: const Color(0xFF475569),
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Text(
                'RETURN TO TRIPS',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w900,
                  fontSize: 12,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTripSelector() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'SELECT JOURNEY',
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: Colors.black26,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(
            color: const Color(0xFFFFF5F5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFFEE2E2)),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<Trip>(
              isExpanded: true,
              value: _selectedTrip,
              hint: Text(
                'Choose an authorized journey...',
                style: GoogleFonts.inter(
                  fontSize: 13,
                  color: const Color(0xFF7C1D1D),
                  fontWeight: FontWeight.w700,
                ),
              ),
              onChanged: (trip) => setState(() => _selectedTrip = trip),
              items: _trips
                  .map(
                    (t) => DropdownMenuItem(
                      value: t,
                      child: Text(
                        '${t.tripId}: ${t.source} → ${t.destination}',
                        style: GoogleFonts.inter(
                          fontSize: 13,
                          color: const Color(0xFF7C1D1D),
                          fontWeight: FontWeight.w800,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildStatusIndicator() {
    return Row(
      children: [
        const Icon(Icons.timer_outlined, size: 18, color: Color(0xFF94A3B8)),
        const SizedBox(width: 8),
        Text(
          'Ready for Odometer Entry',
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF94A3B8),
          ),
        ),
      ],
    );
  }

  Widget _buildActionCard(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(
            Icons.camera_alt_rounded,
            size: 48,
            color: Color(0xFF7C1D1D),
          ),
          const SizedBox(height: 20),
          Text(
            'Capture Start Reading',
            style: GoogleFonts.interTight(
              fontSize: 18,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'GPS and Photo verification is mandatory for reimbursement.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 12,
              color: Colors.black45,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _selectedTrip == null
                  ? null
                  : () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => CaptureOdometerScreen(
                            isStart: true,
                            trip: _selectedTrip!,
                          ),
                        ),
                      );
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF7C1D1D),
                disabledBackgroundColor: Colors.grey.shade200,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 18),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Text(
                'TRIGGER CAMERA',
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  color: Colors.white,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class CaptureOdometerScreen extends StatefulWidget {
  final bool isStart;
  final Trip trip;
  final String? startReading; // Added to carry over start reading to summary
  const CaptureOdometerScreen({
    super.key,
    required this.isStart,
    required this.trip,
    this.startReading,
  });

  @override
  _CaptureOdometerScreenState createState() => _CaptureOdometerScreenState();
}

class _CaptureOdometerScreenState extends State<CaptureOdometerScreen> {
  File? _image;
  bool _isProcessing = false;
  final picker = ImagePicker();
  final TextEditingController _odoController = TextEditingController();

  Future<Position?> _determinePosition() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return null;

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) return null;
    }
    return await Geolocator.getCurrentPosition();
  }

  Future<void> _getImage() async {
    final Position? position = await _determinePosition();
    if (position == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Location services required for watermark.'),
        ),
      );
      return;
    }

    final pickedFile = await picker.pickImage(
      source: ImageSource.camera,
      imageQuality: 70,
    );
    if (pickedFile != null) {
      setState(() => _isProcessing = true);
      try {
        final File imageFile = File(pickedFile.path);
        final String currentTime = DateFormat(
          'yyyy-MM-dd HH:mm',
        ).format(DateTime.now());
        final String gpsLocation =
            "Lat: ${position.latitude.toStringAsFixed(4)}, Long: ${position.longitude.toStringAsFixed(4)}";

        final bytes = await imageFile.readAsBytes();
        final ui.Codec codec = await ui.instantiateImageCodec(bytes);
        final ui.FrameInfo frame = await codec.getNextFrame();
        final ui.Image image = frame.image;
        final recorder = ui.PictureRecorder();
        final canvas = Canvas(recorder);
        final paint = Paint();

        canvas.drawImage(image, Offset.zero, paint);
        final rectPaint = Paint()..color = Colors.black.withOpacity(0.5);
        canvas.drawRect(
          Rect.fromLTWH(
            0,
            image.height.toDouble() - 180,
            image.width.toDouble(),
            180,
          ),
          rectPaint,
        );

        final textStyle = TextStyle(
          color: Colors.white,
          fontSize: (image.width / 30).clamp(24, 80),
          fontWeight: FontWeight.bold,
        );
        final textPainterLoc = TextPainter(
          text: TextSpan(text: 'Location: $gpsLocation', style: textStyle),
          textDirection: ui.TextDirection.ltr,
        );
        textPainterLoc.layout();
        textPainterLoc.paint(canvas, Offset(40, image.height.toDouble() - 140));

        final textPainterTime = TextPainter(
          text: TextSpan(text: 'Time: $currentTime', style: textStyle),
          textDirection: ui.TextDirection.ltr,
        );
        textPainterTime.layout();
        textPainterTime.paint(canvas, Offset(40, image.height.toDouble() - 70));

        final picture = recorder.endRecording();
        final img = await picture.toImage(image.width, image.height);
        final data = await img.toByteData(format: ui.ImageByteFormat.png);

        if (data != null) {
          final directory = await getTemporaryDirectory();
          final String filePath = p.join(
            directory.path,
            'watermarked_odo_${DateTime.now().millisecondsSinceEpoch}.png',
          );
          final File watermarkedFile = File(filePath)
            ..writeAsBytesSync(data.buffer.asUint8List());
          setState(() => _image = watermarkedFile);
        }
      } catch (e) {
        debugPrint('Error: $e');
      } finally {
        setState(() => _isProcessing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
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
          widget.isStart ? 'Start Odometer' : 'End Odometer',
          style: GoogleFonts.interTight(
            color: const Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            GestureDetector(
              onTap: _isProcessing ? null : _getImage,
              child: Container(
                width: double.infinity,
                height: 280,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: const Color(0xFFF1F5F9)),
                ),
                child: _isProcessing
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: Color(0xFF7C1D1D),
                        ),
                      )
                    : _image != null
                    ? Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(24),
                            child: Image.file(
                              _image!,
                              width: double.infinity,
                              height: 280,
                              fit: BoxFit.cover,
                            ),
                          ),
                          Positioned(
                            top: 15,
                            right: 15,
                            child: IconButton(
                              icon: const Icon(
                                Icons.cancel,
                                color: Colors.white,
                              ),
                              onPressed: () => setState(() => _image = null),
                            ),
                          ),
                        ],
                      )
                    : Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.add_a_photo_outlined,
                            size: 60,
                            color: Colors.black12,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Capture Odometer Reading',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: Colors.black26,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
              ),
            ),
            const SizedBox(height: 32),
            _buildInputSection(),
            const SizedBox(height: 48),
            _buildSubmitButton(),
          ],
        ),
      ),
    );
  }

  Widget _buildInputSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'ODOMETER READING*',
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: Colors.black26,
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _odoController,
          keyboardType: TextInputType.number,
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            fontSize: 40,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
            letterSpacing: 4,
          ),
          decoration: InputDecoration(
            hintText: '000000',
            hintStyle: TextStyle(color: Colors.grey.shade200),
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: BorderSide.none,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSubmitButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: (_image == null || _odoController.text.isEmpty)
            ? null
            : () {
                if (widget.isStart) {
                  // LocationTrackingService.startTracking(widget.trip.id); // Replaced by automatic date-based tracking
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => MileageOngoingScreen(
                        trip: widget.trip,
                        startReading: _odoController.text,
                      ),
                    ),
                  );
                } else {
                  // LocationTrackingService.stopTracking(); // Replaced by automatic date-based tracking
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) =>
                          MileageSummaryScreen(
                            trip: widget.trip,
                            startReading: widget.startReading ?? '0',
                            endReading: _odoController.text,
                          ),
                    ),
                  );
                }
              },
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF7C1D1D),
          disabledBackgroundColor: Colors.grey.shade100,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 20),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        child: Text(
          widget.isStart ? 'BEGIN JOURNEY' : 'COMPLETE JOURNEY',
          style: GoogleFonts.inter(fontWeight: FontWeight.w900, fontSize: 13),
        ),
      ),
    );
  }
}

class MileageOngoingScreen extends StatelessWidget {
  final Trip trip;
  final String startReading;
  const MileageOngoingScreen({
    super.key,
    required this.trip,
    required this.startReading,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Tracking Active',
          style: GoogleFonts.interTight(
            color: const Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
        automaticallyImplyLeading: false,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const SizedBox(height: 40),
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.05),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.navigation_rounded,
                size: 80,
                color: Color(0xFF10B981),
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Trip Mileage Active',
              style: GoogleFonts.interTight(
                fontSize: 24,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 12),
            Text(
              '${trip.tripId}: ${trip.source} → ${trip.destination}',
              textAlign: TextAlign.center,
              style: GoogleFonts.inter(
                color: Colors.black45,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 48),
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 20,
                  ),
                ],
              ),
              child: Column(
                children: [
                  _buildStatRow('Started at', '$startReading km'),
                  const Divider(height: 40, color: Color(0xFFF1F5F9)),
                  _buildStatRow('Elapsed Time', 'Tracking...'),
                ],
              ),
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) =>
                        CaptureOdometerScreen(
                          isStart: false, 
                          trip: trip,
                          startReading: startReading,
                        ),
                  ),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C1D1D),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
                child: Text(
                  'FINISH JOURNEY',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label.toUpperCase(),
          style: GoogleFonts.inter(
            fontSize: 10,
            fontWeight: FontWeight.w900,
            color: Colors.black26,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.inter(
            fontSize: 16,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF0F172A),
          ),
        ),
      ],
    );
  }
}

class MileageSummaryScreen extends StatefulWidget {
  final Trip trip;
  final String startReading;
  final String endReading;

  const MileageSummaryScreen({
    super.key,
    required this.trip,
    required this.startReading,
    required this.endReading,
  });

  @override
  State<MileageSummaryScreen> createState() => _MileageSummaryScreenState();
}

class _MileageSummaryScreenState extends State<MileageSummaryScreen> {
  final TripService _tripService = TripService();
  double _fuelRate = 0.0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchRate();
  }

  Future<void> _fetchRate() async {
    final vehicleType = widget.trip.vehicleType.contains('2') ? '2 Wheeler' : '4 Wheeler';
    final rate = await _tripService.fetchFuelRate(vehicleType);
    if (mounted) {
      setState(() {
        _fuelRate = rate ?? 0.0;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final double start = double.tryParse(widget.startReading) ?? 0.0;
    final double end = double.tryParse(widget.endReading) ?? 0.0;
    final double distance = (end - start).clamp(0.0, double.infinity);
    final double totalAmount = distance * _fuelRate;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'Mileage Summary',
          style: GoogleFonts.interTight(
            color: const Color(0xFF0F172A),
            fontWeight: FontWeight.w900,
          ),
        ),
        centerTitle: true,
      ),
      body: _isLoading 
        ? const Center(child: CircularProgressIndicator(color: Color(0xFF7C1D1D)))
        : Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            const SizedBox(height: 24),
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(30),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.03),
                    blurRadius: 30,
                  ),
                ],
              ),
              child: Column(
                children: [
                  _buildSummaryItem('Total Distance', '${distance.toStringAsFixed(1)} KM'),
                  _buildSummaryItem('Rate per KM', '₹${_fuelRate.toStringAsFixed(2)}'),
                  const Divider(height: 40, color: Color(0xFFF1F5F9)),
                  _buildSummaryItem('Total Amount', '₹${totalAmount.toStringAsFixed(2)}', isBold: true),
                ],
              ),
            ),
            const SizedBox(height: 40),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.check_circle_rounded,
                  color: Color(0xFF10B981),
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  _fuelRate > 0 
                  ? 'Calculated using Fuel Management rates.'
                  : 'Fuel management rate not found for this state.',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    color: _fuelRate > 0 ? const Color(0xFF10B981) : Colors.orange,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const Spacer(),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () =>
                    Navigator.of(context).popUntil((route) => route.isFirst),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF7C1D1D),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(vertical: 20),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(20),
                  ),
                ),
                child: Text(
                  'RETURN TO DASHBOARD',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w900,
                    fontSize: 13,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryItem(String label, String value, {bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.inter(
              fontSize: isBold ? 14 : 12,
              fontWeight: isBold ? FontWeight.w900 : FontWeight.w700,
              color: isBold ? const Color(0xFF0F172A) : Colors.black26,
            ),
          ),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: isBold ? 20 : 16,
              fontWeight: FontWeight.w900,
              color: isBold ? const Color(0xFF7C1D1D) : const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }
}
