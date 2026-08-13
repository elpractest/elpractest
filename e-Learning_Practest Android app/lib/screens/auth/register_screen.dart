import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api_client.dart';
import '../../models.dart';
import '../../practest_guide_widgets.dart';
import '../../widgets.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  final _passwordConfirm = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;
  bool _agreed = false;
  bool _success = false;
  bool _socialEnabled = false;
  final Map<String, String> _fieldErrors = {};
  String _globalError = '';

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final data = await ApiClient.instance.get('/settings/public');
      final settings = PublicSettings.fromJson(data['settings'] as Map<String, dynamic>?);
      if (mounted) setState(() => _socialEnabled = settings.socialLoginEnabled);
    } catch (_) {}
  }

  Future<void> _socialLogin(String provider) async {
    final uri = Uri.parse('$apiBaseUrl/auth/$provider/redirect');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
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
    setState(() {
      _globalError = '';
      _fieldErrors.clear();
    });
    if (!_formKey.currentState!.validate()) return;
    if (_password.text != _passwordConfirm.text) {
      setState(() => _fieldErrors['password_confirmation'] = 'Passwords do not match.');
      return;
    }
    setState(() => _submitting = true);

    final payload = <String, dynamic>{
      'name': _name.text.trim(),
      'email': _email.text.trim(),
      'password': _password.text,
      'password_confirmation': _passwordConfirm.text,
    };
    if (_phone.text.trim().isNotEmpty) payload['phone'] = _phone.text.trim();

    try {
      await ApiClient.instance.post('/register', body: payload);
      setState(() {
        _success = true;
        _submitting = false;
      });
    } on ApiException catch (e) {
      setState(() {
        _submitting = false;
        if (e.statusCode == 422 && e.message.isNotEmpty) {
          _globalError = e.message;
        } else if (e.statusCode == 429) {
          _globalError = 'Too many attempts. Please wait a moment and try again.';
        } else {
          _globalError = e.message.isEmpty ? 'Registration failed. Please try again.' : e.message;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);

    if (_success) {
      return PreAuthScaffold(
        maxWidth: 460,
        child: SurfacePanel(
                padding: const EdgeInsets.all(40),
                child: Column(
                  children: [
                    const MedallionIcon(icon: Icons.mark_email_read_outlined, size: 34),
                    const SizedBox(height: 16),
                    Text('Check Your Inbox',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.brandBright)),
                    const SizedBox(height: 12),
                    Text(
                      "We've sent a verification link to ${_email.text.trim()}. Please click the link in the email to verify your account, then come back to log in.",
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 14, color: c.textSecondary, height: 1.6),
                    ),
                    const SizedBox(height: 24),
                    SecondaryButton(
                      label: 'Back to Login',
                      fullWidth: true,
                      onPressed: () => Navigator.of(context).pop(),
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
                      Text('Create Account',
                          style: TextStyle(fontSize: 26, fontWeight: FontWeight.w800, color: c.brandBright)),
                      const SizedBox(height: 6),
                      Text('Join e-Learning Practest and start your exam preparation',
                          textAlign: TextAlign.center,
                          style: TextStyle(fontSize: 13.5, color: c.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 20),
                  if (_globalError.isNotEmpty) ...[
                    ErrorBanner(_globalError),
                    const SizedBox(height: 16),
                  ],
                  if (_socialEnabled) ...[
                    Row(
                      children: [
                        Expanded(
                          child: SecondaryButton(
                            label: 'Google',
                            icon: Icons.g_mobiledata,
                            fullWidth: true,
                            onPressed: _submitting ? null : () => _socialLogin('google'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SecondaryButton(
                            label: 'Facebook',
                            icon: Icons.facebook,
                            fullWidth: true,
                            onPressed: _submitting ? null : () => _socialLogin('facebook'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        const Expanded(child: Divider()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text('or register with email',
                              style: TextStyle(fontSize: 12.5, color: c.textSecondary)),
                        ),
                        const Expanded(child: Divider()),
                      ],
                    ),
                    const SizedBox(height: 20),
                  ],
                  Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        AppTextField(
                          label: 'Full Name *',
                          controller: _name,
                          hint: 'e.g. Rahul Sharma',
                          prefixIcon: Icons.person_outline,
                          enabled: !_submitting,
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Full name is required' : null,
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: 'Email Address *',
                          controller: _email,
                          hint: 'e.g. student@example.com',
                          keyboardType: TextInputType.emailAddress,
                          textCapitalization: TextCapitalization.none,
                          prefixIcon: Icons.mail_outline,
                          enabled: !_submitting,
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) return 'Email is required';
                            if (!v.contains('@') || !v.contains('.')) return 'Enter a valid email address';
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: 'Phone Number (optional)',
                          controller: _phone,
                          hint: 'e.g. 9876543210',
                          keyboardType: TextInputType.phone,
                          prefixIcon: Icons.phone_outlined,
                          enabled: !_submitting,
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: 'Password *',
                          controller: _password,
                          obscure: true,
                          hint: 'Min 8 chars, mixed case + number',
                          prefixIcon: Icons.lock_outline,
                          enabled: !_submitting,
                          validator: _passwordValidator,
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: 'Confirm Password *',
                          controller: _passwordConfirm,
                          obscure: true,
                          hint: 'Re-enter your password',
                          prefixIcon: Icons.lock_outline,
                          enabled: !_submitting,
                          validator: (v) => (v == null || v.isEmpty) ? 'Confirm your password' : null,
                        ),
                        const SizedBox(height: 16),
                        InkWell(
                          onTap: () => setState(() => _agreed = !_agreed),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                _agreed ? Icons.check_box : Icons.check_box_outline_blank,
                                size: 20,
                                color: _agreed ? c.brandBright : c.textSecondary,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'I agree to the Terms of Service and Privacy Policy',
                                  style: TextStyle(fontSize: 13, color: c.textSecondary),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                        GoldButton(
                          label: _submitting ? 'Creating Account…' : 'Create Account',
                          showIcon: false,
                          loading: _submitting,
                          onPressed: (_submitting || !_agreed) ? null : _submit,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text('Already have an account?', style: TextStyle(fontSize: 13, color: c.textSecondary)),
                      TextButton(
                        onPressed: _submitting ? null : () => Navigator.of(context).pop(),
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
