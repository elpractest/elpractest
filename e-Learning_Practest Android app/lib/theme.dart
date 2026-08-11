import 'package:flutter/material.dart';

/// PRACTEST DESIGN SYSTEM — futuristic glass, two themes.
/// Tokens ported 1:1 from `app/src/index.css`.

enum AppThemeMode { dark, light }

class AppColors {
  const AppColors({
    required this.bg,
    required this.bgAccent1,
    required this.bgAccent2,
    required this.bgAccent3,
    required this.panelBg,
    required this.panelBgSolid,
    required this.border,
    required this.borderStrong,
    required this.textPrimary,
    required this.textSecondary,
    required this.accent,
    required this.accentHover,
    required this.accentContrast,
    required this.accentGlow,
    required this.accentSoft,
    required this.accentBorder,
    required this.gradPrimary,
    required this.gradText,
    required this.surface1,
    required this.surface2,
    required this.surface3,
    required this.surfaceStrong,
    required this.surfaceSunken,
    required this.overlay,
    required this.danger,
    required this.dangerText,
    required this.dangerBg,
    required this.dangerBorder,
    required this.success,
    required this.successText,
    required this.successBg,
    required this.successBorder,
    required this.warning,
    required this.warningText,
    required this.warningBg,
    required this.warningBorder,
    required this.violet,
    required this.violetText,
  });

  final Color bg;
  final Color bgAccent1;
  final Color bgAccent2;
  final Color bgAccent3;
  final Color panelBg;
  final Color panelBgSolid;
  final Color border;
  final Color borderStrong;
  final Color textPrimary;
  final Color textSecondary;
  final Color accent;
  final Color accentHover;
  final Color accentContrast;
  final Color accentGlow;
  final Color accentSoft;
  final Color accentBorder;
  final List<Color> gradPrimary;
  final List<Color> gradText;
  final Color surface1;
  final Color surface2;
  final Color surface3;
  final Color surfaceStrong;
  final Color surfaceSunken;
  final Color overlay;
  final Color danger;
  final Color dangerText;
  final Color dangerBg;
  final Color dangerBorder;
  final Color success;
  final Color successText;
  final Color successBg;
  final Color successBorder;
  final Color warning;
  final Color warningText;
  final Color warningBg;
  final Color warningBorder;
  final Color violet;
  final Color violetText;

  static const dark = AppColors(
    bg: Color(0xFF070B16),
    bgAccent1: Color(0x296366F1),
    bgAccent2: Color(0x1A22D3EE),
    bgAccent3: Color(0x1AA855F7),
    panelBg: Color(0x990F1629),
    panelBgSolid: Color(0xFF0E1526),
    border: Color(0x2494A3FF),
    borderStrong: Color(0x4D94A3FF),
    textPrimary: Color(0xFFEEF1FB),
    textSecondary: Color(0xFF98A4C8),
    accent: Color(0xFF8B93FF),
    accentHover: Color(0xFFA5ABFF),
    accentContrast: Colors.white,
    accentGlow: Color(0x4D7A83FF),
    accentSoft: Color(0x296366F1),
    accentBorder: Color(0x66818CF8),
    gradPrimary: [Color(0xFF6366F1), Color(0xFF8B5CF6), Color(0xFFA855F7)],
    gradText: [Color(0xFFA5B4FC), Color(0xFF8B93FF), Color(0xFF67E8F9)],
    surface1: Color(0x0AA0AFFF),
    surface2: Color(0x0FA0AFFF),
    surface3: Color(0x1AA0AFFF),
    surfaceStrong: Color(0x4DA0AFFF),
    surfaceSunken: Color(0x5902050E),
    overlay: Color(0xB803060E),
    danger: Color(0xFFE5484D),
    dangerText: Color(0xFFFB8F92),
    dangerBg: Color(0x1FE5484D),
    dangerBorder: Color(0x52E5484D),
    success: Color(0xFF10B981),
    successText: Color(0xFF3DDBA9),
    successBg: Color(0x1F10B981),
    successBorder: Color(0x5910B981),
    warning: Color(0xFFF59E0B),
    warningText: Color(0xFFFCD34D),
    warningBg: Color(0x1FF59E0B),
    warningBorder: Color(0x52F59E0B),
    violet: Color(0xFF8B5CF6),
    violetText: Color(0xFFB5A8FF),
  );

