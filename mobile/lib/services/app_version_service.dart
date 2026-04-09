import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:install_plugin_v3/install_plugin_v3.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
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
      builder: (BuildContext dialogContext) {
        bool isDownloading = false;
        double downloadProgress = 0.0;
        String downloadStatus = '';

        return StatefulBuilder(
          builder: (context, setState) {
            return WillPopScope(
              onWillPop: () async => !isForce && !isDownloading,
              child: AlertDialog(
                title: Text(isForce ? 'Update Required' : 'Update Available'),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(message),
                    if (isDownloading) ...[
                      const SizedBox(height: 16),
                      LinearProgressIndicator(value: downloadProgress),
                      const SizedBox(height: 8),
                      Text(downloadStatus, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    ]
                  ],
                ),
                actions: <Widget>[
                  if (!isForce && !isDownloading)
                    TextButton(
                      child: const Text('Skip'),
                      onPressed: () {
                        Navigator.of(dialogContext).pop();
                      },
                    ),
                  ElevatedButton(
                    onPressed: isDownloading ? null : () async {
                      if (updateUrl == null || updateUrl.isEmpty) {
                        return;
                      }

                      // If it's a Play Store link, handle normally via browser
                      if (!updateUrl.toLowerCase().endsWith('.apk')) {
                        final uri = Uri.parse(updateUrl);
                        if (await canLaunchUrl(uri)) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        } else {
                          print('Could not launch $updateUrl');
                        }
                        return;
                      }

                      // Handle Direct APK Download
                      setState(() {
                        isDownloading = true;
                        downloadStatus = 'Starting download...';
                        downloadProgress = 0.0;
                      });

                      try {
                        var request = http.Request('GET', Uri.parse(updateUrl));
                        var response = await http.Client().send(request);
                        
                        var contentLength = response.contentLength;
                        var bytes = <int>[];
                        
                        var dir = await getTemporaryDirectory();
                        var filePath = '${dir.path}/app_update.apk';
                        var file = File(filePath);

                        response.stream.listen(
                          (List<int> chunk) {
                            bytes.addAll(chunk);
                            if (contentLength != null && contentLength > 0) {
                              setState(() {
                                downloadProgress = bytes.length / contentLength;
                                downloadStatus = 'Downloading... ${(downloadProgress * 100).toStringAsFixed(1)}%';
                              });
                            } else {
                              setState(() {
                                downloadStatus = 'Downloading... ${(bytes.length / 1024 / 1024).toStringAsFixed(2)} MB';
                              });
                            }
                          },
                          onDone: () async {
                            await file.writeAsBytes(bytes);
                            setState(() {
                              downloadStatus = 'Launching Installer...';
                            });
                            
                            // Ask Android to explicitly launch Package Installer
                            try {
                              final packageInfo = await PackageInfo.fromPlatform();
                              await InstallPlugin.installApk(filePath, appId: packageInfo.packageName);
                              // Reset state regardless so user isn't stuck forever
                              setState(() {
                                isDownloading = false;
                                downloadStatus = 'Tap Update to try again';
                              });
                            } catch (e) {
                              setState(() {
                                isDownloading = false;
                                downloadStatus = 'Failed: $e';
                              });
                            }
                          },
                          onError: (e) {
                             setState(() {
                                isDownloading = false;
                                downloadStatus = 'Download Error: $e';
                             });
                          },
                          cancelOnError: true,
                        );
                      } catch (e) {
                        setState(() {
                          isDownloading = false;
                          downloadStatus = 'Update Failed';
                        });
                        print('Download error: $e');
                      }
                    },
                    child: Text(isDownloading ? 'Please wait...' : 'Update'),
                  ),
                ],
              ),
            );
          }
        );
      },
    );
  }
}
