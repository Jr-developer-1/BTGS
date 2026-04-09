import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';

class MasterCategory {
  final String title;
  final String endpoint;
  final String displayKey;
  final String iconStr;
  final Color color;

  MasterCategory({
    required this.title,
    required this.endpoint,
    required this.displayKey,
    required this.iconStr,
    required this.color,
  });
}

class AdminMasterManagementScreen extends StatefulWidget {
  const AdminMasterManagementScreen({super.key});

  @override
  State<AdminMasterManagementScreen> createState() => _AdminMasterManagementScreenState();
}

class _AdminMasterManagementScreenState extends State<AdminMasterManagementScreen> {
  final ApiService _apiService = ApiService();
  
  late MasterCategory _activeCategory;
  List<dynamic> _items = [];
  bool _isLoading = true;
  String _searchQuery = '';

  final List<MasterCategory> _categories = [
    MasterCategory(title: 'Incidental Types', endpoint: '/api/incidental-type-masters/', displayKey: 'expense_type', iconStr: 'receipt', color: Colors.blue),
    MasterCategory(title: 'Meal Types', endpoint: '/api/meal-type-masters/', displayKey: 'meal_type', iconStr: 'restaurant', color: Colors.orange),
    MasterCategory(title: 'Stay Types', endpoint: '/api/stay-type-masters/', displayKey: 'stay_type', iconStr: 'hotel', color: Colors.purple),
    MasterCategory(title: 'Room Types', endpoint: '/api/room-type-masters/', displayKey: 'room_type', iconStr: 'meeting_room', color: Colors.teal),
    MasterCategory(title: 'Booking Types', endpoint: '/api/booking-type-masters/', displayKey: 'booking_type', iconStr: 'book', color: Colors.indigo),
    MasterCategory(title: 'Vehicle Masters', endpoint: '/api/vehicle-masters/', displayKey: 'vehicle_name', iconStr: 'directions_car', color: Colors.red),
    MasterCategory(title: 'Travel Classes', endpoint: '/api/travel-class-masters/', displayKey: 'class_name', iconStr: 'flight_class', color: Colors.amber),
    MasterCategory(title: 'Provider Masters', endpoint: '/api/provider-masters/', displayKey: 'provider_name', iconStr: 'business', color: Colors.brown),
    MasterCategory(title: 'Local Travel Modes', endpoint: '/api/local-travel-mode-masters/', displayKey: 'mode_name', iconStr: 'directions_bus', color: Colors.green),
    MasterCategory(title: 'Local Sub Types', endpoint: '/api/local-sub-type-masters/', displayKey: 'sub_type', iconStr: 'category', color: Colors.deepPurple),
    MasterCategory(title: 'Meal Categories', endpoint: '/api/meal-category-masters/', displayKey: 'category_name', iconStr: 'set_meal', color: Colors.pink),
    MasterCategory(title: 'Meal Providers', endpoint: '/api/meal-provider-masters/', displayKey: 'provider_name', iconStr: 'storefront', color: Colors.cyan),
    MasterCategory(title: 'Stay Booking Types', endpoint: '/api/stay-booking-type-masters/', displayKey: 'booking_type', iconStr: 'bookmark', color: Colors.blueGrey),
  ];

