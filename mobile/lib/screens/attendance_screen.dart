import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/api_client.dart';

class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  
  // Tab 1: Subject aggregation
  List<dynamic> _subjectStats = [];
  bool _loadingStats = true;

  // Tab 2: Logs history
  List<dynamic> _logs = [];
  bool _loadingLogs = true;

  // For logging modal
  List<dynamic> _subjectsList = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadAll();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadAll() async {
    await Future.wait([
      _loadStats(),
      _loadLogs(),
      _loadSubjectsList(),
    ]);
  }

  Future<void> _loadStats() async {
    if (!mounted) return;
    setState(() => _loadingStats = true);
    final res = await ApiClient.get('/api/attendance/stats');
    if (mounted) {
      setState(() {
        _subjectStats = res['success'] == true ? (res['stats']?['subjectStats'] ?? []) : [];
        _loadingStats = false;
      });
    }
  }

  Future<void> _loadLogs() async {
    if (!mounted) return;
    setState(() => _loadingLogs = true);
    final res = await ApiClient.get('/api/attendance');
    if (mounted) {
      setState(() {
        _logs = res['success'] == true ? (res['records'] ?? res['logs'] ?? []) : [];
        _loadingLogs = false;
      });
    }
  }

  Future<void> _loadSubjectsList() async {
    final res = await ApiClient.get('/api/subjects');
    if (mounted) {
      setState(() {
        _subjectsList = res['success'] == true ? (res['subjects'] ?? []) : [];
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Attendance Logs', style: TextStyle(fontWeight: FontWeight.w800)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF2563EB),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFF2563EB),
          tabs: const [
            Tab(text: 'By Subject'),
            Tab(text: 'History Logs'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildSubjectTab(),
          _buildHistoryTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showLogDialog,
        backgroundColor: const Color(0xFF2563EB),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.edit_calendar_rounded),
        label: const Text('Log Attendance', style: TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildSubjectTab() {
    if (_loadingStats) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)));
    }
    if (_subjectStats.isEmpty) {
      return _empty('No subject statistics found', 'Set up subjects in your Profile first.');
    }
    return RefreshIndicator(
      onRefresh: _loadStats,
      color: const Color(0xFF2563EB),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _subjectStats.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          final s = _subjectStats[i];
          final name = s['subject_name'] ?? 'Unknown';
          final code = s['subject_code'] ?? '';
          final present = (s['present_count'] ?? 0) as int;
          final od = (s['od_count'] ?? 0) as int;
          final conducted = (s['conducted_count'] ?? 0) as int;
          final pct = s['percentage'] != null ? (s['percentage'] as num).toDouble() : 100.0;
          final color = _parseColor(s['color']);

          return Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(
                left: BorderSide(color: Color(0xFFE2E8F0)),
                top: BorderSide(color: Color(0xFFE2E8F0)),
                right: BorderSide(color: Color(0xFFE2E8F0)),
                bottom: BorderSide(color: Color(0xFFE2E8F0)),
              ),
            ),
            child: Row(
              children: [
                Container(width: 6, height: 50, color: color),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A))),
                      const SizedBox(height: 3),
                      Text(code, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B))),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                        value: pct / 100,
                        backgroundColor: const Color(0xFFF1F5F9),
                        valueColor: AlwaysStoppedAnimation<Color>(
                          pct >= 80 ? const Color(0xFF16A34A) : pct >= 65 ? const Color(0xFFD97706) : const Color(0xFFEF4444)
                        ),
                        minHeight: 4,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Conducted: $conducted  |  Present: $present ${od > 0 ? "(+$od OD)" : ""}',
                        style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Text(
                  '${pct.toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: pct >= 80 ? const Color(0xFF16A34A) : pct >= 65 ? const Color(0xFFD97706) : const Color(0xFFEF4444)
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHistoryTab() {
    if (_loadingLogs) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)));
    }
    if (_logs.isEmpty) {
      return _empty('No attendance logs found', 'Logs you submit will show up here.');
    }
    return RefreshIndicator(
      onRefresh: _loadLogs,
      color: const Color(0xFF2563EB),
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
        itemCount: _logs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 10),
        itemBuilder: (context, i) {
          final log = _logs[i];
          final name = log['subject_name'] ?? 'Unknown';
          final status = log['status'] ?? 'Present';
          final remarks = log['remarks'] ?? '';
          final dateStr = log['date'] != null ? _formatDate(log['date']) : '';
          
          Color statusCol = const Color(0xFF16A34A);
          if (status == 'Absent') statusCol = const Color(0xFFEF4444);
          if (status == 'On Duty') statusCol = const Color(0xFF2563EB);
          if (status == 'Medical Leave') statusCol = const Color(0xFF7C3AED);
          if (status == 'Holiday') statusCol = const Color(0xFF64748B);

          return Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(color: statusCol.withValues(alpha: 0.1)),
                            child: Text(
                              status,
                              style: TextStyle(color: statusCol, fontSize: 10, fontWeight: FontWeight.bold),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(dateStr, style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF0F172A))),
                      if (remarks.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text('Remarks: $remarks', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B), fontStyle: FontStyle.italic)),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.edit_outlined, size: 18, color: Color(0xFF64748B)),
                  onPressed: () => _editLog(log),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent),
                  onPressed: () => _deleteLog(log['id'].toString()),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _empty(String title, String subtitle) => Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.calendar_month_outlined, size: 44, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 12)),
          ],
        ),
      );

  Color _parseColor(dynamic hex) {
    if (hex == null || !(hex is String)) return const Color(0xFF2563EB);
    final str = hex.replaceAll('#', '');
    if (str.length == 6) return Color(int.parse('FF$str', radix: 16));
    return const Color(0xFF2563EB);
  }

  String _formatDate(String isoString) {
    try {
      final dt = DateTime.parse(isoString);
      return DateFormat('dd MMM yyyy').format(dt);
    } catch (_) {
      return isoString;
    }
  }

  void _showLogDialog() {
    if (_subjectsList.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please add subjects in your Profile first.')),
      );
      return;
    }

    String? selectedSubId = _subjectsList[0]['id']?.toString();
    String selectedStatus = 'Present';
    final remarksCtrl = TextEditingController();
    DateTime selectedDate = DateTime.now();

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
                  const Text('Log Attendance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 16),
                  
                  // Subject dropdown
                  const Text('Subject', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: selectedSubId,
                        isExpanded: true,
                        items: _subjectsList.map((s) {
                          return DropdownMenuItem<String>(
                            value: s['id']?.toString(),
                            child: Text(s['subject_name'] ?? ''),
                          );
                        }).toList(),
                        onChanged: (val) => setStateSheet(() => selectedSubId = val),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Date picker button
                  const Text('Date', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 6),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.calendar_today_rounded, size: 16),
                      label: Text(DateFormat('dd MMM yyyy').format(selectedDate)),
                      onPressed: () async {
                        final picked = await showDatePicker(
                          context: context,
                          initialDate: selectedDate,
                          firstDate: DateTime(2025),
                          lastDate: DateTime.now(),
                        );
                        if (picked != null) {
                          setStateSheet(() => selectedDate = picked);
                        }
                      },
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Status chips
                  const Text('Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ['Present', 'Absent', 'On Duty', 'Medical Leave', 'Holiday'].map((st) {
                      final active = selectedStatus == st;
                      return ChoiceChip(
                        label: Text(st),
                        selected: active,
                        onSelected: (_) => setStateSheet(() => selectedStatus = st),
                        selectedColor: const Color(0xFF2563EB),
                        labelStyle: TextStyle(color: active ? Colors.white : Colors.black87, fontSize: 12),
                        showCheckmark: false,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Remarks
                  TextField(
                    controller: remarksCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Remarks (Optional)',
                      hintText: 'e.g. Special permission / Lab class',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Submit
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
                      onPressed: () async {
                        if (selectedSubId == null) return;
                        final body = {
                          'subject_id': int.parse(selectedSubId!),
                          'date': DateFormat('yyyy-MM-dd').format(selectedDate),
                          'status': selectedStatus,
                          'remarks': remarksCtrl.text.trim(),
                        };
                        final res = await ApiClient.post('/api/attendance', body);
                        if (res['success'] == true) {
                          if (ctx.mounted) Navigator.pop(ctx);
                          _loadAll();
                        } else {
                          setStateSheet(() {
                            if (ctx.mounted) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(content: Text(res['message'] ?? 'Failed to log attendance')),
                              );
                            }
                          });
                        }
                      },
                      child: const Text('Submit Log', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _editLog(dynamic log) {
    String selectedStatus = log['status'] ?? 'Present';
    final remarksCtrl = TextEditingController(text: log['remarks'] ?? '');

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
                  const Text('Edit Attendance Log', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: Color(0xFF0F172A))),
                  const SizedBox(height: 4),
                  Text('${log['subject_name']} on ${_formatDate(log['date'])}', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B))),
                  const SizedBox(height: 20),

                  // Status chips
                  const Text('Status', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: ['Present', 'Absent', 'On Duty', 'Medical Leave', 'Holiday'].map((st) {
                      final active = selectedStatus == st;
                      return ChoiceChip(
                        label: Text(st),
                        selected: active,
                        onSelected: (_) => setStateSheet(() => selectedStatus = st),
                        selectedColor: const Color(0xFF2563EB),
                        labelStyle: TextStyle(color: active ? Colors.white : Colors.black87, fontSize: 12),
                        showCheckmark: false,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Remarks
                  TextField(
                    controller: remarksCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Remarks',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Submit
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
                      onPressed: () async {
                        final body = {
                          'status': selectedStatus,
                          'remarks': remarksCtrl.text.trim(),
                        };
                        final res = await ApiClient.put('/api/attendance/${log['id']}', body);
                        if (res['success'] == true) {
                          if (ctx.mounted) Navigator.pop(ctx);
                          _loadAll();
                        } else {
                          setStateSheet(() {
                            if (ctx.mounted) {
                              ScaffoldMessenger.of(ctx).showSnackBar(
                                SnackBar(content: Text(res['message'] ?? 'Failed to update attendance')),
                              );
                            }
                          });
                        }
                      },
                      child: const Text('Update Log', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Future<void> _deleteLog(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Delete Log', style: TextStyle(fontWeight: FontWeight.w800)),
        content: const Text('Are you sure you want to delete this attendance log?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
    if (confirm == true) {
      final res = await ApiClient.delete('/api/attendance/$id');
      if (res['success'] == true) {
        _loadAll();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(res['message'] ?? 'Failed to delete log')),
          );
        }
      }
    }
  }
}
