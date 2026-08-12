import 'package:shared_preferences/shared_preferences.dart';

/// Remembers the paper the student is in the middle of.
///
/// The server is the authority on this — `GET /student/home-summary` returns
/// the active session and is the path Home takes whenever it is available.
/// This exists for the window in which the app has shipped and that endpoint
/// has not: without it the resume card, which is the whole point of the new
/// Home, would sit dark until the API deploys.
///
/// It is a hint, never a source of truth. Home always confirms the id against
/// the server before drawing anything, so a stale or foreign id costs one
/// request and produces the empty state rather than a wrong card.
class ResumeMemory {
  ResumeMemory._();

  static const _key = 'active_session_id';

  static Future<void> remember(int sessionId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_key, sessionId);
  }

  static Future<void> forget() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key);
  }

  static Future<int?> read() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_key);
  }
}
