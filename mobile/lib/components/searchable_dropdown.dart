import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:async';
import '../services/master_service.dart';

class SearchableDropdown extends StatefulWidget {
  final String label;
  final String? value;
  final List<String>? initialOptions;
  final Function(String) onChanged;
  final IconData? icon;
  final bool isLocation;

  const SearchableDropdown({
    super.key,
    required this.label,
    this.value,
    this.initialOptions,
    required this.onChanged,
    this.icon,
    this.isLocation = false,
  });

  @override
  _SearchableDropdownState createState() => _SearchableDropdownState();
}

class _SearchableDropdownState extends State<SearchableDropdown> {
  final MasterService _masterService = MasterService();
  final TextEditingController _searchController = TextEditingController();
  List<String> _options = [];
  bool _isLoading = false;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _options = widget.initialOptions ?? [];
    if (widget.value != null && widget.value!.isNotEmpty) {
      _searchController.text = widget.value!;
    }
  }

  @override
  void didUpdateWidget(SearchableDropdown oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialOptions != oldWidget.initialOptions) {
      setState(() {
        _options = widget.initialOptions ?? [];
      });
    }
  }

  void _onSearchChanged(String query) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();
    _debounce = Timer(const Duration(milliseconds: 500), () async {
      if (query.length < 2) {
        if (mounted) setState(() => _options = widget.initialOptions ?? []);
        return;
      }

      if (widget.isLocation) {
        if (mounted) setState(() => _isLoading = true);
        final results = await _masterService.searchLocations(query);
        if (mounted) {
          setState(() {
            _options = results.map((e) => e['name']?.toString() ?? '').toList();
            _isLoading = false;
          });
        }
      } else {
        // Simple local filtering
        if (mounted) {
          setState(() {
            _options = (widget.initialOptions ?? [])
                .where((opt) => opt.toLowerCase().contains(query.toLowerCase()))
                .toList();
          });
        }
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Colors.grey[400],
            letterSpacing: 0.5,
          ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: () => _showSearchDialog(context),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
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
                if (widget.icon != null) ...[
                  Icon(widget.icon, size: 18, color: Colors.blue),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: Text(
                    widget.value?.isEmpty ?? true ? 'Select ${widget.label}' : widget.value!,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: widget.value?.isEmpty ?? true ? Colors.grey : Colors.black87,
                    ),
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, color: Colors.grey),
              ],
            ),
          ),
        ),
      ],
    );
  }

  void _showSearchDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            height: MediaQuery.of(context).size.height * 0.7,
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
            ),
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 24),
                  decoration: BoxDecoration(
                    color: Colors.grey[300],
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (val) {
                    _onSearchChanged(val);
                    // Update modal state to show loader/results
                    Future.delayed(const Duration(milliseconds: 600), () {
                      if (mounted) setModalState(() {});
                    });
                  },
                  decoration: InputDecoration(
                    hintText: 'Search ${widget.label}...',
                    prefixIcon: const Icon(Icons.search),
                    filled: true,
                    fillColor: Colors.grey[100],
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(16),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_isLoading)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  )
                else
                  Expanded(
                    child: ListView.builder(
                      itemCount: _options.length,
                      itemBuilder: (context, index) {
                        return ListTile(
                          title: Text(
                            _options[index],
                            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600),
                          ),
                          onTap: () {
                            widget.onChanged(_options[index]);
                            Navigator.pop(context);
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}
