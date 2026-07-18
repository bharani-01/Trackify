import 'package:flutter/material.dart';
import '../core/api_client.dart';

class CalculatorScreen extends StatefulWidget {
  const CalculatorScreen({super.key});

  @override
  State<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends State<CalculatorScreen> {
  Map<String, dynamic>? _stats;
  bool _loading = true;
  double _customTarget = 80;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final res = await ApiClient.get('/api/attendance/stats');
    if (mounted) {
      setState(() {
        _stats = res['success'] == true ? res['stats'] : null;
        if (_stats != null) {
          _customTarget = (_stats!['targetPercentage'] ?? 80).toDouble();
        }
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        title: Text('Attendance Predictor', style: TextStyle(fontWeight: FontWeight.w800)),
        elevation: 0,
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : _stats == null
              ? _error()
              : _buildContent(),
    );
  }

  Widget _buildContent() {
    final present = ((_stats!['totalPresent'] ?? 0) + (_stats!['totalOD'] ?? 0)) as int;
    final conducted = (_stats!['totalConducted'] ?? 0) as int;
    final overallPercentage = conducted > 0 ? (present / conducted) * 100 : 100.0;

    // Calculate predictions based on _customTarget
    String status = 'Safe';
    int classesNeeded = 0;
    int safeAbsences = 0;

    if (overallPercentage < _customTarget) {
      final numerator = (_customTarget * conducted) - (100 * present);
      final denominator = 100 - _customTarget;
      status = 'Below Target';
      classesNeeded = denominator > 0 ? (numerator / denominator).ceil() : 0;
      if (classesNeeded < 0) classesNeeded = 0;
    } else {
      final numerator = (100 * present) - (_customTarget * conducted);
      status = 'Above Target';
      safeAbsences = _customTarget > 0 ? (numerator / _customTarget).floor() : 0;
      if (safeAbsences < 0) safeAbsences = 0;
    }

    final isBelow = status == 'Below Target';

    return RefreshIndicator(
      onRefresh: _load,
      color: const Color(0xFF2563EB),
      child: ListView(
        padding: EdgeInsets.all(16),
        children: [
          // Stat card
          Container(
            padding: EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,
              border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: Column(
              children: [
                Text('Current Overall Attendance', style: TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
                SizedBox(height: 8),
                Text(
                  '${overallPercentage.toStringAsFixed(1)}%',
                  style: TextStyle(
                    fontSize: 44,
                    fontWeight: FontWeight.w900,
                    color: overallPercentage >= _customTarget ? const Color(0xFF16A34A) : const Color(0xFFEF4444),
                  ),
                ),
                SizedBox(height: 6),
                Text('$present present out of $conducted total classes', style: TextStyle(fontSize: 13, color: Color(0xFF64748B))),
              ],
            ),
          ),
          SizedBox(height: 20),

          // Custom Target Slider
          Container(
            padding: EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF000000) : Colors.white,
              border: Border.all(color: Theme.of(context).brightness == Brightness.dark ? const Color(0xFF334155) : const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text('Simulate Target Goal', style: TextStyle(fontWeight: FontWeight.w700, color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A))),
                    Text('${_customTarget.round()}%', style: TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF2563EB))),
                  ],
                ),
                SizedBox(height: 8),
                Slider(
                  value: _customTarget,
                  min: 50,
                  max: 100,
                  divisions: 50,
                  activeColor: const Color(0xFF2563EB),
                  inactiveColor: const Color(0xFFE2E8F0),
                  onChanged: (v) => setState(() => _customTarget = v),
                ),
              ],
            ),
          ),
          SizedBox(height: 20),

          // Prediction result card
          Container(
            padding: EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isBelow ? const Color(0xFFFEF2F2) : const Color(0xFFF0FDF4),
              border: Border.all(color: isBelow ? const Color(0xFFFCA5A5) : const Color(0xFFBBF7D0)),
            ),
            child: Row(
              children: [
                Icon(
                  isBelow ? Icons.warning_amber_rounded : Icons.check_circle_outline_rounded,
                  color: isBelow ? const Color(0xFFEF4444) : const Color(0xFF16A34A),
                  size: 32,
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isBelow ? 'Action Required' : 'On Track',
                        style: TextStyle(
                          fontWeight: FontWeight.w800,
                          color: isBelow ? const Color(0xFF991B1B) : const Color(0xFF166534),
                          fontSize: 15,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        isBelow
                            ? 'You need to attend next $classesNeeded classes consecutively to achieve your target.'
                            : 'You can safely skip next $safeAbsences classes without falling below your target.',
                        style: TextStyle(
                          color: isBelow ? const Color(0xFFB91C1C) : const Color(0xFF15803D),
                          fontSize: 13.5,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _error() => Center(
        child: Text('Failed to load predictions. Ensure you have added subjects.', style: TextStyle(color: Color(0xFF64748B))),
      );
}