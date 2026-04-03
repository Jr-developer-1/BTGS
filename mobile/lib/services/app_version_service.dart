import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../constants/api_constants.dart';

class AppVersionService {
  static Future<bool> checkVersionAndPrompt(BuildContext context) async {
    try {
      final String apiUrl = '${ApiConstants.baseUrl}/api/app-version';
      final response = await http.get(Uri.parse(apiUrl)).timeout(const Duration(seconds: 10));
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        
        final latestVersion = data['latest_version'];
        final minVersion = data['minimum_supported_version'];
        final updateType = data['update_type']; // 'optional' or 'force'
        final message = data['message'] ?? 'A new version of the app is available.';
        final updateUrl = data['update_url'];
        
        PackageInfo packageInfo = await PackageInfo.fromPlatform();
        String currentVersion = packageInfo.version;
        
        bool isForceUpdate = _isVersionLessThan(currentVersion, minVersion);
        bool isOptionalUpdate = !isForceUpdate && _isVersionLessThan(currentVersion, latestVersion);

        if (isForceUpdate) {
          _showUpdateDialog(context, message, updateUrl, true);
          return false; // Cannot proceed
        } else if (isOptionalUpdate && updateType == 'optional') {
           await _showUpdateDialog(context, message, updateUrl, false);
        } else if (isOptionalUpdate && updateType == 'force') {
           _showUpdateDialog(context, message, updateUrl, true);
           return false; // Cannot proceed
        }
      }
    } catch (e) {
      print('Failed to check app version: $e');
      // If version check fails, allow normal app usage to not brick the app offline
    }
    return true; // Can proceed
  }

  // Returns true if v1 < v2
  static bool _isVersionLessThan(String v1, String v2) {
    List<int> v1Parts = v1.split('.').map((e) => int.tryParse(e) ?? 0).toList();
    List<int> v2Parts = v2.split('.').map((e) => int.tryParse(e) ?? 0).toList();

    for (int i = 0; i < 3; i++) {
      int p1 = i < v1Parts.length ? v1Parts[i] : 0;
      int p2 = i < v2Parts.length ? v2Parts[i] : 0;
      if (p1 < p2) return true;
      if (p1 > p2) return false;
    }
    return false; // Equal
  }

  static Future<void> _showUpdateDialog(BuildContext context, String message, String updateUrl, bool isForce) {
    return showDialog(
      context: context,
      barrierDismissible: !isForce,
      builder: (BuildContext context) {
        return WillPopScope(
          onWillPop: () async => !isForce,
          child: AlertDialog(
            title: Text(isForce ? 'Update Required' : 'Update Available'),
            content: Text(message),
            actions: <Widget>[
              if (!isForce)
                TextButton(
                  child: const Text('Skip'),
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                ),
              ElevatedButton(
                child: const Text('Update'),
                onPressed: () async {
                  if (updateUrl != null && updateUrl.isNotEmpty) {
                    final uri = Uri.parse(updateUrl);
                    if (await canLaunchUrl(uri)) {
                      await launchUrl(uri, mode: LaunchMode.externalApplication);
                    } else {
                      print('Could not launch \$updateUrl');
                    }
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
