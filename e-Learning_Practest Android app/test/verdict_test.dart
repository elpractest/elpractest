import 'package:flutter_test/flutter_test.dart';
import 'package:practest_app/models.dart';
import 'package:practest_app/verdict.dart';

ResultAnswer answer({
  required int id,
  required bool correct,
  bool skipped = false,
  num negative = 0.5,
  int seconds = 60,
}) =>
    ResultAnswer(
      questionId: id,
      marks: 2,
      negativeMarks: negative,
      selectedOptionId: skipped ? null : 99,
      isCorrect: correct,
      timeSpentSeconds: seconds,
    );

TestResultData result(List<ResultAnswer> answers, {Analytic? analytic}) =>
    TestResultData(analytic: analytic ?? const Analytic(), answers: answers);

void main() {
  group('Verdict', () {
    test('says nothing when nothing was attempted', () {
      final v = Verdict.from(result([
        answer(id: 1, correct: false, skipped: true),
        answer(id: 2, correct: false, skipped: true),
      ]));
      // An absent panel is invisible; a hedging one is corrosive.
      expect(v.isEmpty, isTrue);
      expect(v.wrongCount, 0);
    });

    test('names the marks lost to negative marking', () {
      final v = Verdict.from(result([
        answer(id: 1, correct: false, negative: 0.5, seconds: 144),
        answer(id: 2, correct: false, negative: 0.5, seconds: 144),
        answer(id: 3, correct: true),
      ]));
      expect(v.wrongCount, 2);
      expect(v.text, contains('lost 1 mark'));
      expect(v.text, contains('two wrong at 2.4 minutes each'));
    });

    test('names the worst subject only when one clearly leads', () {
      final answers = [
        answer(id: 1, correct: false),
        answer(id: 2, correct: false),
      ];

      final clear = Verdict.from(result(answers,
          analytic: const Analytic(subjectBreakdown: {
            'Quant': BreakdownRow(correct: 3, incorrect: 7),
            'Reasoning': BreakdownRow(correct: 9, incorrect: 1),
          })));
      expect(clear.text, contains('in Quant'));

      // A tie is not a finding, and naming an arbitrary half of one is worse
      // than naming none.
      final tied = Verdict.from(result(answers,
          analytic: const Analytic(subjectBreakdown: {
            'Quant': BreakdownRow(correct: 3, incorrect: 4),
            'Reasoning': BreakdownRow(correct: 9, incorrect: 4),
          })));
      expect(tied.text, isNot(contains('in Quant')));
      expect(tied.text, isNot(contains('in Reasoning')));
    });

    test('reports fast-attempt accuracy only when the split is meaningful', () {
      // Three fast, three slow: enough on both sides to mean something.
      final split = Verdict.from(result([
        for (var i = 0; i < 3; i++) answer(id: i, correct: true, seconds: 40),
        for (var i = 3; i < 6; i++) answer(id: i, correct: false, seconds: 200),
      ]));
      expect(split.text, contains('under 90 seconds'));

      // Two fast attempts is a coincidence, not a finding.
      final lopsided = Verdict.from(result([
        for (var i = 0; i < 2; i++) answer(id: i, correct: true, seconds: 40),
        for (var i = 2; i < 8; i++) answer(id: i, correct: false, seconds: 200),
      ]));
      expect(lopsided.text, isNot(contains('under 90 seconds')));
    });

    test('has something true to say about a clean sheet', () {
      final v = Verdict.from(result([
        answer(id: 1, correct: true),
        answer(id: 2, correct: true),
        answer(id: 3, correct: false, skipped: true),
      ]));
      expect(v.isEmpty, isFalse);
      expect(v.wrongCount, 0);
      expect(v.text, contains('left one untouched'));
    });

    test('never praises and never scolds', () {
      final v = Verdict.from(result([
        answer(id: 1, correct: false, seconds: 120),
        answer(id: 2, correct: true),
      ]));
      for (final banned in [
        'great', 'well done', 'poor', 'excellent', 'keep it up', 'unfortunately',
      ]) {
        expect(v.text.toLowerCase(), isNot(contains(banned)), reason: banned);
      }
    });
  });
}
