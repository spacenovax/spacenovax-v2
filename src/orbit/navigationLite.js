// Lightweight, browser-only turn guidance helpers.  These deliberately avoid
// traffic claims or paid SDKs: they only match a device GPS position to the
// current OSRM route and calculate the next maneuver on that route.

const EARTH_RADIUS_M = 6371008.8;

// Core guidance is intentionally available in every language offered by the
// SpaceNovaX app.  A device may not have every system voice installed, but the
// words handed to the browser speech engine are always in the captain's chosen
// language (with English as a safe fallback).
const LITE_COPY = {
  en: {
    uturn: 'make a U-turn', roundabout: 'enter the roundabout', left: 'turn left', right: 'turn right', merge: 'merge', straight: 'continue straight',
    locationRequired: 'Captain, allow location access before starting live guidance.',
    routeLoading: 'Captain, the driving route is still calculating. Please start again in a moment.',
    start: 'Captain, NOVA is starting route guidance. {destination} is {kilometers} kilometers away.',
    startSaved: 'Captain, NOVA is starting guidance using a saved route. Check the route carefully when you reconnect.',
    firstInstruction: 'The next instruction is {direction}.',
    roadDirection: 'Toward {road}.',
    ended: 'Captain, navigation guidance has ended.',
    offRoute: 'Captain, you are off route. NOVA is finding a new route.',
    arrived: 'Captain, you have arrived at your destination. You can end NOVA guidance now.',
    routeSaved: 'Captain, the route was saved on this device for a low-data reconnect.',
    reportReceived: 'Thank you. Your map report was sent without your exact location.',
  },
  ko: {
    uturn: '유턴', roundabout: '로터리 진입', left: '좌회전', right: '우회전', merge: '합류', straight: '직진',
    locationRequired: 'Captain, 실제 위치를 기준으로 안내하려면 위치 권한을 허용해 주세요.',
    routeLoading: 'Captain, 자동차 도로 경로를 계산 중입니다. 잠시 후 다시 시작해 주세요.',
    start: 'Captain, NOVA가 경로 안내를 시작합니다. {destination}까지 {kilometers}킬로미터입니다.',
    startSaved: 'Captain, 저장된 경로로 안내를 시작합니다. 다시 연결되면 경로를 꼭 확인해 주세요.',
    firstInstruction: '다음 안내는 {direction}입니다.',
    roadDirection: '{road} 방향입니다.',
    ended: 'Captain, 경로 안내를 종료했습니다.',
    offRoute: 'Captain, 현재 경로를 벗어났습니다. NOVA가 새 경로를 탐색합니다.',
    arrived: 'Captain, 목적지에 도착했습니다. NOVA 경로 안내를 종료할 수 있습니다.',
    routeSaved: 'Captain, 저데이터 재연결을 위해 이 기기에 경로를 저장했습니다.',
    reportReceived: '감사합니다. 정확한 위치를 저장하지 않고 지도 오류 신고를 보냈습니다.',
  },
  ja: {
    uturn: 'Uターン', roundabout: 'ロータリーに進入', left: '左折', right: '右折', merge: '合流', straight: '直進',
    locationRequired: 'Captain、現在地に基づく案内には位置情報の許可が必要です。',
    routeLoading: 'Captain、道路ルートを計算中です。少し待ってからもう一度開始してください。',
    start: 'Captain、NOVAが経路案内を開始します。{destination}まで{kilometers}キロです。',
    startSaved: 'Captain、保存された経路で案内を開始します。再接続時に経路を確認してください。',
    firstInstruction: '次の案内は{direction}です。', roadDirection: '{road}方面です。',
    ended: 'Captain、経路案内を終了しました。', offRoute: 'Captain、経路を外れました。NOVAが新しい経路を探します。',
    arrived: 'Captain、目的地に到着しました。NOVAの案内を終了できます。',
    routeSaved: 'Captain、低データ再接続用にこの端末へ経路を保存しました。', reportReceived: 'ありがとうございます。正確な位置を保存せずに地図報告を送りました。',
  },
  zh: {
    uturn: '掉头', roundabout: '进入环岛', left: '左转', right: '右转', merge: '并入车道', straight: '直行',
    locationRequired: 'Captain，开始实时导航前请允许位置权限。', routeLoading: 'Captain，正在计算道路路线，请稍后再开始。',
    start: 'Captain，NOVA 开始路线导航。距离 {destination} 约 {kilometers} 公里。', startSaved: 'Captain，NOVA 正在使用已保存路线导航。重新联网后请确认路线。',
    firstInstruction: '下一步是{direction}。', roadDirection: '前往{road}。', ended: 'Captain，路线导航已结束。',
    offRoute: 'Captain，您已偏离路线。NOVA 正在重新规划路线。', arrived: 'Captain，您已到达目的地，可以结束 NOVA 导航。',
    routeSaved: 'Captain，路线已保存在此设备上，便于低流量重新连接。', reportReceived: '谢谢。地图报告已发送，未保存您的精确位置。',
  },
  es: {
    uturn: 'dar la vuelta', roundabout: 'entrar en la rotonda', left: 'girar a la izquierda', right: 'girar a la derecha', merge: 'incorporarse', straight: 'seguir recto',
    locationRequired: 'Capitán, permita el acceso a la ubicación antes de iniciar la guía en vivo.', routeLoading: 'Capitán, la ruta por carretera aún se está calculando. Inténtelo de nuevo en un momento.',
    start: 'Capitán, NOVA inicia la guía de ruta. {destination} está a {kilometers} kilómetros.', startSaved: 'Capitán, NOVA inicia la guía con una ruta guardada. Verifique la ruta cuando vuelva a conectarse.',
    firstInstruction: 'La siguiente indicación es {direction}.', roadDirection: 'Hacia {road}.', ended: 'Capitán, la guía de navegación ha terminado.',
    offRoute: 'Capitán, se ha salido de la ruta. NOVA busca una ruta nueva.', arrived: 'Capitán, ha llegado al destino. Puede finalizar la guía de NOVA.',
    routeSaved: 'Capitán, la ruta se guardó en este dispositivo para reconectarse con pocos datos.', reportReceived: 'Gracias. Su reporte de mapa se envió sin guardar su ubicación exacta.',
  },
  pt: {
    uturn: 'fazer retorno', roundabout: 'entrar na rotatória', left: 'virar à esquerda', right: 'virar à direita', merge: 'entrar na via', straight: 'seguir em frente',
    locationRequired: 'Capitão, permita o acesso à localização antes de iniciar a orientação ao vivo.', routeLoading: 'Capitão, a rota de carro ainda está sendo calculada. Tente iniciar novamente em instantes.',
    start: 'Capitão, a NOVA está iniciando a orientação. {destination} fica a {kilometers} quilômetros.', startSaved: 'Capitão, a NOVA inicia usando uma rota salva. Confirme a rota ao se reconectar.',
    firstInstruction: 'A próxima instrução é {direction}.', roadDirection: 'Em direção a {road}.', ended: 'Capitão, a orientação de navegação foi encerrada.',
    offRoute: 'Capitão, você saiu da rota. A NOVA está procurando uma nova rota.', arrived: 'Capitão, você chegou ao destino. Pode encerrar a orientação da NOVA.',
    routeSaved: 'Capitão, a rota foi salva neste aparelho para uma reconexão com poucos dados.', reportReceived: 'Obrigado. Seu relatório de mapa foi enviado sem salvar sua localização exata.',
  },
  de: {
    uturn: 'wenden', roundabout: 'in den Kreisverkehr einfahren', left: 'links abbiegen', right: 'rechts abbiegen', merge: 'einfädeln', straight: 'geradeaus weiterfahren',
    locationRequired: 'Captain, erlauben Sie den Standortzugriff, bevor Sie die Live-Navigation starten.', routeLoading: 'Captain, die Straßenroute wird noch berechnet. Bitte starten Sie gleich erneut.',
    start: 'Captain, NOVA startet die Routenführung. {destination} ist {kilometers} Kilometer entfernt.', startSaved: 'Captain, NOVA startet mit einer gespeicherten Route. Prüfen Sie die Route nach der erneuten Verbindung.',
    firstInstruction: 'Die nächste Anweisung lautet: {direction}.', roadDirection: 'In Richtung {road}.', ended: 'Captain, die Navigation wurde beendet.',
    offRoute: 'Captain, Sie haben die Route verlassen. NOVA sucht eine neue Route.', arrived: 'Captain, Sie haben Ihr Ziel erreicht. Sie können die NOVA-Navigation beenden.',
    routeSaved: 'Captain, die Route wurde für eine datenarme Wiederverbindung auf diesem Gerät gespeichert.', reportReceived: 'Danke. Ihr Kartenhinweis wurde ohne Speicherung Ihres genauen Standorts gesendet.',
  },
  fr: {
    uturn: 'faire demi-tour', roundabout: 'entrer dans le rond-point', left: 'tourner à gauche', right: 'tourner à droite', merge: 's’insérer', straight: 'continuer tout droit',
    locationRequired: 'Capitaine, autorisez l’accès à la position avant de démarrer le guidage en direct.', routeLoading: 'Capitaine, l’itinéraire routier est encore en cours de calcul. Réessayez dans un instant.',
    start: 'Capitaine, NOVA démarre le guidage. {destination} est à {kilometers} kilomètres.', startSaved: 'Capitaine, NOVA démarre avec un itinéraire enregistré. Vérifiez-le lorsque vous serez reconnecté.',
    firstInstruction: 'La prochaine indication est : {direction}.', roadDirection: 'Vers {road}.', ended: 'Capitaine, le guidage est terminé.',
    offRoute: 'Capitaine, vous avez quitté l’itinéraire. NOVA cherche un nouvel itinéraire.', arrived: 'Capitaine, vous êtes arrivé à destination. Vous pouvez arrêter le guidage NOVA.',
    routeSaved: 'Capitaine, l’itinéraire a été enregistré sur cet appareil pour une reconnexion à faible consommation de données.', reportReceived: 'Merci. Votre signalement de carte a été envoyé sans enregistrer votre position exacte.',
  },
  ru: {
    uturn: 'развернитесь', roundabout: 'въедьте на круговое движение', left: 'поверните налево', right: 'поверните направо', merge: 'перестройтесь', straight: 'двигайтесь прямо',
    locationRequired: 'Капитан, разрешите доступ к местоположению перед запуском навигации.', routeLoading: 'Капитан, автомобильный маршрут ещё рассчитывается. Повторите запуск через мгновение.',
    start: 'Капитан, NOVA начинает навигацию. До {destination} {kilometers} километров.', startSaved: 'Капитан, NOVA начинает навигацию по сохранённому маршруту. Проверьте маршрут после подключения.',
    firstInstruction: 'Следующая команда: {direction}.', roadDirection: 'В направлении {road}.', ended: 'Капитан, навигация завершена.',
    offRoute: 'Капитан, вы отклонились от маршрута. NOVA ищет новый маршрут.', arrived: 'Капитан, вы прибыли в пункт назначения. Навигацию NOVA можно завершить.',
    routeSaved: 'Капитан, маршрут сохранён на этом устройстве для экономного повторного подключения.', reportReceived: 'Спасибо. Сообщение о карте отправлено без сохранения вашего точного местоположения.',
  },
  vi: {
    uturn: 'quay đầu', roundabout: 'vào vòng xuyến', left: 'rẽ trái', right: 'rẽ phải', merge: 'nhập làn', straight: 'đi thẳng',
    locationRequired: 'Captain, hãy cho phép quyền vị trí trước khi bắt đầu chỉ đường trực tiếp.', routeLoading: 'Captain, tuyến đường đang được tính. Vui lòng bắt đầu lại sau ít phút.',
    start: 'Captain, NOVA bắt đầu chỉ đường. {destination} cách {kilometers} ki-lô-mét.', startSaved: 'Captain, NOVA bắt đầu với tuyến đường đã lưu. Hãy kiểm tra lại tuyến đường khi có kết nối.',
    firstInstruction: 'Chỉ dẫn tiếp theo là {direction}.', roadDirection: 'Hướng đến {road}.', ended: 'Captain, chỉ đường đã kết thúc.',
    offRoute: 'Captain, bạn đã rời khỏi tuyến đường. NOVA đang tìm tuyến đường mới.', arrived: 'Captain, bạn đã đến nơi. Có thể kết thúc chỉ đường NOVA.',
    routeSaved: 'Captain, tuyến đường đã được lưu trên thiết bị này để kết nối lại với ít dữ liệu.', reportReceived: 'Cảm ơn. Báo cáo bản đồ đã được gửi mà không lưu vị trí chính xác của bạn.',
  },
  id: {
    uturn: 'putar balik', roundabout: 'masuk bundaran', left: 'belok kiri', right: 'belok kanan', merge: 'masuk jalur', straight: 'terus lurus',
    locationRequired: 'Kapten, izinkan akses lokasi sebelum memulai panduan langsung.', routeLoading: 'Kapten, rute jalan masih dihitung. Silakan mulai lagi sebentar lagi.',
    start: 'Kapten, NOVA memulai panduan rute. {destination} berjarak {kilometers} kilometer.', startSaved: 'Kapten, NOVA memulai panduan dengan rute tersimpan. Periksa rute saat tersambung kembali.',
    firstInstruction: 'Petunjuk berikutnya adalah {direction}.', roadDirection: 'Menuju {road}.', ended: 'Kapten, panduan navigasi telah berakhir.',
    offRoute: 'Kapten, Anda keluar dari rute. NOVA sedang mencari rute baru.', arrived: 'Kapten, Anda telah tiba di tujuan. Anda dapat mengakhiri panduan NOVA.',
    routeSaved: 'Kapten, rute disimpan di perangkat ini untuk penyambungan ulang hemat data.', reportReceived: 'Terima kasih. Laporan peta Anda dikirim tanpa menyimpan lokasi tepat Anda.',
  },
  ar: {
    uturn: 'قم بالالتفاف', roundabout: 'ادخل الدوار', left: 'انعطف يساراً', right: 'انعطف يميناً', merge: 'اندَمِج في المسار', straight: 'تابع مباشرة',
    locationRequired: 'كابتن، اسمح بالوصول إلى الموقع قبل بدء التوجيه المباشر.', routeLoading: 'كابتن، ما زال مسار القيادة قيد الحساب. ابدأ مرة أخرى بعد قليل.',
    start: 'كابتن، تبدأ NOVA التوجيه. تبعد {destination} مسافة {kilometers} كيلومتر.', startSaved: 'كابتن، تبدأ NOVA باستخدام مسار محفوظ. تحقق من المسار عند عودة الاتصال.',
    firstInstruction: 'التوجيه التالي هو {direction}.', roadDirection: 'باتجاه {road}.', ended: 'كابتن، تم إنهاء التوجيه.',
    offRoute: 'كابتن، خرجت عن المسار. تبحث NOVA عن مسار جديد.', arrived: 'كابتن، وصلت إلى وجهتك. يمكنك إنهاء توجيه NOVA.',
    routeSaved: 'كابتن، تم حفظ المسار على هذا الجهاز لإعادة الاتصال باستهلاك بيانات منخفض.', reportReceived: 'شكراً. تم إرسال بلاغ الخريطة دون حفظ موقعك الدقيق.',
  },
};

