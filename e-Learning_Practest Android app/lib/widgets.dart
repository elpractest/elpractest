import 'package:flutter/material.dart';
import 'package:flutter_math_fork/flutter_math.dart';

import 'boards.dart';
import 'theme.dart';

AppColors useColors(BuildContext context) {
  return Theme.of(context).brightness == Brightness.dark
      ? AppColors.dark
      : AppColors.light;
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
        label: Text(label, style: AppText.body.copyWith(color: c.textSecondary)),
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ),
    );
  }
}

/// The mark on its own — mortarboard and pencil-P, no wordmark.
///
/// **Plated on white by default, and that is a deliberate reversal of the rule
/// this comment used to state.** The old rule — never plate a transparent mark
/// onto a white box just to survive a dark screen — was right about the old
/// artwork, which was a near-white silhouette that carried itself against the
/// teal-black ground. It is wrong about this one. The current mark's mortarboard
/// and pencil tip are solid black, so on the guide's #0B0F1A ground they vanish
/// and what is left reads as a broken amber hook. Every surface in the guide
/// draws the mark inside a white rounded tile for exactly this reason, and so
/// does the launcher icon.
///
/// Pass `plated: false` only where the surface behind is already light.
class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 26, this.plated = true, this.radius});

  /// Size of the tile when plated, of the mark itself when not.
  final double size;
  final bool plated;

  /// Corner radius of the plate. Defaults to the guide's own ratio, which is
  /// what makes a 38 dp header tile and a 96 dp splash tile read as the same
  /// shape rather than two different ones.
  final double? radius;

  @override
  Widget build(BuildContext context) {
    // 0.77 and 0.29 are the guide's ratios, consistent across all three of its
    // tile sizes (96/74, 56/42, 38/29).
    final image = Image.asset(
      'assets/brand/practest-mark.png',
      width: plated ? size * 0.77 : size,
      height: plated ? size * 0.77 : size,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
    );

    if (!plated) return image;

    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(radius ?? size * 0.29),
      ),
      child: image,
    );
  }
}

/// The full lockup — the mark beside the "e-Learning Practest" wordmark.
///
/// The knockout variant this used to switch to on dark is gone. It described
/// the old artwork (wordmark #F4F6F7, swoosh #F07830) and has no equivalent
/// here: in the new lockup "Practest" is set in solid black, so there is
/// nothing to knock out of. The guide never puts the lockup on a dark surface
/// either — it uses a plated [BrandMark] beside a live [BrandWordmark]. Where
/// this widget does land on dark it plates itself, for the same reason the mark
/// does.
class BrandLockup extends StatelessWidget {
  const BrandLockup({super.key, this.width = 220});

  final double width;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    // On dark, the derived dark-surface lockup carries itself (black ink lifted
    // to #F3F6FF, navy to #8FB0FF, amber untouched), so the white plate this
    // used to need is gone. On light, the full-colour lockup as supplied.
    return Image.asset(
      dark ? 'assets/brand/practest-logo-dark.png' : 'assets/brand/practest-logo.png',
      width: width,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
    );
  }
}

/// The wordmark set in type, for the places the lockup is too wide to hold its
/// minimum cap height — chiefly the header, beside the mark.
class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.fontSize = 17, this.color});

  final double fontSize;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Text(
      'Practest',
      style: TextStyle(
        fontFamily: AppFont.display,
        fontSize: fontSize,
        fontWeight: FontWeight.w700,
        letterSpacing: -0.2,
        height: 1,
        color: color ?? c.textPrimary,
      ),
    );
  }
}

/// Math renderer replicating the SPA's KaTeX split semantics:
/// `$$...$$` block math, `$...$` inline math, everything else plain text.
/// Additionally, undelimited LaTeX (e.g. `\int \sin^2(x) \cos(x) dx`) is
/// auto-detected so question banks that omit `$...$` still render correctly.
///
/// Carried over from the previous design untouched. Do not refactor during a
/// reskin — the sniffing rules are tuned against the live question bank.
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

