"use server";

import { SavedCity } from "@/types/city";
import type {
  OpenWeatherAirPollutionResponse,
  OpenWeatherCurrentWeatherResponse,
  OpenWeatherDailyForecast16DaysResponse,
  OpenWeatherHourlyForecast4DaysResponse,
  OpenWeather3HourForecastResponse,
} from "@/types/openweather";

const BASE_URL = "https://api.openweathermap.org/data/2.5";

function getApiKey() {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) throw new Error("Missing OpenWeather API Key.");
  return key;
}

/**
 * Current Weather API Request
 * @param lat
 * @param lon
 * @returns OpenWeatherCurrentWeatherResponse
 */
export async function getCurrentWeather(
  lat: number,
  lon: number,
): Promise<OpenWeatherCurrentWeatherResponse> {
  // Use Open-Meteo current weather + today's sunrise/sunset (no API key)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure` +
    `&daily=sunrise,sunset&timezone=auto`;

  const res = await fetch(url, { next: { revalidate: 3000, tags: ["weather"] } });
  if (!res.ok) throw new Error(`Failed to fetch current weather from Open-Meteo: ${res.statusText}`);

  const data = await res.json();

  const current = data.current ?? {};
  const daily = data.daily ?? {};

  const dt = current.time ? Math.floor(new Date(current.time).getTime() / 1000) : Math.floor(Date.now() / 1000);
  const sunrise = (daily.sunrise && daily.sunrise[0]) ? Math.floor(new Date(daily.sunrise[0]).getTime() / 1000) : 0;
  const sunset = (daily.sunset && daily.sunset[0]) ? Math.floor(new Date(daily.sunset[0]).getTime() / 1000) : 0;
  const tzOffset = data.utc_offset_seconds ?? 0;

  const result: OpenWeatherCurrentWeatherResponse = {
    coord: { lon, lat },
    weather: [
      {
        id: current.weather_code ?? 0,
        main: String(current.weather_code ?? ""),
        description: `Open-Meteo weather_code ${current.weather_code ?? ""}`,
        icon: "01d",
      },
    ],
    base: "",
    main: {
      temp: current.temperature_2m ?? 0,
      feels_like: current.apparent_temperature ?? current.temperature_2m ?? 0,
      temp_min: current.temperature_2m ?? 0,
      temp_max: current.temperature_2m ?? 0,
      pressure: current.surface_pressure ?? 0,
      humidity: current.relative_humidity_2m ?? 0,
    },
    visibility: undefined,
    wind: {
      speed: current.wind_speed_10m ?? 0,
      deg: current.wind_direction_10m ?? 0,
    },
    rain: current.precipitation ? { "1h": current.precipitation } : undefined,
    snow: undefined,
    clouds: { all: 0 },
    dt,
    sys: {
      country: "",
      sunrise,
      sunset,
    },
    timezone: tzOffset,
    id: 0,
    name: "",
    cod: 200,
  };

  return result;
}

/**
 * Hourly Forecast 4 Days API Request
 * @param lat
 * @param lon
 * @param cnt Number of hours to forecast (1-48)
 * @returns OpenWeatherHourlyForecast4DaysResponse
 */
export async function getHourlyForecast4Days(
  lat: number,
  lon: number,
  cnt: number = 48,
): Promise<OpenWeatherHourlyForecast4DaysResponse> {
  // Use Open-Meteo hourly forecast (free, no API key)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,precipitation_probability,precipitation,windspeed_10m,weathercode&timezone=auto&forecast_days=4`;

  const res = await fetch(url, { next: { revalidate: 3000 } });
  if (!res.ok) throw new Error("Failed to fetch hourly forecast data from Open-Meteo.");

  const data = await res.json();

  const times: string[] = data?.hourly?.time ?? [];
  const temps: number[] = data?.hourly?.temperature_2m ?? [];
  const pops: number[] = data?.hourly?.precipitation_probability ?? [];
  const precs: number[] = data?.hourly?.precipitation ?? [];
  const winds: number[] = data?.hourly?.windspeed_10m ?? [];
  const codes: number[] = data?.hourly?.weathercode ?? [];

  const list = [] as any[];
  const take = Math.min(cnt, times.length);
  for (let i = 0; i < take; i++) {
    const time = times[i];
    const dt = Math.floor(new Date(time).getTime() / 1000);

    list.push({
      dt,
      main: {
        temp: temps[i] ?? 0,
        feels_like: temps[i] ?? 0,
        temp_min: temps[i] ?? 0,
        temp_max: temps[i] ?? 0,
        pressure: 0,
        sea_level: undefined,
        grnd_level: undefined,
        humidity: 0,
        temp_kf: 0,
      },
      weather: [
        {
          id: codes[i] ?? 0,
          main: String(codes[i] ?? ""),
          description: `Open-Meteo weathercode ${codes[i] ?? ""}`,
          icon: "01d",
        },
      ],
      clouds: { all: 0 },
      wind: { speed: winds[i] ?? 0, deg: 0 },
      visibility: undefined,
      pop: (pops[i] ?? 0) / 100,
      rain: precs[i] ? { "1h": precs[i] } : undefined,
      snow: undefined,
      sys: { pod: "d" },
      dt_txt: time,
    });
  }

  const result: OpenWeatherHourlyForecast4DaysResponse = {
    cod: "200",
    message: 0,
    cnt: list.length,
    list,
    city: {
      id: 0,
      name: "",
      coord: { lat, lon },
      country: "",
      population: undefined,
      timezone: 0,
      sunrise: 0,
      sunset: 0,
    },
  };

  return result;
}

/**
 * 3-hour Forecast API Request
 * @param lat
 * @param lon
 * @param cnt Number of 3-hour forecast slots to return (1-40)
 * @returns OpenWeather3HourForecastResponse
 */
