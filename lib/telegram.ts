function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable.`);
  }
  return value;
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  const botToken = getRequiredEnv("TELEGRAM_BOT_TOKEN");
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const payload = JSON.stringify({
    chat_id: chatId,
    text,
    parse_mode: "HTML",
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: payload,
    });

    if (response.ok) {
      return;
    }

    const body = await response.text();
    console.error("sendMessage: Telegram API error", {
      attempt,
      status: response.status,
      body,
    });

    if (attempt === 2) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

export function formatAlertMessage(
  condition: "rain" | "wind" | "both" | "none",
  weatherData: {
    temp: number;
    feelsLike: number;
    humidity: number;
    windSpeed: number;
    rainVolume: number;
  },
  city: string,
): string {
  const conditionLines: string[] = [];

  if (condition === "rain") {
    conditionLines.push("🌧 Rain expected in the next 3 hours");
  } else if (condition === "wind") {
    conditionLines.push("💨 Strong wind expected in the next 3 hours");
  } else if (condition === "both") {
    conditionLines.push(
      "🌧 Rain expected in the next 3 hours\n💨 Strong wind expected in the next 3 hours",
    );
  }

  const windLine = `💨 Wind: ${weatherData.windSpeed.toFixed(1)} m/s`;
  const tempLine = `🌡 Temp: ${weatherData.temp.toFixed(0)}°C (feels like ${weatherData.feelsLike.toFixed(
    0,
  )}°C)`;
  const humidityLine = `💧 Humidity: ${weatherData.humidity}%`;

  return [
    `⚠️ <b>WeatherPing Alert</b>`,
    `📍 ${city}`,
    "",
    ...conditionLines,
    windLine,
    tempLine,
    humidityLine,
    "",
    "Stay prepared! ☂️",
  ]
    .filter(Boolean)
    .join("\n");
}
