import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

import 'theme.dart';

AppColors useColors(BuildContext context) {
  final theme = Theme.of(context).brightness;
  return theme == Brightness.dark ? AppColors.dark : AppColors.light;
}

/// Back affordance for screens that are pushed on top of the intro (login,
/// register). Renders nothing when there is nothing to pop, so the same screen
/// can still be used as a root without showing a dead control.
class BackChip extends StatelessWidget {
  const BackChip({super.key, this.label = 'Back'});

  final String label;

  @override
  Widget build(BuildContext context) {
    if (!Navigator.of(context).canPop()) return const SizedBox.shrink();
    final c = useColors(context);
    return Align(
      alignment: Alignment.centerLeft,
      child: TextButton.icon(
        onPressed: () => Navigator.of(context).maybePop(),
        icon: Icon(Icons.arrow_back, size: 18, color: c.textSecondary),
        label: Text(
          label,
          style: TextStyle(fontSize: 13.5, color: c.textSecondary),
        ),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}

enum BrandWordmarkSize { small, large }

/// The `E-LEARNING` / `Practest` lockup, so the splash, intro and auth screens
/// cannot drift apart. Gradient fill matches the SPA's `--grad-text`.
class BrandWordmark extends StatelessWidget {
  const BrandWordmark({
    super.key,
    this.size = BrandWordmarkSize.small,
    this.align = CrossAxisAlignment.center,
  });

  final BrandWordmarkSize size;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final large = size == BrandWordmarkSize.large;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: align,
      children: [
        Text(
          'E-LEARNING',
          style: TextStyle(
            color: c.warning,
            fontSize: large ? 11 : 9,
            fontWeight: FontWeight.w700,
            letterSpacing: large ? 3.4 : 1.8,
          ),
        ),
        SizedBox(height: large ? 4 : 1),
        ShaderMask(
          shaderCallback: (r) => AppTheme.textGradient(c).createShader(r),
          child: Text(
            'Practest',
            style: TextStyle(
              fontSize: large ? 38 : 20,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
              // ShaderMask multiplies against this, so it must stay opaque white.
              color: Colors.white,
            ),
          ),
        ),
      ],
    );
  }
}

/// Math renderer replicating the SPA's KaTeX split semantics:
/// `$$...$$` block math, `$...$` inline math, everything else plain text.
/// Additionally, undelimited LaTeX (e.g. `\int \sin^2(x) \cos(x) dx`) is
/// auto-detected so question banks that omit `$...$` still render correctly.
class MathText extends StatelessWidget {
  const MathText(this.text, {super.key, this.style, this.displayStyle});

  final String? text;
  final TextStyle? style;
  final TextStyle? displayStyle;

  static final RegExp _pattern = RegExp(r'(\$\$[\s\S]*?\$\$|\$[\s\S]*?\$)');

  /// Whitespace-separated token classification:
  /// 2 = strong math signal (backslash command, `^`, `_`),
  /// 1 = weak math token (number, operator, variable, function),
  /// 0 = plain prose word.
  static final RegExp _tokenRe = RegExp(r'\S+');
  static final RegExp _strongMathRe = RegExp(r'\\|[\^_]');
  static final RegExp _weakSingleRe = RegExp(r'^[a-z][.,!?;:]?$');
  static final RegExp _weakDiffRe = RegExp(r'^d[a-z][.,!?;:]?$');
  static final RegExp _weakOperatorRe = RegExp(r'^[+\-*/=<>,.;:!?()\[\]{}|~]+$');
  static final RegExp _weakNumberRe = RegExp(r'^\d+(?:\.\d+)?[,.;:!?]?$');
  static final RegExp _weakFuncRe = RegExp(
      r'^(?:sin|cos|tan|cot|sec|cosec|log|ln|exp|lim|max|min|det|mod|pi|sum|prod|int|sqrt)$');

