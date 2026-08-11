import '../scaffold.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';

class TestResultScreen extends StatefulWidget {
  const TestResultScreen({super.key, required this.sessionId});

  final int sessionId;

  @override
  State<TestResultScreen> createState() => _TestResultScreenState();
}

class _TestResultScreenState extends State<TestResultScreen> {
  TestResultData? _data;
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
      final data = await ApiClient.instance
          .get('/student/tests/sessions/${widget.sessionId}/result');
      if (!mounted) return;
      setState(() {
        _data = TestResultData.fromJson(data);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message.isEmpty ? 'Failed to load result.' : e.message;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load result. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          AppHeader(userName: 'Result', onLogout: () {}, showLogout: false),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Computing your result...')
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
                        child: _ResultList(data: _data!),
                      ),
          ),
        ],
      ),
    );
  }
}

class _ResultList extends StatelessWidget {
  const _ResultList({required this.data});

  final TestResultData data;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final a = data.analytic;
    final score = a.totalScore ?? 0;
    final maxScore = a.maxScore ?? 0;
    final accuracy = (a.accuracyPercentage ?? 0).round();
    final timeSecs = a.totalTimeSeconds ?? 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Center(
          child: StatusChip(
            'RESULT',
            icon: Icons.emoji_events_outlined,
            color: c.violet,
          ),
        ),
        const SizedBox(height: 14),
        _ScoreCard(
          score: score,
          maxScore: maxScore,
          accuracy: accuracy,
          percentile: data.percentile,
          rank: data.rank,
        ),
        const SizedBox(height: 12),
        _StatsRow(
          correct: a.correctCount ?? 0,
          incorrect: a.incorrectCount ?? 0,
          unanswered: a.unansweredCount ?? 0,
          timeTaken: timeSecs,
        ),
        const SizedBox(height: 20),
        Text(
          'Question-wise Review',
          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.textPrimary),
        ),
        const SizedBox(height: 4),
        Text(
          'Tap a question to see your answer, the correct answer and the explanation.',
          style: TextStyle(fontSize: 12.5, color: c.textSecondary),
        ),
        const SizedBox(height: 12),
        for (final answer in data.answers) _ReviewCard(answer: answer),
        const SizedBox(height: 12),
      ],
    );
  }
}

class _ScoreCard extends StatelessWidget {
  const _ScoreCard({
    required this.score,
    required this.maxScore,
    required this.accuracy,
    this.percentile,
    this.rank,
  });

