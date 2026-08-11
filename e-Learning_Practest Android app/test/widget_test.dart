import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:practest_app/app.dart';
import 'package:practest_app/scaffold.dart';

void main() {
  // NOTE: never `pumpAndSettle` this app. The aurora backdrop runs a repeating
  // animation for the lifetime of every screen, so there is no settled state to
  // wait for — advance time with explicit `pump(Duration)` instead.
  testWidgets('boots to the branded splash, then hands off to the intro',
      (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await ThemeController.instance.init();

    await tester.pumpWidget(const PractestApp());
    await tester.pump();

    // Splash first: brand lockup and tagline, and none of the intro yet.
    expect(find.text('Practest'), findsOneWidget);
    expect(find.text('Practice like it is exam day'), findsOneWidget);
    expect(find.text('Create free account'), findsNothing);

    // Past the splash sequence and the intro's staggered entrance.
    await tester.pump(const Duration(seconds: 3));
    await tester.pump(const Duration(seconds: 1));

    // Unauthenticated, so the intro is what the student lands on — and both
    // ways in are on it.
    expect(find.text('Create free account'), findsOneWidget);
    expect(find.text('I already have an account'), findsOneWidget);
    expect(find.text('Practice like it is exam day'), findsNothing);
  });
}
