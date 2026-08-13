import 'dart:async';

import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../resume_memory.dart';
import '../routes.dart';
import '../scaffold.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';

class TestTakingScreen extends StatefulWidget {
  const TestTakingScreen({super.key, required this.sessionId});

  final int sessionId;

  @override
  State<TestTakingScreen> createState() => _TestTakingScreenState();
}

class _TestTakingScreenState extends State<TestTakingScreen> {
  SessionState? _session;
  List<TestSection> _sections = [];
  int _currentSectionIndex = 0;
  int _currentQuestionIndex = 0;

  int? _timeRemaining;
  int? _sectionTimeRemaining;

  final Map<int, String> _palette = {};
  final Map<int, int?> _answers = {};
  final Map<int, bool> _marked = {};

  bool _loading = true;
  bool _autoAdvancing = false;
  bool _isSubmitting = false;
  String _error = '';

  Timer? _tick;
  int _timeSpentOnCurrentQuestion = 0;
  DateTime _lastSave = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _fetchSessionState();
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  bool get _hasSectionalTiming =>
      _sections.any((s) => (s.durationSeconds ?? 0) > 0);

  TestSection? get _activeSection {
    if (_currentSectionIndex < 0 || _currentSectionIndex >= _sections.length) {
      return null;
    }
    return _sections[_currentSectionIndex];
  }

  Question? get _activeQuestion {
    final section = _activeSection;
    if (section == null || _currentQuestionIndex >= section.questions.length) {
      return null;
    }
    return section.questions[_currentQuestionIndex];
  }

  Future<void> _fetchSessionState({bool showLoader = false}) async {
    if (showLoader) setState(() => _autoAdvancing = true);
    try {
      final data = await ApiClient.instance.get('/student/tests/sessions/${widget.sessionId}');
      if (!mounted) return;
      final session = SessionState.fromJson(data['session'] as Map<String, dynamic>);
      final sections = (data['sections'] as List?)
              ?.map((s) => TestSection.fromJson(s as Map<String, dynamic>))
              .toList() ??
          [];

      final answers = <int, int?>{};
      final marked = <int, bool>{};
      for (final a in (data['answers'] as List? ?? [])) {
        final m = a as Map<String, dynamic>;
        final qid = m['question_id'] is int ? m['question_id'] : int.tryParse('${m['question_id']}') ?? 0;
        answers[qid] = m['selected_option_id'];
        marked[qid] = m['is_marked_for_review'] == true;
      }

      setState(() {
        _session = session;
        _sections = sections;
        _currentSectionIndex = session.currentSectionIndex;
        _currentQuestionIndex = 0;
        _timeRemaining = session.timeRemainingSeconds;
        _sectionTimeRemaining = session.sectionTimeRemainingSeconds;
        _answers..clear()..addAll(answers);
        _marked..clear()..addAll(marked);
        _timeSpentOnCurrentQuestion = 0;
        _loading = false;
      });

      await _refreshPalette();
      _startTick();
    } on ApiException catch (e) {
      if (!mounted) return;
      // Session already ended server-side (auto-submit or another tab).
      if (e.statusCode == 409 && e.message.toLowerCase().contains('submitted')) {
        _goToResult();
        return;
      }
      setState(() {
        _loading = false;
        _error = e.message.isEmpty ? 'Failed to resume test session.' : e.message;
      });
    } finally {
      if (mounted) setState(() => _autoAdvancing = false);
    }
  }

  void _goToResult() {
    if (!mounted) return;
    // The paper is over, so the resume card must stop offering it.
    ResumeMemory.forget();
    // pushReplacement, carried over unchanged: back cannot return to a paper
    // that has already been submitted.
    context.replaceWithResult(widget.sessionId);
  }

  Future<void> _refreshPalette() async {
    try {
      final data = await ApiClient.instance.get('/student/tests/sessions/${widget.sessionId}/palette');
      final list = (data['palette'] as List? ?? []);
      if (!mounted) return;
      setState(() {
        _palette.clear();
        for (final item in list) {
          final m = item as Map<String, dynamic>;
          final qid = m['question_id'] is int ? m['question_id'] : int.tryParse('${m['question_id']}') ?? 0;
          _palette[qid] = m['status']?.toString() ?? 'not_visited';
        }
      });
    } catch (_) {}
  }

