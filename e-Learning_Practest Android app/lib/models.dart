/// Coerce a JSON value (number, numeric string, or null) to [num].
/// The API serializes DECIMAL columns as strings (e.g. `"12.00"`), so a
/// bare `json['total_marks']` assigned to a `num?` field would throw.
num? asNum(dynamic v) {
  if (v is num) return v;
  if (v is String) {
    final t = v.trim();
    if (t.isEmpty) return null;
    return num.tryParse(t);
  }
  return null;
}

/// Coerce a JSON value to [int].
int? asInt(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) {
    final t = v.trim();
    if (t.isEmpty) return null;
    return int.tryParse(t);
  }
  return null;
}

class User {
  const User({
    required this.id,
    required this.name,
    this.email,
    this.phone,
    this.emailVerified = false,
    this.roles = const [],
    this.avatar,
  });

  final int id;
  final String name;
  final String? email;
  final String? phone;
  final bool emailVerified;
  final List<String> roles;
  final String? avatar;

  bool get isStudent => !roles.contains('admin') && !roles.contains('super-admin');

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
      name: json['name'] ?? '',
      email: json['email'],
      phone: json['phone'],
      emailVerified: json['email_verified'] == true || json['email_verified'] == 1,
      roles: (json['roles'] as List?)?.map((r) => r.toString()).toList() ?? const [],
      avatar: json['avatar'],
    );
  }
}

class Batch {
  const Batch({
    required this.id,
    this.name,
    this.pricePaise,
    this.priceInRupees,
    this.startsAt,
    this.endsAt,
    this.playProductId,
  });

  final int id;
  final String? name;
  final int? pricePaise;
  final String? priceInRupees;
  final String? startsAt;
  final String? endsAt;

  /// The Google Play managed-product id this batch is sold as, or null when the
  /// batch is not offered through the in-app store (activation-code only). The
  /// store maps a batch to its Play product through this.
  final String? playProductId;

  factory Batch.fromJson(Map<String, dynamic> json) => Batch(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        name: json['name'],
        pricePaise: asInt(json['price_paise']),
        priceInRupees: json['price_in_rupees'],
        startsAt: json['starts_at'],
        endsAt: json['ends_at'],
        playProductId: json['play_product_id'] as String?,
      );
}

class PublicCourse {
  const PublicCourse({
    required this.id,
    this.title,
    this.slug,
    this.description,
    this.shortDescription,
    this.examCategory,
    this.mode,
    this.batches = const [],
  });

  final int id;
  final String? title;
  final String? slug;
  final String? description;
  final String? shortDescription;
  final String? examCategory;
  final String? mode;
  final List<Batch> batches;

