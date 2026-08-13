import 'package:flutter/material.dart';

/// PRACTEST DESIGN SYSTEM — deep ink + gold, two themes.
///
/// These values are a port of `app/src/index.css`, which is the reference
/// implementation of the current design guide: the web SPA was rebuilt against
/// it first, so matching the CSS tokens — rather than re-reading the mockup —
/// is what keeps the phone and the browser looking like one product. Retarget a
/// token here and every screen follows, exactly as it does on the web.
///
/// **This replaced a teal system, and one thing did not survive the move.** The
/// old palette gave three hues one job each — teal the product, orange time and
/// money, gold achievement. The guide has no teal and no orange: gold is now
/// both the brand *and* achievement, royal blue carries information, violet
/// carries Vajini, and red/green stay inside the test engine. So [orange]
/// survives only as an alias for the amber warning family, keeping its existing
/// call sites compiling and legible; do not read a distinct meaning into it.
/// The one place that genuinely needed "time" is the CBT countdown, which the
/// guide draws in red — it uses [danger] now, not [orange].
///
/// Depth carries meaning here, never decoration: two elevations, and a surface
/// is either bordered or shadowed, never both.

enum AppThemeMode { dark, light }

class AppColors {
  const AppColors({
    required this.isDark,
    required this.bg,
    required this.panel,
    required this.raised,
    required this.sunken,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.brand,
    required this.brandBright,
    required this.brandDeep,
    required this.brandSoft,
    required this.brandBorder,
    required this.onBrand,
    required this.orange,
    required this.orangeSoft,
    required this.orangeBorder,
    required this.gold,
    required this.goldSoft,
    required this.overlay,
    required this.danger,
    required this.dangerText,
    required this.dangerBg,
    required this.dangerBorder,
    required this.success,
    required this.successText,
    required this.successBg,
    required this.successBorder,
    required this.violet,
    required this.violetText,
    required this.secondary,
    required this.secondarySoft,
    required this.nav,
    required this.chrome,
  });

  /// Which of the two palettes this is. Elevation inverts between them — light
  /// carries an ambient shadow, dark carries a hairline and a surface lift —
  /// so widgets need to be able to ask.
  final bool isDark;

  // Surfaces. Teal-black, not blue-black: the mark tints its own dark.
  final Color bg;
  final Color panel;
  final Color raised;
  final Color sunken;
  final Color border;
  final Color borderStrong;

  // Ink. On light this is the mark's navy, not black.
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;

  /// Every study action: start test, continue watching, active tab, progress
  /// fill. [brandBright] is the same role lifted for legibility as *text* on a
  /// dark surface, where the flat brand sits too close to the ground.
  final Color brand;
  final Color brandBright;

  /// Headers, section rules, pressed states, links. The wordmark's own colour.
  final Color brandDeep;
  final Color brandSoft;
  final Color brandBorder;
  final Color onBrand;

  /// Time and access: countdowns, resend timers, activation, NEW flags, batch
  /// expiry. Never a study action.
  final Color orange;
  final Color orangeSoft;
  final Color orangeBorder;

  /// Achievement: rank, percentile, streaks, completed series. The only
  /// celebratory hue.
  final Color gold;
  final Color goldSoft;

  final Color overlay;

  // Outside the test engine these carry banners and section verdicts. Inside
  // it, red and green belong to [CbtStatus] alone.
  final Color danger;
  final Color dangerText;
  final Color dangerBg;
  final Color dangerBorder;
  final Color success;
  final Color successText;
  final Color successBg;
  final Color successBorder;
  final Color violet;
  final Color violetText;

  /// Royal blue. The guide's secondary: the goal strip, the blue icon tint, and
  /// anything that must read as "information" beside a gold call to action.
  final Color secondary;
  final Color secondarySoft;

  /// The tab bar's own ground. Translucent over the page, so it is not [panel]:
  /// content scrolling under the bar should tint it.
  final Color nav;

  /// Top stop of the header gradient. Stays deep and branded in **both**
  /// themes — the guide keeps the chrome dark on light mode too, which is the
  /// one place the light palette deliberately does not lighten.
  final Color chrome;

