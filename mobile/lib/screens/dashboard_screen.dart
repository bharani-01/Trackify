import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
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

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    final res = await ApiClient.get('/api/attendance/stats');
    if (mounted) {
      setState(() {
        _stats = res['success'] == true ? res : null;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user;
    final name = user?['name'] ?? 'Student';
    final overall = _stats?['overall_percentage'] ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        onRefresh: _loadStats,
        color: const Color(0xFF2563EB),
        child: CustomScrollView(
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
                  _OverallCard(percentage: overall is num ? overall.toDouble() : 0, loading: _loading),
                  const SizedBox(height: 16),

                  // Quick stats row
                  if (!_loading && _stats != null) ...[
                    Row(
                      children: [
                        Expanded(child: _StatCard(label: 'Present', value: '${_stats!['total_present'] ?? 0}', color: const Color(0xFF16A34A), icon: Icons.check_circle_outline_rounded)),
                        const SizedBox(width: 12),
                        Expanded(child: _StatCard(label: 'Absent', value: '${_stats!['total_absent'] ?? 0}', color: const Color(0xFFEF4444), icon: Icons.cancel_outlined)),
                        const SizedBox(width: 12),
                        Expanded(child: _StatCard(label: 'On Duty', value: '${_stats!['total_od'] ?? 0}', color: const Color(0xFF2563EB), icon: Icons.work_outline_rounded)),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  if (_loading)
                    const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB))),
                ]),
              ),
            ),
          ],
        ),
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
                  decoration: BoxDecoration(color: color.withOpacity(0.08), shape: BoxShape.circle),
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
