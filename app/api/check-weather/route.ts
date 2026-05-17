import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import {
  AlertWeatherData,
  fetchForecast,
  checkAlertCondition,
  checkCooldownForChat,
  sendTelegramAlert,
  setCooldownForChat,
} from "@/lib/alert";

export async function GET(request: NextRequest) {
  console.log("/api/check-weather invoked");

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("Missing CRON_SECRET environment variable.");
    return NextResponse.json(
      { error: "Missing CRON_SECRET environment variable." },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${cronSecret}`) {
    console.error("Unauthorized request to /api/check-weather", {
      authorization,
    });
    return NextResponse.json(
      { error: "Unauthorized. Invalid Authorization header." },
      { status: 401 },
    );
  }

  try {
    const { data: subscribers, error } = await supabase
      .from("subscribers")
      .select("chat_id, city, lat, lon, wind_threshold")
      .eq("is_active", true);

    if (error) {
      console.error("Failed to load subscribers", error);
      throw new Error("Failed to load subscribers.");
    }

    const rows = Array.isArray(subscribers) ? subscribers : [];
    let checked = rows.length;
    let alerted = 0;
    let skipped = 0;

    for (const subscriber of rows) {
      try {
        const lat = Number(subscriber.lat);
        const lon = Number(subscriber.lon);
        const threshold = Number(subscriber.wind_threshold ?? 8);

        const slot = await fetchForecast(lat, lon);
        const result = checkAlertCondition(slot, threshold);

        if (!result.shouldAlert) {
          skipped += 1;
          continue;
        }

        const isCooldown = await checkCooldownForChat(String(subscriber.chat_id));
        if (isCooldown) {
          skipped += 1;
          continue;
        }

        const messageData: Omit<AlertWeatherData, "condition"> = {
          temp: result.temp,
          feelsLike: result.feelsLike,
          humidity: result.humidity,
          windSpeed: result.windSpeed,
          rainVolume: result.rainVolume,
        };

        await sendTelegramAlert(
          String(subscriber.chat_id),
          result.condition,
          messageData,
          String(subscriber.city ?? "your area"),
        );
        await setCooldownForChat(String(subscriber.chat_id));
        await supabase
          .from("subscribers")
          .update({ last_alerted_at: new Date().toISOString() })
          .eq("chat_id", subscriber.chat_id);

        alerted += 1;
      } catch (innerError) {
        console.error("Failed to process subscriber alert", innerError);
        skipped += 1;
        continue;
      }
    }

    return NextResponse.json(
      {
        checked,
        alerted,
        skipped,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("/api/check-weather error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown error during alert check.",
      },
      { status: 500 },
    );
  }
}