  factory PublicCourse.fromJson(Map<String, dynamic> json) => PublicCourse(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        slug: json['slug'],
        description: json['description'],
        shortDescription: json['short_description'],
        examCategory: json['exam_category'],
        mode: json['mode'],
        batches: (json['batches'] as List?)
                ?.map((b) => Batch.fromJson(b as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class EnrolledCourse {
  const EnrolledCourse({
    required this.id,
    this.title,
    this.examCategory,
    this.mode,
    this.shortDescription,
    this.description,
    this.thumbnailUrl,
  });

  final int id;
  final String? title;
  final String? examCategory;
  final String? mode;
  final String? shortDescription;
  final String? description;
  final String? thumbnailUrl;

  factory EnrolledCourse.fromJson(Map<String, dynamic> json) => EnrolledCourse(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        examCategory: json['exam_category'],
        mode: json['mode'],
        shortDescription: json['short_description'],
        description: json['description'],
        thumbnailUrl: json['thumbnail_url'],
      );
}

class ActivationRequest {
  const ActivationRequest({
    required this.id,
    this.paymentReference,
    this.status,
    this.adminNotes,
    this.batch,
    this.course,
    this.createdAt,
  });

  final int id;
  final String? paymentReference;
  final String? status;
  final String? adminNotes;
  final String? batch;
  final String? course;
  final String? createdAt;

  factory ActivationRequest.fromJson(Map<String, dynamic> json) {
    final batchJson = json['batch'];
    final courseJson = batchJson is Map ? batchJson['course'] : null;
    return ActivationRequest(
      id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
      paymentReference: json['payment_reference'],
      status: json['status'],
      adminNotes: json['admin_notes'],
      batch: batchJson is Map ? batchJson['name']?.toString() : null,
      course: courseJson is Map ? courseJson['title']?.toString() : null,
      createdAt: json['created_at'],
    );
  }
}

class TestSummary {
  const TestSummary({
    required this.id,
    this.title,
    this.durationSeconds,
    this.totalMarks,
    this.sessionsCount = 0,
    this.maxAttempts,
    this.courseId,
    this.batchId,
    this.category,
  });

  final int id;
  final String? title;
  final int? durationSeconds;
  final num? totalMarks;
  final int sessionsCount;
  final int? maxAttempts;
  final int? courseId;
  final int? batchId;
  final String? category;

  factory TestSummary.fromJson(Map<String, dynamic> json) => TestSummary(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        durationSeconds: asInt(json['duration_seconds']),
        totalMarks: asNum(json['total_marks']),
        sessionsCount: asInt(json['sessions_count']) ?? 0,
        maxAttempts: asInt(json['max_attempts']),
        courseId: asInt(json['course_id']),
        batchId: asInt(json['batch_id']),
        category: json['category'],
      );
}

class SessionState {
  const SessionState({
    required this.id,
    this.testId,
    this.currentSectionIndex = 0,
    this.timeRemainingSeconds,
    this.sectionTimeRemainingSeconds,
    this.testTitle,
  });

  final int id;
  final int? testId;
  final int currentSectionIndex;
  final int? timeRemainingSeconds;
  final int? sectionTimeRemainingSeconds;
  final String? testTitle;

  factory SessionState.fromJson(Map<String, dynamic> json) => SessionState(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        testId: asInt(json['test_id']),
        currentSectionIndex: asInt(json['current_section_index']) ?? 0,
        timeRemainingSeconds: asInt(json['time_remaining_seconds']),
        sectionTimeRemainingSeconds: asInt(json['section_time_remaining_seconds']),
        testTitle: json['test_title'],
      );
}

class QuestionOption {
  const QuestionOption({
    required this.id,
    this.label,
    this.optionText,
    this.sortOrder,
    this.isCorrect,
  });

  final int id;
  final String? label;
  final String? optionText;
  final int? sortOrder;
  final bool? isCorrect;

  factory QuestionOption.fromJson(Map<String, dynamic> json) => QuestionOption(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        label: json['label'],
        optionText: json['option_text'],
        sortOrder: asInt(json['sort_order']),
        isCorrect: json['is_correct'],
      );
}

class Question {
  const Question({
    required this.id,
    this.subject,
    this.topic,
    this.difficulty,
    this.questionText,
    this.marks,
    this.negativeMarks,
    this.explanation,
    this.options = const [],
  });

  final int id;
  final String? subject;
  final String? topic;
  final String? difficulty;
  final String? questionText;
  final num? marks;
  final num? negativeMarks;
  final String? explanation;
  final List<QuestionOption> options;

  factory Question.fromJson(Map<String, dynamic> json) => Question(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        subject: json['subject'],
        topic: json['topic'],
        difficulty: json['difficulty'],
        questionText: json['question_text'],
        marks: asNum(json['marks']),
        negativeMarks: asNum(json['negative_marks']),
        explanation: json['explanation'],
        options: (json['options'] as List?)
                ?.map((o) => QuestionOption.fromJson(o as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class TestSection {
  const TestSection({
    required this.id,
    this.title,
    this.durationSeconds,
    this.sortOrder,
    this.questions = const [],
  });

  final int id;
  final String? title;
  final int? durationSeconds;
  final int? sortOrder;
  final List<Question> questions;

  factory TestSection.fromJson(Map<String, dynamic> json) => TestSection(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        durationSeconds: asInt(json['duration_seconds']),
        sortOrder: asInt(json['sort_order']),
        questions: (json['questions'] as List?)
                ?.map((q) => Question.fromJson(q as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class SessionAnswer {
  const SessionAnswer({
    required this.questionId,
    this.selectedOptionId,
    this.isMarkedForReview = false,
    this.isVisited = false,
  });

  final int questionId;
  final int? selectedOptionId;
  final bool isMarkedForReview;
  final bool isVisited;

  factory SessionAnswer.fromJson(Map<String, dynamic> json) => SessionAnswer(
        questionId: json['question_id'] is int
            ? json['question_id']
            : int.tryParse('${json['question_id']}') ?? 0,
        selectedOptionId: asInt(json['selected_option_id']),
        isMarkedForReview: json['is_marked_for_review'] == true,
        isVisited: json['is_visited'] == true,
      );
}

class PaletteItem {
  const PaletteItem({required this.questionId, required this.status});

  final int questionId;
  final String status;

  factory PaletteItem.fromJson(Map<String, dynamic> json) => PaletteItem(
        questionId: json['question_id'] is int
            ? json['question_id']
            : int.tryParse('${json['question_id']}') ?? 0,
        status: json['status'] ?? 'not_visited',
      );
}

/// One row of the analytics job's per-subject or per-topic breakdown.
///
/// Already computed and stored server-side at submit, which is what lets the
/// result screen show accuracy and speed together per section without a second
/// request or a second definition of "accuracy".
class BreakdownRow {
  const BreakdownRow({
    this.correct = 0,
    this.incorrect = 0,
    this.unanswered = 0,
    this.score = 0,
    this.maxScore = 0,
    this.timeSpent = 0,
  });

  final int correct;
  final int incorrect;
  final int unanswered;
  final num score;
  final num maxScore;
  final int timeSpent;

  int get attempted => correct + incorrect;
  int get questions => correct + incorrect + unanswered;

  /// Null rather than zero when nothing was attempted: not attempting a
  /// section is not the same as getting it all wrong, and the difference is
  /// the whole point of showing it.
  double? get accuracy => attempted == 0 ? null : (correct / attempted) * 100;

  /// Seconds per attempted question, for the speed footnote that sits beside
  /// accuracy — that pair is what actually diagnoses an aspirant.
  double? get secondsPerQuestion =>
      attempted == 0 ? null : timeSpent / attempted;

  factory BreakdownRow.fromJson(Map<String, dynamic> json) => BreakdownRow(
        correct: asInt(json['correct']) ?? 0,
        incorrect: asInt(json['incorrect']) ?? 0,
        unanswered: asInt(json['unanswered']) ?? 0,
        score: asNum(json['score']) ?? 0,
        maxScore: asNum(json['max_score']) ?? 0,
        timeSpent: asInt(json['time_spent']) ?? 0,
      );

  static Map<String, BreakdownRow> mapFrom(dynamic raw) {
    if (raw is! Map) return const {};
    final out = <String, BreakdownRow>{};
    raw.forEach((key, value) {
      if (value is Map<String, dynamic>) {
        out['$key'] = BreakdownRow.fromJson(value);
      } else if (value is Map) {
        out['$key'] = BreakdownRow.fromJson(Map<String, dynamic>.from(value));
      }
    });
    return out;
  }
}

class Analytic {
  const Analytic({
    this.totalScore,
    this.maxScore,
    this.accuracyPercentage,
    this.correctCount,
    this.incorrectCount,
    this.unansweredCount,
    this.totalTimeSeconds,
    this.subjectBreakdown = const {},
    this.topicBreakdown = const {},
  });

  final num? totalScore;
  final num? maxScore;
  final num? accuracyPercentage;
  final int? correctCount;
  final int? incorrectCount;
  final int? unansweredCount;
  final num? totalTimeSeconds;

  /// Keyed by subject — what the result screen calls a section.
  final Map<String, BreakdownRow> subjectBreakdown;
  final Map<String, BreakdownRow> topicBreakdown;

  factory Analytic.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const Analytic();
    return Analytic(
      totalScore: asNum(json['total_score']),
      maxScore: asNum(json['max_score']),
      accuracyPercentage: asNum(json['accuracy_percentage']),
      correctCount: asInt(json['correct_count']),
      incorrectCount: asInt(json['incorrect_count']),
      unansweredCount: asInt(json['unanswered_count']),
      totalTimeSeconds: asInt(json['total_time_seconds']),
      subjectBreakdown: BreakdownRow.mapFrom(json['subject_breakdown']),
      topicBreakdown: BreakdownRow.mapFrom(json['topic_breakdown']),
    );
  }
}

class ResultOption {
  const ResultOption({
    required this.id,
    this.label,
    this.optionText,
    this.isCorrect = false,
  });

  final int id;
  final String? label;
  final String? optionText;
  final bool isCorrect;

  factory ResultOption.fromJson(Map<String, dynamic> json) => ResultOption(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        label: json['label'],
        optionText: json['option_text'],
        isCorrect: json['is_correct'] == true,
      );
}

class ResultAnswer {
  const ResultAnswer({
    required this.questionId,
    this.questionText,
    this.explanation,
    this.marks,
    this.negativeMarks,
    this.selectedOptionId,
    this.isCorrect = false,
    this.isVisited = false,
    this.timeSpentSeconds = 0,
    this.options = const [],
  });

  final int questionId;
  final String? questionText;
  final String? explanation;
  final num? marks;
  final num? negativeMarks;
  final int? selectedOptionId;
  final bool isCorrect;
  final bool isVisited;
  final int timeSpentSeconds;
  final List<ResultOption> options;

  bool get isSkipped => selectedOptionId == null;

  factory ResultAnswer.fromJson(Map<String, dynamic> json) => ResultAnswer(
        questionId: json['question_id'] is int
            ? json['question_id']
            : int.tryParse('${json['question_id']}') ?? 0,
        questionText: json['question_text'],
        explanation: json['explanation'],
        marks: asNum(json['marks']),
        negativeMarks: asNum(json['negative_marks']),
        selectedOptionId: asInt(json['selected_option_id']),
        isCorrect: json['is_correct'] == true,
        isVisited: json['is_visited'] == true,
        timeSpentSeconds: asInt(json['time_spent_seconds']) ?? 0,
        options: (json['options'] as List?)
                ?.map((o) => ResultOption.fromJson(o as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class TestResultData {
  const TestResultData({
    required this.analytic,
    this.rank,
    this.percentile,
    this.answers = const [],
  });

  final Analytic analytic;
  final num? rank;
  final num? percentile;
  final List<ResultAnswer> answers;

  factory TestResultData.fromJson(Map<String, dynamic> json) => TestResultData(
        analytic: Analytic.fromJson(json['analytic'] as Map<String, dynamic>?),
        rank: asNum(json['rank']),
        percentile: asNum(json['percentile']),
        answers: (json['answers'] as List?)
                ?.map((a) => ResultAnswer.fromJson(a as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class ResultSummary {
  const ResultSummary({
    required this.sessionId,
    this.testId,
    this.testTitle,
    this.courseTitle,
    this.submittedAt,
    this.isAutoSubmitted = false,
    this.score,
    this.totalMarks,
    this.accuracyPercentage,
    this.rank,
    this.percentile,
    this.timeTakenSeconds,
  });

  final int sessionId;
  final int? testId;
  final String? testTitle;
  final String? courseTitle;
  final String? submittedAt;
  final bool isAutoSubmitted;
  final num? score;
  final num? totalMarks;
  final num? accuracyPercentage;
  final num? rank;
  final num? percentile;
  final num? timeTakenSeconds;

  factory ResultSummary.fromJson(Map<String, dynamic> json) => ResultSummary(
        sessionId: json['session_id'] is int
            ? json['session_id']
            : int.tryParse('${json['session_id']}') ?? 0,
        testId: asInt(json['test_id']),
        testTitle: json['test_title'],
        courseTitle: json['course_title'],
        submittedAt: json['submitted_at'],
        isAutoSubmitted: json['is_auto_submitted'] == true,
        score: asNum(json['score']),
        totalMarks: asNum(json['total_marks']),
        accuracyPercentage: asNum(json['accuracy_percentage']),
        rank: asNum(json['rank']),
        percentile: asNum(json['percentile']),
        timeTakenSeconds: asNum(json['time_taken_seconds']),
      );
}

class CourseModule {
  const CourseModule({
    required this.id,
    this.title,
    this.sortOrder,
    this.lessons = const [],
  });

  final int id;
  final String? title;
  final int? sortOrder;
  final List<Lesson> lessons;

  factory CourseModule.fromJson(Map<String, dynamic> json) => CourseModule(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        sortOrder: asInt(json['sort_order']),
        lessons: (json['lessons'] as List?)
                ?.map((l) => Lesson.fromJson(l as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class LessonProgressData {
  const LessonProgressData({this.watchedSeconds = 0, this.isCompleted = false});

  final int watchedSeconds;
  final bool isCompleted;

  factory LessonProgressData.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const LessonProgressData();
    return LessonProgressData(
      watchedSeconds: asInt(json['watched_seconds']) ?? 0,
      isCompleted: json['is_completed'] == true,
    );
  }
}

class Lesson {
  const Lesson({
    required this.id,
    this.title,
    this.videoId,
    this.durationSeconds,
    this.isFreePreview = false,
    this.sortOrder,
    this.description,
    this.progress,
  });

  final int id;
  final String? title;
  final String? videoId;
  final int? durationSeconds;
  final bool isFreePreview;
  final int? sortOrder;
  final String? description;
  final LessonProgressData? progress;

  factory Lesson.fromJson(Map<String, dynamic> json) => Lesson(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        videoId: json['video_id'],
        durationSeconds: asInt(json['duration_seconds']),
        isFreePreview: json['is_free_preview'] == true,
        sortOrder: asInt(json['sort_order']),
        description: json['description'],
        progress: json['student_progress'] != null
            ? LessonProgressData.fromJson(json['student_progress'] as Map<String, dynamic>)
            : json['progress'] != null
                ? LessonProgressData.fromJson(json['progress'] as Map<String, dynamic>)
                : null,
      );
}

class CourseOutlineData {
  const CourseOutlineData({required this.course, this.modules = const []});

  final EnrolledCourse course;
  final List<CourseModule> modules;

  List<Lesson> get allLessons {
    return modules.expand((m) => m.lessons).toList();
  }

  int get totalLessons => allLessons.length;

  int get completedLessons =>
      allLessons.where((l) => l.progress?.isCompleted == true).length;

  int get percentComplete => totalLessons > 0
      ? (completedLessons * 100 / totalLessons).round()
      : 0;

  Lesson? get nextLesson {
    for (final l in allLessons) {
      if (l.progress?.isCompleted != true) return l;
    }
    return allLessons.isNotEmpty ? allLessons.first : null;
  }

  factory CourseOutlineData.fromJson(Map<String, dynamic> json) => CourseOutlineData(
        course: EnrolledCourse.fromJson(json['course'] as Map<String, dynamic>),
        modules: (json['modules'] as List?)
                ?.map((m) => CourseModule.fromJson(m as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class LessonDetailData {
  const LessonDetailData({required this.lesson, this.progress});

  final Lesson lesson;
  final LessonProgressData? progress;

  factory LessonDetailData.fromJson(Map<String, dynamic> json) => LessonDetailData(
        lesson: Lesson.fromJson(json['lesson'] as Map<String, dynamic>),
        progress: json['progress'] != null
            ? LessonProgressData.fromJson(json['progress'] as Map<String, dynamic>)
            : null,
      );
}

class TestSeries {
  const TestSeries({
    required this.id,
    this.title,
    this.description,
    this.examCategory,
    this.isCompleted = false,
    this.attemptedTestsCount = 0,
    this.totalTests = 0,
  });

  final int id;
  final String? title;
  final String? description;
  final String? examCategory;
  final bool isCompleted;
  final int attemptedTestsCount;
  final int totalTests;

  factory TestSeries.fromJson(Map<String, dynamic> json) => TestSeries(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        description: json['description'],
        examCategory: json['exam_category'],
        isCompleted: json['is_completed'] == true,
        attemptedTestsCount: asInt(json['attempted_tests_count']) ?? 0,
        totalTests: asInt(json['total_tests']) ?? 0,
      );
}

class SeriesTest {
  const SeriesTest({
    required this.id,
    this.title,
    this.category,
    this.durationSeconds,
    this.totalMarks,
    this.status,
    this.score,
  });

  final int id;
  final String? title;
  final String? category;
  final int? durationSeconds;
  final num? totalMarks;
  final String? status;
  final num? score;

  bool get isCompleted => status == 'completed';

  factory SeriesTest.fromJson(Map<String, dynamic> json) => SeriesTest(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        category: json['category'],
        durationSeconds: asInt(json['duration_seconds']),
        totalMarks: asNum(json['total_marks']),
        status: json['status'],
        score: asNum(json['score']),
      );
}

class TestSeriesDetail {
  const TestSeriesDetail({
    required this.id,
    this.title,
    this.description,
    this.examCategory,
    this.totalTests = 0,
    this.nextTestId,
    this.tests = const [],
    this.categories = const {},
  });

  final int id;
  final String? title;
  final String? description;
  final String? examCategory;
  final int totalTests;
  final int? nextTestId;
  final List<SeriesTest> tests;
  final Map<String, List<int>> categories;

  factory TestSeriesDetail.fromJson(Map<String, dynamic> json) {
    final rawCats = json['categories'] as Map? ?? {};
    return TestSeriesDetail(
      id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
      title: json['title'],
      description: json['description'],
      examCategory: json['exam_category'],
      totalTests: asInt(json['total_tests']) ?? 0,
      nextTestId: asInt(json['next_test_id']),
      tests: (json['tests'] as List?)
              ?.map((t) => SeriesTest.fromJson(t as Map<String, dynamic>))
              .toList() ??
          const [],
      categories: rawCats.map(
        (k, v) => MapEntry(k.toString(), (v as List).map((e) => int.parse('$e')).toList()),
      ),
    );
  }
}

class LeaderboardEntry {
  const LeaderboardEntry({
    this.userId,
    this.name,
    this.testsCompleted,
    this.totalScore,
    this.rank,
    this.isCurrentUser = false,
  });

  final int? userId;
  final String? name;
  final int? testsCompleted;
  final num? totalScore;
  final num? rank;
  final bool isCurrentUser;

  factory LeaderboardEntry.fromJson(Map<String, dynamic> json) => LeaderboardEntry(
        userId: asInt(json['user_id']),
        name: json['name'],
        testsCompleted: asInt(json['tests_completed']),
        totalScore: asNum(json['total_score']),
        rank: asNum(json['rank']),
        isCurrentUser: json['is_current_user'] == true,
      );
}

class LeaderboardData {
  const LeaderboardData({
    this.userRank,
    this.leaderboard = const [],
  });

  final num? userRank;
  final List<LeaderboardEntry> leaderboard;

  factory LeaderboardData.fromJson(Map<String, dynamic> json) => LeaderboardData(
        userRank: asNum(json['user_rank']),
        leaderboard: (json['leaderboard'] as List?)
                ?.map((e) => LeaderboardEntry.fromJson(e as Map<String, dynamic>))
                .toList() ??
            const [],
      );
}

class PublicSettings {
  const PublicSettings({
    this.paymentGatewayEnabled = false,
    this.socialLoginEnabled = false,
    this.lmsVideoEnabled = false,
    this.siteName,
    this.primaryColor,
    this.accentColor,
    this.googleClientId,
  });

  final bool paymentGatewayEnabled;
  final bool socialLoginEnabled;
  final bool lmsVideoEnabled;
  final String? siteName;
  final String? primaryColor;
  final String? accentColor;

  /// The Google OAuth *web* client id, used as google_sign_in's serverClientId
  /// so the ID token's audience matches what the backend verifies.
  final String? googleClientId;

  factory PublicSettings.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const PublicSettings();
    bool flag(String key) {
      final v = json[key];
      return v == true || v == 'true';
    }

    return PublicSettings(
      paymentGatewayEnabled: flag('payment_gateway_enabled'),
      socialLoginEnabled: flag('social_login_enabled'),
      lmsVideoEnabled: flag('lms_video_enabled'),
      siteName: json['site_name']?.toString(),
      primaryColor: json['primary_color']?.toString(),
      accentColor: json['accent_color']?.toString(),
      googleClientId: json['google_client_id']?.toString(),
    );
  }
}

// ── Home summary ────────────────────────────────────────────────────────────
// Everything the Home tab draws, from `GET /student/home-summary`. Modelled as
// one payload rather than five because the screen's governing rule is that
// every figure on it comes from one source and one window — which is only
// enforceable if they arrive together.

/// The unfinished paper. Absent when there is nothing to resume, which is a
/// state the screen has a real design for rather than an empty card.
class ActiveSession {
  const ActiveSession({
    required this.id,
    this.testId,
    this.testTitle,
    this.category,
    this.timeRemainingSeconds,
    this.sectionTimeRemainingSeconds,
    this.currentSectionIndex = 0,
    this.sectionCount = 0,
    this.sectionTitle,
    this.answeredCount = 0,
    this.questionCount = 0,
  });

  final int id;
  final int? testId;
  final String? testTitle;
  final String? category;
  final int? timeRemainingSeconds;
  final int? sectionTimeRemainingSeconds;
  final int currentSectionIndex;
  final int sectionCount;
  final String? sectionTitle;
  final int answeredCount;
  final int questionCount;

  int get progressPercent =>
      questionCount == 0 ? 0 : ((answeredCount / questionCount) * 100).round();

  factory ActiveSession.fromJson(Map<String, dynamic> json) => ActiveSession(
        id: asInt(json['id']) ?? 0,
        testId: asInt(json['test_id']),
        testTitle: json['test_title'],
        category: json['category'],
        timeRemainingSeconds: asInt(json['time_remaining_seconds']),
        sectionTimeRemainingSeconds: asInt(json['section_time_remaining_seconds']),
        currentSectionIndex: asInt(json['current_section_index']) ?? 0,
        sectionCount: asInt(json['section_count']) ?? 0,
        sectionTitle: json['section_title'],
        answeredCount: asInt(json['answered_count']) ?? 0,
        questionCount: asInt(json['question_count']) ?? 0,
      );
}

/// The stat trio's source. [accuracy] is null when nothing was attempted in
/// the window — which the tile renders as an em dash, never as 0%.
class WeekStats {
  const WeekStats({this.tests = 0, this.accuracy, this.timeSeconds = 0});

  final int tests;
  final num? accuracy;
  final int timeSeconds;

  bool get isEmpty => tests == 0;

  factory WeekStats.fromJson(Map<String, dynamic>? json) {
    if (json == null) return const WeekStats();
    return WeekStats(
      tests: asInt(json['tests']) ?? 0,
      accuracy: asNum(json['accuracy']),
      timeSeconds: asInt(json['time_seconds']) ?? 0,
    );
  }
}

/// The opinion: one topic, its accuracy, and what that costs against the
/// student's own average over the same window.
class WeakestTopic {
  const WeakestTopic({
    required this.topic,
    required this.accuracy,
    required this.averageAccuracy,
    required this.questionCount,
    required this.timeSeconds,
  });

  final String topic;
  final num accuracy;
  final num averageAccuracy;
  final int questionCount;
  final int timeSeconds;

  factory WeakestTopic.fromJson(Map<String, dynamic> json) => WeakestTopic(
        topic: '${json['topic'] ?? ''}',
        accuracy: asNum(json['accuracy']) ?? 0,
        averageAccuracy: asNum(json['average_accuracy']) ?? 0,
        questionCount: asInt(json['question_count']) ?? 0,
        timeSeconds: asInt(json['time_seconds']) ?? 0,
      );
}

/// An enrolled course with the lesson progress its card draws.
class CourseProgress {
  const CourseProgress({
    required this.id,
    this.title,
    this.examCategory,
    this.mode,
    this.shortDescription,
    this.thumbnailUrl,
    this.lessonsTotal = 0,
    this.lessonsCompleted = 0,
    this.progressPercent = 0,
  });

  final int id;
  final String? title;
  final String? examCategory;
  final String? mode;
  final String? shortDescription;
  final String? thumbnailUrl;
  final int lessonsTotal;
  final int lessonsCompleted;
  final int progressPercent;

  factory CourseProgress.fromJson(Map<String, dynamic> json) => CourseProgress(
        id: asInt(json['id']) ?? 0,
        title: json['title'],
        examCategory: json['exam_category'],
        mode: json['mode'],
        shortDescription: json['short_description'],
        thumbnailUrl: json['thumbnail_url'],
        lessonsTotal: asInt(json['lessons_total']) ?? 0,
        lessonsCompleted: asInt(json['lessons_completed']) ?? 0,
        progressPercent: asInt(json['progress_percent']) ?? 0,
      );

  /// The older `/student/courses` shape, so Home still renders a catalogue
  /// against an API that predates the summary endpoint — without progress,
  /// which is then simply not drawn rather than drawn as zero.
  factory CourseProgress.fromEnrolled(EnrolledCourse c) => CourseProgress(
        id: c.id,
        title: c.title,
        examCategory: c.examCategory,
        mode: c.mode,
        shortDescription: c.shortDescription ?? c.description,
        thumbnailUrl: c.thumbnailUrl,
        lessonsTotal: 0,
      );
}

/// The nearest expiry across active enrollments. Orange, because access
/// running out is a deadline and not a study action.
class Entitlement {
  const Entitlement({this.batchName, this.expiresAt, required this.daysRemaining});

  final String? batchName;
  final String? expiresAt;
  final int daysRemaining;

  factory Entitlement.fromJson(Map<String, dynamic> json) => Entitlement(
        batchName: json['batch_name'],
        expiresAt: json['expires_at']?.toString(),
        daysRemaining: asInt(json['days_remaining']) ?? 0,
      );
}

class HomeSummary {
  const HomeSummary({
    this.activeSession,
    this.week = const WeekStats(),
    this.weakestTopic,
    this.courses = const [],
    this.entitlement,
    this.boardCategories = const [],
    this.windowDays = 7,
    this.degraded = false,
  });

  final ActiveSession? activeSession;
  final WeekStats week;
  final WeakestTopic? weakestTopic;
  final List<CourseProgress> courses;
  final Entitlement? entitlement;
  final List<String> boardCategories;
  final int windowDays;

  /// True when this was assembled from the older endpoints because the summary
  /// route was not there. The screen drops the blocks it cannot honestly fill
  /// rather than filling them with guesses.
  final bool degraded;

  factory HomeSummary.fromJson(Map<String, dynamic> json) => HomeSummary(
        activeSession: json['active_session'] is Map
            ? ActiveSession.fromJson(json['active_session'] as Map<String, dynamic>)
            : null,
        week: WeekStats.fromJson(json['week'] as Map<String, dynamic>?),
        weakestTopic: json['weakest_topic'] is Map
            ? WeakestTopic.fromJson(json['weakest_topic'] as Map<String, dynamic>)
            : null,
        courses: (json['courses'] as List?)
                ?.map((c) => CourseProgress.fromJson(c as Map<String, dynamic>))
                .toList() ??
            const [],
        entitlement: json['entitlement'] is Map
            ? Entitlement.fromJson(json['entitlement'] as Map<String, dynamic>)
            : null,
        boardCategories: (json['board_categories'] as List?)
                ?.map((e) => '$e')
                .where((e) => e.isNotEmpty)
                .toList() ??
            const [],
        windowDays: asInt(json['window_days']) ?? 7,
      );
}

/// A super-admin-managed Home promo banner (mirrors the web `BannerCarousel`).
/// Named `PromoBanner` to avoid colliding with Flutter's own `Banner` widget.
/// Shape comes from `GET /api/banners/public`.
class PromoBanner {
  const PromoBanner({
    required this.id,
    this.title,
    this.subtitle,
    this.kicker,
    this.ctaLabel,
    this.ctaUrl,
    this.imageUrl,
    this.examCategory,
  });

  final int id;
  final String? title;
  final String? subtitle;
  final String? kicker;
  final String? ctaLabel;
  final String? ctaUrl;
  final String? imageUrl;
  final String? examCategory;

  factory PromoBanner.fromJson(Map<String, dynamic> json) => PromoBanner(
        id: json['id'] is int ? json['id'] : int.tryParse('${json['id']}') ?? 0,
        title: json['title'],
        subtitle: json['subtitle'],
        kicker: json['kicker'],
        ctaLabel: json['cta_label'],
        ctaUrl: json['cta_url'],
        imageUrl: json['image_url'],
        examCategory: json['exam_category'],
      );
}
