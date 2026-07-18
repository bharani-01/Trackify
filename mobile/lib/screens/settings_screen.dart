import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/api_client.dart';
import '../core/app_lock_service.dart';
import '../core/auth_service.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  // Profile settings
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  bool _savingProfile = false;

  // Attendance settings
  double _minTarget = 80;
  bool _dailyReminders = false;
  String _reminderTime = '21:00';
  bool _lowAttendanceWarn = false;
  bool _loadingSettings = true;
  bool _savingSettings = false;

  @override
  void initState() {
    super.initState();
    final user = context.read<AuthService>().user;
    if (user != null) {
      _nameCtrl.text = user['name'] ?? '';
      _emailCtrl.text = user['email'] ?? '';
    }
    _loadSettings();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    final res = await ApiClient.get('/api/settings');
    if (mounted) {
      setState(() {
        if (res['success'] == true && res['settings'] != null) {
          final s = res['settings'];
          _minTarget = (s['minimum_attendance'] ?? 80).toDouble();
          _dailyReminders = s['daily_reminders'] ?? false;
          _reminderTime = s['email_timer'] ?? '21:00';
          _lowAttendanceWarn = s['low_attendance_warnings'] ?? false;
        }
        _loadingSettings = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    final name = _nameCtrl.text.trim();
    final email = _emailCtrl.text.trim();
    if (name.isEmpty || email.isEmpty) return;

    final authService = context.read<AuthService>();
    setState(() => _savingProfile = true);
    final res = await ApiClient.put('/api/auth/me', {
      'name': name,
      'email': email,
    });
    if (mounted) {
      setState(() => _savingProfile = false);
      if (res['success'] == true) {
        // Trigger auto-login to refresh user profile data locally
        await authService.tryAutoLogin();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Profile details updated successfully')),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Failed to update profile')),
        );
      }
    }
  }

  Future<void> _saveSettings() async {
    setState(() => _savingSettings = true);
    final res = await ApiClient.put('/api/settings', {
      'minimum_attendance': _minTarget.round(),
      'notifications': true,
      'daily_reminders': _dailyReminders,
      'email_timer': _reminderTime,
      'low_attendance_warnings': _lowAttendanceWarn,
    });
    if (mounted) {
      setState(() => _savingSettings = false);
      if (res['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Attendance settings updated successfully')),
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(res['message'] ?? 'Failed to update settings')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appLock = context.watch<AppLockService>();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
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
            const Text('Settings & Configuration', style: TextStyle(fontWeight: FontWeight.w800)),
          ],
        ),
        elevation: 0,
      ),
      body: _loadingSettings
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF2563EB)))
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // Profile Section
                _Section(title: 'Edit Profile details', items: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Column(
                      children: [
                        TextField(
                          controller: _nameCtrl,
                          decoration: const InputDecoration(labelText: 'Full Name', border: UnderlineInputBorder()),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _emailCtrl,
                          decoration: const InputDecoration(labelText: 'Email Address', border: UnderlineInputBorder()),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF2563EB),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                            ),
                            onPressed: _savingProfile ? null : _saveProfile,
                            child: _savingProfile
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                : const Text('Save Profile Details', style: TextStyle(fontWeight: FontWeight.bold)),
                          ),
                        ),
                      ],
                    ),
                  ),
                ]),

                const SizedBox(height: 20),

                // Attendance Settings Section
                _Section(title: 'Attendance Targets', items: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('Target Percentage', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151))),
                            Text('${_minTarget.round()}%', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                          ],
                        ),
                        Slider(
                          value: _minTarget,
                          min: 50,
                          max: 95,
                          divisions: 45,
                          activeColor: const Color(0xFF2563EB),
                          onChanged: (v) => setState(() => _minTarget = v),
                        ),
                      ],
                    ),
                  ),
                  SwitchListTile(
                    title: const Text('Daily Marking Reminder', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Get notified if you forgot to mark attendance', style: TextStyle(fontSize: 11)),
                    value: _dailyReminders,
                    activeThumbColor: const Color(0xFF2563EB),
                    onChanged: (v) => setState(() => _dailyReminders = v),
                  ),
                  if (_dailyReminders)
                    ListTile(
                      title: const Text('Reminder Time', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      trailing: Text(_reminderTime, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                      onTap: () async {
                        final parsedTime = TimeOfDay(
                          hour: int.parse(_reminderTime.split(':')[0]),
                          minute: int.parse(_reminderTime.split(':')[1]),
                        );
                        final picked = await showTimePicker(context: context, initialTime: parsedTime);
                        if (picked != null) {
                          setState(() {
                            final h = picked.hour.toString().padLeft(2, '0');
                            final m = picked.minute.toString().padLeft(2, '0');
                            _reminderTime = '$h:$m';
                          });
                        }
                      },
                    ),
                  SwitchListTile(
                    title: const Text('Low Attendance Alarm', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Alert when attendance falls below target', style: TextStyle(fontSize: 11)),
                    value: _lowAttendanceWarn,
                    activeThumbColor: const Color(0xFF2563EB),
                    onChanged: (v) => setState(() => _lowAttendanceWarn = v),
                  ),
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          side: const BorderSide(color: Color(0xFF2563EB)),
                          shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                        ),
                        onPressed: _savingSettings ? null : _saveSettings,
                        child: _savingSettings
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Save Attendance Configurations', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                      ),
                    ),
                  ),
                ]),

                const SizedBox(height: 20),

                // App Lock Security settings
                _Section(title: 'App Lock & Security', items: [
                  SwitchListTile(
                    title: const Text('Enable Secure App Lock', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                    subtitle: const Text('Lock app using PIN or fingerprint', style: TextStyle(fontSize: 11)),
                    value: appLock.lockEnabled,
                    activeThumbColor: const Color(0xFF2563EB),
                    onChanged: (val) async {
                      if (val) {
                        // User turning it ON -> prompt to set PIN if not set
                        final hasPin = await appLock.hasPin();
                        if (!hasPin) {
                          if (mounted) _setupPinSheet(appLock);
                        } else {
                          await appLock.setLockEnabled(true);
                        }
                      } else {
                        // User turning it OFF
                        await appLock.setLockEnabled(false);
                        await appLock.setBiometricEnabled(false);
                      }
                    },
                  ),
                  if (appLock.lockEnabled) ...[
                    ListTile(
                      title: const Text('Configure / Change PIN', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      trailing: const Icon(Icons.keyboard_arrow_right),
                      onTap: () => _setupPinSheet(appLock),
                    ),
                    if (appLock.biometricAvailable)
                      SwitchListTile(
                        title: const Text('Use Biometric Login', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                        subtitle: const Text('Unlock with Fingerprint or Face ID', style: TextStyle(fontSize: 11)),
                        value: appLock.biometricEnabled,
                        activeThumbColor: const Color(0xFF2563EB),
                        onChanged: (val) async {
                          await appLock.setBiometricEnabled(val);
                        },
                      ),
                  ],
                ]),
                const SizedBox(height: 40),
              ],
            ),
    );
  }

  void _setupPinSheet(AppLockService appLock) {
    final pin1Ctrl = TextEditingController();
    final pin2Ctrl = TextEditingController();
    String error = '';

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
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
                  const Text('Set App Security PIN', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: pin1Ctrl,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    decoration: const InputDecoration(labelText: 'Enter 4-Digit PIN', border: OutlineInputBorder()),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: pin2Ctrl,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    decoration: const InputDecoration(labelText: 'Confirm 4-Digit PIN', border: OutlineInputBorder()),
                  ),
                  if (error.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(error, style: const TextStyle(color: Colors.red, fontSize: 12)),
                  ],
                  const SizedBox(height: 20),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), foregroundColor: Colors.white),
                      onPressed: () async {
                        final p1 = pin1Ctrl.text.trim();
                        final p2 = pin2Ctrl.text.trim();
                        if (p1.length != 4 || p2.length != 4) {
                          setStateSheet(() => error = 'PIN must be exactly 4 digits');
                          return;
                        }
                        if (p1 != p2) {
                          setStateSheet(() => error = 'PINs do not match');
                          return;
                        }

                        await appLock.setPin(p1);
                        await appLock.setLockEnabled(true);
                        if (ctx.mounted) Navigator.pop(ctx);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('App Lock PIN set successfully')),
                          );
                        }
                      },
                      child: const Text('Save PIN', style: TextStyle(fontWeight: FontWeight.bold)),
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
}

class _Section extends StatelessWidget {
  final String title;
  final List<Widget> items;
  const _Section({required this.title, required this.items});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4, bottom: 8),
          child: Text(title.toUpperCase(),
              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 0.8, color: Color(0xFF94A3B8))),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.zero,
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(children: items),
        ),
      ],
    );
  }
}
