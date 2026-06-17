import { NextResponse } from 'next/server';
import { getWeatherData } from '@/lib/weather';
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
    const cachedWeather = cache.get<{temperature: number, windSpeed: number, windDirection: number, description: string, icon: string}>('weather-data');
    if (cachedWeather) {
      return jsonNoStore({
        success: true,
        data: cachedWeather,
        cached: true
      });
    }

    const weatherData = await getWeatherData();

    cache.set('weather-data', weatherData, 900);

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
    console.error('Weather API error:', error);

    const cachedWeather = cache.get<{temperature: number, windSpeed: number, windDirection: number, description: string, icon: string}>('weather-data');
    if (cachedWeather) {
      return jsonNoStore({
        success: true,
        data: cachedWeather,
        fallback: true,
        cached: true
      });
    }

    const fallbackData = {
      temperature: 12,
      windSpeed: 25,
      windDirection: 270,
      description: 'Weather unavailable',
      icon: '❓'
    };

    return jsonNoStore({
      success: false,
      error: 'Failed to fetch weather data',
      data: fallbackData,
      current: {
        temp_c: fallbackData.temperature,
        wind_mph: fallbackData.windSpeed,
        condition: {
          text: fallbackData.description,
          icon: fallbackData.icon
        }
      }
    }, { status: 503 });
  }
}