/// The one card in the system.
///
/// Solid, never translucent. On light it carries a single soft ambient shadow
/// and no border; on dark it carries a hairline and a one-step surface lift and
/// no shadow. Passing [borderColor] opts into a visible border — used by the
/// resume card, which is the only bordered card on Home.
class SurfacePanel extends StatelessWidget {
  const SurfacePanel({
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

  /// The guide's card radius. Was [AppTheme.radiusMd] (14) under the teal
  /// system; the guide draws its cards at 20, and a 14px card inside a 20/28px
  /// frame is the single most common reason a correctly-coloured screen still
  /// reads as "not the design". [GuideCard] shares this radius.
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final hasBorder = borderColor != null || c.isDark;
    final panel = Container(
      width: width,
      padding: padding ?? const EdgeInsets.all(16),
      margin: margin,
      decoration: BoxDecoration(
        color: color ?? c.panel,
        borderRadius: BorderRadius.circular(borderRadius),
        border: hasBorder ? Border.all(color: borderColor ?? c.border) : null,
        // Never a border and a shadow together.
        boxShadow: hasBorder ? const [] : AppTheme.ambient(c),
      ),
      child: child,
    );
    if (onTap == null) return panel;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(borderRadius),
        child: panel,
      ),
    );
  }
}

/// A study action. Solid brand teal, no gradient, no glow.
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.onPressed,
    this.icon,
    this.fullWidth = false,
    this.padding = const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
    this.fontSize = 14.5,
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
    final bg = background ?? c.brand;
    final fg = foreground ?? c.onBrand;
    return Material(
      color: Colors.transparent,
      child: Ink(
        decoration: BoxDecoration(
          color: enabled ? bg : bg.withValues(alpha: 0.45),
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        ),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppTheme.radiusSm),
          onTap: enabled ? onPressed : null,
          child: Container(
            padding: padding,
            constraints: fullWidth
                ? const BoxConstraints(minWidth: double.infinity, minHeight: 48)
                : const BoxConstraints(minHeight: 44),
            alignment: Alignment.center,
            child: loading
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: fg),
                  )
                : Row(
                    mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: 18, color: fg),
                        const SizedBox(width: 8),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          textAlign: TextAlign.center,
                          style: AppText.button.copyWith(color: fg, fontSize: fontSize),
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
    this.padding = const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
    this.fontSize = 14,
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
    final fg = foreground ?? c.textPrimary;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        onTap: enabled ? onPressed : null,
        child: Ink(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: Border.all(color: borderColor ?? c.borderStrong),
          ),
          child: Container(
            padding: padding,
            constraints: fullWidth
                ? const BoxConstraints(minWidth: double.infinity, minHeight: 44)
                : const BoxConstraints(minHeight: 44),
            alignment: Alignment.center,
            child: loading
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2.5, color: c.brand),
                  )
                : Row(
                    mainAxisSize: fullWidth ? MainAxisSize.max : MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (icon != null) ...[
                        Icon(icon, size: 18, color: fg),
                        const SizedBox(width: 8),
                      ],
                      Flexible(
                        child: Text(
                          label,
                          textAlign: TextAlign.center,
                          style: AppText.button.copyWith(
                              color: fg,
                              fontSize: fontSize,
                              fontWeight: FontWeight.w600),
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.dangerBg,
        border: Border.all(color: c.dangerBorder),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Text(message, style: AppText.body.copyWith(color: c.dangerText)),
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
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: c.successBg,
        border: Border.all(color: c.successBorder),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
      ),
      child: Text(message, style: AppText.body.copyWith(color: c.successText)),
    );
  }
}

/// A pill. Chips and filters only — a status that needs to be *read* uses
/// [TrailingBadge], whose fill carries meaning.
class StatusChip extends StatelessWidget {
  const StatusChip(this.label, {super.key, this.color, this.icon});

  final String label;
  final Color? color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final fg = color ?? c.brandBright;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        border: Border.all(color: fg.withValues(alpha: 0.45)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: fg),
            const SizedBox(width: 5),
          ],
          Text(label, style: AppText.labelSm.copyWith(color: fg)),
        ],
      ),
    );
  }
}

/// The trailing slot of a row, and the one convention that makes a list of
/// them readable without reading: **outlined means a state you own, filled
/// means one you don't**. "96 days" is outlined; "REDEEM" is filled.
class TrailingBadge extends StatelessWidget {
  const TrailingBadge(this.label, {super.key, required this.color, this.filled = false});

  final String label;
  final Color color;
  final bool filled;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6),
      decoration: BoxDecoration(
        color: filled ? color : Colors.transparent,
        borderRadius: BorderRadius.circular(6),
        border: filled ? null : Border.all(color: color.withValues(alpha: 0.55)),
      ),
      child: Text(
        label,
        style: AppText.labelSm.copyWith(
          color: filled ? Colors.white : color,
          letterSpacing: filled ? 0.55 : 0,
          fontWeight: filled ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
    );
  }
}

