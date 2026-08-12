/// Exam boards.
///
/// An aspirant scanning a list of tests is asking one thing — *is this my
/// exam?* — and a board mark answers it faster than any label can.
///
/// Two rules govern everything here, and both are about trust rather than
/// layout:
///
/// 1. **A board is never guessed.** [resolve] returns null for a category it
///    does not recognise, and the caller omits the chip. A mark on the wrong
///    row is worse than no mark.
/// 2. **A board only appears if live mocks sit behind it.** The rail is built
///    from the categories of tests the student can actually open — see
///    [railFrom] — never from this table, which is a naming registry and not a
///    catalogue.
///
/// The artwork itself is not bundled. SSC, IBPS, RRB, UPSC and the state
/// commission marks are protected, and shipping them is a decision with legal
/// weight rather than a design one — see `assets/boards/README.md` for the spec
/// and the conditions. Until a file is dropped in, every surface falls back to
/// the board's initials, which is why nothing here blocks on artwork arriving.
library;

class ExamBoard {
  const ExamBoard({required this.key, required this.label, required this.initials});

  /// Slug, and the artwork's filename.
  final String key;

  /// What the tile prints under the mark. Always shown: several board marks
  /// are unreadable at tile size, and a mark nobody can read is not a label.
  final String label;

  /// Drawn when the licensed artwork is absent.
  final String initials;

  String get assetPath => 'assets/boards/$key.png';
}

class BoardCatalog {
  BoardCatalog._();

  /// Naming registry, longest alias first so `uppsc` is not eaten by `upsc`.
  ///
  /// Order here is the order of the rail, so the national boards lead.
  static const List<ExamBoard> boards = [
    ExamBoard(key: 'ssc', label: 'SSC', initials: 'SSC'),
    ExamBoard(key: 'ibps', label: 'IBPS', initials: 'IBPS'),
    ExamBoard(key: 'sbi', label: 'SBI', initials: 'SBI'),
    ExamBoard(key: 'rrb', label: 'RRB', initials: 'RRB'),
    ExamBoard(key: 'upsc', label: 'UPSC', initials: 'UPSC'),
    ExamBoard(key: 'uppsc', label: 'UPPSC', initials: 'UPPSC'),
    ExamBoard(key: 'bpsc', label: 'BPSC', initials: 'BPSC'),
    ExamBoard(key: 'mppsc', label: 'MPPSC', initials: 'MPPSC'),
    ExamBoard(key: 'rpsc', label: 'RPSC', initials: 'RPSC'),
    ExamBoard(key: 'rsmssb', label: 'RSMSSB', initials: 'RSSB'),
    ExamBoard(key: 'upsssc', label: 'UPSSSC', initials: 'UPSSSC'),
    ExamBoard(key: 'lic', label: 'LIC', initials: 'LIC'),
    ExamBoard(key: 'nabard', label: 'NABARD', initials: 'NBRD'),
    ExamBoard(key: 'ctet', label: 'CTET', initials: 'CTET'),
    ExamBoard(key: 'reet', label: 'REET', initials: 'REET'),
    ExamBoard(key: 'nda', label: 'NDA', initials: 'NDA'),
    ExamBoard(key: 'cds', label: 'CDS', initials: 'CDS'),
    ExamBoard(key: 'afcat', label: 'AFCAT', initials: 'AFCAT'),
    ExamBoard(key: 'neet', label: 'NEET', initials: 'NEET'),
    ExamBoard(key: 'jee', label: 'JEE', initials: 'JEE'),
    ExamBoard(key: 'cuet', label: 'CUET', initials: 'CUET'),
    ExamBoard(key: 'gate', label: 'GATE', initials: 'GATE'),
    ExamBoard(key: 'cat', label: 'CAT', initials: 'CAT'),
  ];

  /// Aliases that do not contain their board's key as a substring.
  static const Map<String, String> _aliases = {
    'staffselection': 'ssc',
    'cgl': 'ssc',
    'chsl': 'ssc',
    'mts': 'ssc',
    'gd': 'ssc',
    'railway': 'rrb',
    'ntpc': 'rrb',
    'alp': 'rrb',
    'banking': 'ibps',
    'bank': 'ibps',
    'clerk': 'ibps',
    'po': 'ibps',
    'ias': 'upsc',
    'civilservices': 'upsc',
    'defence': 'nda',
    'teaching': 'ctet',
    'tet': 'ctet',
  };

  /// The board a category names, or null when it names none.
  ///
  /// Matching is on a normalised form, so `"SSC CGL Tier I"`, `"ssc-cgl"` and
  /// `"SSC_CGL"` all land on the same board. Anything unrecognised — including
  /// the very common `"GENERAL"` — resolves to null, and every caller treats
  /// null as *draw nothing*.
  static ExamBoard? resolve(String? category) {
    if (category == null) return null;
    final norm = category.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]'), '');
    if (norm.isEmpty) return null;

    // Longest key first: `uppsc` must win over `upsc` on "UPPSC RO/ARO".
    final byLength = [...boards]..sort((a, b) => b.key.length.compareTo(a.key.length));
    for (final b in byLength) {
      if (norm.contains(b.key)) return b;
    }
    for (final entry in _aliases.entries) {
      if (norm.contains(entry.key)) {
        return boards.firstWhere((b) => b.key == entry.value);
      }
    }
    return null;
  }

  /// The rail, built from what the student can actually open.
  ///
  /// [categories] should come from live tests or series — not from courses
  /// alone, and never from [boards]. A logo with an empty catalogue behind it
  /// is the fastest way to lose an aspirant's trust, and they check.
  ///
  /// Capped at eight: past that the tiles stop being scannable and the rail
  /// starts competing with the resume card for the first screenful.
  static List<ExamBoard> railFrom(Iterable<String?> categories, {int max = 8}) {
    final seen = <String>{};
    final out = <ExamBoard>[];
    for (final cat in categories) {
      final board = resolve(cat);
      if (board == null) continue;
      if (seen.add(board.key)) out.add(board);
      if (out.length >= max) break;
    }
    return out;
  }

  /// Shown wherever board marks are, and in Profile → About.
  static const String disclaimer =
      'Not affiliated with or endorsed by any examination authority.';
}
