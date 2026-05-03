"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { CleanKos, Destination } from "../../../types/kos";
import { buildMarkerElement } from "./components/MarkerBuilder";
import { buildPopupContent } from "./components/PopupContentBuilder";
import { drawRoute, clearRoute as clearRouteLayer } from "./components/RouteBuilder";
import styles from "./MapView.module.css";

export type MapViewHandle = {
  flyTo: (kos: CleanKos) => void;
  clearRoute: () => void;
};

type MapViewProps = {
  items: CleanKos[];
  destinations: Destination[];
};

const MapView = forwardRef<MapViewHandle, MapViewProps>(
  function MapView({ items, destinations }, ref) {
    const mapContainerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const markersRef = useRef<maplibregl.Marker[]>([]);
    const hasFitBoundsRef = useRef(false);
    const [mapReady, setMapReady] = useState(false);

    useEffect(() => {
      hasFitBoundsRef.current = false;
    }, [items]);

    useEffect(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      mapRef.current = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "&copy; OpenStreetMap",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [110.856, -7.559],
        zoom: 14,
      });

      mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");
      const onLoad = () => setMapReady(true);
      mapRef.current.on("load", onLoad);
      if (mapRef.current.loaded()) setMapReady(true);

      return () => {
        mapRef.current?.off("load", onLoad);
        markersRef.current.forEach((marker) => marker.remove());
        markersRef.current = [];
        mapRef.current?.remove();
        mapRef.current = null;
        setMapReady(false);
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        flyTo: (kos: CleanKos) => {
          mapRef.current?.flyTo({
            center: [kos.lon, kos.lat],
            zoom: 16,
            duration: 700,
          });
        },
        clearRoute: () => {
          clearRouteLayer(mapRef.current);
        },
      }),
      [],
    );

    useEffect(() => {
      const map = mapRef.current;
      if (!map || !mapReady) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = items.map((kos) => {
        const el = buildMarkerElement(kos);
        const popupNode = buildPopupContent(
          kos,
          destinations,
          (coords) => drawRoute(map, coords),
          () => clearRouteLayer(map),
        );
        const popup = new maplibregl.Popup({ offset: 25, className: "kos-popup" }).setDOMContent(
          popupNode,
        );
        popup.on("close", () => clearRouteLayer(map));

        return new maplibregl.Marker({ element: el, offset: [0, -18] })
          .setLngLat([kos.lon, kos.lat])
          .setPopup(popup)
          .addTo(map);
      });

      if (items.length > 0 && !hasFitBoundsRef.current) {
        const bounds = new maplibregl.LngLatBounds(
          [items[0].lon, items[0].lat],
          [items[0].lon, items[0].lat],
        );
        items.forEach((item) => bounds.extend([item.lon, item.lat]));
        const isMobile = typeof window !== "undefined" && window.innerWidth < 760;
        map.fitBounds(bounds, {
          padding: isMobile ? 64 : { top: 88, right: 64, bottom: 64, left: 380 },
          duration: 600,
          maxZoom: 15,
        });
        hasFitBoundsRef.current = true;
      }
    }, [items, destinations, mapReady]);

    return <div ref={mapContainerRef} className={styles.mapContainer} />;
  },
);

export default MapView;
