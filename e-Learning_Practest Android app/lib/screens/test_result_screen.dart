import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../scaffold.dart';
import '../share_card.dart';
import '../theme.dart';
import '../utils.dart';
import '../verdict.dart';
import '../widgets.dart';

/// The result.
///
/// The old screen ended with a score and a list. An aspirant most needs it to
/// end with an opinion, so the order here is: the figure, the standing, the
/// verdict, the sections, and only then the question-by-question review.
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

  /// Set when the student taps the verdict's action, so the review list can
  /// narrow to the answers the verdict was actually about.
  bool _wrongOnly = false;

  final _reviewKey = GlobalKey();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
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

  void _reviewWrongAnswers() {
    setState(() => _wrongOnly = true);
    // Let the filtered list lay out before scrolling to it.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _reviewKey.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(ctx,
            duration: AppTheme.routeDuration, curve: Curves.easeOut);
      }
    });
  }

  Future<void> _share() async {
    final data = _data;
    if (data == null) return;
    await showResultShareSheet(context, sessionId: widget.sessionId, data: data);
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          AppHeader(
            title: 'Result',
            showBack: true,
            trailing: _data == null
                ? null
                : IconButton(
                    tooltip: 'Share',
                    onPressed: _share,
                    icon: Icon(Icons.ios_share,
                        size: 20, color: useColors(context).textSecondary),
                  ),
          ),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Computing your result…')
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
                        color: useColors(context).brand,
                        onRefresh: _fetch,
                        child: _body(_data!),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _body(TestResultData data) {
    final c = useColors(context);
    final verdict = Verdict.from(data);
    final sections = data.analytic.subjectBreakdown.entries
        .where((e) => e.value.questions > 0)
        .toList()
      ..sort((a, b) {
        // Weakest first — the section a student needs to look at should not be
        // the one they have to scroll to.
        final aa = a.value.accuracy ?? 200;
        final bb = b.value.accuracy ?? 200;
        return aa.compareTo(bb);
      });

    final answers =
        _wrongOnly ? data.answers.where((a) => !a.isCorrect && !a.isSkipped).toList() : data.answers;

    return ListView(
      controller: _scroll,
      padding: EdgeInsets.zero,
      children: [
        _ScoreHeader(data: data),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (!verdict.isEmpty) ...[
                _VerdictBlock(
                  verdict: verdict,
                  onReview: verdict.wrongCount > 0 ? _reviewWrongAnswers : null,
                ),
                const SizedBox(height: 20),
              ],
              if (sections.isNotEmpty) ...[
                const SectionHeading('By section'),
                const SizedBox(height: 11),
                for (final entry in sections) ...[
                  _SectionRow(name: entry.key, row: entry.value),
                  const SizedBox(height: 9),
                ],
                const SizedBox(height: 12),
              ],
              SectionHeading(
                _wrongOnly ? 'Your wrong answers' : 'Question review',
                key: _reviewKey,
                trailing: _wrongOnly
                    ? GestureDetector(
                        onTap: () => setState(() => _wrongOnly = false),
                        child: Text('Show all',
                            style: AppText.caption.copyWith(color: c.brandBright)),
                      )
                    : null,
              ),
              const SizedBox(height: 11),
              if (answers.isEmpty)
                const EmptyState(
                  icon: Icons.check_circle_outline,
                  message: 'Nothing to review here.',
                )
              else
                for (var i = 0; i < answers.length; i++) ...[
                  _ReviewCard(answer: answers[i], index: i + 1),
                  const SizedBox(height: 10),
                ],
            ],
          ),
        ),
      ],
    );
  }
}

/// The figure, and the standing beside it.
///
/// Solid ink, tabular, 42px — no gradient fill and no weight 900. Percentile
/// and rank take gold because they are *standing*; accuracy takes teal because
/// it is *performance*. The em-dash fallback when the API omits rank stays.
class _ScoreHeader extends StatelessWidget {
  const _ScoreHeader({required this.data});

