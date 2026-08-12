import '../scaffold.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../boards.dart';
import '../models.dart';
import '../routes.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';
import 'results_history_screen.dart';
import 'test_taking_screen.dart';

class TestSeriesListScreen extends StatefulWidget {
  const TestSeriesListScreen({super.key});

  @override
  State<TestSeriesListScreen> createState() => _TestSeriesListScreenState();
}

class _TestSeriesListScreenState extends State<TestSeriesListScreen> {
  List<TestSeries> _series = [];
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await ApiClient.instance.get('/student/test-series');
      final list = extractList(data, 'series')
              .map((s) => TestSeries.fromJson(s as Map<String, dynamic>))
              .toList();
      if (!mounted) return;
      setState(() {
        _series = list;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isEmpty ? 'Failed to load test series.' : e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load test series. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          const AppHeader(title: 'Test series'),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading test series...')
                : _error.isNotEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          ErrorBanner(_error),
                          const SizedBox(height: 12),
                          Center(
                            child: SecondaryButton(
                              label: 'Retry',
                              icon: Icons.refresh,
                              onPressed: _fetch,
                            ),
                          ),
                        ],
                      )
                    : RefreshIndicator(
                        onRefresh: _fetch,
                        child: _series.isEmpty
                            ? ListView(
                                padding: const EdgeInsets.all(16),
                                children: const [
                                  EmptyState(
                                    icon: Icons.route_outlined,
                                    title: 'No test series assigned',
                                    message: 'When your institute assigns a '
                                        'series to your batch, the study path '
                                        'appears here in order.',
                                  ),
                                ],
                              )
                            : ListView(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                                children: [
                                  const SectionHeading('Your study path'),
                                  const SizedBox(height: 11),
                                  for (final s in _series) _SeriesCard(series: s),
                                ],
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _SeriesCard extends StatelessWidget {
  const _SeriesCard({required this.series});

  final TestSeries series;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final percent = series.totalTests > 0
        ? (series.attemptedTestsCount * 100 / series.totalTests).round()
        : 0;

    final board = BoardCatalog.resolve(series.examCategory);

    return SurfacePanel(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      onTap: () => context.openSeries(series.id),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // The board mark tells the student which exam this path is for
              // before they read a word of it. Omitted when unmapped.
              if (board != null) ...[
                BoardChip(board: board),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      series.title ?? 'Test series',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.cardTitleSm.copyWith(color: c.textPrimary),
                    ),
                    if ((series.description ?? '').isNotEmpty) ...[
                      const SizedBox(height: 5),
                      Text(
                        series.description!,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.caption.copyWith(color: c.textSecondary),
                      ),
                    ],
                  ],
                ),
              ),
              if (series.isCompleted) ...[
                const SizedBox(width: 8),
                // Gold: a completed series is an achievement, not a status.
                TrailingBadge('DONE', color: c.gold),
              ],
            ],
          ),
          const SizedBox(height: 13),
          ProgressBar(percent: percent, height: 6),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${series.attemptedTestsCount} of ${series.totalTests} tests attempted',
                style: AppText.caption.copyWith(color: c.textSecondary),
              ),
              Text('$percent%',
                  style: AppText.caption.copyWith(color: c.textSecondary)),
            ],
          ),
        ],
      ),
    );
  }
}

class TestSeriesDetailScreen extends StatefulWidget {
  const TestSeriesDetailScreen({super.key, required this.seriesId});

  final int seriesId;

  @override
  State<TestSeriesDetailScreen> createState() => _TestSeriesDetailScreenState();
}

class _TestSeriesDetailScreenState extends State<TestSeriesDetailScreen> {
  TestSeriesDetail? _detail;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data =
          await ApiClient.instance.get('/student/test-series/${widget.seriesId}');
      if (!mounted) return;
      setState(() {
        _detail = TestSeriesDetail.fromJson(data);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isEmpty ? 'Failed to load test series.' : e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load test series. Please try again.';
        _loading = false;
      });
    }
  }

  Future<void> _startTest(SeriesTest test) async {
    try {
      final data = await ApiClient.instance.post('/student/tests/${test.id}/start');
      final session = SessionState.fromJson(data['session'] as Map<String, dynamic>);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TestTakingScreen(sessionId: session.id)),
      );
      if (mounted) _fetch();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.message.isEmpty ? 'Failed to start the test.' : e.message)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          AppHeader(
            title: _detail?.title ?? 'Test series',
            showBack: true,
          ),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading test series...')
                : _error.isNotEmpty
                    ? ListView(
                        padding: const EdgeInsets.all(16),
                        children: [
                          ErrorBanner(_error),
                          const SizedBox(height: 12),
                          Center(
                            child: SecondaryButton(
                              label: 'Retry',
                              icon: Icons.refresh,
                              onPressed: _fetch,
                            ),
                          ),
                        ],
                      )
                    : _SeriesDetailBody(detail: _detail!, onStart: _startTest),
          ),
        ],
      ),
    );
  }
}

