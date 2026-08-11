import '../scaffold.dart';
import 'package:flutter/material.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';
import 'lesson_player_screen.dart';

class CourseOutlineScreen extends StatefulWidget {
  const CourseOutlineScreen({super.key, required this.courseId});

  final int courseId;

  @override
  State<CourseOutlineScreen> createState() => _CourseOutlineScreenState();
}

class _CourseOutlineScreenState extends State<CourseOutlineScreen> {
  CourseOutlineData? _data;
  bool _loading = true;
  String _error = '';

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      final data = await ApiClient.instance.get('/student/courses/${widget.courseId}/outline');
      if (!mounted) return;
      setState(() {
        _data = CourseOutlineData.fromJson(data);
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = e.message.isEmpty ? 'Failed to load the course outline.' : e.message;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load the course outline.';
      });
    }
  }

  Future<void> _openLesson(Lesson lesson) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => LessonPlayerScreen(lessonId: lesson.id)),
    );
    if (mounted) _fetch();
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    return AppScaffold(
      child: Column(
        children: [
          AppHeader(
            userName: 'Course Outline',
            onLogout: () {},
          ),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading course content...')
                : _error.isNotEmpty
                    ? _buildError(c)
                    : RefreshIndicator(
                        onRefresh: _fetch,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: _buildOutline(c),
                        ),
                      ),
          ),
        ],
      ),
    );
  }

  Widget _buildError(AppColors c) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: GlassPanel(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.lock_outline, size: 36, color: c.warning),
              const SizedBox(height: 12),
              Text(_error, textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 13.5, color: c.textSecondary, height: 1.5)),
              const SizedBox(height: 18),
              GradientButton(
                label: 'Go Back',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Widget> _buildOutline(AppColors c) {
    final data = _data;
    if (data == null) return const [];

    final widgets = <Widget>[];

    widgets.add(GlassPanel(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(data.course.title ?? '',
              style: TextStyle(fontSize: 21, fontWeight: FontWeight.w800, color: c.textPrimary)),
          const SizedBox(height: 6),
          Text('${data.completedLessons} of ${data.totalLessons} lessons completed',
              style: TextStyle(fontSize: 13, color: c.textSecondary)),
          const SizedBox(height: 12),
          ProgressBar(percent: data.percentComplete, height: 12),
          const SizedBox(height: 12),
          Text('${data.percentComplete}% complete',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.accent)),
          const SizedBox(height: 16),
          if (data.nextLesson != null)
            GradientButton(
              label: data.nextLesson!.progress?.isCompleted == true
                  ? 'Review Lesson'
                  : 'Continue Watching: ${data.nextLesson!.title ?? 'Next lesson'}',
              icon: Icons.play_circle_outline,
              fullWidth: true,
              onPressed: () => _openLesson(data.nextLesson!),
            ),
        ],
      ),
    ));
    widgets.add(const SizedBox(height: 16));

    for (final module in data.modules) {
      widgets.add(_buildModule(module, c));
      widgets.add(const SizedBox(height: 14));
    }

    return widgets;
  }

  Widget _buildModule(CourseModule module, AppColors c) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(module.title ?? 'Module',
            style: TextStyle(fontSize: 16.5, fontWeight: FontWeight.w800, color: c.textPrimary)),
        const SizedBox(height: 10),
        for (final lesson in module.lessons) ...[
          _buildLessonRow(lesson, c),
          const SizedBox(height: 8),
        ],
      ],
    );
  }

  Widget _buildLessonRow(Lesson lesson, AppColors c) {
    final progress = lesson.progress;
    final completed = progress?.isCompleted == true;
    return InkWell(
      onTap: () => _openLesson(lesson),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: c.surface1,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: completed ? c.successBorder : c.border),
        ),
        child: Row(
          children: [
            Icon(
              completed ? Icons.check_circle : Icons.play_circle_outline,
              color: completed ? c.success : c.accent,
              size: 22,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(lesson.title ?? 'Untitled lesson',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: c.textPrimary)),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      if (lesson.isFreePreview) ...[
                        StatusChip('FREE PREVIEW', color: c.violet),
                        const SizedBox(width: 8),
                      ],
                      if (lesson.durationSeconds != null)
                        Text(formatDurationMinutes(lesson.durationSeconds!),
                            style: TextStyle(fontSize: 12, color: c.textSecondary)),
                      if (progress != null && progress.watchedSeconds > 0) ...[
                        const SizedBox(width: 8),
                        Text('${progress.watchedSeconds}s watched',
                            style: TextStyle(fontSize: 12, color: c.accent)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: c.textSecondary, size: 20),
          ],
        ),
      ),
    );
  }
}