  final TestResultData data;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final a = data.analytic;
    return Container(
      width: double.infinity,
      color: c.panel,
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('RESULT', style: AppText.labelSm.copyWith(color: c.textSecondary)),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(formatNumber(a.totalScore ?? 0),
                  style: AppText.scoreHero.copyWith(color: c.textPrimary)),
              const SizedBox(width: 8),
              Padding(
                padding: const EdgeInsets.only(bottom: 5),
                child: Text('/ ${formatNumber(a.maxScore ?? 0)}',
                    style: AppText.body.copyWith(color: c.textSecondary, fontSize: 14)),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: StatTile(
                  value: a.accuracyPercentage == null
                      ? '—'
                      : '${a.accuracyPercentage!.round()}%',
                  caption: 'Accuracy',
                  color: c.brandBright,
                  compact: true,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: StatTile(
                  value:
                      data.percentile == null ? '—' : formatNumber(data.percentile),
                  caption: 'Percentile',
                  color: c.gold,
                  compact: true,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: StatTile(
                  value: data.rank == null ? '—' : formatNumber(data.rank),
                  caption: 'Rank',
                  color: c.gold,
                  compact: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// The single highest-value addition on this screen.
///
/// One paragraph, computed not written, and one button that goes straight to
/// the wrong answers. Gold rule, because a verdict is about standing.
class _VerdictBlock extends StatelessWidget {
  const _VerdictBlock({required this.verdict, this.onReview});

  final Verdict verdict;
  final VoidCallback? onReview;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return SurfacePanel(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3,
                height: 15,
                decoration:
                    BoxDecoration(color: c.gold, borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(width: 8),
              Text('THE VERDICT',
                  style: AppText.labelSm.copyWith(color: c.textPrimary)),
            ],
          ),
          const SizedBox(height: 11),
          Text(verdict.text,
              style: AppText.body.copyWith(color: c.textSecondary, fontSize: 14)),
          if (onReview != null) ...[
            const SizedBox(height: 13),
            PrimaryButton(
              label: 'Review the ${verdict.wrongCount} wrong '
                  '${verdict.wrongCount == 1 ? 'answer' : 'answers'}',
              fullWidth: true,
              onPressed: onReview,
            ),
          ],
        ],
      ),
    );
  }
}

/// Title, right-aligned percentage, an 8px track, and two footnotes on a
/// justified baseline — accuracy and speed always seen together, since that
/// pair is what actually diagnoses an aspirant.
class _SectionRow extends StatelessWidget {
  const _SectionRow({required this.name, required this.row});

  final String name;
  final BreakdownRow row;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final accuracy = row.accuracy;
    // Red and green are on loan from the CBT vocabulary here, and only here:
    // outside the engine they read as a verdict on a section, which is what
    // this row is.
    final tone = accuracy == null
        ? c.textSecondary
        : accuracy >= 75
            ? c.success
            : accuracy >= 50
                ? c.gold
                : c.danger;
    final speed = row.secondsPerQuestion;

    return SurfacePanel(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.cardTitleSm.copyWith(color: c.textPrimary, fontSize: 14.5)),
              ),
              const SizedBox(width: 8),
              Text(accuracy == null ? '—' : '${accuracy.round()}%',
                  style: AppText.cardTitleSm.copyWith(color: tone, fontSize: 15)),
            ],
          ),
          const SizedBox(height: 10),
          ProgressBar(percent: (accuracy ?? 0).round(), color: tone),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${row.attempted} / ${row.questions} attempted',
                  style: AppText.caption.copyWith(color: c.textSecondary)),
              Text(
                speed == null
                    ? '—'
                    : '${(speed / 60).toStringAsFixed(1)} min per Q',
                style: AppText.caption.copyWith(color: c.textSecondary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ReviewCard extends StatefulWidget {
  const _ReviewCard({required this.answer, required this.index});

  final ResultAnswer answer;
  final int index;

  @override
  State<_ReviewCard> createState() => _ReviewCardState();
}

class _ReviewCardState extends State<_ReviewCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final a = widget.answer;
    final tone = a.isCorrect
        ? c.success
        : a.isSkipped
            ? c.textSecondary
            : c.danger;
    final label = a.isCorrect ? 'Correct' : (a.isSkipped ? 'Skipped' : 'Wrong');

    final chosen = a.options.where((o) => o.id == a.selectedOptionId).firstOrNull;
    final correct = a.options.where((o) => o.isCorrect).firstOrNull;

    return SurfacePanel(
      padding: const EdgeInsets.all(14),
      onTap: () => setState(() => _expanded = !_expanded),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text('Q${widget.index}',
                    style: AppText.captionStrong.copyWith(color: c.textSecondary)),
              ),
              Row(
                children: [
                  Text('${a.timeSpentSeconds}s',
                      style: AppText.caption.copyWith(color: c.textMuted, fontSize: 11)),
                  const SizedBox(width: 8),
                  TrailingBadge(label.toUpperCase(), color: tone),
                ],
              ),
            ],
          ),
          const SizedBox(height: 9),
          MathText(a.questionText,
              style: AppText.body.copyWith(color: c.textPrimary, fontSize: 14)),
          if (_expanded) ...[
            const SizedBox(height: 13),
            if (chosen != null)
              _AnswerLine(
                label: chosen.label ?? '?',
                text: chosen.optionText ?? '',
                caption: 'Your answer',
                color: a.isCorrect ? CbtStatus.answeredBg : CbtStatus.notAnsweredBg,
              ),
            if (correct != null && !a.isCorrect) ...[
              const SizedBox(height: 10),
              _AnswerLine(
                label: correct.label ?? '?',
                text: correct.optionText ?? '',
                caption: 'Correct',
                color: CbtStatus.answeredBg,
              ),
            ],
            // "Why you missed it": the stored explanation, shown where the
            // student is already looking at their own mistake — no chat box, no
            // prompt, no blank textbox.
            //
            // When there is no explanation there is no panel. An absent panel
            // is invisible; one that hedges, or that surfaces a system limit as
            // its answer, is corrosive.
            if ((a.explanation ?? '').isNotEmpty) ...[
              const SizedBox(height: 13),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.only(top: 12),
                decoration:
                    BoxDecoration(border: Border(top: BorderSide(color: c.border))),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(a.isCorrect ? 'WHY THIS IS RIGHT' : 'WHY YOU MISSED IT',
                        style: AppText.labelSm.copyWith(color: c.brandBright)),
                    const SizedBox(height: 7),
                    MathText(a.explanation,
                        style: AppText.body.copyWith(color: c.textSecondary, fontSize: 13.5)),
                  ],
                ),
              ),
            ],
          ],
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerRight,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(_expanded ? 'Hide' : 'Show answer',
                    style: AppText.captionStrong.copyWith(color: c.brandBright)),
                Icon(_expanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    size: 17, color: c.brandBright),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AnswerLine extends StatelessWidget {
  const _AnswerLine({
    required this.label,
    required this.text,
    required this.caption,
    required this.color,
  });

  final String label;
  final String text;
  final String caption;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 24,
          height: 24,
          alignment: Alignment.center,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          child: Text(label,
              style: AppText.captionStrong
                  .copyWith(color: Colors.white, fontSize: 11)),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(caption,
                  style: AppText.caption.copyWith(color: c.textMuted, fontSize: 11)),
              const SizedBox(height: 3),
              MathText(text,
                  style: AppText.body.copyWith(color: c.textPrimary, fontSize: 13.5)),
            ],
          ),
        ),
      ],
    );
  }
}
