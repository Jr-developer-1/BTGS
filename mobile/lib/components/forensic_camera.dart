import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:intl/intl.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:image/image.dart' as img;
import 'package:google_fonts/google_fonts.dart';

class ForensicCamera extends StatefulWidget {
  final bool frontOnly;
  final CameraLensDirection preferredLensDirection;
  const ForensicCamera({
    super.key, 
    this.frontOnly = false,
    this.preferredLensDirection = CameraLensDirection.back,
  });

  @override
  State<ForensicCamera> createState() => _ForensicCameraState();
}

class _ForensicCameraState extends State<ForensicCamera> {
  CameraController? _controller;
  List<CameraDescription>? _cameras;
  bool _isInitialized = false;
  String _liveLocation = "Fetching Location...";
  String _liveGPS = "";
  Position? _currentPosition;
  int _currentCameraIndex = 0;

  @override
  void initState() {
    super.initState();
    _initCamera();
    _startLocationStream();
  }

  Future<void> _initCamera() async {
    _cameras = await availableCameras();
    if (_cameras != null && _cameras!.isNotEmpty) {
      CameraDescription selectedCamera = _cameras![0];
      _currentCameraIndex = 0;
      
      // Try to find the preferred camera
      try {
        final preferred = _cameras!.firstWhere((c) => c.lensDirection == widget.preferredLensDirection);
        selectedCamera = preferred;
        _currentCameraIndex = _cameras!.indexOf(preferred);
      } catch (_) {
        // Fallback to first available if preferred not found
      }

      _controller = CameraController(
        selectedCamera,
        ResolutionPreset.high,
        enableAudio: false,
      );
      await _controller!.initialize();
      if (mounted) {
        setState(() => _isInitialized = true);
      }
    }
  }

  Future<void> _toggleCamera() async {
    if (_cameras == null || _cameras!.length < 2) return;
    
    setState(() => _isInitialized = false);
    
    _currentCameraIndex = (_currentCameraIndex + 1) % _cameras!.length;
    final newDescription = _cameras![_currentCameraIndex];
    
    if (_controller != null) {
      await _controller!.dispose();
    }
    
    _controller = CameraController(
      newDescription,
      ResolutionPreset.high,
      enableAudio: false,
    );
    
    try {
      await _controller!.initialize();
      if (mounted) {
        setState(() => _isInitialized = true);
      }
    } catch (e) {
      debugPrint("Error toggling camera: $e");
      if (mounted) setState(() => _isInitialized = true);
    }
  }

