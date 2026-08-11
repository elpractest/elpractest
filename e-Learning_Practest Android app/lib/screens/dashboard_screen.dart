import '../scaffold.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api_client.dart';
import '../build_config.dart';
import '../models.dart';
import '../session.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';
import 'activation_modal.dart';
import 'course_outline_screen.dart';
import 'results_history_screen.dart';
import 'student_checkout.dart';
import 'test_series_screen.dart';
import 'test_taking_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<EnrolledCourse> _courses = [];
  List<ActivationRequest> _activationRequests = [];
  List<TestSummary> _tests = [];
  EnrolledCourse? _selectedCourse;
  bool _loadingCourses = true;
  bool _loadingTests = false;
  String _error = '';

  // Payment toggle state
  bool _paymentGatewayEnabled = false;
  List<PublicCourse> _purchasable = [];
  bool _loadingPurchasable = false;

  @override
  void initState() {
    super.initState();
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    _fetchEnrolledCourses();
    _fetchActivationRequests();
    try {
      final data = await ApiClient.instance.get('/settings/public');
      final settings = PublicSettings.fromJson(data['settings'] as Map<String, dynamic>?);
      if (!mounted) return;
      // The server toggle can only ever turn buying OFF here, never on: a Play
      // build must not sell digital content outside Play Billing. See
      // [enableInAppPurchase].
      final canBuy = enableInAppPurchase && settings.paymentGatewayEnabled;
      setState(() => _paymentGatewayEnabled = canBuy);
      if (canBuy) {
        _fetchPurchasable();
      }
    } catch (_) {}
  }

  Future<void> _fetchEnrolledCourses() async {
    setState(() => _loadingCourses = true);
    try {
      final data = await ApiClient.instance.get('/student/courses');
      final list = extractList(data, 'courses')
              .map((c) => EnrolledCourse.fromJson(c as Map<String, dynamic>))
              .toList();
      if (!mounted) return;
      setState(() {
        _courses = list;
        _loadingCourses = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to load courses. Please refresh.';
        _loadingCourses = false;
      });
    }
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

  Future<void> _handleCourseClick(EnrolledCourse course) async {
    setState(() {
      _selectedCourse = course;
      _loadingTests = true;
      _tests = [];
      _error = '';
    });
    try {
      final data = await ApiClient.instance.get('/student/tests');
      final all = extractList(data, 'tests')
              .map((t) => TestSummary.fromJson(t as Map<String, dynamic>))
              .toList();
      if (!mounted) return;
      setState(() {
        _tests = all.where((t) => t.courseId == course.id).toList();
        _loadingTests = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Failed to fetch tests for this course.';
        _loadingTests = false;
      });
    }
  }

  Future<void> _handleStartTest(TestSummary test) async {
    setState(() => _error = '');
    try {
      final data = await ApiClient.instance.post('/student/tests/${test.id}/start');
      final session = SessionState.fromJson(data['session'] as Map<String, dynamic>);
      if (!mounted) return;
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => TestTakingScreen(sessionId: session.id)),
      );
      if (mounted) {
        _fetchEnrolledCourses();
        if (_selectedCourse != null) _handleCourseClick(_selectedCourse!);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message.isEmpty ? 'Failed to start the test session.' : e.message);
    }
  }

  void _handleEnrolled() {
    _fetchEnrolledCourses();
    _fetchActivationRequests();
    if (_paymentGatewayEnabled) _fetchPurchasable();
  }

  Color? _statusColor(String status) {
    final c = useColors(context);
    switch (status) {
      case 'approved':
        return c.success;
      case 'rejected':
        return c.danger;
      default:
        return c.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final session = context.watch<Session>();
    final user = session.user;
    final userName = user?.name ?? 'Student';

    return AppScaffold(
      safeArea: false,
      child: Column(
        children: [
          AppHeader(userName: userName, onLogout: session.logout),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () async {
                await _fetchAll();
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _buildHeader(c),
                  if (_error.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    ErrorBanner(_error),
                    const SizedBox(height: 4),
                  ],
                  if (_activationRequests.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _buildActivationRequests(c),
                  ],
                  const SizedBox(height: 20),
                  _buildCoursesSection(c),
                  if (enableInAppPurchase &&
                      _paymentGatewayEnabled &&
                      _purchasable.isNotEmpty) ...[
                    const SizedBox(height: 24),
                    _buildPurchasableSection(c),
                  ],
                  if (_selectedCourse != null) ...[
                    const SizedBox(height: 24),
                    _buildTestsSection(c),
                  ],
                  const SizedBox(height: 80),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(AppColors c) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Student Dashboard',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: c.textPrimary)),
              const SizedBox(height: 4),
              Text('Access your enrolled course lectures, practice tests, and analytics.',
                  style: TextStyle(fontSize: 13, color: c.textSecondary)),
            ],
          ),
        ),
        IconButton(
          tooltip: 'Results',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const ResultsHistoryScreen()),
          ),
          icon: Icon(Icons.bar_chart, color: c.textPrimary),
        ),
        const SizedBox(width: 4),
        IconButton(
          tooltip: 'Test Series',
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const TestSeriesListScreen()),
          ),
          icon: Icon(Icons.route, color: c.textPrimary),
        ),
      ],
    );
  }

  Widget _buildActivationRequests(AppColors c) {
    return GlassPanel(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your Activation Requests Status',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: c.textPrimary)),
          const SizedBox(height: 12),
          for (final req in _activationRequests) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: c.surface1,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: c.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${req.course ?? 'Course'} — ${req.batch ?? 'Batch'}',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: c.textPrimary)),
                        if (req.paymentReference != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text('Ref: ${req.paymentReference}',
                                style: TextStyle(fontSize: 11.5, color: c.textSecondary)),
                          ),
                        if (req.adminNotes != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Text('(${req.adminNotes})',
                                style: TextStyle(fontSize: 11.5, color: c.textSecondary)),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  StatusChip(
                    (req.status ?? 'pending').toUpperCase(),
                    color: _statusColor(req.status ?? 'pending'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
          ],
        ],
      ),
    );
  }

  Widget _buildCoursesSection(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text('Enrolled Courses',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c.textPrimary)),
            ),
            SecondaryButton(
              label: 'Activate',
              icon: Icons.key,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
              fontSize: 12.5,
              onPressed: () => showActivationModal(context, onSuccess: _handleEnrolled),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (_loadingCourses)
          const LoadingView(message: 'Loading your courses...')
        else if (_courses.isEmpty)
          GlassPanel(
            padding: const EdgeInsets.all(28),
            child: Column(
              children: [
                Icon(Icons.menu_book, size: 34, color: c.textSecondary),
                const SizedBox(height: 12),
                Text(
                  'You are not enrolled in any courses yet. Request activation or redeem a code to start learning!',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13, color: c.textSecondary, height: 1.5),
                ),
                const SizedBox(height: 16),
                GradientButton(
                  label: 'Request Activation / Enter Code',
                  onPressed: () => showActivationModal(context, onSuccess: _handleEnrolled),
                ),
              ],
            ),
          )
        else
          for (final course in _courses) ...[
            _buildCourseCard(course, c),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  Widget _buildCourseCard(EnrolledCourse course, AppColors c) {
    final isSelected = _selectedCourse?.id == course.id;
    return GlassPanel(
      padding: const EdgeInsets.all(18),
      borderColor: isSelected ? c.accent : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              StatusChip(course.examCategory ?? 'GENERAL', icon: Icons.school),
              const Spacer(),
                      Text('Mode: ${_capitalize(course.mode ?? 'online')}',
                          style: TextStyle(fontSize: 11.5, color: c.textSecondary)),
            ],
          ),
          const SizedBox(height: 10),
          Text(course.title ?? '',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: c.textPrimary)),
          const SizedBox(height: 6),
          Text(
            course.shortDescription ?? course.description ?? '',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 13, color: c.textSecondary, height: 1.45),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.only(top: 12),
            decoration: BoxDecoration(border: Border(top: BorderSide(color: c.border))),
            child: Row(
              children: [
                Expanded(
                  child: GradientButton(
                    label: 'Course Outline',
                    fontSize: 13,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    onPressed: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => CourseOutlineScreen(courseId: course.id),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: SecondaryButton(
                    label: 'View Tests',
                    icon: Icons.article_outlined,
                    fontSize: 13,
                    padding: const EdgeInsets.symmetric(vertical: 11),
                    onPressed: () => _handleCourseClick(course),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPurchasableSection(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Browse & Purchase Courses',
            style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c.textPrimary)),
        const SizedBox(height: 12),
        if (_loadingPurchasable)
          const LoadingView(message: 'Loading available courses...')
        else
          for (final course in _purchasable) ...[
            GlassPanel(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      StatusChip(course.examCategory ?? 'GENERAL', icon: Icons.school),
                      const Spacer(),
                      Text('Mode: ${course.mode ?? 'online'}',
                          style: TextStyle(fontSize: 11.5, color: c.textSecondary)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(course.title ?? '',
                      style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: c.textPrimary)),
                  const SizedBox(height: 6),
                  Text(
                    course.shortDescription ?? course.description ?? '',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(fontSize: 13, color: c.textSecondary, height: 1.45),
                  ),
                  const SizedBox(height: 14),
                  Text('Select Batch to Enroll:',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: c.textSecondary)),
                  const SizedBox(height: 8),
                  for (final batch in course.batches) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: c.surface1,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: c.border),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(batch.name ?? '',
                                    style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, color: c.textPrimary)),
                                if (batch.startsAt != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 2),
                                    child: Text('Starts: ${formatDate(batch.startsAt!)}',
                                        style: TextStyle(fontSize: 11.5, color: c.textSecondary)),
                                  ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          GradientButton(
                            label: 'Buy for ${formatRupees(batch.pricePaise ?? 0)}',
                            fontSize: 12.5,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                            onPressed: () => showStudentCheckout(
                              context,
                              batch: batch,
                              courseTitle: course.title ?? '',
                              onEnrolled: _handleEnrolled,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  Widget _buildTestsSection(AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(TextSpan(
          children: [
            TextSpan(
              text: 'Available Tests for ',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c.textPrimary),
            ),
            TextSpan(
              text: _selectedCourse?.title ?? '',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: c.accent),
            ),
          ],
        )),
        const SizedBox(height: 4),
        Text('Select an exam below. Timed sections lock automatically when section time runs out.',
            style: TextStyle(fontSize: 12.5, color: c.textSecondary)),
        const SizedBox(height: 12),
        if (_loadingTests)
          const LoadingView(message: 'Loading tests...')
        else if (_tests.isEmpty)
          GlassPanel(
            padding: const EdgeInsets.all(24),
            child: Text('No tests are currently assigned to this course.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, color: c.textSecondary)),
          )
        else
          for (final test in _tests) ...[
            GlassPanel(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(test.title ?? '',
                      style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w700, color: c.textPrimary)),
                  const SizedBox(height: 4),
                  Text(
                    'Attempts taken: ${test.sessionsCount}'
                    '${test.maxAttempts != null ? ' / ${test.maxAttempts}' : ''}',
                    style: TextStyle(fontSize: 12, color: c.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 16,
                    runSpacing: 6,
                    children: [
                      _testMeta(c, Icons.timer_outlined,
                          'Duration: ${(test.durationSeconds ?? 0) ~/ 60} mins'),
                      _testMeta(c, Icons.adjust,
                          'Total Marks: ${test.totalMarks?.toString() ?? 'N/A'}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  GradientButton(
                    label: 'Start Exam',
                    icon: Icons.play_arrow,
                    fullWidth: true,
                    onPressed: () => _handleStartTest(test),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],
      ],
    );
  }

  Widget _testMeta(AppColors c, IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: c.textSecondary),
        const SizedBox(width: 5),
        Text(text, style: TextStyle(fontSize: 12.5, color: c.textPrimary)),
      ],
    );
  }
}

String _capitalize(String s) =>
    s.isEmpty ? s : s[0].toUpperCase() + s.substring(1);