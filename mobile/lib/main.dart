import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'dart:ui';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'core/auth_service.dart';
import 'core/app_lock_service.dart';
import 'core/theme_service.dart';
import 'core/api_client.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');

  // Log uncaught Flutter framework errors to remote DB audit logs
  FlutterError.onError = (FlutterErrorDetails details) {
    FlutterError.presentError(details);
    ApiClient.logRemoteError(
      'FlutterError: ${details.exception}',
      details.stack?.toString() ?? 'No stacktrace available',
    );
  };

  // Log uncaught Dart asynchronous errors to remote DB audit logs
  PlatformDispatcher.instance.onError = (Object error, StackTrace stack) {
    ApiClient.logRemoteError(
      'PlatformError: $error',
      stack.toString(),
    );
    return true;
  };

  final authService = AuthService();
  final appLockService = AppLockService();
  final themeService = ThemeService();

  await Future.wait([
    authService.tryAutoLogin(),
    appLockService.init(),
    themeService.init(),
  ]);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: authService),
        ChangeNotifierProvider.value(value: appLockService),
        ChangeNotifierProvider.value(value: themeService),
      ],
      child: const TrackifyApp(),
    ),
  );
}

class TrackifyApp extends StatefulWidget {
  const TrackifyApp({super.key});

  @override
  State<TrackifyApp> createState() => _TrackifyAppState();
}

class _TrackifyAppState extends State<TrackifyApp> with WidgetsBindingObserver {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _router = buildRouter(context.read<AuthService>());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Lock the app when it goes to background
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.hidden) {
      context.read<AppLockService>().lock();
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final appLock = context.watch<AppLockService>();
    final themeSvc = context.watch<ThemeService>();

    final app = MaterialApp.router(
      title: dotenv.env['APP_NAME'] ?? 'Trackify',
      debugShowCheckedModeBanner: false,
      themeMode: themeSvc.themeMode,
      theme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
          scrolledUnderElevation: 0,
          shadowColor: Colors.transparent,
          shape: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
        ),
        cardTheme: const CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Colors.white,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: Color(0xFFE2E8F0)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: Color(0xFFE2E8F0)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: Color(0xFF2563EB), width: 1.5),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            elevation: 0,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            elevation: 0,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
          ),
        ),
        chipTheme: const ChipThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
        dialogTheme: const DialogThemeData(
          backgroundColor: Colors.white,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
        bottomSheetTheme: const BottomSheetThemeData(
          backgroundColor: Colors.white,
          modalBarrierColor: Colors.black26,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        fontFamily: 'Inter',
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF000000), // Deep black theme matching web
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xFF000000), // Pure black appBar
          foregroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0,
          shadowColor: Colors.transparent,
          shape: Border(bottom: BorderSide(color: const Color(0xFF000000))),
        ),
        cardTheme: const CardThemeData(
          color: Color(0xFF000000), // Pure black card background
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: BorderSide(color: Color(0xFF334155)),
          ),
        ),
        inputDecorationTheme: const InputDecorationTheme(
          filled: true,
          fillColor: Color(0xFF000000), // Pure black input fields
          border: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: Color(0xFF334155)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: Color(0xFF334155)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.zero,
            borderSide: BorderSide(color: Color(0xFF2563EB), width: 1.5),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            elevation: 0,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          ),
        ),
        outlinedButtonTheme: OutlinedButtonThemeData(
          style: OutlinedButton.styleFrom(
            elevation: 0,
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
            side: const BorderSide(color: Color(0xFF334155)),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 20),
          ),
        ),
        textButtonTheme: TextButtonThemeData(
          style: TextButton.styleFrom(
            shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
          ),
        ),
        chipTheme: const ChipThemeData(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.zero,
            side: BorderSide(color: Color(0xFF334155)),
          ),
        ),
        dialogTheme: const DialogThemeData(
          backgroundColor: Color(0xFF000000), // Pure black dialogs
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
        bottomSheetTheme: const BottomSheetThemeData(
          backgroundColor: Color(0xFF000000), // Pure black bottom sheets
          modalBarrierColor: Colors.black54,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.zero),
        ),
      ),
      routerConfig: _router,
    );

    // Show lock screen on top of the app if locked
    if (appLock.lockEnabled && appLock.isLocked) {
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: ThemeData(useMaterial3: true),
        home: const _LockOverlay(),
      );
    }

    return app;
  }
}

