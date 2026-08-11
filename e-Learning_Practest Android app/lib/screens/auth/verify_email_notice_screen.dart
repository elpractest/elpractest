import '../../scaffold.dart';
import 'dart:async';

import 'package:flutter/material.dart';

import '../../api_client.dart';
import '../../widgets.dart';
import 'auth_routes.dart';

class VerifyEmailNoticeScreen extends StatefulWidget {
  const VerifyEmailNoticeScreen({super.key, this.email});

  final String? email;

  @override
  State<VerifyEmailNoticeScreen> createState() => _VerifyEmailNoticeScreenState();
}

class _VerifyEmailNoticeScreenState extends State<VerifyEmailNoticeScreen> {
  int _cooldown = 0;
  bool _sending = false;
  String _notice = '';

  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _startCooldown();
  }

  void _startCooldown() {
    _cooldown = 60;
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_cooldown <= 1) {
        t.cancel();
        setState(() => _cooldown = 0);
      } else {
        setState(() => _cooldown = _cooldown - 1);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _resend() async {
    final email = widget.email ?? '';
    if (email.isEmpty) {
      setState(() => _notice = 'Enter your email address to resend the verification link.');
      return;
    }
    setState(() {
      _sending = true;
      _notice = '';
    });
    try {
      await ApiClient.instance.post('/email/resend', body: {'email': email});
      if (!mounted) return;
      setState(() => _notice = 'Verification email resent. Please check your inbox.');
      _startCooldown();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _notice = e.statusCode == 429
          ? 'Too many requests. Please wait before trying again.'
          : 'Could not resend the email. Please try again.');
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return AppScaffold(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: GlassPanel(
              padding: const EdgeInsets.all(40),
              child: Column(
                children: [
                  const MedallionIcon(icon: Icons.mark_email_read_outlined, size: 34),
                  const SizedBox(height: 16),
                  Text('Check Your Inbox',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.accent)),
                  const SizedBox(height: 12),
                  Text(
                    widget.email != null && widget.email!.isNotEmpty
                        ? "We've sent a verification link to ${widget.email}. Please click the link in the email to verify your account, then come back to log in."
                        : "We've sent a verification link to your email. Please click the link in the email to verify your account, then come back to log in.",
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: c.textSecondary, height: 1.6),
                  ),
                  const SizedBox(height: 20),
                  if (_notice.isNotEmpty) ...[
                    SuccessBanner(_notice),
                    const SizedBox(height: 12),
                  ],
                  const SizedBox(height: 8),
                  SecondaryButton(
                    label: _sending
                        ? 'Sending...'
                        : _cooldown > 0
                            ? 'Resend (${_cooldown}s)'
                            : 'Resend Verification Email',
                    fullWidth: true,
                    loading: _sending,
                    onPressed: (_sending || _cooldown > 0) ? null : _resend,
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => returnToLogin(context),
                    child: Text('Back to Login', style: TextStyle(color: c.accent, fontWeight: FontWeight.w600)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