  static const dark = AppColors(
    isDark: true,
    bg: Color(0xFF0B0F1A),
    panel: Color(0xFF141B2B),
    raised: Color(0xFF1B2438),
    sunken: Color(0x0DFFFFFF),
    border: Color(0x14FFFFFF),
    borderStrong: Color(0x1FFFFFFF),
    textPrimary: Color(0xFFF3F6FF),
    textSecondary: Color(0xFFC7D0E4),
    textMuted: Color(0xFF8A96B4),
    brand: Color(0xFFF5A623),
    brandBright: Color(0xFFFFC968),
    brandDeep: Color(0xFF12203A),
    brandSoft: Color(0x29F5A623),
    brandBorder: Color(0x4DF5A623),
    onBrand: Color(0xFF1A1206),
    orange: Color(0xFFF5A623),
    orangeSoft: Color(0x24F5A623),
    orangeBorder: Color(0x52F5A623),
    gold: Color(0xFFFFC968),
    goldSoft: Color(0x29F5A623),
    overlay: Color(0xB803060E),
    danger: Color(0xFFE5484D),
    dangerText: Color(0xFFFB8F92),
    dangerBg: Color(0x24E5484D),
    dangerBorder: Color(0x52E5484D),
    success: Color(0xFF12B981),
    successText: Color(0xFF3DDBA9),
    successBg: Color(0x2412B981),
    successBorder: Color(0x5212B981),
    violet: Color(0xFF8B5CF6),
    violetText: Color(0xFFB9A6FF),
    secondary: Color(0xFF3B6FF6),
    secondarySoft: Color(0x293B6FF6),
    nav: Color(0xEB090D15),
    chrome: Color(0xFF12203A),
  );

  static const light = AppColors(
    isDark: false,
    bg: Color(0xFFEAEEF6),
    panel: Color(0xFFFFFFFF),
    raised: Color(0xFFF4F7FC),
    sunken: Color(0xFFFFFFFF),
    border: Color(0x1A121623),
    borderStrong: Color(0x29121623),
    textPrimary: Color(0xFF131722),
    textSecondary: Color(0xFF39424F),
    textMuted: Color(0xFF616B7A),
    brand: Color(0xFFF5A623),
    // Not the flat brand: #F5A623 on white is roughly 1.9:1. #A85F00 is the
    // web's WCAG-AA gold and the only one that may carry text or a glyph.
    brandBright: Color(0xFFA85F00),
    brandDeep: Color(0xFF12203A),
    brandSoft: Color(0x29F5A623),
    brandBorder: Color(0x52A85F00),
    onBrand: Color(0xFF1A1206),
    orange: Color(0xFFA85F00),
    orangeSoft: Color(0x24F5A623),
    orangeBorder: Color(0x4DA85F00),
    gold: Color(0xFFA85F00),
    goldSoft: Color(0x29F5A623),
    overlay: Color(0x80121830),
    danger: Color(0xFFCB2F37),
    dangerText: Color(0xFFCB2F37),
    dangerBg: Color(0x1AE5484D),
    dangerBorder: Color(0x4DCB2F37),
    success: Color(0xFF08805A),
    successText: Color(0xFF08805A),
    successBg: Color(0x1F12B981),
    successBorder: Color(0x4D08805A),
    violet: Color(0xFF6A34DE),
    violetText: Color(0xFF6A34DE),
    secondary: Color(0xFF3B6FF6),
    secondarySoft: Color(0x243B6FF6),
    nav: Color(0xF5FFFFFF),
    chrome: Color(0xFF12203A),
  );
}

/// A themed icon tile: glyph colour, tile tint, tile border.
///
/// Port of the web's `tint(hue, isDark)` (app/src/lib/theme.js), which is
/// itself the guide's `TN` map. The glyph colour flips per theme while the tint
/// stays in the same family, which is what stops light mode washing out — a
/// 16%-alpha gold tile with a #FFC968 glyph is invisible on white.
class AppTint {
  const AppTint({required this.c, required this.bg, required this.bd});

  /// Glyph / text colour.
  final Color c;

  /// Tile background tint.
  final Color bg;

  /// Tile border.
  final Color bd;
}

/// The seven hues an icon tile may take. Keyed the same as the web so a screen
/// can be ported without re-deciding what colour anything is.
enum TintHue { gold, blue, violet, green, red, sky, neutral }