class _LockOverlay extends StatefulWidget {
  const _LockOverlay();

  @override
  State<_LockOverlay> createState() => _LockOverlayState();
}

class _LockOverlayState extends State<_LockOverlay> {
  String _pin = '';
  bool _error = false;
  static const _maxLen = 4;

  @override
  void initState() {
    super.initState();
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
    setState(() { _pin += d; _error = false; });
    if (_pin.length == _maxLen) _submit();
  }

  void _onDelete() {
    if (_pin.isEmpty) return;
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  Future<void> _submit() async {
    final ok = await context.read<AppLockService>().authenticateWithPin(_pin);
    if (!ok) setState(() { _pin = ''; _error = true; });
  }

  @override
  Widget build(BuildContext context) {
    final svc = context.watch<AppLockService>();
    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: SafeArea(
        child: Column(
          children: [
            const Spacer(),
            Container(
              width: 64, height: 64,
              decoration: const BoxDecoration(
                color: Color(0xFF2563EB),
                borderRadius: BorderRadius.zero,
              ),
              child: const Icon(Icons.lock_outline_rounded, color: Colors.white, size: 32),
            ),
            const SizedBox(height: 20),
            const Text('Trackify', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: Colors.white)),
            const SizedBox(height: 8),
            const Text('Enter your 4-digit PIN', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 14)),
            const SizedBox(height: 36),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(_maxLen, (i) {
                final filled = i < _pin.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 10),
                  width: 16, height: 16,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: _error ? const Color(0xFFEF4444)
                        : filled ? const Color(0xFF2563EB) : const Color(0xFF334155),
                  ),
                );
              }),
            ),
            if (_error) ...[
              const SizedBox(height: 12),
              const Text('Incorrect PIN. Try again.', style: TextStyle(color: Color(0xFFEF4444), fontSize: 13)),
            ],
            const Spacer(),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 48),
              child: Column(
                children: [
                  for (final row in [['1','2','3'],['4','5','6'],['7','8','9']])
                    Row(children: row.map((d) => Expanded(child: _DigitBtn(d, _onDigit))).toList()),
                  Row(
                    children: [
                      Expanded(
                        child: svc.biometricEnabled && svc.biometricAvailable
                            ? _IconBtn(Icons.fingerprint_rounded, _tryBiometric, const Color(0xFF2563EB))
                            : const SizedBox(),
                      ),
                      Expanded(child: _DigitBtn('0', _onDigit)),
                      Expanded(child: _IconBtn(Icons.backspace_outlined, _onDelete, const Color(0xFF64748B))),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}

class _DigitBtn extends StatelessWidget {
  final String d;
  final void Function(String) onTap;
  const _DigitBtn(this.d, this.onTap);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(8),
    child: InkWell(
      borderRadius: BorderRadius.circular(40),
      onTap: () => onTap(d),
      child: Container(
        height: 64, width: 64,
        decoration: const BoxDecoration(color: const Color(0xFF000000), shape: BoxShape.circle),
        child: Center(child: Text(d, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: Colors.white))),
      ),
    ),
  );
}

class _IconBtn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  final Color color;
  const _IconBtn(this.icon, this.onTap, this.color);

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.all(8),
    child: InkWell(
      borderRadius: BorderRadius.circular(40),
      onTap: onTap,
      child: SizedBox(height: 64, child: Center(child: Icon(icon, color: color, size: 28))),
    ),
  );
}
