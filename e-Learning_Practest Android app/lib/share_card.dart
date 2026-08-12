import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import 'models.dart';
import 'theme.dart';
import 'utils.dart';
import 'widgets.dart';

/// The card students actually share.
///
/// Aspirants already post their scores — as badly cropped screenshots with the
/// brand cut off. A Share button turns that into distribution.
///
/// Painted onto a canvas rather than captured from the widget tree: the asset
/// has to be exactly 1080×1350 at a fixed layout regardless of the phone it was
/// made on, and every glyph has to survive WhatsApp's recompression. Type is
/// baked, and no figure is smaller than 40px.
///
/// **Rank is opt-in per share.** Percentile and accuracy are safe defaults; a
/// rank is a public statement about where someone placed among named peers and
/// is not something to publish on their behalf. Nothing on this card is
/// invented — a figure the API did not return is simply not drawn.
const Size _cardSize = Size(1080, 1350);

const _ground = Color(0xFF0B1B21);
const _panel = Color(0xFF122B33);
const _ink = Color(0xFFF4F6F7);
const _muted = Color(0xFF93A7AE);
const _faint = Color(0xFF7D939B);
const _teal = Color(0xFF00B4B4);
const _gold = Color(0xFFF0A818);

/// Ask what to include, then render and hand off to the system share sheet.
Future<void> showResultShareSheet(
  BuildContext context, {
  required int sessionId,
  required TestResultData data,
  String? testTitle,
}) async {
  final hasRank = data.rank != null;
  var includeRank = false;

  final confirmed = await showModalBottomSheet<bool>(
    context: context,
    builder: (sheetCtx) {
      final c = useColors(sheetCtx);
      return StatefulBuilder(
        builder: (ctx, setSheetState) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Share your result',
                    style: AppText.cardTitle.copyWith(color: c.textPrimary)),
                const SizedBox(height: 6),
                Text(
                  'Your score, accuracy'
                  '${data.percentile != null ? ' and percentile' : ''} '
                  'will be on the card.',
                  style: AppText.body.copyWith(color: c.textSecondary),
                ),
                if (hasRank) ...[
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    value: includeRank,
                    onChanged: (v) => setSheetState(() => includeRank = v ?? false),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    activeColor: c.brand,
                    title: Text('Include my rank (#${formatNumber(data.rank)})',
                        style: AppText.body.copyWith(color: c.textPrimary)),
                  ),
                ],
                const SizedBox(height: 12),
                PrimaryButton(
                  label: 'Share',
                  icon: Icons.ios_share,
                  fullWidth: true,
                  onPressed: () => Navigator.of(ctx).pop(true),
                ),
              ],
            ),
          ),
        ),
      );
    },
  );

  if (confirmed != true) return;

  final file = await renderResultCard(
    data: data,
    testTitle: testTitle,
    includeRank: includeRank,
  );
  if (file == null) return;

  await SharePlus.instance.share(
    ShareParams(
      files: [XFile(file.path, mimeType: 'image/png')],
      text: 'My mock test result on Practest — practest.live',
    ),
  );
}

/// Paint the card and write it to a temporary file. Returns null if the image
/// could not be encoded, in which case the caller simply does not share.
Future<File?> renderResultCard({
  required TestResultData data,
  String? testTitle,
  bool includeRank = false,
}) async {
  final recorder = ui.PictureRecorder();
  final canvas = Canvas(recorder, Offset.zero & _cardSize);
  _paint(canvas, data, testTitle, includeRank);

  final image = await recorder
      .endRecording()
      .toImage(_cardSize.width.round(), _cardSize.height.round());
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  if (bytes == null) return null;

  final dir = await getTemporaryDirectory();
  final file = File('${dir.path}/practest-result.png');
  await file.writeAsBytes(bytes.buffer.asUint8List(), flush: true);
  return file;
}

