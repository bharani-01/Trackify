import 'package:flutter/material.dart';
import '../core/api_client.dart';

class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  List<dynamic> _slots = [];
  List<dynamic> _subjects = [];
  bool _loading = true;

  static const _days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  String _selectedDay = 'Monday';

  // Standard period default times
  static const Map<int, (String, String)> _defaultTimes = {
    1: ('09:00', '09:50'),
    2: ('09:50', '10:40'),
    3: ('11:00', '11:50'),
    4: ('11:50', '12:40'),
    5: ('13:40', '14:30'),
    6: ('14:30', '15:20'),
    7: ('15:30', '16:20'),
    8: ('16:20', '17:10'),
  };

  @override
  void initState() {
    super.initState();
    final today = DateTime.now().weekday; // 1=Mon .. 7=Sun
    _selectedDay = today <= 6 ? _days[today - 1] : 'Monday';
    _loadAll();
  }

  Future<void> _loadAll() async {
    setState(() => _loading = true);
    final results = await Future.wait([
      ApiClient.get('/api/timetable'),
      ApiClient.get('/api/subjects'),
    ]);
    
    if (mounted) {
      setState(() {
        _slots = results[0]['success'] == true ? (results[0]['timetable'] ?? []) : [];
        _subjects = results[1]['success'] == true ? (results[1]['subjects'] ?? []) : [];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Generate a list of periods 1 to 8
    final slotsByPeriod = <int, dynamic>{};
    for (final s in _slots) {
      if (s['day'] == _selectedDay) {
        slotsByPeriod[s['period'] as int] = s;
      }
    }

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Timetable Schedule', style: TextStyle(fontWeight: FontWeight.w800)),
        elevation: 0,
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

          // Period Slots List (1 to 8)
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: 8,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, i) {
                      final periodNum = i + 1;
                      final slot = slotsByPeriod[periodNum];
                      return _buildPeriodRow(periodNum, slot);
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodRow(int periodNum, dynamic slot) {
    final hasSubject = slot != null;
    final subjectName = hasSubject ? slot['subject_name'] ?? 'Unknown' : 'Free Period';
    final subjectCode = hasSubject ? slot['subject_code'] ?? '' : '';
    final room = hasSubject ? slot['room'] ?? '' : '';
    final times = _defaultTimes[periodNum] ?? ('--', '--');
    final color = hasSubject ? _parseColor(slot['color']) : const Color(0xFFCBD5E1);

    return InkWell(
      onTap: () => _manageSlot(periodNum, slot),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: hasSubject ? const Color(0xFFE2E8F0) : const Color(0xFFF1F5F9)),
          boxShadow: [
            BoxShadow(color: Colors.black.withValues(alpha: 0.01), blurRadius: 4, offset: const Offset(0, 1))
          ],
        ),
        child: Row(
          children: [
            // Period Badge
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: hasSubject ? color.withValues(alpha: 0.1) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  'P$periodNum',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: hasSubject ? color : const Color(0xFF94A3B8),
                    fontSize: 13,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),
            // Subject Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    subjectName,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: hasSubject ? const Color(0xFF0F172A) : const Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    hasSubject
                        ? '$subjectCode ${room.isNotEmpty ? " · Room $room" : ""}'
                        : 'Tap to configure class slot',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            // Time Badge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(times.$1, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                Text(times.$2, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Color _parseColor(dynamic hex) {
    if (hex == null || !(hex is String)) return const Color(0xFF2563EB);
    final str = hex.replaceAll('#', '');
    if (str.length == 6) return Color(int.parse('FF$str', radix: 16));
    return const Color(0xFF2563EB);
  }

  void _manageSlot(int periodNum, dynamic slot) {
    if (_subjects.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add subjects in your Profile first.')),
      );
      return;
    }

    final isEdit = slot != null;
    String? selectedSubId = isEdit ? slot['subject_id']?.toString() : _subjects[0]['id']?.toString();
    final roomCtrl = TextEditingController(text: isEdit ? slot['room'] ?? '' : '');
    final defaultTimes = _defaultTimes[periodNum] ?? ('09:00', '09:50');
    
    final startCtrl = TextEditingController(text: isEdit ? slot['start_time'] ?? defaultTimes.$1 : defaultTimes.$1);
    final endCtrl = TextEditingController(text: isEdit ? slot['end_time'] ?? defaultTimes.$2 : defaultTimes.$2);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setStateSheet) {
            return Padding(
              padding: EdgeInsets.fromLTRB(16, 20, 16, MediaQuery.of(ctx).viewInsets.bottom + 24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isEdit ? 'Configure Slot P$periodNum' : 'Assign Slot P$periodNum',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 4),
                  Text('Selected day: $_selectedDay', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  const SizedBox(height: 16),

                  // Subject dropdown
                  const Text('Select Course Subject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE2E8F0)), borderRadius: BorderRadius.circular(8)),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: selectedSubId,
                        isExpanded: true,
                        items: _subjects.map((s) {
                          return DropdownMenuItem<String>(
                            value: s['id']?.toString(),
                            child: Text('${s['subject_name']} (${s['subject_code']})'),
                          );
                        }).toList(),
                        onChanged: (val) => setStateSheet(() => selectedSubId = val),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Start and End Times
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: startCtrl,
                          decoration: const InputDecoration(labelText: 'Start Time', border: OutlineInputBorder()),
                          readOnly: true,
                          onTap: () async {
                            final parsed = TimeOfDay(
                              hour: int.parse(startCtrl.text.split(':')[0]),
                              minute: int.parse(startCtrl.text.split(':')[1]),
                            );
                            final picked = await showTimePicker(context: context, initialTime: parsed);
                            if (picked != null) {
                              setStateSheet(() {
                                startCtrl.text = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
                              });
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: endCtrl,
                          decoration: const InputDecoration(labelText: 'End Time', border: OutlineInputBorder()),
                          readOnly: true,
                          onTap: () async {
                            final parsed = TimeOfDay(
                              hour: int.parse(endCtrl.text.split(':')[0]),
                              minute: int.parse(endCtrl.text.split(':')[1]),
                            );
                            final picked = await showTimePicker(context: context, initialTime: parsed);
                            if (picked != null) {
                              setStateSheet(() {
                                endCtrl.text = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}';
                              });
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Room detail
                  TextField(
                    controller: roomCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Room / Lab Class Location (Optional)',
                      hintText: 'e.g. CSE Lab 1',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Save & Delete buttons
                  Row(
                    children: [
                      if (isEdit) ...[
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Colors.redAccent),
                              foregroundColor: Colors.redAccent,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                            onPressed: () async {
                              final res = await ApiClient.delete('/api/timetable/${slot['id']}');
                              if (res['success'] == true) {
                                if (ctx.mounted) Navigator.pop(ctx);
                                _loadAll();
                              } else {
                                setStateSheet(() {
                                  if (ctx.mounted) {
                                    ScaffoldMessenger.of(ctx).showSnackBar(
                                      SnackBar(content: Text(res['message'] ?? 'Failed to delete slot')),
                                    );
                                  }
                                });
                              }
                            },
                            child: const Text('Delete Slot', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        const SizedBox(width: 12),
                      ],
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                          ),
                          onPressed: () async {
                            if (selectedSubId == null) return;
                            final body = {
                              'subject_id': int.parse(selectedSubId!),
                              'day': _selectedDay,
                              'period': periodNum,
                              'start_time': startCtrl.text,
                              'end_time': endCtrl.text,
                              'room': roomCtrl.text.trim(),
                            };

                            Map<String, dynamic> res;
                            if (isEdit) {
                              res = await ApiClient.put('/api/timetable/${slot['id']}', body);
                            } else {
                              res = await ApiClient.post('/api/timetable', body);
                            }

                            if (res['success'] == true) {
                              if (ctx.mounted) Navigator.pop(ctx);
                              _loadAll();
                            } else {
                              setStateSheet(() {
                                if (ctx.mounted) {
                                  ScaffoldMessenger.of(ctx).showSnackBar(
                                    SnackBar(content: Text(res['message'] ?? 'Failed to save slot')),
                                  );
                                }
                              });
                            }
                          },
                          child: const Text('Save Slot', style: TextStyle(fontWeight: FontWeight.bold)),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}
