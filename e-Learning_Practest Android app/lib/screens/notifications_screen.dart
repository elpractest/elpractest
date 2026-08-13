import 'package:flutter/material.dart';

import '../notifications.dart';
import '../routes.dart';
import '../scaffold.dart';
import '../theme.dart';
import '../widgets.dart';

/// NOTIFICATIONS — a real feed derived from the student's results and activation
/// requests (see `notifications.dart`). Opening the screen marks everything as
/// seen, which clears the header bell's unread dot.
///
/// Ported from the web SPA's `pages/Notifications.jsx`. It keeps that screen's
/// structure — tinted icon tile, title + relative time, body — but drops the
/// demo-feed fallback: this app's convention is real data or an honest empty
/// state, never invented rows.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<NotificationItem> _items = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _loading = true);
    final items = await fetchNotifications();
    // Opening the screen is the "seen" event, exactly as on the web.
    await markAllSeen();
    if (!mounted) return;
    setState(() {
      _items = items;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          const AppHeader(title: 'Notifications', showBack: true),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading notifications...')
                : RefreshIndicator(
                    onRefresh: _load,
                    child: _items.isEmpty
                        ? ListView(
                            padding: const EdgeInsets.all(16),
                            children: const [
                              SizedBox(height: 40),
                              EmptyState(
                                icon: Icons.notifications_none_rounded,
                                title: 'No notifications yet',
                                message:
                                    'Result alerts, new mocks and '
                                    'activation updates will appear here.',
                              ),
                            ],
                          )
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
                            itemCount: _items.length,
                            itemBuilder: (context, i) =>
                                _NotificationRow(item: _items[i]),
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}

class _NotificationRow extends StatelessWidget {
  const _NotificationRow({required this.item});

  final NotificationItem item;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final tc = tint(item.hue, c.isDark);
    final age = relativeTime(item.time);
    final sessionId = item.resultSessionId;

    return SurfacePanel(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(14),
      onTap: sessionId != null ? () => context.openResult(sessionId) : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tc.bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: tc.bd),
            ),
            child: Icon(item.icon, size: 19, color: tc.c),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: AppText.cardTitleSm.copyWith(
                          color: c.textPrimary,
                          fontSize: 13.5,
                        ),
                      ),
                    ),
                    if (age.isNotEmpty) ...[
                      const SizedBox(width: 8),
                      Text(
                        age,
                        style: AppText.caption.copyWith(
                          color: c.textMuted,
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  item.body,
                  style: AppText.caption.copyWith(
                    color: c.textSecondary,
                    fontSize: 12.5,
                    height: 1.45,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
