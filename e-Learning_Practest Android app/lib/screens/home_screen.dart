import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_client.dart';
import '../boards.dart';
import '../build_config.dart';
import '../models.dart';
import '../promo_banner_carousel.dart';
import '../resume_memory.dart';
import '../routes.dart';
import '../scaffold.dart';
import '../session.dart';
import '../shell.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';
import 'activation_modal.dart';
import 'student_checkout.dart';

/// Home.
///
/// A returning student has exactly one question — *where was I?* — and the old
/// dashboard answered it nowhere: it opened with the words "Student Dashboard"
/// and a list of courses. The order here is the answer to that question first,
/// an opinion second, and the catalogue last.
///
/// The one rule this screen is built around: **never show a number without a
/// verdict attached**, and compute every figure from one source and one window.
/// A dashboard that contradicts itself loses the credibility of every number
/// on it.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HomeSummary _summary = const HomeSummary();
  List<ActivationRequest> _activationRequests = [];
  List<TestSummary> _tests = [];
  List<PromoBanner> _banners = [];
  bool _loading = true;
  String _error = '';
  String? _boardFilter;

  // Payment toggle state.
  bool _paymentGatewayEnabled = false;
  List<PublicCourse> _purchasable = [];
  bool _loadingPurchasable = false;

  @override
  void initState() {
    super.initState();
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    await Future.wait([
      _fetchSummary(),
      _fetchTests(),
      _fetchActivationRequests(),
      _fetchSettings(),
      _fetchBanners(),
    ]);
  }

  /// Super-admin-managed Home promo banners (Phase 4/6). A 404 or any error is
  /// swallowed — banners are decorative, never load-bearing, so a stale or
  /// undeployed endpoint must not touch the rest of Home.
  Future<void> _fetchBanners() async {
    try {
      final data = await ApiClient.instance.get('/banners/public');
      final list = extractList(data)
          .map((b) => PromoBanner.fromJson(b as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() => _banners = list);
    } catch (_) {}
  }

  /// One request for the whole screen, with a documented fallback.
  ///
  /// A 404 here means the app has shipped ahead of the API. That is a normal
  /// state during a rollout, not an error, so the older endpoints are used
  /// instead and every block the older data cannot honestly fill is dropped
  /// rather than filled with a guess.
  Future<void> _fetchSummary() async {
    if (mounted) setState(() => _loading = true);
    try {
      final data = await ApiClient.instance.get('/student/home-summary');
      if (!mounted) return;
      setState(() {
        _summary = HomeSummary.fromJson(data);
        _loading = false;
        _error = '';
      });
      final active = _summary.activeSession;
      if (active != null) {
        await ResumeMemory.remember(active.id);
      } else {
        await ResumeMemory.forget();
      }
    } on ApiException catch (e) {
      if (e.statusCode == 404 || e.statusCode == 405) {
        await _fetchSummaryDegraded();
      } else {
        if (!mounted) return;
        setState(() {
          _error = 'Could not load your dashboard. Pull down to retry.';
          _loading = false;
        });
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not load your dashboard. Pull down to retry.';
        _loading = false;
      });
    }
  }

  /// Assemble as much of the summary as the pre-existing endpoints can honestly
  /// support: the catalogue, the week's figures from the results history over
  /// the same seven-day window, and the active session confirmed against the
  /// server from a locally remembered id.
  ///
  /// The weakest-topic verdict is not assembled here. Per-topic accuracy is not
  /// in any of these payloads, and a verdict computed from data that does not
  /// exist is exactly the failure mode this redesign exists to remove.
  Future<void> _fetchSummaryDegraded() async {
    List<CourseProgress> courses = const [];
    WeekStats week = const WeekStats();

    try {
      final data = await ApiClient.instance.get('/student/courses');
      courses = extractList(data, 'courses')
          .map((c) => CourseProgress.fromEnrolled(
              EnrolledCourse.fromJson(c as Map<String, dynamic>)))
          .toList();
    } catch (_) {}

    try {
      final data = await ApiClient.instance.get('/student/results');
      final results = extractList(data, 'results')
          .map((r) => ResultSummary.fromJson(r as Map<String, dynamic>))
          .toList();
      week = _weekFromResults(results);
    } catch (_) {}

    final active = await _confirmRememberedSession();

    if (!mounted) return;
    setState(() {
      _summary = HomeSummary(
        activeSession: active,
        week: week,
        courses: courses,
        boardCategories: courses.map((c) => c.examCategory).nonNulls.toList(),
        degraded: true,
      );
      _loading = false;
      _error = '';
    });
  }

  /// The same seven-day window the server uses, and accuracy weighted the same
  /// way — by questions attempted, not averaged per session — so the figure
  /// does not change meaning when the API catches up.
  WeekStats _weekFromResults(List<ResultSummary> results) {
    final cutoff = DateTime.now().subtract(const Duration(days: 7));
    var tests = 0;
    var time = 0;
    num weighted = 0;
    num weight = 0;
    for (final r in results) {
      final at = DateTime.tryParse(r.submittedAt ?? '')?.toLocal();
      if (at == null || at.isBefore(cutoff)) continue;
      tests++;
      time += (r.timeTakenSeconds ?? 0).round();
      final acc = r.accuracyPercentage;
      // Without a per-session attempt count the only honest weight available
      // is the paper's size, which is a better proxy than an equal weight.
      final size = (r.totalMarks ?? 0).toDouble();
      if (acc != null && size > 0) {
        weighted += acc * size;
        weight += size;
      }
    }
    return WeekStats(
      tests: tests,
      accuracy: weight > 0 ? (weighted / weight) : null,
      timeSeconds: time,
    );
  }

  /// Confirm a remembered session id against the server before trusting it.
  /// A 409 means it was already submitted; anything else means there is nothing
  /// to resume. Either way the memory is cleared.
  Future<ActiveSession?> _confirmRememberedSession() async {
    final id = await ResumeMemory.read();
    if (id == null) return null;
    try {
      final data = await ApiClient.instance.get('/student/tests/sessions/$id');
      final state = SessionState.fromJson(data['session'] as Map<String, dynamic>);
      final sections = (data['sections'] as List?) ?? const [];
      final answers = (data['answers'] as List?) ?? const [];
      final questionCount = sections.fold<int>(
          0, (sum, s) => sum + (((s as Map)['questions'] as List?)?.length ?? 0));
      final answered = answers
          .where((a) => (a as Map)['selected_option_id'] != null)
          .length;
      final section = state.currentSectionIndex < sections.length
          ? sections[state.currentSectionIndex] as Map
          : null;
      return ActiveSession(
        id: state.id,
        testId: state.testId,
        testTitle: state.testTitle,
        timeRemainingSeconds: state.timeRemainingSeconds,
        sectionTimeRemainingSeconds: state.sectionTimeRemainingSeconds,
        currentSectionIndex: state.currentSectionIndex,
        sectionCount: sections.length,
        sectionTitle: section?['title'] as String?,
        answeredCount: answered,
        questionCount: questionCount,
      );
    } catch (_) {
      await ResumeMemory.forget();
      return null;
    }
  }

  Future<void> _fetchTests() async {
    try {
      final data = await ApiClient.instance.get('/student/tests');
      final list = extractList(data, 'tests')
          .map((t) => TestSummary.fromJson(t as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() => _tests = list);
    } catch (_) {}
  }

  Future<void> _fetchActivationRequests() async {
    try {
      final data = await ApiClient.instance.get('/student/activation-requests');
      final list = extractList(data, 'requests')
          .map((r) => ActivationRequest.fromJson(r as Map<String, dynamic>))
          .toList();
      if (mounted) setState(() => _activationRequests = list);
    } catch (_) {}
  }

  Future<void> _fetchSettings() async {
    try {
      final data = await ApiClient.instance.get('/settings/public');
      final settings = PublicSettings.fromJson(data['settings'] as Map<String, dynamic>?);
      if (!mounted) return;
      // The server toggle can only ever turn buying OFF here, never on: a Play
      // build must not sell digital content outside Play Billing. See
      // [enableInAppPurchase].
      final canBuy = enableInAppPurchase && settings.paymentGatewayEnabled;
      setState(() => _paymentGatewayEnabled = canBuy);
      if (canBuy) _fetchPurchasable();
    } catch (_) {}
  }

  Future<void> _fetchPurchasable() async {
    setState(() => _loadingPurchasable = true);
    try {
      final data = await ApiClient.instance.get('/student/purchasable-courses');
      final list = extractList(data, 'courses')
          .map((c) => PublicCourse.fromJson(c as Map<String, dynamic>))
          .toList();
      if (!mounted) return;
      setState(() {
        _purchasable = list;
        _loadingPurchasable = false;
      });
    } catch (_) {
      if (mounted) setState(() => _loadingPurchasable = false);
    }
  }

  /// Resuming and starting are the same call: `POST /tests/{id}/start` returns
  /// the in-progress session when one exists rather than creating a second.
  Future<void> _startTest(int testId) async {
    setState(() => _error = '');
    try {
      final data = await ApiClient.instance.post('/student/tests/$testId/start');
      final session = SessionState.fromJson(data['session'] as Map<String, dynamic>);
      await ResumeMemory.remember(session.id);
      if (!mounted) return;
      await context.openTest(session.id);
      if (mounted) _fetchAll();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() =>
          _error = e.message.isEmpty ? 'Could not start the test session.' : e.message);
    }
  }

  Future<void> _resume(ActiveSession active) async {
    await context.openTest(active.id);
    if (mounted) _fetchAll();
  }

  void _handleEnrolled() {
    _fetchAll();
  }

  /// The next paper the student has not attempted, named so the empty resume
  /// card can point at something specific instead of at the catalogue.
  TestSummary? get _nextTest {
    final unattempted = _tests.where((t) => t.sessionsCount == 0).toList();
    if (unattempted.isNotEmpty) return unattempted.first;
    return _tests.isEmpty ? null : _tests.first;
  }

  List<ExamBoard> get _boards {
    // Built from tests the student can actually open, falling back to the
    // categories the summary reported. Never from the registry.
    final fromTests = _tests.map((t) => t.category);
    final rail = BoardCatalog.railFrom([...fromTests, ..._summary.boardCategories]);
    return rail;
  }

  List<TestSummary> get _filteredTests {
    if (_boardFilter == null) return _tests;
    return _tests
        .where((t) => BoardCatalog.resolve(t.category)?.key == _boardFilter)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final session = context.watch<Session>();
    final user = session.user;

    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          AppHeader(userName: user?.name),
          Expanded(
            child: RefreshIndicator(
              color: c.brand,
              onRefresh: _fetchAll,
              child: _loading
                  ? ListView(children: const [
                      SizedBox(height: 80),
                      LoadingView(message: 'Loading your dashboard…'),
                    ])
                  : ListView(
                      padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
                      children: [
                        if (_banners.isNotEmpty) ...[
                          PromoBannerCarousel(banners: _banners, colors: c),
                          const SizedBox(height: 22),
                        ],
                        if (_error.isNotEmpty) ...[
                          ErrorBanner(_error),
                          const SizedBox(height: 16),
                        ],
                        _resumeCard(c),
                        const SizedBox(height: 20),
                        _thisWeek(c),
                        if (_summary.weakestTopic != null) ...[
                          const SizedBox(height: 12),
                          _weakestTopicCard(c, _summary.weakestTopic!),
                        ],
                        if (_boards.isNotEmpty) ...[
                          const SizedBox(height: 22),
                          _boardRail(c),
                        ],
                        if (_activationRequests.isNotEmpty) ...[
                          const SizedBox(height: 22),
                          _activationSection(c),
                        ],
                        const SizedBox(height: 22),
                        _coursesSection(c),
                        if (_filteredTests.isNotEmpty) ...[
                          const SizedBox(height: 22),
                          _testsSection(c),
                        ],
                        if (enableInAppPurchase &&
                            _paymentGatewayEnabled &&
                            _purchasable.isNotEmpty) ...[
                          const SizedBox(height: 22),
                          _purchasableSection(c),
                        ],
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Resume ────────────────────────────────────────────────────────────────

  /// The first 200px of the screen. The countdown is orange because an
  /// unfinished timed paper is a deadline, not a study action — and it is the
  /// only bordered card on Home, which is how it reads as the one live thing.
  Widget _resumeCard(AppColors c) {
    final active = _summary.activeSession;
    if (active == null) return _startCard(c);

    final answered = active.questionCount > 0
        ? '${active.answeredCount} of ${active.questionCount} answered'
        : '${active.answeredCount} answered';
    final section = active.sectionCount > 0
        ? ' · Section ${active.currentSectionIndex + 1} of ${active.sectionCount}'
        : '';

    return SurfacePanel(
      borderColor: c.brandBorder,
      borderRadius: AppTheme.radiusLg,
      padding: const EdgeInsets.fromLTRB(15, 16, 15, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3,
                height: 15,
                decoration: BoxDecoration(
                  color: c.orange,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 9),
              Flexible(
                child: Text(
                  active.timeRemainingSeconds != null
                      ? 'RESUME · ${formatSecondsClock(active.timeRemainingSeconds)} LEFT'
                      : 'RESUME',
                  style: AppText.labelSm.copyWith(color: c.orange),
                ),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Text(
            active.testTitle ?? 'Your test',
            style: AppText.cardTitle.copyWith(color: c.textPrimary, fontSize: 18),
          ),
          const SizedBox(height: 8),
          Text('$answered$section',
              style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 12.5)),
          const SizedBox(height: 11),
          ProgressBar(percent: active.progressPercent),
          const SizedBox(height: 13),
          PrimaryButton(
            label: 'Continue test',
            fullWidth: true,
            onPressed: () => _resume(active),
          ),
        ],
      ),
    );
  }

  /// No active session. Not an empty card — the next assigned paper is named,
  /// so the student still leaves this screen with somewhere to go.
  Widget _startCard(AppColors c) {
    final next = _nextTest;
    return SurfacePanel(
      borderColor: c.brandBorder,
      borderRadius: AppTheme.radiusLg,
      padding: const EdgeInsets.fromLTRB(15, 16, 15, 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 3,
                height: 15,
                decoration:
                    BoxDecoration(color: c.brand, borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(width: 9),
              Text(
                next == null ? 'NOTHING IN PROGRESS' : 'START YOUR NEXT MOCK',
                style: AppText.labelSm.copyWith(color: c.brandBright),
              ),
            ],
          ),
          const SizedBox(height: 11),
          Text(
            next?.title ?? 'No test is assigned to you yet',
            style: AppText.cardTitle.copyWith(color: c.textPrimary, fontSize: 18),
          ),
          const SizedBox(height: 8),
          Text(
            next == null
                ? 'Activate a course or redeem a code, and your papers appear here.'
                : '${(next.durationSeconds ?? 0) ~/ 60} min'
                    '${next.totalMarks != null ? ' · ${formatNumber(next.totalMarks)} marks' : ''}',
            style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 12.5),
          ),
          const SizedBox(height: 14),
          if (next == null)
            SecondaryButton(
              label: 'Activate a course',
              icon: Icons.vpn_key_outlined,
              fullWidth: true,
              onPressed: () => showActivationModal(context, onSuccess: _handleEnrolled),
            )
          else
            PrimaryButton(
              label: 'Start test',
              fullWidth: true,
              onPressed: () => _startTest(next.id),
            ),
        ],
      ),
    );
  }

  // ── This week ─────────────────────────────────────────────────────────────

  Widget _thisWeek(AppColors c) {
    final week = _summary.week;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeading('This week'),
        const SizedBox(height: 11),
        // Zero attempts collapses to one line rather than showing 0% against
        // three empty tracks — a dashboard of zeroes reads as a broken app.
        if (week.isEmpty)
          SurfacePanel(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 16),
            child: Text(
              'No tests taken in the last ${_summary.windowDays} days. Your accuracy '
              'and time show up here after your first paper.',
              style: AppText.body.copyWith(color: c.textSecondary),
            ),
          )
        else
          Row(
            children: [
              Expanded(
                child: StatTile(
                  value: '${week.tests}',
                  caption: week.tests == 1 ? 'Test' : 'Tests',
                  color: c.brandBright,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: StatTile(
                  // An em dash, never 0%: nothing attempted is not zero
                  // accuracy, and the difference matters to the reader.
                  value: week.accuracy == null
                      ? '—'
                      : '${week.accuracy!.round()}%',
                  caption: 'Accuracy',
                  color: c.gold,
                ),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: StatTile(
                  value: _compactDuration(week.timeSeconds),
                  caption: 'Time',
                  color: c.orange,
                ),
              ),
            ],
          ),
      ],
    );
  }

  static String _compactDuration(int seconds) {
    if (seconds <= 0) return '0m';
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    if (hours == 0) return '${minutes}m';
    if (minutes == 0) return '${hours}h';
    return '${hours}h';
  }

  // ── The verdict ───────────────────────────────────────────────────────────

  /// The opinion, and the AI surface that earns its place: one headline noun,
  /// one sentence of why, one action sized honestly. A chat box would not.
  ///
  /// Second person, past tense, no praise and no scolding.
  Widget _weakestTopicCard(AppColors c, WeakestTopic topic) {
    final minutes = (topic.timeSeconds / 60).round();
    return SurfacePanel(
      padding: const EdgeInsets.all(15),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 20,
                height: 20,
                decoration: BoxDecoration(
                  color: c.danger.withValues(alpha: 0.22),
                  borderRadius: BorderRadius.circular(6),
                ),
              ),
              const SizedBox(width: 8),
              Text('Weakest topic this week',
                  style: AppText.captionStrong.copyWith(color: c.textSecondary, fontSize: 11.5)),
            ],
          ),
          const SizedBox(height: 9),
          Text(topic.topic,
              style: AppText.cardTitle.copyWith(color: c.textPrimary, fontSize: 19)),
          const SizedBox(height: 7),
          Text(
            '${topic.accuracy.round()}% accuracy against your '
            '${topic.averageAccuracy.round()}% average. '
            '${topic.questionCount} question${topic.questionCount == 1 ? '' : 's'}, '
            '$minutes minute${minutes == 1 ? '' : 's'}.',
            style: AppText.caption.copyWith(color: c.textSecondary),
          ),
          const SizedBox(height: 11),
          SecondaryButton(
            label: 'Practise it now',
            fullWidth: true,
            // Honest routing: there is no per-topic practice endpoint, so this
            // hands the student to the study path rather than pretending to
            // have filtered a question bank by topic.
            onPressed: () => HomeShell.go(HomeShell.series),
          ),
        ],
      ),
    );
  }

  // ── Boards ────────────────────────────────────────────────────────────────

  /// The rail answers *is this my exam?* faster than any label. Tiles stay
  /// paper-white in both themes, and each one has live mocks behind it —
  /// [_boards] is built from the tests the student can actually open.
  Widget _boardRail(AppColors c) {
    final boards = _boards;
    final wide = MediaQuery.sizeOf(context).width >= 600;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeading(
          'Your exams',
          trailing: _boardFilter == null
              ? null
              : GestureDetector(
                  onTap: () => setState(() => _boardFilter = null),
                  child: Text('Clear filter',
                      style: AppText.caption.copyWith(color: c.brandBright)),
                ),
        ),
        const SizedBox(height: 11),
        GridView.count(
          crossAxisCount: wide ? 6 : 4,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          crossAxisSpacing: 9,
          mainAxisSpacing: 9,
          childAspectRatio: 1,
          children: [
            for (final board in boards)
              BoardTile(
                board: board,
                selected: _boardFilter == board.key,
                onTap: () => setState(
                    () => _boardFilter = _boardFilter == board.key ? null : board.key),
              ),
          ],
        ),
        const SizedBox(height: 10),
        Text(BoardCatalog.disclaimer,
            style: AppText.caption.copyWith(color: c.textMuted, fontSize: 10.5)),
      ],
    );
  }

  // ── Catalogue ─────────────────────────────────────────────────────────────

  Widget _coursesSection(AppColors c) {
    final courses = _summary.courses;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeading(
          'Enrolled courses',
          trailing: GestureDetector(
            onTap: () => showActivationModal(context, onSuccess: _handleEnrolled),
            child: Text('Activate →',
                style: AppText.caption.copyWith(color: c.brandBright, fontSize: 12.5)),
          ),
        ),
        const SizedBox(height: 11),
        if (courses.isEmpty)
          EmptyState(
            icon: Icons.menu_book_outlined,
            title: 'No courses yet',
            message: 'Redeem an activation code or request access, and your '
                'lectures and papers appear here.',
            action: PrimaryButton(
              label: 'Activate a course',
              onPressed: () => showActivationModal(context, onSuccess: _handleEnrolled),
            ),
          )
        else
          for (final course in courses) ...[
            _courseCard(c, course),
            const SizedBox(height: 10),
          ],
      ],
    );
  }

  Widget _courseCard(AppColors c, CourseProgress course) {
    final hasProgress = course.lessonsTotal > 0;
    return SurfacePanel(
      padding: EdgeInsets.zero,
      onTap: () => context.openCourse(course.id),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppTheme.radiusMd),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CourseCover(title: course.title ?? '', url: course.thumbnailUrl),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 13, 14, 15),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(course.title ?? '',
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: AppText.cardTitleSm.copyWith(color: c.textPrimary)),
                      ),
                      const SizedBox(width: 8),
                      TrailingBadge('ACTIVE', color: c.success),
                    ],
                  ),
                  if (hasProgress) ...[
                    const SizedBox(height: 11),
                    ProgressBar(percent: course.progressPercent, height: 6),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('${course.lessonsCompleted} of ${course.lessonsTotal} lessons',
                            style: AppText.caption.copyWith(color: c.textSecondary)),
                        Text('${course.progressPercent}%',
                            style: AppText.caption.copyWith(color: c.textSecondary)),
                      ],
                    ),
                  ] else if ((course.shortDescription ?? '').isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(
                      course.shortDescription!,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppText.caption.copyWith(color: c.textSecondary),
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

  Widget _testsSection(AppColors c) {
    final tests = _filteredTests;
    final filtered = _boardFilter != null;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeading(filtered ? 'Papers for this exam' : 'Available papers'),
        const SizedBox(height: 11),
        for (final test in tests) ...[
          _testRow(c, test),
          const SizedBox(height: 9),
        ],
      ],
    );
  }

  Widget _testRow(AppColors c, TestSummary test) {
    // Omitted rather than guessed: an unmapped category draws no chip at all.
    final board = BoardCatalog.resolve(test.category);
    final attempts = test.maxAttempts;
    return SurfacePanel(
      padding: const EdgeInsets.all(13),
      onTap: () => _startTest(test.id),
      child: Row(
        children: [
          if (board != null) ...[
            BoardChip(board: board),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(test.title ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppText.cardTitleSm.copyWith(color: c.textPrimary, fontSize: 14.5)),
                const SizedBox(height: 5),
                Text(
                  '${(test.durationSeconds ?? 0) ~/ 60} min'
                  '${test.totalMarks != null ? ' · ${formatNumber(test.totalMarks)} marks' : ''}'
                  '${attempts != null ? ' · ${test.sessionsCount}/$attempts attempts' : ''}',
                  style: AppText.caption.copyWith(color: c.textSecondary, fontSize: 11.5),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (test.sessionsCount == 0)
            TrailingBadge('NEXT', color: c.orange)
          else
            Icon(Icons.chevron_right, size: 20, color: c.textMuted),
        ],
      ),
    );
  }

  Widget _activationSection(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeading('Activation requests', accent: null),
        const SizedBox(height: 11),
        for (final req in _activationRequests) ...[
          SurfacePanel(
            padding: const EdgeInsets.all(13),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('${req.course ?? 'Course'} — ${req.batch ?? 'Batch'}',
                          style: AppText.captionStrong.copyWith(
                              color: c.textPrimary, fontSize: 13)),
                      if (req.paymentReference != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text('Ref: ${req.paymentReference}',
                              style: AppText.caption
                                  .copyWith(color: c.textSecondary, fontSize: 11.5)),
                        ),
                      if (req.adminNotes != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 3),
                          child: Text(req.adminNotes!,
                              style: AppText.caption
                                  .copyWith(color: c.textSecondary, fontSize: 11.5)),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                TrailingBadge(
                  (req.status ?? 'pending').toUpperCase(),
                  color: switch (req.status) {
                    'approved' => c.success,
                    'rejected' => c.danger,
                    _ => c.orange,
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 9),
        ],
      ],
    );
  }

  Widget _purchasableSection(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeading('Browse courses'),
        const SizedBox(height: 11),
        if (_loadingPurchasable)
          const LoadingView(message: 'Loading available courses…')
        else
          for (final course in _purchasable) ...[
            SurfacePanel(
              padding: EdgeInsets.zero,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppTheme.radiusMd),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CourseCover(title: course.title ?? '', height: 92),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(14, 13, 14, 14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(course.title ?? '',
                              style:
                                  AppText.cardTitleSm.copyWith(color: c.textPrimary)),
                          if ((course.shortDescription ?? course.description ?? '')
                              .isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              course.shortDescription ?? course.description ?? '',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style:
                                  AppText.caption.copyWith(color: c.textSecondary),
                            ),
                          ],
                          const SizedBox(height: 12),
                          for (final batch in course.batches) ...[
                            Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(batch.name ?? '',
                                          style: AppText.captionStrong
                                              .copyWith(color: c.textPrimary, fontSize: 13)),
                                      if (batch.startsAt != null)
                                        Text('Starts ${formatDate(batch.startsAt!)}',
                                            style: AppText.caption.copyWith(
                                                color: c.textSecondary, fontSize: 11.5)),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 10),
                                PrimaryButton(
                                  label: formatRupees(batch.pricePaise ?? 0),
                                  fontSize: 13,
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 14, vertical: 10),
                                  onPressed: () => showStudentCheckout(
                                    context,
                                    batch: batch,
                                    courseTitle: course.title ?? '',
                                    onEnrolled: _handleEnrolled,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}
