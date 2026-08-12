import 'models.dart';

/// The result screen's opinion, computed rather than written.
///
/// Every figure in it already exists in the session payload — this adds no
/// request and no model call. It is kept out of the widget so it can be read,
/// argued with and tested on its own.
///
/// **Voice: second person, past tense, no praise and no scolding.** "You lost
/// 14 marks to negative marking" — never "Great effort!" and never "Poor
/// performance". A student who has just seen their score does not need to be
/// managed; they need to know what happened.
class Verdict {
  const Verdict({required this.sentences, required this.wrongCount});

  /// One paragraph, already assembled. Empty means there is nothing honest to
  /// say, and the caller draws no block at all — an absent panel is invisible,
  /// a hedging one is corrosive.
  final List<String> sentences;

  /// How many wrong answers the "review these" action would jump to.
  final int wrongCount;

  bool get isEmpty => sentences.isEmpty;

  String get text => sentences.join(' ');

  /// Attempts spent under this are "fast" for the purposes of the second
  /// sentence. Ninety seconds is the boundary an aspirant already thinks in:
  /// it is roughly the per-question budget in a 100-question, 60-minute paper.
  static const int fastAttemptSeconds = 90;

  static Verdict from(TestResultData data) {
    final answers = data.answers;
    final attempted = answers.where((a) => !a.isSkipped).toList();
    if (attempted.isEmpty) return const Verdict(sentences: [], wrongCount: 0);

    final wrong = attempted.where((a) => !a.isCorrect).toList();
    final sentences = <String>[];

    if (wrong.isNotEmpty) {
      final lost = wrong.fold<num>(0, (sum, a) => sum + (a.negativeMarks ?? 0));
      final seconds = wrong.fold<int>(0, (sum, a) => sum + a.timeSpentSeconds);
      final perQuestion = seconds / wrong.length / 60;
      final subject = _worstSubject(data.analytic);

      final where = subject == null ? '' : ' in $subject';
      if (lost > 0) {
        sentences.add('You lost ${_number(lost)} '
            '${lost == 1 ? 'mark' : 'marks'} to negative marking$where — '
            '${_words(wrong.length)} wrong at '
            '${perQuestion.toStringAsFixed(1)} minutes each.');
      } else {
        sentences.add('You got ${_words(wrong.length)} wrong$where, at '
            '${perQuestion.toStringAsFixed(1)} minutes each.');
      }
    }

    // Speed against accuracy. Only stated when both halves of the split have
    // enough attempts to mean anything — otherwise it is a coincidence
    // dressed as a finding.
    final fast =
        attempted.where((a) => a.timeSpentSeconds <= fastAttemptSeconds).toList();
    final slow = attempted.length - fast.length;
    if (fast.length >= 3 && slow >= 3) {
      final fastCorrect = fast.where((a) => a.isCorrect).length;
      final fastAccuracy = (fastCorrect / fast.length * 100).round();
      sentences.add('Your accuracy on attempts you spent under '
          '$fastAttemptSeconds seconds on was $fastAccuracy%.');
    }

    final skipped = answers.where((a) => a.isSkipped).length;
    if (sentences.isEmpty && skipped > 0) {
      sentences.add('You answered every question you attempted correctly, and '
          'left ${_words(skipped)} untouched.');
    } else if (sentences.isEmpty) {
      sentences.add('You attempted all ${answers.length} questions and got '
          'every one of them right.');
    }

    return Verdict(sentences: sentences, wrongCount: wrong.length);
  }

  /// The subject the student got most wrong, named only when one clearly leads.
  /// A tie is not a finding, and naming an arbitrary half of one is worse than
  /// naming none.
  static String? _worstSubject(Analytic analytic) {
    final rows = analytic.subjectBreakdown.entries
        .where((e) => e.value.incorrect > 0)
        .toList()
      ..sort((a, b) => b.value.incorrect.compareTo(a.value.incorrect));
    if (rows.isEmpty) return null;
    if (rows.length > 1 && rows[0].value.incorrect == rows[1].value.incorrect) {
      return null;
    }
    final name = rows.first.key.trim();
    if (name.isEmpty || name.toLowerCase() == 'uncategorized') return null;
    return name;
  }

  static const _numberWords = [
    'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
    'nine', 'ten', 'eleven', 'twelve',
  ];

  /// Small counts read better as words inside a sentence; large ones do not.
  static String _words(int n) =>
      n < _numberWords.length ? _numberWords[n] : '$n';

  static String _number(num v) =>
      v == v.roundToDouble() ? v.round().toString() : v.toStringAsFixed(1);
}
