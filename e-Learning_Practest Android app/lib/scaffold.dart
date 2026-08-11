import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'theme.dart';
import 'widgets.dart';

/// App theme controller — persisted in SharedPreferences.
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

  Future<void> toggle() async {
    _mode = _mode == AppThemeMode.dark ? AppThemeMode.light : AppThemeMode.dark;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_prefKey, _mode == AppThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }
}

/// Aurora backdrop — two drifting blurred orbs, mirroring the SPA's CSS.
class AuroraBackground extends StatelessWidget {
  const AuroraBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      color: c.bg,
      child: Stack(
        children: [
          Positioned(
            top: -MediaQuery.sizeOf(context).height * 0.18,
            right: -MediaQuery.sizeOf(context).width * 0.25,
            child: _Orb(color: c.bgAccent1, size: 460),
          ),
          Positioned(
            top: -MediaQuery.sizeOf(context).height * 0.12,
            right: MediaQuery.sizeOf(context).width * 0.1,
            child: _Orb(color: c.bgAccent3, size: 360),
          ),
          Positioned(
            bottom: -MediaQuery.sizeOf(context).height * 0.16,
            left: -MediaQuery.sizeOf(context).width * 0.22,
            child: _Orb(color: c.bgAccent2, size: 420),
          ),
          child,
        ],
      ),
    );
  }
}

class _Orb extends StatefulWidget {
  const _Orb({required this.color, required this.size});

  final Color color;
  final double size;

  @override
  State<_Orb> createState() => _OrbState();
}

class _OrbState extends State<_Orb> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<Offset> _drift;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 26),
    )..repeat(reverse: true);
    _scale = Tween(begin: 1.0, end: 1.12).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _drift = Tween<Offset>(begin: Offset.zero, end: const Offset(-24, 20))
        .animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => Transform.translate(
        offset: _drift.value,
        child: Transform.scale(
          scale: _scale.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [widget.color.withValues(alpha: 0.55), Colors.transparent],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Floating theme toggle — bottom-right, visible everywhere (SPA parity).
class ThemeToggleButton extends StatelessWidget {
  const ThemeToggleButton({super.key});

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final theme = context.watch<ThemeController>();
    return Positioned(
      right: 18,
      bottom: 18,
      child: InkWell(
        onTap: theme.toggle,
        borderRadius: BorderRadius.circular(23),
        child: Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: c.panelBg,
            borderRadius: BorderRadius.circular(23),
            border: Border.all(color: c.border),
            boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.25), blurRadius: 24, offset: const Offset(0, 12))],
          ),
          child: Icon(
            theme.isDark ? Icons.wb_sunny_outlined : Icons.dark_mode_outlined,
            size: 20,
            color: c.textPrimary,
          ),
        ),
      ),
    );
  }
}

/// Screen scaffold with aurora background + optional theme toggle.
class AppScaffold extends StatelessWidget {
  const AppScaffold({
    super.key,
    required this.child,
    this.showThemeToggle = true,
    this.safeArea = true,
  });

  final Widget child;
  final bool showThemeToggle;
  final bool safeArea;

  @override
  Widget build(BuildContext context) {
    return AuroraBackground(
      child: Material(
        type: MaterialType.transparency,
        child: Stack(
          children: [
            Positioned.fill(
              child: safeArea
                  ? SafeArea(child: child)
                  : Padding(
                      // Keep the aurora full-bleed but still clear the status
                      // bar/notch so headers never collide with it.
                      padding: EdgeInsets.only(
                        top: MediaQuery.paddingOf(context).top,
                      ),
                      child: child,
                    ),
            ),
            if (showThemeToggle) const ThemeToggleButton(),
          ],
        ),
      ),
    );
  }
}
