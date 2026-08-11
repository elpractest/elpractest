import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:practest_app/widgets.dart';

void main() {
  Future<void> pump(WidgetTester tester, String text) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: SingleChildScrollView(
            child: MathText(text),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  testWidgets('renders undelimited latex integral without error',
      (WidgetTester tester) async {
    await pump(tester, r'Evaluate: \int \sin^2(x) \cos(x) dx.');
    expect(tester.takeException(), isNull);
    expect(find.byType(Math), findsWidgets);
  });

  testWidgets('renders undelimited latex equation without error',
      (WidgetTester tester) async {
    await pump(tester, r'If x + \frac{1}{x} = 5, find the value of x^2.');
    expect(tester.takeException(), isNull);
    expect(find.byType(Math), findsWidgets);
  });

  testWidgets('still renders dollar-delimited math', (WidgetTester tester) async {
    await pump(tester, r'If $x + \frac{1}{x} = 5$, find $x^2$.');
    expect(tester.takeException(), isNull);
    expect(find.byType(Math), findsWidgets);
  });

  testWidgets('plain prose renders as text without math widgets',
      (WidgetTester tester) async {
    await pump(tester, r'Which river is called the "Sorrow of Bihar"?');
    expect(tester.takeException(), isNull);
    expect(find.byType(Math), findsNothing);
  });

  testWidgets('renders full question 3 exactly as stored in the DB',
      (WidgetTester tester) async {
    await pump(
      tester,
      r'If $x + \frac{1}{x} = 5$, find the value of $x^2 + \frac{1}{x^2}$.',
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(Math), findsWidgets);
  });

  testWidgets('renders full question 4 exactly as stored in the DB',
      (WidgetTester tester) async {
    await pump(
      tester,
      r'Evaluate: $\int \sin^2(x) \cos(x) dx$. Choose the correct answer representation.',
    );
    expect(tester.takeException(), isNull);
    expect(find.byType(Math), findsWidgets);
  });
}
