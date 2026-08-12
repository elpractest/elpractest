import 'package:flutter/material.dart';

/// PRACTEST DESIGN SYSTEM
///
/// The whole palette comes out of the mark. Teal is the product, orange is time
/// and money, gold is achievement — and each one owns exactly one job. Nothing
/// borrows another's meaning, which is the single rule that keeps a dense exam
/// screen legible.
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

  static const dark = AppColors(
    isDark: true,
    bg: Color(0xFF0B1B21),
    panel: Color(0xFF122B33),
    raised: Color(0xFF1B3A44),
    sunken: Color(0xFF081419),
    border: Color(0x1FDFE8EA),
    borderStrong: Color(0x40DFE8EA),
    textPrimary: Color(0xFFF4F6F7),
    textSecondary: Color(0xFF93A7AE),
    textMuted: Color(0xFF7D939B),
    brand: Color(0xFF009090),
    brandBright: Color(0xFF00B4B4),
    brandDeep: Color(0xFF187890),
    brandSoft: Color(0x1F009090),
    brandBorder: Color(0x59009090),
    onBrand: Colors.white,
    orange: Color(0xFFF07830),
    orangeSoft: Color(0x1FF07830),
    orangeBorder: Color(0x66F07830),
    gold: Color(0xFFF0A818),
    goldSoft: Color(0x1FF0A818),
    overlay: Color(0xC00B1B21),
    danger: Color(0xFFE5484D),
    dangerText: Color(0xFFFF8A8E),
    dangerBg: Color(0x1FE5484D),
    dangerBorder: Color(0x59E5484D),
    success: Color(0xFF0EA371),
    successText: Color(0xFF34D399),
    successBg: Color(0x1F0EA371),
    successBorder: Color(0x590EA371),
    violet: Color(0xFF8B5CF6),
    violetText: Color(0xFFB5A8FF),
  );

  static const light = AppColors(
    isDark: false,
    bg: Color(0xFFF4F6F7),
    panel: Color(0xFFFFFFFF),
    raised: Color(0xFFFFFFFF),
    sunken: Color(0xFFEDF1F2),
    border: Color(0x1F304860),
    borderStrong: Color(0x40304860),
    textPrimary: Color(0xFF304860),
    textSecondary: Color(0xFF6B7A88),
    textMuted: Color(0xFF8A98A4),
    brand: Color(0xFF009090),
    brandBright: Color(0xFF00787A),
    brandDeep: Color(0xFF187890),
    brandSoft: Color(0x14009090),
    brandBorder: Color(0x4D009090),
    onBrand: Colors.white,
    orange: Color(0xFFD9601C),
    orangeSoft: Color(0x14F07830),
    orangeBorder: Color(0x59D9601C),
    gold: Color(0xFFB57A05),
    goldSoft: Color(0x1FF0A818),
    overlay: Color(0x99162026),
    danger: Color(0xFFCC3238),
    dangerText: Color(0xFFB3272D),
    dangerBg: Color(0x14E5484D),
    dangerBorder: Color(0x47CC3238),
    success: Color(0xFF0B8259),
    successText: Color(0xFF086746),
    successBg: Color(0x140EA371),
    successBorder: Color(0x470B8259),
    violet: Color(0xFF6D3FD6),
    violetText: Color(0xFF5B2FC0),
  );
}

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

/// The bundled stack. Space Grotesk carries display, Inter carries the
/// interface, JetBrains Mono carries every figure that must not reflow as it
/// changes. Weight 800 is the ceiling and there are no gradient-filled
/// numerals.
class AppFont {
  static const display = 'SpaceGrotesk';
  static const ui = 'Inter';
  static const mono = 'JetBrainsMono';
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

  static const screenTitle = TextStyle(
      fontFamily: AppFont.display,
      fontSize: 24,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.2,
      height: 1.2);
  static const cardTitle = TextStyle(
      fontFamily: AppFont.ui, fontSize: 17, fontWeight: FontWeight.w700, height: 1.3);
  static const cardTitleSm = TextStyle(
      fontFamily: AppFont.ui, fontSize: 15, fontWeight: FontWeight.w700, height: 1.25);

  /// Section heading beside the 3px accent rule.
  static const heading = TextStyle(
      fontFamily: AppFont.ui, fontSize: 15, fontWeight: FontWeight.w600, height: 1);

  /// Question text. LaTeX-aware.
  static const question = TextStyle(
      fontFamily: AppFont.ui, fontSize: 16, fontWeight: FontWeight.w400, height: 1.6);
  static const body = TextStyle(
      fontFamily: AppFont.ui, fontSize: 14, fontWeight: FontWeight.w400, height: 1.55);
  static const bodyStrong = TextStyle(
      fontFamily: AppFont.ui, fontSize: 14, fontWeight: FontWeight.w600, height: 1.5);

  /// All-caps eyebrow. 0.08em at 12px is 0.96 logical pixels of tracking.
  static const label = TextStyle(
      fontFamily: AppFont.ui,
      fontSize: 12,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.96,
      height: 1);
  static const labelSm = TextStyle(
      fontFamily: AppFont.ui,
      fontSize: 11,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.99,
      height: 1);

  static const caption = TextStyle(
      fontFamily: AppFont.ui, fontSize: 12, fontWeight: FontWeight.w400, height: 1.4);
  static const captionStrong = TextStyle(
      fontFamily: AppFont.ui, fontSize: 12, fontWeight: FontWeight.w600, height: 1.35);

  static const button = TextStyle(
      fontFamily: AppFont.ui, fontSize: 14.5, fontWeight: FontWeight.w700, height: 1);

  /// 10px, for the four tab labels only.
  static const tab = TextStyle(fontFamily: AppFont.ui, fontSize: 10, height: 1);

  /// Figures inside a sentence, where mono would break the line's colour.
  static const tabularFigures = [FontFeature.tabularFigures()];
}

class AppTheme {
  static const radiusSm = 10.0;
  static const radiusMd = 14.0;
  static const radiusLg = 20.0;
  static const radiusPill = 999.0;

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