function normalizedLanguage(language) {
  // Keep the former boolean `ko` argument working for old callers and tests.
  if (language === true) return 'ko';
  const value = String(language || '').toLowerCase();
  return LITE_COPY[value] ? value : 'en';
}

export function navigationMessage(key, language, values = {}) {
  const copy = LITE_COPY[normalizedLanguage(language)] || LITE_COPY.en;
  const template = copy[key] || LITE_COPY.en[key] || '';
  return template.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

function radians(value) { return (value * Math.PI) / 180; }
function longitudeDelta(value) { return ((value + 540) % 360) - 180; }

export function distanceMeters(from, to) {
  if (!from || !to) return Infinity;
  const lat1 = radians(from.lat);
  const lat2 = radians(to.lat);
  const dLat = lat2 - lat1;
  const dLon = radians(longitudeDelta(to.lon - from.lon));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function localMeters(point, origin) {
  return {
    x: radians(longitudeDelta(point.lon - origin.lon)) * EARTH_RADIUS_M * Math.cos(radians(origin.lat)),
    y: radians(point.lat - origin.lat) * EARTH_RADIUS_M,
  };
}

function validPoint(point) {
  return Number.isFinite(point?.lat) && Number.isFinite(point?.lon);
}

function routeCumulative(points) {
  const cumulative = [0];
  for (let index = 1; index < points.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distanceMeters(points[index - 1], points[index]));
  }
  return cumulative;
}

// Snap a point to the nearest segment of the supplied route.  The result is
// local-only and approximate by design; it is enough to identify a next turn
// and to decide whether the GPS has clearly left the route.
export function projectPointToRoute(point, points, cumulative = routeCumulative(points || [])) {
  if (!validPoint(point) || !Array.isArray(points) || points.length < 2) return null;
  let best = null;
  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    if (!validPoint(from) || !validPoint(to)) continue;
    const a = localMeters(from, point);
    const b = localMeters(to, point);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const ratio = lengthSquared > 0 ? Math.max(0, Math.min(1, ((-a.x * dx) + (-a.y * dy)) / lengthSquared)) : 0;
    const nearestX = a.x + dx * ratio;
    const nearestY = a.y + dy * ratio;
    const offRouteM = Math.hypot(nearestX, nearestY);
    if (!best || offRouteM < best.offRouteM) {
      const segmentM = cumulative[index + 1] - cumulative[index];
      best = {
        index,
        ratio,
        offRouteM,
        progressM: cumulative[index] + (segmentM * ratio),
      };
    }
  }
  return best;
}

