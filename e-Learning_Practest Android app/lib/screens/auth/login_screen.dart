import '../../scaffold.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api_client.dart';
import '../../models.dart';
import '../../session.dart';
import '../../theme.dart';
import '../../widgets.dart';
import 'forgot_password_screen.dart';
import 'register_screen.dart';
import 'verify_email_notice_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _submitting = false;
  bool _emailUnverified = false;
  bool _adminWebOnly = false;
  String _error = '';
  bool _socialEnabled = false;

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
    } catch (_) {
      // ignore — social buttons simply stay hidden
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = '';
      _emailUnverified = false;
      _adminWebOnly = false;
    });
    try {
      await context.read<Session>().mobileLogin(_email.text.trim(), _password.text);
      // RootGate swaps to Dashboard on notifyListeners — but this screen was
      // PUSHED on top of the intro, so without unwinding the stack the new
      // dashboard would render underneath a still-visible login form.
      if (mounted) {
        Navigator.of(context).popUntil((route) => route.isFirst);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        if (e.statusCode == 403 && e.message.contains('verify your email')) {
          _emailUnverified = true;
        } else if (e.statusCode == 403 && e.message.contains('web dashboard')) {
          _adminWebOnly = true;
        } else if (e.statusCode == 429) {
          _error = 'Too many login attempts. Please wait a moment and try again.';
        } else {
          _error = e.message.isEmpty ? 'Invalid credentials. Please try again.' : e.message;
        }
      });
    }
  }

  Future<void> _socialLogin(String provider) async {
    final uri = Uri.parse('$apiBaseUrl/auth/$provider/redirect');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return AppScaffold(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: GlassPanel(
              padding: const EdgeInsets.all(32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const BackChip(),
                  Column(
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 40,
                            height: 40,
                            decoration: BoxDecoration(
                              gradient: AppTheme.primaryGradient(c),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.school, color: Colors.white, size: 22),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('E-LEARNING',
                                  style: TextStyle(color: c.warning, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1.8)),
                              ShaderMask(
                                shaderCallback: (r) => AppTheme.textGradient(c).createShader(r),
                                child: const Text('Practest',
                                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
                              ),
                            ],
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Text('Welcome to e-Learning Practest',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: c.accent)),
                      const SizedBox(height: 6),
                      Text(
                        'Sign in to continue your exam preparation',
                        style: TextStyle(fontSize: 13, color: c.textSecondary),
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  if (_emailUnverified) ...[
                    const ErrorBanner(
                        'Please verify your email address before logging in. Check your inbox for the verification link.'),
                    const SizedBox(height: 12),
                    SecondaryButton(
                      label: 'Resend verification email',
                      icon: Icons.mark_email_read_outlined,
                      fullWidth: true,
                      onPressed: () {
                        Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => VerifyEmailNoticeScreen(email: _email.text.trim()),
                        ));
                      },
                    ),
                    const SizedBox(height: 12),
                  ],
                  if (_adminWebOnly) ...[
                    const ErrorBanner('Admin accounts must sign in on the web dashboard.'),
                    const SizedBox(height: 12),
                  ],
                  if (_error.isNotEmpty) ...[
                    ErrorBanner(_error),
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
                          child: Text('or sign in with email',
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
                          label: 'Email Address *',
                          controller: _email,
                          hint: 'e.g. student@example.com',
                          keyboardType: TextInputType.emailAddress,
                          textCapitalization: TextCapitalization.none,
                          textInputAction: TextInputAction.next,
                          prefixIcon: Icons.mail_outline,
                          enabled: !_submitting,
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Email is required' : null,
                        ),
                        const SizedBox(height: 16),
                        AppTextField(
                          label: 'Password *',
                          controller: _password,
                          obscure: true,
                          hint: 'Enter your password',
                          textInputAction: TextInputAction.done,
                          prefixIcon: Icons.lock_outline,
                          enabled: !_submitting,
                          validator: (v) => (v == null || v.isEmpty) ? 'Password is required' : null,
                          onSubmitted: (_) => _submit(),
                        ),
                        const SizedBox(height: 6),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton(
                            onPressed: _submitting
                                ? null
                                : () => Navigator.of(context).push(MaterialPageRoute(
                                      builder: (_) => const ForgotPasswordScreen(),
                                    )),
                            child: Text('Forgot password?', style: TextStyle(fontSize: 13, color: c.accent)),
                          ),
                        ),
                        const SizedBox(height: 12),
                        GradientButton(
                          label: _submitting ? 'Authenticating...' : 'Sign In',
                          fullWidth: true,
                          loading: _submitting,
                          onPressed: _submitting ? null : _submit,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text("Don't have an account?",
                          style: TextStyle(fontSize: 13, color: c.textSecondary)),
                      TextButton(
                        onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => const RegisterScreen(),
                        )),
                        child: Text('Create Account', style: TextStyle(fontWeight: FontWeight.w700, color: c.accent)),
                      ),
                    ],
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