  static const light = AppColors(
    bg: Color(0xFFEEF1FA),
    bgAccent1: Color(0x296366F1),
    bgAccent2: Color(0x1F0EA5E9),
    bgAccent3: Color(0x1AA855F7),
    panelBg: Color(0xA8FFFFFF),
    panelBgSolid: Color(0xFFFFFFFF),
    border: Color(0x1F263269),
    borderStrong: Color(0x42263269),
    textPrimary: Color(0xFF171F3D),
    textSecondary: Color(0xFF59639B),
    accent: Color(0xFF4F46E5),
    accentHover: Color(0xFF4338CA),
    accentContrast: Colors.white,
    accentGlow: Color(0x334F46E5),
    accentSoft: Color(0x1A4F46E5),
    accentBorder: Color(0x594F46E5),
    gradPrimary: [Color(0xFF4F46E5), Color(0xFF7C3AED), Color(0xFF9333EA)],
    gradText: [Color(0xFF4F46E5), Color(0xFF7C3AED), Color(0xFF0891B2)],
    surface1: Color(0x0A263269),
    surface2: Color(0x0F263269),
    surface3: Color(0x17263269),
    surfaceStrong: Color(0x40263269),
    surfaceSunken: Color(0x12263269),
    overlay: Color(0x80121830),
    danger: Color(0xFFD92D33),
    dangerText: Color(0xFFC81E24),
    dangerBg: Color(0x14D92D33),
    dangerBorder: Color(0x47D92D33),
    success: Color(0xFF0B9E6D),
    successText: Color(0xFF087450),
    successBg: Color(0x1A0B9E6D),
    successBorder: Color(0x4D0B9E6D),
    warning: Color(0xFFD97706),
    warningText: Color(0xFFA35505),
    warningBg: Color(0x1AD97706),
    warningBorder: Color(0x4DD97706),
    violet: Color(0xFF7C3AED),
    violetText: Color(0xFF6D28D9),
  );
}

/// CBT palette statuses — deliberately saturated + identical in both themes.
/// These are the most safety-critical colors in the product.
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

class AppTheme {
  static const radiusSm = 10.0;
  static const radiusMd = 14.0;
  static const radiusLg = 20.0;

  static LinearGradient primaryGradient(AppColors c) => LinearGradient(
        colors: c.gradPrimary,
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
      );

  static LinearGradient textGradient(AppColors c) => LinearGradient(
        colors: c.gradText,
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
      );

  static ThemeData build(AppThemeMode mode) {
    final c = mode == AppThemeMode.dark ? AppColors.dark : AppColors.light;
    final brightness =
        mode == AppThemeMode.dark ? Brightness.dark : Brightness.light;

    return ThemeData(
      brightness: brightness,
      useMaterial3: true,
      scaffoldBackgroundColor: c.bg,
      colorScheme: ColorScheme.fromSeed(
        seedColor: c.accent,
        brightness: brightness,
        primary: c.accent,
        surface: c.bg,
      ),
      splashFactory: InkSparkle.splashFactory,
      textTheme: const TextTheme(
        displaySmall: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.02),
        headlineMedium: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.02),
        headlineSmall: TextStyle(fontWeight: FontWeight.w800, letterSpacing: -0.02),
        titleLarge: TextStyle(fontWeight: FontWeight.w700, letterSpacing: -0.01),
        titleMedium: TextStyle(fontWeight: FontWeight.w700),
        bodyMedium: TextStyle(height: 1.55),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: c.surfaceSunken,
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
          borderSide: BorderSide(color: c.accent, width: 1.4),
        ),
        hintStyle: TextStyle(color: c.textSecondary.withOpacity(0.75)),
      ),
      dividerColor: c.border,
      dialogTheme: DialogThemeData(
        backgroundColor: c.panelBgSolid,
      ),
    );
  }
}