function isNavigableStep(step) {
  const type = String(step?.maneuver?.type || '').toLowerCase();
  return Boolean(step) && !['depart', 'arrive'].includes(type);
}

export function createNavigationProfile(route) {
  const points = (route?.points || []).filter(validPoint);
  if (points.length < 2) return null;
  const cumulative = routeCumulative(points);
  const steps = (route?.steps || [])
    .map((step, index) => {
      const location = step?.maneuver?.location;
      const routePosition = validPoint(location) ? projectPointToRoute(location, points, cumulative) : null;
      return {
        ...step,
        stepIndex: index,
        routeProgressM: routePosition?.progressM ?? null,
      };
    })
    .filter(isNavigableStep)
    .filter((step) => Number.isFinite(step.routeProgressM));
  return { points, cumulative, totalM: cumulative[cumulative.length - 1], steps };
}

export function getNavigationProgress(profile, current) {
  if (!profile || !validPoint(current)) return null;
  const currentPosition = projectPointToRoute(current, profile.points, profile.cumulative);
  if (!currentPosition) return null;
  // A small grace distance prevents a just-completed maneuver from appearing as
  // the next instruction because phone GPS naturally drifts a few metres.
  const nextStep = profile.steps.find((step) => step.routeProgressM >= currentPosition.progressM + 15) || null;
  return {
    ...currentPosition,
    remainingRouteM: Math.max(0, profile.totalM - currentPosition.progressM),
    nextStep: nextStep && {
      ...nextStep,
      distanceToManeuverM: Math.max(0, nextStep.routeProgressM - currentPosition.progressM),
    },
  };
}

