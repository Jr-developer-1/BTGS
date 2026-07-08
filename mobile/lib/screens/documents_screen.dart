import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class DocumentsScreen extends StatefulWidget {
  const DocumentsScreen({super.key});

  @override
  State<DocumentsScreen> createState() => _DocumentsScreenState();
}

class _DocumentsScreenState extends State<DocumentsScreen> {
  final ImagePicker _picker = ImagePicker();
  final ApiService _apiService = ApiService();
  bool _isSaving = false;

  Map<String, dynamic> _docs = {
    'aadharId': {'val': '', 'file': null, 'fileName': ''},
    'companyId': {'val': '', 'file': null, 'fileName': ''},
    'drivingLicense': {'val': '', 'file': null, 'fileName': ''},
    'pan': {'val': '', 'file': null, 'fileName': ''},
    'passport': {'val': '', 'file': null, 'fileName': ''},
    'gstNo': {'val': '', 'file': null, 'fileName': ''},
    'rc': {'val': '', 'file': null, 'fileName': ''},
    'insurance': {'val': '', 'file': null, 'fileName': ''},
    'pollution': {'val': '', 'file': null, 'fileName': ''},
  };

  List<dynamic> _tripDocs = [];

  @override
  void initState() {
    super.initState();
    _loadDocuments();
  }

  Future<void> _loadDocuments() async {
    final user = _apiService.getUser();
    final employeeId = user?['employee_id'] ?? 'default';
    final prefs = await SharedPreferences.getInstance();

    final savedDocs = prefs.getString('user_documents_$employeeId');
    final savedTripDocs = prefs.getString('user_trip_documents_$employeeId');

    setState(() {
      if (savedDocs != null) {
        try {
          final Map<String, dynamic> parsed = jsonDecode(savedDocs);
          parsed.forEach((key, value) {
            if (_docs.containsKey(key)) {
              _docs[key] = Map<String, dynamic>.from(value);
            }
          });
        } catch (e) {
          debugPrint("Failed to parse documents: $e");
        }
      }

      if (savedTripDocs != null) {
        try {
          _tripDocs = jsonDecode(savedTripDocs);
        } catch (e) {
          debugPrint("Failed to parse trip documents: $e");
        }
      }
    });

    try {
      final response = await _apiService.get('/api/auth/documents', includeAuth: true);
      if (response != null && response is Map<String, dynamic>) {
        setState(() {
          response.forEach((key, value) {
            if (_docs.containsKey(key)) {
              _docs[key] = Map<String, dynamic>.from(value);
            }
          });
        });
        await prefs.setString('user_documents_$employeeId', jsonEncode(_docs));
      }
    } catch (e) {
      debugPrint("Failed to fetch documents from server: $e");
    }
  }

