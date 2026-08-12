import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:practest_app/models.dart';
import 'package:practest_app/promo_banner_carousel.dart';
import 'package:practest_app/theme.dart';

/// The Home promo carousel (Phase 6). A build can't replace a phone, but it can
/// hold the line on: it renders in both themes, it shows the banner's text and
/// CTA, and — like the web version — it renders nothing when there are no
/// banners, so Home is untouched until a super-admin publishes one.
Widget host(Widget child, {required bool dark}) => MaterialApp(
      theme: AppTheme.build(dark ? AppThemeMode.dark : AppThemeMode.light),
      home: Scaffold(body: child),
    );

void main() {
  const banner = PromoBanner(
    id: 1,
    kicker: 'New',
    title: 'SSC CGL 2026 crash course',
    subtitle: 'Starts Monday',
    ctaLabel: 'Enroll now',
    ctaUrl: 'https://practest.live/courses/ssc',
  );

  testWidgets('renders nothing when there are no banners', (tester) async {
    await tester.pumpWidget(host(
      const PromoBannerCarousel(banners: [], colors: AppColors.light),
      dark: false,
    ));

    expect(find.byType(PageView), findsNothing);
    expect(find.text('Enroll now'), findsNothing);
  });

  for (final dark in [false, true]) {
    final label = dark ? 'dark' : 'light';
    testWidgets('shows the banner text and CTA in $label theme', (tester) async {
      await tester.pumpWidget(host(
        PromoBannerCarousel(banners: const [banner], colors: dark ? AppColors.dark : AppColors.light),
        dark: dark,
      ));

      expect(find.text('SSC CGL 2026 crash course'), findsOneWidget);
      expect(find.text('Starts Monday'), findsOneWidget);
      expect(find.text('Enroll now'), findsOneWidget);
      expect(find.text('NEW'), findsOneWidget); // kicker is upper-cased
    });
  }

  testWidgets('shows a pager for multiple banners', (tester) async {
    await tester.pumpWidget(host(
      const PromoBannerCarousel(
        banners: [banner, PromoBanner(id: 2, title: 'Second banner')],
        colors: AppColors.light,
      ),
      dark: false,
    ));

    expect(find.byType(PageView), findsOneWidget);
    expect(find.text('SSC CGL 2026 crash course'), findsOneWidget);
  });
}
