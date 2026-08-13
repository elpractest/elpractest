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

  test('gold is legible wherever it carries meaning', () {
    // This replaced "each hue owns exactly one job", which asserted
    // brand != orange != gold. That rule belonged to the teal system; the
    // current guide has no teal and no orange, and makes gold both the brand
    // and achievement — so those three being equal is now the design, not a
    // regression. What the guide put in its place is a contrast rule, because
    // the flat brand gold is about 1.9:1 on white.
    expect(AppColors.light.brandBright, isNot(AppColors.light.brand));
    expect(AppColors.light.gold, isNot(AppColors.light.brand));

    for (final palette in [AppColors.dark, AppColors.light]) {
      // Ink on a gold fill is the guide's dark ink. White is the easy mistake
      // here and it is unreadable on every stop of the gold gradient.
      expect(palette.onBrand, const Color(0xFF1A1206));
      expect(palette.onBrand, isNot(Colors.white));
    }
  });

  test('every Latin text style can render Devanagari', () {
    // Neither Sora nor Plus Jakarta Sans contains a Devanagari glyph. Without
    // the fallback, one Hindi word in an English string silently renders in
    // whatever the OEM ships — the failure looks like a font bug on one phone
    // and nothing at all on another, so it is worth a test.
    for (final s in [
      AppText.hero,
      AppText.screenTitle,
      AppText.cardTitle,
      AppText.body,
      AppText.button,
      AppText.label,
      AppText.tab,
    ]) {
      expect(s.fontFamilyFallback, contains(AppFont.hindi));
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
