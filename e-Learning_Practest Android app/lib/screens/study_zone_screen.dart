import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../scaffold.dart';
import '../shell.dart';
import '../theme.dart';
import '../widgets.dart';
import 'results_history_screen.dart';

/// The Study tab.
///
/// The five-tab shell split the study path off the old Series tab, and this is
/// where it lands. It is a hub, ported from the web's `pages/StudyZone.jsx`: an
/// honest stat header over a grid of tiles. Two of those tiles — Attempts and
/// Analytics — are the home the [ResultsHistoryScreen] lost when the old
/// "Results" tab was replaced: past scores are reachable here under a label
/// that names them, and again from Profile.
///
/// The stat header is computed from the real results feed, never demo numbers.
/// The three unbuilt tiles (Notes / PYQ / Bookmarks) are marked "SOON" and
/// disabled rather than faked — there is no backend for them, exactly as the web
/// flags the same three.
class StudyZoneScreen extends StatefulWidget {
  const StudyZoneScreen({super.key});

  @override
  State<StudyZoneScreen> createState() => _StudyZoneScreenState();
}

class _StudyZoneScreenState extends State<StudyZoneScreen> {
  List<ResultSummary> _results = [];
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final data = await ApiClient.instance.get('/student/results');
      final list = extractList(data, 'results')
          .map((r) => ResultSummary.fromJson(r as Map<String, dynamic>))
          .toList();
      if (mounted) {
        setState(() {
          _results = list;
          _loaded = true;
        });
      }
    } catch (_) {
      // No feed is not an error here — the header simply collapses and the
      // tiles still route. Attempts elsewhere may still have loaded it.
      if (mounted) setState(() => _loaded = true);
    }
  }

  void _openResults() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ResultsHistoryScreen()),
    );
  }

  ({int attempts, int? avg, int? best}) get _stats {
    final accs = _results
        .map((r) => r.accuracyPercentage)
        .whereType<num>()
        .toList();
    if (accs.isEmpty) return (attempts: _results.length, avg: null, best: null);
    final avg = accs.reduce((a, b) => a + b) / accs.length;
    final best = accs.reduce((a, b) => a > b ? a : b);
    return (attempts: _results.length, avg: avg.round(), best: best.round());
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final stats = _stats;
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          const AppHeader(title: 'Study'),
          Expanded(
            child: RefreshIndicator(
              color: c.brand,
              onRefresh: _fetch,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  Text('Your study zone',
                      style: AppText.screenTitle.copyWith(color: c.textPrimary, fontSize: 22)),
                  const SizedBox(height: 4),
                  Text('Every attempt, every analysis, one place.',
                      style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 12.5)),
                  const SizedBox(height: 16),
                  if (stats.attempts > 0) ...[
                    SurfacePanel(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 14),
                      child: Row(
                        children: [
                          Expanded(child: _stat('${stats.attempts}', 'Attempts', c.brandBright)),
                          _divider(c),
                          Expanded(child: _stat(stats.avg == null ? '—' : '${stats.avg}%', 'Avg accuracy', c.gold)),
                          _divider(c),
                          Expanded(child: _stat(stats.best == null ? '—' : '${stats.best}%', 'Best', c.success)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 18),
                  ] else if (_loaded) ...[
                    SurfacePanel(
                      padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 16),
                      child: Text(
                        'Attempt a paper and your attempts, accuracy and best score show up here.',
                        style: AppText.body.copyWith(color: c.textSecondary),
                      ),
                    ),
                    const SizedBox(height: 18),
                  ],
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.55,
                    children: [
                      _StudyTile(
                        icon: Icons.history_rounded,
                        hue: TintHue.gold,
                        label: 'Attempts',
                        sub: 'Every paper you have taken',
                        onTap: _openResults,
                      ),
                      _StudyTile(
                        icon: Icons.insights_outlined,
                        hue: TintHue.green,
                        label: 'Analytics',
                        sub: 'Accuracy, percentile, rank',
                        onTap: _openResults,
                      ),
                      _StudyTile(
                        icon: Icons.track_changes_outlined,
                        hue: TintHue.blue,
                        label: 'Test series',
                        sub: 'Browse and start papers',
                        onTap: () => HomeShell.go(HomeShell.tests),
                      ),
                      const _StudyTile(
                        icon: Icons.description_outlined,
                        hue: TintHue.violet,
                        label: 'Notes',
                        sub: 'Coming soon',
                        soon: true,
                      ),
                      const _StudyTile(
                        icon: Icons.menu_book_outlined,
                        hue: TintHue.sky,
                        label: 'PYQ bank',
                        sub: 'Coming soon',
                        soon: true,
                      ),
                      const _StudyTile(
                        icon: Icons.bookmark_border_rounded,
                        hue: TintHue.red,
                        label: 'Bookmarks',
                        sub: 'Coming soon',
                        soon: true,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String value, String label, Color color) {
    final c = useColors(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(value, style: AppText.figure.copyWith(color: color)),
        ),
        const SizedBox(height: 6),
        Text(label,
            textAlign: TextAlign.center,
            style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 11)),
      ],
    );
  }

  Widget _divider(AppColors c) =>
      Container(width: 1, height: 30, color: c.border);
}

class _StudyTile extends StatelessWidget {
  const _StudyTile({
    required this.icon,
    required this.hue,
    required this.label,
    required this.sub,
    this.onTap,
    this.soon = false,
  });

  final IconData icon;
  final TintHue hue;
  final String label;
  final String sub;
  final VoidCallback? onTap;
  final bool soon;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final t = tint(hue, c.isDark);
    return Opacity(
      opacity: soon ? 0.72 : 1,
      child: SurfacePanel(
        padding: const EdgeInsets.all(14),
        onTap: soon ? null : onTap,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: t.bg,
                    borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                    border: Border.all(color: t.bd),
                  ),
                  child: Icon(icon, size: 20, color: t.c),
                ),
                if (soon)
                  TrailingBadge('SOON', color: c.textMuted),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label,
                    style: AppText.cardTitleSm.copyWith(color: c.textPrimary, fontSize: 14.5)),
                const SizedBox(height: 2),
                Text(sub,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 11)),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
