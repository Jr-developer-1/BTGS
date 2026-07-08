import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../services/trip_service.dart';
import 'policy_center_screen.dart';
import 'location_codes_screen.dart';
import '../constants/api_constants.dart';

class HelpSupportScreen extends StatefulWidget {
  const HelpSupportScreen({super.key});

  @override
  State<HelpSupportScreen> createState() => _HelpSupportScreenState();
}

class _HelpSupportScreenState extends State<HelpSupportScreen> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _chatController = TextEditingController();
  final ScrollController _chatScrollController = ScrollController();
  final TripService _tripService = TripService();
  
  bool _isChatOpen = false;
  String _appVersion = 'v${ApiConstants.appVersion} (${ApiConstants.buildNumber})';

  @override
  void initState() {
    super.initState();
    _loadAppVersion();
  }

  Future<void> _loadAppVersion() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() {
          _appVersion = 'v${packageInfo.version} (${packageInfo.buildNumber})';
        });
      }
    } catch (e) {
      debugPrint('Error loading app version: $e');
    }
  }

  final List<Map<String, String>> _messages = [
    {'sender': 'bot', 'text': 'Hi there! I am your TGS Virtual Support Assistant. How can I help you today?'}
  ];

  final List<Map<String, dynamic>> _faqs = [
    {
      'category': 'Getting Started',
      'icon': Icons.description_outlined,
      'questions': [
        'How do I create a new trip request?',
        'What is the approval workflow?',
        'How to set up my profile properly?'
      ]
    },
    {
      'category': 'Expenses & Claims',
      'icon': Icons.payments_outlined,
      'questions': [
        'How to claim mileage for local travel?',
        'What receipts are mandatory for reimbursement?',
        'How long does it take for settlement?'
      ]
    },
    {
      'category': 'Guest House Booking',
      'icon': Icons.business_outlined,
      'questions': [
        'How to book a room in a company guest house?',
        'Can I cancel a booking after approval?',
        'What are the guest house rules?'
      ]
    }
  ];

  final List<Map<String, dynamic>> _contactMethods = [
    {
      'title': 'Technical Support',
      'description': 'For issues with the application or login problems.',
      'email': 'it.support@tgs.com',
      'phone': '+91 800-456-7890',
      'icon': Icons.settings_rounded,
    },
    {
      'title': 'HR & Policy',
      'description': 'For queries related to travel policy and eligibility.',
      'email': 'hr.travel@tgs.com',
      'phone': '+91 800-456-7891',
      'icon': Icons.person_rounded,
    },
    {
      'title': 'Finance & Claims',
      'description': 'For questions about payments and settlements.',
      'email': 'finance.claims@tgs.com',
      'phone': '+91 800-456-7892',
      'icon': Icons.account_balance_wallet_rounded,
    }
  ];

  void _handleSendMessage() {
    if (_chatController.text.trim().isEmpty) return;

    final userText = _chatController.text.trim();
    setState(() {
      _messages.add({'sender': 'user', 'text': userText});
      _chatController.clear();
    });

    _scrollToBottom();

    // Bot Response Logic (Mirroring Web)
    Future.delayed(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      
      final inputLower = userText.toLowerCase();
      String reply = "I'm a virtual assistant! I couldn't find an exact match for your question. You can submit a ticket to it.support@tgs.com if you need a human touch.";

      if (inputLower.contains('policy') || inputLower.contains('policies')) {
        reply = "All company policies can be found in the Policy Center. Go to the dashboard and navigate to 'Policy'!";
      } else if (inputLower.contains('expense') || inputLower.contains('claim')) {
        reply = "To file an expense, click on 'Expenses & Claims' in your dashboard.";
      } else if (inputLower.contains('advance')) {
        reply = "Need cash beforehand? Check out the 'Travel Advance' page to raise a request.";
      } else if (inputLower.contains('approval') || inputLower.contains('approve')) {
        reply = "You can view pending approvals in the 'Approval Inbox'.";
      } else if (inputLower.contains('booking') || inputLower.contains('guest house')) {
        reply = "You can book accommodations directly from the 'Guest House Booking' module.";
      } else if (inputLower.contains('hi') || inputLower.contains('hello')) {
        reply = "Hello! What can I assist you with regarding the Travel Governance System?";
      }

      setState(() {
        _messages.add({'sender': 'bot', 'text': reply});
      });
      _scrollToBottom();
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_chatScrollController.hasClients) {
        _chatScrollController.animateTo(
          _chatScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _downloadTemplate() async {
    try {
      final bytes = await _tripService.downloadBulkTemplate();
      final dir = await getApplicationDocumentsDirectory();
      final file = File('${dir.path}/travel_activities_template.xlsx');
      await file.writeAsBytes(bytes);
      await OpenFilex.open(file.path);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to download template'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: const Color(0xFF700B34),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Help & Support',
          style: GoogleFonts.plusJakartaSans(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
        centerTitle: true,
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            child: Column(
              children: [
                _buildHero(),
                Padding(
                  padding: const EdgeInsets.all(20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildQuickActions(),
                      const SizedBox(height: 32),
                      _buildFAQSection(),
                      const SizedBox(height: 32),
                      _buildContactSection(),
                      const SizedBox(height: 40),
                      _buildFooter(),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_isChatOpen) _buildChatWidget(),
        ],
      ),
    );
  }

  Widget _buildHero() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(24, 40, 24, 50),
      decoration: const BoxDecoration(
        color: Color(0xFF700B34),
        borderRadius: BorderRadius.only(
          bottomLeft: Radius.circular(40),
          bottomRight: Radius.circular(40),
        ),
      ),
      child: Column(
        children: [
          Text(
            'How can we help you?',
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: Colors.white,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Search our knowledge base or contact our support teams directly.',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 14,
              color: Colors.white.withOpacity(0.8),
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 32),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 20, offset: const Offset(0, 10))
              ],
            ),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Search for articles, guides, policies...',
                hintStyle: GoogleFonts.inter(fontSize: 14, color: const Color(0xFF94A3B8)),
                prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF700B34)),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(vertical: 16),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Column(
      children: [
        Row(
          children: [
            _buildActionCard(Icons.article_rounded, 'User Guides', 'Documentation', () {
              Navigator.push(context, MaterialPageRoute(builder: (context) => const PolicyCenterScreen()));
            }),
            const SizedBox(width: 12),
            _buildActionCard(Icons.forum_rounded, 'Live Chat', 'Start Support', () => setState(() => _isChatOpen = true)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildActionCard(Icons.map_rounded, 'Location Codes', 'View ISO', () {
              Navigator.push(context, MaterialPageRoute(builder: (context) => const LocationCodesScreen()));
            }),
            const SizedBox(width: 12),
            _buildActionCard(Icons.table_view_rounded, 'Activity Template', 'Download Excel', _downloadTemplate),
          ],
        ),
      ],
    );
  }

  Widget _buildActionCard(IconData icon, String title, String sub, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 10),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFF1F5F9)),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
          ),
          child: Column(
            children: [
              Icon(icon, color: const Color(0xFF700B34), size: 28),
              const SizedBox(height: 12),
              Text(title, textAlign: TextAlign.center, style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
              const SizedBox(height: 4),
              Text(sub, textAlign: TextAlign.center, style: GoogleFonts.inter(fontSize: 9, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFAQSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Frequently Asked Questions', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
            Text('View All', style: GoogleFonts.plusJakartaSans(fontSize: 12, fontWeight: FontWeight.w700, color: const Color(0xFF700B34))),
          ],
        ),
        const SizedBox(height: 16),
        ..._faqs.map((faq) => _buildFAQGroup(faq)).toList(),
      ],
    );
  }

  Widget _buildFAQGroup(Map<String, dynamic> faq) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: ExpansionTile(
        leading: Icon(faq['icon'], color: const Color(0xFF700B34), size: 20),
        title: Text(faq['category'], style: GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A))),
        children: (faq['questions'] as List).map((q) => _buildFAQItem(q)).toList(),
      ),
    );
  }

  Widget _buildFAQItem(String question) {
    return ListTile(
      dense: true,
      title: Text(question, style: GoogleFonts.inter(fontSize: 13, color: const Color(0xFF475569), fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right_rounded, size: 16, color: Color(0xFFCBD5E1)),
      onTap: () {},
    );
  }

  Widget _buildContactSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Contact Support Teams', style: GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
        const SizedBox(height: 16),
        ..._contactMethods.map((method) => _buildContactCard(method)).toList(),
      ],
    );
  }

  Widget _buildContactCard(Map<String, dynamic> method) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(method['icon'], color: const Color(0xFF700B34), size: 28),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(method['title'], style: GoogleFonts.plusJakartaSans(fontSize: 16, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                    const SizedBox(height: 2),
                    Text(method['description'], style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF64748B), fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          _contactItem(Icons.mail_rounded, method['email']),
          const SizedBox(height: 8),
          _contactItem(Icons.phone_rounded, method['phone']),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 14),
                elevation: 0,
              ),
              child: Text('Send Message', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 13)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _contactItem(IconData icon, String value) {
    return Row(
      children: [
        Icon(icon, size: 14, color: const Color(0xFF94A3B8)),
        const SizedBox(width: 10),
        Text(value, style: GoogleFonts.inter(fontSize: 12, color: const Color(0xFF475569), fontWeight: FontWeight.w600)),
      ],
    );
  }

  Widget _buildFooter() {
    return Center(
      child: Column(
        children: [
          Text('© 2026 TGS Governance. All rights reserved.', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
          if (_appVersion.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(_appVersion, style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
          ],
          const SizedBox(height: 8),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('System Status:', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF94A3B8))),
              const SizedBox(width: 6),
              const Icon(Icons.circle, size: 8, color: Color(0xFF10B981)),
              const SizedBox(width: 4),
              Text('Operational', style: GoogleFonts.inter(fontSize: 11, color: const Color(0xFF10B981), fontWeight: FontWeight.bold)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildChatWidget() {
    return Positioned.fill(
      child: Container(
        color: Colors.black54,
        padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
        child: Column(
          children: [
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                      decoration: const BoxDecoration(
                        color: Color(0xFF700B34),
                        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.forum_rounded, color: Colors.white, size: 20),
                          const SizedBox(width: 12),
                          Text('TGS Support', style: GoogleFonts.plusJakartaSans(color: Colors.white, fontWeight: FontWeight.w800)),
                          const Spacer(),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Colors.white),
                            onPressed: () => setState(() => _isChatOpen = false),
                          ),
                        ],
                      ),
                    ),
                    Expanded(
                      child: ListView.builder(
                        controller: _chatScrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (context, index) {
                          final msg = _messages[index];
                          final isBot = msg['sender'] == 'bot';
                          return Align(
                            alignment: isBot ? Alignment.centerLeft : Alignment.centerRight,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.7),
                              decoration: BoxDecoration(
                                color: isBot ? const Color(0xFFF1F5F9) : const Color(0xFF700B34),
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(16),
                                  topRight: const Radius.circular(16),
                                  bottomLeft: Radius.circular(isBot ? 4 : 16),
                                  bottomRight: Radius.circular(isBot ? 16 : 4),
                                ),
                              ),
                              child: Text(
                                msg['text']!,
                                style: GoogleFonts.inter(
                                  fontSize: 13,
                                  color: isBot ? const Color(0xFF0F172A) : Colors.white,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: const BoxDecoration(
                        border: Border(top: BorderSide(color: Color(0xFFF1F5F9))),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _chatController,
                              style: GoogleFonts.inter(fontSize: 14),
                              decoration: InputDecoration(
                                hintText: 'Type your message...',
                                border: InputBorder.none,
                                hintStyle: GoogleFonts.inter(color: const Color(0xFF94A3B8)),
                              ),
                              onSubmitted: (_) => _handleSendMessage(),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.send_rounded, color: Color(0xFF700B34)),
                            onPressed: _handleSendMessage,
                          ),
                        ],
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
