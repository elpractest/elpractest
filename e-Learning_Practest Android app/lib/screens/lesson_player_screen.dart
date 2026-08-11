import '../scaffold.dart';
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import '../api_client.dart';
import '../models.dart';
import '../theme.dart';
import '../utils.dart';
import '../widgets.dart';

class LessonPlayerScreen extends StatefulWidget {
  const LessonPlayerScreen({super.key, required this.lessonId});

  final int lessonId;

  @override
  State<LessonPlayerScreen> createState() => _LessonPlayerScreenState();
}

class _LessonPlayerScreenState extends State<LessonPlayerScreen> {
  LessonDetailData? _data;
  bool _loading = true;
  String _error = '';
  bool _locked = false;

  YoutubePlayerController? _controller;
  StreamSubscription<YoutubeVideoState>? _videoStateSub;
  StreamSubscription<YoutubePlayerValue>? _playerSub;
  Timer? _progressTimer;
  int _lastPostedSeconds = 0;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  PlayerState _playerState = PlayerState.unknown;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void dispose() {
    _progressTimer?.cancel();
    _videoStateSub?.cancel();
    _playerSub?.cancel();
    _controller?.close();
    super.dispose();
  }

  Future<void> _fetch() async {
    setState(() {
      _loading = true;
      _error = '';
      _locked = false;
    });
    try {
      final data = await ApiClient.instance.get('/student/lessons/${widget.lessonId}');
      if (!mounted) return;
      final detail = LessonDetailData.fromJson(data);
      setState(() {
        _data = detail;
        _loading = false;
      });
      _initPlayer(detail);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (e.statusCode == 403) {
          _locked = true;
        } else {
          _error = e.message.isEmpty ? 'Failed to load the lesson.' : e.message;
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = 'Failed to load the lesson.';
      });
    }
  }

  void _initPlayer(LessonDetailData detail) {
    final videoId = detail.lesson.videoId;
    if (videoId == null || videoId.isEmpty) {
      setState(() => _error = 'This lesson has no video content yet.');
      return;
    }

    final startSeconds = (detail.progress?.watchedSeconds ?? 0).toDouble();
    _lastPostedSeconds = detail.progress?.watchedSeconds ?? 0;

    final controller = YoutubePlayerController.fromVideoId(
      videoId: videoId,
      autoPlay: true,
      startSeconds: startSeconds,
      params: const YoutubePlayerParams(
        privacyEnhancedMode: true,
        showVideoAnnotations: false,
        strictRelatedVideos: true,
        enableCaption: true,
      ),
    );
    _controller = controller;
    _videoStateSub = controller.videoStateStream.listen((state) {
      _position = state.position;
    });
    _playerSub = controller.stream.listen((value) {
      _playerState = value.playerState;
      final d = value.metaData.duration;
      if (d > Duration.zero) _duration = d;
      if (value.playerState == PlayerState.ended) {
        _flushProgress();
      }
    });

    // Post watched-seconds every 15s while playing.
    _progressTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      if (_playerState == PlayerState.playing) {
        _flushProgress();
      }
    });
  }

  Future<void> _flushProgress() async {
    final seconds = _position.inSeconds;
    if (seconds <= 0) return;
    final watchSeconds = seconds > _lastPostedSeconds ? seconds : _lastPostedSeconds;
    if (watchSeconds == _lastPostedSeconds) return;
    _lastPostedSeconds = watchSeconds;
    try {
      await ApiClient.instance.post(
        '/student/lessons/${widget.lessonId}/progress',
        body: {'watched_seconds': watchSeconds},
      );
    } catch (_) {
      // Progress sync is best-effort; never interrupt playback for it.
    }
  }

  @override
  Widget build(BuildContext context) {
    final c = useColors(context);
    final data = _data;

    return AppScaffold(
      child: Column(
        children: [
          AppHeader(
            userName: 'Lesson Player',
            onLogout: () {},
          ),
          Expanded(
            child: _loading
                ? const LoadingView(message: 'Loading lesson...')
                : _locked
                    ? _buildLocked(c)
                    : _error.isNotEmpty && data == null
                        ? _buildError(c)
                        : _buildPlayer(c, data!),
          ),
        ],
      ),
    );
  }

  Widget _buildLocked(AppColors c) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: GlassPanel(
          padding: const EdgeInsets.all(28),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const MedallionIcon(icon: Icons.lock_outline, size: 34, color: null),
              const SizedBox(height: 16),
              Text('Lesson Locked',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: c.textPrimary)),
              const SizedBox(height: 10),
              Text(
                'You do not have access to this lesson. Enroll in the course to watch it.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13.5, color: c.textSecondary, height: 1.5),
              ),
              const SizedBox(height: 20),
              GradientButton(
                label: 'Back to Outline',
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
        ),
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
              Icon(Icons.error_outline, size: 36, color: c.danger),
              const SizedBox(height: 12),
              Text(_error,
                  textAlign: TextAlign.center,
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

  Widget _buildPlayer(AppColors c, LessonDetailData data) {
    final controller = _controller;
    if (controller == null) {
      return _buildError(c);
    }

    final lesson = data.lesson;
    final progress = data.progress;
    final pct = (lesson.durationSeconds != null && lesson.durationSeconds! > 0)
        ? ((progress?.watchedSeconds ?? 0) * 100 ~/ lesson.durationSeconds!).clamp(0, 100)
        : 0;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: AspectRatio(
            aspectRatio: 16 / 9,
            child: YoutubePlayer(controller: controller),
          ),
        ),
        const SizedBox(height: 16),
        GlassPanel(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (lesson.isFreePreview) ...[
                const StatusChip('FREE PREVIEW', color: null),
                const SizedBox(height: 8),
              ],
              Text(lesson.title ?? 'Lesson',
                  style: TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: c.textPrimary)),
              if (lesson.description != null && lesson.description!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(lesson.description!,
                    style: TextStyle(fontSize: 13.5, color: c.textSecondary, height: 1.5)),
              ],
              if (lesson.durationSeconds != null) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.timer_outlined, size: 15, color: c.textSecondary),
                    const SizedBox(width: 6),
                    Text('Duration: ${formatDurationMinutes(lesson.durationSeconds!)}',
                        style: TextStyle(fontSize: 13, color: c.textSecondary)),
                  ],
                ),
              ],
              const SizedBox(height: 16),
              Row(
                children: [
                  Text('Your progress', style: TextStyle(fontSize: 13, color: c.textSecondary)),
                  const Spacer(),
                  Text('$pct%',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: c.accent)),
                ],
              ),
              const SizedBox(height: 8),
              ProgressBar(percent: pct, height: 10),
            ],
          ),
        ),
        const SizedBox(height: 12),
        if (_duration.inSeconds > 0)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Text(
              'Position: ${formatSecondsClock(_position.inSeconds)} / ${formatSecondsClock(_duration.inSeconds)}',
              style: TextStyle(fontSize: 12, color: c.textSecondary),
            ),
          ),
      ],
    );
  }
}
