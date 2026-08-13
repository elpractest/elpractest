import 'package:flutter/material.dart';

import 'routes.dart';
import 'screens/home_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/results_history_screen.dart';
import 'screens/test_series_screen.dart';
import 'theme.dart';
import 'widgets.dart';

/// The app's persistent navigation.
///
/// There was none. Test series and results — the study path and every past
/// score — lived behind two unlabelled 24 dp glyphs in the dashboard header,
/// which is why two features that were built and paid for were effectively
/// invisible. Four labelled tabs is the whole fix.
///
/// Four, and not one of them a price tier: the field study's six-tab bar failed
/// because three of its tabs were subscription products rather than places.
/// With nothing to sell here, the bar gets to be what it should be — a map.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});

  final int initialTab;

  static const int home = 0;
  static const int series = 1;
  static const int results = 2;
  static const int profile = 3;

  /// Lets a tab hand the student to another tab.
  ///
  /// A notifier rather than an InheritedWidget because the tabs live in an
  /// IndexedStack and are built once: an inherited lookup would give them the
  /// shell's state at build time, which is not when they need to move.
  static final ValueNotifier<int?> request = ValueNotifier<int?>(null);

  static void go(int tab) => request.value = tab;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  late int _index = widget.initialTab;

  @override
  void initState() {
    super.initState();
    HomeShell.request.addListener(_onRequest);
  }

  @override
  void dispose() {
    HomeShell.request.removeListener(_onRequest);
    super.dispose();
  }

  void _onRequest() {
    final tab = HomeShell.request.value;
    if (tab == null || !mounted) return;
    HomeShell.request.value = null;
    setState(() => _index = tab);
  }

  static const _tabs = <_TabSpec>[
    _TabSpec('Home', Icons.home_outlined, Icons.home_rounded),
    _TabSpec('Series', Icons.route_outlined, Icons.route_rounded),
    _TabSpec('Results', Icons.bar_chart_outlined, Icons.bar_chart_rounded),
    _TabSpec('Profile', Icons.person_outline_rounded, Icons.person_rounded),
  ];

  void _select(int i) {
    if (i == _index) return;
    setState(() => _index = i);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // Back from any tab returns to Home rather than leaving the app. Only a
      // second back from Home exits, which is what an Android user expects and
      // what an IndexedStack alone would not give them.
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _index != 0) setState(() => _index = 0);
      },
      child: Scaffold(
        // IndexedStack, not a rebuild per tap: each tab keeps its own scroll
        // offset and its own loaded data, so switching back to Results does not
        // re-fetch and re-scroll to the top.
        body: IndexedStack(
          index: _index,
          children: const [
            HomeScreen(),
            TestSeriesListScreen(),
            ResultsHistoryScreen(),
            ProfileScreen(),
          ],
        ),
        // Vajini, the AI study companion. A floating action rather than a fifth
        // tab: the four tabs are places in the app, and Vajini is an action you
        // take from wherever you are. It is the guide's signature violet→blue
        // FAB — the one place that gradient appears — matching the standalone.
        floatingActionButton: const _VajiniFab(),
        bottomNavigationBar: _BottomBar(
          index: _index,
          tabs: _tabs,
          onSelect: _select,
        ),
      ),
    );
  }
}

class _VajiniFab extends StatelessWidget {
  const _VajiniFab();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: 'Ask Vajini',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.openVajini(),
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          child: Container(
            width: 56,
            height: 56,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: AppTheme.violetGradient,
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppTheme.radiusPill),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x593B6FF6),
                  blurRadius: 18,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: const Icon(
              Icons.smart_toy_rounded,
              size: 26,
              color: Colors.white,
            ),
          ),
        ),
      ),
    );
  }
}

class _TabSpec {
  const _TabSpec(this.label, this.icon, this.activeIcon);
  final String label;
  final IconData icon;
  final IconData activeIcon;
}

/// 56 px bar · 24 dp icons · 10 px labels · 3 px indicator · no badge counts.
///
/// Active state is a colour swap plus a rule above the icon. Deliberately not a
/// background pill: a pill is a second shape competing with the icon at the one
/// size where there is no room for two.
class _BottomBar extends StatelessWidget {
  const _BottomBar({
    required this.index,
    required this.tabs,
    required this.onSelect,
  });

  final int index;
  final List<_TabSpec> tabs;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      decoration: BoxDecoration(
        color: c.isDark ? c.panel : c.panel,
        border: Border(top: BorderSide(color: c.border)),
        boxShadow: AppTheme.ambient(c),
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 56,
          child: Row(
            children: [
              for (var i = 0; i < tabs.length; i++)
                Expanded(
                  child: _BarItem(
                    spec: tabs[i],
                    active: i == index,
                    onTap: () => onSelect(i),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BarItem extends StatelessWidget {
  const _BarItem({
    required this.spec,
    required this.active,
    required this.onTap,
  });

  final _TabSpec spec;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final color = active ? c.brand : c.textSecondary;
    return Semantics(
      button: true,
      selected: active,
      label: spec.label,
      child: InkWell(
        onTap: onTap,
        child: Stack(
          alignment: Alignment.topCenter,
          children: [
            Positioned(
              top: 0,
              child: AnimatedOpacity(
                duration: AppTheme.paletteFlip,
                opacity: active ? 1 : 0,
                child: Container(
                  width: 18,
                  height: 3,
                  decoration: BoxDecoration(
                    color: c.brand,
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(2),
                    ),
                  ),
                ),
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    active ? spec.activeIcon : spec.icon,
                    size: 24,
                    color: color,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    spec.label,
                    style: AppText.tab.copyWith(
                      color: color,
                      fontWeight: active ? FontWeight.w600 : FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
