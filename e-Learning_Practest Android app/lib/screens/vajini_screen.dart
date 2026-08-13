import 'package:flutter/material.dart';

import '../api_client.dart';
import '../theme.dart';

/// VAJINI — the AI study companion. Ported from the web SPA's `pages/Vajini.jsx`.
///
/// Chat over course content (RAG): the composer posts to
/// `POST /student/vajini/chat`, which retrieves the most relevant
/// course/question chunks and answers from them. The reply carries the sources
/// it drew on, shown as chips under the bubble.
///
/// Degrades honestly: a 503 (Vajini not configured / upstream down) surfaces as
/// an error bubble, not a crash.
///
/// This is a deliberately branded surface — a soft violet ground with dark ink,
/// the same in both themes — because Vajini is the one violet→blue thing in the
/// product (see [AppTheme.violetGradient]) and the guide keeps it distinct from
/// the deep-ink study surfaces around it.
class VajiniScreen extends StatefulWidget {
  const VajiniScreen({super.key});

  @override
  State<VajiniScreen> createState() => _VajiniScreenState();
}

class _VajiniScreenState extends State<VajiniScreen> {
  static const _ink = Color(0xFF1E1B3A);
  static const _violetInk = Color(0xFF6D28D9);
  static const _muted = Color(0xFF7C7AA8);

  final _controller = TextEditingController();
  final _scroll = ScrollController();

  final List<_ChatMessage> _messages = [
    const _ChatMessage(
      role: 'assistant',
      content:
          "Hi 👋 I'm Vajini. Ask me to explain a concept, solve a doubt, "
          'or plan your study — I answer from your course material.',
    ),
  ];
  bool _loading = false;

