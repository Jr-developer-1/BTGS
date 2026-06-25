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
  final bool enabled;
  final String? hint;

  const SearchableDropdown({
    super.key,
    required this.label,
    this.value,
    this.initialOptions,
    required this.onChanged,
    this.icon,
    this.isLocation = false,
    this.enabled = true,
    this.hint,
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

  bool _matchesSearch(String option, String query) {
    final normalizedOption = option.toLowerCase();
    final normalizedQuery = query.toLowerCase();
    if (normalizedOption.contains(normalizedQuery)) return true;

    final words = normalizedOption.split(RegExp(r'[^a-z0-9]+'));
    for (final word in words) {
      if (word.startsWith(normalizedQuery)) return true;
    }

    if (normalizedQuery.length <= 3) {
      var i = 0;
      for (var char in normalizedQuery.split('')) {
        i = normalizedOption.indexOf(char, i);
        if (i == -1) return false;
        i += 1;
      }
      return true;
    }

    return false;
  }

  List<String> _filterOptions(List<String> options, String query) {
    if (query.isEmpty) return options;
    return options
        .where((opt) => _matchesSearch(opt, query))
        .toList()
        .cast<String>();
  }

  void _onSearchChanged(String query, Function setModalState) {
    if (_debounce?.isActive ?? false) _debounce!.cancel();

    final localFiltered = widget.initialOptions != null
        ? _filterOptions(widget.initialOptions ?? [], query)
        : <String>[];

    if (query.isNotEmpty) {
      setState(() => _options = localFiltered);
      setModalState(() {});
    }

    _debounce = Timer(const Duration(milliseconds: 200), () async {
      if (query.length < 2) {
        if (mounted) {
          setState(() => _options = widget.initialOptions ?? []);
          setModalState(() {});
        }
        return;
      }

      if (widget.isLocation) {
        if (mounted) {
          setState(() => _isLoading = true);
          setModalState(() {});
        }
        final results = await _masterService.searchLocations(query);
        final formatted = results.map((e) => _masterService.formatLocation(e)).toList();

        if (mounted) {
          setState(() {
            if (formatted.isNotEmpty) {
              _options = formatted.cast<String>();
            } else if (localFiltered.isNotEmpty) {
              _options = localFiltered;
            } else {
              _options = <String>[];
            }
            _isLoading = false;
          });
          setModalState(() {});
        }
      } else {
        if (mounted) {
          setState(() {
            _options = _filterOptions(widget.initialOptions ?? [], query);
            _isLoading = false;
          });
          setModalState(() {});
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
            color: const Color(0xFF94A3B8),
            letterSpacing: 1,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
        const SizedBox(height: 6),
        GestureDetector(
          onTap: widget.enabled ? () => _showSearchDialog(context) : null,
          child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            decoration: BoxDecoration(
              color: widget.enabled ? const Color(0xFFF0FDFA) : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFCCFBF1)),
            ),
            child: Row(
              children: [
                if (widget.icon != null) ...[
                  Icon(widget.icon, size: 16, color: const Color(0xFF0D9488)),
                  const SizedBox(width: 10),
                ],
                Expanded(
                  child: Text(
                    widget.value?.isEmpty ?? true ? (widget.hint ?? 'Select ${widget.label}') : widget.value!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: widget.value?.isEmpty ?? true ? Colors.grey : Colors.black87,
                    ),
                  ),
                ),
                const Icon(Icons.keyboard_arrow_down_rounded, size: 20, color: Color(0xFF0D9488)),
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
                    _onSearchChanged(val, setModalState);
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
                    child: ListView(
                      children: [
                        if (_searchController.text.isNotEmpty)
                          ListTile(
                            leading: const Icon(Icons.edit_note_rounded, color: Color(0xFF0284C7)),
                            title: Text(
                              'Use manual entry: "${_searchController.text}"',
                              style: GoogleFonts.plusJakartaSans(
                                color: const Color(0xFF0284C7),
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                            onTap: () {
                              widget.onChanged(_searchController.text);
                              Navigator.pop(context);
                            },
                          ),
                        ..._options.map((option) => ListTile(
                          title: Text(
                            option,
                            style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600),
                          ),
                          onTap: () {
                            widget.onChanged(option);
                            Navigator.pop(context);
                          },
                        )).toList(),
                      ],
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
