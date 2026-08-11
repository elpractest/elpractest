import 'package:flutter/material.dart';

import '../scaffold.dart';
import '../theme.dart';
import '../widgets.dart';
import 'auth/login_screen.dart';
import 'auth/register_screen.dart';

/// The logged-out landing screen.
///
/// Every claim here maps to something the app actually does — the CBT engine,
/// the study path, the analytics the backend recomputes from raw attempts, the
/// batch leaderboard, the lesson player, and activation codes. Keep it that way:
/// the first screen a student sees should not promise a feature they cannot then
/// find.
///
/// Layout is driven off the short side of the window, not the width, so a phone
/// held in landscape still gets the phone layout and a tablet in portrait still
/// gets the tablet one.
class IntroScreen extends StatefulWidget {
  const IntroScreen({super.key});

  @override
  State<IntroScreen> createState() => _IntroScreenState();
}

class _IntroScreenState extends State<IntroScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isAnimating || _c.isCompleted) return;
    if (MediaQuery.maybeOf(context)?.disableAnimations ?? false) {
      _c.value = 1.0;
    } else {
      _c.forward();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _goToLogin() => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const LoginScreen()),
      );

  void _goToRegister() => Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => const RegisterScreen()),
      );

  @override
  Widget build(BuildContext context) {
    final short = MediaQuery.sizeOf(context).shortestSide;
    final isTablet = short >= 600;

    return AppScaffold(
      child: LayoutBuilder(
        builder: (context, constraints) {
          // Two columns only when there is genuinely room for two readable
          // ones; below this a side-by-side just makes both halves cramped.
          final twoColumn = isTablet && constraints.maxWidth >= 840;
          return SingleChildScrollView(
            padding: EdgeInsets.symmetric(
              horizontal: isTablet ? 40 : 20,
              vertical: isTablet ? 36 : 24,
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: twoColumn ? 1080 : (isTablet ? 620 : 480),
                ),
                child: twoColumn
                    ? _wideLayout(context)
                    : _narrowLayout(context, isTablet),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _narrowLayout(BuildContext context, bool isTablet) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _Reveal(_c, 0.00, child: _Hero(isTablet: isTablet)),
        SizedBox(height: isTablet ? 34 : 26),
        for (var i = 0; i < _features.length; i++) ...[
          _Reveal(
            _c,
            0.10 + i * 0.07,
            child: _FeatureCard(_features[i], compact: !isTablet),
          ),
          const SizedBox(height: 12),
        ],
        SizedBox(height: isTablet ? 20 : 14),
        _Reveal(_c, 0.55, child: _CallToAction(
          onSignUp: _goToRegister,
          onSignIn: _goToLogin,
        )),
        const SizedBox(height: 8),
      ],
    );
  }

  Widget _wideLayout(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 5,
          child: Padding(
            padding: const EdgeInsets.only(right: 40, top: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _Reveal(_c, 0.00,
                    child: const _Hero(isTablet: true, align: TextAlign.left)),
                const SizedBox(height: 30),
                _Reveal(_c, 0.50, child: _CallToAction(
                  onSignUp: _goToRegister,
                  onSignIn: _goToLogin,
                )),
              ],
            ),
          ),
        ),
        Expanded(
          flex: 6,
          child: Column(
            children: [
              for (var i = 0; i < _features.length; i++) ...[
                _Reveal(
                  _c,
                  0.10 + i * 0.07,
                  child: _FeatureCard(_features[i], compact: false),
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// Fade + rise, staggered by [start] (a fraction of the parent controller).
///
/// Stateful purely so the [CurvedAnimation] is built once and disposed. Built
/// in `build()` it would attach a fresh listener to the parent controller on
/// every rebuild — a theme toggle alone would pile them up.
class _Reveal extends StatefulWidget {
  const _Reveal(this.controller, this.start, {required this.child});

  final AnimationController controller;
  final double start;
  final Widget child;

  @override
  State<_Reveal> createState() => _RevealState();
}

class _RevealState extends State<_Reveal> {
  late final CurvedAnimation _anim;

  @override
  void initState() {
    super.initState();
    _anim = CurvedAnimation(
      parent: widget.controller,
      curve: Interval(
        widget.start.clamp(0.0, 1.0),
        (widget.start + 0.45).clamp(0.0, 1.0),
        curve: Curves.easeOutCubic,
      ),
    );
  }

  @override
  void dispose() {
    _anim.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (context, c) => Opacity(
        opacity: _anim.value,
        child: Transform.translate(
          offset: Offset(0, 18 * (1 - _anim.value)),
          child: c,
        ),
      ),
      child: widget.child,
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.isTablet, this.align = TextAlign.center});

  final bool isTablet;
  final TextAlign align;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final left = align == TextAlign.left;
    return Column(
      crossAxisAlignment:
          left ? CrossAxisAlignment.start : CrossAxisAlignment.center,
      children: [
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/logo.png',
              width: isTablet ? 62 : 50,
              height: isTablet ? 62 : 50,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.medium,
            ),
            const SizedBox(width: 12),
            BrandWordmark(
              size: isTablet ? BrandWordmarkSize.large : BrandWordmarkSize.small,
              align: CrossAxisAlignment.start,
            ),
          ],
        ),
        SizedBox(height: isTablet ? 26 : 20),
        Text(
          'Your exam, rehearsed\nbefore exam day',
          textAlign: align,
          style: TextStyle(
            fontSize: isTablet ? 34 : 26,
            height: 1.22,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.6,
            color: c.textPrimary,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'Full mocks, sectionals and previous-year papers for SSC, Banking, '
          'RRB, UPSC and State PCS — on a test screen that behaves like the '
          'real one, with analytics that tell you what to fix next.',
          textAlign: align,
          style: TextStyle(
            fontSize: isTablet ? 15.5 : 14,
            height: 1.6,
            color: c.textSecondary,
          ),
        ),
      ],
    );
  }
}

class _Feature {
  const _Feature(this.icon, this.title, this.body, this.tint);

  final IconData icon;
  final String title;
  final String body;

  /// Which token to tint the medallion with, resolved per theme.
  final _Tint tint;
}

enum _Tint { accent, success, warning, violet }

Color _resolve(_Tint t, AppColors c) => switch (t) {
      _Tint.accent => c.accent,
      _Tint.success => c.success,
      _Tint.warning => c.warning,
      _Tint.violet => c.violet,
    };

const _features = <_Feature>[
  _Feature(
    Icons.timer_outlined,
    'A real CBT, not a quiz',
    'Question palette, per-section timer, mark-for-review and auto-submit — '
        'the same mechanics as the exam hall, so nothing is new on the day.',
    _Tint.accent,
  ),
  _Feature(
    Icons.route_outlined,
    'A study path, in order',
    'Your institute assigns a test series and you work through it one test at '
        'a time — full mocks, sectionals, previous-year and topic tests.',
    _Tint.violet,
  ),
  _Feature(
    Icons.insights_outlined,
    'Analytics you can act on',
    'Score, accuracy, attempt pattern and time spent per question after every '
        'attempt, recomputed from your raw answers rather than estimated.',
    _Tint.success,
  ),
  _Feature(
    Icons.emoji_events_outlined,
    'Rank within your batch',
    'A leaderboard scoped to your own batch, so you are measured against the '
        'people preparing beside you.',
    _Tint.warning,
  ),
  _Feature(
    Icons.play_circle_outline,
    'Lessons alongside the tests',
    'Chapter-wise video lessons and course outlines sit next to the practice, '
        'so revision and testing stay in one place.',
    _Tint.accent,
  ),
  _Feature(
    Icons.key_outlined,
    'Unlock with your batch code',
    'Enrolled at a coaching institute? Redeem the activation code they issue '
        'and your course opens instantly — no payment inside the app.',
    _Tint.violet,
  ),
];

class _FeatureCard extends StatelessWidget {
  const _FeatureCard(this.feature, {required this.compact});

  final _Feature feature;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final tint = _resolve(feature.tint, c);
    return GlassPanel(
      padding: EdgeInsets.all(compact ? 14 : 18),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          MedallionIcon(
            icon: feature.icon,
            color: tint,
            size: compact ? 20 : 22,
            padding: compact ? 10 : 12,
          ),
          SizedBox(width: compact ? 13 : 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  feature.title,
                  style: TextStyle(
                    fontSize: compact ? 14.5 : 15.5,
                    fontWeight: FontWeight.w700,
                    color: c.textPrimary,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  feature.body,
                  style: TextStyle(
                    fontSize: compact ? 12.8 : 13.5,
                    height: 1.5,
                    color: c.textSecondary,
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

class _CallToAction extends StatelessWidget {
  const _CallToAction({required this.onSignUp, required this.onSignIn});

  final VoidCallback onSignUp;
  final VoidCallback onSignIn;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GradientButton(
          label: 'Create free account',
          icon: Icons.arrow_forward,
          fullWidth: true,
          onPressed: onSignUp,
        ),
        const SizedBox(height: 12),
        SecondaryButton(
          label: 'I already have an account',
          icon: Icons.login,
          fullWidth: true,
          onPressed: onSignIn,
        ),
        const SizedBox(height: 14),
        Text(
          'Signing up is free. Course access is opened by your institute with '
          'an activation code.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, height: 1.5, color: c.textSecondary),
        ),
      ],
    );
  }
}
