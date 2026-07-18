import 'package:flutter/material.dart';

/// Generic in-app legal document viewer.
/// Pass [title] and [sections] to render Privacy Policy or T&C.
class LegalScreen extends StatelessWidget {
  final String title;
  final String badge;
  final List<LegalSection> sections;
  final String? highlightNote;

  const LegalScreen({
    super.key,
    required this.title,
    required this.badge,
    required this.sections,
    this.highlightNote,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text(title, style: TextStyle(fontWeight: FontWeight.w800)),
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        foregroundColor: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A),
        elevation: 0,
        scrolledUnderElevation: 1,
      ),
      body: ListView(
        padding: EdgeInsets.fromLTRB(16, 20, 16, 40),
        children: [
          // Badge
          Container(
            padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              border: Border.all(color: const Color(0xFFCBD5E1)),
              borderRadius: BorderRadius.zero,
            ),
            child: Text(
              badge.toUpperCase(),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.8,
                color: Color(0xFF64748B),
              ),
            ),
          ),
          SizedBox(height: 12),
          Text(
            title,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A),
              letterSpacing: -0.5,
            ),
          ),
          SizedBox(height: 4),
          Text(
            'Last updated: July 18, 2026  ·  Effective immediately',
            style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
          ),

          if (highlightNote != null) ...[
            SizedBox(height: 20),
            Container(
              padding: EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFEFF6FF),
                border: Border(left: BorderSide(color: Color(0xFF2563EB), width: 3)),
                borderRadius: BorderRadius.zero,
              ),
              child: Text(
                highlightNote!,
                style: TextStyle(fontSize: 13, color: Color(0xFF1E40AF), height: 1.5),
              ),
            ),
          ],

          SizedBox(height: 24),

          ...sections.map((s) => _SectionWidget(section: s)),
        ],
      ),
    );
  }
}

class _SectionWidget extends StatelessWidget {
  final LegalSection section;
  const _SectionWidget({required this.section});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                Text(
                  section.title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A),
                  ),
                ),
              ],
            ),
          ),
          Container(height: 1, color: const Color(0xFFE2E8F0)),
          SizedBox(height: 10),
          if (section.body != null)
            Text(
              section.body!,
              style: TextStyle(
                fontSize: 13.5,
                color: Color(0xFF475569),
                height: 1.75,
              ),
            ),
          if (section.bullets != null) ...[
            if (section.body != null) SizedBox(height: 8),
            ...section.bullets!.map(
              (b) => Padding(
                padding: EdgeInsets.only(bottom: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Padding(
                      padding: EdgeInsets.only(top: 6, right: 10),
                      child: CircleAvatar(
                        radius: 3,
                        backgroundColor: Color(0xFF2563EB),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        b,
                        style: TextStyle(
                          fontSize: 13.5,
                          color: Color(0xFF475569),
                          height: 1.7,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class LegalSection {
  final String title;
  final String? body;
  final List<String>? bullets;

  const LegalSection({required this.title, this.body, this.bullets});
}