void _paint(Canvas canvas, TestResultData data, String? title, bool includeRank) {
  canvas.drawRect(Offset.zero & _cardSize, Paint()..color = _ground);

  const margin = 84.0;
  const width = 1080 - margin * 2;
  var y = 132.0;

  // Eyebrow. The test's own name when we have it; never an invented one.
  y += _text(
    canvas,
    (title ?? 'Mock test result').toUpperCase(),
    left: margin,
    top: y,
    maxWidth: width,
    style: const TextStyle(
      fontFamily: AppFont.ui,
      fontSize: 34,
      fontWeight: FontWeight.w700,
      letterSpacing: 3,
      height: 1.3,
      color: _muted,
    ),
    maxLines: 2,
  );

  y += 46;

  // The figure. Tabular by construction, and far above the 40px floor.
  final scoreText = formatNumber(data.analytic.totalScore ?? 0);
  final scoreHeight = _text(
    canvas,
    scoreText,
    left: margin,
    top: y,
    maxWidth: width,
    style: const TextStyle(
      fontFamily: AppFont.mono,
      fontSize: 210,
      fontWeight: FontWeight.w800,
      height: 1,
      color: _ink,
    ),
  );
  final scoreWidth = _measure(
    scoreText,
    const TextStyle(
        fontFamily: AppFont.mono, fontSize: 210, fontWeight: FontWeight.w800, height: 1),
  );
  _text(
    canvas,
    '/ ${formatNumber(data.analytic.maxScore ?? 0)}',
    left: margin + scoreWidth + 22,
    top: y + scoreHeight - 62,
    maxWidth: width,
    style: const TextStyle(
      fontFamily: AppFont.ui,
      fontSize: 46,
      fontWeight: FontWeight.w400,
      height: 1,
      color: _muted,
    ),
  );

  y += scoreHeight + 66;

  // Tiles: only figures the payload actually carried.
  final tiles = <({String value, String caption, Color color})>[
    if (data.analytic.accuracyPercentage != null)
      (
        value: '${data.analytic.accuracyPercentage!.round()}%',
        caption: 'accuracy',
        color: _teal
      ),
    if (data.percentile != null)
      (value: formatNumber(data.percentile), caption: 'percentile', color: _gold),
    if (includeRank && data.rank != null)
      (value: '#${formatNumber(data.rank)}', caption: 'rank', color: _gold),
  ];

  if (tiles.isNotEmpty) {
    const gap = 24.0;
    final tileWidth = (width - gap * (tiles.length - 1)) / tiles.length;
    const tileHeight = 210.0;
    for (var i = 0; i < tiles.length; i++) {
      final left = margin + i * (tileWidth + gap);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(left, y, tileWidth, tileHeight),
          const Radius.circular(22),
        ),
        Paint()..color = _panel,
      );
      _text(
        canvas,
        tiles[i].value,
        left: left + 28,
        top: y + 46,
        maxWidth: tileWidth - 56,
        style: TextStyle(
          fontFamily: AppFont.mono,
          fontSize: 72,
          fontWeight: FontWeight.w800,
          height: 1,
          color: tiles[i].color,
        ),
      );
      _text(
        canvas,
        tiles[i].caption,
        left: left + 28,
        top: y + 138,
        maxWidth: tileWidth - 56,
        style: const TextStyle(
          fontFamily: AppFont.ui,
          fontSize: 32,
          fontWeight: FontWeight.w400,
          height: 1,
          color: _muted,
        ),
      );
    }
    y += tileHeight;
  }

  // Attempt shape, stated rather than illustrated — no invented badges, no
  // fake timers, no stock imagery.
  final a = data.analytic;
  y += 56;
  _text(
    canvas,
    '${a.correctCount ?? 0} correct   ·   ${a.incorrectCount ?? 0} wrong   ·   '
    '${a.unansweredCount ?? 0} skipped',
    left: margin,
    top: y,
    maxWidth: width,
    style: const TextStyle(
      fontFamily: AppFont.ui,
      fontSize: 36,
      fontWeight: FontWeight.w500,
      height: 1.4,
      color: _ink,
    ),
  );

  // Footer, pinned rather than flowed, so the brand is in the same place on
  // every card a student posts.
  const footerY = 1350.0 - 132.0;
  canvas.drawRect(
    Rect.fromLTWH(margin, footerY - 44, width, 2),
    Paint()..color = const Color(0x24DFE8EA),
  );
  _text(
    canvas,
    'Practest',
    left: margin,
    top: footerY,
    maxWidth: width,
    style: const TextStyle(
      fontFamily: AppFont.display,
      fontSize: 44,
      fontWeight: FontWeight.w700,
      height: 1,
      color: _ink,
    ),
  );
  final host = 'practest.live';
  final hostWidth = _measure(
    host,
    const TextStyle(fontFamily: AppFont.mono, fontSize: 30, height: 1),
  );
  _text(
    canvas,
    host,
    left: 1080 - margin - hostWidth,
    top: footerY + 10,
    maxWidth: width,
    style: const TextStyle(
      fontFamily: AppFont.mono,
      fontSize: 30,
      fontWeight: FontWeight.w400,
      height: 1,
      color: _faint,
    ),
  );
}

/// Draws [text] and returns the height it occupied.
double _text(
  Canvas canvas,
  String text, {
  required double left,
  required double top,
  required double maxWidth,
  required TextStyle style,
  int maxLines = 1,
}) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
    maxLines: maxLines,
    ellipsis: '…',
  )..layout(maxWidth: maxWidth);
  painter.paint(canvas, Offset(left, top));
  final height = painter.height;
  painter.dispose();
  return height;
}

double _measure(String text, TextStyle style) {
  final painter = TextPainter(
    text: TextSpan(text: text, style: style),
    textDirection: TextDirection.ltr,
  )..layout();
  final width = painter.width;
  painter.dispose();
  return width;
}