  Future<void> _saveDocuments() async {
    final user = _apiService.getUser();
    if (user == null) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("User session not found")));
      return;
    }

    final employeeId = user['employee_id'];
    setState(() => _isSaving = true);

    try {
      try {
        await _apiService.post('/api/auth/documents', body: _docs, includeAuth: true);
      } catch (e) {
        debugPrint("Failed to sync documents with server: $e");
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text("Sync with server failed. Saving locally.")),
          );
        }
      }

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('user_documents_$employeeId', jsonEncode(_docs));
      await prefs.setString(
        'user_trip_documents_$employeeId',
        jsonEncode(_tripDocs),
      );

      await Future.delayed(const Duration(milliseconds: 1000));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              "Repository synchronized successfully!",
              style: GoogleFonts.inter(fontWeight: FontWeight.w600),
            ),
            backgroundColor: const Color(0xFF10B981),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }
  Future<void> _pickFile(
    String key, {
    bool isTripDoc = false,
    int? tripDocIndex,
  }) async {
    final XFile? file = await _picker.pickImage(
      source: ImageSource.gallery,
      imageQuality: 70,
    );
    if (file != null) {
      final bytes = await file.readAsBytes();
      final base64File = "data:image/png;base64,${base64Encode(bytes)}";

      setState(() {
        if (isTripDoc && tripDocIndex != null) {
          _tripDocs[tripDocIndex]['file'] = base64File;
          _tripDocs[tripDocIndex]['fileName'] = file.name;
        } else {
          _docs[key]['file'] = base64File;
          _docs[key]['fileName'] = file.name;
        }
      });
    }
  }

  void _removeFile(String key, {bool isTripDoc = false, int? tripDocIndex}) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Text(
          'Remove Document',
          style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.bold),
        ),
        content: Text(
          'Are you sure you want to remove this scan?',
          style: GoogleFonts.inter(color: const Color(0xFF64748B)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'CANCEL',
              style: GoogleFonts.plusJakartaSans(
                color: Colors.grey,
                fontWeight: FontWeight.w800,
                fontSize: 12,
              ),
            ),
          ),
          TextButton(
            onPressed: () {
              setState(() {
                if (isTripDoc && tripDocIndex != null) {
                  _tripDocs[tripDocIndex]['file'] = null;
                  _tripDocs[tripDocIndex]['fileName'] = '';
                } else {
                  _docs[key]['file'] = null;
                  _docs[key]['fileName'] = '';
                }
              });
              Navigator.pop(context);
            },
            child: Text(
              'REMOVE',
              style: GoogleFonts.plusJakartaSans(
                color: const Color(0xFFBB0633),
                fontWeight: FontWeight.w900,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      body: Stack(
        children: [
          // Executive Mesh Blobs (Ultra-soft backgrounds to match dashboard)
          Positioned(
            top: -150,
            right: -100,
            child: Container(
              width: 500,
              height: 500,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFFA9052E).withOpacity(0.04),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),
          Positioned(
            bottom: 50,
            left: -100,
            child: Container(
              width: 350,
              height: 350,
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF3B82F6).withOpacity(0.03),
                    Colors.transparent,
                  ],
                ),
                shape: BoxShape.circle,
              ),
            ),
          ),

          Column(
            children: [
              _buildHeader(),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 100),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildSectionTitle(
                        "Identity Documents",
                        Icons.shield_outlined,
                        const Color(0xFF10B981),
                      ),
                      _buildDocCard(
                        "aadharId",
                        "Aadhar ID",
                        Icons.credit_card_rounded,
                        "12-digit UIDAI Number",
                        "mandatory",
                      ),
                      _buildDocCard(
                        "companyId",
                        "Company ID Card",
                        Icons.badge_outlined,
                        "Employee Code",
                        "mandatory",
                      ),

                      _buildSectionTitle(
                        "Travel Compliance Credentials",
                        Icons.directions_car_filled_outlined,
                        const Color(0xFFE11D48),
                      ),
                      _buildDocCard(
                        "drivingLicense",
                        "Driving License",
                        Icons.badge_outlined,
                        "License Number",
                        "mandatory",
                      ),
                      _buildDocCard(
                        "rc",
                        "RC Number",
                        Icons.description_outlined,
                        "Registration Number",
                        "mandatory",
                      ),
                      _buildDocCard(
                        "insurance",
                        "Insurance Policy",
                        Icons.security_outlined,
                        "Policy Number",
                        "mandatory",
                      ),
                      _buildDocCard(
                        "pollution",
                        "Pollution Certificate",
                        Icons.eco_outlined,
                        "Certificate Number",
                        "mandatory",
                      ),

                      _buildSectionTitle(
                        "Additional Documents",
                        Icons.description_outlined,
                        const Color(0xFF3B82F6),
                      ),
                      _buildDocCard(
                        "pan",
                        "PAN Card",
                        Icons.credit_card_rounded,
                        "Alphanumeric PAN",
                        "optional",
                      ),
                      _buildDocCard(
                        "passport",
                        "Passport",
                        Icons.public_rounded,
                        "Passport Number",
                        "optional",
                      ),

                      _buildSectionTitle(
                        "Trip Documents",
                        Icons.local_activity_outlined,
                        const Color(0xFFA50021),
                      ),
                      ..._tripDocs.asMap().entries.map(
                        (entry) => _buildTripDocCard(entry.key),
                      ),
                      _buildAddEntryBtn(),

                      _buildSectionTitle(
                        "Tax & Compliance",
                        Icons.business_outlined,
                        const Color(0xFFF59E0B),
                      ),
                      _buildDocCard(
                        "gstNo",
                        "Personal GSTIN",
                        Icons.business_outlined,
                        "GST Identification Number",
                        "optional",
                        showInput: true,
                      ),

                      const SizedBox(height: 12),
                      _buildFooterNotice(),
                    ],
                  ),
                ),
              ),
            ],
          ),

          if (_isSaving)
            Container(
              color: Colors.black.withOpacity(0.1),
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFFBB0633)),
              ),
            ),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: const Color(0xFFA9052E),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.08),
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
        children: [
          Positioned(
            right: -30,
            top: -20,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.05),
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
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.folder_shared_rounded,
                      color: Color(0xFFBB0633),
                      size: 22,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'ASSET REPOSITORY',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 10,
                            fontWeight: FontWeight.w800,
                            color: Colors.white.withOpacity(0.7),
                            letterSpacing: 1.2,
                          ),
                        ),
                        Text(
                          'Document Organizer',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                            letterSpacing: -0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: _isSaving ? null : _saveDocuments,
                    icon: Icon(
                      Icons.sync_rounded,
                      color: Colors.white.withOpacity(0.8),
                      size: 24,
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

  Widget _buildSectionTitle(String title, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 32, 4, 16),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 10),
          Text(
            title.toUpperCase(),
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF94A3B8),
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDocCard(
    String id,
    String label,
    IconData icon,
    String placeholder,
    String type, {
    bool showInput = false,
  }) {
    final doc = _docs[id];
    final bool hasFile = doc['file'] != null;
    final bool isMandatory = type == 'mandatory';

    return _baseCard(
      label: label,
      icon: icon,
      placeholder: placeholder,
      doc: doc,
      hasFile: hasFile,
      isMandatory: isMandatory,
      showInput: showInput,
      onTextChanged: (v) => setState(() => _docs[id]['val'] = v),
      onUpload: () => _pickFile(id),
      onRemove: () => _removeFile(id),
      onPreview: () => _showPreview(doc['file'], label),
    );
  }

  Widget _buildTripDocCard(int index) {
    final doc = _tripDocs[index];
    final bool hasFile = doc['file'] != null;

    return Stack(
      children: [
        _baseCard(
          label: doc['title'] ?? '',
          icon: Icons.local_activity_outlined,
          placeholder: "Document Title (e.g. Flight Ticket)",
          doc: doc,
          hasFile: hasFile,
          isMandatory: false,
          isDynamic: true,
          showInput: true,
          onTitleChanged: (v) => setState(() => _tripDocs[index]['title'] = v),
          onTextChanged: (v) => setState(() => _tripDocs[index]['val'] = v),
          onUpload: () => _pickFile('', isTripDoc: true, tripDocIndex: index),
          onRemove: () => _removeFile('', isTripDoc: true, tripDocIndex: index),
          onPreview: () => _showPreview(
            doc['file'],
            doc['title'].isEmpty ? 'Trip Document' : doc['title'],
          ),
        ),
        Positioned(
          top: 15,
          right: 15,
          child: IconButton(
            icon: const Icon(Icons.close, size: 16, color: Colors.grey),
            onPressed: () {
              setState(() => _tripDocs.removeAt(index));
            },
          ),
        ),
      ],
    );
  }

  Widget _baseCard({
    required String label,
    required IconData icon,
    required String placeholder,
    required Map<String, dynamic> doc,
    required bool hasFile,
    required bool isMandatory,
    bool isDynamic = false,
    bool showInput = false,
    Function(String)? onTextChanged,
    Function(String)? onTitleChanged,
    required VoidCallback onUpload,
    required VoidCallback onRemove,
    required VoidCallback onPreview,
  }) {
    final Color accent = isMandatory
        ? const Color(0xFF10B981)
        : const Color(0xFF3B82F6);
    final Color activeColor = isDynamic ? const Color(0xFFA50021) : accent;

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFF1F5F9)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.04),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: IntrinsicHeight(
          child: Row(
            children: [
              Container(width: 6, color: activeColor.withOpacity(0.4)),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: activeColor.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(icon, color: activeColor, size: 22),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (isDynamic)
                                  TextField(
                                    onChanged: onTitleChanged,
                                    controller:
                                        TextEditingController(
                                            text: doc['title'],
                                          )
                                          ..selection = TextSelection.collapsed(
                                            offset: (doc['title'] ?? '').length,
                                          ),
                                    style: GoogleFonts.plusJakartaSans(
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF0F172A),
                                      fontSize: 16,
                                    ),
                                    decoration: InputDecoration(
                                      isDense: true,
                                      hintText: placeholder,
                                      hintStyle: GoogleFonts.plusJakartaSans(
                                        fontSize: 14,
                                        color: Colors.grey.shade400,
                                      ),
                                      border: InputBorder.none,
                                    ),
                                  )
                                else
                                  Text(
                                    label,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontWeight: FontWeight.w800,
                                      color: const Color(0xFF0F172A),
                                      fontSize: 16,
                                    ),
                                  ),
                                Text(
                                  (doc['fileName'] != null &&
                                          doc['fileName'].toString().isNotEmpty)
                                      ? doc['fileName']
                                      : 'REPOSITORY STATUS',
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: const Color(0xFF94A3B8),
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          _buildMiniBadge(hasFile, isMandatory, activeColor),
                        ],
                      ),

                      if (showInput) ...[
                        const SizedBox(height: 20),
                        TextField(
                          onChanged: onTextChanged,
                          controller: TextEditingController(text: doc['val'])
                            ..selection = TextSelection.collapsed(
                              offset: (doc['val'] ?? '').length,
                            ),
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF0F172A),
                          ),
                          decoration: InputDecoration(
                            labelText: isDynamic
                                ? 'REFERENCE NUMBER'
                                : 'DOCUMENT NUMBER',
                            labelStyle: GoogleFonts.plusJakartaSans(
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF94A3B8),
                              letterSpacing: 0.5,
                            ),
                            hintText: placeholder,
                            hintStyle: GoogleFonts.plusJakartaSans(
                              fontSize: 14,
                              color: Colors.blueGrey.shade100,
                              fontWeight: FontWeight.w600,
                            ),
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: 0,
                              vertical: 8,
                            ),
                            enabledBorder: UnderlineInputBorder(
                              borderSide: BorderSide(
                                color: Colors.grey.withOpacity(0.1),
                              ),
                            ),
                            focusedBorder: const UnderlineInputBorder(
                              borderSide: BorderSide(color: Color(0xFFBB0633)),
                            ),
                            floatingLabelBehavior: FloatingLabelBehavior.always,
                          ),
                        ),
                      ],

                      const SizedBox(height: 20),
                      if (hasFile)
                        Row(
                          children: [
                            Expanded(
                              child: _actionBtn(
                                'PREVIEW',
                                Icons.remove_red_eye_outlined,
                                const Color(0xFFF1F5F9),
                                const Color(0xFF475569),
                                onPreview,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: _actionBtn(
                                'REMOVE',
                                Icons.delete_outline_rounded,
                                const Color(0xFFFFF1F2),
                                const Color(0xFFE11D48),
                                onRemove,
                              ),
                            ),
                          ],
                        )
                      else
                        _actionBtn(
                          'UPLOAD DOCUMENT SCAN',
                          Icons.cloud_upload_outlined,
                          const Color(0xFF0F172A).withOpacity(0.04),
                          const Color(0xFF475569),
                          onUpload,
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

  Widget _buildMiniBadge(bool hasFile, bool isMandatory, Color color) {
    if (hasFile) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withOpacity(0.1),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          'VERIFIED',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF10B981),
          ),
        ),
      );
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Text(
        isMandatory ? 'REQUIRED' : 'OPTIONAL',
        style: GoogleFonts.plusJakartaSans(
          fontSize: 9,
          fontWeight: FontWeight.w900,
          color: color,
        ),
      ),
    );
  }

  Widget _buildAddEntryBtn() {
    return InkWell(
      onTap: () {
        setState(() {
          _tripDocs.add({
            'id': DateTime.now().millisecondsSinceEpoch.toString(),
            'title': '',
            'val': '',
            'file': null,
            'fileName': '',
          });
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: const Color(0xFFE2E8F0),
            style: BorderStyle.solid,
          ),
        ),
        child: Column(
          children: [
            const Icon(
              Icons.add_circle_outline_rounded,
              size: 32,
              color: Color(0xFFCBD5E1),
            ),
            const SizedBox(height: 8),
            Text(
              "Add Trip Document Slot",
              style: GoogleFonts.plusJakartaSans(
                fontSize: 14,
                color: const Color(0xFF64748B),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _actionBtn(
    String label,
    IconData icon,
    Color bg,
    Color text,
    VoidCallback onTap,
  ) {
    return Material(
      color: bg,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 14, color: text),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: text,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        20,
        20,
        20 + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, -5),
          ),
        ],
      ),
      child: InkWell(
        onTap: _isSaving ? null : _saveDocuments,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: const Color(0xFF0F1E2A),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F1E2A).withOpacity(0.2),
                blurRadius: 12,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Center(
            child: _isSaving
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                      color: Colors.white,
                      strokeWidth: 2,
                    ),
                  )
                : Text(
                    'SAVE & SYNC REPOSITORY',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.w900,
                      color: Colors.white,
                      fontSize: 13,
                      letterSpacing: 0.5,
                    ),
                  ),
          ),
        ),
      ),
    );
  }

  void _showPreview(String? dataUrl, String title) {
    if (dataUrl == null) return;
    showDialog(
      context: context,
      builder: (context) => Dialog(
        insetPadding: const EdgeInsets.all(20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.bold,
                      fontSize: 18,
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
            ),
            Flexible(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.memory(
                    base64Decode(dataUrl.split(',')[1]),
                    fit: BoxFit.contain,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterNotice() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF64748B).withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.info_outline_rounded,
            size: 16,
            color: Color(0xFF64748B),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Documents stored in this repository assist in pre-filling travel logistics. All data is encrypted locally.',
              style: GoogleFonts.inter(
                fontSize: 12,
                color: const Color(0xFF64748B),
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