  /// Split plain text into math runs (segments containing at least one strong
  /// math token) and prose, rendering the math runs with [Math.tex].
  List<Widget> _autoDetect(String raw, TextStyle style) {
    final matches = _tokenRe.allMatches(raw).toList();
    if (matches.isEmpty) {
      return raw.isEmpty ? const [] : [Text(raw, style: style)];
    }

    final kinds = <int>[];
    for (final m in matches) {
      final t = m.group(0)!;
      if (_strongMathRe.hasMatch(t)) {
        kinds.add(2);
      } else if (_weakSingleRe.hasMatch(t) ||
          _weakDiffRe.hasMatch(t) ||
          _weakOperatorRe.hasMatch(t) ||
          _weakNumberRe.hasMatch(t) ||
          _weakFuncRe.hasMatch(t)) {
        kinds.add(1);
      } else {
        kinds.add(0);
      }
    }

    final children = <Widget>[];
    int cursor = 0;
    int i = 0;
    while (i < matches.length) {
      if (kinds[i] == 0) {
        int j = i;
        while (j < matches.length && kinds[j] == 0) {
          j++;
        }
        final end = matches[j - 1].end;
        children.add(Text(raw.substring(cursor, end), style: style));
        cursor = end;
        i = j;
      } else {
        int j = i;
        while (j < matches.length && kinds[j] != 0) {
          j++;
        }
        final gap = raw.substring(cursor, matches[i].start);
        if (gap.isNotEmpty) {
          children.add(Text(gap, style: style));
        }
        final segEnd = matches[j - 1].end;
        final seg = raw.substring(matches[i].start, segEnd);
        final hasStrong = kinds.sublist(i, j).contains(2);
        if (hasStrong) {
          children.add(
            Math.tex(
              seg,
              mathStyle: MathStyle.text,
              textStyle: style,
              onErrorFallback: (e) => Text(seg, style: style),
            ),
          );
        } else {
          children.add(Text(seg, style: style));
        }
        cursor = segEnd;
        i = j;
      }
    }
    if (cursor < raw.length) {
      children.add(Text(raw.substring(cursor), style: style));
    }
    return children;
  }

  @override
  Widget build(BuildContext context) {
    final raw = text;
    if (raw == null || raw.isEmpty) return const SizedBox.shrink();
    final baseStyle = style ?? DefaultTextStyle.of(context).style;
    final children = <Widget>[];

    void addPlain(String part) {
      if (part.isNotEmpty) {
        children.addAll(_autoDetect(part, baseStyle));
      }
    }

    final matches = _pattern.allMatches(raw).toList();
    int cursor = 0;
    for (final m in matches) {
      addPlain(raw.substring(cursor, m.start));
      final token = m.group(0)!;
      if (token.startsWith('\$\$') && token.endsWith('\$\$')) {
        final math = token.substring(2, token.length - 2);
        if (math.trim().isEmpty) {
          children.add(Text(token, style: baseStyle));
        } else {
          children.add(
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Math.tex(
                  math,
                  mathStyle: MathStyle.display,
                  textStyle: displayStyle ?? baseStyle.copyWith(fontSize: baseStyle.fontSize ?? 15),
                  onErrorFallback: (e) => Text(math, style: baseStyle),
                ),
              ),
            ),
          );
        }
      } else if (token.startsWith('\$') && token.endsWith('\$')) {
        final math = token.substring(1, token.length - 1);
        if (math.trim().isEmpty) {
          children.add(Text(token, style: baseStyle));
        } else {
          children.add(
            Math.tex(
              math,
              mathStyle: MathStyle.text,
              textStyle: baseStyle,
              onErrorFallback: (e) => Text(math, style: baseStyle),
            ),
          );
        }
      } else {
        children.add(Text(token, style: baseStyle));
      }
      cursor = m.end;
    }
    addPlain(raw.substring(cursor));

    return Text.rich(TextSpan(children: [
      for (final w in children) WidgetSpan(child: w),
    ]));
  }
}

class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.width,
    this.onTap,
    this.color,
    this.borderColor,
    this.borderRadius = AppTheme.radiusLg,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final double? width;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final panel = Container(
      width: width,
      padding: padding ?? const EdgeInsets.all(20),
      margin: margin,
      decoration: BoxDecoration(
        color: color ?? c.panelBg,
        borderRadius: BorderRadius.circular(borderRadius),
        border: Border.all(color: borderColor ?? c.border),
        boxShadow: [
          const BoxShadow(color: Color(0x80020612), blurRadius: 50, offset: Offset(0, 20), spreadRadius: -12),
        ],
      ),
      child: child,
    );
    if (onTap == null) return panel;
    return GestureDetector(onTap: onTap, child: panel);
  }
}

