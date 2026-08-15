import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../api_client.dart';
import '../../i18n.dart';
import '../../models.dart';
import '../../practest_guide_widgets.dart';
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
  String? _googleClientId;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final data = await ApiClient.instance.get('/settings/public');
      final settings = PublicSettings.fromJson(data['settings'] as Map<String, dynamic>?);
      if (mounted) {
        setState(() {
          _socialEnabled = settings.socialLoginEnabled;
          _googleClientId = settings.googleClientId;
        });
      }
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
      // RootGate swaps to the shell on notifyListeners — but this screen was
      // PUSHED on top of the welcome, so without unwinding the stack the new
      // shell would render underneath a still-visible login form.
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
    if (provider == 'google') {
      await _googleLogin();
      return;
    }
    // Facebook is still the web redirect (native flow not implemented). It logs
    // into the web app rather than this bearer-token app; kept for parity.
    final uri = Uri.parse('$apiBaseUrl/auth/$provider/redirect');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  /// Native Google sign-in: get an ID token on-device, exchange it for a bearer
  /// token at /mobile/social/google. serverClientId must be the web OAuth client
  /// id (from /settings/public) so the token's audience matches the backend.
  Future<void> _googleLogin() async {
    final clientId = _googleClientId;
    if (clientId == null || clientId.isEmpty) {
      setState(() => _error = 'Google sign-in is not configured.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = '';
      _emailUnverified = false;
      _adminWebOnly = false;
    });

    // Capture context-bound objects before the async gaps below.
    final session = context.read<Session>();
    final navigator = Navigator.of(context);

    try {
      final gsi = GoogleSignIn(serverClientId: clientId, scopes: const ['email', 'profile']);
      await gsi.signOut(); // force the account chooser instead of silent reuse
      final account = await gsi.signIn();
      if (account == null) {
        if (mounted) setState(() => _submitting = false); // user cancelled
        return;
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null || idToken.isEmpty) {
        throw ApiException(null, 'Could not get a Google token. Please try again.');
      }

      await session.mobileGoogleLogin(idToken);
      if (mounted) {
        navigator.popUntil((route) => route.isFirst);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        if (e.statusCode == 403 && e.message.contains('web dashboard')) {
          _adminWebOnly = true;
        } else {
          _error = e.message.isEmpty ? 'Google sign-in failed. Please try again.' : e.message;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Google sign-in failed. Please try again.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final i18n = context.watch<I18n>();
    // A pre-auth surface — the whole auth family shares one dark ground, back
    // tile and EN/हिं pill via PreAuthScaffold. Only the card below is
    // theme-aware.
    return PreAuthScaffold(
      maxWidth: 420,
      child: SurfacePanel(
        borderRadius: AppTheme.radiusLg,
        padding: const EdgeInsets.all(28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Column(
              children: [
                // The real mark, at full colour on light and its dark-surface
                // lockup on dark.
                const BrandLockup(width: 200),
                const SizedBox(height: 20),
                Text(i18n.t('login.title'),
                    style: AppText.screenTitle.copyWith(fontSize: 20, color: c.textPrimary)),
                const SizedBox(height: 6),
                Text(
                  i18n.t('login.subtitle'),
                  textAlign: TextAlign.center,
                  style: AppText.body.copyWith(color: c.textSecondary),
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
                    label: '${i18n.t('login.email')} *',
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
                    label: '${i18n.t('login.password')} *',
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
                      child: Text('Forgot password?', style: TextStyle(fontSize: 13, color: c.brandBright)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  GoldButton(
                    label: _submitting ? 'Authenticating…' : i18n.t('login.submit'),
                    showIcon: false,
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
                  child: Text('Create Account', style: TextStyle(fontWeight: FontWeight.w700, color: c.brandBright)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
