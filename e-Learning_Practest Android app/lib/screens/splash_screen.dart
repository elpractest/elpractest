import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../scaffold.dart';
import '../widgets.dart';

/// Branded launch animation.
///
/// One controller drives everything through [Interval]s, so the whole sequence
/// stays in lockstep and there is a single place to retime it. It runs over the
/// aurora backdrop the rest of the app uses, so the transition into the intro
/// or dashboard is a cross-fade of content, not a change of scenery.
///
/// Honours the platform "remove animations" accessibility setting by collapsing
/// to a short hold — the brand still appears, it just does not move.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.onDone});

  /// Fired once, after the sequence finishes.
  final VoidCallback onDone;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  static const _full = Duration(milliseconds: 2600);
  static const _reduced = Duration(milliseconds: 900);

  late final AnimationController _c;

  /// Separate, slower controller: the halo keeps breathing for the whole splash
  /// rather than resolving with the entrance.
  late final AnimationController _halo;

  late final Animation<double> _markFade;
  late final Animation<double> _markScale;
  late final Animation<double> _ring;
  late final Animation<double> _wordFade;
  late final Animation<double> _wordRise;
  late final Animation<double> _taglineFade;

  bool _fired = false;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: _full)
      ..addStatusListener((s) {
        if (s == AnimationStatus.completed && !_fired) {
          _fired = true;
          widget.onDone();
        }
      });
    _halo = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    );

    Animation<double> curve(double begin, double end, Curve c) =>
        CurvedAnimation(parent: _c, curve: Interval(begin, end, curve: c));

    _markFade = curve(0.00, 0.28, Curves.easeOut);
    // easeOutBack gives the mark a small overshoot as it lands — the difference
    // between "appeared" and "arrived".
    _markScale = Tween(begin: 0.78, end: 1.0)
        .animate(curve(0.00, 0.42, Curves.easeOutBack));
    _ring = curve(0.10, 0.72, Curves.easeInOutCubic);
    _wordFade = curve(0.34, 0.60, Curves.easeOut);
    _wordRise = Tween(begin: 14.0, end: 0.0)
        .animate(curve(0.34, 0.62, Curves.easeOutCubic));
    _taglineFade = curve(0.52, 0.78, Curves.easeOut);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isAnimating || _c.isCompleted) return;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    _c.duration = reduce ? _reduced : _full;
    _c.forward();
    if (!reduce) _halo.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    _halo.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    // Tablets get a bigger mark; the layout is otherwise size-independent.
    final short = MediaQuery.sizeOf(context).shortestSide;
    final markSize = short >= 600 ? 190.0 : 132.0;

    return AppScaffold(
      showThemeToggle: false,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: Listenable.merge([_c, _halo]),
              builder: (context, _) {
                return SizedBox(
                  width: markSize * 1.9,
                  height: markSize * 1.9,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      _Halo(
                        color: c.accent,
                        size: markSize * 1.9,
                        // Breathe between 0.86 and 1.0 opacity-equivalent.
                        t: 0.86 + 0.14 * _halo.value,
                        entrance: _markFade.value,
                      ),
                      CustomPaint(
                        size: Size.square(markSize * 1.52),
                        painter: _RingPainter(
                          progress: _ring.value,
                          color: c.accent,
                          trackColor: c.border,
                        ),
                      ),
                      Opacity(
                        opacity: _markFade.value,
                        child: Transform.scale(
                          scale: _markScale.value,
                          child: Image.asset(
                            'assets/logo.png',
                            width: markSize,
                            height: markSize,
                            fit: BoxFit.contain,
                            filterQuality: FilterQuality.medium,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
            const SizedBox(height: 28),
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) => Opacity(
                opacity: _wordFade.value,
                child: Transform.translate(
                  offset: Offset(0, _wordRise.value),
                  child: const BrandWordmark(size: BrandWordmarkSize.large),
                ),
              ),
            ),
            const SizedBox(height: 14),
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) => Opacity(
                opacity: _taglineFade.value,
                child: Text(
                  'Practice like it is exam day',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 13.5,
                    color: c.textSecondary,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Soft radial bloom behind the mark.
class _Halo extends StatelessWidget {
  const _Halo({
    required this.color,
    required this.size,
    required this.t,
    required this.entrance,
  });

  final Color color;
  final double size;

  /// Breathing factor, 0.86..1.0.
  final double t;

  /// Entrance opacity, so the halo does not pop in before the mark.
  final double entrance;

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: entrance,
      child: Container(
        width: size * t,
        height: size * t,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: 0.26 * t),
              color.withValues(alpha: 0.07 * t),
              Colors.transparent,
            ],
            stops: const [0.0, 0.45, 1.0],
          ),
        ),
      ),
    );
  }
}

/// A ring that draws itself once, clockwise from 12 o'clock, over a faint track.
class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.color,
    required this.trackColor,
  });

  final double progress;
  final Color color;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final center = rect.center;
    final radius = size.width / 2;

    final track = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.6
      ..color = trackColor;
    canvas.drawCircle(center, radius, track);

    if (progress <= 0) return;

    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.6
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        startAngle: -math.pi / 2,
        endAngle: 3 * math.pi / 2,
        colors: [
          color.withValues(alpha: 0.0),
          color.withValues(alpha: 0.9),
          color,
        ],
        stops: const [0.0, 0.55, 1.0],
        transform: const GradientRotation(-math.pi / 2),
      ).createShader(Rect.fromCircle(center: center, radius: radius));

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) =>
      old.progress != progress ||
      old.color != color ||
      old.trackColor != trackColor;
}
