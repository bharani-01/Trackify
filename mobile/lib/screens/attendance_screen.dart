import 'package:flutter/material.dart';
import '../core/api_client.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  List<dynamic> _subjects = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final res = await ApiClient.get('/api/attendance/summary');
    if (mounted) {
      setState(() {
        _subjects = res['success'] == true ? (res['subjects'] ?? []) : [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Attendance', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : _subjects.isEmpty
              ? _empty()
              : RefreshIndicator(
                  onRefresh: _load,
                  color: const Color(0xFF2563EB),
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _subjects.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) => _SubjectCard(subject: _subjects[i]),
                  ),
                ),
    );
  }

  Widget _empty() => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.folder_open_outlined, size: 48, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            const Text('No subjects found', style: TextStyle(color: Color(0xFF64748B))),
          ],
        ),
      );
}

class _SubjectCard extends StatelessWidget {
  final Map<String, dynamic> subject;
  const _SubjectCard({required this.subject});

  @override
  Widget build(BuildContext context) {
    final name = subject['subject_name'] ?? 'Unknown';
    final code = subject['subject_code'] ?? '';
    final present = (subject['present'] ?? 0) as num;
    final conducted = (subject['conducted'] ?? 0) as num;
    final pct = conducted > 0 ? (present / conducted * 100) : 0.0;
    final color = pct >= 80
        ? const Color(0xFF16A34A)
        : pct >= 65
            ? const Color(0xFFD97706)
            : const Color(0xFFEF4444);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A))),
                const SizedBox(height: 2),
                Text(code, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                const SizedBox(height: 10),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: pct / 100,
                    backgroundColor: const Color(0xFFF1F5F9),
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                    minHeight: 5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '$present / $conducted classes',
                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          Text(
            '${pct.toStringAsFixed(1)}%',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: color),
          ),
        ],
      ),
    );
  }
}
