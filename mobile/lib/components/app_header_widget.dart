import 'package:flutter/material.dart';
import 'dart:async';
import 'package:google_fonts/google_fonts.dart';
import '../models/module_model.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';

/// Reusable app header widget with notifications and profile menu
class AppHeaderWidget extends StatefulWidget {
  final String title;
  final String username;
  final String userRole;
  final VoidCallback onLogout;
  final Function(int)? onNotificationTap;

  const AppHeaderWidget({
    super.key,
    required this.title,
    required this.username,
    required this.userRole,
    required this.onLogout,
    this.onNotificationTap,
  });

  @override
  State<AppHeaderWidget> createState() => _AppHeaderWidgetState();
}

class _AppHeaderWidgetState extends State<AppHeaderWidget> {
  final ApiService _apiService = ApiService();
  List<NotificationItem> _notifications = [];
  bool _showNotifications = false;
  bool _showProfile = false;
  bool _isLoadingNotifs = false;

  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
    // Start heartbeat timer (30s) to keep notifications in sync with web
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      if (mounted && _showNotifications) {
        _fetchNotifications();
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchNotifications() async {
    try {
      final response = await _apiService.get(ApiConstants.notifications);
      if (mounted) {
        setState(() {
          _notifications = response is List
              ? (response)
                  .map((n) => NotificationItem.fromJson(n as Map<String, dynamic>))
                  .toList()
              : [];
        });
      }
    } catch (e) {
      debugPrint("Failed to fetch notifications: $e");
    }
  }

  Future<void> _markAllRead() async {
    try {
      await _apiService.post(
        '${ApiConstants.notifications}mark-all-read/',
        body: {},
        includeAuth: true,
      );
      if (mounted) {
        setState(() {
          _notifications = _notifications
              .map((n) => NotificationItem(
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    timeAgo: n.timeAgo,
                    unread: false,
                  ))
              .toList();
        });
      }
    } catch (e) {
      debugPrint("Failed to mark notifications as read: $e");
    }
  }

  int get _unreadCount => _notifications.where((n) => n.unread).length;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Left section: Logo and Title
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.title,
                      style: GoogleFonts.interTight(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      '${widget.username} • ${widget.userRole.toUpperCase()}',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: const Color(0xFF7C1D1D),
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),

              const SizedBox(width: 16),

              // Right section: Actions
              Row(
                children: [
                  // Notifications
                  _buildNotificationButton(context),
                  const SizedBox(width: 8),

                  // Profile Menu
                  _buildProfileButton(context),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotificationButton(BuildContext context) {
    return Stack(
      children: [
        GestureDetector(
          onTap: () {
            setState(() => _showNotifications = !_showNotifications);
            setState(() => _showProfile = false);
          },
          child: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: _showNotifications ? const Color(0xFFF0F0F0) : Colors.transparent,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              Icons.notifications_outlined,
              size: 24,
              color: Colors.grey[700],
            ),
          ),
        ),
        if (_unreadCount > 0)
          Positioned(
            right: 0,
            top: 0,
            child: Container(
              padding: const EdgeInsets.all(4),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                _unreadCount.toString(),
                style: GoogleFonts.inter(
                  fontSize: 10,
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        if (_showNotifications)
          Positioned(
            right: -10,
            top: 50,
            child: _buildNotificationsDropdown(),
          ),
      ],
    );
  }

  Widget _buildNotificationsDropdown() {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 320,
        constraints: const BoxConstraints(maxHeight: 400),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.15),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Recent Notifications',
                    style: GoogleFonts.interTight(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (_notifications.isNotEmpty)
                    GestureDetector(
                      onTap: _markAllRead,
                      child: Text(
                        'Mark all as read',
                        style: GoogleFonts.inter(
                          fontSize: 11,
                          color: const Color(0xFF7C1D1D),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                ],
              ),
            ),

            const Divider(height: 0, thickness: 1),

            // Notifications List
            if (_isLoadingNotifs)
              Padding(
                padding: const EdgeInsets.all(20),
                child: CircularProgressIndicator(
                  color: const Color(0xFF7C1D1D),
                ),
              )
            else if (_notifications.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 30),
                child: Column(
                  children: [
                    Icon(
                      Icons.notifications_off_outlined,
                      size: 32,
                      color: Colors.grey[300],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'All caught up!',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Colors.grey[600],
                      ),
                    ),
                  ],
                ),
              )
            else
              Expanded(
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: _notifications.length,
                  itemBuilder: (context, index) {
                    final notif = _notifications[index];
                    return Container(
                      color: notif.unread ? Colors.orange.withOpacity(0.05) : Colors.transparent,
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  notif.title,
                                  style: GoogleFonts.inter(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.black87,
                                  ),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  notif.message,
                                  style: GoogleFonts.inter(
                                    fontSize: 11,
                                    color: Colors.grey[600],
                                  ),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  notif.timeAgo,
                                  style: GoogleFonts.inter(
                                    fontSize: 10,
                                    color: Colors.grey[500],
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (notif.unread)
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: const Color(0xFF7C1D1D),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              margin: const EdgeInsets.only(left: 8, top: 4),
                            ),
                        ],
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileButton(BuildContext context) {
    return Stack(
      children: [
        GestureDetector(
          onTap: () {
            setState(() => _showProfile = !_showProfile);
            setState(() => _showNotifications = false);
          },
          child: Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: _showProfile ? const Color(0xFF7C1D1D).withOpacity(0.1) : Colors.transparent,
              border: Border.all(
                color: _showProfile ? const Color(0xFF7C1D1D) : Colors.grey[300]!,
                width: 1.5,
              ),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Stack(
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF7C1D1D), Color(0xFFB91C1C)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Center(
                    child: Text(
                      widget.username.isNotEmpty ? widget.username[0].toUpperCase() : 'S',
                      style: GoogleFonts.interTight(
                        fontSize: 14,
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: Colors.green,
                      border: Border.all(color: Colors.white, width: 2),
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_showProfile)
          Positioned(
            right: -10,
            top: 50,
            child: _buildProfileDropdown(context),
          ),
      ],
    );
  }

  Widget _buildProfileDropdown(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: Container(
        width: 200,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.15),
              blurRadius: 15,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // User Info
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    widget.username,
                    style: GoogleFonts.interTight(
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                      color: Colors.black87,
                    ),
                  ),
                  Text(
                    widget.userRole.toUpperCase(),
                    style: GoogleFonts.inter(
                      fontSize: 11,
                      color: Colors.grey[600],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),

            const Divider(height: 0, thickness: 1),

            // Menu Items
            GestureDetector(
              onTap: () {
                setState(() => _showProfile = false);
                // Navigator.push(context, MaterialPageRoute(builder: (_) => const ProfilePage()));
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    Icon(Icons.person_outline, size: 18, color: Colors.grey[700]),
                    const SizedBox(width: 10),
                    Text(
                      'My Profile',
                      style: GoogleFonts.inter(fontSize: 12, color: Colors.black87),
                    ),
                  ],
                ),
              ),
            ),

            const Divider(height: 0, thickness: 1),

            // Logout
            GestureDetector(
              onTap: () {
                setState(() => _showProfile = false);
                widget.onLogout();
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                child: Row(
                  children: [
                    Icon(Icons.logout, size: 18, color: Colors.red[600]),
                    const SizedBox(width: 10),
                    Text(
                      'Logout',
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        color: Colors.red[600],
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
