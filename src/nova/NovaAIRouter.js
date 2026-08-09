import { NovaCacheStore, normalizeNOVAQuestion } from './cache/NovaCacheStore.js';
import { FAQEngine } from './engines/FAQEngine.js';
import { RuleEngine } from './engines/RuleEngine.js';
import { GeminiTextProvider } from './providers/GeminiTextProvider.js';
import { BrowserSpeechProvider } from './voice/BrowserSpeechProvider.js';
import { LocalAudioProvider } from './voice/LocalAudioProvider.js';

const PAUSED_REPLY = {
  en: 'NOVA voice and live AI are paused while this browser is in the background.',
  ko: '브라우저가 백그라운드 상태여서 NOVA 음성과 실시간 AI가 일시 중지되었습니다.',
};

/**
 * Free-first NOVA router. Order is response cache → FAQ → rule engine →
 * text-only provider. Per-captain queue guarantees a maximum of one live
 * Gemini request at a time in this browser.
 */
export class NovaAIRouter {
  constructor({ request, clientKey = 'default' }) {
    this.cache = new NovaCacheStore(clientKey);
    this.faq = new FAQEngine();
    this.rules = new RuleEngine();
    this.gemini = new GeminiTextProvider(request);
    this.browserSpeech = new BrowserSpeechProvider();
    this.localAudio = new LocalAudioProvider();
    this.queues = new Map();
    this.visible = typeof document === 'undefined' ? true : !document.hidden;
    this.onVisibilityChange = () => {
      this.visible = !document.hidden;
      if (!this.visible) this.stopVoice();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  dispose() {
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
    this.stopVoice();
  }

  stopVoice() {
    this.browserSpeech.stop();
    this.localAudio.stop();
  }

  speak({ text, language, event, rate, onStart, onEnd, onError }) {
    if (!this.visible) return false;
    const speakBrowser = () => this.browserSpeech.speak({ text, language, rate, onStart, onEnd, onError });
    const localEvent = event || this.localAudio.inferEvent(text);
    if (!localEvent) return speakBrowser();
    this.localAudio.play(localEvent, { onStart, onEnd, onError: () => {} }).then((played) => { if (!played) speakBrowser(); });
    return true;
  }

  listen(options) {
    if (!this.visible) return false;
    return this.browserSpeech.listen(options);
  }

  ask({ question, language = 'en', history = [], captainContext = {}, clientKey = 'default' }) {
    if (!this.visible) return Promise.resolve({ reply: PAUSED_REPLY[language] || PAUSED_REPLY.en, source: 'paused' });
    const normalized = normalizeNOVAQuestion(question);
    if (!normalized) return Promise.resolve({ reply: '', source: 'empty' });
    const cacheKey = `${language}:${normalized}`;
    const cached = this.cache.get('response', cacheKey);
    if (cached) return Promise.resolve({ ...cached, source: 'cache' });
    const local = this.faq.answer(normalized, language) || this.rules.answer(normalized, language);
    if (local) {
      this.cache.set('faq', cacheKey, local);
      this.cache.set('response', cacheKey, local);
      return Promise.resolve(local);
    }
    const previous = this.queues.get(clientKey) || Promise.resolve();
    const task = previous.catch(() => undefined).then(async () => {
      if (!this.visible) return { reply: PAUSED_REPLY[language] || PAUSED_REPLY.en, source: 'paused' };
      const reply = await this.gemini.ask({ message: question, language, history, captainContext });
      if (reply.reply) this.cache.set('response', cacheKey, reply);
      return reply;
    });
    const tracked = task.finally(() => {
      if (this.queues.get(clientKey) === tracked) this.queues.delete(clientKey);
    });
    this.queues.set(clientKey, tracked);
    return task;
  }
}
