import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../core/app_lock_service.dart';

/// Lock screen shown when app lock is enabled and app resumes from background.
class LockScreen extends StatefulWidget {
  const LockScreen({super.key});

  @override
  State<LockScreen> createState() => _LockScreenState();
}

class _LockScreenState extends State<LockScreen> {
  String _pin = '';
  bool _error = false;

  static const _maxLen = 4;

  @override
  void initState() {
    super.initState();
    // Auto-trigger biometrics on open if enabled
    WidgetsBinding.instance.addPostFrameCallback((_) => _tryBiometric());
  }

  Future<void> _tryBiometric() async {
    final svc = context.read<AppLockService>();
    if (svc.biometricEnabled && svc.biometricAvailable) {
      await svc.authenticateWithBiometrics();
    }
  }

  void _onDigit(String d) {
    if (_pin.length >= _maxLen) return;
    setState(() {
      _pin += d;
      _error = false;
    });
    if (_pin.length == _maxLen) _submit();
  }

  void _onDelete() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    final svc = context.read<AppLockService>();
    final ok = await svc.authenticateWithPin(_pin);
    if (!ok) {
      setState(() { _pin = ''; _error = true; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final svc = context.watch<AppLockService>();
    return Scaffold(
      backgroundColor: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            // Logo
            Container(
              width: 64, height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFF2563EB),
                borderRadius: BorderRadius.zero,
              ),
              child: Icon(Icons.lock_outline_rounded, color: Colors.white, size: 32),
            ),
            SizedBox(height: 20),
            Text('Trackify', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
            SizedBox(height: 8),
            Text('Enter your 4-digit PIN', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14)),

            SizedBox(height: 36),

            // PIN dots
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_maxLen, (i) {
                final filled = i < _pin.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: EdgeInsets.symmetric(horizontal: 10),
                  width: 16, height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _error
                        ? const Color(0xFFEF4444)
                        : filled
                            ? const Color(0xFF2563EB)
                            : const Color(0xFF334155),
                  ),
                );
              }),
            ),

            if (_error) ...[
              SizedBox(height: 12),
              Text('Incorrect PIN. Try again.', style: TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
            ],

            const Spacer(),

            // Keypad
            Padding(
              padding: EdgeInsets.symmetric(horizontal: 48),
              child: Column(
                children: [
                  for (final row in [['1','2','3'], ['4','5','6'], ['7','8','9']])
                    Row(
                      children: row.map((d) => Expanded(child: _DigitKey(digit: d, onTap: _onDigit))).toList(),
                    ),
                  Row(
                    children: [
                      // Biometric button
                      Expanded(
                        child: svc.biometricEnabled && svc.biometricAvailable
                            ? _IconKey(
                                icon: Icons.fingerprint_rounded,
                                onTap: _tryBiometric,
                                color: const Color(0xFF2563EB),
                              )
                            : SizedBox(),
                      ),
                      Expanded(child: _DigitKey(digit: '0', onTap: _onDigit)),
                      Expanded(
                        child: _IconKey(
                          icon: Icons.backspace_outlined,
                          onTap: _onDelete,
                          color: const Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _DigitKey extends StatelessWidget {
  final String digit;
  final void Function(String) onTap;
  const _DigitKey({required this.digit, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(40),
        onTap: () => onTap(digit),
        child: Container(
          height: 64,
          decoration: BoxDecoration(
            color: const Color(0xFF000000),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(digit, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: Colors.white)),
          ),
        ),
      ),
    );
  }
}

class _IconKey extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final Color color;
  const _IconKey({required this.icon, required this.onTap, required this.color});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(8),
      child: InkWell(
        borderRadius: BorderRadius.circular(40),
        onTap: onTap,
        child: SizedBox(
          height: 64,
          child: Center(child: Icon(icon, color: color, size: 28)),
        ),
      ),
    );
  }
}