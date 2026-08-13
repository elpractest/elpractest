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
import 'package:provider/provider.dart';

import 'i18n.dart';
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

// ChromeHeader and GuideCard were shipped in this patch but are intentionally
// absent: the branded chrome was folded directly into [AppHeader] (used inline,
// not as an AppBar, and it needs theme-aware foreground logic ChromeHeader did
// not carry), and the guide's 20px card geometry was reached by making
// [SurfacePanel] — "the one card in the system" — default to that radius rather
// than migrating every call site to a second card widget. Both were deleted the
// moment they were unused: a declared-but-unreferenced widget is the exact
// disease this whole port set out to remove.

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

/// The ground every pre-auth screen stands on.
///
/// The guide draws login, register, forgot and reset on one deep radial ink in
/// both themes, with a 40dp back tile top-left and the EN/हिं pill top-right.
/// This wraps the screen's card ([child]) in exactly that, so the whole pre-auth
/// family reads as one design instead of login-plus-four-plainer-siblings. The
/// card itself stays theme-aware; only the surround is fixed dark.
class PreAuthScaffold extends StatelessWidget {
  const PreAuthScaffold({super.key, required this.child, this.maxWidth = 440});

  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F1A),
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment(-0.55, -0.9),
            radius: 1.3,
            colors: [Color(0xFF12203A), Color(0xFF0B0F1A)],
            stops: [0.0, 0.62],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [_PreAuthBackTile(), LangPill()],
                ),
              ),
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 24),
                    child: ConstrainedBox(
                      constraints: BoxConstraints(maxWidth: maxWidth),
                      child: child,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 40dp rounded back tile top-left of every pre-auth surface. Renders an
/// empty slot when there is nothing to pop, so the row stays balanced.
class _PreAuthBackTile extends StatelessWidget {
  const _PreAuthBackTile();

  @override
  Widget build(BuildContext context) {
    if (!Navigator.of(context).canPop()) return const SizedBox(width: 40, height: 40);
    return Semantics(
      button: true,
      label: 'Back',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusMd),
          onTap: () => Navigator.of(context).maybePop(),
          child: Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: const Color(0x8C080C14),
              border: Border.all(color: const Color(0x29FFFFFF)),
              borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            ),
            child: const Icon(Icons.arrow_back, size: 20, color: Color(0xFFF3F6FF)),
          ),
        ),
      ),
    );
  }
}

/// The EN/हिं toggle the guide puts on every pre-auth surface. Fixed dark-ground
/// styling in both themes, because the pre-auth ground is always dark.
class LangPill extends StatelessWidget {
  const LangPill({super.key});

  @override
  Widget build(BuildContext context) {
    final i18n = context.watch<I18n>();
    return Semantics(
      button: true,
      label: 'Switch language',
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          onTap: i18n.toggle,
          child: Container(
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: const Color(0x8C080C14),
              border: Border.all(color: const Color(0x29FFFFFF)),
              borderRadius: BorderRadius.circular(AppTheme.radiusPill),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _LangChip(label: 'EN', active: !i18n.isHindi, family: AppFont.ui),
                const SizedBox(width: 2),
                _LangChip(label: 'हिं', active: i18n.isHindi, family: AppFont.hindi),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LangChip extends StatelessWidget {
  const _LangChip({required this.label, required this.active, required this.family});

  final String label;
  final bool active;
  final String family;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: AppTheme.paletteFlip,
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: active ? const Color(0xFFF5A623) : Colors.transparent,
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      ),
      child: Text(
        label,
        style: TextStyle(
          fontFamily: family,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          height: 1.2,
          color: active ? const Color(0xFF0B0F1A) : const Color(0xFFC7D0E4),
        ),
      ),
    );
  }
}
