import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:flutter/services.dart';
import 'dart:convert';
import '../services/trip_service.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';
import 'trip_story_screen.dart';
import 'travel_story_screen.dart';
import 'trip_planner_screen.dart';
import 'role_based_dashboard.dart';
import 'my_trips_screen.dart';

class CreateTripScreen extends StatefulWidget {
  const CreateTripScreen({super.key});

  @override
  State<CreateTripScreen> createState() => _CreateTripScreenState();
}

class _CreateTripScreenState extends State<CreateTripScreen> {
  final _formKey = GlobalKey<FormState>();
  final TripService _tripService = TripService();
  final ApiService _apiService = ApiService();

  // Controllers
  final TextEditingController _fromController = TextEditingController();
  final TextEditingController _toController = TextEditingController();
  final TextEditingController _enRouteController = TextEditingController();
  final TextEditingController _purposeController = TextEditingController();
  final TextEditingController _tripLeaderController = TextEditingController();
  final TextEditingController _projectCodeController =
      TextEditingController(text: 'General');
  final TextEditingController _memberSearchController = TextEditingController();

  DateTime? _startDate;
  DateTime? _endDate;
  String _composition = 'Alone';
  String _travelMode = 'Airways';
  String _vehicleType = 'Own';
  String _reportingManagerName = 'Loading...';
  String? _reportingManagerId;
  List<Map<String, dynamic>> _members = [];
  List<String> _accommodationRequests = [];

  String _logisticsType = 'long';
  bool _considerLocal = false;
  String _distance = '';
  String? _routePathId;
  List<dynamic> _availablePaths = [];

  bool _isLoading = false;
  bool _isDetectingManager = true;
  List<Map<String, dynamic>> _employeeList = [];
  List<Map<String, dynamic>> _filteredEmployees = [];
  bool _showMemberDropdown = false;
  bool _policyAccepted = false;
  int _myLevel = 99;
  String _travelerInfo = 'Self';

  // Geo / Location State
  List<dynamic> _fullHierarchy = [];
  List<dynamic> _locationsPool = [];
  Map<String, String> _sourceFilter = {
    'state': '',
    'district': '',
    'mandal': '',
    'cluster': '',
  };
  Map<String, String> _destFilter = {
    'state': '',
    'district': '',
    'mandal': '',
    'cluster': '',
  };
  List<dynamic> _sourcePool = [];
  List<dynamic> _destPool = [];
  bool _loadingLocations = false;

  @override
  void initState() {
    super.initState();
    _setupAuthData();
    _fetchHierarchy();
    _fetchLocationsPool();
  }

  Future<void> _fetchHierarchy() async {
    try {
      final res = await _apiService.get(ApiConstants.geoHierarchy);
      setState(() {
        _fullHierarchy = (res is List)
            ? res
            : (res['results'] ?? res['data'] ?? []);
      });
      // Re-fetch pool after hierarchy is ready (essential for long distance city extraction)
      _fetchLocationsPool();
    } catch (e) {
      debugPrint("Failed to fetch hierarchy: $e");
    }
  }

  Future<void> _fetchLocationsPool() async {
    try {
      if (_logisticsType == 'long') {
        // Inter-city: Extract Cities and Metro Cities from _fullHierarchy (same as Web)
        final List<dynamic> cityPool = [];
        final cityTypes = ['city', 'metropolitan city', 'metro city', 'metro_city', 'metropolyten city'];

        void walk(dynamic node) {
          if (node == null || node is! Map) return;

          // Check direct child lists for cities/metro cities
          ['cities', 'metro_polyten_cities'].forEach((key) {
            final arr = node[key];
            if (arr is List) {
              for (var c in arr) {
                if (c is Map && c.containsKey('name')) {
                  cityPool.add({
                    'id': c['id'],
                    'name': c['name'],
                    'code': c['code'] ?? '',
                    'location_type': key == 'metro_polyten_cities' ? 'Metro City' : 'City'
                  });
                }
              }
            }
          });

          // Walk standard hierarchy levels
          ['continents', 'countries', 'states', 'districts', 'mandals', 'clusters', 'children'].forEach((key) {
            final arr = node[key];
            if (arr is List) {
              for (var child in arr) {
                if (child is Map) {
                  final String t = (child['type'] ?? child['cluster_type'] ?? '').toString().toLowerCase().trim();
                  if (cityTypes.contains(t)) {
                    cityPool.add({
                      'id': child['id'],
                      'name': child['name'],
                      'code': child['code'] ?? '',
                      'location_type': t.contains('metro') ? 'Metro City' : 'City'
                    });
                  }
                  walk(child);
                }
              }
            }
          });
        }

        for (var root in _fullHierarchy) {
          walk(root);
        }

        // De-duplicate by name
        final seen = <String>{};
        final uniquePool = cityPool.where((loc) {
          final name = loc['name'].toString();
          if (seen.contains(name)) return false;
          seen.add(name);
          return true;
        }).toList();

        setState(() {
          _locationsPool = uniquePool;
        });
        debugPrint("DEBUG LOC: Long Distance Pool set with ${_locationsPool.length} cities.");
      } else {
        // Local: Fetch Site-level locations from backend
        final res = await _apiService.get("${ApiConstants.locations}?type=Site");
        setState(() {
          _locationsPool = (res is List) ? res : (res['results'] ?? res['data'] ?? []);
        });
        debugPrint("DEBUG LOC: Local Pool set with ${_locationsPool.length} sites.");
      }
    } catch (e) {
      debugPrint("Failed to fetch locations pool: $e");
    }
  }

  List<dynamic> get _allStates {
    List<dynamic> states = [];
    void search(dynamic nodes, [int depth = 0]) {
      if (depth > 15 || nodes == null || nodes is! List)
        return; // Type & Recursion protection
      for (var node in nodes) {
        if (node['level'] == 3 ||
            (node['type']?.toString().toLowerCase().contains('state') ??
                false)) {
          states.add(node);
        } else {
          final children =
              node['children'] ?? node['countries'] ?? node['states'] ?? [];
          search(children, depth + 1);
        }
      }
    }

    search(_fullHierarchy);
    return states;
  }

