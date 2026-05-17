/*
  HOW TO TEST YOUR TELEGRAM BOT LOCALLY:

  1. Make sure npm run dev is running
  2. Open your browser and go to:
     http://localhost:3000/api/test-alert
  3. You should see { success: true } in the browser
  4. Check your Telegram — message should arrive in seconds

  To test the full cron flow with auth:
  Run in terminal:
  curl -X GET http://localhost:3000/api/check-weather \
    -H "Authorization: Bearer YOUR_CRON_SECRET_HERE"

  To disable test mode before deploying:
  Set FORCE_ALERT_TEST=false in .env.local
  The test route is blocked automatically in production.
*/

import { NextResponse } from "next/server";
import { sendTelegramAlert } from "@/lib/alert";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { success: false, error: "Test alert route is only available in development." },
      { status: 403 },
    );
  }

  try {
    await sendTelegramAlert("rain", {
      temp: 28,
      feelsLike: 31,
      humidity: 80,
      windSpeed: 5,
      rainVolume: 2.5,
    });

    return NextResponse.json({
      success: true,
      message: "Test alert sent to Telegram",
      sentAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
