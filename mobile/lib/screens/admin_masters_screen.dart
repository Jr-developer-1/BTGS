import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class AdminMastersScreen extends StatefulWidget {
  const AdminMastersScreen({super.key});

  @override
  State<AdminMastersScreen> createState() => _AdminMastersScreenState();
}

class _AdminMastersScreenState extends State<AdminMastersScreen> {
  final ApiService _apiService = ApiService();
  int _activeTabIndex = 0; // 0: Eligibility, 1: Jurisdictions

  List<dynamic> _rules = [];
  List<dynamic> _jurisdictions = [];
  List<dynamic> _cadres = [];
  List<dynamic> _states = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      if (_activeTabIndex == 0) {
        final res = await _apiService.get('/api/masters/eligibility-rules/');
        final cadresRes = await _apiService.get('/api/masters/cadres/');
        setState(() {
          _rules = res is List ? res : (res['results'] ?? []);
          _cadres = cadresRes is List ? cadresRes : (cadresRes['results'] ?? []);
          _isLoading = false;
        });
      } else {
        final res = await _apiService.get('/api/masters/jurisdictions/');
        final statesRes = await _apiService.get('/api/masters/locations/?type=State');
        setState(() {
          _jurisdictions = res is List ? res : (res['results'] ?? []);
          _states = statesRes is List ? statesRes : (statesRes['results'] ?? []);
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to fetch data: $e')));
      }
    }
  }

  void _switchTab(int index) {
    if (_activeTabIndex == index) return;
    setState(() {
      _activeTabIndex = index;
      _isLoading = true;
    });
    _fetchData();
  }

