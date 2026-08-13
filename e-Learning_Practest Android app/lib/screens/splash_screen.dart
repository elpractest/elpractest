import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets.dart';

/// Branded launch.
///
/// One controller drives everything through [Interval]s, so the sequence stays
/// in lockstep and there is one place to retime it.
///
/// **1200 ms total, and deliberately not the guide's 1900.** The splash is not
/// waiting on anything — `Session.init()` has already finished by the time
/// `runApp` is called — so every millisecond of it is a millisecond charged to
/// the student for nothing. 1900 ms is the right number for a mockup that has to
/// be *seen*; 1200 is the right number for a launch the student sits through
/// twice a day. What is left is long enough to read as the brand arriving.
///
/// **Dark in both themes, on purpose.** The native launch window is `#0B0F1A`
/// in day and night alike (see values/colors.xml — the platform cannot read the
/// student's stored theme that early), so a theme-aware splash would flash dark,
/// go light, then go dark again on a light-mode device. Matching the launch
/// window is the only sequence with no flash in it, and the guide draws this
/// screen dark regardless.
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
  late final Animation<double> _wordFade;
  late final Animation<double> _wordRise;
  late final Animation<double> _bar;

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
    _wordFade = curve(0.38, 0.72, Curves.easeOut);
    _wordRise =
        Tween(begin: 10.0, end: 0.0).animate(curve(0.38, 0.74, Curves.easeOutCubic));
    // Runs the whole length: the bar filling is the only honest progress signal
    // on screen, so it should finish exactly when the screen leaves.
    _bar = curve(0.04, 1.00, Curves.easeInOut);
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
    // Always the dark palette here — see the class comment.
    const c = AppColors.dark;
    // Tablets get a bigger tile; the layout is otherwise size-independent.
    final short = MediaQuery.sizeOf(context).shortestSide;
    final tile = short >= 600 ? 136.0 : 96.0;

    return Scaffold(
      backgroundColor: c.bg,
      body: DecoratedBox(
        decoration: const BoxDecoration(
          // The guide's radial: a lit corner above the mark, falling to near
          // black at the bottom edge.
          gradient: RadialGradient(
            center: Alignment(0, -0.4),
            radius: 1.1,
            colors: [Color(0xFF16264A), Color(0xFF0B0F1A), Color(0xFF070A12)],
            stops: [0.0, 0.55, 1.0],
          ),
        ),
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AnimatedBuilder(
                    animation: _c,
                    builder: (context, _) => Opacity(
                      opacity: _markFade.value,
                      child: Transform.scale(
                        scale: _markScale.value,
                        child: BrandMark(size: tile, radius: tile * 0.29),
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  AnimatedBuilder(
                    animation: _c,
                    builder: (context, _) => Opacity(
                      opacity: _wordFade.value,
                      child: Transform.translate(
                        offset: Offset(0, _wordRise.value),
                        child: Column(
                          children: [
                            Text(
                              'e-Learning Practest',
                              textAlign: TextAlign.center,
                              style: AppText.wordmark.copyWith(color: c.textPrimary),
                            ),
                            const SizedBox(height: 7),
                            Text(
                              'अभ्यास से सफलता तक · Practice to Success',
                              textAlign: TextAlign.center,
                              // #8FB0FF: the guide's blue-tinted subline, not
                              // the palette's muted grey. It is the one place a
                              // lighter blue reads as part of the lit gradient.
                              style: AppText.hindi.copyWith(
                                color: const Color(0xFF8FB0FF),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 60,
              child: Center(
                child: SizedBox(
                  width: 120,
                  height: 3,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: c.borderStrong,
                      borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                    ),
                    child: AnimatedBuilder(
                      animation: _c,
                      builder: (context, _) => Align(
                        alignment: Alignment.centerLeft,
                        child: FractionallySizedBox(
                          widthFactor: _bar.value,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFFFC968), Color(0xFFF5A623)],
                              ),
                              borderRadius:
                                  BorderRadius.circular(AppTheme.radiusPill),
                            ),
                          ),
                        ),
                      ),
                    ),
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
