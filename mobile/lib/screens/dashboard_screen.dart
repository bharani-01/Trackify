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
  List<dynamic> _subjectStats = [];
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
          _subjectStats = res['stats']?['subjectStats'] ?? [];
        } else {
          _stats = null;
          _subjectStats = [];
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
    final regNo = user?['register_number'] ?? '';
    final sem = user?['semester']?.toString() ?? '';

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset(
              'assets/images/logo.webp',
              height: 24,
              width: 24,
              fit: BoxFit.contain,
            ),
            const SizedBox(width: 8),
            const Text(
              'Student Dashboard',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
          ],
        ),
        elevation: 0,
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: const Color(0xFF2563EB),
                border: Border.all(color: const Color(0xFF2563EB), width: 1.5),
              ),
              child: Center(
                child: Text(
                  name.isNotEmpty ? name[0].toUpperCase() : 'S',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16),
                ),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadStats,
        color: const Color(0xFF2563EB),
        child: _loading
            ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
            : CustomScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                slivers: [
                  SliverPadding(
                    padding: const EdgeInsets.all(16),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        // Welcome Banner
                        Text(
                          'Hello, $name!',
                          style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), letterSpacing: -0.5),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${regNo.isNotEmpty ? regNo : "E02"} | Semester ${sem.isNotEmpty ? sem : "5"}',
                          style: const TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
                        ),
                        const SizedBox(height: 20),

                        // Holiday Banner
                        if (_stats != null && _stats!['todayHoliday'] != null) ...[
                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFECFEFF),
                              border: Border.all(color: const Color(0xFF0891B2), width: 1.5),
                            ),
                            child: Row(
                              children: [
                                const Text(
                                  '🎉 ',
                                  style: TextStyle(fontSize: 16),
                                ),
                                Expanded(
                                  child: Text(
                                    'Today is a Holiday: ${_stats!['todayHoliday']['name'] ?? "Holiday"}',
                                    style: const TextStyle(
                                      color: Color(0xFF0891B2),
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 20),
                        ],

                        // Quick Navigation Shortcuts
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF0F172A), width: 1.5),
                                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                onPressed: () => context.go('/attendance'),
                                child: const Text(
                                  'Mark Attendance',
                                  style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 13),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  side: const BorderSide(color: Color(0xFF0F172A), width: 1.5),
                                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                ),
                                onPressed: () => context.go('/timetable'),
                                child: const Text(
                                  'Timetable',
                                  style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.w800, fontSize: 13),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 28),

                        // Section Title: SUBJECT DIRECTORY & PERFORMANCE
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'SUBJECT DIRECTORY & PERFORMANCE',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.8, color: Color(0xFF334155)),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              height: 2.5,
                              color: const Color(0xFF0F172A),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // Load Error Widget
                        if (_stats == null) ...[
                          _buildErrorCard(),
                          const SizedBox(height: 20),
                        ],

                        // Subject List Cards
                        if (_subjectStats.isNotEmpty)
                          ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _subjectStats.length,
                            separatorBuilder: (_, __) => const SizedBox(height: 12),
                            itemBuilder: (context, i) {
                              final sub = _subjectStats[i];
                              return _buildSubjectCard(sub);
                            },
                          )
                        else if (!_loading && _stats != null)
                          _buildEmptyView(),

                        const SizedBox(height: 40),
                      ]),
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildSubjectCard(dynamic sub) {
    final name = sub['subject_name'] ?? 'Unknown';
    final code = sub['subject_code'] ?? '';
    final conducted = sub['conducted_count'] ?? 0;
    final present = sub['present_count'] ?? 0;
    final od = sub['od_count'] ?? 0;
    final absent = sub['absent_count'] ?? 0;
    final pct = sub['percentage'] != null ? (sub['percentage'] as num).toDouble() : 100.0;

    // Color logic matching percentage thresholds
    Color pctCol = const Color(0xFF16A34A);
    if (pct < 75) {
      pctCol = const Color(0xFFEF4444);
    } else if (pct < 80) {
      pctCol = const Color(0xFFD97706);
    }

    return Container(
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF1E293B) : Colors.white,
        border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          // Upper Info row
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Code Badge
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        color: const Color(0xFFEFF6FF),
                        child: Text(
                          code,
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF2563EB)),
                        ),
                      ),
                      const SizedBox(height: 6),
                      // Name
                      Text(
                        name,
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                // Percent
                Text(
                  '${pct.toStringAsFixed(0)}%',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: pctCol),
                ),
              ],
            ),
          ),
          // Divider inside card
          Container(height: 1, color: const Color(0xFFF1F5F9)),
          // Sub-row metrics details
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildMetricColumn('CONDUCTED', '$conducted', const Color(0xFF475569)),
                _buildMetricColumn('PRESENT', '$present', const Color(0xFF16A34A)),
                _buildMetricColumn('OD', '$od', const Color(0xFF2563EB)),
                _buildMetricColumn('ABSENT', '$absent', const Color(0xFFEF4444)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricColumn(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.5, color: Color(0xFF94A3B8)),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: color),
        ),
      ],
    );
  }

  Widget _buildErrorCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
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
          const SizedBox(height: 8),
          const Text(
            'Ensure your server/network is online. If this persists, copy technical details below.',
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
                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                ),
                onPressed: _loadStats,
                icon: const Icon(Icons.refresh_rounded, size: 14),
                label: const Text('Retry', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(width: 10),
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFB91C1C),
                  side: const BorderSide(color: Color(0xFFFCA5A5)),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                ),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _errorDetails ?? 'No technical details.'));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Technical error details copied to clipboard')),
                  );
                },
                icon: const Icon(Icons.copy_rounded, size: 14),
                label: const Text('Copy Error', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Column(
          children: [
            const Icon(Icons.library_books_outlined, size: 40, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            const Text('No courses found', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            const Text('Setup subjects under Profile > Manage Subjects.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
          ],
        ),
      ),
    );
  }
}