  @override
  void initState() {
    super.initState();
    _activeCategory = _categories[0];
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    try {
      final res = await _apiService.get(_activeCategory.endpoint);
      setState(() {
        _items = res is List ? res : (res['results'] ?? res['data'] ?? []);
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to fetch data: $e')));
      }
    }
  }

  void _switchCategory(MasterCategory cat) {
    if (_activeCategory == cat) return;
    setState(() {
      _activeCategory = cat;
      _items = [];
    });
    _fetchData();
  }

  void _showForm({Map<String, dynamic>? item}) {
    final bool isEditing = item != null;
    final TextEditingController nameController = TextEditingController(
      text: isEditing ? (item[_activeCategory.displayKey]?.toString() ?? '') : '',
    );

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
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isEditing ? 'Edit ${_activeCategory.title}' : 'Add New ${_activeCategory.title}',
              style: GoogleFonts.plusJakartaSans(fontSize: 20, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 24),
            TextField(
              controller: nameController,
              decoration: InputDecoration(
                labelText: 'Name',
                hintText: 'Enter ${_activeCategory.title} name',
                filled: true,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
              ),
            ),
            const SizedBox(height: 16),
            if (item != null && item.containsKey('status'))
              StatefulBuilder(
                builder: (context, setInnerState) => SwitchListTile(
                  title: Text('Active Status', style: GoogleFonts.inter(fontWeight: FontWeight.w700)),
                  value: item['status'] ?? true,
                  activeColor: const Color(0xFFBB0633),
                  onChanged: (val) {
                    setInnerState(() => item['status'] = val);
                  },
                ),
              ),
            const SizedBox(height: 32),
            Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      if (nameController.text.trim().isEmpty) return;
                      final data = {_activeCategory.displayKey: nameController.text.trim()};
                      try {
                        if (isEditing) {
                          final updateData = {
                            ...data,
                            if (item.containsKey('status')) 'status': item['status'],
                          };
                          await _apiService.put('${_activeCategory.endpoint}${item['id']}/', body: updateData);
                        } else {
                          await _apiService.post(_activeCategory.endpoint, body: data);
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
                    child: Text('SAVE', style: GoogleFonts.inter(fontWeight: FontWeight.w900, color: Colors.white)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredItems = _items.where((i) {
      final name = (i[_activeCategory.displayKey] ?? '').toString().toLowerCase();
      return name.contains(_searchQuery.toLowerCase());
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text('Master Management', style: GoogleFonts.plusJakartaSans(color: const Color(0xFF0F172A), fontWeight: FontWeight.w900, fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.add_circle_outline_rounded, color: Color(0xFFBB0633)),
            onPressed: () => _showForm(),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildCategorySelector(),
          _buildSearchBox(),
          Expanded(
            child: _isLoading 
              ? const Center(child: CircularProgressIndicator(color: Color(0xFFBB0633)))
              : filteredItems.isEmpty 
                ? _buildEmptyState()
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                    itemCount: filteredItems.length,
                    itemBuilder: (context, index) => _buildItemCard(filteredItems[index]),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategorySelector() {
    return Container(
      height: 60,
      color: Colors.white,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: _categories.length,
        itemBuilder: (context, index) {
          final cat = _categories[index];
          final bool isActive = _activeCategory == cat;
          return Padding(
            padding: const EdgeInsets.only(right: 12, top: 10, bottom: 10),
            child: InkWell(
              onTap: () => _switchCategory(cat),
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                decoration: BoxDecoration(
                  color: isActive ? _activeCategory.color.withOpacity(0.1) : Colors.transparent,
                  border: Border.all(color: isActive ? _activeCategory.color : Colors.grey[200]!),
                  borderRadius: BorderRadius.circular(20),
                ),
                alignment: Alignment.center,
                child: Text(
                  cat.title,
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                    color: isActive ? _activeCategory.color : Colors.grey[600],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSearchBox() {
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF1F5F9))),
        child: TextField(
          onChanged: (v) => setState(() => _searchQuery = v),
          decoration: InputDecoration(
            hintText: "Search in ${_activeCategory.title}...",
            hintStyle: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF94A3B8)),
            prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFFBB0633), size: 20),
            border: InputBorder.none,
            contentPadding: const EdgeInsets.symmetric(vertical: 18),
          ),
        ),
      ),
    );
  }

  Widget _buildItemCard(Map<String, dynamic> item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFF1F5F9))),
      child: Row(
        children: [
          Expanded(
            child: Text(
              item[_activeCategory.displayKey]?.toString() ?? 'Unnamed',
              style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ),
          IconButton(icon: const Icon(Icons.edit_rounded, size: 20, color: Colors.blue), onPressed: () => _showForm(item: item)),
          IconButton(icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Colors.red), onPressed: () => _handleDelete(item)),
        ],
      ),
    );
  }

  Future<void> _handleDelete(Map<String, dynamic> item) async {
    final bool? confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm Delete'),
        content: Text('Are you sure you want to delete this ${_activeCategory.title}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('CANCEL')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('DELETE', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true) {
      try {
        await _apiService.delete('${_activeCategory.endpoint}${item['id']}/');
        _fetchData();
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Delete failed: $e')));
      }
    }
  }

  Widget _buildEmptyState() {
    return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      Icon(Icons.layers_clear_rounded, size: 64, color: Colors.grey[200]),
      const SizedBox(height: 16),
      Text('No records found', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: Colors.grey[400])),
    ]));
  }
}