const Map<TintHue, AppTint> _darkTints = {
  TintHue.gold: AppTint(c: Color(0xFFFFC968), bg: Color(0x29F5A623), bd: Color(0x4DF5A623)),
  TintHue.blue: AppTint(c: Color(0xFF8FB0FF), bg: Color(0x293B6FF6), bd: Color(0x4D3B6FF6)),
  TintHue.violet: AppTint(c: Color(0xFFB9A6FF), bg: Color(0x298B5CF6), bd: Color(0x4D8B5CF6)),
  TintHue.green: AppTint(c: Color(0xFF3DDBA9), bg: Color(0x2912B981), bd: Color(0x4D12B981)),
  TintHue.red: AppTint(c: Color(0xFFFB8F92), bg: Color(0x29E5484D), bd: Color(0x4DE5484D)),
  TintHue.sky: AppTint(c: Color(0xFF7DD3FC), bg: Color(0x290EA5E9), bd: Color(0x4D0EA5E9)),
  TintHue.neutral: AppTint(c: Color(0xFFC7D0E4), bg: Color(0x14FFFFFF), bd: Color(0x24FFFFFF)),
};

const Map<TintHue, AppTint> _lightTints = {
  TintHue.gold: AppTint(c: Color(0xFFA85F00), bg: Color(0x33F5A623), bd: Color(0x59A85F00)),
  TintHue.blue: AppTint(c: Color(0xFF2450CC), bg: Color(0x243B6FF6), bd: Color(0x522450CC)),
  TintHue.violet: AppTint(c: Color(0xFF6A34DE), bg: Color(0x248B5CF6), bd: Color(0x526A34DE)),
  TintHue.green: AppTint(c: Color(0xFF08805A), bg: Color(0x2912B981), bd: Color(0x5208805A)),
  TintHue.red: AppTint(c: Color(0xFFCB2F37), bg: Color(0x21E5484D), bd: Color(0x4DCB2F37)),
  TintHue.sky: AppTint(c: Color(0xFF0A78B4), bg: Color(0x260EA5E9), bd: Color(0x4D0A78B4)),
  TintHue.neutral: AppTint(c: Color(0xFF465065), bg: Color(0x12121623), bd: Color(0x24121623)),
};

/// tint(hue, isDark) → the tile's three colours.
AppTint tint(TintHue hue, bool isDark) =>
    (isDark ? _darkTints : _lightTints)[hue] ?? _darkTints[TintHue.neutral]!;

/// CBT palette statuses — deliberately saturated and identical in both themes.
///
/// This is the one place the brand palette does not reach. A student reads
/// answer state off these squares under a countdown; the meaning cannot shift
/// between day and night, or between releases. The answered green is
/// deliberately not the success token.
class CbtStatus {
  static const notVisitedBg = Color(0xFF64748B);
  static const notVisitedText = Colors.white;
  static const notAnsweredBg = Color(0xFFE5484D);
  static const notAnsweredText = Colors.white;
  static const answeredBg = Color(0xFF0EA371);
  static const answeredText = Colors.white;
  static const markedBg = Color(0xFF8B5CF6);
  static const markedText = Colors.white;
  static const answeredMarkedBg = Color(0xFF8B5CF6);
  static const answeredMarkedBorder = Color(0xFF34D399);
}

/// The bundled stack. Sora carries display, Plus Jakarta Sans carries the
/// interface, JetBrains Mono carries every figure that must not reflow as it
/// changes, and Noto Sans Devanagari carries हिं. Weight 800 is the ceiling and
/// there are no gradient-filled numerals.
class AppFont {
  static const display = 'Sora';
  static const ui = 'PlusJakartaSans';
  static const mono = 'JetBrainsMono';
  static const hindi = 'NotoSansDevanagari';

  /// Appended to every Latin text style, because neither Latin family contains
  /// a single Devanagari glyph and pubspec has no per-family fallback of its
  /// own. Without this, one Hindi word inside an English string renders in
  /// whatever the OEM ships — which is how the same screen ends up looking
  /// different on Samsung and on Pixel. Costs nothing for Latin text: the
  /// fallback list is consulted only for codepoints the primary family lacks.
  static const fallback = <String>[hindi];
}