class AppTextField extends StatefulWidget {
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
  State<AppTextField> createState() => _AppTextFieldState();
}

class _AppTextFieldState extends State<AppTextField> {
  // For obscured (password) fields, this drives the show/hide eye toggle.
  late bool _obscured = widget.obscure;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return FormField<String>(
      validator: widget.validator,
      initialValue: widget.controller.text,
      builder: (field) {
        final hasError = field.hasError && field.errorText != null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.label, style: AppText.captionStrong.copyWith(color: c.textSecondary)),
            const SizedBox(height: 6),
            TextField(
              controller: widget.controller,
              enabled: widget.enabled,
              obscureText: _obscured,
              keyboardType: widget.keyboardType,
              maxLength: widget.maxLength,
              textCapitalization: widget.textCapitalization,
              textInputAction: widget.textInputAction,
              textAlign: widget.textAlign ?? TextAlign.start,
              autocorrect: widget.autocorrect,
              style: AppText.body.copyWith(color: c.textPrimary, fontSize: 15),
              onChanged: (v) {
                field.didChange(v);
                widget.onChanged?.call(v);
              },
              onSubmitted: widget.onSubmitted,
              decoration: InputDecoration(
                counterText: '',
                hintText: widget.hint,
                prefixIcon: widget.prefixIcon != null
                    ? Icon(widget.prefixIcon, size: 18, color: c.textSecondary)
                    : null,
                // Password fields get a tap-to-reveal eye toggle.
                suffixIcon: widget.obscure
                    ? IconButton(
                        splashRadius: 20,
                        icon: Icon(
                          _obscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                          size: 20,
                          color: c.textSecondary,
                        ),
                        tooltip: _obscured ? 'Show password' : 'Hide password',
                        onPressed: widget.enabled
                            ? () => setState(() => _obscured = !_obscured)
                            : null,
                      )
                    : null,
                errorText: hasError ? field.errorText : widget.errorText,
                errorStyle: AppText.caption.copyWith(color: c.dangerText),
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
      height: height ?? 180,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 30,
              height: 30,
              child: CircularProgressIndicator(strokeWidth: 2.6, color: c.brand),
            ),
            if (message != null) ...[
              const SizedBox(height: 14),
              Text(message!, style: AppText.caption.copyWith(color: c.textSecondary)),
            ],
          ],
        ),
      ),
    );
  }
}

/// The header on every authenticated screen.
///
/// The 34dp gradient mortarboard tile it used to open with is retired — the
/// product owns a real mark with a real mortarboard in it. [title] is a real
/// property now: the slot beside the mark used to be hardcoded to the brand
/// name regardless of what screen it sat on.
///
/// Board marks never appear here. They stay subordinate to the product's own.
class AppHeader extends StatelessWidget {
  const AppHeader({
    super.key,
    this.title,
    this.subtitle,
    this.userName,
    this.onLogout,
    this.trailing,
    this.showBack = false,
  });

  /// When null the header shows the brand lockup — correct for a tab root.
  /// When set it shows the screen's own name, which is correct everywhere else.
  final String? title;
  final String? subtitle;
  final String? userName;
  final VoidCallback? onLogout;
  final Widget? trailing;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    // The guide's chrome stays deep in BOTH themes — this is the one surface
    // light mode does not lighten — so the header carries light ink regardless
    // of theme. These are AppColors.dark's own inks, named here so the row does
    // not flip to dark ink on the light palette and vanish into the chrome.
    const headerPrimary = Color(0xFFF3F6FF);
    const headerSecondary = Color(0xFFC7D0E4);
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 12, 12),
      decoration: BoxDecoration(
        // On dark, the chrome fades into the near-black page exactly as the
        // guide draws it; on light it is a solid chrome band so light ink keeps
        // its contrast rather than sitting over the fade's pale end.
        color: c.isDark ? null : c.chrome,
        gradient: c.isDark
            ? LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [c.chrome, c.bg],
              )
            : null,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Row(
        children: [
          if (showBack) ...[
            _IconTap(
              icon: Icons.arrow_back,
              tooltip: 'Back',
              color: headerPrimary,
              onTap: () => Navigator.of(context).maybePop(),
            ),
            const SizedBox(width: 6),
          ] else ...[
            const BrandMark(size: 26),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: title == null
                ? const BrandWordmark(color: headerPrimary)
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        title!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppText.cardTitle.copyWith(color: headerPrimary),
                      ),
                      if (subtitle != null) ...[
                        const SizedBox(height: 3),
                        Text(
                          subtitle!,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppText.caption.copyWith(color: headerSecondary),
                        ),
                      ],
                    ],
                  ),
          ),
          if (trailing != null) ...[const SizedBox(width: 8), trailing!],
          if (userName != null) ...[
            const SizedBox(width: 8),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 110),
              child: Text(
                userName!,
                overflow: TextOverflow.ellipsis,
                style: AppText.caption.copyWith(color: headerSecondary),
              ),
            ),
          ],
          if (onLogout != null) ...[
            const SizedBox(width: 4),
            _IconTap(
              icon: Icons.logout,
              tooltip: 'Log out',
              color: headerSecondary,
              onTap: onLogout!,
            ),
          ],
        ],
      ),
    );
  }
}

