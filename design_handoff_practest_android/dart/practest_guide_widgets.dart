// PATCH 1 of 4 — the primitives. Fixing these repaints every screen at once.
//
// Drop these into lib/widgets.dart (replacing the same-named classes) or keep
// this file and import it. Nothing here changes behaviour; only paint.
//
// Why this file exists: lib/theme.dart is already a faithful port of the guide,
// but AppTheme.goldGradient, AppText.hero and AppColors.chrome are declared and
// never referenced anywhere in lib/. The tokens are right; the primitives that
// consume them were never updated from the pre-guide (teal) system.

import 'package:flutter/material.dart';

import 'theme.dart';
import 'widgets.dart' show useColors;

/// THE call to action. Replaces PrimaryButton.
///
/// Was: flat `c.brand` fill, 10px radius, no shadow — the old teal system's
/// button wearing the new gold. The guide draws a 135° three-stop gradient at
/// 16px radius under a wide amber glow, and its ink is [AppColors.onBrand].
class GoldButton extends StatelessWidget {
  const GoldButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon = Icons.arrow_forward_rounded,
    this.showIcon = true,
    this.fullWidth = true,
    this.loading = false,
    this.dense = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData icon;
  final bool showIcon;
  final bool fullWidth;
  final bool loading;

  /// 13px vertical instead of 17 — for buttons inside a card, not the screen's
  /// own action.
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null && !loading;
    return Opacity(
      opacity: enabled ? 1 : 0.5,
      child: Material(
        color: Colors.transparent,
        child: Ink(
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: AppTheme.goldGradient,
              stops: AppTheme.goldGradientStops,
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            // The guide's glow. Only the primary action carries it; a second
            // glowing button on the same screen destroys the hierarchy it buys.
            boxShadow: enabled
                ? const [
                    BoxShadow(
                      color: Color(0x99F5A623),
                      blurRadius: 34,
                      spreadRadius: -12,
                      offset: Offset(0, 16),
                    ),
                  ]
                : const [],
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: enabled ? onPressed : null,
            child: Container(
              padding: EdgeInsets.symmetric(vertical: dense ? 13 : 17),
              constraints: BoxConstraints(
                minWidth: fullWidth ? double.infinity : 0,
                minHeight: 48,
              ),
              alignment: Alignment.center,
              child: loading
                  ? const SizedBox(
                      width: 19,
                      height: 19,
                      child: CircularProgressIndicator(
                          strokeWidth: 2.4, color: Color(0xFF1A1206)),
                    )
                  : Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          label,
                          style: const TextStyle(
                            fontFamily: AppFont.display,
                            fontFamilyFallback: AppFont.fallback,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.16,
                            height: 1,
                            color: Color(0xFF1A1206),
                          ),
                        ),
                        if (showIcon) ...[
                          const SizedBox(width: 8),
                          Icon(icon, size: 19, color: const Color(0xFF1A1206)),
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

/// The quiet second action. 16px radius, hairline border, 4% white fill —
/// matches the guide's "I already have an account".
class GhostButton extends StatelessWidget {
  const GhostButton({super.key, required this.label, this.onPressed, this.icon});

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onPressed,
        child: Ink(
          decoration: BoxDecoration(
            color: c.isDark ? const Color(0x0AFFFFFF) : Colors.transparent,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 15),
            constraints: const BoxConstraints(minWidth: double.infinity, minHeight: 48),
            alignment: Alignment.center,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: c.textSecondary),
                  const SizedBox(width: 8),
                ],
                Text(
                  label,
                  style: AppText.button.copyWith(color: c.textSecondary, fontSize: 14),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// The all-caps pill above a headline — "EXAM-ACCURATE CBT".
///
/// 0.1em tracking at 11px, amber on a 14%-alpha amber ground with a 32%-alpha
/// border. Nothing else in the product uses this shape, which is what makes it
/// read as a claim rather than as a chip.
class EyebrowPill extends StatelessWidget {
  const EyebrowPill({super.key, required this.label, this.icon, this.hue = TintHue.gold});

  final String label;
  final IconData? icon;
  final TintHue hue;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final t = tint(hue, c.isDark);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: t.bg,
        border: Border.all(color: t.bd),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: t.c),
            const SizedBox(width: 7),
          ],
          Text(
            label,
            style: AppText.labelSm.copyWith(color: t.c, letterSpacing: 1.1),
          ),
        ],
      ),
    );
  }
}

/// The branded header. Replaces AppHeader's flat `c.bg` fill.
///
/// [AppColors.chrome] (#12203A) exists precisely for this and was referenced
/// nowhere. The guide keeps the chrome deep and branded in BOTH themes — it is
/// the one surface the light palette deliberately does not lighten.
class ChromeHeader extends StatelessWidget implements PreferredSizeWidget {
  const ChromeHeader({super.key, required this.child, this.height = 60});

  final Widget child;
  final double height;

  @override
  Size get preferredSize => Size.fromHeight(height);

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 12),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [c.chrome, c.bg],
        ),
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: SafeArea(bottom: false, child: child),
    );
  }
}

/// A card at the guide's radius.
///
/// SurfacePanel is correct in every respect except its corner: it defaults to
/// AppTheme.radiusMd (14), and the guide's cards are 20 and its hero surfaces
/// 28. A 14px card inside a 28px frame is the single most common reason a
/// correctly-coloured screen still reads as "not the design".
class GuideCard extends StatelessWidget {
  const GuideCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(18),
    this.radius = AppTheme.radiusLg,
    this.onTap,
    this.borderColor,
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double radius;
  final VoidCallback? onTap;
  final Color? borderColor;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final hasBorder = borderColor != null || c.isDark;
    final box = Container(
      padding: padding,
      decoration: BoxDecoration(
        color: color ?? c.panel,
        borderRadius: BorderRadius.circular(radius),
        border: hasBorder ? Border.all(color: borderColor ?? c.border) : null,
        boxShadow: hasBorder ? const [] : AppTheme.ambient(c),
      ),
      child: child,
    );
    if (onTap == null) return box;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(radius),
        child: box,
      ),
    );
  }
}

/// A ticked claim: "✓ Real CBT engine". Green check in an 18dp disc.
class TickedClaim extends StatelessWidget {
  const TickedClaim(this.label, {super.key});

  final String label;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 18,
          height: 18,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: c.successBg,
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.check_rounded, size: 12, color: c.success),
        ),
        const SizedBox(width: 7),
        Text(
          label,
          style: AppText.captionStrong.copyWith(color: c.textSecondary, fontSize: 13),
        ),
      ],
    );
  }
}
