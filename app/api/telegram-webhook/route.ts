/*
  HOW TO SET UP TELEGRAM WEBHOOK AFTER DEPLOYING:

  curl -X POST \
    "https://api.telegram.org/bot{YOUR_TOKEN}/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://your-app.vercel.app/api/telegram-webhook",
      "secret_token": "{YOUR_WEBHOOK_SECRET}"
    }'
*/

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { sendMessage } from "@/lib/telegram";

const pendingLocation = new Map<
  string,
  {
    firstName: string;
    status: "pending_location";
  }
>();

async function lookupCity(cityName: string) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
    cityName,
  )}&countrycodes=ng&format=json&limit=1`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "WeatherPing/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`City lookup failed: ${response.status}`);
  }

  const results = (await response.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;

  return results[0] ?? null;
}

export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message;
  if (!message) {
    return NextResponse.json({ success: true });
  }

  const chatId = String(message.chat?.id ?? message.from?.id ?? "");
  const firstName = message.from?.first_name ?? "there";
  const text = String(message.text ?? "").trim();

  if (!chatId || !text) {
    return NextResponse.json({ success: true });
  }

  try {
    if (text.startsWith("/")) {
      const command = text.split(" ")[0].toLowerCase();

      if (command === "/start") {
        const { data } = await supabase
          .from("subscribers")
          .select("chat_id")
          .eq("chat_id", chatId)
          .maybeSingle();

        if (data) {
          await sendMessage(
            chatId,
            `Welcome back ${firstName}! You are already subscribed. Send /location to update your city or /stop to unsubscribe.`,
          );
          return NextResponse.json({ success: true });
        }

        pendingLocation.set(chatId, { firstName, status: "pending_location" });
        await sendMessage(
          chatId,
          `👋 Welcome to WeatherPing, ${firstName}!\n\nI'll send you alerts before it rains or gets windy in your area.\n\nTo get started, send me your city name.\nExample: Lagos or Abuja or Kano`,
        );
        return NextResponse.json({ success: true });
      }

      if (command === "/stop") {
        await supabase.from("subscribers").update({ is_active: false }).eq("chat_id", chatId);
        pendingLocation.delete(chatId);
        await sendMessage(
          chatId,
          "You've been unsubscribed from WeatherPing. Send /start anytime to resubscribe. 👋",
        );
        return NextResponse.json({ success: true });
      }

      if (command === "/location") {
        pendingLocation.set(chatId, { firstName, status: "pending_location" });
        await sendMessage(chatId, "Send me your new city name:");
        return NextResponse.json({ success: true });
      }

      if (command === "/status") {
        const { data } = await supabase
          .from("subscribers")
          .select("city, state, alert_rain, alert_wind, wind_threshold, is_active")
          .eq("chat_id", chatId)
          .maybeSingle();

        if (!data) {
          await sendMessage(chatId, "You are not subscribed yet. Send /start to begin.");
          return NextResponse.json({ success: true });
        }

        const statusText = data.is_active ? "Active" : "Inactive";
        const rainStatus = data.alert_rain ? "On" : "Off";
        const windStatus = data.alert_wind ? "On" : "Off";

        await sendMessage(
          chatId,
          `📍 Your location: ${data.city}, ${data.state}\n🌧 Rain alerts: ${rainStatus}\n💨 Wind alerts: ${windStatus} (threshold: ${data.wind_threshold} m/s)\n✅ Status: ${statusText}`,
        );
        return NextResponse.json({ success: true });
      }
    }

    if (pendingLocation.has(chatId)) {
      const location = text;
      const cityResult = await lookupCity(location);

      if (!cityResult) {
        await sendMessage(chatId, "❌ City not found. Please try again with a Nigerian city name.");
        return NextResponse.json({ success: true });
      }

      const displayParts = cityResult.display_name.split(",").map((part) => part.trim());
      const city = displayParts[0] || location;
      const state = displayParts[1] || "Nigeria";
      const lat = Number(cityResult.lat);
      const lon = Number(cityResult.lon);

      await supabase.from("subscribers").upsert({
        chat_id: chatId,
        first_name: firstName,
        city,
        state,
        country: "Nigeria",
        lat,
        lon,
        is_active: true,
        alert_rain: true,
        alert_wind: true,
        wind_threshold: 8,
      }, { onConflict: "chat_id" });

      pendingLocation.delete(chatId);

      await sendMessage(
        chatId,
        `✅ Done! You're subscribed for weather alerts in ${city}, ${state}.\n\nYou'll get a Telegram message 10-15 minutes before:\n🌧 Rain\n💨 Strong wind (above 8 m/s)\n\nCommands:\n/location — change your city\n/status — see your current settings\n/stop — unsubscribe`,
      );

      return NextResponse.json({ success: true });
    }

    await sendMessage(
      chatId,
      "Send /start to subscribe to WeatherPing or /location to change your city.",
    );
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("/api/telegram-webhook error", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" });
  }
}
