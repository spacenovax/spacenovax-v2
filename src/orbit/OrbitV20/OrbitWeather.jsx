// Orbit V21 — Weather card, always visible in the right column.
import React from 'react';

export default function OrbitWeather({ t, weather, currentCity, airQualityLabel, aqi }) {
  return (
    <div className="ov20-card">
      <div className="ov20-card-label">{t.weather}{currentCity ? ` · ${currentCity}` : ''}</div>
      {!weather ? <p className="ov20-empty">{t.ko ? '불러오는 중...' : 'Loading…'}</p> : (
        <>
          <div className="ov20-weather-main">
            <span className="ov20-weather-icon">{weather.cloud_cover > 50 ? '⛅' : '☀️'}</span>
            <span className="temp">{Math.round(weather.temperature_2m)}°</span>
          </div>
          <div className="ov20-row"><span>{t.wind}</span><b>{weather.wind_speed_10m}m/s</b></div>
          <div className="ov20-row"><span>{t.humidity}</span><b>{weather.relative_humidity_2m != null ? `${weather.relative_humidity_2m}%` : '—'}</b></div>
          <div className="ov20-row"><span>{t.air}</span><b className={airQualityLabel.cls}>{airQualityLabel.text}{aqi != null ? ` ${aqi}` : ''}</b></div>
        </>
      )}
    </div>
  );
}