  void _showEligibilityForm({Map<String, dynamic>? item}) {
    final bool isEditing = item != null;
    int? selectedCadre = isEditing ? item['cadre'] : (_cadres.isNotEmpty ? _cadres[0]['id'] : null);
    String selectedCategory = isEditing ? item['category'] : 'Accommodation';
    String selectedCityType = isEditing ? (item['city_type'] ?? 'Metro') : 'Metro';
    final TextEditingController limitController = TextEditingController(text: isEditing ? item['limit_amount'].toString() : '');
    final TextEditingController classController = TextEditingController(text: isEditing ? item['eligibility_class'] ?? '' : '');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.only(topLeft: Radius.circular(32), topRight: Radius.circular(32)),
        ),
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom + 32, top: 24, left: 24, right: 24),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(isEditing ? 'Edit Rule' : 'New Eligibility Rule', style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w900)),
              const SizedBox(height: 24),
              // Cadre
              _buildDropdown('Cadre / Level', _cadres.map((c) => DropdownMenuItem<int>(value: c['id'], child: Text(c['name']))).toList(), selectedCadre, (v) => selectedCadre = v),
              const SizedBox(height: 16),
              // Category
              _buildDropdown('Category', ['Accommodation', 'Daily Allowance', 'Flight', 'Train', 'Bus', 'Local Conveyance', 'Mileage Rate'].map((c) => DropdownMenuItem<String>(value: c, child: Text(c))).toList(), selectedCategory, (v) => selectedCategory = v!),
              const SizedBox(height: 16),
              // City Type
              _buildDropdown('City Type', ['Metro', 'Non-Metro', 'N/A'].map((c) => DropdownMenuItem<String>(value: c, child: Text(c))).toList(), selectedCityType, (v) => selectedCityType = v!),
              const SizedBox(height: 16),
              // Limit
              TextField(
                controller: limitController,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(labelText: 'Limit Amount (₹)', border: OutlineInputBorder(borderRadius: BorderRadius.circular(16))),
              ),
              const SizedBox(height: 16),
              // Class
              TextField(
                controller: classController,
                decoration: InputDecoration(labelText: 'Class / Preferred Mode', border: OutlineInputBorder(borderRadius: BorderRadius.circular(16))),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () async {
                    if (selectedCadre == null) return;
                    final data = {
                      'cadre': selectedCadre,
                      'category': selectedCategory,
                      'city_type': selectedCityType,
                      'limit_amount': double.tryParse(limitController.text) ?? 0.0,
                      'eligibility_class': classController.text,
                    };
                    try {
                      if (isEditing) {
                        await _apiService.put('/api/masters/eligibility-rules/${item['id']}/', body: data);
                      } else {
                        await _apiService.post('/api/masters/eligibility-rules/', body: data); 
                      }
                      Navigator.pop(context);
                      _fetchData();
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFBB0633),
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: Text('SAVE RULE', style: GoogleFonts.inter(fontWeight: FontWeight.w900, color: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDropdown<T>(String label, List<DropdownMenuItem<T>> items, T? value, ValueChanged<T?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.grey[600])),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              isExpanded: true,
              value: value,
              items: items,
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Admin Masters', style: GoogleFonts.plusJakartaSans(color: const Color(0xFF0F172A), fontWeight: FontWeight.w900, fontSize: 18)),
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFFBB0633)),
            onPressed: () => _activeTabIndex == 0 ? _showEligibilityForm() : null, // Handle jurisdictions too
          ),
        ],
      ),
      body: Column(
        children: [
          _buildTabs(),
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator(color: Color(0xFFBB0633)))
              : _activeTabIndex == 0 ? _buildEligibilityList() : _buildJurisdictionList(),
          ),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          _buildTabItem(0, 'Eligibility', Icons.shield_rounded),
          _buildTabItem(1, 'Jurisdiction', Icons.public_rounded),
        ],
      ),
    );
  }

  Widget _buildTabItem(int index, String title, IconData icon) {
    final bool isActive = _activeTabIndex == index;
    return Expanded(
      child: InkWell(
        onTap: () => _switchTab(index),
        child: Column(
          children: [
            Icon(icon, color: isActive ? const Color(0xFFBB0633) : Colors.grey[400]),
            const SizedBox(height: 4),
            Text(title, style: GoogleFonts.inter(fontSize: 12, fontWeight: isActive ? FontWeight.w900 : FontWeight.w600, color: isActive ? const Color(0xFFBB0633) : Colors.grey[400])),
            const SizedBox(height: 10),
            Container(height: 2, color: isActive ? const Color(0xFFBB0633) : Colors.transparent),
          ],
        ),
      ),
    );
  }

  Widget _buildEligibilityList() {
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _rules.length,
      itemBuilder: (context, index) {
        final rule = _rules[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: Row(
            children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(rule['cadre_name'] ?? 'Universal', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w900, color: const Color(0xFF0F172A))),
                  const SizedBox(height: 4),
                  Row(children: [
                    Container(padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2), decoration: BoxDecoration(color: Colors.blue[50], borderRadius: BorderRadius.circular(6)), child: Text(rule['category']?.toUpperCase() ?? '', style: GoogleFonts.inter(fontSize: 8, fontWeight: FontWeight.w900, color: Colors.blue[700]))),
                    const SizedBox(width: 8),
                    Text(rule['city_type'] ?? '', style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[500], fontWeight: FontWeight.w700)),
                  ]),
                ]),
              ),
              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Text('₹${rule['limit_amount']?.toString() ?? '0'}', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w900, color: const Color(0xFFBB0633))),
                Text(rule['eligibility_class'] ?? '-', style: GoogleFonts.inter(fontSize: 10, color: Colors.grey[400], fontWeight: FontWeight.w600)),
              ]),
              const SizedBox(width: 8),
              IconButton(icon: const Icon(Icons.edit_rounded, size: 20, color: Colors.grey), onPressed: () => _showEligibilityForm(item: rule)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildJurisdictionList() {
    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: _jurisdictions.length,
      itemBuilder: (context, index) {
        final jur = _jurisdictions[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(jur['project_name'] ?? 'Unnamed Project', style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w900)),
                  Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: Colors.green[50], borderRadius: BorderRadius.circular(10)), child: Text(jur['project_code'] ?? 'N/A', style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.green[700]))),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(Icons.location_on_rounded, size: 14, color: Colors.grey[400]),
                  const SizedBox(width: 4),
                  Text('${jur['circle_name'] ?? 'N/A'} (Zone)', style: GoogleFonts.inter(fontSize: 12, color: Colors.grey[600], fontWeight: FontWeight.w600)),
                ],
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 4,
                children: (jur['district_names'] as List? ?? []).map((d) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(8)),
                  child: Text(d, style: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600, color: const Color(0xFF64748B))),
                )).toList(),
              ),
            ],
          ),
        );
      },
    );
  }
}
