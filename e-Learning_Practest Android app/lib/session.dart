import 'package:flutter/foundation.dart';

import 'api_client.dart';
import 'models.dart';

enum AuthStatus { loading, unauthenticated, authenticated }

class Session extends ChangeNotifier {
  Session._() {
    ApiClient.instance.onUnauthorized = () {
      _user = null;
      _status = AuthStatus.unauthenticated;
      notifyListeners();
    };
  }

  static final Session instance = Session._();

  AuthStatus _status = AuthStatus.loading;
  User? _user;

  AuthStatus get status => _status;
  User? get user => _user;
  bool get isAuthenticated => _status == AuthStatus.authenticated && _user != null;

  /// Restore token + hydrate the current user on app start.
  Future<void> init() async {
    await ApiClient.instance.init();
    if (!ApiClient.instance.hasToken) {
      _status = AuthStatus.unauthenticated;
      notifyListeners();
      return;
    }
    try {
      final data = await ApiClient.instance.get('/me');
      final u = data['user'] is Map ? data['user'] as Map<String, dynamic> : data;
      _user = User.fromJson(u);
      _status = AuthStatus.authenticated;
    } catch (_) {
      await ApiClient.instance.clearToken();
      _status = AuthStatus.unauthenticated;
    }
    notifyListeners();
  }

  /// Bearer-token login (mobile endpoint). Throws [ApiException] on failure.
  Future<void> mobileLogin(String email, String password) async {
    final data = await ApiClient.instance.post('/mobile/login', body: {
      'email': email,
      'password': password,
      'device_name': 'Practest Android',
    });
    await ApiClient.instance.storeToken(data['token'] as String);
    _user = User.fromJson(data['user'] as Map<String, dynamic>);
    _status = AuthStatus.authenticated;
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await ApiClient.instance.postRaw('/mobile/logout');
    } catch (_) {
      // ignore network errors — token is cleared locally regardless
    }
    await ApiClient.instance.clearToken();
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }

  void setUnauthenticated() {
    _user = null;
    _status = AuthStatus.unauthenticated;
    notifyListeners();
  }
}

/// Result of a login attempt — carries flags the UI needs to branch on.
class MobileLoginResult {
  const MobileLoginResult({
    this.emailUnverified = false,
    this.adminWebOnly = false,
  });

  final bool emailUnverified;
  final bool adminWebOnly;
}
