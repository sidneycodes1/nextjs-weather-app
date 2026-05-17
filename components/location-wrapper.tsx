"use client";

import { useEffect, useState } from "react";
import { useLocation } from "@/hooks/use-location";
import { LocationPermissionModal } from "@/components/location-permission-modal";
import { LocationStatusBar } from "@/components/location-status-bar";
import { useRouter } from "next/navigation";

export function LocationWrapper() {
  const router = useRouter();
  const { status, coordinates, locationName, requestLocation, refreshLocation, clearLocation } = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  // Check on mount if we should show the modal
  useEffect(() => {
    if (typeof window === "undefined") return;

    const permission = localStorage.getItem("weatherping_location_permission");
    const location = localStorage.getItem("weatherping_location");

    // Show modal only on first load if no permission has been set and no location saved
    if (isFirstLoad && !permission && !location) {
      setShowModal(true);
      setIsFirstLoad(false);
    }
  }, [isFirstLoad]);

  const handleAllow = () => {
    requestLocation();
  };

  const handleCancel = () => {
    setShowModal(false);
  };

  // Update URL when location changes to success
  useEffect(() => {
    if (status === "success" && coordinates && locationName) {
      const params = new URLSearchParams({
        lat: coordinates.lat.toString(),
        lon: coordinates.lon.toString(),
        location: locationName.city,
        country: locationName.country,
      });
      router.push(`/?${params.toString()}`);
    }
  }, [status, coordinates, locationName, router]);

  return (
    <>
      <LocationPermissionModal
        isOpen={showModal}
        status={status}
        locationDisplay={locationName?.display || null}
        onAllow={handleAllow}
        onCancel={handleCancel}
        onRetry={requestLocation}
      />

      <LocationStatusBar
        status={status}
        locationDisplay={locationName?.display || null}
        onRefresh={refreshLocation}
        onRetry={requestLocation}
        isManual={false}
      />
    </>
  );
}