class _IconTap extends StatelessWidget {
  const _IconTap({
    required this.icon,
    required this.onTap,
    required this.color,
    required this.tooltip,
  });

  final IconData icon;
  final VoidCallback onTap;
  final Color color;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusPill),
        child: SizedBox(
          width: 40,
          height: 40,
          child: Icon(icon, size: 20, color: color),
        ),
      ),
    );
  }
}

/// Section heading: a 3px accent rule and a 15px semibold word.
///
/// This replaces the all-caps eyebrow at roughly a third of its vertical cost,
/// which is what buys the resume card its place above the fold.
class SectionHeading extends StatelessWidget {
  const SectionHeading(this.label, {super.key, this.accent, this.trailing});

  final String label;
  final Color? accent;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Row(
      children: [
        Container(
          width: 3,
          height: 15,
          decoration: BoxDecoration(
            color: accent ?? c.brand,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 9),
        Expanded(child: Text(label, style: AppText.heading.copyWith(color: c.textPrimary))),
        if (trailing != null) trailing!,
      ],
    );
  }
}

/// One figure and its caption. Each tile in a trio takes its own hue so the
/// three read as three facts rather than as a table.
class StatTile extends StatelessWidget {
  const StatTile({
    super.key,
    required this.value,
    required this.caption,
    required this.color,
    this.onTap,
    this.compact = false,
  });

  final String value;
  final String caption;
  final Color color;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return SurfacePanel(
      onTap: onTap,
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: compact ? 12 : 14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: compact ? CrossAxisAlignment.start : CrossAxisAlignment.center,
        children: [
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: (compact ? AppText.figureSm : AppText.figure).copyWith(color: color),
            ),
          ),
          const SizedBox(height: 7),
          Text(
            caption,
            textAlign: compact ? TextAlign.start : TextAlign.center,
            style: AppText.caption.copyWith(color: c.textSecondary, fontSize: compact ? 11 : 11.5),
          ),
        ],
      ),
    );
  }
}

/// Solid brand fill. The gradient is gone.
class ProgressBar extends StatelessWidget {
  const ProgressBar({super.key, required this.percent, this.height = 8, this.color});

  final int percent;
  final double height;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      child: Container(
        height: height,
        color: c.isDark ? const Color(0x24DFE8EA) : const Color(0x1F304860),
        child: FractionallySizedBox(
          alignment: Alignment.centerLeft,
          widthFactor: (percent.clamp(0, 100)) / 100,
          child: Container(color: color ?? c.brand),
        ),
      ),
    );
  }
}

/// A soft-tinted icon plate. Still used by empty states and the intro, where
/// there is no board and no photograph — but no longer on test rows, where a
/// board chip carries information this cannot.
class MedallionIcon extends StatelessWidget {
  const MedallionIcon({
    super.key,
    required this.icon,
    this.color,
    this.size = 26,
    this.padding = 14,
  });

  final IconData icon;
  final Color? color;
  final double size;
  final double padding;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final fg = color ?? c.brand;
    return Container(
      padding: EdgeInsets.all(padding),
      decoration: BoxDecoration(
        color: fg.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
      ),
      child: Icon(icon, size: size, color: fg),
    );
  }
}

