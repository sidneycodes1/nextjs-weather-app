"use client";

import { useEffect, useState, useCallback } from "react";

export interface LocationCoordinates {
  lat: number;
  lon: number;
}

export interface LocationName {
  city: string;
  state: string;
  country: string;
  display: string;
}

export interface SavedLocation extends LocationCoordinates {
  city: string;
  state: string;
  country: string;
  display: string;
  timestamp: number;
}

export interface UseLocationReturn {
  status: "idle" | "loading" | "success" | "error" | "denied";
  coordinates: LocationCoordinates | null;
  locationName: LocationName | null;
  requestLocation: () => void;
  refreshLocation: () => void;
  clearLocation: () => void;
}

const LOCATION_STORAGE_KEY = "weatherping_location";
const PERMISSION_STORAGE_KEY = "weatherping_location_permission";
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours

export function useLocation(): UseLocationReturn {
  const [status, setStatus] = useState<UseLocationReturn["status"]>("idle");
  const [coordinates, setCoordinates] = useState<LocationCoordinates | null>(
    null
  );
  const [locationName, setLocationName] = useState<LocationName | null>(null);

  // Restore saved location from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
    const permission = localStorage.getItem(PERMISSION_STORAGE_KEY);

    if (saved) {
      try {
        const parsed: SavedLocation = JSON.parse(saved);
        setCoordinates({ lat: parsed.lat, lon: parsed.lon });
        setLocationName({
          city: parsed.city,
          state: parsed.state,
          country: parsed.country,
          display: parsed.display,
        });
        setStatus("success");

        // Check if refresh is needed (older than 6 hours)
        const now = Date.now();
        if (now - parsed.timestamp > REFRESH_INTERVAL_MS) {
          silentRefresh();
        }
      } catch (err) {
        console.error("Failed to parse saved location:", err);
        localStorage.removeItem(LOCATION_STORAGE_KEY);
      }
    } else if (permission === "denied") {
      setStatus("denied");
    }
  }, []);

  // Reverse geocode using Nominatim
  const reverseGeocode = useCallback(
    async (lat: number, lon: number): Promise<LocationName | null> => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=14&addressdetails=1`,
          {
            headers: {
              "User-Agent": "WeatherPing/1.0",
            },
          }
        );

        if (!res.ok) throw new Error("Reverse geocoding failed");

        const data = await res.json();
        const address = data.address || {};

        // Extract location with priority order for suburb/neighborhood level
        const city =
          address.suburb ||
          address.neighbourhood ||
          address.city_district ||
          address.city ||
          address.town ||
          address.village ||
          address.county ||
          "Unknown";

        const state =
          address.state_district || address.state || "Unknown";
        const country = address.country || "Unknown";

        const display = `${city}, ${state}, ${country}`;

        return { city, state, country, display };
      } catch (err) {
        console.error("Reverse geocoding error:", err);
        return null;
      }
    },
    []
  );

  // Silent background refresh
  const silentRefresh = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude: lat, longitude: lon } = position.coords;
          const locationInfo = await reverseGeocode(lat, lon);

          if (locationInfo) {
            const saved: SavedLocation = {
              lat,
              lon,
              city: locationInfo.city,
              state: locationInfo.state,
              country: locationInfo.country,
              display: locationInfo.display,
              timestamp: Date.now(),
            };
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved));
            setCoordinates({ lat, lon });
            setLocationName(locationInfo);
          }
        },
        () => {
          // Silent fail on refresh
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } catch (err) {
      // Silent fail on refresh
    }
  }, [reverseGeocode]);

  // Request user's location
  const requestLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;

        // Reverse geocode
        const locationInfo = await reverseGeocode(lat, lon);

        if (locationInfo) {
          const saved: SavedLocation = {
            lat,
            lon,
            city: locationInfo.city,
            state: locationInfo.state,
            country: locationInfo.country,
            display: locationInfo.display,
            timestamp: Date.now(),
          };

          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved));
          localStorage.setItem(PERMISSION_STORAGE_KEY, "granted");

          setCoordinates({ lat, lon });
          setLocationName(locationInfo);
          setStatus("success");
        } else {
          setStatus("error");
        }
      },
      (error) => {
        if (error.code === 1) {
          // User denied
          localStorage.setItem(PERMISSION_STORAGE_KEY, "denied");
          setStatus("denied");
        } else {
          // Position unavailable or timeout
          setStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  // Refresh location (force fresh GPS fix)
  const refreshLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    setStatus("loading");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lon } = position.coords;

        // Reverse geocode
        const locationInfo = await reverseGeocode(lat, lon);

        if (locationInfo) {
          const saved: SavedLocation = {
            lat,
            lon,
            city: locationInfo.city,
            state: locationInfo.state,
            country: locationInfo.country,
            display: locationInfo.display,
            timestamp: Date.now(),
          };

          localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(saved));

          setCoordinates({ lat, lon });
          setLocationName(locationInfo);
          setStatus("success");
        } else {
          setStatus("error");
        }
      },
      (error) => {
        if (error.code === 1) {
          setStatus("denied");
        } else {
          setStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [reverseGeocode]);

  // Clear saved location
  const clearLocation = useCallback(() => {
    if (typeof window === "undefined") return;

    localStorage.removeItem(LOCATION_STORAGE_KEY);
    localStorage.removeItem(PERMISSION_STORAGE_KEY);

    setStatus("idle");
    setCoordinates(null);
    setLocationName(null);
  }, []);

  return {
    status,
    coordinates,
    locationName,
    requestLocation,
    refreshLocation,
    clearLocation,
  };
}