export function maneuverLabel(step, language = 'en') {
  const copy = LITE_COPY[normalizedLanguage(language)] || LITE_COPY.en;
  const type = String(step?.maneuver?.type || '').toLowerCase();
  const modifier = String(step?.maneuver?.modifier || '').toLowerCase();
  if (type === 'uturn' || /uturn/.test(modifier)) return copy.uturn;
  if (type === 'roundabout' || type === 'rotary') return copy.roundabout;
  if (/left/.test(modifier)) return copy.left;
  if (/right/.test(modifier)) return copy.right;
  if (type === 'merge') return copy.merge;
  return copy.straight;
}

export function guidanceSpeech(step, distanceM, language = 'en') {
  const normalized = normalizedLanguage(language);
  const rounded = distanceM <= 100 ? 100 : 300;
  const direction = maneuverLabel(step, normalized);
  const road = String(step?.name || '').trim();
  const core = normalized === 'ko'
    ? `Captain, 약 ${rounded}미터 앞에서 ${direction}입니다.`
    : normalized === 'ja'
      ? `Captain、約${rounded}メートル先で${direction}です。`
      : normalized === 'zh'
        ? `Captain，约${rounded}米后${direction}。`
        : normalized === 'ar'
          ? `كابتن، بعد حوالي ${rounded} متر ${direction}.`
          : normalized === 'ru'
            ? `Капитан, примерно через ${rounded} метров ${direction}.`
            : normalized === 'vi'
              ? `Captain, khoảng ${rounded} mét nữa ${direction}.`
              : normalized === 'id'
                ? `Kapten, sekitar ${rounded} meter lagi ${direction}.`
                : normalized === 'de'
                  ? `Captain, in etwa ${rounded} Metern ${direction}.`
                  : normalized === 'fr'
                    ? `Capitaine, dans environ ${rounded} mètres, ${direction}.`
                    : normalized === 'es'
                      ? `Capitán, en aproximadamente ${rounded} metros, ${direction}.`
                      : normalized === 'pt'
                        ? `Capitão, em aproximadamente ${rounded} metros, ${direction}.`
                        : `Captain, in approximately ${rounded} meters, ${direction}.`;
  return `${core}${road ? ` ${navigationMessage('roadDirection', normalized, { road })}` : ''}`;
}
