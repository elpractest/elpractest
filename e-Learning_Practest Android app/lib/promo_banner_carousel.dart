import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'models.dart';
import 'theme.dart';

/// The Home promo carousel — the Flutter counterpart of the web `BannerCarousel`
/// (Phase 4). Renders the super-admin-managed banners from `/banners/public`.
///
/// Self-contained: takes its [banners] and the resolved [colors] so it needs no
/// dependency on widgets.dart (avoids an import cycle). Renders nothing when the
/// list is empty, exactly like the web version, so Home is unchanged until a
/// super-admin publishes a banner.
class PromoBannerCarousel extends StatefulWidget {
  const PromoBannerCarousel({super.key, required this.banners, required this.colors});

  final List<PromoBanner> banners;
  final AppColors colors;

  @override
  State<PromoBannerCarousel> createState() => _PromoBannerCarouselState();
}

class _PromoBannerCarouselState extends State<PromoBannerCarousel> {
  static const double _height = 168;
  final PageController _controller = PageController(viewportFraction: 0.92);
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Open a banner's CTA. Only absolute http(s) links are followed — a relative
  /// or malformed value is ignored rather than crashing the tap.
  Future<void> _open(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null || (uri.scheme != 'http' && uri.scheme != 'https')) return;
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final banners = widget.banners;
    if (banners.isEmpty) return const SizedBox.shrink();

    return Column(
      children: [
        SizedBox(
          height: _height,
          child: PageView.builder(
            controller: _controller,
            itemCount: banners.length,
            onPageChanged: (i) => setState(() => _page = i),
            padEnds: banners.length > 1,
            itemBuilder: (context, i) => Padding(
              padding: EdgeInsets.symmetric(horizontal: banners.length > 1 ? 5 : 0),
              child: _card(banners[i]),
            ),
          ),
        ),
        if (banners.length > 1) ...[
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(banners.length, (i) {
              final active = i == _page;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: active ? 18 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color: active ? widget.colors.brand : widget.colors.border,
                  borderRadius: BorderRadius.circular(3),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }

  Widget _card(PromoBanner b) {
    final c = widget.colors;

    final gradient = Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [c.brand, c.brandDeep],
        ),
      ),
    );

    Widget background = gradient;
    final img = b.imageUrl;
    if (img != null && img.isNotEmpty) {
      background = Image.network(
        img,
        fit: BoxFit.cover,
        width: double.infinity,
        height: _height,
        errorBuilder: (context, _, __) => gradient,
        loadingBuilder: (context, child, progress) => progress == null ? child : gradient,
      );
    }

    return GestureDetector(
      onTap: () => _open(b.ctaUrl),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Stack(
          fit: StackFit.expand,
          children: [
            background,
            // Scrim so light text stays legible over any image.
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: [Colors.black.withValues(alpha: 0.55), Colors.black.withValues(alpha: 0.15)],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (b.kicker != null && b.kicker!.isNotEmpty)
                    Text(
                      b.kicker!.toUpperCase(),
                      style: AppText.labelSm.copyWith(
                        color: Colors.white.withValues(alpha: 0.85),
                        letterSpacing: 0.8,
                      ),
                    ),
                  if (b.title != null && b.title!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      b.title!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.cardTitle.copyWith(color: Colors.white, fontFamily: AppFont.display),
                    ),
                  ],
                  if (b.subtitle != null && b.subtitle!.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      b.subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.body.copyWith(color: Colors.white.withValues(alpha: 0.9)),
                    ),
                  ],
                  if (b.ctaLabel != null && b.ctaLabel!.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Text(
                        b.ctaLabel!,
                        style: AppText.label.copyWith(color: c.brandDeep, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
