// PATCH 4 of 4 — the five-tab bar.
//
// lib/shell.dart carries four tabs and a documented argument AGAINST a fifth:
// "the field study's six-tab bar failed because three of its tabs were
// subscription products rather than places." That reasoning was sound for the
// old map (Home · Series · Results · Profile). The guide supersedes it — and
// note that it does not add a price tier: it splits the study path off Series
// and adds Store, which the web SPA already ships as a flagged stub
// (app/src/components/BottomNav.jsx). The reasoning is kept in the comment
// rather than deleted, per the port doc.
//
// Also fixed here: the bar's icons. The guide draws lucide-style 2.2px stroke
// glyphs; the app draws Material rounded fills, which is the single most
// visible "this is a stock Flutter app" tell after the flat gold button.
// Material has no lucide set — either add `lucide_icons` to pubspec (preferred,
// one line) or ship the guide's glyphs as SVGs. The mapping below names the
// lucide glyph for each tab so the swap is mechanical.

import 'package:flutter/material.dart';

import 'routes.dart';
import 'screens/home_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/results_history_screen.dart';
import 'screens/test_series_screen.dart';
import 'theme.dart';
import 'widgets.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, this.initialTab = 0});

  final int initialTab;

  static const int home = 0;
  static const int tests = 1;
  static const int study = 2;
  static const int store = 3;
  static const int profile = 4;

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

  // lucide equivalents, for when the icon set lands:
  //   home · file-text · graduation-cap · shopping-bag · user
  static const _tabs = <_TabSpec>[
    _TabSpec('Home', Icons.home_outlined, Icons.home_rounded),
    _TabSpec('Tests', Icons.description_outlined, Icons.description_rounded),
    _TabSpec('Study', Icons.school_outlined, Icons.school_rounded),
    _TabSpec('Store', Icons.shopping_bag_outlined, Icons.shopping_bag_rounded),
    _TabSpec('Profile', Icons.person_outline_rounded, Icons.person_rounded),
  ];

  void _select(int i) {
    if (i == _index) return;
    setState(() => _index = i);
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: _index == 0,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _index != 0) setState(() => _index = 0);
      },
      child: Scaffold(
        body: IndexedStack(
          index: _index,
          children: const [
            HomeScreen(),
            TestSeriesListScreen(),
            ResultsHistoryScreen(), // -> StudyZone once that screen exists
            StoreStubScreen(),
            ProfileScreen(),
          ],
        ),
        floatingActionButton: const _VajiniFab(),
        // Docked into the bar's notch, as the guide draws it. Centred and
        // free-floating leaves the FAB sitting on top of the Study tab's label.
        floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
        bottomNavigationBar: _BottomBar(index: _index, tabs: _tabs, onSelect: _select),
      ),
    );
  }
}

/// An explicit, flagged stub — matching the web, which ships the same. Do not
/// invent a storefront: there is no backend for one.
class StoreStubScreen extends StatelessWidget {
  const StoreStubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Scaffold(
      backgroundColor: c.bg,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: EmptyState(
            icon: Icons.shopping_bag_outlined,
            title: 'Store',
            message: 'Course purchases are coming soon. Your institute can open '
                'access now with an activation code.',
          ),
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
                BoxShadow(color: Color(0x593B6FF6), blurRadius: 18, offset: Offset(0, 8)),
              ],
            ),
            child: const Icon(Icons.auto_awesome, size: 26, color: Colors.white),
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

/// 56px bar · 24dp icons · 10px labels · 3px indicator.
///
/// One change from the four-tab version: the bar sits on [AppColors.nav], not
/// [AppColors.panel]. `nav` is translucent by design so content scrolling under
/// the bar tints it — the token was added in the port and then never used.
class _BottomBar extends StatelessWidget {
  const _BottomBar({required this.index, required this.tabs, required this.onSelect});

  final int index;
  final List<_TabSpec> tabs;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      decoration: BoxDecoration(
        color: c.nav,
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
  const _BarItem({required this.spec, required this.active, required this.onTap});

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
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(2)),
                  ),
                ),
              ),
            ),
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(active ? spec.activeIcon : spec.icon, size: 24, color: color),
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
