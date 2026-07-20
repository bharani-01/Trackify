import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ShellScaffold extends StatelessWidget {
  final Widget child;
  const ShellScaffold({super.key, required this.child});

  static const _tabs = [
    (icon: Icons.grid_view_rounded, label: 'Dashboard', path: '/dashboard'),
    (icon: Icons.playlist_add_check_rounded, label: 'Attendance', path: '/attendance'),
    (icon: Icons.calendar_today_rounded, label: 'Time Table', path: '/timetable'),
    (icon: Icons.person_outline_rounded, label: 'Profile', path: '/profile'),
  ];

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _tabs.indexWhere((t) => t.path == location).clamp(0, 3);

    return PopScope(
      canPop: currentIndex == 0,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        context.go('/dashboard');
      },
      child: Scaffold(
        body: child,
        bottomNavigationBar: Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
          ),
          child: SafeArea(
            top: false,
            child: SizedBox(
              height: 60,
              child: Row(
                children: List.generate(_tabs.length, (i) {
                  final tab = _tabs[i];
                  final active = i == currentIndex;
                  
                  return Expanded(
                    child: Ink(
                      color: Colors.white,
                      child: InkWell(
                        onTap: () => context.go(tab.path),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              height: 3,
                              width: 44,
                              color: active ? const Color(0xFF2563EB) : Colors.transparent,
                            ),
                            const Spacer(),
                            Icon(
                              tab.icon,
                              size: 22,
                              color: active ? const Color(0xFF2563EB) : const Color(0xFF475569),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              tab.label,
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                                color: active ? const Color(0xFF2563EB) : const Color(0xFF475569),
                              ),
                            ),
                            const Spacer(),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
