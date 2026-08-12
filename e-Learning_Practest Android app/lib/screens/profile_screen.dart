import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_client.dart';
import '../build_config.dart';
import '../boards.dart';
import '../models.dart';
import '../scaffold.dart';
import '../session.dart';
import '../theme.dart';
import '../widgets.dart';
import 'activation_modal.dart';

/// Profile.
///
/// Built from one 52 px row geometry — icon, label, trailing slot — which
/// carries an entitlement countdown, an activation prompt and an inline setting
/// without any of them needing a screen of their own.
///
/// The convention that makes a column of these readable without reading:
/// **an outlined trailing badge is a state you own, a filled one is a state you
/// don't.** "96 days" is outlined. "REDEEM" is filled.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Entitlement? _entitlement;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    try {
      final data = await ApiClient.instance.get('/student/home-summary');
      final json = data['entitlement'];
      if (!mounted) return;
      setState(() {
        _entitlement = json is Map ? Entitlement.fromJson(json as Map<String, dynamic>) : null;
        _loaded = true;
      });
    } catch (_) {
      // No entitlement endpoint on this API build. The row is omitted rather
      // than shown with a guessed or indefinite countdown.
      if (mounted) setState(() => _loaded = true);
    }
  }

  Future<void> _confirmLogout() async {
    final c = useColors(context);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Log out?', style: AppText.cardTitle.copyWith(color: c.textPrimary)),
        content: Text(
          'You will need your email and password to sign back in.',
          style: AppText.body.copyWith(color: c.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text('Stay', style: AppText.button.copyWith(color: c.textSecondary)),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text('Log out', style: AppText.button.copyWith(color: c.danger)),
          ),
        ],
      ),
    );
    if (ok == true && mounted) {
      await context.read<Session>().logout();
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final theme = context.watch<ThemeController>();
    final user = context.watch<Session>().user;

    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          const AppHeader(title: 'Profile'),
          Expanded(
            child: RefreshIndicator(
              color: c.brand,
              onRefresh: _fetch,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                children: [
                  _identity(c, user),
                  const SizedBox(height: 20),
                  const SectionHeading('Access'),
                  const SizedBox(height: 11),
                  _group(c, [
                    if (_entitlement != null)
                      SettingRow(
                        icon: Icons.event_available_outlined,
                        label: _entitlement!.batchName == null
                            ? 'Batch access'
                            : 'Batch access · ${_entitlement!.batchName}',
                        // Outlined: the student already owns this. Orange
                        // because access running out is a deadline.
                        trailing: TrailingBadge(
                          _entitlement!.daysRemaining == 0
                              ? 'EXPIRED'
                              : '${_entitlement!.daysRemaining} days',
                          color: _entitlement!.daysRemaining == 0 ? c.danger : c.orange,
                        ),
                      ),
                    SettingRow(
                      icon: Icons.vpn_key_outlined,
                      label: 'Activate a course',
                      // Filled: a state the student does not yet own.
                      trailing: TrailingBadge('REDEEM', color: c.orange, filled: true),
                      onTap: () => showActivationModal(context, onSuccess: _fetch),
                    ),
                  ]),
                  const SizedBox(height: 20),
                  const SectionHeading('Appearance'),
                  const SizedBox(height: 11),
                  _group(c, [
                    SettingRow(
                      icon: theme.isDark
                          ? Icons.dark_mode_outlined
                          : Icons.light_mode_outlined,
                      label: 'Dark theme',
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Switch(
                            value: theme.isDark,
                            activeThumbColor: c.brandBright,
                            activeTrackColor: c.brand.withValues(alpha: 0.4),
                            onChanged: theme.setDark,
                          ),
                          const SizedBox(width: 4),
                          Text(theme.isDark ? 'ON' : 'OFF',
                              style: AppText.caption.copyWith(color: c.textSecondary)),
                        ],
                      ),
                    ),
                  ]),
                  const SizedBox(height: 20),
                  const SectionHeading('About'),
                  const SizedBox(height: 11),
                  _group(c, [
                    SettingRow(
                      icon: Icons.info_outline,
                      label: 'Practest',
                      trailing: Text(appVersionLabel,
                          style: AppText.caption.copyWith(color: c.textSecondary)),
                    ),
                    SettingRow(
                      icon: Icons.logout,
                      label: 'Log out',
                      iconColor: c.danger,
                      onTap: _confirmLogout,
                    ),
                  ]),
                  const SizedBox(height: 14),
                  // Shown wherever board marks are, and here, per the brand
                  // rules that govern their use.
                  Text(
                    BoardCatalog.disclaimer,
                    style: AppText.caption.copyWith(color: c.textMuted, fontSize: 11),
                  ),
                  if (!_loaded) ...[
                    const SizedBox(height: 12),
                    const LoadingView(height: 60),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _identity(AppColors c, User? user) {
    final name = user?.name ?? 'Student';
    final initials = name
        .trim()
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0].toUpperCase())
        .join();

    return SurfacePanel(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Container(
            width: 52,
            height: 52,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: c.brandSoft,
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
              border: Border.all(color: c.brandBorder),
            ),
            child: Text(
              initials.isEmpty ? '—' : initials,
              style: AppText.cardTitle.copyWith(
                  color: c.brandBright, fontFamily: AppFont.display, fontSize: 19),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.cardTitle.copyWith(color: c.textPrimary)),
                if ((user?.email ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(user!.email!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.caption.copyWith(color: c.textSecondary)),
                ],
                if (user != null && !user.emailVerified) ...[
                  const SizedBox(height: 7),
                  TrailingBadge('EMAIL NOT VERIFIED', color: c.orange),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Rows share one panel and one hairline between them, so a group reads as a
  /// single object rather than as a stack of cards.
  Widget _group(AppColors c, List<Widget> rows) {
    final visible = rows.whereType<Widget>().toList();
    return SurfacePanel(
      padding: EdgeInsets.zero,
      child: Column(
        children: [
          for (var i = 0; i < visible.length; i++) ...[
            if (i > 0) Divider(height: 1, thickness: 1, color: c.border, indent: 53),
            visible[i],
          ],
        ],
      ),
    );
  }
}
