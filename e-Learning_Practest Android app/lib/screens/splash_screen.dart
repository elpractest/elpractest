import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../scaffold.dart';
import '../theme.dart';
import '../widgets.dart';

/// Branded launch.
///
/// One controller drives everything through [Interval]s, so the sequence stays
/// in lockstep and there is one place to retime it.
///
/// **1200 ms total, down from 2600.** The splash is not waiting on anything —
/// `Session.init()` has already finished by the time `runApp` is called — so
/// every millisecond of it was a millisecond charged to the student for
/// nothing. What is left is long enough to read as the brand arriving and
/// short enough that nobody waits through it twice.
///
/// The breathing halo that used to sit behind the mark is gone with the aurora:
/// depth carries meaning in this system, never decoration.
///
/// Honours the platform "remove animations" setting by collapsing to a short
/// hold — the brand still appears, it just does not move.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.onDone});

  /// Fired once, after the sequence finishes.
  final VoidCallback onDone;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with SingleTickerProviderStateMixin {
  static const _full = Duration(milliseconds: 1200);
  static const _reduced = Duration(milliseconds: 500);

  late final AnimationController _c;

  late final Animation<double> _markFade;
  late final Animation<double> _markScale;
  late final Animation<double> _ring;
  late final Animation<double> _wordFade;
  late final Animation<double> _wordRise;

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

    Animation<double> curve(double begin, double end, Curve c) =>
        CurvedAnimation(parent: _c, curve: Interval(begin, end, curve: c));

    _markFade = curve(0.00, 0.34, Curves.easeOut);
    // A small overshoot as the mark lands — the difference between "appeared"
    // and "arrived".
    _markScale =
        Tween(begin: 0.84, end: 1.0).animate(curve(0.00, 0.50, Curves.easeOutBack));
    _ring = curve(0.06, 0.86, Curves.easeInOutCubic);
    _wordFade = curve(0.38, 0.72, Curves.easeOut);
    _wordRise =
        Tween(begin: 10.0, end: 0.0).animate(curve(0.38, 0.74, Curves.easeOutCubic));
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_c.isAnimating || _c.isCompleted) return;
    final reduce = MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    _c.duration = reduce ? _reduced : _full;
    _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    // Tablets get a bigger mark; the layout is otherwise size-independent.
    final short = MediaQuery.sizeOf(context).shortestSide;
    final markSize = short >= 600 ? 148.0 : 104.0;

    return AppScaffold(
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) => SizedBox(
                width: markSize * 1.7,
                height: markSize * 1.7,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    CustomPaint(
                      size: Size.square(markSize * 1.45),
                      painter: _RingPainter(
                        progress: _ring.value,
                        color: c.brandBright,
                        trackColor: c.border,
                      ),
                    ),
                    Opacity(
                      opacity: _markFade.value,
                      child: Transform.scale(
                        scale: _markScale.value,
                        child: BrandMark(size: markSize),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            AnimatedBuilder(
              animation: _c,
              builder: (context, _) => Opacity(
                opacity: _wordFade.value,
                child: Transform.translate(
                  offset: Offset(0, _wordRise.value),
                  child: Column(
                    children: [
                      const BrandWordmark(fontSize: 34),
                      const SizedBox(height: 10),
                      Text(
                        'Practice like it is exam day',
                        textAlign: TextAlign.center,
                        style: AppText.body.copyWith(color: c.textSecondary),
                      ),
                    ],
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
      ..strokeWidth = 1.4
      ..color = trackColor;
    canvas.drawCircle(center, radius, track);

    if (progress <= 0) return;

    final arc = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round
      ..color = color;

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
