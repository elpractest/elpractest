import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:practest_app/app.dart';
import 'package:practest_app/scaffold.dart';

void main() {
  // NOTE: never `pumpAndSettle` this app. The aurora backdrop runs a repeating
  // animation for the lifetime of every screen, so there is no settled state to
  // wait for — advance time with explicit `pump(Duration)` instead.
  testWidgets('boots to the branded splash, then hands off to the welcome',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await ThemeController.instance.init();

    await tester.pumpWidget(const PractestApp());
    await tester.pump();

    // Splash first: the full wordmark and the bilingual tagline, and none of
    // the welcome yet. The guide sets the splash wordmark as "e-Learning
    // Practest" — the short "Practest" belongs to the header, where the lockup
    // cannot hold its cap height.
    expect(find.text('e-Learning Practest'), findsOneWidget);
    expect(
        find.text('अभ्यास से सफलता तक · Practice to Success'), findsOneWidget);
    expect(find.text('Get Started'), findsNothing);

    // Past the splash sequence.
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 1));

    // Unauthenticated, so the guide's welcome is what the student lands on —
    // the gold CTA and the ghost sign-in are both on it.
    expect(find.text('Get Started'), findsOneWidget);
    expect(find.text('I already have an account'), findsOneWidget);
    // The splash is genuinely gone, not merely covered.
    expect(find.text('अभ्यास से सफलता तक · Practice to Success'), findsNothing);
  });
}
