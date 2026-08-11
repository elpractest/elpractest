import '../scaffold.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../utils.dart';
import '../widgets.dart';
import 'test_result_screen.dart';

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
          AppHeader(userName: 'Results', onLogout: () {}, showLogout: false),
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
                                children: [
                                  GlassPanel(
                                    padding: const EdgeInsets.all(28),
                                    child: Column(
                                      children: [
                                        MedallionIcon(
                                          icon: Icons.assignment_turned_in_outlined,
                                          color: c.violet,
                                          size: 34,
                                          padding: 18,
                                        ),
                                        const SizedBox(height: 16),
                                        Text(
                                          'No attempts yet',
                                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          'Attempt a test and your score, accuracy and rank will appear here.',
                                          textAlign: TextAlign.center,
                                          style: TextStyle(fontSize: 13, color: c.textSecondary, height: 1.4),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              )
                            : ListView(
                                padding: const EdgeInsets.all(16),
                                children: [
                                  Text(
                                    'Test Results History',
                                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c.textPrimary),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${_results.length} completed attempt${_results.length == 1 ? '' : 's'}',
                                    style: TextStyle(fontSize: 12.5, color: c.textSecondary),
                                  ),
                                  const SizedBox(height: 14),
                                  for (final r in _results) _ResultCard(result: r),
                                  const SizedBox(height: 12),
                                ],
                              ),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ResultCard extends StatelessWidget {
  const _ResultCard({required this.result});

  final ResultSummary result;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final statusColor = result.score != null && result.totalMarks != null &&
            (result.totalMarks ?? 0) > 0 && (result.score ?? 0) / result.totalMarks! >= 0.5
        ? c.success
        : c.warning;

    return GlassPanel(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      onTap: () => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TestResultScreen(sessionId: result.sessionId)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  result.testTitle ?? 'Unknown Test',
                  style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w700, color: c.textPrimary),
                ),
              ),
              if (result.isAutoSubmitted)
                StatusChip(
                  'AUTO-SUBMITTED',
                  color: c.warning,
                  icon: Icons.timer_outlined,
                ),
            ],
          ),
          if ((result.courseTitle ?? '').isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(
              result.courseTitle!,
              style: TextStyle(fontSize: 12, color: c.textSecondary),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _stat(
                  context,
                  '${formatNumber(result.score)} / ${formatNumber(result.totalMarks)}',
                  'Score',
                  statusColor,
                ),
              ),
              Expanded(
                child: _stat(
                  context,
                  '${(result.accuracyPercentage ?? 0).round()}%',
                  'Accuracy',
                  c.accent,
                ),
              ),
              Expanded(
                child: _stat(
                  context,
                  result.percentile != null ? formatNumber(result.percentile) : '—',
                  'Percentile',
                  c.violet,
                ),
              ),
              Expanded(
                child: _stat(
                  context,
                  result.rank != null ? '#${result.rank}' : '—',
                  'Rank',
                  c.success,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(Icons.schedule, size: 14, color: c.textSecondary),
                  const SizedBox(width: 5),
                  Text(
                    formatDurationMinutes(result.timeTakenSeconds),
                    style: TextStyle(fontSize: 12, color: c.textSecondary),
                  ),
                ],
              ),
              Row(
                children: [
                  Icon(Icons.calendar_today_outlined, size: 13, color: c.textSecondary),
                  const SizedBox(width: 5),
                  Text(
                    formatDateTime(result.submittedAt),
                    style: TextStyle(fontSize: 12, color: c.textSecondary),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _stat(BuildContext context, String value, String label, Color color) {
    final c = useColors(context);
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(fontSize: 15.5, fontWeight: FontWeight.w800, color: color),
        ),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textSecondary)),
      ],
    );
  }
}
