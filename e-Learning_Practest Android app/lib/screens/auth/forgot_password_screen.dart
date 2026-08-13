import 'package:flutter/material.dart';

import '../../api_client.dart';
import '../../practest_guide_widgets.dart';
import '../../widgets.dart';
import 'auth_routes.dart';
import 'verify_email_notice_screen.dart';

class ForgotPasswordScreen extends StatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  State<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends State<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _submitting = false;
  bool _sent = false;
  String _error = '';

  Future<void> _submit() async {
    final email = _email.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Enter your registered email address.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = '';
    });
    try {
      await ApiClient.instance.post('/forgot-password', body: {'email': email});
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _sent = true;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = e.statusCode == 429
            ? 'Too many attempts. Please wait a moment and try again.'
            : 'Could not send the reset link. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);

    if (_sent) {
      return PreAuthScaffold(
        maxWidth: 460,
        child: SurfacePanel(
          padding: const EdgeInsets.all(40),
          child: Column(
            children: [
              const MedallionIcon(icon: Icons.mail_outline, size: 34),
              const SizedBox(height: 16),
              Text('Reset Link Sent',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.brandBright)),
              const SizedBox(height: 12),
              Text(
                'If an account exists for ${_email.text.trim()}, we have emailed a password reset link. Please check your inbox (and spam folder).',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 14, color: c.textSecondary, height: 1.6),
              ),
              const SizedBox(height: 24),
              GoldButton(
                label: 'Back to Login',
                showIcon: false,
                onPressed: () => returnToLogin(context),
              ),
            ],
          ),
        ),
      );
    }

    return PreAuthScaffold(
      maxWidth: 460,
      child: SurfacePanel(
        padding: const EdgeInsets.all(32),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Column(
              children: [
                Text('Forgot Password',
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.brandBright)),
                const SizedBox(height: 8),
                Text(
                  'Enter the email address linked to your account and we will send you a reset link.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, color: c.textSecondary, height: 1.5),
                ),
              ],
            ),
            const SizedBox(height: 24),
            if (_error.isNotEmpty) ...[
              ErrorBanner(_error),
              const SizedBox(height: 16),
            ],
            AppTextField(
              label: 'Email Address',
              controller: _email,
              hint: 'e.g. student@example.com',
              keyboardType: TextInputType.emailAddress,
              textCapitalization: TextCapitalization.none,
              prefixIcon: Icons.mail_outline,
              enabled: !_submitting,
              onSubmitted: (_) => _submit(),
            ),
            const SizedBox(height: 20),
            GoldButton(
              label: _submitting ? 'Sending…' : 'Send Reset Link',
              showIcon: false,
              loading: _submitting,
              onPressed: _submitting ? null : _submit,
            ),
            const SizedBox(height: 16),
            TextButton(
              onPressed: _submitting
                  ? null
                  : () => Navigator.of(context).pushReplacement(
                        MaterialPageRoute(builder: (_) => const VerifyEmailNoticeScreen()),
                      ),
              child: Text(
                "Don't have an account yet? Register",
                style: TextStyle(color: c.brandBright, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text('Remembered it?', style: TextStyle(fontSize: 13, color: c.textSecondary)),
                TextButton(
                  onPressed: _submitting ? null : () => returnToLogin(context),
                  child: Text('Sign In', style: TextStyle(fontWeight: FontWeight.w700, color: c.brandBright)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
