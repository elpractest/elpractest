import 'package:flutter_test/flutter_test.dart';
import 'package:practest_app/boards.dart';

void main() {
  group('BoardCatalog.resolve', () {
    test('matches a board however the category was typed', () {
      for (final input in ['SSC', 'ssc', 'SSC CGL Tier I', 'ssc-cgl', 'SSC_CGL']) {
        expect(BoardCatalog.resolve(input)?.key, 'ssc', reason: input);
      }
    });

    test('does not let a shorter key eat a longer one', () {
      // The trap: `upsc` is a substring of `uppsc`, so a naive scan maps every
      // state-commission paper to the civil services exam.
      expect(BoardCatalog.resolve('UPPSC RO/ARO')?.key, 'uppsc');
      expect(BoardCatalog.resolve('UPSC CSE')?.key, 'upsc');
    });

    test('resolves aliases that do not contain their board name', () {
      expect(BoardCatalog.resolve('Railway NTPC')?.key, 'rrb');
      expect(BoardCatalog.resolve('Banking PO')?.key, 'ibps');
    });

    test('returns null rather than guessing', () {
      // Every caller treats null as "draw nothing". A mark on the wrong row is
      // worse than no mark.
      for (final input in [null, '', '   ', 'GENERAL', 'Weekly Practice']) {
        expect(BoardCatalog.resolve(input), isNull, reason: '$input');
      }
    });
  });

  group('BoardCatalog.railFrom', () {
    test('keeps first-seen order and drops duplicates', () {
      final rail = BoardCatalog.railFrom(
          ['IBPS PO', 'SSC CGL', 'ibps clerk', 'SSC CHSL', 'RRB NTPC']);
      expect(rail.map((b) => b.key).toList(), ['ibps', 'ssc', 'rrb']);
    });

    test('skips categories with no board, so the rail cannot show an empty one',
        () {
      expect(BoardCatalog.railFrom(['GENERAL', 'Misc', null]), isEmpty);
    });

    test('caps the rail so it cannot crowd out the resume card', () {
      final many = BoardCatalog.boards.map((b) => b.label).toList();
      expect(many.length, greaterThan(8));
      expect(BoardCatalog.railFrom(many).length, 8);
    });
  });
}