  void _startTick() {
    _tick?.cancel();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      if (_isSubmitting || _autoAdvancing) return;
      setState(() {
        _timeSpentOnCurrentQuestion += 1;

        if (_timeRemaining != null) {
          if (_timeRemaining! <= 1) {
            _timeRemaining = 0;
            _handleAutoSubmit();
            return;
          }
          _timeRemaining = _timeRemaining! - 1;
        }

        if (_sectionTimeRemaining != null) {
          if (_sectionTimeRemaining! <= 1) {
            _sectionTimeRemaining = 0;
            _handleSectionExpiry();
            return;
          }
          _sectionTimeRemaining = _sectionTimeRemaining! - 1;
        }
      });
    });
  }

  Future<void> _advanceSection({String fallbackError = 'Failed to advance section.'}) async {
    _tick?.cancel();
    setState(() => _autoAdvancing = true);
    try {
      final res = await ApiClient.instance.post('/student/tests/sessions/${widget.sessionId}/advance-section');
      if (!mounted) return;
      // Advancing past the last section auto-submits on the server; go to the scorecard.
      if (res['submitted_at'] != null || res['submitted'] == true) {
        _goToResult();
        return;
      }
      await _fetchSessionState(showLoader: false);
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.statusCode == 409 && e.message.toLowerCase().contains('submitted')) {
        _goToResult();
        return;
      }
      setState(() {
        _autoAdvancing = false;
        _error = e.message.isEmpty ? fallbackError : e.message;
      });
      _startTick();
    }
  }

  Future<void> _handleSectionExpiry() => _advanceSection(
        fallbackError: 'Section timing reconciliation failed. Please refresh.',
      );

  Future<void> _handleAdvanceSection() => _advanceSection();

  Future<void> _handleAutoSubmit() async {
    setState(() => _isSubmitting = true);
    try {
      await ApiClient.instance.post('/student/tests/sessions/${widget.sessionId}/submit');
      if (!mounted) return;
      _goToResult();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _error = e.message.isEmpty
            ? 'Failed to auto-submit expired session. Please refresh to view scorecard.'
            : e.message;
      });
    }
  }

  Future<void> _handleManualSubmit() async {
    setState(() {
      _isSubmitting = true;
      _error = '';
    });
    try {
      await ApiClient.instance.post('/student/tests/sessions/${widget.sessionId}/submit');
      if (!mounted) return;
      _goToResult();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _error = e.message.isEmpty ? 'Failed to submit test. Please try again.' : e.message;
      });
    }
  }

  Future<void> _markVisited(int questionId) async {
    if (_palette[questionId] != null && _palette[questionId] != 'not_visited') return;
    setState(() => _palette[questionId] = 'not_answered');
    try {
      await ApiClient.instance.put('/student/tests/sessions/${widget.sessionId}/answers/$questionId/visit');
    } catch (_) {}
  }

  void _navigateToQuestion(int sectionIdx, int questionIdx) {
    if (sectionIdx != _currentSectionIndex) {
      if (_hasSectionalTiming && sectionIdx != (_session?.currentSectionIndex ?? 0)) {
        return;
      }
      _currentSectionIndex = sectionIdx;
    }
    setState(() {
      _currentQuestionIndex = questionIdx;
      _timeSpentOnCurrentQuestion = 0;
    });
    final q = _sections[sectionIdx].questions[questionIdx];
    _markVisited(q.id);
  }

  Future<void> _selectOption(int optionId) async {
    final question = _activeQuestion;
    if (question == null) return;
    final now = DateTime.now();
    if (now.difference(_lastSave) < const Duration(milliseconds: 300)) return;
    _lastSave = now;

    final qid = question.id;
    setState(() {
      _answers[qid] = optionId;
      _palette[qid] = (_marked[qid] == true) ? 'answered_and_marked' : 'answered';
    });

    try {
      await ApiClient.instance.put(
        '/student/tests/sessions/${widget.sessionId}/answers/$qid',
        body: {
          'selected_option_id': optionId,
          'time_spent_seconds': _timeSpentOnCurrentQuestion,
        },
      );
    } on ApiException catch (e) {
      if (mounted) {
        setState(() => _error = e.message.isEmpty ? 'Failed to save answer. Please check connection.' : e.message);
      }
    }
  }

  Future<void> _clearResponse() async {
    final question = _activeQuestion;
    if (question == null) return;
    final qid = question.id;
    setState(() {
      _answers[qid] = null;
      _palette[qid] = (_marked[qid] == true) ? 'marked_for_review' : 'not_answered';
    });
    try {
      await ApiClient.instance.put(
        '/student/tests/sessions/${widget.sessionId}/answers/$qid',
        body: {
          'selected_option_id': null,
          'time_spent_seconds': _timeSpentOnCurrentQuestion,
        },
      );
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to clear answer.');
    }
  }

  Future<void> _toggleMarkForReview() async {
    final question = _activeQuestion;
    if (question == null) return;
    final qid = question.id;
    final next = !(_marked[qid] ?? false);
    setState(() {
      _marked[qid] = next;
      final hasAnswer = _answers[qid] != null;
      _palette[qid] = next
          ? (hasAnswer ? 'answered_and_marked' : 'marked_for_review')
          : (hasAnswer ? 'answered' : 'not_answered');
    });
    try {
      await ApiClient.instance.put(
        '/student/tests/sessions/${widget.sessionId}/answers/$qid/review',
      );
    } catch (_) {
      if (mounted) setState(() => _error = 'Failed to toggle review state.');
    }
  }

  void _handleSaveAndNext() {
    final section = _activeSection;
    if (section == null) return;
    if (_currentQuestionIndex < section.questions.length - 1) {
      _navigateToQuestion(_currentSectionIndex, _currentQuestionIndex + 1);
    } else if (!_hasSectionalTiming && _currentSectionIndex < _sections.length - 1) {
      _navigateToQuestion(_currentSectionIndex + 1, 0);
    } else {
      _confirmSubmitDialog();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);

    if (_loading) {
      return AppScaffold(
        safeArea: false,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 34, height: 34, child: CircularProgressIndicator(strokeWidth: 3)),
              const SizedBox(height: 16),
              Text('Resuming test session details...',
                  style: TextStyle(fontSize: 13, color: c.textSecondary)),
            ],
          ),
        ),
      );
    }

    if (_autoAdvancing) {
      return AppScaffold(
        safeArea: false,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 34, height: 34, child: CircularProgressIndicator(strokeWidth: 3)),
              const SizedBox(height: 16),
              Text('Section Time Expired!',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: c.brandBright)),
              const SizedBox(height: 6),
              Text('Auto-advancing to next section...',
                  style: TextStyle(fontSize: 13, color: c.textSecondary)),
            ],
          ),
        ),
      );
    }

    final section = _activeSection;
    final question = _activeQuestion;
    final totalTimerDanger = (_timeRemaining ?? 9999) < 300;
    final sectionTimerDanger = (_sectionTimeRemaining ?? 9999) < 60;

    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          _buildTopBar(c, totalTimerDanger, sectionTimerDanger),
          if (_error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
              child: ErrorBanner(_error),
            ),
          Expanded(
            child: question == null
                ? Center(
                    child: Text('No questions available.',
                        style: TextStyle(fontSize: 13, color: c.textSecondary)),
                  )
                : _buildQuestionArea(c, section!, question),
          ),
          _buildBottomBar(c, section),
        ],
      ),
    );
  }

  /// Fixed 62 px top bar. The clock never moves, and the section clock now sits
  /// under the total one so sectional timing stops being invisible. Both are
  /// tabular, so the digits cannot jitter as they count down.
  Widget _buildTopBar(AppColors c, bool totalDanger, bool sectionDanger) {
    return Container(
      height: 62,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: c.panel,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: _confirmSubmitDialog,
            icon: Icon(Icons.arrow_back, size: 20, color: c.textSecondary),
            tooltip: 'Submit and exit',
          ),
          Expanded(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(_session?.testTitle ?? 'Mock test',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.cardTitleSm
                        .copyWith(color: c.textPrimary, fontSize: 13.5)),
                if (_activeSection != null) ...[
                  const SizedBox(height: 4),
                  Text(_activeSection!.title ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.caption
                          .copyWith(color: c.textSecondary, fontSize: 11)),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          _Clock(
            seconds: _timeRemaining ?? 0,
            sectionSeconds: _sectionTimeRemaining,
            pulse: totalDanger || sectionDanger,
          ),
          const SizedBox(width: 10),
        ],
      ),
    );
  }

  Widget _buildQuestionArea(AppColors c, TestSection section, Question question) {
    final selected = _answers[question.id];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text('Q ${_currentQuestionIndex + 1} of ${section.questions.length}',
                  style: AppText.captionStrong.copyWith(color: c.textSecondary)),
            ),
            const Spacer(),
            // Three chips rather than a run-on sentence: what the question is
            // worth, what it costs, and how hard it is are three facts.
            Wrap(
              spacing: 6,
              runSpacing: 6,
              alignment: WrapAlignment.end,
              children: [
                _MarkChip('+${formatNumber(question.marks ?? 0)}', c.success),
                if ((question.negativeMarks ?? 0) != 0)
                  _MarkChip('−${formatNumber(question.negativeMarks ?? 0)}', c.danger),
                if ((question.difficulty ?? '').isNotEmpty)
                  _MarkChip(_capitalise(question.difficulty!), c.textSecondary),
              ],
            ),
          ],
        ),
        const SizedBox(height: 14),
        if ((question.subject ?? '').isNotEmpty || (question.topic ?? '').isNotEmpty) ...[
          Text(
            [question.subject, question.topic]
                .nonNulls
                .where((t) => t.isNotEmpty)
                .join(' · '),
            style: AppText.caption.copyWith(color: c.textMuted, fontSize: 11),
          ),
          const SizedBox(height: 8),
        ],
        MathText(question.questionText,
            style: AppText.question.copyWith(color: c.textPrimary)),
        const SizedBox(height: 16),
        for (final option in question.options) ...[
          _buildOption(c, option, selected == option.id),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  /// 26 dp lettered circle, 10 px radius, 48 dp minimum target, and a filled
  /// selected state in teal.
  ///
  /// Selection and Save & Next are the only teal on this screen. No orange
  /// countdown chips on an option row, and no CBT status colour anywhere near
  /// one — inside this screen red and green mean exactly one thing.
  Widget _buildOption(AppColors c, QuestionOption option, bool isSelected) {
    return InkWell(
      onTap: () => _selectOption(option.id),
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Container(
        constraints: const BoxConstraints(minHeight: 48),
        padding: EdgeInsets.all(isSelected ? 11.5 : 12),
        decoration: BoxDecoration(
          color: isSelected ? c.brand.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(
              color: isSelected ? c.brand : c.border, width: isSelected ? 1.5 : 1),
        ),
        child: Row(
          children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected ? c.brand : Colors.transparent,
                shape: BoxShape.circle,
                border: Border.all(
                    color: isSelected ? c.brand : c.borderStrong, width: 1.5),
              ),
              child: Text(
                option.label ?? '',
                style: AppText.captionStrong.copyWith(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                  color: isSelected ? c.onBrand : c.textSecondary,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MathText(
                option.optionText,
                style: AppText.body.copyWith(
                  fontSize: 14.5,
                  color: c.textPrimary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static String _capitalise(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).toLowerCase();

  Widget _buildBottomBar(AppColors c, TestSection? section) {
    final question = _activeQuestion;
    final isLastQuestionOfSection =
        section != null && _currentQuestionIndex == section.questions.length - 1;
    final isNotLastSection = _currentSectionIndex < _sections.length - 1;
    final isMarked = question != null && (_marked[question.id] ?? false);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.panel,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: isMarked ? 'Unmark' : 'Mark',
                  icon: Icons.flag_outlined,
                  color: c.violetText,
                  onPressed: _toggleMarkForReview,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ActionButton(
                  label: 'Clear',
                  icon: Icons.close,
                  onPressed: _clearResponse,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ActionButton(
                  label: 'Palette',
                  icon: Icons.grid_view,
                  color: c.brandBright,
                  onPressed: _openPalette,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (isLastQuestionOfSection && _hasSectionalTiming && isNotLastSection)
            PrimaryButton(
              label: 'Submit section',
              fullWidth: true,
              loading: _autoAdvancing,
              onPressed: _handleAdvanceSection,
            )
          else
            PrimaryButton(
              label: 'Save & next',
              fullWidth: true,
              onPressed: _handleSaveAndNext,
            ),
        ],
      ),
    );
  }

  void _openPalette() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _PaletteSheet(
        sections: _sections,
        currentSectionIndex: _currentSectionIndex,
        currentQuestionIndex: _currentQuestionIndex,
        authorizedSectionIndex: _session?.currentSectionIndex ?? 0,
        hasSectionalTiming: _hasSectionalTiming,
        palette: Map.of(_palette),
        onSelect: (sectionIdx, questionIdx) {
          Navigator.of(context).pop();
          _navigateToQuestion(sectionIdx, questionIdx);
        },
        onSubmit: () {
          Navigator.of(context).pop();
          _confirmSubmitDialog();
        },
      ),
    );
  }

  void _confirmSubmitDialog() {
    showDialog(
      context: context,
      builder: (dialogCtx) {
        return AlertDialog(
          title: const Text('Confirm Test Submission'),
          content: const Text(
            'Are you sure you want to submit your answers? You cannot change responses after submission.',
            style: TextStyle(fontSize: 14, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(dialogCtx).pop(),
              child: const Text('Cancel'),
            ),
            FilledButton(
              style: FilledButton.styleFrom(backgroundColor: useColors(context).danger),
              onPressed: () {
                Navigator.of(dialogCtx).pop();
                _handleManualSubmit();
              },
              child: const Text('Yes, Submit'),
            ),
          ],
        );
      },
    );
  }
}

/// The countdown, and the section countdown under it.
///
/// Tabular by construction — JetBrains Mono is monospaced, so the digits sit on
/// a fixed grid and the clock does not shuffle sideways once a second.
///
/// **The countdown is the guide's time colour — [AppColors.danger] — and under
/// five minutes it pulses on that same colour.** No second escalation: no
/// sound, no modal, no jump to a redder red. A paper is never interrupted, and
/// a countdown that changes colour under pressure teaches a student to panic at
/// exactly the moment they most need not to. One hertz is fast enough to notice
/// in peripheral vision and slow enough to ignore while reading.
class _Clock extends StatefulWidget {
  const _Clock({
    required this.seconds,
    required this.sectionSeconds,
    required this.pulse,
  });

  final int seconds;
  final int? sectionSeconds;
  final bool pulse;

  @override
  State<_Clock> createState() => _ClockState();
}

class _ClockState extends State<_Clock> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 500),
  );

  @override
  void didUpdateWidget(_Clock old) {
    super.didUpdateWidget(old);
    _sync();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync();
  }

  void _sync() {
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (widget.pulse && !reduce) {
      if (!_pulse.isAnimating) _pulse.repeat(reverse: true);
    } else if (_pulse.isAnimating) {
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  static String _format(int seconds) {
    final v = seconds < 0 ? 0 : seconds;
    final h = v ~/ 3600;
    final m = (v % 3600) ~/ 60;
    final sec = v % 60;
    final mm = m.toString().padLeft(2, '0');
    final ss = sec.toString().padLeft(2, '0');
    return h > 0 ? '${h.toString().padLeft(2, '0')}:$mm:$ss' : '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final section = widget.sectionSeconds;
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, _) => Opacity(
        opacity: 1 - 0.45 * _pulse.value,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(_format(widget.seconds),
                style: AppText.clockLg.copyWith(color: c.danger)),
            if (section != null) ...[
              const SizedBox(height: 4),
              Text('section ${_format(section)}',
                  style: AppText.clockSm.copyWith(color: c.textSecondary, fontSize: 10)),
            ],
          ],
        ),
      ),
    );
  }
}

