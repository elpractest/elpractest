import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'i18n.dart';
import 'push_service.dart';
import 'routes.dart';
import 'scaffold.dart';
import 'screens/welcome_screen.dart';
import 'screens/splash_screen.dart';
import 'session.dart';
import 'shell.dart';
import 'theme.dart';

class PractestApp extends StatelessWidget {
  const PractestApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider<ThemeController>.value(value: ThemeController.instance),
        ChangeNotifierProvider<Session>.value(value: Session.instance),
        ChangeNotifierProvider<I18n>.value(value: I18n.instance),
      ],
      child: Consumer<ThemeController>(
        builder: (context, theme, _) {
          return MaterialApp(
            title: 'Practest',
            debugShowCheckedModeBanner: false,
            navigatorKey: appNavigatorKey, // lets push taps deep-link

            // `theme` is Flutter's LIGHT slot and `darkTheme` its dark one.
            // These were crossed once, so ThemeMode.dark resolved to the light
            // palette and the toggle did the opposite of what its icon said.
            theme: AppTheme.build(AppThemeMode.light),
            darkTheme: AppTheme.build(AppThemeMode.dark),
            themeMode: theme.isDark ? ThemeMode.dark : ThemeMode.light,
            onGenerateRoute: Routes.onGenerateRoute,
            home: const RootGate(),
          );
        },
      ),
    );
  }
}

/// Decides what the app shows at the root: the launch animation first, then
/// either the logged-out intro or the four-tab shell.
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
    return AnimatedSwitcher(
      duration: AppTheme.routeDuration,
      child: switch (session.status) {
        // Only reachable if a token refresh is in flight; the intro is the
        // honest thing to show while that resolves.
        AuthStatus.loading => const WelcomeScreen(key: ValueKey('welcome')),
        AuthStatus.unauthenticated => const WelcomeScreen(key: ValueKey('welcome')),
        AuthStatus.authenticated => const HomeShell(key: ValueKey('shell')),
      },
    );
  }
}
