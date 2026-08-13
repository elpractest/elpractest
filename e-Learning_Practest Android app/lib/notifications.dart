import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'api_client.dart';
import 'routes.dart';
import 'theme.dart';
import 'widgets.dart';

/// Derived notifications feed — a Dart port of the web SPA's
/// `app/src/lib/notifications.js`.
///
/// The app has no notifications backend, so this synthesises a real, useful feed
/// from data the student already has:
///   • submitted results   → "Result ready"    (`GET /student/results`)
///   • activation requests  → approved/rejected (`GET /student/activation-requests`)
///
/// Unread state is tracked locally: the newest item's timestamp is compared
/// against the last time the student opened the Notifications screen (persisted
/// in SharedPreferences). No new API calls beyond the two existing endpoints.
class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.body,
    required this.time,
    required this.hue,
    required this.icon,
    this.resultSessionId,
  });

  final String id;
  final String title;
  final String body;

  /// Epoch milliseconds, or 0 when the source carried no usable timestamp.
  final int time;
  final TintHue hue;
  final IconData icon;

  /// When set, tapping the row opens this result. Activation updates carry none
  /// — they route back to Home, which is where activation is acted on.
  final int? resultSessionId;
}

const String _seenKey = 'practest-notif-seen';

int _ts(dynamic v) {
  if (v == null) return 0;
  final dt = DateTime.tryParse('$v');
  return dt?.millisecondsSinceEpoch ?? 0;
}

String _str(dynamic v) => v == null ? '' : '$v';

List<NotificationItem> _deriveResults(List<dynamic> results) {
  return results.take(15).map((raw) {
    final r = raw is Map ? raw : const {};
    final session = r['session_id'];
    final sessionId = session is int ? session : int.tryParse('$session');
    final score = _str(r['score']);
    final total = _str(r['total_marks']);
    final acc = r['accuracy_percentage'];
    final accSuffix = acc != null ? ' · $acc% accuracy' : '';
    return NotificationItem(
      id: 'result-$session',
      title: 'Result ready',
      body: '${_str(r['test_title'])} — $score/$total$accSuffix',
      time: _ts(r['submitted_at']),
      hue: TintHue.green,
      icon: Icons.check_circle_outline_rounded,
      resultSessionId: sessionId,
    );
  }).toList();
}

List<NotificationItem> _deriveActivations(List<dynamic> requests) {
  final out = <NotificationItem>[];
  for (final raw in requests) {
    final req = raw is Map ? raw : const {};
    final status = _str(req['status']);
    if (status != 'approved' && status != 'rejected') continue;

    final approved = status == 'approved';
    final batch = req['batch'] is Map ? req['batch'] as Map : const {};
    final course = batch['course'] is Map
        ? _str((batch['course'] as Map)['title'])
        : '';
    final courseName = course.isEmpty ? 'your course' : course;
    final batchName = _str(batch['name']);
    final batchSuffix = batchName.isEmpty ? '' : ' — $batchName';
    final notes = _str(req['admin_notes']);

    out.add(
      NotificationItem(
        id: 'activation-${req['id']}',
        title: approved ? 'Activation approved' : 'Activation update',
        body: approved
            ? '$courseName$batchSuffix was approved. You can start now.'
            : '$courseName$batchSuffix: ${notes.isEmpty ? 'request was not approved.' : notes}',
        time: _ts(req['updated_at'] ?? req['reviewed_at'] ?? req['created_at']),
        hue: approved ? TintHue.gold : TintHue.red,
        icon: Icons.vpn_key_outlined,
      ),
    );
  }
  return out;
}

/// Fetches both source endpoints, tolerating either failing, and returns the
/// merged feed newest-first. Never throws — a dead endpoint contributes nothing.
Future<List<NotificationItem>> fetchNotifications() async {
  final results = await _safeList('/student/results', 'results');
  final requests = await _safeList('/student/activation-requests', 'requests');
  final items = [..._deriveResults(results), ..._deriveActivations(requests)]
    ..sort((a, b) => b.time.compareTo(a.time));
  return items;
}

Future<List<dynamic>> _safeList(String path, String key) async {
  try {
    final data = await ApiClient.instance.get(path);
    return extractList(data, key);
  } catch (_) {
    return const [];
  }
}

Future<int> _readSeen() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getInt(_seenKey) ?? 0;
}

Future<void> markAllSeen() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setInt(_seenKey, DateTime.now().millisecondsSinceEpoch);
}

/// How many items are newer than the last time the screen was opened.
Future<int> unreadCount() async {
  final seen = await _readSeen();
  final items = await fetchNotifications();
  return items.where((n) => n.time > seen).length;
}

/// Relative age — `45s`, `12m`, `3h`, `6d`. Matches the web `relative()`.
String relativeTime(int epochMs) {
  if (epochMs <= 0) return '';
  final s = math.max(
    1,
    (DateTime.now().millisecondsSinceEpoch - epochMs) ~/ 1000,
  );
  if (s < 60) return '${s}s';
  if (s < 3600) return '${s ~/ 60}m';
  if (s < 86400) return '${s ~/ 3600}h';
  return '${s ~/ 86400}d';
}

/// The header bell, with an unread dot.
///
/// Fetches its own count once on mount and again after the Notifications screen
/// is dismissed — which, because opening that screen marks everything seen,
/// clears the dot without any shared state between the two.
class NotificationBell extends StatefulWidget {
  const NotificationBell({super.key});

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell> {
  int _unread = 0;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final n = await unreadCount();
    if (mounted) setState(() => _unread = n);
  }

  Future<void> _open() async {
    await context.openNotifications();
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Tooltip(
      message: 'Notifications',
      child: InkWell(
        onTap: _open,
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Stack(
            alignment: Alignment.center,
            children: [
              Icon(
                Icons.notifications_none_rounded,
                size: 22,
                color: c.textSecondary,
              ),
              if (_unread > 0)
                Positioned(
                  top: 9,
                  right: 9,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: c.danger,
                      shape: BoxShape.circle,
                      border: Border.all(color: c.bg, width: 1.5),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