  @override
  void dispose() {
    _controller.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _scrollToEnd() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scroll.hasClients) return;
      _scroll.animateTo(
        _scroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  Future<void> _send() async {
    final message = _controller.text.trim();
    if (message.isEmpty || _loading) return;

    // The turns we send as context: real exchanges only, no error bubbles.
    final history = _messages
        .where((m) => !m.isError)
        .map((m) => {'role': m.role, 'content': m.content})
        .toList();

    setState(() {
      _messages.add(_ChatMessage(role: 'user', content: message));
      _controller.clear();
      _loading = true;
    });
    _scrollToEnd();

    try {
      final data = await ApiClient.instance.post(
        '/student/vajini/chat',
        body: {'message': message, 'history': history},
      );
      final sources =
          (data['sources'] as List?)
              ?.map((s) => s is Map ? '${s['title'] ?? ''}' : '$s')
              .where((s) => s.isNotEmpty)
              .toList() ??
          const <String>[];
      if (!mounted) return;
      setState(() {
        _messages.add(
          _ChatMessage(
            role: 'assistant',
            content: '${data['reply'] ?? ''}',
            sources: sources,
          ),
        );
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _messages.add(
          const _ChatMessage(
            role: 'assistant',
            content: 'Vajini could not answer just now. Please try again.',
            isError: true,
          ),
        );
        _loading = false;
      });
    }
    _scrollToEnd();
  }

  @override
  Widget build(BuildContext context) {
    final canSend = _controller.text.trim().isNotEmpty && !_loading;
    return Material(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFFECE9FB), Color(0xFFE7EEFF), Color(0xFFE9F0FF)],
            stops: [0.0, 0.6, 1.0],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              Expanded(
                child: ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(16, 18, 16, 8),
                  itemCount: _messages.length + (_loading ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i >= _messages.length) return _thinkingBubble();
                    return _bubble(_messages[i]);
                  },
                ),
              ),
              _composer(canSend),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Container(
      padding: const EdgeInsets.fromLTRB(12, 8, 16, 12),
      decoration: const BoxDecoration(
        color: Color(0x8CFFFFFF),
        border: Border(bottom: BorderSide(color: Color(0x1F3B6FF6))),
      ),
      child: Row(
        children: [
          InkWell(
            onTap: () => Navigator.of(context).maybePop(),
            borderRadius: BorderRadius.circular(11),
            child: Container(
              width: 38,
              height: 38,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: const Color(0x1A8B5CF6),
                borderRadius: BorderRadius.circular(11),
                border: Border.all(color: const Color(0x338B5CF6)),
              ),
              child: const Icon(Icons.arrow_back, size: 20, color: _violetInk),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 42,
            height: 42,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: AppTheme.violetGradient),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(
              Icons.smart_toy_rounded,
              size: 23,
              color: Colors.white,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Vajini',
                  style: TextStyle(
                    fontFamily: AppFont.display,
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: _ink,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: const [
                    _Dot(),
                    SizedBox(width: 5),
                    Text(
                      'Your 24×7 study buddy',
                      style: TextStyle(
                        fontFamily: AppFont.ui,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: _violetInk,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bubble(_ChatMessage m) {
    if (m.role == 'user') {
      return Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            Flexible(
              child: Container(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.sizeOf(context).width * 0.82,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 15,
                  vertical: 12,
                ),
                decoration: const BoxDecoration(
                  gradient: LinearGradient(colors: AppTheme.violetGradient),
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(18),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(5),
                  ),
                ),
                child: Text(
                  m.content,
                  style: const TextStyle(
                    fontFamily: AppFont.ui,
                    fontSize: 14,
                    height: 1.5,
                    fontWeight: FontWeight.w600,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _avatar(),
          const SizedBox(width: 9),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  constraints: BoxConstraints(
                    maxWidth: MediaQuery.sizeOf(context).width * 0.78,
                  ),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 15,
                    vertical: 13,
                  ),
                  decoration: BoxDecoration(
                    color: m.isError ? const Color(0xFFFEF2F2) : Colors.white,
                    borderRadius: const BorderRadius.only(
                      topLeft: Radius.circular(18),
                      topRight: Radius.circular(18),
                      bottomLeft: Radius.circular(5),
                      bottomRight: Radius.circular(18),
                    ),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1A3B6FF6),
                        blurRadius: 18,
                        offset: Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Text(
                    m.content,
                    style: TextStyle(
                      fontFamily: AppFont.ui,
                      fontSize: 14,
                      height: 1.5,
                      fontWeight: FontWeight.w600,
                      color: m.isError ? const Color(0xFFB42318) : _ink,
                    ),
                  ),
                ),
                if (m.sources.isNotEmpty) ...[
                  const SizedBox(height: 7),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Text(
                        'BASED ON',
                        style: TextStyle(
                          fontFamily: AppFont.ui,
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 0.4,
                          color: _muted,
                        ),
                      ),
                      for (final s in m.sources) _SourceChip(label: s),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _thinkingBubble() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          _avatar(),
          const SizedBox(width: 9),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(18),
                topRight: Radius.circular(18),
                bottomLeft: Radius.circular(5),
                bottomRight: Radius.circular(18),
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x1A3B6FF6),
                  blurRadius: 18,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: const Text(
              'Vajini is thinking…',
              style: TextStyle(
                fontFamily: AppFont.ui,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: _muted,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _avatar() {
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: AppTheme.violetGradient),
        borderRadius: BorderRadius.circular(10),
      ),
      child: const Icon(Icons.smart_toy_rounded, size: 16, color: Colors.white),
    );
  }

  Widget _composer(bool canSend) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 12),
      child: Column(
        children: [
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x1A3B6FF6),
                        blurRadius: 18,
                        offset: Offset(0, 6),
                      ),
                    ],
                  ),
                  child: TextField(
                    controller: _controller,
                    minLines: 1,
                    maxLines: 4,
                    textInputAction: TextInputAction.send,
                    onChanged: (_) => setState(() {}),
                    onSubmitted: (_) => _send(),
                    style: const TextStyle(
                      fontFamily: AppFont.ui,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: _ink,
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      filled: false,
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(vertical: 14),
                      hintText: 'Ask Vajini anything…',
                      hintStyle: TextStyle(
                        fontFamily: AppFont.ui,
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: _muted,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Opacity(
                opacity: canSend ? 1 : 0.55,
                child: InkWell(
                  onTap: canSend ? _send : null,
                  borderRadius: BorderRadius.circular(16),
                  child: Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: AppTheme.violetGradient,
                      ),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Icon(
                      Icons.send_rounded,
                      size: 20,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          const Text(
            'Vajini can make mistakes — double-check important facts.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontFamily: AppFont.ui,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: _muted,
            ),
          ),
        ],
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 7,
      height: 7,
      decoration: const BoxDecoration(
        color: Color(0xFF0B9E6D),
        shape: BoxShape.circle,
      ),
    );
  }
}

class _SourceChip extends StatelessWidget {
  const _SourceChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0x1A8B5CF6),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0x338B5CF6)),
      ),
      child: Text(
        label,
        style: const TextStyle(
          fontFamily: AppFont.ui,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: Color(0xFF6D28D9),
        ),
      ),
    );
  }
}

class _ChatMessage {
  const _ChatMessage({
    required this.role,
    required this.content,
    this.sources = const [],
    this.isError = false,
  });

  final String role;
  final String content;
  final List<String> sources;
  final bool isError;
}
