// PATCH 3 of 4 — the welcome screen, rebuilt to the guide.
//
// Replaces lib/screens/intro_screen.dart at the same route (RootGate ->
// AuthStatus.unauthenticated). The screen it replaces is the pre-guide layout:
// a centred lockup, a 26px screenTitle, and six stacked feature cards. The
// guide draws a 56%-height photographic hero under a four-stop scrim, a plated
// mark + live wordmark over it, the EN/हिं pill, an EXAM-ACCURATE CBT eyebrow,
// a 33px Sora headline at -0.03em, a Devanagari-first subline, two ticked
// claims, and the gold gradient CTA.
//
// One asset is required and is not in the repo: assets/hero/welcome.jpg — a
// photograph of students / a classroom. The scrim below is tuned for a mid-dark
// image. Until it lands, [_Hero] falls back to the guide's radial ink so the
// screen is never broken; it is not the design until the photograph is there.

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../i18n.dart';
import '../routes.dart';
import '../theme.dart';
import '../widgets.dart';
import '../practest_guide_widgets.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final i18n = context.watch<I18n>();
    return Scaffold(
      backgroundColor: const Color(0xFF0B0F1A),
      // extendBody so the hero runs under the status bar, as drawn.
      body: LayoutBuilder(
        builder: (context, box) {
          return Column(
            children: [
              SizedBox(height: box.maxHeight * 0.56, child: const _Hero()),
              Expanded(child: _Copy(i18n: i18n)),
            ],
          );
        },
      ),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero();

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/hero/welcome.jpg',
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => const DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(-0.3, -0.8),
                radius: 1.2,
                colors: [Color(0xFF16264A), Color(0xFF0B0F1A)],
              ),
            ),
          ),
        ),
        // The guide's four-stop scrim: a light wash at the top so the wordmark
        // holds, transparent through the middle so the photograph is actually
        // visible, then down to solid #0B0F1A so the copy below has no seam.
        const DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Color(0x590B0F1A),
                Color(0x000B0F1A),
                Color(0xB30B0F1A),
                Color(0xFF0B0F1A),
              ],
              stops: [0.0, 0.34, 0.78, 1.0],
            ),
          ),
        ),
        Positioned(
          top: 58,
          left: 22,
          right: 22,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [_HeroBrand(), _LangPill()],
          ),
        ),
      ],
    );
  }
}

class _HeroBrand extends StatelessWidget {
  const _HeroBrand();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: const [
        // 40dp plate, 12px radius — the guide's small tile ratio.
        BrandMark(size: 40, radius: 12),
        SizedBox(width: 10),
        Text(
          'Practest',
          style: TextStyle(
            fontFamily: AppFont.display,
            fontSize: 17,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.34,
            height: 1,
            color: Colors.white,
            shadows: [Shadow(color: Color(0x800B0F1A), blurRadius: 12, offset: Offset(0, 2))],
          ),
        ),
      ],
    );
  }
}

/// The EN/हिं toggle. Present on every pre-auth surface in the guide and absent
/// from the app entirely.
class _LangPill extends StatelessWidget {
  const _LangPill();

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

class _Copy extends StatelessWidget {
  const _Copy({required this.i18n});

  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(26, 6, 26, 30),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            EyebrowPill(
              label: i18n.t('welcome.badge'),
              icon: Icons.assignment_turned_in_outlined,
            ),
            const SizedBox(height: 16),
            // AppText.hero — declared in theme.dart since the token pass and
            // referenced by nothing until now. 33px, 800, -0.03em, 1.08.
            Text(
              i18n.t('welcome.headline'),
              style: AppText.hero.copyWith(color: const Color(0xFFF3F6FF)),
            ),
            const SizedBox(height: 12),
            // Devanagari-first: the family is primary, so its metrics lay out
            // the line rather than the Latin family's.
            Text(
              i18n.t('welcome.subline'),
              style: AppText.hindiBody.copyWith(color: const Color(0xFF9AA6C2)),
            ),
            const SizedBox(height: 20),
            Wrap(
              spacing: 18,
              runSpacing: 10,
              children: [
                TickedClaim(i18n.t('welcome.claim1')),
                TickedClaim(i18n.t('welcome.claim2')),
              ],
            ),
            const Spacer(),
            GoldButton(
              label: i18n.t('welcome.cta'),
              onPressed: () => Navigator.of(context).pushNamed(Routes.register),
            ),
            const SizedBox(height: 12),
            GhostButton(
              label: i18n.t('welcome.haveAccount'),
              onPressed: () => Navigator.of(context).pushNamed(Routes.login),
            ),
          ],
        ),
      ),
    );
  }
}