  final num score;
  final num maxScore;
  final int accuracy;
  final num? percentile;
  final num? rank;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return GlassPanel(
      padding: const EdgeInsets.all(22),
      child: Column(
        children: [
          Text(
            'Your Score',
            style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.textSecondary, letterSpacing: 1),
          ),
          const SizedBox(height: 8),
          ShaderMask(
            shaderCallback: (r) => AppTheme.textGradient(c).createShader(r),
            child: Text(
              '${formatNumber(score)} / ${formatNumber(maxScore)}',
              style: const TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                color: Colors.white,
                letterSpacing: 0.3,
              ),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              _scoreItem(context, 'Accuracy', '$accuracy%', Icons.track_changes),
              const SizedBox(width: 12),
              _scoreItem(context, 'Percentile', percentile != null ? formatNumber(percentile) : '—', Icons.leaderboard),
              const SizedBox(width: 12),
              _scoreItem(context, 'Rank', rank != null ? '#$rank' : '—', Icons.military_tech),
            ],
          ),
        ],
      ),
    );
  }

  Widget _scoreItem(BuildContext context, String label, String value, IconData icon) {
    final c = useColors(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 14),
        decoration: BoxDecoration(
          color: c.surface1,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: c.border),
        ),
        child: Column(
          children: [
            Icon(icon, size: 18, color: c.accent),
            const SizedBox(height: 6),
            Text(
              value,
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.textPrimary),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(fontSize: 11, color: c.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({
    required this.correct,
    required this.incorrect,
    required this.unanswered,
    required this.timeTaken,
  });

  final int correct;
  final int incorrect;
  final int unanswered;
  final num timeTaken;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return GlassPanel(
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      child: Row(
        children: [
          _stat(context, '$correct', 'Correct', c.success),
          _divider(c),
          _stat(context, '$incorrect', 'Wrong', c.danger),
          _divider(c),
          _stat(context, '$unanswered', 'Skipped', c.warning),
          _divider(c),
          _stat(context, formatDurationMinutes(timeTaken), 'Time', c.accent),
        ],
      ),
    );
  }

  Widget _divider(AppColors c) => Container(width: 1, height: 36, color: c.border);

  Widget _stat(BuildContext context, String value, String label, Color color) {
    final c = useColors(context);
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: color),
          ),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10.5, color: c.textSecondary)),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatefulWidget {
  const _ReviewCard({required this.answer});

  final ResultAnswer answer;

  @override
  State<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends State<_ReviewCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final a = widget.answer;
    final statusColor = a.isCorrect
        ? c.success
        : a.isSkipped
            ? c.warning
            : c.danger;
    final statusLabel = a.isCorrect ? 'Correct' : a.isSkipped ? 'Skipped' : 'Wrong';

    return GlassPanel(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 30,
                height: 30,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(9),
                  border: Border.all(color: statusColor),
                ),
                child: Text(
                  'Q${a.questionId}',
                  style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: statusColor),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    MathText(
                      a.questionText,
                      style: TextStyle(fontSize: 13.5, color: c.textPrimary, height: 1.4),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '${formatNumber(a.marks)} marks'
                      '${(a.negativeMarks ?? 0) > 0 ? '  ·  -${formatNumber(a.negativeMarks)} negative' : ''}',
                      style: TextStyle(fontSize: 11.5, color: c.textSecondary),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StatusChip(statusLabel, color: statusColor),
            ],
          ),
          if (_expanded) ...[
            const SizedBox(height: 14),
            ..._options(a),
            if ((a.explanation ?? '').isNotEmpty) ...[
              const SizedBox(height: 14),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: c.accentSoft.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: c.accentBorder),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Explanation',
                      style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: c.accent, letterSpacing: 0.8),
                    ),
                    const SizedBox(height: 6),
                    MathText(
                      a.explanation,
                      style: TextStyle(fontSize: 13, color: c.textPrimary, height: 1.5),
                    ),
                  ],
                ),
              ),
            ],
          ],
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: InkWell(
              onTap: () => setState(() => _expanded = !_expanded),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      _expanded ? 'Hide details' : 'View answer & explanation',
                      style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: c.accent),
                    ),
                    Icon(
                      _expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                      size: 17,
                      color: c.accent,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _options(ResultAnswer a) {
    final c = useColors(context);
    return [
      for (final option in a.options)
        Container(
          width: double.infinity,
          margin: const EdgeInsets.only(bottom: 8),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: option.isCorrect
                ? c.successBg
                : option.id == a.selectedOptionId
                    ? c.dangerBg
                    : c.surface1,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: option.isCorrect
                  ? c.successBorder
                  : option.id == a.selectedOptionId
                      ? c.dangerBorder
                      : c.border,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 24,
                height: 24,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: option.isCorrect
                      ? c.success
                      : option.id == a.selectedOptionId
                          ? c.danger
                          : c.surface2,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  option.label ?? '',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: option.isCorrect || option.id == a.selectedOptionId ? Colors.white : c.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: MathText(
                  option.optionText,
                  style: TextStyle(fontSize: 13, color: c.textPrimary, height: 1.4),
                ),
              ),
              if (option.isCorrect)
                const Icon(Icons.check_circle, size: 17, color: Color(0xFF0B9E6D))
              else if (option.id == a.selectedOptionId)
                const Icon(Icons.cancel, size: 17, color: Color(0xFFE5484D)),
            ],
          ),
        ),
    ];
  }
}
