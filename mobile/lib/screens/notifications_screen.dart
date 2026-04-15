import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../constants/api_constants.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final ApiService _apiService = ApiService();
  List<dynamic> _notifications = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchNotifications();
  }

  Future<void> _fetchNotifications() async {
    setState(() => _isLoading = true);
    try {
      final response = await _apiService.get(ApiConstants.notifications);
      if (mounted) {
        setState(() {
          if (response is Map && response.containsKey('results')) {
            _notifications = response['results'] as List<dynamic>;
          } else if (response is List) {
            _notifications = response;
          } else {
            _notifications = [];
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      debugPrint("Failed to fetch notifications: $e");
      if (mounted) setState(() => _isLoading = false);
    }
  }

  bool _isMarkingAllRead = false;
  Future<void> _markAllRead() async {
    if (_isMarkingAllRead) return;
    setState(() => _isMarkingAllRead = true);
    try {
      await _apiService.post(ApiConstants.notificationsMarkRead, body: {});
      await _fetchNotifications();
    } catch (e) {
      debugPrint("Failed to mark notifications as read: $e");
    } finally {
      if (mounted) setState(() => _isMarkingAllRead = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: Navigator.canPop(context) 
          ? IconButton(
              icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.black, size: 20),
              onPressed: () => Navigator.pop(context),
            )
          : null,
        title: Text(
          'Alerts',
          style: GoogleFonts.interTight(
            color: Colors.black,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
        actions: [
          if (_notifications.isNotEmpty)
            TextButton(
              onPressed: _markAllRead,
              child: Text(
                'Mark all read',
                style: GoogleFonts.inter(
                  color: const Color(0xFF7C1D1D),
                  fontWeight: FontWeight.w600,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF7C1D1D)))
          : RefreshIndicator(
              onRefresh: _fetchNotifications,
              color: const Color(0xFF7C1D1D),
              child: _notifications.isEmpty
                  ? _buildEmptyState()
                  : ListView.builder(
                      padding: const EdgeInsets.all(20),
                      itemCount: _notifications.length,
                      itemBuilder: (context, index) {
                        final notification = _notifications[index];
                        return _buildNotificationItem(notification);
                      },
                    ),
            ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.notifications_none_rounded, size: 64, color: Colors.grey.withOpacity(0.5)),
          const SizedBox(height: 16),
          Text(
            'All caught up!',
            style: GoogleFonts.interTight(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.grey,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'No new notifications to show.',
            style: GoogleFonts.inter(color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationItem(dynamic n) {
    final bool isUnread = n['unread'] ?? false;
    return InkWell(
      onTap: () {
        if (isUnread) {
          // Could implement individual mark as read here
        }
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: isUnread ? Border.all(color: const Color(0xFF7C1D1D).withOpacity(0.3), width: 1) : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.02),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isUnread 
                    ? const Color(0xFF7C1D1D).withOpacity(0.1)
                    : Colors.grey.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isUnread ? Icons.notifications_active_outlined : Icons.notifications_none_rounded,
                color: isUnread ? const Color(0xFF7C1D1D) : Colors.grey,
                size: 20,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          n['title'] ?? 'Notification',
                          style: GoogleFonts.interTight(
                            fontWeight: FontWeight.bold, 
                            fontSize: 16,
                            color: isUnread ? Colors.black : Colors.black54,
                          ),
                        ),
                      ),
                      if (isUnread)
                        Container(
                          width: 8,
                          height: 8,
                          decoration: const BoxDecoration(
                            color: Color(0xFF7C1D1D),
                            shape: BoxShape.circle,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    n['message'] ?? '',
                    style: GoogleFonts.inter(
                      fontSize: 13, 
                      color: isUnread ? Colors.black87 : Colors.black45,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    n['time_ago'] ?? 'Just now',
                    style: GoogleFonts.inter(
                      fontSize: 11, 
                      color: Colors.black26, 
                      fontWeight: FontWeight.w500,
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
}
