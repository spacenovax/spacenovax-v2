import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const destinationIcon = L.divIcon({ className: 'ov20-destination-marker-wrap', html: '<div class="ov20-destination-marker">◆</div>', iconSize: [34, 34], iconAnchor: [17, 17] });
const vehicleIcon = (heading = 0) => L.divIcon({ className: 'ov20-car-marker-wrap', html: `<div class="ov20-car-marker" style="transform:rotate(${Number.isFinite(heading) ? heading : 0}deg)">▲</div>`, iconSize: [56, 56], iconAnchor: [28, 28] });
const routeArrow = (heading) => L.divIcon({ className: 'ov20-route-arrow-wrap', html: `<i style="transform:rotate(${heading}deg)">➤</i>`, iconSize: [20, 20], iconAnchor: [10, 10] });

function bearing(from, to) { return (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI + 90 + 360) % 360; }

function MapCamera({ current, points, recenterToken }) {
  const map = useMap();
  const initialized = useRef(false);
  useEffect(() => {
    if (!current) return;
    if (!initialized.current && points.length > 2) { initialized.current = true; map.fitBounds(points, { padding: [42, 150], maxZoom: 15, animate: true }); return; }
    if (recenterToken > 0) map.flyTo([current.lat, current.lon], Math.max(map.getZoom(), 16), { animate: true, duration: .45 });
  }, [current?.lat, current?.lon, points.length, recenterToken]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MapControls({ onRecenter, onExit }) {
  const map = useMap();
  return <aside className="ov20-driving-controls"><button onClick={() => map.zoomIn()} aria-label="Zoom in">+</button><button onClick={() => map.zoomOut()} aria-label="Zoom out">−</button><button className="ov20-driving-recenter" onClick={onRecenter}>⌖<small>GPS</small></button><button className="ov20-driving-globe" onClick={onExit}>◉<small>3D</small></button></aside>;
}

function formatEta(hours, ko) { if (hours == null) return '—'; if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}${ko ? '분' : ' min'}`; return `${Math.floor(hours)}${ko ? '시간 ' : 'h '}${Math.round((hours % 1) * 60)}${ko ? '분' : 'min'}`; }
function turnSymbol(maneuver) { if (/left/i.test(maneuver)) return '↰'; if (/right/i.test(maneuver)) return '↱'; if (/uturn/i.test(maneuver)) return '↶'; return '↑'; }

export default function OrbitDrivingView({ t, current, destination, route, etaHours, distanceKm, nextStep, onExit, onStop }) {
  const [recenterToken, setRecenterToken] = useState(0);
  const points = useMemo(() => (route?.points || []).map((point) => [point.lat, point.lon]), [route]);
  const arrows = useMemo(() => {
    const stride = Math.max(5, Math.floor(points.length / 14));
    return points.filter((_, index) => index > 1 && index < points.length - 1 && index % stride === 0).map((point, index) => ({ point, heading: bearing(points[Math.max(0, (index + 1) * stride - 1)], point) }));
  }, [points]);
  const maneuver = nextStep?.maneuver?.modifier || nextStep?.maneuver?.type || 'continue';
  const road = nextStep?.name || (t.ko ? '안내 경로' : 'Guidance route');
  if (!current || !destination || points.length < 2) return null;

  return <section className="ov20-driving" aria-label="Driving navigation">
    <MapContainer center={[current.lat, current.lon]} zoom={15} zoomControl={false} className="ov20-driving-map" attributionControl>
      <TileLayer attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
      <Polyline positions={points} pathOptions={{ color: '#062142', weight: 15, opacity: .86 }} />
      <Polyline positions={points} pathOptions={{ color: '#147ff5', weight: 8, opacity: 1 }} />
      {arrows.map((arrow, index) => <Marker key={`${arrow.point.join(',')}-${index}`} position={arrow.point} icon={routeArrow(arrow.heading)} interactive={false} />)}
      <Marker position={[current.lat, current.lon]} icon={vehicleIcon(current.heading)} /><Marker position={[destination.lat, destination.lon]} icon={destinationIcon} />
      <MapCamera current={current} points={points} recenterToken={recenterToken} /><MapControls onRecenter={() => setRecenterToken((value) => value + 1)} onExit={onExit} />
    </MapContainer>
    <header className="ov20-driving-top"><button onClick={onExit}>‹ {t.ko ? '지구본' : 'GLOBE'}</button><span><i /> {t.ko ? 'GPS 실시간 안내' : 'GPS LIVE GUIDANCE'}</span><button onClick={onStop}>■ {t.ko ? '종료' : 'END'}</button></header>
    <div className="ov20-driving-instruction"><strong>{turnSymbol(maneuver)}</strong><div><small>{t.ko ? '다음 안내' : 'NEXT MANEUVER'}</small><b>{road}</b></div><em>{nextStep?.distanceM ? `${Math.max(1, Math.round(nextStep.distanceM / 10) * 10)} m` : '—'}</em></div>
    <footer className="ov20-driving-bottom"><div><small>{t.remaining}</small><b>{distanceKm == null ? '—' : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`}</b></div><div><small>ETA</small><b>{formatEta(etaHours, t.ko)}</b></div><div><small>{t.ko ? '목적지' : 'DESTINATION'}</small><b>{destination.label?.split(',')[0]}</b></div></footer>
  </section>;
}