class GradientButton extends StatelessWidget {
  const GradientButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.fullWidth = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 13),
    this.fontSize = 15,
    this.background,
    this.foreground,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool fullWidth;
  final EdgeInsetsGeometry padding;
  final double fontSize;
  final Color? background;
  final Color? foreground;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final enabled = onPressed != null && !loading;
    return Material(
      color: Colors.transparent,
      child: Ink(
        decoration: BoxDecoration(
          gradient: background == null
              ? AppTheme.primaryGradient(c)
              : LinearGradient(colors: [background!, background!]),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          boxShadow: enabled
              ? [BoxShadow(color: c.accentGlow, blurRadius: 22, offset: const Offset(0, 8), spreadRadius: -6)]
              : const [],
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          onTap: enabled ? onPressed : null,
          child: Container(
            padding: padding,
            constraints: fullWidth ? const BoxConstraints(minWidth: double.infinity) : null,
            alignment: Alignment.center,
            child: loading
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: foreground ?? c.accentContrast,
                    ),
                  )
                : Row(
                    mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: 18, color: foreground ?? c.accentContrast),
                        const SizedBox(width: 8),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          style: TextStyle(
                            color: foreground ?? c.accentContrast,
                            fontWeight: FontWeight.w600,
                            fontSize: fontSize,
                            letterSpacing: 0.01,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.fullWidth = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
    this.fontSize = 15,
    this.borderColor,
    this.foreground,
    this.loading = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool fullWidth;
  final EdgeInsetsGeometry padding;
  final double fontSize;
  final Color? borderColor;
  final Color? foreground;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final enabled = onPressed != null && !loading;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        onTap: enabled ? onPressed : null,
        child: Ink(
          decoration: BoxDecoration(
            color: enabled ? c.surface1 : c.surface1.withOpacity(0.4),
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: borderColor ?? c.border),
          ),
          child: Container(
            padding: padding,
            constraints: fullWidth ? const BoxConstraints(minWidth: double.infinity) : null,
            alignment: Alignment.center,
            child: loading
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: c.accent),
                  )
                : Row(
                    mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: 18, color: foreground ?? c.textPrimary),
                        const SizedBox(width: 8),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          style: TextStyle(
                            color: foreground ?? c.textPrimary,
                            fontWeight: FontWeight.w600,
                            fontSize: fontSize,
                          ),
                        ),
                      ),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}

class ErrorBanner extends StatelessWidget {
  const ErrorBanner(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: c.dangerBg,
        border: Border.all(color: c.dangerBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: TextStyle(color: c.dangerText, fontSize: 13.5, height: 1.4),
      ),
    );
  }
}

class SuccessBanner extends StatelessWidget {
  const SuccessBanner(this.message, {super.key});

  final String message;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: c.successBg,
        border: Border.all(color: c.successBorder),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        message,
        style: TextStyle(color: c.successText, fontSize: 13.5, height: 1.4),
      ),
    );
  }
}

class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.color, this.icon});

  final String label;
  final Color? color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final fg = color ?? c.accent;
    final bgColor = color != null ? color!.withOpacity(0.14) : c.accentSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color ?? c.accentBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(color: fg, fontSize: 11.5, fontWeight: FontWeight.w700, letterSpacing: 0.6),
          ),
        ],
      ),
    );
  }
}