  void _startLocationStream() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location services are disabled.')));
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permissions are denied.')));
        return;
      }
    }

    if (permission == LocationPermission.deniedForever && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permissions are permanently denied.')));
      return;
    }

    // Force a fresh High Accuracy fix immediately to wake up the sensor
    try {
      Position currentPos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best,
        timeLimit: const Duration(seconds: 7),
      );
      if (mounted) _updateLocationState(currentPos);
    } catch (e) {
       debugPrint("Initial fix error: $e");
    }

    Geolocator.getPositionStream(
      locationSettings: AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
        forceLocationManager: true,
        intervalDuration: const Duration(seconds: 1),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationText: "Tracking high-precision forensic evidence",
          notificationTitle: "Forensic Camera Active",
          enableWakeLock: true,
        ),
      ),
    ).listen((Position position) {
      if (!mounted) return;
      
      // Filter out low accuracy noise (common on initial GPS wake)
      if (position.accuracy > 50 && _currentPosition != null) return;
      _updateLocationState(position);
    }).onError((error) {
       debugPrint("Location stream error: $error");
    });
  }

  bool _isGeocoding = false;
  Position? _lastGeocodedPosition;

  void _updateLocationState(Position position) async {
    // Forensic check: Only update if the new position is more accurate or similar
    if (_currentPosition != null && position.accuracy > _currentPosition!.accuracy + 15) {
      return; 
    }

    setState(() {
      _currentPosition = position;
      _liveGPS = "Lat: ${position.latitude.toStringAsFixed(6)}, Long: ${position.longitude.toStringAsFixed(6)} (±${position.accuracy.toStringAsFixed(1)}m)";
    });

    // Performance protection: Don't geocode if already in progress or if moved less than 15 meters
    if (_isGeocoding) return;
    
    double distance = 999.0;
    if (_lastGeocodedPosition != null) {
      distance = Geolocator.distanceBetween(
        _lastGeocodedPosition!.latitude, 
        _lastGeocodedPosition!.longitude, 
        position.latitude, 
        position.longitude
      );
    }

    if (_lastGeocodedPosition != null && distance < 15) return;

    _isGeocoding = true;
    try {
      List<Placemark> placemarks = await placemarkFromCoordinates(position.latitude, position.longitude);
      if (placemarks.isNotEmpty && mounted) {
        Placemark p = placemarks[0];
        _lastGeocodedPosition = position;
        setState(() {
          _liveLocation = "${p.name}, ${p.subLocality}, ${p.locality}, ${p.administrativeArea}";
        });
      }
    } catch (e) {
      debugPrint("Geocoding error: $e");
    } finally {
      _isGeocoding = false;
    }
  }

  Future<void> _takePicture() async {
    if (_controller == null || !_controller!.value.isInitialized) return;

    try {
      final XFile photo = await _controller!.takePicture();
      
      // Apply watermark forensicly
      final watermarkedPath = await _applyWatermark(photo.path);
      
      if (mounted) {
        Navigator.pop(context, {
          'path': watermarkedPath,
          'latitude': _currentPosition?.latitude,
          'longitude': _currentPosition?.longitude,
        });
      }
    } catch (e) {
      debugPrint("Error taking picture: $e");
    }
  }

  List<String> _wrapText(String text, int maxChars) {
    List<String> lines = [];
    List<String> words = text.split(' ');
    String currentLine = '';
    
    for (String word in words) {
      if (word.length > maxChars) {
        if (currentLine.isNotEmpty) {
          lines.add(currentLine);
          currentLine = '';
        }
        int start = 0;
        while (start < word.length) {
          int end = start + maxChars;
          if (end > word.length) end = word.length;
          lines.add(word.substring(start, end));
          start = end;
        }
      } else {
        if (currentLine.isEmpty) {
          currentLine = word;
        } else if (currentLine.length + 1 + word.length <= maxChars) {
          currentLine = '$currentLine $word';
        } else {
          lines.add(currentLine);
          currentLine = word;
        }
      }
    }
    if (currentLine.isNotEmpty) {
      lines.add(currentLine);
    }
    return lines;
  }

  Future<String> _applyWatermark(String path) async {
    try {
      final bytes = await File(path).readAsBytes();
      img.Image? image = img.decodeImage(bytes);
      if (image == null) return path;

      final now = DateTime.now();
      final stamp = DateFormat('dd-MMM-yyyy HH:mm:ss').format(now);
      final locText = _liveGPS.isNotEmpty ? "GPS: ${_currentPosition?.latitude.toStringAsFixed(6)}, ${_currentPosition?.longitude.toStringAsFixed(6)}" : "GPS: N/A";
      final addrText = "Address: $_liveLocation";

      final font = img.arial48;
      final lineSpacing = (font.lineHeight * 1.2).toInt();

      final boxWidth = (image.width * 0.9).toInt();
      final padding = (image.height * 0.02).toInt();

      // Wrap address if too long
      final maxChars = (boxWidth / 24).toInt();
      final addressLines = _wrapText(addrText, maxChars);

      final totalLinesCount = 2 + addressLines.length;
      final boxHeight = (totalLinesCount * lineSpacing + 40).toInt();
      
      img.fillRect(
        image,
        x1: padding, 
        y1: image.height - boxHeight - padding,
        x2: padding + boxWidth, 
        y2: image.height - padding,
        color: img.ColorRgba8(0, 0, 0, 180)
      );

      int currentY = image.height - boxHeight - padding + 20;

      img.drawString(image, stamp, font: font, x: padding + 20, y: currentY, color: img.ColorRgba8(255, 255, 255, 255));
      currentY += lineSpacing;

      img.drawString(image, locText, font: font, x: padding + 20, y: currentY, color: img.ColorRgba8(255, 255, 255, 255));
      currentY += lineSpacing;

      for (String line in addressLines) {
        img.drawString(image, line, font: font, x: padding + 20, y: currentY, color: img.ColorRgba8(255, 255, 255, 255));
        currentY += lineSpacing;
      }

      final directory = await getTemporaryDirectory();
      final wmPath = p.join(directory.path, "forensic_${p.basename(path)}");
      await File(wmPath).writeAsBytes(img.encodeJpg(image, quality: 85));
      return wmPath;
    } catch (e) {
      return path;
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized || _controller == null) {
      return const Scaffold(backgroundColor: Colors.black, body: Center(child: CircularProgressIndicator(color: Colors.white)));
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera Preview
          Center(child: CameraPreview(_controller!)),

          // Top Header
          Positioned(
            top: 40,
            left: 20,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(20)),
              child: Row(
                children: [
                   const Icon(Icons.security, color: Colors.greenAccent, size: 16),
                   const SizedBox(width: 8),
                   Text("FORENSIC MODE ACTIVE", style: GoogleFonts.inter(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
                ],
              ),
            ),
          ),

          // Close Button
          Positioned(
            top: 40,
            right: 20,
            child: IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.pop(context),
            ),
          ),

          // Watermark Overlay (Live)
          Positioned(
            bottom: 120,
            left: 20,
            right: 20,
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black45,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: Colors.white12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(Icons.access_time_filled, color: Colors.white70, size: 14),
                      const SizedBox(width: 8),
                      Text(DateFormat('dd-MMM-yyyy HH:mm:ss').format(DateTime.now()), style: GoogleFonts.inter(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.location_on, color: Colors.redAccent, size: 14),
                      const SizedBox(width: 8),
                      Expanded(child: Text(_liveGPS.isNotEmpty ? _liveGPS : "Waiting for GPS Fix...", style: GoogleFonts.inter(color: Colors.white70, fontSize: 11, fontStyle: FontStyle.italic))),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.only(left: 22),
                    child: Text(_liveLocation, style: GoogleFonts.inter(color: Colors.white54, fontSize: 10)),
                  ),
                ],
              ),
            ),
          ),

          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              height: 120,
              padding: const EdgeInsets.symmetric(horizontal: 40),
              color: Colors.black,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                   // Left spacer
                   const SizedBox(width: 48),
                   
                   // Shutter
                   GestureDetector(
                    onTap: _takePicture,
                    child: Container(
                      height: 75,
                      width: 75,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 4),
                      ),
                      child: Center(
                        child: Container(
                          height: 60,
                          width: 60,
                          decoration: const BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Flip Toggle
                  IconButton(
                    icon: Icon(Icons.cameraswitch_outlined, 
                      color: (_cameras?.length ?? 0) > 1 ? Colors.white : Colors.white24, 
                      size: 32
                    ),
                    onPressed: (_cameras?.length ?? 0) > 1 ? _toggleCamera : null,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
