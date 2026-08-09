import { NOVA_SPEECH_LOCALES, normalizeNOVAFontLanguage } from './locales.js';

/** Free, browser-native speech provider. It never makes a network request. */
export class BrowserSpeechProvider {
  constructor() {
    this.synthesis = typeof window === 'undefined' ? null : window.speechSynthesis;
    this.Utterance = typeof window === 'undefined' ? null : window.SpeechSynthesisUtterance;
    this.activeRecognition = null;
  }

  canSpeak() {
    return Boolean(this.synthesis && this.Utterance);
  }

  canListen() {
    return typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  voices() {
    return this.synthesis?.getVoices?.() || [];
  }

  getVoice(language) {
    const locale = NOVA_SPEECH_LOCALES[normalizeNOVAFontLanguage(language)];
    const prefix = locale.slice(0, 2).toLowerCase();
    return this.voices().find((voice) => voice.lang?.toLowerCase() === locale.toLowerCase())
      || this.voices().find((voice) => voice.lang?.toLowerCase().startsWith(prefix))
      || null;
  }

  stop() {
    this.synthesis?.cancel?.();
    this.activeRecognition?.stop?.();
    this.activeRecognition = null;
  }

  speak({ text, language = 'en', rate = 0.95, onStart, onEnd, onError } = {}) {
    if (!this.canSpeak() || document.hidden) return false;
    const value = String(text || '').trim();
    if (!value) return false;
    try {
      const voice = this.getVoice(language);
      const utterance = new this.Utterance(value);
      utterance.lang = voice?.lang || NOVA_SPEECH_LOCALES[normalizeNOVAFontLanguage(language)];
      utterance.voice = voice;
      utterance.rate = rate;
      utterance.pitch = 1;
      utterance.volume = 1;
      utterance.onstart = () => onStart?.();
      utterance.onend = () => onEnd?.();
      utterance.onerror = (event) => onError?.(event?.error || 'speech-error');
      this.synthesis.cancel();
      this.synthesis.resume?.();
      this.synthesis.speak(utterance);
      return true;
    } catch (error) {
      onError?.(error?.message || 'speech-error');
      return false;
    }
  }

  listen({ language = 'en', onStart, onResult, onEnd, onError } = {}) {
    if (!this.canListen() || document.hidden) return false;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    try {
      const recognition = new Recognition();
      this.activeRecognition = recognition;
      recognition.lang = NOVA_SPEECH_LOCALES[normalizeNOVAFontLanguage(language)];
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onstart = () => onStart?.();
      recognition.onresult = (event) => onResult?.(Array.from(event.results).map((item) => item[0]?.transcript || '').join(''));
      recognition.onerror = (event) => onError?.(event?.error || 'recognition-error');
      recognition.onend = () => {
        if (this.activeRecognition === recognition) this.activeRecognition = null;
        onEnd?.();
      };
      recognition.start();
      return true;
    } catch (error) {
      onError?.(error?.message || 'recognition-error');
      return false;
    }
  }
}
