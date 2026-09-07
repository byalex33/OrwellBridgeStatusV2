import { NextResponse } from 'next/server';
import { getWeatherData, type WeatherData } from '@/lib/weather';
import { cache } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store',
};

function jsonNoStore<T>(body: T, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: noStoreHeaders,
  });
}

export async function GET() {
  try {
    const cachedWeather = cache.get<WeatherData>('weather-data');
    if (cachedWeather) {
      return jsonNoStore({
        success: true,
        data: cachedWeather,
        cached: true
      });
    }

    const weatherData = await cache.getOrFetch('weather-data', getWeatherData, 900);

    cache.set('weather-data', weatherData, Math.min(900, Math.max(0, (Date.parse(weatherData.timestamp) + 1800000 - Date.now()) / 1000)));

    return jsonNoStore({
      success: true,
      data: weatherData,
      realTime: true,
      current: {
        temp_c: weatherData.temperature,
        wind_mph: weatherData.windSpeed,
        condition: {
          text: weatherData.description,
          icon: weatherData.icon
        }
      }
    });

  } catch (error) {
    console.error('Weather API error', {
      message: error instanceof Error ? error.message : 'Unknown error'
    });

    const cachedWeather = cache.get<WeatherData>('weather-data');
    if (cachedWeather) {
      return jsonNoStore({
        success: true,
        data: cachedWeather,
        fallback: true,
        cached: true
      });
    }

    return jsonNoStore({
      success: false,
      error: 'Failed to fetch weather data',
      data: null
    }, { status: 503 });
  }
}
