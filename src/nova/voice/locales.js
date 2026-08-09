export const NOVA_SPEECH_LOCALES = Object.freeze({
  en: 'en-US', ko: 'ko-KR', ja: 'ja-JP', zh: 'zh-CN', es: 'es-ES',
  pt: 'pt-BR', de: 'de-DE', fr: 'fr-FR', ru: 'ru-RU', vi: 'vi-VN', id: 'id-ID',
});

export const normalizeNOVAFontLanguage = (language) => (
  NOVA_SPEECH_LOCALES[String(language || '').toLowerCase()] ? String(language).toLowerCase() : 'en'
);