export async function get3HourForecast(
  lat: number,
  lon: number,
  cnt: number = 8,
): Promise<OpenWeather3HourForecastResponse> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    cnt: String(cnt),
    appid: getApiKey(),
    units: "metric",
  });

  const res = await fetch(`${BASE_URL}/forecast?${params}`, {
    next: { revalidate: 3000 }, // 30 minutes
  });

  if (!res.ok) {
    throw new Error("Failed to fetch 3-hour forecast data.");
  }

  const data: OpenWeather3HourForecastResponse = await res.json();
  return data;
}

/**
 * Current Weather Batch API Request for multiple cities
 * @param cities Array of SavedCity objects
 * @returns Array of objects with city, weather, and error properties
 */
export async function getCurrentWeatherBatch(cities: SavedCity[]): Promise<
  Array<{
    city: SavedCity;
    weather: OpenWeatherCurrentWeatherResponse | null;
    error: string | null;
  }>
> {
  const promises = cities.map(async (city) => {
    try {
      const weather = await getCurrentWeather(city.coord.lat, city.coord.lon);
      return {
        city,
        weather,
        error: null,
      };
    } catch (error) {
      return {
        city,
        weather: null,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch weather data.",
      };
    }
  });

  return Promise.all(promises);
}

/**
 * Air Pollution API Request for a single city
 * @param lat
 * @param lon
 * @returns OpenWeatherAirPollutionResponse
 */
export async function getAirPollution(
  lat: number,
  lon: number,
): Promise<OpenWeatherAirPollutionResponse> {
  // Use Open-Meteo air quality API (free, no API key)
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&hourly=pm2_5,pm10,european_aqi`;
  const res = await fetch(url, { next: { revalidate: 3000 } });
  if (!res.ok) throw new Error("Failed to fetch air pollution data from Open-Meteo.");

  const data = await res.json();

  const times: string[] = data?.hourly?.time ?? [];
  const pm2_5: number[] = data?.hourly?.pm2_5 ?? [];
  const pm10: number[] = data?.hourly?.pm10 ?? [];
  const aqiArr: number[] = data?.hourly?.european_aqi ?? [];

  // pick the latest available measurement
  const idx = Math.max(0, times.length - 1);
  const aqiVal = aqiArr[idx] ?? 0;

  const resp: OpenWeatherAirPollutionResponse = {
    list: [
      {
        main: { aqi: Math.min(5, Math.max(1, Math.round(aqiVal) || 1)) },
        components: {
          co: 0,
          no: 0,
          no2: 0,
          o3: 0,
          so2: 0,
          pm2_5: pm2_5[idx] ?? 0,
          pm10: pm10[idx] ?? 0,
          nh3: 0,
        },
      },
    ],
  };

  return resp;
}

/**
 *  Open-Meteo API Request for UV Index
 * @param lat
 * @param lon
 * @returns UV index
 */
export async function getUVIndex(lat: number, lon: number): Promise<number> {
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=uv_index`,
    { next: { revalidate: 3000 } }, // 30 minutes
  );

  if (!res.ok) throw new Error("Failed to fetch UV index.");
  const data = await res.json();
  return data.current.uv_index;
}

/**
 * Daily Forecast 16 Days API Request
 * @param lat
 * @param lon
 * @param days Number of days to forecast (1-16)
 * @returns OpenWeatherDailyForecast16DaysResponse
 */
export async function getDailyForecast16Days(
  lat: number,
  lon: number,
  days: number = 16,
): Promise<OpenWeatherDailyForecast16DaysResponse> {
  // Use Open-Meteo daily forecast (free, no API key)
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,precipitation_probability_max&timezone=auto&forecast_days=16`;

  const res = await fetch(url, { next: { revalidate: 3000 } });
  if (!res.ok) throw new Error("Failed to fetch daily forecast data from Open-Meteo.");

  const data = await res.json();

  const times: string[] = data?.daily?.time ?? [];
  const tMax: number[] = data?.daily?.temperature_2m_max ?? [];
  const tMin: number[] = data?.daily?.temperature_2m_min ?? [];
  const precSum: number[] = data?.daily?.precipitation_sum ?? [];
  const windMax: number[] = data?.daily?.windspeed_10m_max ?? [];
  const popMax: number[] = data?.daily?.precipitation_probability_max ?? [];
  const codes: number[] = data?.daily?.weathercode ?? [];

  const list: any[] = [];
  const take = Math.min(days, times.length);
  for (let i = 0; i < take; i++) {
    const time = times[i];
    const dt = Math.floor(new Date(time).getTime() / 1000);
    const min = tMin[i] ?? 0;
    const max = tMax[i] ?? 0;
    const dayAvg = (min + max) / 2;

    list.push({
      dt,
      temp: {
        day: dayAvg,
        min,
        max,
        night: min,
        eve: dayAvg,
        morn: min,
      },
      feels_like: { day: dayAvg, night: min, eve: dayAvg, morn: min },
      pressure: 0,
      humidity: 0,
      weather: [
        {
          id: codes[i] ?? 0,
          main: String(codes[i] ?? ""),
          description: `Open-Meteo weathercode ${codes[i] ?? ""}`,
          icon: "01d",
        },
      ],
      speed: windMax[i] ?? 0,
      deg: 0,
      gust: undefined,
      clouds: 0,
      rain: precSum[i] ?? 0,
      snow: undefined,
      pop: (popMax[i] ?? 0) / 100,
    });
  }

  const result: OpenWeatherDailyForecast16DaysResponse = {
    cod: "200",
    message: 0,
    cnt: list.length,
    list,
    city: {
      id: 0,
      name: "",
      coord: { lat, lon },
      country: "",
      population: undefined,
      timezone: 0,
    },
  };

  return result;
}
