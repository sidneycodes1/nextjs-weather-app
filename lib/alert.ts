import { kv } from "@vercel/kv";
import type {
  OpenWeather3HourForecastResponse,
  OpenWeather3HourForecastListItem,
} from "@/types/openweather";
import { formatAlertMessage, sendMessage } from "@/lib/telegram";

export type AlertCondition = "rain" | "wind" | "both" | "none";

export interface AlertWeatherData {
  condition: AlertCondition;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  rainVolume: number;
}

interface AlertCooldownState {
  condition: AlertCondition;
  timestamp: number;
}

const LAST_ALERT_KEY = "last_alert";
const COOLDOWN_MS = 30 * 60 * 1000;

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

function parseNumberEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid ${name} environment variable. Expected a number.`);
  }
  return parsed;
}

export async function fetchForecast(
  lat: number,
  lon: number,
): Promise<OpenWeather3HourForecastListItem> {
  const apiKey = getRequiredEnv("OPENWEATHER_API_KEY");

  const url = new URL("https://api.openweathermap.org/data/2.5/forecast");
  url.searchParams.set("appid", apiKey);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("units", "metric");

  console.log("fetchForecast: requesting OpenWeather 3-hour forecast", {
    url: url.toString(),
  });

  const response = await fetch(url.toString(), { cache: "no-store" });
  if (!response.ok) {
    const body = await response.text();
    console.log("fetchForecast: OpenWeather API error", {
      status: response.status,
      body,
    });
    throw new Error(`OpenWeather API request failed: ${response.status}`);
  }

  const data = (await response.json()) as OpenWeather3HourForecastResponse;

  if (!data.list?.length) {
    throw new Error("OpenWeather API returned no forecast slots.");
  }

  const slot = data.list[0];
  console.log("fetchForecast: received forecast slot", {
    dt: slot.dt,
    temp: slot.main.temp,
    windSpeed: slot.wind?.speed,
    rain: slot.rain,
  });

  return slot;
}

export function checkAlertCondition(
  slot: OpenWeather3HourForecastListItem,
  windThreshold = parseNumberEnv("WIND_THRESHOLD_MS", 8),
): {
  shouldAlert: boolean;
  condition: AlertCondition;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  rainVolume: number;
} {
  if (process.env.FORCE_ALERT_TEST === "true") {
    return {
      shouldAlert: true,
      condition: "rain",
      temp: 28,
      feelsLike: 31,
      humidity: 80,
      windSpeed: 5,
      rainVolume: 2.5,
    };
  }

  const rainVolume = slot.rain?.["3h"] ?? slot.rain?.["1h"] ?? 0;
  const windSpeed = slot.wind?.speed ?? 0;
  const temp = slot.main.temp;
  const feelsLike = slot.main.feels_like;
  const humidity = slot.main.humidity;

  let condition: AlertCondition = "none";
  if (rainVolume > 0 && windSpeed > windThreshold) {
    condition = "both";
  } else if (rainVolume > 0) {
    condition = "rain";
  } else if (windSpeed > windThreshold) {
    condition = "wind";
  }

  const shouldAlert = condition !== "none";
  console.log("checkAlertCondition", {
    shouldAlert,
    condition,
    temp,
    feelsLike,
    humidity,
    windSpeed,
    rainVolume,
    windThreshold,
  });

  return {
    shouldAlert,
    condition,
    temp,
    feelsLike,
    humidity,
    windSpeed,
    rainVolume,
  };
}

export async function sendTelegramAlert(
  chatId: string,
  condition: AlertCondition,
  weatherData: Omit<AlertWeatherData, "condition">,
  city: string,
): Promise<void> {
  const message = formatAlertMessage(condition, weatherData, city);
  await sendMessage(chatId, message);
}

export async function checkCooldown(
  condition: AlertCondition,
): Promise<boolean> {
  const state = (await kv.get<AlertCooldownState>(LAST_ALERT_KEY)) ?? null;
  if (!state) {
    console.log("checkCooldown: no previous alert state");
    return false;
  }

  const ageMs = Date.now() - state.timestamp;
  const isWithinCooldown = ageMs < COOLDOWN_MS;

  console.log("checkCooldown", {
    previousCondition: state.condition,
    currentCondition: condition,
    ageMs,
    isWithinCooldown,
  });

  return isWithinCooldown;
}

export async function setCooldown(condition: AlertCondition): Promise<void> {
  const payload: AlertCooldownState = {
    condition,
    timestamp: Date.now(),
  };

  console.log("setCooldown: saving cooldown state", payload);
  await kv.set(LAST_ALERT_KEY, payload);
}

function getCooldownKey(chatId: string) {
  return `last_alert:${chatId}`;
}

export async function checkCooldownForChat(chatId: string): Promise<boolean> {
  const state = (await kv.get<AlertCooldownState>(getCooldownKey(chatId))) ?? null;
  if (!state) {
    console.log("checkCooldownForChat: no previous alert state", { chatId });
    return false;
  }

  const ageMs = Date.now() - state.timestamp;
  const isWithinCooldown = ageMs < COOLDOWN_MS;

  console.log("checkCooldownForChat", {
    chatId,
    previousCondition: state.condition,
    ageMs,
    isWithinCooldown,
  });

  return isWithinCooldown;
}

export async function setCooldownForChat(chatId: string): Promise<void> {
  const payload: AlertCooldownState = {
    condition: "none",
    timestamp: Date.now(),
  };

  console.log("setCooldownForChat: saving cooldown state", { chatId, payload });
  await kv.set(getCooldownKey(chatId), payload);
}
