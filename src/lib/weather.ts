import axios from 'axios';
import type { WindWarning } from '@/types/bridge';

export interface WeatherData {
  timestamp: string;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  windWarning?: WindWarning | null;
}

// National Highways: a 40mph limit above 50mph forecast winds, closure at 60mph+ gusts.
export const LIMIT_GUST_MPH = 50;
export const CLOSURE_GUST_MPH = 60;
const HOUR_MS = 3600000;

// Open-Meteo hourly gusts are the maximum of the hour ending at each timestamp.
export function getWindWarning(times: unknown, gusts: unknown, now = Date.now()): WindWarning | null | undefined {
  if (!Array.isArray(times) || !Array.isArray(gusts) || times.length !== gusts.length) return undefined;
  const hours = times.map((time, i) => ({ end: Number(time) * 1000, gust: gusts[i] }))
    .filter(hour => hour.end > now && hour.end <= now + 24 * HOUR_MS);
  if (!hours.length || !hours.every(hour => Number.isFinite(hour.end) && typeof hour.gust === 'number' && Number.isFinite(hour.gust) && hour.gust >= 0)) return undefined;
  const peakGust = Math.max(...hours.map(hour => hour.gust as number));
  const level = peakGust >= CLOSURE_GUST_MPH ? 'closure' : peakGust > LIMIT_GUST_MPH ? 'limit' : null;
  if (!level) return null;
  const windy = hours.filter(hour => level === 'closure' ? (hour.gust as number) >= CLOSURE_GUST_MPH : (hour.gust as number) > LIMIT_GUST_MPH);
  return {
    level,
    peakGust: Math.round(peakGust),
    from: new Date(windy[0].end - HOUR_MS).toISOString(),
    until: new Date(windy[windy.length - 1].end).toISOString(),
  };
}

function getWeatherDescription(code: number): string {
  const weatherCodes: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };
  return weatherCodes[code] || 'Unknown';
}

function getWeatherIcon(code: number): string {
  const iconMap: Record<number, string> = {
    0: '☀️',
    1: '🌤️',
    2: '⛅',
    3: '☁️',
    45: '🌫️',
    48: '🌫️',
    51: '🌦️',
    53: '🌦️',
    55: '🌦️',
    61: '🌧️',
    63: '🌧️',
    65: '🌧️',
    71: '🌨️',
    73: '🌨️',
    75: '🌨️',
    77: '🌨️',
    80: '🌦️',
    81: '🌦️',
    82: '🌦️',
    85: '🌨️',
    86: '🌨️',
    95: '⛈️',
    96: '⛈️',
    99: '⛈️'
  };
  return iconMap[code] || '❓';
}

export async function getWeatherData(): Promise<WeatherData> {
  const response = await axios.get(
    'https://api.open-meteo.com/v1/forecast',
    {
      params: {
        latitude: 52.0270,
        longitude: 1.1660,
        current: 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code',
        hourly: 'wind_gusts_10m',
        forecast_hours: 25,
        wind_speed_unit: 'mph',
        timeformat: 'unixtime'
      },
      timeout: 5000
    }
  );

  const current = response.data.current;

  if (!current || ![current.temperature_2m, current.wind_speed_10m, current.wind_direction_10m, current.weather_code].every(Number.isFinite) || current.wind_speed_10m < 0 || current.wind_direction_10m < 0 || current.wind_direction_10m > 360) {
    throw new Error('Open-Meteo response did not include current weather data');
  }

  const timestamp = new Date(current.time * 1000);
  const age = Date.now() - timestamp.getTime();
  if (typeof current.time !== 'number' || !Number.isFinite(age) || age < -60000 || age > 1800000) throw new Error('Weather model time unavailable or stale');

  return {
    timestamp: timestamp.toISOString(),
    temperature: Math.round(current.temperature_2m),
    windSpeed: Math.round(current.wind_speed_10m),
    windDirection: current.wind_direction_10m,
    description: getWeatherDescription(current.weather_code),
    icon: getWeatherIcon(current.weather_code),
    windWarning: getWindWarning(response.data.hourly?.time, response.data.hourly?.wind_gusts_10m),
  };
}
