/* ============================================================
   READ ALOUD — the Web Speech API, with the edges filed off.
   ------------------------------------------------------------
   Browser TTS rather than a server voice, on purpose. It costs nothing
   per minute, works offline once the voice is installed, and — the part
   that matters for this audience — Android ships Hindi and several
   Indian-English voices, so a Hindi booklet is read in Hindi rather
   than by an English voice sounding out Devanagari transliterated
   badly.

   Two things this works around:

   · Chrome stops speaking after roughly 15 seconds of a single long
     utterance. The text is therefore split into sentence-sized chunks
     and queued, which also makes pause/resume land on a sentence
     boundary rather than mid-word.

   · Voices load asynchronously and `getVoices()` returns an empty list
     on first call in most browsers, so the voice is resolved at speak
     time and the `voiceschanged` event is honoured.
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';

const CHUNK_LIMIT = 220;

/** Split on sentence ends, then hard-wrap anything still too long. */
function chunk(text) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?।॥])\s+/)     // Devanagari danda and double danda included
    .filter(Boolean);

  const out = [];
  let buffer = '';

  for (const s of sentences) {
    if ((buffer + ' ' + s).trim().length <= CHUNK_LIMIT) {
      buffer = (buffer + ' ' + s).trim();
      continue;
    }
    if (buffer) out.push(buffer);
    if (s.length <= CHUNK_LIMIT) {
      buffer = s;
    } else {
      // A wall of text with no sentence ends — a table of contents, a
      // scanned page with broken punctuation. Wrap on word boundaries.
      const words = s.split(' ');
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > CHUNK_LIMIT) { out.push(line.trim()); line = w; }
        else line = (line + ' ' + w).trim();
      }
      buffer = line;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

export function useSpeech() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [speaking, setSpeaking] = useState(false);
  const queue = useRef([]);
  const stopped = useRef(false);

  const stop = useCallback(() => {
    if (!supported) return;
    stopped.current = true;
    queue.current = [];
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback((text, langHint) => {
    if (!supported || !text?.trim()) return;

    stopped.current = false;
    window.speechSynthesis.cancel();
    queue.current = chunk(text);

    const voices = window.speechSynthesis.getVoices();
    // The document's language if we were told one, else whatever the app
    // is currently in — never a hardcoded en-US, which is what makes a
    // Hindi booklet unlistenable.
    const lang = langHint || document.documentElement.lang || 'en-IN';
    const voice = voices.find((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase()))
      ?? voices.find((v) => v.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
      ?? null;

    const next = () => {
      if (stopped.current) return;
      const part = queue.current.shift();
      if (!part) { setSpeaking(false); return; }

      const utter = new SpeechSynthesisUtterance(part);
      if (voice) utter.voice = voice;
      utter.lang = voice?.lang || lang;
      utter.rate = 0.98;
      utter.onend = next;
      // An error on one chunk (an unsupported character, a voice that
      // dropped out) skips to the next rather than ending the reading.
      utter.onerror = next;
      window.speechSynthesis.speak(utter);
    };

    setSpeaking(true);
    next();
  }, [supported]);

  // Voices arriving late must not leave a first "Listen" tap silent, and
  // leaving the reader must not leave a voice talking to an empty page.
  useEffect(() => {
    if (!supported) return undefined;
    const warm = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', warm);
    return () => {
      window.speechSynthesis.removeEventListener?.('voiceschanged', warm);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { supported, speaking, speak, stop };
}
