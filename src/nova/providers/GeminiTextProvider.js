/** Final text-only provider. The client never receives a Gemini identity or key. */
export class GeminiTextProvider {
  constructor(request) { this.request = request; }

  async ask(payload) {
    const result = await this.request('/api/nova/chat', {
      method: 'POST',
      body: payload,
    });
    return { reply: result.reply || result.message || '', source: 'gemini', usage: result.usage };
  }
}
