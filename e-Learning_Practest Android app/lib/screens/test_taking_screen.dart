import '../scaffold.dart';
import 'dart:async';

import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../widgets.dart';
import 'test_result_screen.dart';

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
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => TestResultScreen(sessionId: widget.sessionId)),
    );
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
        showThemeToggle: false,
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
        showThemeToggle: false,
        safeArea: false,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(width: 34, height: 34, child: CircularProgressIndicator(strokeWidth: 3)),
              const SizedBox(height: 16),
              Text('Section Time Expired!',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: c.accent)),
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
      showThemeToggle: false,
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

  Widget _buildTopBar(AppColors c, bool totalDanger, bool sectionDanger) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: c.panelBg,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              IconButton(
                onPressed: _confirmSubmitDialog,
                icon: Icon(Icons.arrow_back, color: c.textPrimary),
                tooltip: 'Submit and exit',
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(_session?.testTitle ?? 'Mock Test Series',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary)),
                    if (_activeSection != null)
                      Text('Active Section: ${_activeSection!.title ?? ''}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 11.5, color: c.accent)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              if (_sectionTimeRemaining != null)
                _Clock(
                  label: 'Section',
                  seconds: _sectionTimeRemaining!,
                  danger: sectionDanger,
                ),
              const SizedBox(width: 10),
              _Clock(
                label: 'Total',
                seconds: _timeRemaining ?? 0,
                danger: totalDanger,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionArea(AppColors c, TestSection section, Question question) {
    final selected = _answers[question.id];
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        GlassPanel(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text('Question ${_currentQuestionIndex + 1}',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: c.textPrimary)),
                  ),
                  Text.rich(TextSpan(
                    children: [
                      TextSpan(
                        text: 'Marks: +${question.marks ?? 0}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.success),
                      ),
                      TextSpan(
                        text: '  /  Negative: -${question.negativeMarks ?? 0}',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: c.dangerText),
                      ),
                    ],
                  )),
                ],
              ),
              const Divider(height: 24),
              Text(
                '${question.subject ?? ''}${question.topic != null ? ' · ${question.topic}' : ''}'
                '${question.difficulty != null ? ' · ${question.difficulty}' : ''}',
                style: TextStyle(fontSize: 11.5, color: c.textSecondary),
              ),
              const SizedBox(height: 10),
              MathText(question.questionText,
                  style: TextStyle(fontSize: 16, color: c.textPrimary, height: 1.6)),
              const SizedBox(height: 20),
              for (final option in question.options) ...[
                _buildOption(c, option, selected == option.id),
                const SizedBox(height: 10),
              ],
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildOption(AppColors c, QuestionOption option, bool isSelected) {
    return InkWell(
      onTap: () => _selectOption(option.id),
      borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected ? c.accentSoft : c.surface1,
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          border: Border.all(color: isSelected ? c.accent : c.border, width: isSelected ? 1.5 : 1),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 26,
              height: 26,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected ? c.accent : c.surfaceSunken,
                shape: BoxShape.circle,
                border: Border.all(color: isSelected ? c.accent : c.borderStrong),
              ),
              child: Text(
                option.label ?? '',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: isSelected ? c.accentContrast : c.textPrimary,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: MathText(option.optionText,
                  style: TextStyle(fontSize: 14.5, color: c.textPrimary, height: 1.5)),
            ),
            if (isSelected) Icon(Icons.check_circle, size: 18, color: c.accent),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomBar(AppColors c, TestSection? section) {
    final question = _activeQuestion;
    final isLastQuestionOfSection =
        section != null && _currentQuestionIndex == section.questions.length - 1;
    final isNotLastSection = _currentSectionIndex < _sections.length - 1;
    final isMarked = question != null && (_marked[question.id] ?? false);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: c.panelBg,
        border: Border(top: BorderSide(color: c.border)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: _ActionButton(
                  label: isMarked ? 'Unmark Review' : 'Mark for Review',
                  icon: Icons.flag_outlined,
                  color: c.violetText,
                  onPressed: _toggleMarkForReview,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ActionButton(
                  label: 'Clear Response',
                  icon: Icons.close,
                  onPressed: _clearResponse,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _ActionButton(
                  label: 'Palette',
                  icon: Icons.grid_view,
                  color: c.accent,
                  onPressed: _openPalette,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          if (isLastQuestionOfSection && _hasSectionalTiming && isNotLastSection)
            GradientButton(
              label: 'Submit Section',
              fullWidth: true,
              loading: _autoAdvancing,
              onPressed: _handleAdvanceSection,
            )
          else
            GradientButton(
              label: 'Save & Next',
              icon: Icons.check_circle_outline,
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

class _Clock extends StatelessWidget {
  const _Clock({required this.label, required this.seconds, required this.danger});

  final String label;
  final int seconds;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final clockColor = danger ? c.dangerText : c.textPrimary;
    final h = seconds ~/ 3600;
    final m = (seconds % 3600) ~/ 60;
    final s = seconds % 60;
    final mm = m.toString().padLeft(2, '0');
    final ss = s.toString().padLeft(2, '0');
    final text = h > 0 ? '${h.toString().padLeft(2, '0')}:$mm:$ss' : '$mm:$ss';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text(label,
            style: TextStyle(fontSize: 9.5, color: c.textSecondary, letterSpacing: 0.4)),
        Text(
          text,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w800,
            color: clockColor,
            fontFeatures: const [FontFeature.tabularFigures()],
          ),
        ),
      ],
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
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: c.surface1,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: c.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: fg),
            const SizedBox(height: 3),
            Text(label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: fg)),
          ],
        ),
      ),
    );
  }
}

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

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
      decoration: BoxDecoration(
        color: c.panelBgSolid,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: c.borderStrong),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Question Navigator',
                style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800, color: c.textPrimary)),
            const SizedBox(height: 14),
            for (var idx = 0; idx < sections.length; idx++)
              _sectionCard(context, idx),
            const Divider(height: 28),
            _legend(c),
            const SizedBox(height: 16),
            GradientButton(
              label: 'Submit Test',
              icon: Icons.send,
              fullWidth: true,
              onPressed: onSubmit,
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _sectionCard(BuildContext context, int idx) {
    final c = useColors(context);
    final section = sections[idx];
    final isCurrent = idx == currentSectionIndex;
    final isLocked = hasSectionalTiming && idx != authorizedSectionIndex;
    final activeQuestionId = isCurrent
        ? section.questions[currentQuestionIndex].id
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.surface1,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isCurrent ? c.accent : c.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(section.title ?? 'Section ${idx + 1}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: isLocked ? c.textSecondary : c.textPrimary,
                    )),
              ),
              if (isLocked)
                StatusChip('LOCKED', color: c.textSecondary),
            ],
          ),
          const SizedBox(height: 12),
          GridView.count(
            crossAxisCount: 5,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 8,
            crossAxisSpacing: 8,
            children: [
              for (var qIdx = 0; qIdx < section.questions.length; qIdx++)
                _paletteButton(context, idx, qIdx, activeQuestionId, isLocked),
            ],
          ),
        ],
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
      onTap: isLocked ? null : () => onSelect(sectionIdx, questionIdx),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(8),
          border: isActive ? Border.all(color: CbtStatus.answeredMarkedBorder, width: 2) : null,
        ),
        child: Text(
          '${questionIdx + 1}',
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: CbtStatus.answeredText,
          ),
        ),
      ),
    );
  }

  Widget _legend(AppColors c) {
    Widget row(String status, Color color, String label) {
      return Row(
        children: [
          Container(width: 16, height: 16, decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4))),
          const SizedBox(width: 8),
          Text(label, style: TextStyle(fontSize: 12, color: c.textSecondary)),
        ],
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final entry in const [
          ('not_visited', 'Not Visited'),
          ('not_answered', 'Not Answered'),
          ('answered', 'Answered'),
          ('marked_for_review', 'Marked for Review'),
          ('answered_and_marked', 'Answered & Marked for Review'),
        ])
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: row(entry.$1, _statusColor(entry.$1), entry.$2),
          ),
      ],
    );
  }
}
