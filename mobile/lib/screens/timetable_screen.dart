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
  bool _isTableFormat = false;

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
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Timetable Schedule', style: TextStyle(fontWeight: FontWeight.w800)),
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(_isTableFormat ? Icons.view_day_outlined : Icons.grid_on_outlined),
            onPressed: () => setState(() => _isTableFormat = !_isTableFormat),
            tooltip: _isTableFormat ? 'Show Daily List' : 'Show Grid Table',
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : Column(
              children: [
                if (!_isTableFormat) ...[
                  // Day selector
                  SizedBox(
                    height: 48,
                    child: ListView.builder(
                      scrollDirection: Axis.horizontal,
                      padding: EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      itemCount: _days.length,
                      itemBuilder: (_, i) {
                        final day = _days[i];
                        final active = day == _selectedDay;
                        return Padding(
                          padding: EdgeInsets.only(right: 6),
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
                            backgroundColor: Theme.of(context).scaffoldBackgroundColor,
                            side: BorderSide(color: active ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0)),
                            showCheckmark: false,
                            padding: EdgeInsets.symmetric(horizontal: 10),
                          ),
                        );
                      },
                    ),
                  ),
                  // Period Slots List (1 to 8)
                  Expanded(
                    child: ListView.separated(
                      padding: EdgeInsets.all(16),
                      itemCount: 8,
                      separatorBuilder: (_, __) => SizedBox(height: 10),
                      itemBuilder: (ctx, i) {
                        final periodNum = i + 1;
                        final slot = slotsByPeriod[periodNum];
                        return _buildPeriodRow(periodNum, slot);
                      },
                    ),
                  ),
                ] else
                  _buildTableFormatView(),
              ],
            ),
    );
  }

  Widget _buildTableFormatView() {
    // Columns definition following the Sri Ramachandra university schedule structure
    final cols = [
      'Day',
      'Hour I\n08:00-08:55',
      'Hour II\n08:55-09:50',
      'BREAK\n09:50-10:10',
      'Hour III\n10:10-11:05',
      'Hour IV\n11:05-12:00',
      'LUNCH\n12:00-01:00',
      'Hour V\n01:00-01:50',
      'Hour VI\n01:50-02:40',
      'BREAK\n02:40-02:55',
      'Hour VII\n02:55-03:45',
    ];

    // Map database slots: Day String -> Period (1..7) -> Slot Map
    final grid = <String, Map<int, dynamic>>{};
    for (final day in _days) {
      grid[day] = {};
    }
    for (final s in _slots) {
      final p = s['period'] as int?;
      final d = s['day'] as String?;
      if (p != null && d != null && p >= 1 && p <= 7) {
        grid[d]![p] = s;
      }
    }

    return Expanded(
      child: SingleChildScrollView(
        scrollDirection: Axis.vertical,
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Padding(
            padding: EdgeInsets.all(16.0),
            child: Table(
              defaultColumnWidth: const FixedColumnWidth(110),
              columnWidths: const {
                0: FixedColumnWidth(55), // Day column
                3: FixedColumnWidth(40), // Break I column
                6: FixedColumnWidth(50), // Lunch column
                9: FixedColumnWidth(40), // Break II column
              },
              border: TableBorder.all(color: const Color(0xFFE2E8F0), width: 1),
              children: [
                // Header row
                TableRow(
                  decoration: const BoxDecoration(color: Color(0xFFF8FAFC)),
                  children: cols.map((col) => Padding(
                    padding: EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                    child: Text(
                      col,
                      style: TextStyle(fontWeight: FontWeight.w800, fontSize: 9, color: Color(0xFF475569)),
                      textAlign: TextAlign.center,
                    ),
                  )).toList(),
                ),
                // Days rows
                for (final day in _days)
                  TableRow(
                    children: [
                      // Day Column cell
                      Padding(
                        padding: EdgeInsets.symmetric(vertical: 18),
                        child: Text(
                          day.substring(0, 3),
                          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 11, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A)),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      // Hour I & II
                      _buildTableCell(1, grid[day]![1]),
                      _buildTableCell(2, grid[day]![2]),
                      // Break I
                      _buildBreakCell('BREAK'),
                      // Hour III & IV
                      _buildTableCell(3, grid[day]![3]),
                      _buildTableCell(4, grid[day]![4]),
                      // Lunch
                      _buildBreakCell('LUNCH'),
                      // Hour V & VI
                      _buildTableCell(5, grid[day]![5]),
                      _buildTableCell(6, grid[day]![6]),
                      // Break II
                      _buildBreakCell('BREAK'),
                      // Hour VII
                      _buildTableCell(7, grid[day]![7]),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildBreakCell(String text) {
    return Container(
      height: 52,
      color: const Color(0xFFF1F5F9),
      alignment: Alignment.center,
      child: RotatedBox(
        quarterTurns: 1, // Vertical text display for break columns
        child: Text(
          text,
          style: TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8), letterSpacing: 0.5),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  Widget _buildTableCell(int period, dynamic slot) {
    final hasClass = slot != null;
    final code = hasClass ? (slot['subject_code'] ?? '') : '';
    final name = hasClass ? (slot['subject_name'] ?? '') : '';
    final room = hasClass ? (slot['room'] ?? '') : '';
    final color = hasClass ? _parseColor(slot['color']) : Colors.transparent;

    return Container(
      height: 52,
      color: hasClass ? color.withValues(alpha: 0.05) : Colors.transparent,
      padding: EdgeInsets.all(4),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            hasClass ? code : '—',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: hasClass ? color : const Color(0xFFCBD5E1),
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          if (hasClass && name.isNotEmpty) ...[
            SizedBox(height: 1),
            Text(
              name,
              style: TextStyle(fontSize: 8, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          if (hasClass && room.isNotEmpty) ...[
            SizedBox(height: 1),
            Text(
              'Rm $room',
              style: TextStyle(fontSize: 7, color: Color(0xFF94A3B8)),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildPeriodRow(int periodNum, dynamic slot) {
    final hasSubject = slot != null;
    final subjectName = hasSubject ? slot['subject_name'] ?? 'Unknown' : 'Free Period';
    final subjectCode = hasSubject ? slot['subject_code'] ?? '' : '';
    final room = hasSubject ? slot['room'] ?? '' : '';
    final times = _getPeriodTimes(periodNum);
    final color = hasSubject ? _parseColor(slot['color']) : const Color(0xFFCBD5E1);

    return Container(
      padding: EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,
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
            SizedBox(width: 14),
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
                  SizedBox(height: 2),
                  Text(
                    hasSubject
                        ? '$subjectCode ${room.isNotEmpty ? " · Room $room" : ""}'
                        : 'Tap to configure class slot',
                    style: TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            SizedBox(width: 10),
            // Time Badge
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(times.$1, style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF475569))),
                Text(times.$2, style: TextStyle(fontSize: 10, color: Color(0xFF94A3B8))),
              ],
            ),
          ],
        ),
      );
  }

  Color _parseColor(dynamic hex) {
    if (hex == null || !(hex is String)) return const Color(0xFF2563EB);
    final str = hex.replaceAll('#', '');
    if (str.length == 6) return Color(int.parse('FF$str', radix: 16));
    return const Color(0xFF2563EB);
  }

  (String, String) _getPeriodTimes(int periodNum) {
    for (final s in _slots) {
      if (s['period'] == periodNum) {
        final start = s['start_time']?.toString();
        final end = s['end_time']?.toString();
        if (start != null && end != null && start.length >= 5 && end.length >= 5) {
          return (start.substring(0, 5), end.substring(0, 5));
        }
      }
    }
    return _defaultTimes[periodNum] ?? ('09:00', '09:50');
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
    final defaultTimes = _getPeriodTimes(periodNum);
    
    final startCtrl = TextEditingController(text: isEdit ? slot['start_time'] ?? defaultTimes.$1 : defaultTimes.$1);
    final endCtrl = TextEditingController(text: isEdit ? slot['end_time'] ?? defaultTimes.$2 : defaultTimes.$2);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
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
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A)),
                  ),
                  SizedBox(height: 4),
                  Text('Selected day: $_selectedDay', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  SizedBox(height: 16),

                  // Subject dropdown
                  Text('Select Course Subject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  SizedBox(height: 6),
                  Container(
                    width: double.infinity,
                    padding: EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: selectedSubId,
                        isExpanded: true,
                        items: _subjects.map((sub) {
                          return DropdownMenuItem<String>(
                            value: sub['id']?.toString(),
                            child: Text('${sub['subject_name'] ?? sub['name'] ?? 'Unknown'} (${sub['subject_code']})'),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setStateSheet(() => selectedSubId = val);
                        },
                      ),
                    ),
                  ),
                  SizedBox(height: 16),

                  // Times input
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Start Time', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                            SizedBox(height: 6),
                            TextField(
                              controller: startCtrl,
                              decoration: const InputDecoration(
                                hintText: 'HH:MM',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('End Time', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                            SizedBox(height: 6),
                            TextField(
                              controller: endCtrl,
                              decoration: const InputDecoration(
                                hintText: 'HH:MM',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 16),

                  // Room Input
                  Text('Class Room (Optional)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  SizedBox(height: 6),
                  TextField(
                    controller: roomCtrl,
                    decoration: const InputDecoration(
                      hintText: 'e.g. CSE Lab 1',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  SizedBox(height: 24),

                  // Save & Delete buttons
                  Row(
                    children: [
                      if (isEdit) ...[
                        Expanded(
                          child: OutlinedButton(
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: Colors.redAccent),
                              foregroundColor: Colors.redAccent,
                              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
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
                            child: Text('Delete Slot', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                        SizedBox(width: 12),
                      ],
                      Expanded(
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            foregroundColor: Colors.white,
                            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
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
                          child: Text('Save Slot', style: TextStyle(fontWeight: FontWeight.bold)),
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