/// One of the three chips on the marks line.
class _MarkChip extends StatelessWidget {
  const _MarkChip(this.label, this.color);

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.5)),
      ),
      child: Text(
        label,
        style: AppText.captionStrong.copyWith(color: color, fontSize: 10.5),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.label,
    required this.icon,
    required this.onPressed,
    this.color,
  });

  final String label;
  final IconData icon;
  final VoidCallback onPressed;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final fg = color ?? c.textPrimary;
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(9),
          border: Border.all(color: c.borderStrong),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 15, color: fg),
            const SizedBox(width: 6),
            Flexible(
              child: Text(label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.captionStrong.copyWith(color: fg, fontSize: 12)),
            ),
          ],
        ),
      ),
    );
  }
}

/// The question navigator.
///
/// Squares at 7 px radius, grouped per section with the section name as a
/// sticky header, the legend pinned below the grid rather than scrolling away
/// from it, and Submit Test at the foot of the sheet.
///
/// Under sectional timing a locked section dims to 40% and does not accept
/// taps: the student can see the shape of the rest of the paper without being
/// able to reach into it.
class _PaletteSheet extends StatelessWidget {
  const _PaletteSheet({
    required this.sections,
    required this.currentSectionIndex,
    required this.currentQuestionIndex,
    required this.authorizedSectionIndex,
    required this.hasSectionalTiming,
    required this.palette,
    required this.onSelect,
    required this.onSubmit,
  });