class _SeriesDetailBody extends StatelessWidget {
  const _SeriesDetailBody({required this.detail, required this.onStart});

  final TestSeriesDetail detail;
  final ValueChanged<SeriesTest> onStart;

  List<String> get _categories {
    final keys = detail.categories.keys.toList();
    if (keys.isNotEmpty) return keys;
    final seen = <String>{};
    return detail.tests.map((t) => t.category ?? 'full_mock').where(seen.add).toList();
  }

  List<SeriesTest> _testsFor(String category) {
    final ids = detail.categories[category];
    if (ids != null && ids.isNotEmpty) {
      final idSet = ids.toSet();
      return detail.tests.where((t) => idSet.contains(t.id)).toList();
    }
    return detail.tests.where((t) => (t.category ?? 'full_mock') == category).toList();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final categories = _categories;
    if (categories.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          SurfacePanel(
            padding: const EdgeInsets.all(24),
            child: Text(
              'No tests published in this series yet.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 13, color: c.textSecondary),
            ),
          ),
        ],
      );
    }

    return DefaultTabController(
      length: categories.length,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
            child: SurfacePanel(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    detail.title ?? 'Test Series',
                    style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.textPrimary),
                  ),
                  if ((detail.description ?? '').isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      detail.description!,
                      style: TextStyle(fontSize: 12.5, color: c.textSecondary, height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          '${detail.totalTests} tests',
                          style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.textPrimary),
                        ),
                      ),
                      if (detail.nextTestId != null)
                        StatusChip('NEXT: TEST #${detail.nextTestId}', color: c.brandBright),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 8),
          TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            labelColor: c.brandBright,
            unselectedLabelColor: c.textSecondary,
            indicatorColor: c.brandBright,
            indicatorSize: TabBarIndicatorSize.label,
            labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
            tabs: [for (final cat in categories) Tab(text: _categoryLabel(cat))],
          ),
          Expanded(
            child: TabBarView(
              children: [
                for (final cat in categories)
                  ListView(
                    padding: const EdgeInsets.all(16),
                    children: [
                      for (final test in _testsFor(cat))
                        _TestCard(test: test, onStart: onStart),
                      const SizedBox(height: 12),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _categoryLabel(String category) {
    switch (category) {
      case 'full_mock':
        return 'Full Mocks';
      case 'sectional':
        return 'Sectionals';
      case 'previous_year':
        return 'Previous Year';
      default:
        return category
            .split('_')
            .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
            .join(' ');
    }
  }
}

class _TestCard extends StatelessWidget {
  const _TestCard({required this.test, required this.onStart});

  final SeriesTest test;
  final ValueChanged<SeriesTest> onStart;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final (color, label) = switch (test.status) {
      'completed' => (c.success, 'Completed'),
      'in_progress' => (c.orange, 'In Progress'),
      _ => (c.textSecondary, 'Not Started'),
    };

    return SurfacePanel(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  test.title ?? 'Test',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary),
                ),
              ),
              StatusChip(label, color: color),
            ],
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 16,
            runSpacing: 6,
            children: [
              _meta(context, Icons.timer_outlined,
                  '${(test.durationSeconds ?? 0) ~/ 60} mins'),
              _meta(context, Icons.adjust,
                  'Marks: ${formatNumber(test.totalMarks)}'),
              if (test.score != null)
                _meta(context, Icons.score_outlined, 'Score: ${formatNumber(test.score)}'),
            ],
          ),
          const SizedBox(height: 12),
          if (test.isCompleted)
            SecondaryButton(
              label: 'View Result',
              icon: Icons.bar_chart,
              fullWidth: true,
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const ResultsHistoryScreen()),
              ),
            )
          else
            PrimaryButton(
              label: test.status == 'in_progress' ? 'Resume Test' : 'Start Test',
              icon: Icons.play_arrow,
              fullWidth: true,
              onPressed: () => onStart(test),
            ),
        ],
      ),
    );
  }

  Widget _meta(BuildContext context, IconData icon, String text) {
    final c = useColors(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: c.textSecondary),
        const SizedBox(width: 5),
        Text(text, style: TextStyle(fontSize: 12.5, color: c.textPrimary)),
      ],
    );
  }
}
