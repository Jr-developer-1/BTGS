import 'package:flutter/material.dart';

/// Model representing a navigation module
class NavigationModule {
  final String title;
  final String description;
  final IconData icon;
  final Color backgroundColor;
  final Color iconColor;
  final List<String> allowedRoles;
  final Widget Function()? destinationScreen;
  final String? permissionKey;

  NavigationModule({
    required this.title,
    required this.description,
    required this.icon,
    required this.backgroundColor,
    required this.iconColor,
    required this.allowedRoles,
    this.destinationScreen,
    this.permissionKey,
  });
}

/// Model representing a notification
class NotificationItem {
  final int id;
  final String title;
  final String message;
  final String timeAgo;
  final bool unread;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    required this.timeAgo,
    required this.unread,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id: json['id'] ?? 0,
      title: json['title'] ?? '',
      message: json['message'] ?? '',
      timeAgo: json['time_ago'] ?? '',
      unread: json['unread'] ?? false,
    );
  }
}

/// Model representing user information
class UserInfo {
  final String name;
  final String role;
  final String email;

  UserInfo({
    required this.name,
    required this.role,
    required this.email,
  });

  String get initials => name.isNotEmpty ? name[0].toUpperCase() : 'S';
  String get roleDisplay => role.toUpperCase();
}