/// The type scale, as drawn in the redesign guide. Colour is applied at the
/// call site so one style can serve both themes.
class AppText {
  /// The result hero. Solid ink, tabular, never a gradient.
  static const scoreHero = TextStyle(
      fontFamily: AppFont.mono, fontSize: 42, fontWeight: FontWeight.w800, height: 1);
  static const score = TextStyle(
      fontFamily: AppFont.mono, fontSize: 34, fontWeight: FontWeight.w800, height: 1.1);

  /// Stat-tile numeral.
  static const figure = TextStyle(
      fontFamily: AppFont.mono, fontSize: 24, fontWeight: FontWeight.w800, height: 1);
  static const figureSm = TextStyle(
      fontFamily: AppFont.mono, fontSize: 18, fontWeight: FontWeight.w800, height: 1);

  /// The countdown. Tabular by construction — the digits cannot jitter.
  static const clock = TextStyle(
      fontFamily: AppFont.mono, fontSize: 15, fontWeight: FontWeight.w800, height: 1);
  static const clockLg = TextStyle(
      fontFamily: AppFont.mono, fontSize: 17, fontWeight: FontWeight.w800, height: 1);
  static const clockSm = TextStyle(
      fontFamily: AppFont.mono, fontSize: 11, fontWeight: FontWeight.w400, height: 1);

  /// The welcome headline. The one place display type is set this large, and
  /// the only style that carries the guide's -0.03em tracking.
  static const hero = TextStyle(
      fontFamily: AppFont.display,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 33,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.99,
      height: 1.08);
  static const wordmark = TextStyle(
      fontFamily: AppFont.display,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 24,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.48,
      height: 1.1);

  static const screenTitle = TextStyle(
      fontFamily: AppFont.display,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
      height: 1.2);
  static const cardTitle = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 17,
      fontWeight: FontWeight.w700,
      height: 1.3);
  static const cardTitleSm = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 15,
      fontWeight: FontWeight.w700,
      height: 1.25);

  /// Section heading beside the 3px accent rule.
  static const heading = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 15,
      fontWeight: FontWeight.w600,
      height: 1);

  /// Question text. LaTeX-aware.
  static const question = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 16,
      fontWeight: FontWeight.w400,
      height: 1.6);
  static const body = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 14,
      fontWeight: FontWeight.w400,
      height: 1.55);
  static const bodyStrong = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 14,
      fontWeight: FontWeight.w600,
      height: 1.5);

  /// Hindi set on purpose rather than by fallback — the guide's taglines and
  /// sublines are Devanagari-first, so the family is primary and the metrics
  /// (which differ from the Latin families) are the ones that lay out the line.
  static const hindi = TextStyle(
      fontFamily: AppFont.hindi,
      fontSize: 13,
      fontWeight: FontWeight.w600,
      height: 1.45);
  static const hindiBody = TextStyle(
      fontFamily: AppFont.hindi,
      fontSize: 15,
      fontWeight: FontWeight.w600,
      height: 1.5);

  /// All-caps eyebrow. 0.08em at 12px is 0.96 logical pixels of tracking.
  static const label = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 12,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.96,
      height: 1);
  static const labelSm = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 11,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.99,
      height: 1);

  static const caption = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 12,
      fontWeight: FontWeight.w400,
      height: 1.4);
  static const captionStrong = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 12,
      fontWeight: FontWeight.w600,
      height: 1.35);

  static const button = TextStyle(
      fontFamily: AppFont.ui,
      fontFamilyFallback: AppFont.fallback,
      fontSize: 14.5,
      fontWeight: FontWeight.w700,
      height: 1);

  /// 10px, for the five tab labels only.
  static const tab = TextStyle(
      fontFamily: AppFont.ui, fontFamilyFallback: AppFont.fallback, fontSize: 10, height: 1);

  /// Figures inside a sentence, where mono would break the line's colour.
  static const tabularFigures = [FontFeature.tabularFigures()];
}

class AppTheme {
  static const radiusSm = 10.0;
  static const radiusMd = 14.0;
  static const radiusLg = 20.0;
  static const radiusPill = 999.0;