  List<dynamic> _getChildren(String type, Map<String, String> filters) {
    if (_fullHierarchy.isEmpty) return [];
    if (type == 'state') return _allStates;

    bool safeMatch(dynamic name, String target) =>
        name?.toString().trim().toLowerCase() == target.trim().toLowerCase();

    if (type == 'district' && filters['state']!.isNotEmpty) {
      final stateObj = _allStates.firstWhere(
        (s) => safeMatch(s['name'], filters['state']!),
        orElse: () => null,
      );
      return stateObj?['children'] ?? stateObj?['districts'] ?? [];
    }

    if (type == 'mandal' &&
        filters['district']!.isNotEmpty &&
        filters['state']!.isNotEmpty) {
      final stateObj = _allStates.firstWhere(
        (s) => safeMatch(s['name'], filters['state']!),
        orElse: () => null,
      );
      final districts = stateObj?['children'] ?? stateObj?['districts'] ?? [];
      final districtObj = districts.firstWhere(
        (d) => safeMatch(d['name'], filters['district']!),
        orElse: () => null,
      );
      return districtObj?['children'] ?? districtObj?['mandals'] ?? [];
    }

    if (type == 'cluster' &&
        filters['mandal']!.isNotEmpty &&
        filters['district']!.isNotEmpty &&
        filters['state']!.isNotEmpty) {
      final stateObj = _allStates.firstWhere(
        (s) => safeMatch(s['name'], filters['state']!),
        orElse: () => null,
      );
      final districts = stateObj?['children'] ?? stateObj?['districts'] ?? [];
      final districtObj = districts.firstWhere(
        (d) => safeMatch(d['name'], filters['district']!),
        orElse: () => null,
      );
      final mandals = districtObj?['children'] ?? districtObj?['mandals'] ?? [];
      final mandalObj = mandals.firstWhere(
        (m) => safeMatch(m['name'], filters['mandal']!),
        orElse: () => null,
      );
      return mandalObj?['children'] ?? mandalObj?['clusters'] ?? [];
    }

    return [];
  }

  List<dynamic> _getFinalPoints(Map<String, String> filters, String mode) {
    if (_fullHierarchy.isEmpty) return [];

    bool safeMatch(dynamic name, String target) =>
        name?.toString().trim().toLowerCase() == target.trim().toLowerCase();

    final stateObj = _allStates.firstWhere(
      (s) => safeMatch(s['name'], filters['state']!),
      orElse: () => null,
    );
    if (stateObj == null) return [];

    final districts = stateObj['children'] ?? stateObj['districts'] ?? [];
    final districtObj = districts.firstWhere(
      (d) => safeMatch(d['name'], filters['district']!),
      orElse: () => null,
    );
    if (districtObj == null) return [];

    final mandals = districtObj['children'] ?? districtObj['mandals'] ?? [];
    final mandalObj = mandals.firstWhere(
      (m) => safeMatch(m['name'], filters['mandal']!),
      orElse: () => null,
    );
    if (mandalObj == null) return [];

    if (mode == 'long') {
      return [mandalObj];
    } else {
      final clusters = mandalObj['children'] ?? mandalObj['clusters'] ?? [];
      List<dynamic> extractPoints(dynamic c) {
        return [
          ...(c['visiting_locations'] ?? []),
          ...(c['landmarks'] ?? []),
          ...(c['locations'] ?? []),
          ...(c['children'] ?? []),
        ];
      }

      if (filters['cluster']!.isNotEmpty) {
        final cluster = clusters.firstWhere(
          (c) => safeMatch(c['name'], filters['cluster']!),
          orElse: () => null,
        );
        return cluster != null ? extractPoints(cluster) : [];
      } else {
        List<dynamic> allPoints = [];
        for (var c in clusters) {
          allPoints.addAll(extractPoints(c));
        }
        return allPoints;
      }
    }
  }

  Future<void> _fetchPaths() async {
    if (_fromController.text.isNotEmpty && _toController.text.isNotEmpty) {
      try {
        final src = Uri.encodeComponent(_fromController.text);
        final dest = Uri.encodeComponent(_toController.text);
        final res = await _apiService.get(
          "${ApiConstants.findPaths}?source=$src&destination=$dest",
        );
        setState(() {
          _availablePaths = res is List ? res : [];
          if (_availablePaths.isNotEmpty) {
            final path = _availablePaths.firstWhere(
              (p) => p['is_default'] == true,
              orElse: () => _availablePaths[0],
            );
            _routePathId = path['id'].toString();
            _enRouteController.text =
                (path['via_location_names'] as List? ?? []).join(', ');
            _distance = path['distance_km']?.toString() ?? '';
          } else {
            _routePathId = null;
            _enRouteController.text = '';
            _distance = '';
          }
        });
      } catch (e) {
        debugPrint("Failed to fetch paths: $e");
      }
    }
  }

  // --- HELPERS FROM WEB PARITY ---
  String _normalizeId(dynamic id) {
    if (id == null) return '';
    return id
        .toString()
        .toLowerCase()
        .trim()
        .replaceAll(RegExp(r'^[a-z]+-?'), '')
        .replaceAll(RegExp(r'^0+'), '');
  }

  int _parseLevel(dynamic levelVal) {
    if (levelVal == null) return 99;
    final String levelStr = levelVal.toString().toLowerCase();
    if (levelStr.contains('head') ||
        levelStr.contains('hq') ||
        levelStr.contains('office'))
      return 1;
    if (levelStr.contains('region') ||
        levelStr.contains('state') ||
        levelStr.contains('zone'))
      return 2;
    if (levelStr.contains('branch') || levelStr.contains('facility')) return 3;
    final match = RegExp(r'\d+').firstMatch(levelStr);
    return match != null ? int.parse(match.group(0)!) : 99;
  }

