import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../core/auth_service.dart';
import '../core/api_client.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;
  String? _errorMsg;
  String? _errorDetails;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() {
      _loading = true;
      _errorMsg = null;
      _errorDetails = null;
    });
    final res = await ApiClient.get('/api/attendance/stats');
    if (mounted) {
      setState(() {
        if (res['success'] == true) {
          _stats = res['stats'];
        } else {
          _stats = null;
          _errorMsg = res['message'] ?? 'Failed to load statistics';
          _errorDetails = res['error_details'] ?? ApiClient.lastError;
        }
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user;
    final name = user?['name'] ?? 'Student';
    final overall = _stats?['overallPercentage'] ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        onRefresh: _loadStats,
        color: const Color(0xFF2563EB),
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverAppBar(
              pinned: true,
              backgroundColor: Colors.white,
              title: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Good ${_greeting()}, 👋', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
                  Text(name.split(' ').first, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                ],
              ),
              actions: [
                Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: CircleAvatar(
                    backgroundColor: const Color(0xFFEFF6FF),
                    radius: 18,
                    child: Text(
                      name.isNotEmpty ? name[0].toUpperCase() : 'S',
                      style: const TextStyle(color: Color(0xFF2563EB), fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
            SliverPadding(
              padding: const EdgeInsets.all(16),
              sliver: SliverList(
                delegate: SliverChildListDelegate([
                  // Overall attendance card
                  if (!_loading && _stats == null) ...[
                    _buildErrorCard(),
                    const SizedBox(height: 16),
                  ] else ...[
                    _OverallCard(percentage: overall is num ? overall.toDouble() : 0.0, loading: _loading),
                    const SizedBox(height: 16),
                  ],

                  // Quick stats row
                  if (!_loading && _stats != null) ...[
                    Row(
                      children: [
                        Expanded(child: _StatCard(label: 'Present', value: '${_stats!['totalPresent'] ?? 0}', color: const Color(0xFF16A34A), icon: Icons.check_circle_outline_rounded)),
                        const SizedBox(width: 12),
                        Expanded(child: _StatCard(label: 'Absent', value: '${_stats!['totalAbsent'] ?? 0}', color: const Color(0xFFEF4444), icon: Icons.cancel_outlined)),
                        const SizedBox(width: 12),
                        Expanded(child: _StatCard(label: 'On Duty', value: '${_stats!['totalOD'] ?? 0}', color: const Color(0xFF2563EB), icon: Icons.work_outline_rounded)),
                      ],
                    ),
                    const SizedBox(height: 20),
                  ],

                  if (_loading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),

                  // Quick Action Cards
                  const Text('QUICK ACTIONS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF94A3B8))),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: _ActionCard(
                          title: 'Log Attendance',
                          desc: 'Update today\'s classes',
                          icon: Icons.edit_calendar_rounded,
                          color: const Color(0xFF2563EB),
                          onTap: () => context.go('/attendance'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _ActionCard(
                          title: 'Predictor',
                          desc: 'Simulate target goal',
                          icon: Icons.calculate_outlined,
                          color: const Color(0xFF16A34A),
                          onTap: () => context.go('/calculator'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFCA5A5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _errorMsg ?? 'Failed to load statistics',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF991B1B), fontSize: 13),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Check your network connection. If the issue persists, copy the error details below.',
            style: TextStyle(color: Color(0xFFB91C1C), fontSize: 11.5, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFEF4444),
                  foregroundColor: Colors.white,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                onPressed: _loadStats,
                icon: const Icon(Icons.refresh_rounded, size: 14),
                label: const Text('Retry', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFB91C1C),
                  side: const BorderSide(color: Color(0xFFFCA5A5)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                ),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _errorDetails ?? 'No technical details.'));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Technical error details copied to clipboard')),
                  );
                },
                icon: const Icon(Icons.copy_rounded, size: 14),
                label: const Text('Copy Error', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }
}

class _OverallCard extends StatelessWidget {
  final double percentage;
  final bool loading;
  const _OverallCard({required this.percentage, required this.loading});

  @override
  Widget build(BuildContext context) {
    final Color color = percentage >= 80
        ? const Color(0xFF16A34A)
        : percentage >= 65
            ? const Color(0xFFD97706)
            : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: loading
          ? const Center(child: Padding(padding: EdgeInsets.all(20), child: CircularProgressIndicator()))
          : Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Overall Attendance', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF64748B))),
                      const SizedBox(height: 8),
                      Text(
                        '${percentage.toStringAsFixed(1)}%',
                        style: TextStyle(fontSize: 40, fontWeight: FontWeight.w800, color: color, height: 1),
                      ),
                      const SizedBox(height: 10),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(
                          value: percentage / 100,
                          backgroundColor: const Color(0xFFF1F5F9),
                          valueColor: AlwaysStoppedAnimation<Color>(color),
                          minHeight: 6,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 16),
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.08), shape: BoxShape.circle),
                  child: Icon(
                    percentage >= 80 ? Icons.verified_rounded : Icons.warning_amber_rounded,
                    color: color,
                    size: 28,
                  ),
                ),
              ],
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String label;
  final String value;
  final Color color;
  final IconData icon;
  const _StatCard({required this.label, required this.value, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 6),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: color)),
          const SizedBox(height: 2),
          Text(label, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8))),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final String title;
  final String desc;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionCard({
    required this.title,
    required this.desc,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
            const SizedBox(height: 2),
            Text(desc, style: const TextStyle(fontSize: 10, color: Color(0xFF64748B))),
          ],
        ),
      ),
    );
  }
}