/// An empty state is an explanation, not a shrug. Carried over as a pattern
/// from the previous design, which the audit rated as holding up.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.icon,
    required this.message,
    this.action,
    this.title,
  });

  final IconData icon;
  final String message;
  final String? title;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return SurfacePanel(
      padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 26),
      child: Column(
        children: [
          Icon(icon, size: 30, color: c.textMuted),
          const SizedBox(height: 12),
          if (title != null) ...[
            Text(title!, textAlign: TextAlign.center, style: AppText.cardTitleSm.copyWith(color: c.textPrimary)),
            const SizedBox(height: 6),
          ],
          Text(
            message,
            textAlign: TextAlign.center,
            style: AppText.body.copyWith(color: c.textSecondary),
          ),
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}

/// The 52px row that Profile is built from: icon, label, trailing slot. One
/// geometry carries an entitlement countdown, an activation prompt and an
/// inline setting without any of them needing a screen of their own.
class SettingRow extends StatelessWidget {
  const SettingRow({
    super.key,
    required this.icon,
    required this.label,
    this.trailing,
    this.onTap,
    this.iconColor,
  });

  final IconData icon;
  final String label;
  final Widget? trailing;
  final VoidCallback? onTap;
  final Color? iconColor;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return InkWell(
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Icon(icon, size: 21, color: iconColor ?? c.textSecondary),
            const SizedBox(width: 16),
            Expanded(
              child: Text(
                label,
                style: AppText.body.copyWith(color: c.textPrimary, fontSize: 15),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}

/// A board mark on a paper-white card.
///
/// The card is the unit, not the logo — that is what stops a wide bank lockup
/// and a square commission emblem from looking like a mistake. It stays
/// paper-white in dark as well as light: board marks are full-colour on white
/// by design, and inverting or tinting them is both ugly and legally worse.
///
/// When the licensed artwork is not present the tile sets the board's initials
/// instead. It never shows a broken image box, and it never invents a mark.
class BoardTile extends StatelessWidget {
  const BoardTile({
    super.key,
    required this.board,
    this.onTap,
    this.selected = false,
  });

  final ExamBoard board;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Semantics(
      button: onTap != null,
      selected: selected,
      label: board.label,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        child: Container(
          constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: const Color(0xFFF4F6F7),
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            border: selected ? Border.all(color: c.brand, width: 2) : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // 76% of the tile's inner box, vertically centred.
              Expanded(
                flex: 76,
                child: BoardArtwork(board: board, dense: false),
              ),
              const SizedBox(height: 6),
              Text(
                board.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                // Always present: several board marks are unreadable at tile
                // size, and a mark nobody can read is not a label.
                style: const TextStyle(
                  fontFamily: AppFont.ui,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w600,
                  height: 1,
                  color: Color(0xFF1F3A44),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The 34dp version that sits at a test row's leading edge, telling the student
/// which exam the row belongs to before they read a word of it.
class BoardChip extends StatelessWidget {
  const BoardChip({super.key, required this.board, this.size = 34});

  final ExamBoard board;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F6F7),
        borderRadius: BorderRadius.circular(8),
      ),
      child: BoardArtwork(board: board, dense: true),
    );
  }
}

/// The mark itself, or its initials when the licensed file is not bundled.
class BoardArtwork extends StatelessWidget {
  const BoardArtwork({super.key, required this.board, required this.dense});

  final ExamBoard board;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      board.assetPath,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
      errorBuilder: (context, _, __) => Center(
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            board.initials,
            style: TextStyle(
              fontFamily: AppFont.display,
              fontSize: dense ? 13 : 17,
              fontWeight: FontWeight.w700,
              height: 1,
              letterSpacing: -0.3,
              color: const Color(0xFF187890),
            ),
          ),
        ),
      ),
    );
  }
}

/// A 16:9 cover at the head of a course card.
///
/// When the course has no cover the fallback is the course's own initials set
/// on the panel — never a broken image box, and never a stock photograph of
/// books.
class CourseCover extends StatelessWidget {
  const CourseCover({super.key, required this.title, this.url, this.height = 104});

  final String title;
  final String? url;
  final double height;

  String get _initials {
    final words = title.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty).toList();
    if (words.isEmpty) return '—';
    if (words.length == 1) {
      return words.first.substring(0, words.first.length.clamp(0, 2)).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final fallback = Container(
      height: height,
      width: double.infinity,
      color: c.isDark ? c.raised : c.sunken,
      alignment: Alignment.center,
      child: Text(
        _initials,
        style: AppText.score.copyWith(
          color: c.textPrimary.withValues(alpha: 0.5),
          fontFamily: AppFont.display,
        ),
      ),
    );

    final src = url;
    if (src == null || src.isEmpty) return fallback;
    return Image.network(
      src,
      height: height,
      width: double.infinity,
      fit: BoxFit.cover,
      errorBuilder: (context, _, __) => fallback,
      loadingBuilder: (context, child, progress) =>
          progress == null ? child : SizedBox(height: height, child: fallback),
    );
  }
}
