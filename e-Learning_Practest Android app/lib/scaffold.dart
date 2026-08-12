import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';

/// App theme controller — persisted in SharedPreferences.
///
/// The toggle itself no longer floats over every screen. It is a row in the
/// Profile tab, because a control that is visible everywhere is a control the
/// student trips over during a timed paper.
class ThemeController extends ChangeNotifier {
  ThemeController._();
  static final ThemeController instance = ThemeController._();

  static const _prefKey = 'theme_mode';
  AppThemeMode _mode = AppThemeMode.dark;

  AppThemeMode get mode => _mode;
  bool get isDark => _mode == AppThemeMode.dark;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_prefKey);
    _mode = saved == 'light' ? AppThemeMode.light : AppThemeMode.dark;
    notifyListeners();
  }

  Future<void> setDark(bool dark) async {
    final next = dark ? AppThemeMode.dark : AppThemeMode.light;
    if (next == _mode) return;
    _mode = next;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, dark ? 'dark' : 'light');
    notifyListeners();
  }

  Future<void> toggle() => setDark(!isDark);
}

/// The ground every screen stands on.
///
/// This used to be an aurora — two blurred orbs drifting on a 26-second loop,
/// behind everything, forever. It cost a permanent GPU frame on exactly the
/// devices that can least afford one, it sat behind a countdown where movement
/// is a distraction, and because it never settled it made `pumpAndSettle`
/// unusable in tests. It is a flat surface now.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.child,
    this.safeArea = true,
    this.bottomBar,
    this.color,
  });

  final Widget child;
  final bool safeArea;
  final Widget? bottomBar;

  /// Overrides the ground — used by the test engine, which sits on the deepest
  /// surface so its fixed bars read as chrome rather than as cards.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Material(
      color: color ?? c.bg,
      child: Column(
        children: [
          Expanded(
            child: safeArea
                ? SafeArea(bottom: bottomBar == null, child: child)
                : Padding(
                    // Clear the status bar/notch so headers never collide with
                    // it, without claiming the bottom inset the bar owns.
                    padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
                    child: child,
                  ),
          ),
          if (bottomBar != null) bottomBar!,
        ],
      ),
    );
  }
}