  final List<TestSection> sections;
  final int currentSectionIndex;
  final int currentQuestionIndex;
  final int authorizedSectionIndex;
  final bool hasSectionalTiming;
  final Map<int, String> palette;
  final void Function(int sectionIdx, int questionIdx) onSelect;
  final VoidCallback onSubmit;

  /// The CBT vocabulary, unchanged. This is the one place the brand palette
  /// does not reach: a student reads answer state off these squares under a
  /// countdown, and the meaning cannot shift between day and night.
  Color _statusColor(String status) {
    switch (status) {
      case 'not_answered':
        return CbtStatus.notAnsweredBg;
      case 'answered':
        return CbtStatus.answeredBg;
      case 'marked_for_review':
      case 'answered_and_marked':
        return CbtStatus.markedBg;
      default:
        return CbtStatus.notVisitedBg;
    }
  }

  bool _isAnsweredAndMarked(String status) => status == 'answered_and_marked';

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      constraints:
          BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.88),
      decoration: BoxDecoration(
        color: c.panel,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        border: Border.all(color: c.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text('Question navigator',
                      style: AppText.cardTitle.copyWith(color: c.textPrimary)),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).maybePop(),
                  icon: Icon(Icons.close, size: 20, color: c.textSecondary),
                  tooltip: 'Close',
                ),
              ],
            ),
          ),
          Flexible(
            child: CustomScrollView(
              shrinkWrap: true,
              slivers: [
                for (var idx = 0; idx < sections.length; idx++) ...[
                  SliverPersistentHeader(
                    pinned: true,
                    delegate: _SectionHeaderDelegate(
                      title: sections[idx].title ?? 'Section ${idx + 1}',
                      count: sections[idx].questions.length,
                      locked: hasSectionalTiming && idx != authorizedSectionIndex,
                      colors: c,
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.fromLTRB(18, 4, 18, 16),
                    sliver: _grid(context, idx),
                  ),
                ],
              ],
            ),
          ),
          // Pinned below the grid: a legend that scrolls away is a legend the
          // student cannot check at the moment they need it.
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(18, 12, 18, 0),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.border)),
            ),
            child: _legend(c),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(
                18, 12, 18, 12 + MediaQuery.paddingOf(context).bottom),
            child: PrimaryButton(
              label: 'Submit test',
              fullWidth: true,
              onPressed: onSubmit,
            ),
          ),
        ],
      ),
    );
  }

  Widget _grid(BuildContext context, int idx) {
    final section = sections[idx];
    final isCurrent = idx == currentSectionIndex;
    final isLocked = hasSectionalTiming && idx != authorizedSectionIndex;
    final activeQuestionId =
        isCurrent && currentQuestionIndex < section.questions.length
            ? section.questions[currentQuestionIndex].id
            : null;

    return SliverOpacity(
      opacity: isLocked ? 0.4 : 1,
      sliver: SliverGrid(
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 8,
          mainAxisSpacing: 7,
          crossAxisSpacing: 7,
          childAspectRatio: 1,
        ),
        delegate: SliverChildBuilderDelegate(
          (context, qIdx) =>
              _paletteButton(context, idx, qIdx, activeQuestionId, isLocked),
          childCount: section.questions.length,
        ),
      ),
    );
  }

  Widget _paletteButton(
    BuildContext context,
    int sectionIdx,
    int questionIdx,
    int? activeQuestionId,
    bool isLocked,
  ) {
    final q = sections[sectionIdx].questions[questionIdx];
    final status = palette[q.id] ?? 'not_visited';
    final isActive = q.id == activeQuestionId;
    final color = _statusColor(status);

    return InkWell(
      // Locked sections do not accept taps under sectional timing.
      onTap: isLocked ? null : () => onSelect(sectionIdx, questionIdx),
      borderRadius: BorderRadius.circular(7),
      child: AnimatedContainer(
        duration: AppTheme.paletteFlip,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(7),
          border: _isAnsweredAndMarked(status)
              ? Border.all(color: CbtStatus.answeredMarkedBorder, width: 2)
              : isActive
                  ? Border.all(color: Colors.white, width: 2)
                  : null,
        ),
        child: Text(
          '${questionIdx + 1}',
          style: const TextStyle(
            fontFamily: AppFont.ui,
            fontSize: 11,
            fontWeight: FontWeight.w700,
            height: 1,
            color: CbtStatus.answeredText,
          ),
        ),
      ),
    );
  }

  Widget _legend(AppColors c) {
    Widget chip(Color color, String label, {Color? ring}) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(3),
              border: ring == null ? null : Border.all(color: ring, width: 1.5),
            ),
          ),
          const SizedBox(width: 6),
          Text(label, style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 11)),
        ],
      );
    }

    return Wrap(
      spacing: 14,
      runSpacing: 10,
      children: [
        chip(CbtStatus.answeredBg, 'Answered'),
        chip(CbtStatus.notAnsweredBg, 'Not answered'),
        chip(CbtStatus.markedBg, 'Marked'),
        chip(CbtStatus.notVisitedBg, 'Not visited'),
        chip(CbtStatus.answeredMarkedBg, 'Answered + marked',
            ring: CbtStatus.answeredMarkedBorder),
      ],
    );
  }
}

/// Sticky section header for the navigator. Sized to a fixed extent because a
/// pinned header must know its own height before it is laid out.
class _SectionHeaderDelegate extends SliverPersistentHeaderDelegate {
  _SectionHeaderDelegate({
    required this.title,
    required this.count,
    required this.locked,
    required this.colors,
  });

  final String title;
  final int count;
  final bool locked;
  final AppColors colors;

  @override
  double get minExtent => 38;

  @override
  double get maxExtent => 38;

  @override
  Widget build(BuildContext context, double shrinkOffset, bool overlaps) {
    return Container(
      color: colors.panel,
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              title.toUpperCase(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppText.labelSm.copyWith(
                  color: locked ? colors.textMuted : colors.textPrimary),
            ),
          ),
          const SizedBox(width: 8),
          Text(
            locked ? 'LOCKED' : '$count questions',
            style: AppText.caption.copyWith(
                color: locked ? colors.orange : colors.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }

  @override
  bool shouldRebuild(_SectionHeaderDelegate old) =>
      old.title != title ||
      old.count != count ||
      old.locked != locked ||
      old.colors != colors;
}
