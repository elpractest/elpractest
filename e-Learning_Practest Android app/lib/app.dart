import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'scaffold.dart';
import 'screens/dashboard_screen.dart';
import 'screens/intro_screen.dart';
import 'screens/splash_screen.dart';
import 'session.dart';
import 'theme.dart';

class PractestApp extends StatelessWidget {
  const PractestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ThemeController>.value(value: ThemeController.instance),
        ChangeNotifierProvider<Session>.value(value: Session.instance),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, _) {
          final dark = AppTheme.build(AppThemeMode.dark);
          final light = AppTheme.build(AppThemeMode.light);
          return MaterialApp(
            title: 'Practest',
            debugShowCheckedModeBanner: false,
            // `theme` is Flutter's LIGHT slot and `darkTheme` its dark one.
            // These were crossed, so ThemeMode.dark resolved to the light
            // palette and the toggle did the opposite of what its icon said.
            theme: light,
            darkTheme: dark,
            themeMode: theme.isDark ? ThemeMode.dark : ThemeMode.light,
            home: const RootGate(),
          );
        },
      ),
    );
  }
}

/// Decides what the app shows at the root: the launch animation first, then
/// either the logged-out intro or the dashboard.
///
/// The splash is not a loading spinner — `Session.init()` has already finished
/// by the time `runApp` is called, so the auth status is known immediately. The
/// splash plays for its own sake, and is deliberately gated on nothing so it
/// cannot become a place the app can get stuck.
class RootGate extends StatefulWidget {
  const RootGate({super.key});

  @override
  State<RootGate> createState() => _RootGateState();
}

class _RootGateState extends State<RootGate> {
  bool _splashDone = false;

  @override
  Widget build(BuildContext context) {
    if (!_splashDone) {
      return SplashScreen(
        onDone: () {
          if (mounted) setState(() => _splashDone = true);
        },
      );
    }

    final session = context.watch<Session>();
    // Cross-fade rather than cut: the aurora backdrop is shared, so only the
    // content changes and the transition reads as one continuous screen.
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 420),
      child: switch (session.status) {
        // Only reachable if a token refresh is in flight; the intro is the
        // honest thing to show while that resolves.
        AuthStatus.loading => const IntroScreen(key: ValueKey('intro')),
        AuthStatus.unauthenticated => const IntroScreen(key: ValueKey('intro')),
        AuthStatus.authenticated =>
          const DashboardScreen(key: ValueKey('dashboard')),
      },
    );
  }
}
