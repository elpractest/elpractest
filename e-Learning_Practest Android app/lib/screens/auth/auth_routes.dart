import 'package:flutter/material.dart';

import 'login_screen.dart';

/// Send the user back to the login form from a dead-end auth screen
/// (verify-email, forgot-password, reset-password).
///
/// These screens used to call
/// `pushAndRemoveUntil(LoginScreen(), (route) => false)`, which was harmless
/// when `LoginScreen` *was* the app's root. It is not harmless now: the root is
/// `RootGate`, and a predicate of `(route) => false` removes it along with
/// everything else. The app would be left with a login form and no gate above
/// it, so a successful login would notify a `RootGate` that is no longer in the
/// tree — the student signs in and simply stays on the login screen.
///
/// Unwinding to the root and pushing login on top keeps the gate alive and
/// still lands the user exactly where they expect.
void returnToLogin(BuildContext context) {
  final navigator = Navigator.of(context);
  navigator.popUntil((route) => route.isFirst);
  navigator.push(MaterialPageRoute(builder: (_) => const LoginScreen()));
}