  /// The primary call to action. Constant across both themes — a gold button is
  /// gold at midnight and at noon, and its ink is [AppColors.onBrand], never
  /// white. Stops are the guide's: the mid stop sits at 55%, not 50%, which is
  /// what keeps the light end from taking over a wide button.
  static const goldGradient = <Color>[
    Color(0xFFFFC968),
    Color(0xFFF5A623),
    Color(0xFFE07C0A),
  ];
  static const goldGradientStops = <double>[0.0, 0.55, 1.0];

  /// Vajini, and Vajini only. Nothing else in the product is violet→blue.
  static const violetGradient = <Color>[Color(0xFF8B5CF6), Color(0xFF3B6FF6)];

  /// A route push is 180ms and eased out. Anything slower reads as the app
  /// thinking; anything bouncier reads as decoration.
  static const routeDuration = Duration(milliseconds: 180);

  /// A palette square changes state in 90ms — fast enough that the student
  /// perceives it as the tap itself, not as an animation of the tap.
  static const paletteFlip = Duration(milliseconds: 90);

  /// One soft ambient shadow, and only on light. Dark inverts to a one-step
  /// surface lift plus a hairline. Never a border and a shadow together.
  static List<BoxShadow> ambient(AppColors c) => c.isDark
      ? const []
      : const [BoxShadow(color: Color(0x140B1B21), blurRadius: 14, offset: Offset(0, 2))];

  static ThemeData build(AppThemeMode mode) {
    final c = mode == AppThemeMode.dark ? AppColors.dark : AppColors.light;
    final brightness =
        mode == AppThemeMode.dark ? Brightness.dark : Brightness.light;

    TextStyle ink(TextStyle s) => s.copyWith(color: c.textPrimary);

    return ThemeData(
      brightness: brightness,
      useMaterial3: true,
      fontFamily: AppFont.ui,
      scaffoldBackgroundColor: c.bg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: c.brand,
        brightness: brightness,
        primary: c.brand,
        onPrimary: c.onBrand,
        surface: c.bg,
        onSurface: c.textPrimary,
        error: c.danger,
      ),
      // The default ink ripple reads as decoration on a flat surface.
      splashFactory: InkRipple.splashFactory,
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: _FadeUpTransitionBuilder(),
          TargetPlatform.iOS: _FadeUpTransitionBuilder(),
        },
      ),
      textTheme: TextTheme(
        displaySmall: ink(AppText.scoreHero),
        headlineMedium: ink(AppText.screenTitle),
        headlineSmall: ink(AppText.screenTitle),
        titleLarge: ink(AppText.cardTitle),
        titleMedium: ink(AppText.cardTitleSm),
        bodyLarge: ink(AppText.question),
        bodyMedium: ink(AppText.body),
        bodySmall: ink(AppText.caption),
        labelLarge: ink(AppText.button),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.sunken,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide(color: c.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide(color: c.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(radiusSm),
          borderSide: BorderSide(color: c.brand, width: 1.4),
        ),
        hintStyle: AppText.body.copyWith(color: c.textMuted),
        labelStyle: AppText.body.copyWith(color: c.textSecondary),
      ),
      dividerColor: c.border,
      dialogTheme: DialogThemeData(
        backgroundColor: c.panel,
        surfaceTintColor: Colors.transparent,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: c.panel,
        surfaceTintColor: Colors.transparent,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: c.raised,
        contentTextStyle: AppText.body.copyWith(color: c.textPrimary),
      ),
    );
  }
}

/// 180ms, eased out, with a short rise. Material's own builders are 300ms+ and
/// are not configurable, so the transition is declared here instead.
class _FadeUpTransitionBuilder extends PageTransitionsBuilder {
  const _FadeUpTransitionBuilder();

  @override
  Duration get transitionDuration => AppTheme.routeDuration;

  @override
  Widget buildTransitions<T>(
    PageRoute<T> route,
    BuildContext context,
    Animation<double> animation,
    Animation<double> secondaryAnimation,
    Widget child,
  ) {
    final curved = CurvedAnimation(parent: animation, curve: Curves.easeOut);
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.035), end: Offset.zero)
            .animate(curved),
        child: child,
      ),
    );
  }
}
