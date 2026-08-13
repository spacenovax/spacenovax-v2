const PUBLIC_REFERRAL_ORIGIN = 'https://app.spacenovax.com';

export const REFERRAL_SHARE_COPY = {
  en: {
    title: 'Mine with SpaceNovaX',
    message: (code, link) => [
      '🚀 Mine together on SpaceNovaX!',
      'Join my fleet and mine SPNX Points every day.',
      '',
      '🎁 Invite code: ' + code,
      '⛏️ Tap the link below to start mining.',
      link,
    ].join('\n'),
    copied: 'Your personal invitation message was copied.',
    shared: 'Your personal mining invitation was shared.',
    unavailable: 'Your personal invitation is still synchronizing. Please try again shortly.',
    failed: 'Could not copy the invitation message. Please try again.',
  },
  ko: {
    title: 'SpaceNovaX 함께 채굴하기',
    message: (code, link) => [
      '🚀 SpaceNovaX에서 함께 채굴하세요!',
      '지금 함대에 합류하고 매일 SPNX 포인트를 채굴해 보세요.',
      '',
      '🎁 초대 코드: ' + code,
      '⛏️ 아래 링크를 눌러 채굴을 시작하세요.',
      link,
    ].join('\n'),
    copied: '개인 초대 문구를 복사했습니다.',
    shared: '개인 채굴 초대를 공유했습니다.',
    unavailable: '개인 초대 링크를 동기화하는 중입니다. 잠시 후 다시 시도하세요.',
    failed: '초대 문구를 복사하지 못했습니다. 다시 시도하세요.',
  },
  ja: {
    title: 'SpaceNovaXで一緒にマイニング',
    message: (code, link) => [
      '🚀 SpaceNovaXで一緒にマイニングしよう！',
      '今すぐ艦隊に参加して、毎日SPNXポイントをマイニングしましょう。',
      '',
      '🎁 招待コード: ' + code,
      '⛏️ 下のリンクをタップしてマイニングを始めましょう。',
      link,
    ].join('\n'),
    copied: 'あなた専用の招待メッセージをコピーしました。',
    shared: 'あなた専用のマイニング招待を共有しました。',
    unavailable: '個人招待リンクを同期しています。少ししてからもう一度お試しください。',
    failed: '招待メッセージをコピーできませんでした。もう一度お試しください。',
  },
  zh: {
    title: '与 SpaceNovaX 一起挖矿',
    message: (code, link) => [
      '🚀 一起在 SpaceNovaX 挖矿吧！',
      '立即加入我的舰队，每天挖掘 SPNX 积分。',
      '',
      '🎁 邀请码：' + code,
      '⛏️ 点击下方链接开始挖矿。',
      link,
    ].join('\n'),
    copied: '已复制您的专属邀请文案。',
    shared: '已分享您的专属挖矿邀请。',
    unavailable: '正在同步您的专属邀请链接，请稍后再试。',
    failed: '无法复制邀请文案，请重试。',
  },
  es: {
    title: 'Mina con SpaceNovaX',
    message: (code, link) => [
      '🚀 ¡Minemos juntos en SpaceNovaX!',
      'Únete a mi flota y mina puntos SPNX todos los días.',
      '',
      '🎁 Código de invitación: ' + code,
      '⛏️ Pulsa el enlace de abajo para comenzar a minar.',
      link,
    ].join('\n'),
    copied: 'Se copió tu mensaje de invitación personal.',
    shared: 'Se compartió tu invitación personal de minería.',
    unavailable: 'Tu enlace personal se está sincronizando. Inténtalo de nuevo en un momento.',
    failed: 'No se pudo copiar el mensaje de invitación. Inténtalo de nuevo.',
  },
  pt: {
    title: 'Minere com a SpaceNovaX',
    message: (code, link) => [
      '🚀 Vamos minerar juntos na SpaceNovaX!',
      'Entre para a minha frota e minere pontos SPNX todos os dias.',
      '',
      '🎁 Código de convite: ' + code,
      '⛏️ Toque no link abaixo para começar a minerar.',
      link,
    ].join('\n'),
    copied: 'Sua mensagem de convite pessoal foi copiada.',
    shared: 'Seu convite pessoal de mineração foi compartilhado.',
    unavailable: 'Seu link pessoal está sendo sincronizado. Tente novamente em instantes.',
    failed: 'Não foi possível copiar a mensagem de convite. Tente novamente.',
  },
  de: {
    title: 'Mit SpaceNovaX minen',
    message: (code, link) => [
      '🚀 Lass uns gemeinsam auf SpaceNovaX minen!',
      'Tritt meiner Flotte bei und mine täglich SPNX-Punkte.',
      '',
      '🎁 Einladungscode: ' + code,
      '⛏️ Tippe auf den Link unten, um mit dem Mining zu beginnen.',
      link,
    ].join('\n'),
    copied: 'Deine persönliche Einladungsnachricht wurde kopiert.',
    shared: 'Deine persönliche Mining-Einladung wurde geteilt.',
    unavailable: 'Dein persönlicher Link wird noch synchronisiert. Bitte versuche es gleich erneut.',
    failed: 'Die Einladungsnachricht konnte nicht kopiert werden. Bitte versuche es erneut.',
  },
  fr: {
    title: 'Miner avec SpaceNovaX',
    message: (code, link) => [
      '🚀 Minons ensemble sur SpaceNovaX !',
      'Rejoignez ma flotte et minez des points SPNX chaque jour.',
      '',
      '🎁 Code d’invitation : ' + code,
      '⛏️ Touchez le lien ci-dessous pour commencer à miner.',
      link,
    ].join('\n'),
    copied: 'Votre message d’invitation personnel a été copié.',
    shared: 'Votre invitation personnelle de minage a été partagée.',
    unavailable: 'Votre lien personnel est en cours de synchronisation. Réessayez dans un instant.',
    failed: 'Impossible de copier le message d’invitation. Réessayez.',
  },
  ru: {
    title: 'Майнинг с SpaceNovaX',
    message: (code, link) => [
      '🚀 Давайте майнить вместе в SpaceNovaX!',
      'Присоединяйтесь к моему флоту и добывайте SPNX Points каждый день.',
      '',
      '🎁 Код приглашения: ' + code,
      '⛏️ Нажмите ссылку ниже, чтобы начать майнинг.',
      link,
    ].join('\n'),
    copied: 'Ваше персональное приглашение скопировано.',
    shared: 'Ваше персональное приглашение на майнинг отправлено.',
    unavailable: 'Ваша персональная ссылка синхронизируется. Повторите попытку чуть позже.',
    failed: 'Не удалось скопировать текст приглашения. Повторите попытку.',
  },
  vi: {
    title: 'Khai thác cùng SpaceNovaX',
    message: (code, link) => [
      '🚀 Hãy cùng khai thác trên SpaceNovaX!',
      'Hãy tham gia hạm đội của tôi và khai thác Điểm SPNX mỗi ngày.',
      '',
      '🎁 Mã mời: ' + code,
      '⛏️ Nhấn liên kết bên dưới để bắt đầu khai thác.',
      link,
    ].join('\n'),
    copied: 'Đã sao chép lời mời cá nhân của bạn.',
    shared: 'Đã chia sẻ lời mời khai thác cá nhân của bạn.',
    unavailable: 'Liên kết cá nhân đang được đồng bộ. Vui lòng thử lại sau ít phút.',
    failed: 'Không thể sao chép lời mời. Vui lòng thử lại.',
  },
  id: {
    title: 'Menambang bersama SpaceNovaX',
    message: (code, link) => [
      '🚀 Mari menambang bersama di SpaceNovaX!',
      'Bergabunglah dengan armada saya dan tambang Poin SPNX setiap hari.',
      '',
      '🎁 Kode undangan: ' + code,
      '⛏️ Ketuk tautan di bawah untuk mulai menambang.',
      link,
    ].join('\n'),
    copied: 'Pesan undangan pribadi Anda telah disalin.',
    shared: 'Undangan penambangan pribadi Anda telah dibagikan.',
    unavailable: 'Tautan pribadi Anda sedang disinkronkan. Silakan coba lagi sebentar lagi.',
    failed: 'Pesan undangan tidak dapat disalin. Silakan coba lagi.',
  },
  ar: {
    title: 'التعدين مع SpaceNovaX',
    message: (code, link) => [
      '🚀 لنعدّن معًا على SpaceNovaX!',
      'انضم إلى أسطولي وعدّن نقاط SPNX كل يوم.',
      '',
      '🎁 رمز الدعوة: ' + code,
      '⛏️ اضغط الرابط أدناه لبدء التعدين.',
      link,
    ].join('\n'),
    copied: 'تم نسخ رسالة دعوتك الشخصية.',
    shared: 'تمت مشاركة دعوتك الشخصية للتعدين.',
    unavailable: 'يجري مزامنة رابط دعوتك الشخصي. حاول مرة أخرى بعد قليل.',
    failed: 'تعذر نسخ رسالة الدعوة. حاول مرة أخرى.',
  },
};

