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

  // Selected date state for logging checklist
  DateTime _selectedDate = DateTime.now();

  // Checklist state variables
  bool _loadingChecklist = true;
  List<dynamic> _timetableSlots = [];
  List<dynamic> _adjustments = [];
  List<dynamic> _logsForDate = [];
  Map<String, dynamic>? _holidayForDate;

  // General History logs state variables
  bool _loadingHistory = true;
  List<dynamic> _historyLogs = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _loadChecklistData();
    _loadHistoryLogs();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // Formatting date string helper
  String _dateString(DateTime dt) => DateFormat('yyyy-MM-dd').format(dt);

  Future<void> _loadChecklistData() async {
    if (!mounted) return;
    setState(() => _loadingChecklist = true);
    
    final dateStr = _dateString(_selectedDate);
    final timetableRes = await ApiClient.get('/api/timetable');
    final adjustmentsRes = await ApiClient.get('/api/timetable/adjustments?date=$dateStr');
    final logsRes = await ApiClient.get('/api/attendance?startDate=$dateStr&endDate=$dateStr');

    if (mounted) {
      setState(() {
        _timetableSlots = timetableRes['success'] == true ? (timetableRes['timetable'] ?? []) : [];
        _adjustments = adjustmentsRes['success'] == true ? (adjustmentsRes['adjustments'] ?? []) : [];
        _logsForDate = logsRes['success'] == true ? (logsRes['logs'] ?? logsRes['records'] ?? []) : [];
        _holidayForDate = (logsRes['success'] == true && logsRes['holiday'] != null) 
            ? Map<String, dynamic>.from(logsRes['holiday']) 
            : null;
        _loadingChecklist = false;
      });
    }
  }

  Future<void> _loadHistoryLogs() async {
    if (!mounted) return;
    setState(() => _loadingHistory = true);
    final res = await ApiClient.get('/api/attendance');
    if (mounted) {
      setState(() {
        _historyLogs = res['success'] == true ? (res['logs'] ?? res['records'] ?? []) : [];
        _loadingHistory = false;
      });
    }
  }

  // Relative Date selection click triggers
  void _selectRelativeDate(int offset) {
    setState(() {
      _selectedDate = DateTime.now().add(Duration(days: offset));
    });
    _loadChecklistData();
  }

  Future<void> _selectCustomDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 30)),
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
      _loadChecklistData();
    }
  }

  // Quick Action logging click triggers
  Future<void> _markQuick(String subjectId, int period, String status) async {
    final dateStr = _dateString(_selectedDate);
    final response = await ApiClient.post('/api/attendance', {
      'subject_id': subjectId,
      'date': dateStr,
      'status': status,
      'remarks': 'Period $period'
    });

    if (!mounted) return;

    if (response['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Logged $status for Period $period')),
      );
      _loadChecklistData();
      _loadHistoryLogs();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(response['message'] ?? 'Failed to log attendance')),
      );
    }
  }

  Future<void> _deleteMarking(String logId) async {
    final response = await ApiClient.delete('/api/attendance/$logId');
    
    if (!mounted) return;

    if (response['success'] == true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Attendance marking reset')),
      );
      _loadChecklistData();
      _loadHistoryLogs();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(response['message'] ?? 'Failed to reset marking')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
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
            const Text('Attendance Logs', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF2563EB),
          unselectedLabelColor: const Color(0xFF64748B),
          indicatorColor: const Color(0xFF2563EB),
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Mark Attendance'),
            Tab(text: 'History Logs'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildChecklistTab(),
          _buildHistoryTab(),
        ],
      ),
    );
  }

  Widget _buildChecklistTab() {
    final daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    final targetDayName = daysOfWeek[_selectedDate.weekday % 7];
    final dateFormattedTitle = DateFormat('EEEE, MMMM d, yyyy').format(_selectedDate);

    // Compute template class slots for selected date day of the week
    final rawSlots = _timetableSlots.where((s) => s['day'] == targetDayName).toList();

    // Map scheduled template slots with substitution and canceled adjustments
    final List<Map<String, dynamic>> processedSlots = [];
    
    for (var slot in rawSlots) {
      final period = slot['period'] as int;
      final adj = _adjustments.firstWhere(
        (a) => a['period'] == period && a['adjustment_type'] != 'extra',
        orElse: () => null,
      );

      if (adj != null) {
        if (adj['adjustment_type'] == 'cancel') {
          processedSlots.add({
            ...slot,
            'is_canceled': true,
          });
        } else if (adj['adjustment_type'] == 'substitution') {
          processedSlots.add({
            ...slot,
            'subject_id': adj['adjusted_subject_id'],
            'subject_name': adj['adjusted_subject_name'],
            'subject_code': adj['adjusted_subject_code'],
            'color': adj['adjusted_subject_color'] ?? slot['color'],
            'is_substituted': true,
            'original_subject_name': slot['subject_name']
          });
        } else if (adj['adjustment_type'] == 'swap') {
          processedSlots.add({
            ...slot,
            'subject_id': adj['adjusted_subject_id'],
            'subject_name': adj['adjusted_subject_name'],
            'subject_code': adj['adjusted_subject_code'],
            'color': adj['adjusted_subject_color'] ?? slot['color'],
            'is_swapped': true,
            'swap_period_details': adj['remarks'] ?? 'Period Swap'
          });
        }
      } else {
        processedSlots.add(Map<String, dynamic>.from(slot));
      }
    }

    // Add extra class periods dynamically
    for (var adj in _adjustments) {
      if (adj['adjustment_type'] == 'extra') {
        processedSlots.add({
          'id': null,
          'subject_id': adj['adjusted_subject_id'],
          'subject_name': adj['adjusted_subject_name'],
          'subject_code': adj['adjusted_subject_code'],
          'color': adj['adjusted_subject_color'] ?? '#3b82f6',
          'day': targetDayName,
          'period': adj['period'] as int,
          'start_time': 'TBA',
          'end_time': 'TBA',
          'room': 'TBA',
          'is_extra': true
        });
      }
    }

    // Sort classes list by period number
    processedSlots.sort((a, b) => (a['period'] as int).compareTo(b['period'] as int));

    // Calculate logging completion progress metrics
    final activeTotal = processedSlots.where((s) => s['is_canceled'] != true).length;
    int markedCount = 0;

    for (var slot in processedSlots) {
      if (slot['is_canceled'] == true) continue;
      final period = slot['period'];
      final hasLog = _logsForDate.any((l) {
        final r = l['remarks']?.toString() ?? '';
        return r == 'Period $period';
      });
      if (hasLog) markedCount++;
    }

    final checklistProgress = activeTotal > 0 ? (markedCount / activeTotal) : 0.0;

    return RefreshIndicator(
      onRefresh: _loadChecklistData,
      color: const Color(0xFF2563EB),
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Subheader Info
          const Text(
            'Log your presence for scheduled classes dynamically by selecting dates or shortcuts.',
            style: TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4),
          ),
          const SizedBox(height: 16),

          // Date Selector Header Row (Yesterday, Today, Tomorrow, Custom Date)
          _buildDateSelectorRow(),
          const SizedBox(height: 16),

          // Day Progress Tracker Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            dateFormattedTitle,
                            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                          ),
                          const SizedBox(height: 3),
                          Text(
                            'You have marked $markedCount of $activeTotal classes scheduled for this date.',
                            style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      '${(checklistProgress * 100).round()}%',
                      style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0F172A)),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                LinearProgressIndicator(
                  value: checklistProgress,
                  backgroundColor: const Color(0xFFE2E8F0),
                  valueColor: const AlwaysStoppedAnimation<Color>(Color(0xFF2563EB)),
                  minHeight: 6,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Log Checklist Slots List
          if (_loadingChecklist)
            const Center(child: Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(color: Color(0xFF2563EB))))
          else if (processedSlots.isEmpty)
            _buildEmptyDaySlots(targetDayName)
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: processedSlots.length,
              separatorBuilder: (_, __) => const SizedBox(height: 12),
              itemBuilder: (context, i) {
                final slot = processedSlots[i];
                return _buildChecklistCard(slot);
              },
            ),
        ],
      ),
    );
  }

  Widget _buildDateSelectorRow() {
    final yesterdayStr = DateFormat('E, MMM d').format(DateTime.now().subtract(const Duration(days: 1)));
    final todayStr = DateFormat('E, MMM d').format(DateTime.now());
    final tomorrowStr = DateFormat('E, MMM d').format(DateTime.now().add(const Duration(days: 1)));

    final isYesterday = _dateString(_selectedDate) == _dateString(DateTime.now().subtract(const Duration(days: 1)));
    final isToday = _dateString(_selectedDate) == _dateString(DateTime.now());
    final isTomorrow = _dateString(_selectedDate) == _dateString(DateTime.now().add(const Duration(days: 1)));

    return Row(
      children: [
        // Yesterday shortcut button
        Expanded(child: _dateShortcutButton('Yesterday', yesterdayStr, isYesterday, () => _selectRelativeDate(-1))),
        const SizedBox(width: 6),
        // Today shortcut button
        Expanded(child: _dateShortcutButton('Today', todayStr, isToday, () => _selectRelativeDate(0))),
        const SizedBox(width: 6),
        // Tomorrow shortcut button
        Expanded(child: _dateShortcutButton('Tomorrow', tomorrowStr, isTomorrow, () => _selectRelativeDate(1))),
        const SizedBox(width: 8),
        // Custom Date calendar button
        OutlinedButton(
          style: OutlinedButton.styleFrom(
            side: const BorderSide(color: Color(0xFF0F172A), width: 1.2),
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          ),
          onPressed: _selectCustomDate,
          child: const Icon(Icons.calendar_month_outlined, size: 18, color: Color(0xFF0F172A)),
        ),
      ],
    );
  }

  Widget _dateShortcutButton(String title, String val, bool isActive, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: isActive ? const Color(0xFF2563EB) : Colors.white,
          border: Border.all(color: isActive ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1), width: 1.2),
        ),
        child: Column(
          children: [
            Text(
              title,
              style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: isActive ? Colors.white70 : const Color(0xFF64748B)),
            ),
            const SizedBox(height: 2),
            Text(
              val,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: isActive ? Colors.white : const Color(0xFF0F172A)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChecklistCard(Map<String, dynamic> slot) {
    final period = slot['period'] as int;
    final name = slot['subject_name'] ?? 'Unknown Course';
    final code = slot['subject_code'] ?? '';
    final room = slot['room'] ?? 'TBA';
    final start = slot['start_time'] != null && slot['start_time'].length >= 5 ? slot['start_time'].substring(0, 5) : '--:--';
    final end = slot['end_time'] != null && slot['end_time'].length >= 5 ? slot['end_time'].substring(0, 5) : '--:--';
    final colorHex = slot['color']?.toString() ?? '#64748b';
    final color = _parseColor(colorHex);

    final isCanceled = slot['is_canceled'] == true;
    final isSubstituted = slot['is_substituted'] == true;
    final isSwapped = slot['is_swapped'] == true;
    final isExtra = slot['is_extra'] == true;

    if (isCanceled) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: const BoxDecoration(
          color: Color(0xFFF1F5F9),
          border: Border(
            left: BorderSide(color: Color(0xFFCBD5E1), width: 5),
            top: BorderSide(color: Color(0xFFE2E8F0)),
            right: BorderSide(color: Color(0xFFE2E8F0)),
            bottom: BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    color: const Color(0xFFE2E8F0),
                    child: Text(
                      'Period $period',
                      style: const TextStyle(fontSize: 8, fontWeight: FontWeight.bold, color: Color(0xFF64748B)),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    code.isNotEmpty ? '$name ($code)' : name,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8), decoration: TextDecoration.lineThrough),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Time: $start - $end | Canceled Class',
                    style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              color: const Color(0xFFFEE2E2),
              child: const Text(
                'CANCELED',
                style: TextStyle(color: Color(0xFFEF4444), fontSize: 10, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      );
    }

    // Match log entry precisely by period
    final matchLog = _logsForDate.firstWhere(
      (l) {
        final r = l['remarks']?.toString() ?? '';
        return r == 'Period $period';
      },
      orElse: () => null,
    );

    Widget actionArea;
    Color cardBg = Colors.white;

    if (_holidayForDate != null) {
      final holidayName = _holidayForDate!['name'] ?? 'Holiday';
      actionArea = Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        color: const Color(0xFFECFEFF),
        child: Text(
          'HOLIDAY: ${holidayName.toUpperCase()}',
          style: const TextStyle(color: Color(0xFF0891B2), fontSize: 10, fontWeight: FontWeight.bold),
        ),
      );
    } else if (matchLog != null) {
      final status = matchLog['status'] ?? 'Present';
      Color statusColor = const Color(0xFF16A34A);
      Color badgeBg = const Color(0xFFDCFCE7);

      if (status == 'Absent') {
        statusColor = const Color(0xFFEF4444);
        badgeBg = const Color(0xFFFEE2E2);
        cardBg = const Color(0xFFFFFDFD);
      } else if (status == 'On Duty') {
        statusColor = const Color(0xFF2563EB);
        badgeBg = const Color(0xFFEFF6FF);
        cardBg = const Color(0xFFFDFEFF);
      } else if (status == 'Medical Leave') {
        statusColor = const Color(0xFFD97706);
        badgeBg = const Color(0xFFFEF3C7);
      } else if (status == 'Holiday') {
        statusColor = const Color(0xFF0891B2);
        badgeBg = const Color(0xFFECFEFF);
      }

      actionArea = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            color: badgeBg,
            child: Text(
              status.toUpperCase(),
              style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              side: const BorderSide(color: Color(0xFF94A3B8)),
              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            ),
            onPressed: () => _deleteMarking(matchLog['id'].toString()),
            child: const Text('Reset', style: TextStyle(fontSize: 10, color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
          ),
        ],
      );
    } else {
      actionArea = Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _quickMarkButton('Present', const Color(0xFF16A34A), () => _markQuick(slot['subject_id'].toString(), period, 'Present')),
          const SizedBox(width: 4),
          _quickMarkButton('Absent', const Color(0xFFEF4444), () => _markQuick(slot['subject_id'].toString(), period, 'Absent')),
          const SizedBox(width: 4),
          _quickMarkButton('OD', const Color(0xFF2563EB), () => _markQuick(slot['subject_id'].toString(), period, 'On Duty')),
        ],
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: cardBg,
        border: Border(
          left: BorderSide(color: color, width: 5),
          top: const BorderSide(color: Color(0xFFE2E8F0)),
          right: const BorderSide(color: Color(0xFFE2E8F0)),
          bottom: const BorderSide(color: Color(0xFFE2E8F0)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      color: color.withValues(alpha: 0.1),
                      child: Text(
                        'Period $period',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      code.isNotEmpty ? '$name ($code)' : name,
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Time: $start - $end | Room: $room',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              actionArea,
            ],
          ),
          if (isSubstituted) ...[
            const SizedBox(height: 8),
            Text(
              '★ Substituted from ${slot['original_subject_name']}',
              style: const TextStyle(color: Color(0xFFD97706), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
          if (isSwapped) ...[
            const SizedBox(height: 8),
            Text(
              '⇆ ${slot['swap_period_details']}',
              style: const TextStyle(color: Color(0xFF0891B2), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
          if (isExtra) ...[
            const SizedBox(height: 8),
            const Text(
              '✚ Extra Period',
              style: TextStyle(color: Color(0xFF16A34A), fontSize: 11, fontWeight: FontWeight.w600),
            ),
          ],
        ],
      ),
    );
  }

  Widget _quickMarkButton(String label, Color color, VoidCallback onTap) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        side: BorderSide(color: color, width: 1),
        shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      ),
      onPressed: onTap,
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildEmptyDaySlots(String day) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 50),
        child: Column(
          children: [
            const Icon(Icons.weekend_outlined, size: 40, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            Text(
              'No classes scheduled for $day',
              style: const TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 4),
            const Text('Enjoy your day off or select another date.', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11)),
          ],
        ),
      ),
    );
  }

  Widget _buildHistoryTab() {
    if (_loadingHistory) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)));
    }
    if (_historyLogs.isEmpty) {
      return _emptyHistory();
    }
    return RefreshIndicator(
      onRefresh: _loadHistoryLogs,
      color: const Color(0xFF2563EB),
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _historyLogs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, i) {
          final log = _historyLogs[i];
          final subjectName = log['subject_name'] ?? 'Unknown Subject';
          final status = log['status'] ?? 'Present';
          final remarks = log['remarks'] ?? '';
          final dateRaw = log['date'] ?? '';
          
          DateTime? dateParsed;
          try {
            dateParsed = DateTime.parse(dateRaw);
          } catch (_) {}
          
          final dateStr = dateParsed != null ? DateFormat('EEEE, MMM d, yyyy').format(dateParsed) : dateRaw;

          Color statusCol = const Color(0xFF16A34A);
          if (status == 'Absent') statusCol = const Color(0xFFEF4444);
          if (status == 'On Duty') statusCol = const Color(0xFF2563EB);
          if (status == 'Medical Leave') statusCol = const Color(0xFFD97706);

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
                      const SizedBox(height: 8),
                      Text(
                        subjectName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF0F172A)),
                      ),
                      if (remarks.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          remarks,
                          style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444), size: 20),
                  onPressed: () => _confirmResetMarking(log['id'].toString()),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Future<void> _confirmResetMarking(String logId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        title: const Text('Reset Marking', style: TextStyle(fontWeight: FontWeight.bold)),
        content: const Text('Reset this attendance log? This will update stats immediately.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(dialogCtx).pop(false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444), foregroundColor: Colors.white),
            onPressed: () => Navigator.of(dialogCtx).pop(true),
            child: const Text('Reset'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _deleteMarking(logId);
    }
  }

  Widget _emptyHistory() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 60),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.history_edu_outlined, size: 48, color: Color(0xFFCBD5E1)),
            const SizedBox(height: 12),
            const Text(
              'No attendance logs logged yet',
              style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 6),
            const Text(
              'Logs will appear here once you mark scheduled class slots in the checklist.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
            ),
          ],
        ),
      ),
    );
  }

  Color _parseColor(String? colorStr) {
    if (colorStr == null || colorStr.isEmpty) return const Color(0xFF64748B);
    try {
      if (colorStr.startsWith('#')) {
        return Color(int.parse(colorStr.replaceFirst('#', '0xFF')));
      }
    } catch (_) {}
    return const Color(0xFF64748B);
  }
}
