import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'api_client.dart';
import 'routes.dart';

/// Global navigator key so push taps can deep-link from outside a widget tree.
/// Wired into MaterialApp in app.dart.
final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

/// Background/terminated-state message handler. Must be a top-level function
/// annotated for the AOT entry point. The system tray renders the notification;
/// nothing to do here beyond existing so background delivery is registered.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {}

/// FCM v1.1 client. Registers the device token with the backend the app already
/// talks to (POST /student/device-tokens), keeps it fresh, removes it on logout,
/// and deep-links on tap. Every network call is best-effort: a push problem must
/// never disrupt auth or navigation. See docs/FCM_V1.1_SCOPE.md in the api repo.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  final FirebaseMessaging _fm = FirebaseMessaging.instance;
  bool _wired = false;

  /// Call once after Firebase.initializeApp(). Idempotent.
  Future<void> init() async {
    if (_wired) return;
    _wired = true;

    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Android 13+ shows a runtime prompt; older versions grant silently.
    await _fm.requestPermission();

    // Tap handling: warm (app in background) and cold (from terminated).
    FirebaseMessaging.onMessageOpenedApp.listen(_handleTap);
    final initial = await _fm.getInitialMessage();
    if (initial != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _handleTap(initial));
    }

    // Keep the backend in sync when FCM rotates the token.
    _fm.onTokenRefresh.listen((_) => registerToken());
  }

  /// Register this device's token with the backend. No-ops without a bearer.
  Future<void> registerToken() async {
    if (!ApiClient.instance.hasToken) return;
    try {
      final token = await _fm.getToken();
      if (token == null || token.isEmpty) return;
      await ApiClient.instance.post('/student/device-tokens', body: {
        'token': token,
        'platform': 'android',
      });
    } catch (_) {
      // Best-effort: never surface a push registration failure to the user.
    }
  }

  /// Remove this device's token. Call BEFORE the bearer is cleared on logout,
  /// otherwise the request is unauthenticated and no-ops.
  Future<void> unregisterToken() async {
    if (!ApiClient.instance.hasToken) return;
    try {
      final token = await _fm.getToken();
      if (token == null || token.isEmpty) return;
      await ApiClient.instance.delete('/student/device-tokens', body: {'token': token});
    } catch (_) {
      // Best-effort.
    }
  }

  void _handleTap(RemoteMessage message) {
    // Only deep-link a logged-in user; otherwise the target screens can't load.
    if (!ApiClient.instance.hasToken) return;

    final nav = appNavigatorKey.currentState;
    if (nav == null) return;

    final target = _mapRoute(message.data['route'] as String?);
    if (target != null) {
      nav.pushNamed(target.$1, arguments: target.$2);
    } else {
      // Unknown/listing routes (e.g. /dashboard) → open the feed.
      nav.pushNamed(Routes.notifications);
    }
  }

  /// Map a backend (web SPA) route string to a Flutter route + int argument.
  /// Returns null for routes without a dedicated screen, which fall back to the
  /// notifications list.
  (String, int)? _mapRoute(String? route) {
    if (route == null || route.isEmpty) return null;
    final segs = route.split('/').where((s) => s.isNotEmpty).toList();

    // /tests/{id}/result
    if (segs.length == 3 && segs[0] == 'tests' && segs[2] == 'result') {
      final id = int.tryParse(segs[1]);
      if (id != null) return (Routes.result, id);
    }
    // /courses/{id}/outline
    if (segs.length == 3 && segs[0] == 'courses' && segs[2] == 'outline') {
      final id = int.tryParse(segs[1]);
      if (id != null) return (Routes.courseOutline, id);
    }
    // /student/test-series/{id}
    if (segs.length == 3 && segs[0] == 'student' && segs[1] == 'test-series') {
      final id = int.tryParse(segs[2]);
      if (id != null) return (Routes.testSeriesDetail, id);
    }
    return null;
  }
}
