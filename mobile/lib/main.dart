import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:provider/provider.dart';
import 'core/auth_service.dart';
import 'router.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await dotenv.load(fileName: '.env');
  runApp(
    ChangeNotifierProvider(
      create: (_) => AuthService()..tryAutoLogin(),
      child: const TrackifyApp(),
    ),
  );
}

class TrackifyApp extends StatelessWidget {
  const TrackifyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return MaterialApp.router(
      title: dotenv.env['APP_NAME'] ?? 'Trackify',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          brightness: Brightness.light,
        ),
        fontFamily: 'Inter',
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF0F172A),
          elevation: 0,
          scrolledUnderElevation: 1,
          shadowColor: Color(0x0D000000),
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
      ),
      routerConfig: buildRouter(auth),
    );
  }
}
