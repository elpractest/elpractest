import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api_client.dart';
import '../models.dart';
import '../routes.dart';
import '../scaffold.dart';
import '../theme.dart';
import '../widgets.dart';

/// SEARCH — functional, ported from the web SPA's `pages/SearchPage.jsx`.
///
/// Pulls the student's assigned test-series and enrolled courses from the
/// existing endpoints and filters them client-side across title / exam category
/// / description. Results link to the real routes. No new backend: it reuses
/// `/student/test-series` and `/student/courses`.
///
/// When the query is empty it shows POPULAR EXAMS chips that seed the query,
/// plus the student's own RECENT searches (persisted locally). Unlike the web,
/// the recent list is real rather than demo — an empty history simply hides the
/// section instead of inventing rows.
class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  static const _popular = [
    'SSC CGL Tier-1',
    'SBI PO Prelims',
    'RRB NTPC',
    'Quant sectional',
    'UPSC CSAT',
    'Free scholarship',
  ];

  final _controller = TextEditingController();
  String _query = '';

  List<TestSeries> _series = const [];
  List<EnrolledCourse> _courses = const [];
  List<String> _recent = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _fetch();
    _RecentSearches.load().then((r) {
      if (mounted) setState(() => _recent = r);
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _fetch() async {
    final series = await _safeFetch('/student/test-series', null);
    final courses = await _safeFetch('/student/courses', 'courses');
    if (!mounted) return;
    setState(() {
      _series = series
          .map((s) => TestSeries.fromJson(s as Map<String, dynamic>))
          .toList();
      _courses = courses
          .map((c) => EnrolledCourse.fromJson(c as Map<String, dynamic>))
          .toList();
      _loading = false;
    });
  }

  Future<List<dynamic>> _safeFetch(String path, String? key) async {
    try {
      return extractList(await ApiClient.instance.get(path), key);
    } catch (_) {
      return const [];
    }
  }

  void _setQuery(String q) {
    _controller.text = q;
    _controller.selection = TextSelection.collapsed(
      offset: _controller.text.length,
    );
    setState(() => _query = q);
  }

  Future<void> _remember(String q) async {
    final trimmed = q.trim();
    if (trimmed.isEmpty) return;
    final next = await _RecentSearches.add(trimmed);
    if (mounted) setState(() => _recent = next);
  }

  bool _matches(String q, List<String?> fields) {
    if (q.isEmpty) return true;
    return fields.any((f) => (f ?? '').toLowerCase().contains(q));
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final q = _query.trim().toLowerCase();

    final seriesHits = _series
        .where((s) => _matches(q, [s.title, s.examCategory, s.description]))
        .toList();
    final courseHits = _courses
        .where(
          (c) => _matches(q, [
            c.title,
            c.examCategory,
            c.shortDescription,
            c.description,
          ]),
        )
        .toList();
    final total = seriesHits.length + courseHits.length;

    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          _SearchBar(
            controller: _controller,
            onChanged: (v) => setState(() => _query = v),
            onClear: () => _setQuery(''),
            onSubmitted: _remember,
          ),
          Expanded(
            child: q.isEmpty
                ? _idleBody(c)
                : _loading
                ? const LoadingView(message: 'Searching...')
                : total == 0
                ? _noMatches(c)
                : _results(c, seriesHits, courseHits),
          ),
        ],
      ),
    );
  }

  Widget _idleBody(AppColors c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 10, 18, 30),
      children: [
        _sectionLabel(c, 'POPULAR EXAMS'),
        const SizedBox(height: 12),
        Wrap(
          spacing: 9,
          runSpacing: 9,
          children: [
            for (final p in _popular)
              _FilterChip(label: p, onTap: () => _setQuery(p)),
          ],
        ),
        if (_recent.isNotEmpty) ...[
          const SizedBox(height: 22),
          _sectionLabel(c, 'RECENT'),
          const SizedBox(height: 4),
          for (final r in _recent)
            InkWell(
              onTap: () => _setQuery(r),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  vertical: 12,
                  horizontal: 4,
                ),
                decoration: BoxDecoration(
                  border: Border(bottom: BorderSide(color: c.border)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.history_rounded, size: 17, color: c.textMuted),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        r,
                        style: AppText.body.copyWith(
                          color: c.textSecondary,
                          fontSize: 13.5,
                        ),
                      ),
                    ),
                    Icon(
                      Icons.north_west_rounded,
                      size: 15,
                      color: c.textMuted,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ],
    );
  }

  Widget _noMatches(AppColors c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 40, 18, 30),
      children: [
        Icon(
          Icons.search_off_rounded,
          size: 34,
          color: c.textMuted.withValues(alpha: 0.7),
        ),
        const SizedBox(height: 12),
        Text(
          'No matches for “$_query”.',
          textAlign: TextAlign.center,
          style: AppText.body.copyWith(color: c.textSecondary),
        ),
      ],
    );
  }

  Widget _results(
    AppColors c,
    List<TestSeries> seriesHits,
    List<EnrolledCourse> courseHits,
  ) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 8, 18, 30),
      children: [
        if (seriesHits.isNotEmpty) ...[
          _sectionLabel(c, 'TESTS'),
          const SizedBox(height: 12),
          for (final s in seriesHits)
            _ResultRow(
              hue: TintHue.gold,
              icon: Icons.track_changes_rounded,
              title: s.title ?? 'Untitled series',
              sub: s.examCategory,
              onTap: () {
                _remember(_query);
                context.openSeries(s.id);
              },
            ),
        ],
        if (courseHits.isNotEmpty) ...[
          const SizedBox(height: 14),
          _sectionLabel(c, 'STUDY'),
          const SizedBox(height: 12),
          for (final course in courseHits)
            _ResultRow(
              hue: TintHue.blue,
              icon: Icons.menu_book_rounded,
              title: course.title ?? 'Untitled course',
              sub: course.examCategory ?? course.shortDescription,
              onTap: () {
                _remember(_query);
                context.openCourse(course.id);
              },
            ),
        ],
      ],
    );
  }

  Widget _sectionLabel(AppColors c, String text) => Text(
    text,
    style: AppText.labelSm.copyWith(color: c.textMuted, letterSpacing: 0.6),
  );
}

