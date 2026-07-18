import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../core/auth_service.dart';
import '../env.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user;
    final name = user?['name'] ?? 'Student';
    final email = user?['email'] ?? '';
    final dept = user?['department'] ?? '';
    final sem = user?['semester']?.toString() ?? '';
    final regNo = user?['register_number'] ?? '';

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Profile & Menu', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: ListView(
        padding: EdgeInsets.all(16),
        children: [
          // Avatar card
          Container(
            padding: EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,
              border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: const Color(0xFFEFF6FF),
                  child: Text(
                    name.isNotEmpty ? name[0].toUpperCase() : 'S',
                    style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: Color(0xFF2563EB)),
                  ),
                ),
                SizedBox(height: 12),
                Text(name, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A))),
                SizedBox(height: 4),
                Text(email, style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
                SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  children: [
                    if (dept.isNotEmpty) _chip(dept),
                    if (sem.isNotEmpty) _chip('Sem $sem'),
                  ],
                ),
              ],
            ),
          ),

          SizedBox(height: 20),

          // Features Menu Section
          _Section(title: 'Portal Menu', items: [
            ListTile(
              leading: Icon(Icons.settings_outlined, color: Color(0xFF2563EB)),
              title: Text('Settings & Configuration', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              subtitle: Text('Target, notifications, profile, app lock', style: TextStyle(fontSize: 11)),
              trailing: Icon(Icons.chevron_right),
              onTap: () => context.push('/settings'),
            ),
          ]),

          SizedBox(height: 16),

          // Details Section
          _Section(title: 'Account Details', items: [
            _InfoRow(label: 'Register Number', value: regNo.isEmpty ? '—' : regNo),
            _InfoRow(label: 'Department', value: dept.isEmpty ? '—' : dept),
            _InfoRow(label: 'Semester', value: sem.isEmpty ? '—' : 'Semester $sem'),
          ]),

          SizedBox(height: 16),

          // Legal Section
          _Section(title: 'Legal', items: [
            ListTile(
              title: Text('Privacy Policy', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              trailing: Icon(Icons.keyboard_arrow_right, size: 18),
              onTap: () => context.push('/privacy-policy'),
            ),
            ListTile(
              title: Text('Terms & Conditions', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
              trailing: Icon(Icons.keyboard_arrow_right, size: 18),
              onTap: () => context.push('/terms'),
            ),
          ]),

          SizedBox(height: 24),

          // Logout
          SizedBox(
            width: double.infinity,
            height: 50,
            child: OutlinedButton.icon(
              onPressed: () => _confirmLogout(context),
              icon: Icon(Icons.logout_rounded, size: 18, color: Color(0xFFEF4444)),
              label: Text('Sign Out', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700)),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: Color(0xFFFCA5A5)),
                shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
              ),
            ),
          ),

          SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _chip(String text) => Container(
        padding: EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: const BoxDecoration(
          color: Color(0xFFEFF6FF),
        ),
        child: Text(text, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF2563EB))),
      );

  Future<void> _confirmLogout(BuildContext context) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: Text('Sign Out', style: TextStyle(fontWeight: FontWeight.w800)),
        content: Text('Are you sure you want to sign out of Trackify?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogCtx, false), child: Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx, true),
            child: Text('Sign Out', style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirm == true && context.mounted) {
      await context.read<AuthService>().logout();
      if (context.mounted) {
        context.go('/login');
      }
    }
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> items;
  const _Section({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(left: 4, bottom: 8),
          child: Text(title.toUpperCase(),
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF94A3B8))),
        ),
        Container(
          decoration: BoxDecoration(
            color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,
            border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
          ),
          child: Column(children: items),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _InfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 16, vertical: 13),
      decoration: const BoxDecoration(
        border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Row(
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A))),
        ],
      ),
    );
  }
}