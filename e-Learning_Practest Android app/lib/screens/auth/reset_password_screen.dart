import '../../scaffold.dart';
import 'package:flutter/material.dart';

import '../../api_client.dart';
import '../../widgets.dart';
import 'auth_routes.dart';

class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key, this.token, this.email});

  final String? token;
  final String? email;

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _password = TextEditingController();
  final _passwordConfirm = TextEditingController();
  bool _submitting = false;
  bool _success = false;
  String _error = '';
  String _successMessage = '';

  @override
  void initState() {
    super.initState();
    if (widget.token == null || widget.token!.isEmpty || widget.email == null) {
      _error = 'This reset link is invalid or incomplete. Please request a new one.';
    }
  }

  String? _passwordValidator(String? v) {
    if (v == null || v.isEmpty) return 'Password is required';
    if (v.length < 8) return 'Password must be at least 8 characters';
    if (!v.contains(RegExp(r'[a-z]'))) return 'Password must contain a lowercase letter';
    if (!v.contains(RegExp(r'[A-Z]'))) return 'Password must contain an uppercase letter';
    if (!v.contains(RegExp(r'[0-9]'))) return 'Password must contain a number';
    return null;
  }

  Future<void> _submit() async {
    setState(() => _error = '');
    if (widget.token == null || widget.token!.isEmpty || widget.email == null) {
      setState(() => _error = 'This reset link is invalid or incomplete. Please request a new one.');
      return;
    }
    if (!(mounted ? _formKey.currentState!.validate() : false)) return;
    if (_password.text != _passwordConfirm.text) {
      setState(() => _error = 'Passwords do not match.');
      return;
    }
    setState(() => _submitting = true);
    try {
      final data = await ApiClient.instance.post('/reset-password', body: {
        'token': widget.token,
        'email': widget.email,
        'password': _password.text,
        'password_confirmation': _passwordConfirm.text,
      });
      if (!mounted) return;
      final message = data['status']?.toString() ?? '';
      setState(() {
        _submitting = false;
        _success = true;
        _successMessage = message.isNotEmpty
            ? message
            : 'Your password has been reset. You can now log in with your new password.';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        if (e.statusCode == 422 && e.message.isNotEmpty) {
          _error = e.message;
        } else if (e.statusCode == 429) {
          _error = 'Too many attempts. Please wait a moment and try again.';
        } else {
          _error = e.message.isEmpty ? 'Password reset failed. Please try again.' : e.message;
        }
      });
    }
  }

  final _formKey = GlobalKey<FormState>();

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);

    if (_success) {
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
                    const MedallionIcon(icon: Icons.lock_reset, size: 34),
                    const SizedBox(height: 16),
                    Text('Password Reset!',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.brandBright)),
                    const SizedBox(height: 12),
                    Text(
                      _successMessage,
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: c.textSecondary, height: 1.6),
                    ),
                    const SizedBox(height: 24),
                    PrimaryButton(
                      label: 'Continue to Login',
                      fullWidth: true,
                      onPressed: () => returnToLogin(context),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    }

    return AppScaffold(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: SurfacePanel(
              padding: const EdgeInsets.all(32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Column(
                    children: [
                      Text('Set a New Password',
                          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.brandBright)),
                      const SizedBox(height: 8),
                      Text(
                        'Enter a new password for ${widget.email ?? 'your account'}.',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 13.5, color: c.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  if (_error.isNotEmpty) ...[
                    ErrorBanner(_error),
                    const SizedBox(height: 16),
                  ],
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        AppTextField(
                          label: 'New Password *',
                          controller: _password,
                          obscure: true,
                          hint: 'Min 8 chars, mixed case + number',
                          prefixIcon: Icons.lock_outline,
                          enabled: !_submitting,
                          validator: _passwordValidator,
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: 'Confirm New Password *',
                          controller: _passwordConfirm,
                          obscure: true,
                          hint: 'Re-enter your new password',
                          prefixIcon: Icons.lock_outline,
                          enabled: !_submitting,
                          validator: (v) => (v == null || v.isEmpty) ? 'Confirm your password' : null,
                        ),
                        const SizedBox(height: 20),
                        PrimaryButton(
                          label: _submitting ? 'Resetting...' : 'Reset Password',
                          fullWidth: true,
                          loading: _submitting,
                          onPressed: _submitting ? null : _submit,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: _submitting
                        ? null
                        : () => returnToLogin(context),
                    child: Text('← Back to Login', style: TextStyle(color: c.brandBright)),
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