class _SearchBar extends StatelessWidget {
  const _SearchBar({
    required this.controller,
    required this.onChanged,
    required this.onClear,
    required this.onSubmitted,
  });

  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;
  final ValueChanged<String> onSubmitted;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 14, 12),
      decoration: BoxDecoration(
        color: c.bg,
        border: Border(bottom: BorderSide(color: c.border)),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.of(context).maybePop(),
            borderRadius: BorderRadius.circular(AppTheme.radiusSm),
            child: SizedBox(
              width: 40,
              height: 40,
              child: Icon(Icons.arrow_back, size: 20, color: c.textSecondary),
            ),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              decoration: BoxDecoration(
                color: c.sunken,
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                border: Border.all(color: c.brandBorder),
              ),
              child: Row(
                children: [
                  Icon(Icons.search_rounded, size: 18, color: c.brand),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: controller,
                      autofocus: true,
                      textInputAction: TextInputAction.search,
                      onChanged: onChanged,
                      onSubmitted: onSubmitted,
                      style: AppText.body.copyWith(
                        color: c.textPrimary,
                        fontSize: 15,
                      ),
                      decoration: InputDecoration(
                        isDense: true,
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: 12,
                        ),
                        hintText: 'Search tests, exams, notes…',
                        hintStyle: AppText.body.copyWith(color: c.textMuted),
                      ),
                    ),
                  ),
                  if (controller.text.isNotEmpty)
                    InkWell(
                      onTap: onClear,
                      borderRadius: BorderRadius.circular(AppTheme.radiusPill),
                      child: Icon(
                        Icons.close_rounded,
                        size: 17,
                        color: c.textMuted,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ResultRow extends StatelessWidget {
  const _ResultRow({
    required this.hue,
    required this.icon,
    required this.title,
    required this.onTap,
    this.sub,
  });

  final TintHue hue;
  final IconData icon;
  final String title;
  final String? sub;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final tc = tint(hue, c.isDark);
    return SurfacePanel(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(13),
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: tc.bg,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: tc.bd),
            ),
            child: Icon(icon, size: 19, color: tc.c),
          ),
          const SizedBox(width: 13),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppText.cardTitleSm.copyWith(
                    color: c.textPrimary,
                    fontSize: 14,
                  ),
                ),
                if (sub != null && sub!.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    sub!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.caption.copyWith(
                      color: c.textSecondary,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Icon(Icons.chevron_right_rounded, size: 18, color: c.textMuted),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppTheme.radiusPill),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: c.panel,
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          border: Border.all(color: c.borderStrong),
        ),
        child: Text(
          label,
          style: AppText.captionStrong.copyWith(
            color: c.textSecondary,
            fontSize: 12.5,
          ),
        ),
      ),
    );
  }
}

/// Locally persisted recent search terms. Newest first, de-duplicated, capped.
class _RecentSearches {
  static const _key = 'practest-recent-searches';
  static const _max = 6;

  static Future<List<String>> load() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList(_key) ?? const [];
  }

  static Future<List<String>> add(String term) async {
    final prefs = await SharedPreferences.getInstance();
    final current = prefs.getStringList(_key) ?? <String>[];
    current.removeWhere((e) => e.toLowerCase() == term.toLowerCase());
    current.insert(0, term);
    final next = current.take(_max).toList();
    await prefs.setStringList(_key, next);
    return next;
  }
}
