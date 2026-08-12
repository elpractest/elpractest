import '../../scaffold.dart';
import 'package:flutter/material.dart';

import '../../api_client.dart';
import '../../widgets.dart';
import 'auth_routes.dart';
import 'verify_email_notice_screen.dart';

enum _VerifyStatus { verifying, success, error }

/// Landing screen for the email verification link.
/// The email links to the web SPA; this screen can be opened natively when an
/// Android App Link is configured (params: id, hash).
class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({super.key, this.id, this.hash});

  final String? id;
  final String? hash;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  _VerifyStatus _status = _VerifyStatus.verifying;
  String _message = '';

  @override
  void initState() {
    super.initState();
    _verify();
  }

  Future<void> _verify() async {
    final id = widget.id;
    final hash = widget.hash;
    if (id == null || hash == null || id.isEmpty || hash.isEmpty) {
      setState(() {
        _status = _VerifyStatus.error;
        _message = 'Invalid verification link. Please check your email and try again.';
      });
      return;
    }
    try {
      final data = await ApiClient.instance.get('/email/verify/$id/$hash');
      if (!mounted) return;
      setState(() {
        _status = _VerifyStatus.success;
        final msg = data['message']?.toString() ?? '';
        _message = msg.contains('already')
            ? 'Your email has been verified successfully. You can now log in.'
            : msg;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _status = _VerifyStatus.error;
        _message = e.message.isEmpty
            ? 'Verification failed. The link may be invalid or expired.'
            : e.message;
      });
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
            child: SurfacePanel(
              padding: const EdgeInsets.all(40),
              child: Column(
                children: [
                  if (_status == _VerifyStatus.verifying)
                    const SizedBox(width: 34, height: 34, child: CircularProgressIndicator(strokeWidth: 3))
                  else
                    MedallionIcon(
                      icon: _status == _VerifyStatus.error
                          ? Icons.close
                          : Icons.check_circle,
                      color: _status == _VerifyStatus.error ? c.danger : c.success,
                      size: 34,
                    ),
                  const SizedBox(height: 16),
                  Text(
                    _status == _VerifyStatus.verifying
                        ? 'Verifying...'
                        : _status == _VerifyStatus.error
                            ? 'Verification Failed'
                            : 'Email Verified!',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: _status == _VerifyStatus.error ? c.dangerText : c.brandBright,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (_status != _VerifyStatus.verifying) ...[
                    Text(
                      _message,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: c.textSecondary, height: 1.6),
                    ),
                    const SizedBox(height: 24),
                    if (_status == _VerifyStatus.success)
                      PrimaryButton(
                        label: 'Continue to Login',
                        fullWidth: true,
                        onPressed: () => returnToLogin(context),
                      )
                    else ...[
                      SecondaryButton(
                        label: 'Resend Verification Email',
                        fullWidth: true,
                        onPressed: () => Navigator.of(context).pushReplacement(
                          MaterialPageRoute(builder: (_) => const VerifyEmailNoticeScreen()),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextButton(
                        onPressed: () => returnToLogin(context),
                        child: Text('← Back to Login', style: TextStyle(color: c.brandBright)),
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
