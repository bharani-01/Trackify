import 'package:flutter/material.dart';
import '../core/api_client.dart';

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  List<dynamic> _slots = [];
  bool _loading = true;

  static const _days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  String _selectedDay = '';

  @override
  void initState() {
    super.initState();
    final today = DateTime.now().weekday; // 1=Mon .. 7=Sun
    _selectedDay = today <= 6 ? _days[today - 1] : 'Monday';
    _load();
  }

  Future<void> _load() async {
    final res = await ApiClient.get('/api/timetable');
    if (mounted) {
      setState(() {
        _slots = res['success'] == true ? (res['timetable'] ?? []) : [];
        _loading = false;
      });
    }
  }

  List<dynamic> get _todaySlots =>
      _slots.where((s) => s['day'] == _selectedDay).toList()
        ..sort((a, b) => (a['period'] as int).compareTo(b['period'] as int));

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Timetable', style: TextStyle(fontWeight: FontWeight.w800)),
      ),
      body: Column(
        children: [
          // Day selector
          SizedBox(
            height: 48,
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              itemCount: _days.length,
              itemBuilder: (_, i) {
                final day = _days[i];
                final active = day == _selectedDay;
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(day.substring(0, 3)),
                    selected: active,
                    onSelected: (_) => setState(() => _selectedDay = day),
                    selectedColor: const Color(0xFF2563EB),
                    labelStyle: TextStyle(
                      color: active ? Colors.white : const Color(0xFF64748B),
                      fontWeight: FontWeight.w600,
                      fontSize: 12,
                    ),
                    backgroundColor: Colors.white,
                    side: BorderSide(color: active ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
                    showCheckmark: false,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                  ),
                );
              },
            ),
          ),

          // Slots
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                : _todaySlots.isEmpty
                    ? const Center(child: Text('No classes on this day', style: TextStyle(color: Color(0xFF94A3B8))))
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _todaySlots.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (_, i) => _SlotCard(slot: _todaySlots[i]),
                      ),
          ),
        ],
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  final Map<String, dynamic> slot;
  const _SlotCard({required this.slot});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.02), blurRadius: 4, offset: const Offset(0, 1))],
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text('P${slot['period']}', style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF2563EB), fontSize: 13)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(slot['subject_name'] ?? 'Unknown', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A))),
                const SizedBox(height: 3),
                Text(slot['subject_code'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
