import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../core/auth_service.dart';
import '../core/api_client.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _passCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();

  bool _loading = false;
  bool _obscure = true;
  bool _isOtpMode = false;
  bool _otpSent = false;
  String? _error;
  String? _success;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _passCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    setState(() { _loading = true; _error = null; _success = null; });
    final err = await context.read<AuthService>().login(
      _emailCtrl.text.trim(),
      _passCtrl.text,
    );
    if (mounted) {
      setState(() { _loading = false; _error = err; });
    }
  }

  Future<void> _sendOtp() async {
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Please enter your email address');
      return;
    }

    setState(() { _loading = true; _error = null; _success = null; });
    
    final res = await ApiClient.post('/api/auth/otp/send', {
      'email': email,
      'purpose': 'login',
    });

    if (mounted) {
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          _otpSent = true;
          _success = res['message'] ?? 'Verification code sent successfully.';
        } else {
          _error = res['message'] ?? 'Failed to send verification code.';
        }
      });
    }
  }

  Future<void> _verifyOtpLogin() async {
    final email = _emailCtrl.text.trim();
    final otp = _otpCtrl.text.trim();

    if (otp.length != 6) {
      setState(() => _error = 'Please enter a valid 6-digit verification code');
      return;
    }

    setState(() { _loading = true; _error = null; _success = null; });

    final err = await context.read<AuthService>().loginWithOtp(email, otp);

    if (mounted) {
      setState(() {
        _loading = false;
        _error = err;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: EdgeInsets.symmetric(horizontal: 24, vertical: 40),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Logo
                Center(
                  child: Column(
                    children: [
                      Container(
                        width: 56,
                        height: 56,
                        decoration: const BoxDecoration(
                          color: Color(0xFF2563EB),
                        ),
                        child: Icon(Icons.check_circle_outline_rounded, color: Colors.white, size: 30),
                      ),
                      SizedBox(height: 16),
                      Text(
                        'Trackify',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: Theme.of(context).brightness == Brightness.dark ? Colors.white : const Color(0xFF0F172A),
                          letterSpacing: -0.5,
                        ),
                      ),
                      SizedBox(height: 6),
                      Text(
                        _isOtpMode ? 'Sign in using verification code' : 'Sign in to your student account',
                        style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                      ),
                    ],
                  ),
                ),

                SizedBox(height: 40),

                // Error Banner
                if (_error != null) ...[
                  Container(
                    padding: EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEF2F2),
                      border: Border.all(color: const Color(0xFFFCA5A5)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 18),
                        SizedBox(width: 8),
                        Expanded(child: Text(_error!, style: TextStyle(color: Color(0xFFB91C1C), fontSize: 13))),
                        IconButton(
                          icon: Icon(Icons.copy_rounded, color: Color(0xFFEF4444), size: 18),
                          tooltip: 'Copy Error',
                          onPressed: () {
                            Clipboard.setData(ClipboardData(text: ApiClient.lastError ?? _error ?? ''));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Error details copied to clipboard!')),
                            );
                          },
                          constraints: const BoxConstraints(),
                          padding: EdgeInsets.zero,
                        ),
                      ],
                    ),
                  ),
                  SizedBox(height: 16),
                ],

                // Success Banner
                if (_success != null) ...[
                  Container(
                    padding: EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF0FDF4),
                      border: Border.all(color: const Color(0xFFBBF7D0)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle_outline_rounded, color: Color(0xFF16A34A), size: 18),
                        SizedBox(width: 8),
                        Expanded(child: Text(_success!, style: TextStyle(color: Color(0xFF166534), fontSize: 13))),
                      ],
                    ),
                  ),
                  SizedBox(height: 16),
                ],

                // Email Field
                _label('Email Address'),
                SizedBox(height: 6),
                TextField(
                  controller: _emailCtrl,
                  keyboardType: TextInputType.emailAddress,
                  readOnly: _otpSent,
                  autocorrect: false,
                  decoration: _inputDeco('you@university.edu', Icons.alternate_email_rounded),
                ),
                SizedBox(height: 16),

                // Password Field or OTP code field
                if (!_isOtpMode) ...[
                  _label('Password'),
                  SizedBox(height: 6),
                  TextField(
                    controller: _passCtrl,
                    obscureText: _obscure,
                    decoration: _inputDeco('••••••••', Icons.lock_outline_rounded).copyWith(
                      suffixIcon: IconButton(
                        icon: Icon(_obscure ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20, color: const Color(0xFF94A3B8)),
                        onPressed: () => setState(() => _obscure = !_obscure),
                      ),
                    ),
                    onSubmitted: (_) => _login(),
                  ),
                ] else if (_otpSent) ...[
                  _label('Verification Code (OTP)'),
                  SizedBox(height: 6),
                  TextField(
                    controller: _otpCtrl,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    decoration: _inputDeco('e.g. 123456', Icons.password_rounded).copyWith(counterText: ''),
                    onSubmitted: (_) => _verifyOtpLogin(),
                  ),
                  SizedBox(height: 8),
                  Text(
                    'Note: Please check your spam or junk mail folder if you do not receive the email in a few minutes.',
                    style: TextStyle(fontSize: 11, color: Color(0xFF64748B), fontStyle: FontStyle.italic),
                  ),
                ],

                SizedBox(height: 28),

                // Login Button
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton(
                    onPressed: _loading ? null : (_isOtpMode ? (_otpSent ? _verifyOtpLogin : _sendOtp) : _login),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
                      elevation: 0,
                    ),
                    child: _loading
                        ? SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : Text(_isOtpMode ? (_otpSent ? 'Verify & Sign In' : 'Send Verification OTP') : 'Sign In', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),

                SizedBox(height: 16),

                // Secondary toggle actions
                Center(
                  child: Column(
                    children: [
                      TextButton(
                        onPressed: () {
                          setState(() {
                            _isOtpMode = !_isOtpMode;
                            _otpSent = false;
                            _error = null;
                            _success = null;
                          });
                        },
                        child: Text(
                          _isOtpMode ? 'Sign In with Password' : 'Sign In with OTP',
                          style: TextStyle(color: Color(0xFF2563EB), fontSize: 13, fontWeight: FontWeight.bold),
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push('/forgot-password'),
                        child: Text('Forgot password?', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _label(String text) => Text(
        text,
        style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF374151)),
      );

  InputDecoration _inputDeco(String hint, IconData icon) => InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: Color(0xFFCBD5E1)),
        prefixIcon: Icon(icon, size: 18, color: const Color(0xFF94A3B8)),
        filled: true,
        fillColor: Colors.white,
        contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: const OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: Color(0xFFE2E8F0)),
        ),
        enabledBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: Color(0xFFE2E8F0)),
        ),
        focusedBorder: const OutlineInputBorder(
          borderRadius: BorderRadius.zero,
          borderSide: BorderSide(color: Color(0xFF2563EB), width: 1.5),
        ),
      );
}