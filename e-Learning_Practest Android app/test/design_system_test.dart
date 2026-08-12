import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:practest_app/boards.dart';
import 'package:practest_app/theme.dart';
import 'package:practest_app/widgets.dart';

/// The audit's standing finding is that the app had **never been seen in the
/// dark palette it was designed for**. Nothing here replaces putting a physical
/// phone in front of it, but it does hold the line on the two things a build
/// can check: every component renders in both themes, and the CBT vocabulary is
/// byte-identical between them.
Widget host(Widget child, {required bool dark}) => MaterialApp(
      theme: AppTheme.build(dark ? AppThemeMode.dark : AppThemeMode.light),
      home: Scaffold(body: SingleChildScrollView(child: child)),
    );

void main() {
  final components = <String, Widget Function(BuildContext)>{
    'SurfacePanel': (_) => const SurfacePanel(child: Text('panel')),
    'PrimaryButton': (_) => PrimaryButton(label: 'Start test', onPressed: () {}),
    'SecondaryButton': (_) =>
        SecondaryButton(label: 'Practise it now', onPressed: () {}),
    'SectionHeading': (_) => const SectionHeading('This week'),
    'StatTile': (ctx) => StatTile(
        value: '64%', caption: 'Accuracy', color: useColors(ctx).gold),
    'TrailingBadge outlined': (ctx) =>
        TrailingBadge('96 days', color: useColors(ctx).orange),
    'TrailingBadge filled': (ctx) =>
        TrailingBadge('REDEEM', color: useColors(ctx).orange, filled: true),
    'ProgressBar': (_) => const ProgressBar(percent: 47),
    'BoardTile': (_) => SizedBox(
        width: 80,
        height: 80,
        child: BoardTile(board: BoardCatalog.boards.first)),
    'BoardChip': (_) => BoardChip(board: BoardCatalog.boards.first),
    'SettingRow': (_) =>
        const SettingRow(icon: Icons.vpn_key_outlined, label: 'Activate a course'),
    'EmptyState': (_) => const EmptyState(
        icon: Icons.menu_book_outlined, message: 'No courses yet.'),
    'ErrorBanner': (_) => const ErrorBanner('Could not load your dashboard.'),
    'CourseCover': (_) => const CourseCover(title: 'SSC Foundation 2026'),
    'BrandWordmark': (_) => const BrandWordmark(),
  };

  for (final dark in [true, false]) {
    final name = dark ? 'dark' : 'light';
    group('$name theme', () {
      components.forEach((label, build) {
        testWidgets('$label renders', (tester) async {
          await tester.pumpWidget(host(
            Builder(builder: (ctx) => build(ctx)),
            dark: dark,
          ));
          // The aurora is gone, so the tree can finally settle — which is what
          // makes pumpAndSettle usable again at all.
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull, reason: '$label in $name');
        });
      });
    });
  }

  test('the CBT vocabulary is identical in both themes', () {
    // A student reads answer state off these squares under a countdown. The
    // meaning cannot shift between day and night, or between releases.
    expect(CbtStatus.notVisitedBg, const Color(0xFF64748B));
    expect(CbtStatus.notAnsweredBg, const Color(0xFFE5484D));
    expect(CbtStatus.answeredBg, const Color(0xFF0EA371));
    expect(CbtStatus.markedBg, const Color(0xFF8B5CF6));
    expect(CbtStatus.answeredMarkedBorder, const Color(0xFF34D399));
    // Deliberately not the success token.
    expect(CbtStatus.answeredBg, isNot(AppColors.light.success));
  });

  test('each hue owns exactly one job', () {
    for (final palette in [AppColors.dark, AppColors.light]) {
      // Nothing borrows another's meaning — the single rule that keeps a dense
      // exam screen legible.
      expect(palette.brand, isNot(palette.orange));
      expect(palette.orange, isNot(palette.gold));
      expect(palette.gold, isNot(palette.brand));
    }
  });

  test('the type scale never exceeds weight 800', () {
    const styles = [
      AppText.scoreHero,
      AppText.score,
      AppText.figure,
      AppText.clock,
      AppText.screenTitle,
      AppText.cardTitle,
      AppText.label,
      AppText.button,
    ];
    for (final s in styles) {
      expect(s.fontWeight!.value, lessThanOrEqualTo(FontWeight.w800.value));
    }
  });

  test('every figure style is monospaced, so digits cannot jitter', () {
    for (final s in [AppText.scoreHero, AppText.score, AppText.figure, AppText.clock]) {
      expect(s.fontFamily, AppFont.mono);
    }
  });
}