  String _encodeId(String id) {
    return base64Url.encode(utf8.encode(id)).replaceAll('=', '');
  }

  // --- LOGIC ---
  Future<void> _setupAuthData() async {
    final user = _apiService.getUser();
    if (user == null) return;

    final userName = (user['name'] ?? user['username'] ?? 'Self');
    _travelerInfo = "$userName (${user['employee_id'] ?? 'ID-N/A'})";

    final myId = _normalizeId(user['employee_id'] ?? user['username']);

    setState(() {
      _tripLeaderController.text = _travelerInfo;
    });

    try {
      // 1. Fetch Employees & Users parallel
      final empRes = await _tripService.getReportingManager();
      final allEmps = (empRes['results'] as List? ?? [])
          .cast<Map<String, dynamic>>();

      final systemUsersRes = await _tripService.fetchUsers();
      final systemUsers = systemUsersRes.cast<Map<String, dynamic>>();

      // 2. Find Me and my Level
      final me = allEmps.firstWhere(
        (e) => _normalizeId(e['employee']['employee_code']) == myId,
        orElse: () => {},
      );

      if (me.isNotEmpty) {
        _myLevel = _parseLevel(
          me['office']?['level'] ?? me['position']?['level'],
        );

        // 3. Detect Reporting Manager logic
        if (me['position']?['reporting_to'] != null &&
            (me['position']['reporting_to'] as List).isNotEmpty) {
          final managerInfo = me['position']['reporting_to'][0];
          final managerCode =
              managerInfo['employee_code'] ??
              managerInfo['employee_id'] ??
              managerInfo['id'];
          final managerName =
              managerInfo['name'] ??
              managerInfo['employee_name'] ??
              'Assigned Manager';

          final systemMgr = systemUsers.firstWhere(
            (u) =>
                _normalizeId(u['employee_id']) == _normalizeId(managerCode) ||
                _normalizeId(u['username']) == _normalizeId(managerCode),
            orElse: () => {},
          );

          if (systemMgr.isNotEmpty) {
            if (!mounted) return;
            setState(() {
              _reportingManagerId = systemMgr['id'].toString();
              _reportingManagerName = systemMgr['name'] ?? managerName;
              _isDetectingManager = false;
            });
          } else {
            // Fallback to Admin
            final admin = systemUsers.firstWhere(
              (u) => [
                'Admin',
                'IT-Admin',
                'Superuser',
              ].contains(u['role']?.toString() ?? ''),
              orElse: () => {},
            );
            if (!mounted) return;
            setState(() {
              _reportingManagerId = admin.isNotEmpty
                  ? admin['id'].toString()
                  : null;
              _reportingManagerName = admin.isNotEmpty
                  ? "System Admin fallback (for $managerName)"
                  : managerName;
              _isDetectingManager = false;
            });
          }
        } else {
          // No manager in HR profile logic
          final admin = systemUsers.firstWhere(
            (u) => [
              'Admin',
              'IT-Admin',
              'Superuser',
            ].contains(u['role']?.toString() ?? ''),
            orElse: () => {},
          );
          setState(() {
            _reportingManagerId = admin.isNotEmpty
                ? admin['id'].toString()
                : null;
            _reportingManagerName = admin.isNotEmpty
                ? "${admin['name']} (Default)"
                : 'System Administrator (Default)';
            _isDetectingManager = false;
          });
        }
      } else {
        if (!mounted) return;
        setState(() {
          _reportingManagerName = 'Employee Profile Missing';
          _isDetectingManager = false;
        });
      }

      // 4. Mapped Employees for selection (Same level and below)
      final mapped = allEmps
          .map((item) {
            return {
              'name': item['employee']?['name'] ?? 'N/A',
              'id': item['employee']?['employee_code'] ?? 'N/A',
              'level':
                  item['office']?['level'] ??
                  item['position']?['level'] ??
                  'N/A',
              'designation': item['position']?['name'] ?? 'N/A',
              'numericLevel': _parseLevel(
                item['office']?['level'] ?? item['position']?['level'],
              ),
            };
          })
          .where((emp) {
            if (_normalizeId(emp['id']) == myId) return false;
            if (_myLevel == 99) return true;
            return (emp['numericLevel'] as int) >= _myLevel;
          })
          .toList();

      if (!mounted) return;
      setState(() {
        _employeeList = mapped;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _reportingManagerName = 'Error detecting manager';
        _isDetectingManager = false;
      });
    }
  }

  void _searchMembers(String query) {
    if (query.isEmpty) {
      setState(() {
        _filteredEmployees = [];
        _showMemberDropdown = false;
      });
      return;
    }

    final lowerQuery = query.toLowerCase();
    setState(() {
      _filteredEmployees = _employeeList.where((emp) {
        final name = emp['name'].toString().toLowerCase();
        final id = emp['id'].toString().toLowerCase();
        return name.contains(lowerQuery) || id.contains(lowerQuery);
      }).toList();
      _showMemberDropdown = _filteredEmployees.isNotEmpty;
    });
  }