class AppTextField extends StatelessWidget {
  const AppTextField({
    super.key,
    required this.label,
    required this.controller,
    this.hint,
    this.obscure = false,
    this.keyboardType,
    this.maxLength,
    this.textCapitalization = TextCapitalization.none,
    this.textInputAction,
    this.enabled = true,
    this.errorText,
    this.onChanged,
    this.onSubmitted,
    this.prefixIcon,
    this.textAlign,
    this.autocorrect = true,
    this.validator,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final bool obscure;
  final TextInputType? keyboardType;
  final int? maxLength;
  final TextCapitalization textCapitalization;
  final TextInputAction? textInputAction;
  final bool enabled;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final IconData? prefixIcon;
  final TextAlign? textAlign;
  final bool autocorrect;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return FormField<String>(
      validator: validator,
      initialValue: controller.text,
      builder: (field) {
        final hasError = field.hasError && field.errorText != null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textSecondary),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: controller,
              enabled: enabled,
              obscureText: obscure,
              keyboardType: keyboardType,
              maxLength: maxLength,
              textCapitalization: textCapitalization,
              textInputAction: textInputAction,
              textAlign: textAlign ?? TextAlign.start,
              autocorrect: autocorrect,
              onChanged: (v) {
                field.didChange(v);
                onChanged?.call(v);
              },
              onSubmitted: onSubmitted,
              decoration: InputDecoration(
                counterText: '',
                hintText: hint,
                prefixIcon: prefixIcon != null ? Icon(prefixIcon, size: 18, color: c.textSecondary) : null,
                errorText: hasError ? field.errorText : errorText,
                errorStyle: TextStyle(color: c.dangerText, fontSize: 12),
              ),
            ),
          ],
        );
      },
    );
  }
}

class LoadingView extends StatelessWidget {
  const LoadingView({super.key, this.message, this.height});

  final String? message;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return SizedBox(
      height: height ?? 200,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(
              width: 34,
              height: 34,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
            if (message != null) ...[
              const SizedBox(height: 16),
              Text(
                message!,
                style: TextStyle(color: c.textSecondary, fontSize: 13, letterSpacing: 0.5),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// The frosted "glass" panel header shown on all authenticated screens.
class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    required this.userName,
    required this.onLogout,
    this.trailing,
    this.showLogout = true,
  });

  final String userName;
  final VoidCallback onLogout;
  final Widget? trailing;
  final bool showLogout;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      child: GlassPanel(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
        borderRadius: AppTheme.radiusMd,
        child: Row(
          children: [
            Container(
              width: 34,
              height: 34,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient(c),
                borderRadius: BorderRadius.circular(10),
                boxShadow: [BoxShadow(color: c.accentGlow, blurRadius: 16, offset: const Offset(0, 6), spreadRadius: -6)],
              ),
              child: const Icon(Icons.school, size: 19, color: Colors.white),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'e-LEARNING',
                    style: TextStyle(
                      color: c.warning,
                      fontSize: 9,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.8,
                    ),
                  ),
                  ShaderMask(
                    shaderCallback: (r) => AppTheme.textGradient(c).createShader(r),
                    child: Text(
                      'Practest',
                      style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                        letterSpacing: 0.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (trailing != null) trailing!,
            if (trailing != null) const SizedBox(width: 10),
            Icon(Icons.person, size: 15, color: c.textSecondary),
            const SizedBox(width: 5),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 110),
              child: Text(
                userName,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: c.textSecondary),
              ),
            ),
            const SizedBox(width: 8),
            if (showLogout)
              InkWell(
                onTap: onLogout,
                borderRadius: BorderRadius.circular(8),
                child: Ink(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                  decoration: BoxDecoration(
                    color: c.surface1,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: c.border),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.logout, size: 13, color: c.textPrimary),
                      const SizedBox(width: 5),
                      Text('Logout', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.textPrimary)),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class MedallionIcon extends StatelessWidget {
  const MedallionIcon({
    super.key,
    required this.icon,
    this.color,
    this.size = 30,
    this.padding = 15,
  });

  final IconData icon;
  final Color? color;
  final double size;
  final double padding;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final fg = color ?? c.accent;
    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        color: color != null ? color!.withOpacity(0.12) : c.accentSoft,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: color ?? c.accentBorder),
      ),
      child: Icon(icon, size: size, color: fg),
    );
  }
}

class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.percent, this.height = 10});

  final int percent;
  final double height;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: Container(
        height: height,
        decoration: BoxDecoration(color: c.surface2, borderRadius: BorderRadius.circular(999)),
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: (percent.clamp(0, 100)) / 100,
          child: Container(
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient(c),
              borderRadius: BorderRadius.circular(999),
            ),
          ),
        ),
      ),
    );
  }
}
