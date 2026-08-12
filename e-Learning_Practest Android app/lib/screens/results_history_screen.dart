import 'package:flutter/material.dart';

import '../api_client.dart';
import '../boards.dart';
import '../models.dart';
import '../routes.dart';
import '../scaffold.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';

class ResultsHistoryScreen extends StatefulWidget {
  const ResultsHistoryScreen({super.key});

  @override
  State<ResultsHistoryScreen> createState() => _ResultsHistoryScreenState();
}

class _ResultsHistoryScreenState extends State<ResultsHistoryScreen> {
  List<ResultSummary> _results = [];
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
      final data = await ApiClient.instance.get('/student/results');
      final list = extractList(data, 'results')
              .map((r) => ResultSummary.fromJson(r as Map<String, dynamic>))
              .toList();
      if (!mounted) return;
      setState(() {
        _results = list;
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isEmpty ? 'Failed to load results.' : e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load results. Please try again.';
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
          const AppHeader(title: 'Results'),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading results...')
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
                        child: _results.isEmpty
                            ? ListView(
                                padding: const EdgeInsets.all(16),
                                children: const [
                                  EmptyState(
                                    icon: Icons.assignment_turned_in_outlined,
                                    title: 'No attempts yet',
                                    message: 'Attempt a test and your score, '
                                        'accuracy and rank appear here.',
                                  ),
                                ],
                              )
                            : ListView(
                                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                                children: [
                                  SectionHeading(
                                    '${_results.length} completed '
                                    'attempt${_results.length == 1 ? '' : 's'}',
                                  ),
                                  const SizedBox(height: 11),
                                  for (final r in _results) _ResultCard(result: r),
                                ],
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

/// One past attempt.
///
/// The score leads because that is what the student is scanning for; accuracy,
/// percentile and rank follow in their own hues — teal is performance, gold is
/// standing. A figure the API did not return sets as an em dash, never as zero.
class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});

  final ResultSummary result;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final board = BoardCatalog.resolve(result.courseTitle);
    final total = result.totalMarks ?? 0;
    final ratio = total > 0 ? (result.score ?? 0) / total : null;
    final scoreTone = ratio == null
        ? c.textPrimary
        : ratio >= 0.5
            ? c.success
            : c.danger;

    return SurfacePanel(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      onTap: () => context.openResult(result.sessionId),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Omitted rather than guessed when the course names no board.
              if (board != null) ...[
                BoardChip(board: board),
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      result.testTitle ?? 'Unknown test',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.cardTitleSm.copyWith(color: c.textPrimary),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      formatDateTime(result.submittedAt),
                      style: AppText.caption
                          .copyWith(color: c.textSecondary, fontSize: 11.5),
                    ),
                  ],
                ),
              ),
              if (result.isAutoSubmitted) ...[
                const SizedBox(width: 8),
                TrailingBadge('AUTO', color: c.orange),
              ],
            ],
          ),
          const SizedBox(height: 13),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatNumber(result.score),
                  style: AppText.figure.copyWith(color: scoreTone, fontSize: 26)),
              const SizedBox(width: 5),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text('/ ${formatNumber(result.totalMarks)}',
                    style: AppText.caption.copyWith(color: c.textSecondary)),
              ),
              const Spacer(),
              _figure(c, '${(result.accuracyPercentage ?? 0).round()}%',
                  'accuracy', c.brandBright),
              const SizedBox(width: 16),
              _figure(
                  c,
                  result.percentile != null
                      ? formatNumber(result.percentile)
                      : '\u2014',
                  'percentile',
                  c.gold),
              const SizedBox(width: 16),
              _figure(c, result.rank != null ? '#${result.rank}' : '\u2014',
                  'rank', c.gold),
            ],
          ),
        ],
      ),
    );
  }

  Widget _figure(AppColors c, String value, String label, Color color) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(value, style: AppText.figureSm.copyWith(color: color, fontSize: 15)),
        const SizedBox(height: 4),
        Text(label,
            style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 10.5)),
      ],
    );
  }
}
