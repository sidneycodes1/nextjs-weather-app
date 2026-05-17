"use client";

import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { GeocodingFeature } from "@mapbox/search-js-core";
import useDebounce from "@/hooks/use-debounce";
import { useRouter, useSearchParams } from "next/navigation";
import { DEFAULT_CITIES } from "@/lib/constants/default-cities";
import SuggestionItem from "./suggestion-item";


export default function LocationSearch({
  onFocusChange,
}: {
  onFocusChange: (isFocused: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodingFeature[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();

  const debouncedQuery = useDebounce(query, 500);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (debouncedQuery.length < 3) {
      setSuggestions([]);
      return;
    }

    // Abort previous request if still running
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const params = new URLSearchParams({
      q: debouncedQuery,
      format: "json",
      limit: "8",
      countrycodes: "ng",
    });

    fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "WeatherPing-Nigeria/1.0",
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        return res.json();
      })
      .then((data: Array<{ display_name: string; lat: string; lon: string; place_id?: number }>) => {
        const features: GeocodingFeature[] = (data || []).map((item, idx) => {
          const parts = item.display_name.split(",").map((s) => s.trim());
          const country = parts.length ? parts[parts.length - 1] : "";
          return {
            id: String(item.place_id ?? `${item.lat}-${item.lon}-${idx}`),
            type: "Feature",
            place_type: ["place"],
            geometry: {
              type: "Point",
              coordinates: [parseFloat(item.lon), parseFloat(item.lat)],
            },
            properties: {
              name: parts[0] ?? item.display_name,
              place_formatted: item.display_name,
              context: { country: { name: country } } as any,
            },
          } as unknown as GeocodingFeature;
        });

        setSuggestions(features);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Geocoding error:", error);
          setSuggestions([]);
        }
      });

    return () => controller.abort();
  }, [debouncedQuery]);

  const handleSelectSuggestion = (feature: GeocodingFeature) => {
    const [lon, lat] = feature.geometry.coordinates;

    const params = new URLSearchParams(searchParams.toString());
    params.set("lat", lat.toString());
    params.set("lon", lon.toString());
    params.set("location", feature.properties?.name || "");
    params.set("country", feature.properties?.context?.country?.name || "");

    router.push(`?${params.toString()}`);

    setQuery("");
    setSuggestions([]);
    setIsFocused(false);

    inputRef.current?.blur();
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocusChange(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    onFocusChange(false);
  };

  const popularCities = [
    { name: "Lagos", lat: 6.5244, lon: 3.3792 },
    { name: "Abuja", lat: 9.0643305, lon: 7.4892974 },
    { name: "Kano", lat: 12.0022, lon: 8.5919 },
    { name: "Port Harcourt", lat: 4.8156, lon: 7.0498 },
    { name: "Ibadan", lat: 7.3775, lon: 3.9470 },
    { name: "Benin City", lat: 6.3382, lon: 5.6258 },
    { name: "Enugu", lat: 6.4413, lon: 7.4948 },
    { name: "Kaduna", lat: 10.5105, lon: 7.4165 },
    { name: "Jos", lat: 9.8965, lon: 8.8583 },
    { name: "Warri", lat: 5.5167, lon: 5.7500 },
  ];

  const handleQuickSelect = (city: { name: string; lat: number; lon: number }) => {
    const feature = {
      id: `${city.name}-${city.lat}-${city.lon}`,
      type: "Feature",
      place_type: ["place"],
      geometry: { type: "Point", coordinates: [city.lon, city.lat] },
      properties: { name: city.name, place_formatted: city.name, context: { country: { name: "Nigeria" } } },
    } as unknown as GeocodingFeature;
    handleSelectSuggestion(feature);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="relative w-full focus:outline-none">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />

        <input
          type="text"
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Search Nigerian cities..."
          className="w-full rounded-full border px-4 py-2 pl-8 text-sm focus:outline-none"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {popularCities.map((c) => (
          <button
            key={c.name}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => handleQuickSelect(c)}
            className="rounded-full border px-3 py-1 text-xs hover:bg-accent"
          >
            {c.name}
          </button>
        ))}
      </div>

      {isFocused && (
        <>
          {suggestions.length === 0 && (
            <p
              className="text-muted-foreground px-2 pt-1 text-xs uppercase"
              onMouseDown={(e) => e.preventDefault()}
            >
              Suggested
            </p>
          )}
          <ul className="flex flex-col">
            {(suggestions.length > 0 ? suggestions : DEFAULT_CITIES).map(
              (feature) => (
                <SuggestionItem
                  key={feature.id}
                  feature={feature}
                  onSelect={handleSelectSuggestion}
                />
              ),
            )}
          </ul>
        </>
      )}
    </div>
  );
}
