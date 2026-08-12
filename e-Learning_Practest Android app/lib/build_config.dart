/// Compile-time switches that differ between distribution channels.
///
/// These are `bool.fromEnvironment`, so they const-fold and the guarded Dart
/// branches become unreachable at compile time rather than merely hidden at
/// runtime. Note this does not unlink native plugin code: the razorpay_flutter
/// Android SDK is still registered by GeneratedPluginRegistrant and still ships
/// in the APK. What the gate guarantees is that no build with it off can reach
/// a purchase.
library;

/// Whether the build may sell course access inside the app.
///
/// **Off by default, and it must stay off for anything uploaded to Google
/// Play.** Play requires Google Play Billing for purchases of in-app digital
/// content; taking the same payment through Razorpay is a billing-policy
/// violation and a common cause of rejection or suspension. Students on the
/// Play build activate courses with an admin-issued activation code instead —
/// the flow the platform was designed around. The web SPA at
/// app.practest.live is unaffected and keeps its Razorpay checkout.
///
/// Enable only for a side-loaded or non-Play build:
///   flutter build apk --dart-define=ENABLE_IN_APP_PURCHASE=true
const bool enableInAppPurchase =
    bool.fromEnvironment('ENABLE_IN_APP_PURCHASE');

/// What Profile → About prints.
///
/// Kept beside the other compile-time switches rather than read from
/// `package_info_plus` at runtime: this is a one-line label, and adding a
/// plugin and an async call to render it would cost more than it is worth.
/// Bump it with `version:` in pubspec.yaml.
const String appVersionLabel = String.fromEnvironment(
  'APP_VERSION_LABEL',
  defaultValue: 'v1.0.0',
);
