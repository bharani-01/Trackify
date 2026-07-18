import 'package:go_router/go_router.dart';
import 'core/auth_service.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/attendance_screen.dart';
import 'screens/timetable_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/subjects_screen.dart';
import 'screens/calculator_screen.dart';
import 'screens/settings_screen.dart';
import 'screens/legal_content.dart';
import 'widgets/shell_scaffold.dart';

GoRouter buildRouter(AuthService auth) {
  return GoRouter(
    refreshListenable: auth,
    initialLocation: '/dashboard',
    redirect: (context, state) {
      final loggedIn = auth.isAuthenticated;
      final loading = auth.loading;
      if (loading) return null;
      final onLogin = state.matchedLocation == '/login';
      if (!loggedIn && !onLogin) return '/login';
      if (loggedIn && onLogin) return '/dashboard';
      return null;
    },
    routes: [
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      ShellRoute(
        builder: (context, state, child) => ShellScaffold(child: child),
        routes: [
          GoRoute(path: '/dashboard', builder: (_, __) => const DashboardScreen()),
          GoRoute(path: '/attendance', builder: (_, __) => const AttendanceScreen()),
          GoRoute(path: '/timetable', builder: (_, __) => const TimetableScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: '/subjects', builder: (_, __) => const SubjectsScreen()),
          GoRoute(path: '/calculator', builder: (_, __) => const CalculatorScreen()),
          GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),
          GoRoute(path: '/privacy-policy', builder: (_, __) => privacyPolicyScreen),
          GoRoute(path: '/terms', builder: (_, __) => termsScreen),
        ],
      ),
    ],
  );
}
