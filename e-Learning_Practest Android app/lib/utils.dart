import 'package:intl/intl.dart';

/// ₹ formatted with Indian digit grouping (e.g. ₹1,299 / ₹1,29,999).
String formatRupees(dynamic paise) {
  if (paise == null) return 'Free';
  final value = (num.tryParse('$paise') ?? 0) / 100;
  final f = NumberFormat.currency(
    locale: 'en_IN',
    symbol: '₹',
    decimalDigits: 0,
  );
  return f.format(value);
}

String formatSecondsClock(dynamic secs) {
  if (secs == null) return '00:00';
  final total = (num.tryParse('$secs') ?? 0).round();
  final hours = total ~/ 3600;
  final minutes = (total % 3600) ~/ 60;
  final seconds = total % 60;
  final parts = <String>[
    if (hours > 0) hours.toString().padLeft(2, '0'),
    minutes.toString().padLeft(2, '0'),
    seconds.toString().padLeft(2, '0'),
  ];
  return parts.join(':');
}

String formatDurationMinutes(dynamic secs) {
  final total = (num.tryParse('$secs') ?? 0).round();
  final minutes = total ~/ 60;
  final rem = total % 60;
  return rem > 0 ? '$minutes mins ${rem}s' : '$minutes mins';
}

String formatWatched(dynamic secs) {
  final total = (num.tryParse('$secs') ?? 0).round();
  return '${total ~/ 60}m';
}

String formatDateTime(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  final f = DateFormat('dd MMM yyyy, hh:mm a');
  return f.format(dt);
}

String formatDate(String? iso) {
  if (iso == null || iso.isEmpty) return '';
  final dt = DateTime.tryParse(iso)?.toLocal();
  if (dt == null) return iso;
  return DateFormat('dd MMM yyyy').format(dt);
}

String formatNumber(num? value) {
  if (value == null) return '0';
  if (value == value.roundToDouble()) return value.round().toString();
  return value.toStringAsFixed(2);
}