  Future<void> _selectDate(BuildContext context, bool isStart) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: isStart
          ? (DateTime.now().add(const Duration(days: 0)))
          : (_endDate ?? _startDate ?? DateTime.now()),
      firstDate: DateTime.now(),
      lastDate: DateTime(2101),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF7C1D1D),
              onPrimary: Colors.white,
              onSurface: Color(0xFF0F172A),
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
          if (_endDate != null && _endDate!.isBefore(_startDate!)) {
            _endDate = null;
          }
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    if (!_policyAccepted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('You must accept the travel policy to proceed.'),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    if (_fromController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Origin (From) is required')),
      );
      return;
    }
    if (_toController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Destination (To) is required')),
      );
      return;
    }

    if (_startDate == null || _endDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select travel dates')),
      );
      return;
    }

    if (_composition == 'Team' && _members.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Team travel requires at least 1 additional member.'),
        ),
      );
      return;
    }

    setState(() => _isLoading = true);

    final payload = {
      'source': _fromController.text,
      'destination': _toController.text,
      'en_route': _enRouteController.text,
      'route_path': _routePathId,
      'consider_as_local': _considerLocal,
      'start_date': DateFormat('yyyy-MM-dd').format(_startDate!),
      'end_date': DateFormat('yyyy-MM-dd').format(_endDate!),
      'composition': _composition == 'Alone' ? 'Solo' : 'Group',
      'purpose': _purposeController.text,
      'travel_mode': _travelMode,
      'vehicle_type':
          (['Car / Jeep / Van', '2 Wheeler', '3 Wheeler'].contains(_travelMode))
          ? _vehicleType
          : null,
      'reporting_manager':
          (_reportingManagerId != null && _reportingManagerId!.isNotEmpty)
          ? int.tryParse(_reportingManagerId!)
          : null,
      'members': _members
          .map(
            (m) =>
                "${m['name']} (${m['id']}) - ${m['designation'] != 'N/A' ? m['designation'] : m['level']}",
          )
          .toList(),
      'trip_leader': _tripLeaderController.text,
      'accommodation_requests': _accommodationRequests,
      'project_code': _projectCodeController.text,
    };

    try {
      final trip = await _tripService.createTrip(payload);
      if (mounted) setState(() => _isLoading = false);

      if (!mounted) return;

      _showSuccessDialog(trip.tripId);
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e'), backgroundColor: Colors.red),
        );
    }
  }

  void _showSuccessDialog(String tripId) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.check_circle_rounded,
                color: Color(0xFF10B981),
                size: 64,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Trip Created Successfully!',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w900,
                fontSize: 20,
                color: const Color(0xFF0F172A),
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Your trip request has been submitted.\nTrip ID: $tripId',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFF64748B),
                fontSize: 13,
                fontWeight: FontWeight.w600,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(context).pushAndRemoveUntil(
                    MaterialPageRoute(
                      builder: (context) => const MyTripsScreen(),
                    ),
                    (route) => route.isFirst,
                  );
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF134E4A),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                  elevation: 0,
                ),
                child: Text(
                  'GO TO MY TRIPS',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    fontSize: 14,
                    color: Colors.white,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0FDFA),
      body: Stack(
        children: [
          // Ultra-soft mesh blobs
          Positioned(
            top: -150,
            right: -100,
            child: Container(
              width: 500,
              height: 500,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF0D9488).withOpacity(0.06),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: 50,
            left: -150,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF2DD4BF).withOpacity(0.04),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),

          Column(
            children: [
              _buildCustomHeader(),
              Expanded(
                child: SingleChildScrollView(
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _sectionHeader(
                          Icons.navigation_rounded,
                          'Journey Logistics',
                        ),
                        _buildJourneyLogistics(),
                        const SizedBox(height: 32),

                        _sectionHeader(
                          Icons.groups_rounded,
                          'Composition & Purpose',
                        ),
                        _buildCompositionSection(),
                        const SizedBox(height: 32),

                        _sectionHeader(
                          Icons.hotel_rounded,
                          'Logistics & Stay Checklist',
                        ),
                        _buildStaySection(),
                        const SizedBox(height: 32),
                        _buildPolicyAcceptance(),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),

          if (_isLoading)
            Container(
              color: Colors.black.withOpacity(0.1),
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFF0D9488)),
              ),
            ),
        ],
      ),
      bottomNavigationBar: _buildBottomActions(),
    );
  }

  Widget _buildCustomHeader() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0F766E), Color(0xFF0D9488)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.15),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(36),
          bottomRight: Radius.circular(36),
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -20,
            top: -20,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.06),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            left: -30,
            bottom: -30,
            child: Container(
              width: 100,
              height: 100,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.04),
                shape: BoxShape.circle,
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(10, 15, 25, 30),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(
                      Icons.arrow_back_ios_new_rounded,
                      color: Colors.white,
                      size: 20,
                    ),
                    onPressed: () => Navigator.pop(context),
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0D9488).withOpacity(0.2),
                          blurRadius: 15,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.add_road_rounded,
                      color: Color(0xFF0D9488),
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'INITIATE TRIP',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.white.withOpacity(0.7),
                            letterSpacing: 1.5,
                          ),
                        ),
                        Text(
                          'New Trip Request',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 24,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(IconData icon, String title, {double size = 16}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 14, left: 4),
      child: Row(
        children: [
          Icon(icon, size: size + 4, color: const Color(0xFF134E4A)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontSize: size,
                fontWeight: FontWeight.w900,
                color: const Color(0xFF134E4A),
                letterSpacing: -0.2,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildJourneyLogistics() {
    return _premiumCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildDropdownField(
            label: 'Travel Type',
            value: _logisticsType == 'long'
                ? 'Long Distance Travel'
                : 'Local Travel',
            items: ['Long Distance Travel', 'Local Travel'],
            onChanged: (v) {
              setState(() {
                _logisticsType = v == 'Long Distance Travel' ? 'long' : 'local';
                _considerLocal = (_logisticsType == 'local');
                _fromController.clear();
                _toController.clear();
                _enRouteController.clear();
                _distance = '';
                _routePathId = null;
                _availablePaths = [];
                _sourceFilter = {
                  'state': '',
                  'district': '',
                  'mandal': '',
                  'cluster': '',
                };
                _destFilter = {
                  'state': '',
                  'district': '',
                  'mandal': '',
                  'cluster': '',
                };
              });
              _fetchLocationsPool();
            },
          ),
          const SizedBox(height: 20),
          _sectionHeader(Icons.map_outlined, 'Origin (From)', size: 14),
          _logisticsType == 'local'
              ? _buildDrilldown('source')
              : _buildSearchableLocation(
                  controller: _fromController,
                  label: '',
                  onSelected: (val) {
                    _fromController.text = val;
                    _fetchPaths();
                  },
                ),
          const SizedBox(height: 20),
          _sectionHeader(
            Icons.location_on_outlined,
            'Destination (To)',
            size: 14,
          ),
          _logisticsType == 'local'
              ? _buildDrilldown('dest')
              : _buildSearchableLocation(
                  controller: _toController,
                  label: '',
                  onSelected: (val) {
                    _toController.text = val;
                    _fetchPaths();
                  },
                ),
          const SizedBox(height: 20),
          _buildPathsDropdown(),
          const SizedBox(height: 10),
          if (_distance.isNotEmpty) ...[
            _distanceBadge(),
            const SizedBox(height: 10),
          ],
          if (_logisticsType == 'local' &&
              (double.tryParse(_distance) ?? 0) > 50)
            _considerLocalAlert(),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildDatePickerField(
                  'Start Date',
                  _startDate,
                  true,
                  () => _selectDate(context, true),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildDatePickerField(
                  'End Date',
                  _endDate,
                  true,
                  () => _selectDate(context, false),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Expanded(
                child: _buildDropdownField(
                  label: 'Travel Mode',
                  value: _travelMode,
                    items: [
                      'Airways',
                      'Train',
                      'Bus',
                      'Car / Jeep / Van',
                      '2 Wheeler',
                      '3 Wheeler',
                    ],
                    onChanged: (v) => setState(() => _travelMode = v!),
                ),
              ),
                if ([
                  '2 Wheeler',
                  '3 Wheeler',
                  'Car / Jeep / Van',
                ].contains(_travelMode)) ...[
                const SizedBox(width: 16),
                Expanded(
                  child: _buildDropdownField(
                    label: 'Vehicle Ownership',
                    value: _vehicleType == 'Own'
                        ? 'Own Vehicle'
                        : 'Service / Outsourced',
                    items: ['Own Vehicle', 'Service / Outsourced'],
                    onChanged: (v) => setState(
                      () => _vehicleType = (v == 'Own Vehicle'
                          ? 'Own'
                          : 'Service'),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDrilldown(String side) {
    final filters = side == 'source' ? _sourceFilter : _destFilter;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          _buildDrilldownSelect(
            "Select State",
            _getChildren('state', filters),
            filters['state']!,
            (val) {
              setState(() {
                filters['state'] = val;
                filters['district'] = '';
                filters['mandal'] = '';
                filters['cluster'] = '';
                if (side == 'source')
                  _fromController.clear();
                else
                  _toController.clear();
              });
            },
          ),
          const SizedBox(height: 8),
          _buildDrilldownSelect(
            "Select District",
            _getChildren('district', filters),
            filters['district']!,
            (val) {
              setState(() {
                filters['district'] = val;
                filters['mandal'] = '';
                filters['cluster'] = '';
                if (side == 'source')
                  _fromController.clear();
                else
                  _toController.clear();
              });
            },
            disabled: filters['state']!.isEmpty,
          ),
          const SizedBox(height: 8),
          _buildDrilldownSelect(
            "Select Mandal",
            _getChildren('mandal', filters),
            filters['mandal']!,
            (val) {
              setState(() {
                filters['mandal'] = val;
                filters['cluster'] = '';
                if (side == 'source')
                  _fromController.clear();
                else
                  _toController.clear();
              });
            },
            disabled: filters['district']!.isEmpty,
          ),
          const SizedBox(height: 8),
          _buildDrilldownSelect(
            "Select Cluster (Optional)",
            _getChildren('cluster', filters),
            filters['cluster']!,
            (val) {
              setState(() {
                filters['cluster'] = val;
                if (side == 'source')
                  _fromController.clear();
                else
                  _toController.clear();
              });
            },
            disabled: filters['mandal']!.isEmpty,
          ),
          const SizedBox(height: 8),
          _buildDrilldownSelect(
            "Pick Location",
            _getFinalPoints(filters, _logisticsType),
            side == 'source' ? _fromController.text : _toController.text,
            (val) {
              setState(() {
                if (side == 'source')
                  _fromController.text = val;
                else
                  _toController.text = val;
                _fetchPaths();
              });
            },
            disabled: filters['mandal']!.isEmpty,
          ),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _prepareLocationOptions(List<dynamic> options) {
    debugPrint(
      "DEBUG LOC: Preparing options for ${options.length} items. Logistics: $_logisticsType",
    );
    if (options.isEmpty) return [];

    final Map<String, Map<String, dynamic>> uniqueMap = {};
    for (var item in options) {
      final String rawName = _getDisplayName(item);
      final String code = (item is Map && item.containsKey('code'))
          ? item['code']?.toString() ?? ''
          : '';

      // Fallback for empty names
      final String baseName = rawName.isNotEmpty
          ? rawName
          : (item is Map
                ? (item['external_id'] ?? item['id'] ?? 'Unknown').toString()
                : 'Unknown');

      final finalLabel = (_logisticsType == 'long' && code.isNotEmpty)
          ? "$baseName - $code"
          : baseName;

      if (!uniqueMap.containsKey(finalLabel)) {
        uniqueMap[finalLabel] = {
          'name': baseName,
          'code': code,
          'cluster_type': (item is Map)
              ? (item['location_type'] ??
                    item['cluster_type'] ??
                    item['type'] ??
                    '')
              : '',
          '_displayLabel': finalLabel,
          'original': item,
        };
      }
    }

    final result = uniqueMap.values.toList()
      ..sort(
        (a, b) => a['_displayLabel'].toString().compareTo(
          b['_displayLabel'].toString(),
        ),
      );

    debugPrint(
      "DEBUG LOC: Prepared ${result.length} unique searchable options.",
    );
    if (result.isNotEmpty) {
      debugPrint("DEBUG LOC: First item label: ${result[0]['_displayLabel']}");
    }

    return result;
  }

  String _getDisplayName(dynamic item) {
    if (item == null) return '';
    if (item is String) return item;
    if (item is! Map) return item.toString();
    return item['name'] ??
        item['cluster_name'] ??
        item['panchayat_name'] ??
        item['municipality_name'] ??
        item['corporation_name'] ??
        item['ward_name'] ??
        item['village_name'] ??
        item['town_name'] ??
        '';
  }

  Widget _buildDrilldownSelect(
    String placeholder,
    List<dynamic> options,
    String currentValue,
    Function(String) onSelect, {
    bool disabled = false,
  }) {
    return InkWell(
      onTap: disabled
          ? null
          : () {
              showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                backgroundColor: Colors.transparent,
                builder: (context) => _SearchLocationDialog(
                  title: placeholder,
                  options: _prepareLocationOptions(options),
                  onSelected: (val) {
                    onSelect(val);
                    Navigator.pop(context);
                  },
                ),
              );
            },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: disabled
              ? const Color(0xFFF1F5F9).withOpacity(0.5)
              : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFF1F5F9)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Text(
                currentValue.isEmpty ? placeholder : currentValue,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: currentValue.isEmpty
                      ? const Color(0xFF94A3B8)
                      : const Color(0xFF0F172A),
                ),
              ),
            ),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              size: 20,
              color: Color(0xFF64748B),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchableLocation({
    required TextEditingController controller,
    required String label,
    required Function(String) onSelected,
  }) {
    return InkWell(
      onTap: () => _showSearchDialog(onSelected),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                controller.text.isEmpty
                    ? 'Select Location...'
                    : controller.text,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: controller.text.isEmpty
                      ? const Color(0xFF94A3B8)
                      : const Color(0xFF0F172A),
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 8),
            const Icon(
              Icons.search_rounded,
              size: 20,
              color: Color(0xFF64748B),
            ),
          ],
        ),
      ),
    );
  }

  void _showSearchDialog(Function(String) onSelected) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _SearchLocationDialog(
        title: 'Select Location...',
        options: _prepareLocationOptions(_locationsPool),
        onSelected: (val) {
          onSelected(val);
          Navigator.pop(context);
        },
      ),
    );
  }

  Widget _buildPathsDropdown() {
    if (_availablePaths.isEmpty) {
      return _buildInputField(
        controller: _enRouteController,
        label: 'En Route (Stops)',
        hint: 'e.g. Vijayawada, Guntur',
        icon: Icons.add_road_rounded,
        helper: 'No predefined routes found between points.',
      );
    }
    final selectedPathName =
        _availablePaths.any((p) => p['id'].toString() == _routePathId)
        ? _availablePaths
              .firstWhere(
                (p) => p['id'].toString() == _routePathId,
              )['path_name']
              .toString()
        : 'Select Route Path...';

    return _buildDropdownField(
      label: 'Select Route Path',
      value: selectedPathName,
      items: [
        'Select Route Path...',
        ..._availablePaths.map((p) => p['path_name'].toString()),
      ],
      onChanged: (v) {
        final path = _availablePaths.firstWhere((p) => p['path_name'] == v);
        setState(() {
          _routePathId = path['id'].toString();
          _enRouteController.text = (path['via_location_names'] as List? ?? [])
              .join(', ');
          _distance = path['distance_km']?.toString() ?? '';
        });
      },
    );
  }

  Widget _distanceBadge() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.speed_rounded, size: 16, color: Color(0xFF64748B)),
          const SizedBox(width: 8),
          Text(
            '$_distance KM',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: const Color(0xFF0F172A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _considerLocalAlert() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF7ED),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFFEDD5)),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: Colors.orange),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Distance exceeds 50km',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    color: Colors.brown,
                  ),
                ),
                Text(
                  'Should this be treated as local?',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: Colors.brown.withOpacity(0.7),
                  ),
                ),
              ],
            ),
          ),
          Switch(
            value: _considerLocal,
            onChanged: (v) => setState(() => _considerLocal = v),
            activeColor: Colors.orange,
          ),
        ],
      ),
    );
  }

  Widget _buildCompositionSection() {
    return _premiumCard(
      child: Column(
        children: [
          _buildDropdownField(
            label: 'Travel Composition',
            value: _composition,
            items: ['Alone', 'Team'],
            onChanged: (v) => setState(() {
              _composition = v!;
              if (_composition == 'Team') {
                _tripLeaderController.text = _travelerInfo;
              } else {
                _tripLeaderController.text = _travelerInfo;
              }
            }),
          ),
          const SizedBox(height: 20),
          _buildInputField(
            controller: _tripLeaderController,
            label: _composition == 'Alone' ? 'Traveler (Self)' : 'Trip Leader',
            hint: 'Assign leader',
            icon: _composition == 'Alone'
                ? Icons.person_outline
                : Icons.stars_rounded,
            enabled: false,
            helper: _composition == 'Team'
                ? 'Team trips are led by the creator by default.'
                : null,
          ),
          if (_composition == 'Team') ...[
            const SizedBox(height: 20),
            _memberSearch(),
          ],
          const SizedBox(height: 20),
          _buildInputField(
            controller: _purposeController,
            label: 'Purpose of Trip',
            hint: 'State the business objective...',
            isRequired: true,
            maxLines: 3,
            textCapitalization: TextCapitalization.characters,
            validator: (v) => v!.isEmpty ? 'Purpose is required' : null,
          ),
        ],
      ),
    );
  }

  Widget _buildStaySection() {
    return _premiumCard(
      child: Column(
        children: [
          _buildChecklistItem(
            'Request for Room',
            'Forwarded to manager for booking coordination.',
            _accommodationRequests.contains('Request for Room'),
            (val) => setState(
              () => val!
                  ? _accommodationRequests.add('Request for Room')
                  : _accommodationRequests.remove('Request for Room'),
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Divider(color: Color(0xFFF1F5F9)),
          ),
          _buildChecklistItem(
            'Request for Vehicle',
            'Forwarded to fleet manager for vehicle allocation.',
            _accommodationRequests.contains('Request for Company Vehicle'),
            (val) => setState(
              () => val!
                  ? _accommodationRequests.add('Request for Company Vehicle')
                  : _accommodationRequests.remove(
                      'Request for Company Vehicle',
                    ),
            ),
          ),
          if (_accommodationRequests.isNotEmpty) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDFA),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.info_outline_rounded,
                    size: 16,
                    color: Color(0xFF0D9488),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Selected requests will be visible to your Approving Manager for further forwarding.',
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF0D9488),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPolicyAcceptance() {
    return _premiumCard(
      child: InkWell(
        onTap: () => setState(() => _policyAccepted = !_policyAccepted),
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(4.0),
          child: Row(
            children: [
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  color: _policyAccepted ? const Color(0xFF134E4A) : Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: _policyAccepted
                        ? const Color(0xFF134E4A)
                        : const Color(0xFFE2E8F0),
                    width: 1.5,
                  ),
                ),
                child: _policyAccepted
                    ? const Icon(
                        Icons.check_rounded,
                        size: 16,
                        color: Colors.white,
                      )
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    text: 'I have read and I accept the ',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF0F172A),
                    ),
                    children: [
                      TextSpan(
                        text: 'Travel Governance Policy',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0D9488),
                          decoration: TextDecoration.underline,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _memberSearch() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildInputField(
          controller: _memberSearchController,
          label: 'Additional Team Members',
          isRequired: true,
          hint: 'Search by name or code...',
          icon: Icons.person_add_alt_1_outlined,
          onChanged: _searchMembers,
        ),
        if (_showMemberDropdown)
          Container(
            margin: const EdgeInsets.only(top: 5),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFF1F5F9)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.08),
                  blurRadius: 20,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              children: _filteredEmployees
                  .map(
                    (emp) => ListTile(
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      title: Text(
                        emp['name'],
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      subtitle: Text(
                        "ID: ${emp['id']} • Level: ${emp['level']}",
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      onTap: () {
                        setState(() {
                          if (!_members.any((m) => m['id'] == emp['id'])) {
                            _members.add(emp);
                          }
                          _memberSearchController.clear();
                          _showMemberDropdown = false;
                        });
                      },
                    ),
                  )
                  .toList(),
            ),
          ),
        if (_members.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Wrap(
              spacing: 8,
              runSpacing: 10,
              children: _members
                  .map(
                    (m) => Container(
                      padding: const EdgeInsets.fromLTRB(14, 8, 8, 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                m['name'],
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF0F172A),
                                ),
                              ),
                              Text(
                                "${m['id']} • ${m['level']}",
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 9,
                                  color: const Color(0xFF64748B),
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: () => setState(() => _members.remove(m)),
                            child: Container(
                              padding: const EdgeInsets.all(4),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.close_rounded,
                                size: 12,
                                color: Color(0xFF0D9488),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
      ],
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    IconData? icon,
    bool isRequired = false,
    int maxLines = 1,
    bool enabled = true,
    TextCapitalization textCapitalization = TextCapitalization.none,
    String? helper,
    String? Function(String?)? validator,
    void Function(String)? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF64748B),
                letterSpacing: 0.2,
              ),
            ),
            if (isRequired) ...[
              const SizedBox(width: 4),
              Text(
                '*',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFFBB0633),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        TextFormField(
          controller: controller,
          enabled: enabled,
          maxLines: maxLines,
          textCapitalization: textCapitalization,
          inputFormatters: textCapitalization == TextCapitalization.characters
              ? [UpperCaseTextFormatter()]
              : [],
          onChanged: onChanged,
          validator: validator,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF0F172A),
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.plusJakartaSans(
              color: const Color(0xFF94A3B8),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
            prefixIcon: icon != null
                ? Icon(icon, size: 20, color: const Color(0xFF64748B))
                : null,
            filled: true,
            fillColor: enabled
                ? Colors.white
                : const Color(0xFFF1F5F9).withOpacity(0.5),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 18,
              vertical: 16,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFF1F5F9)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xFFF1F5F9)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(
                color: Color(0xFF0F172A),
                width: 1.5,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Colors.red, width: 1),
            ),
          ),
        ),
        if (helper != null)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(
              helper,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                color: const Color(0xFF94A3B8),
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildDatePickerField(
    String label,
    DateTime? value,
    bool isRequired,
    VoidCallback onTap,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF64748B),
                letterSpacing: 0.2,
              ),
            ),
            if (isRequired) ...[
              const SizedBox(width: 4),
              Text(
                '*',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFFBB0633),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: 10),
        InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF1F5F9)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.02),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    value == null
                        ? 'Select Date'
                        : DateFormat('dd MMM, yyyy').format(value),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: value == null
                          ? const Color(0xFF94A3B8)
                          : const Color(0xFF0F172A),
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(
                  Icons.calendar_today_rounded,
                  size: 18,
                  color: Color(0xFF64748B),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField({
    required String label,
    required String value,
    required List<String> items,
    required void Function(String?) onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 4),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF1F5F9)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: value,
              isExpanded: true,
              icon: const Icon(
                Icons.keyboard_arrow_down_rounded,
                color: Color(0xFF64748B),
                size: 24,
              ),
              dropdownColor: Colors.white,
              borderRadius: BorderRadius.circular(20),
              items: items
                  .map(
                    (e) => DropdownMenuItem(
                      value: e,
                      child: Text(
                        e,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                    ),
                  )
                  .toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReadOnlyField(
    String label,
    String value, {
    bool isWarning = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF64748B),
            letterSpacing: 0.2,
          ),
        ),
        const SizedBox(height: 10),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isWarning
                ? const Color(0xFFFEF2F2).withOpacity(0.5)
                : const Color(0xFFF1F5F9).withOpacity(0.5),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isWarning
                  ? const Color(0xFFFECACA)
                  : const Color(0xFFF1F5F9),
            ),
          ),
          child: Row(
            children: [
              Icon(
                isWarning
                    ? Icons.warning_amber_rounded
                    : Icons.verified_user_rounded,
                size: 20,
                color: isWarning ? Colors.red : const Color(0xFF64748B),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  value,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: isWarning ? Colors.red : const Color(0xFF0F172A),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (isWarning)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(
              'Manual review required at HQ Level.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                color: Colors.red,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildChecklistItem(
    String title,
    String subtitle,
    bool value,
    void Function(bool?)? onChanged,
  ) {
    return InkWell(
      onTap: () => onChanged!(!value),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 8),
        child: Row(
          children: [
            Container(
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                color: value ? const Color(0xFF0F1E2A) : Colors.white,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: value
                      ? const Color(0xFF0F1E2A)
                      : const Color(0xFFE2E8F0),
                  width: 1.5,
                ),
              ),
              child: value
                  ? const Icon(
                      Icons.check_rounded,
                      size: 16,
                      color: Colors.white,
                    )
                  : null,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      color: const Color(0xFF64748B),
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _premiumCard({required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 25,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: child,
    );
  }

  Widget _buildBottomActions() {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        20 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: const Color(0xFFE2E8F0))),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0D9488).withOpacity(0.05),
            blurRadius: 20,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: InkWell(
              onTap: _isLoading ? null : _handleSubmit,
              borderRadius: BorderRadius.circular(16),
              child: Container(
                height: 58,
                decoration: BoxDecoration(
                  color: const Color(0xFF134E4A),
                  borderRadius: BorderRadius.circular(18),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF134E4A).withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: Center(
                  child: _isLoading
                      ? const SizedBox(
                          height: 24,
                          width: 24,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 3,
                          ),
                        )
                      : Text(
                          'INSPECT & SUBMIT',
                          style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            fontSize: 15,
                            letterSpacing: 1.2,
                          ),
                        ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SearchLocationDialog extends StatefulWidget {
  final String title;
  final List<Map<String, dynamic>> options;
  final Function(String) onSelected;

  const _SearchLocationDialog({
    required this.title,
    required this.options,
    required this.onSelected,
  });

  @override
  State<_SearchLocationDialog> createState() => _SearchLocationDialogState();
}

class _SearchLocationDialogState extends State<_SearchLocationDialog> {
  final TextEditingController _searchController = TextEditingController();
  List<Map<String, dynamic>> _filtered = [];

  @override
  void initState() {
    super.initState();
    _filtered = widget.options;
  }

  void _filter(String q) {
    setState(() {
      _filtered = widget.options.where((opt) {
        final name = opt['_displayLabel'].toString().toLowerCase();
        final code = opt['code'].toString().toLowerCase();
        return name.contains(q.toLowerCase()) || code.contains(q.toLowerCase());
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      padding: const EdgeInsets.only(top: 8),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        boxShadow: [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 20,
            offset: Offset(0, -5),
          ),
        ],
      ),
      child: Column(
        children: [
          Container(
            margin: const EdgeInsets.only(top: 12, bottom: 20),
            width: 48,
            height: 5,
            decoration: BoxDecoration(
              color: const Color(0xFFCCFBF1),
              borderRadius: BorderRadius.circular(10),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    widget.title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: const Color(0xFF134E4A),
                      letterSpacing: -0.5,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDFA),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.close_rounded,
                      size: 18,
                      color: Color(0xFF0D9488),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: TextField(
              controller: _searchController,
              autofocus: true,
              onChanged: _filter,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w700,
                fontSize: 14,
                color: const Color(0xFF134E4A),
              ),
              decoration: InputDecoration(
                hintText: 'Search locations...',
                hintStyle: GoogleFonts.plusJakartaSans(
                  color: const Color(0xFF94A3B8),
                  fontWeight: FontWeight.w500,
                ),
                prefixIcon: const Icon(
                  Icons.search_rounded,
                  size: 20,
                  color: Color(0xFF0D9488),
                ),
                filled: true,
                fillColor: const Color(0xFFF0FDFA),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(18),
                  borderSide: const BorderSide(color: Color(0xFF0D9488), width: 1.5),
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 18),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              itemCount: _filtered.length,
              itemBuilder: (context, i) {
                final item = _filtered[i];
                final displayLabel = item['_displayLabel'];
                final type = item['cluster_type'];
                final code = item['code'];

                return Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: ListTile(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(18),
                    ),
                    tileColor: Colors.transparent,
                    hoverColor: const Color(0xFFF1F5F9),
                    leading: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Icon(
                        Icons.location_on_rounded,
                        size: 20,
                        color: Color(0xFF64748B),
                      ),
                    ),
                    title: Text(
                      displayLabel,
                      style: GoogleFonts.plusJakartaSans(
                        fontWeight: FontWeight.w800,
                        fontSize: 13,
                        color: const Color(0xFF0F172A),
                      ),
                    ),
                    subtitle:
                        type.toString().isNotEmpty || code.toString().isNotEmpty
                        ? Text(
                            "${code.isNotEmpty ? "$code • " : ""}$type",
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 11,
                              color: const Color(0xFF64748B),
                              fontWeight: FontWeight.w600,
                            ),
                          )
                        : null,
                    trailing: const Icon(
                      Icons.arrow_forward_ios_rounded,
                      size: 12,
                      color: Color(0xFFCBD5E1),
                    ),
                    onTap: () => widget.onSelected(displayLabel),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}
