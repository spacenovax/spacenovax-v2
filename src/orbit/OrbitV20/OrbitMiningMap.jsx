import React, { useEffect, useState } from 'react';
import { getPwaInstallState, requestPwaInstall, subscribePwaInstall } from '../../pwa.js';

const APP_DEEP_LINK = 'https://t.me/SpaceNovaXAdminBot?start=orbit';

function OrbitPartnerSlot({ language }) {
  const ko = language === 'ko';
  const [enabled, setEnabled] = useState(false);
  const [banners, setBanners] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/sponsored-banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placement: 'navigation-explore' }),
        });
        const data = await response.json();
        if (!active || !response.ok || data.ok === false) return;
        setEnabled(Boolean(data.enabled));
        setBanners(Array.isArray(data.banners) ? data.banners : []);
        setActiveIndex(0);
      } catch {
        if (!active) return;
        setEnabled(false);
        setBanners([]);
      }
    };
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = window.setInterval(() => setActiveIndex((index) => (index + 1) % banners.length), 7000);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  const banner = banners[activeIndex] || null;
  if (!enabled || !banner) return null;

  function recordClick(event) {
    const telegram = window.Telegram?.WebApp;
    if (typeof telegram?.openLink === 'function') {
      event.preventDefault();
      telegram.openLink(banner.destinationUrl);
    }
    void fetch('/api/sponsored-banners/click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bannerId: banner.id }),
    }).catch(() => {});
  }

  return <aside className="ov20-mining-sponsor" aria-label={ko ? '승인된 파트너 안내' : 'Approved partner information'}>
    <div className="ov20-mining-sponsor-label"><span>{ko ? '광고 · SPONSORED' : 'ADVERTISEMENT · SPONSORED'}</span><small>{banner.label}</small></div>
    <a href={banner.destinationUrl} target="_blank" rel="noopener noreferrer" onClick={recordClick}>
      {banner.imageUrl ? <img src={banner.imageUrl} alt={`${banner.partnerName} partner banner`} loading="lazy" /> : <span className="ov20-mining-sponsor-mark" aria-hidden="true">{String(banner.partnerName || 'P').slice(0, 1).toUpperCase()}</span>}
      <span className="ov20-mining-sponsor-copy"><b>{banner.partnerName}</b><strong>{banner.title}</strong><small>{banner.body}</small></span>
      <i aria-hidden="true">↗</i>
    </a>
    <p>{banner.disclosure}</p>
  </aside>;
}

export default function OrbitMiningMap({ language, inTelegram, onClose, onOpenMining }) {
  const ko = language === 'ko';
  const title = ko ? 'SPNX 채굴맵' : 'SPNX MINING MAP';
  const [pwa, setPwa] = useState(() => getPwaInstallState());
  const [installNote, setInstallNote] = useState('');

  useEffect(() => subscribePwaInstall(setPwa), []);

  function openOfficialApp() {
    if (inTelegram && typeof onOpenMining === 'function') {
      onOpenMining();
      return;
    }
    const telegram = window.Telegram?.WebApp;
    if (typeof telegram?.openTelegramLink === 'function') {
      telegram.openTelegramLink(APP_DEEP_LINK);
      return;
    }
    window.open(APP_DEEP_LINK, '_blank', 'noopener,noreferrer');
  }

  async function installNavigationApp() {
    const result = await requestPwaInstall();
    if (result.outcome === 'accepted') {
      setInstallNote(ko ? '설치 요청을 보냈습니다. 브라우저 안내를 완료해 주세요.' : 'Install request sent. Complete the browser prompt.');
      return;
    }
    if (result.outcome === 'installed') {
      setInstallNote(ko ? '이 기기에 이미 설치되어 있습니다.' : 'Already installed on this device.');
      return;
    }
    if (result.outcome === 'dismissed') {
      setInstallNote(ko ? '설치를 취소했습니다. 필요할 때 다시 선택할 수 있습니다.' : 'Installation was dismissed. You can choose it again later.');
      return;
    }
    setInstallNote(result.ios
      ? (ko ? 'Safari 공유 메뉴에서 “홈 화면에 추가”를 선택해 주세요.' : 'In Safari, use Share and choose “Add to Home Screen.”')
      : (ko ? '브라우저 메뉴에서 “앱 설치” 또는 “홈 화면에 추가”를 선택해 주세요.' : 'Use your browser menu and choose “Install app” or “Add to Home screen.”'));
  }

  return <div className="ov20-mining-map-layer" role="presentation">
    <button type="button" className="ov20-mining-map-scrim" onClick={onClose} aria-label={ko ? '채굴맵 닫기' : 'Close Mining Map'} />
    <section className="ov20-mining-map-card" role="dialog" aria-modal="true" aria-labelledby="ov20-mining-map-title">
      <button type="button" className="ov20-mining-map-close" onClick={onClose} aria-label={ko ? '닫기' : 'Close'}>×</button>
      <header>
        <span>SPACENOVAX DISCOVERY NETWORK</span>
        <h2 id="ov20-mining-map-title">{title}</h2>
        <p>{ko ? '무료 글로벌 길찾기에서 SpaceNovaX 공식 캡틴 네트워크로 연결됩니다.' : 'From free global navigation to the official SpaceNovaX Captain network.'}</p>
      </header>
      <div className="ov20-mining-map-status" aria-label={ko ? '서비스 구분' : 'Service separation'}>
        <article><i>◎</i><span><small>{ko ? '공개 웹' : 'PUBLIC WEB'}</small><b>{ko ? 'NOVA 길찾기 Lite' : 'NOVA Navigation Lite'}</b></span></article>
        <article><i>◈</i><span><small>{ko ? '공식 앱' : 'OFFICIAL APP'}</small><b>{ko ? '채굴 · 포인트 · 추천' : 'Mining · Points · Referral'}</b></span></article>
        <article><i>◌</i><span><small>{ko ? '캡틴 인증' : 'CAPTAIN ACCESS'}</small><b>{ko ? 'Telegram 계정 연결' : 'Telegram verified access'}</b></span></article>
      </div>
      <div className="ov20-mining-map-action">
        <button type="button" onClick={openOfficialApp}>{inTelegram ? (ko ? '채굴 화면 열기' : 'OPEN MINING SCREEN') : (ko ? '공식 앱에서 채굴 시작' : 'START IN OFFICIAL APP')} <span aria-hidden="true">→</span></button>
        <small>{ko ? '채굴·포인트·지갑·추천 보상은 공식 Telegram Captain 인증 후에만 활성화됩니다.' : 'Mining, points, wallet, and referral rewards activate only after official Telegram Captain verification.'}</small>
      </div>
      {!inTelegram && !pwa.installed && <div className="ov20-mining-pwa-action">
        <button type="button" onClick={installNavigationApp}>⇩ {pwa.available ? (ko ? 'NOVA 길찾기 설치' : 'INSTALL NOVA NAVIGATION') : (ko ? '홈 화면에 설치' : 'ADD TO HOME SCREEN')}</button>
        <small>{installNote || (ko ? '길찾기 웹앱만 설치됩니다. 채굴·지갑·추천 기능은 공식 Telegram 앱에서만 이용할 수 있습니다.' : 'This installs navigation only. Mining, wallet, and referral features remain in the official Telegram app.')}</small>
      </div>}
      <OrbitPartnerSlot language={language} />
    </section>
  </div>;
}