export function normalizeReferralCode(value = '') {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32);
}

export function buildPublicReferralLink(code = '', preferredLink = '') {
  const normalizedCode = normalizeReferralCode(code);
  if (!normalizedCode) return '';
  const expectedPath = '/join/' + encodeURIComponent(normalizedCode);
  try {
    const candidate = new URL(String(preferredLink || ''));
    if (candidate.protocol === 'https:' && candidate.hostname === 'app.spacenovax.com' && candidate.pathname === expectedPath) {
      return PUBLIC_REFERRAL_ORIGIN + expectedPath;
    }
  } catch {}
  return PUBLIC_REFERRAL_ORIGIN + expectedPath;
}

export function buildReferralInvitation({ language = 'en', code = '', link = '' } = {}) {
  const normalizedCode = normalizeReferralCode(code);
  const referralLink = buildPublicReferralLink(normalizedCode, link);
  const copy = REFERRAL_SHARE_COPY[language] || REFERRAL_SHARE_COPY.en;
  return {
    code: normalizedCode,
    link: referralLink,
    title: copy.title,
    text: normalizedCode && referralLink ? copy.message(normalizedCode, referralLink) : '',
    notices: {
      copied: copy.copied,
      shared: copy.shared,
      unavailable: copy.unavailable,
      failed: copy.failed,
    },
  };
}

export async function copyReferralText(text = '') {
  const value = String(text || '');
  if (!value) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {}
  if (typeof document === 'undefined') return false;
  const field = document.createElement('textarea');
  field.value = value;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
  document.body.appendChild(field);
  field.select();
  field.setSelectionRange(0, value.length);
  const copied = Boolean(document.execCommand?.('copy'));
  field.remove();
  return copied;
}

export async function shareReferralInvitation(invitation) {
  if (!invitation?.text) return 'failed';
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share({ title: invitation.title, text: invitation.text });
    return 'shared';
  }
  return (await copyReferralText(invitation.text)) ? 'copied' : 'failed';
}
