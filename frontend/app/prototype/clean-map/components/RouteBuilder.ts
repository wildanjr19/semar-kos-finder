import maplibregl from "maplibre-gl";

const routeSourceId = "clean-map-route-source";
const routeLayerId = "clean-map-route-layer";

export function clearRoute(map: maplibregl.Map | null) {
  if (!map) return;
  if (map.getLayer(routeLayerId)) map.removeLayer(routeLayerId);
  if (map.getSource(routeSourceId)) map.removeSource(routeSourceId);
}

export function drawRoute(map: maplibregl.Map | null, coordinates: Array<[number, number]>) {
  if (!map || coordinates.length < 2) return;

  const routeFeature = {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates,
    },
  };

  const source = map.getSource(routeSourceId) as maplibregl.GeoJSONSource | undefined;
  if (source) {
    source.setData(routeFeature as never);
  } else {
    map.addSource(routeSourceId, {
      type: "geojson",
      data: routeFeature as never,
    });
    map.addLayer({
      id: routeLayerId,
      type: "line",
      source: routeSourceId,
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#0f766e",
        "line-width": 5,
        "line-opacity": 0.9,
      },
    });
  }

  const bounds = new maplibregl.LngLatBounds(coordinates[0], coordinates[0]);
  coordinates.forEach((coord) => bounds.extend(coord));
  map.fitBounds(bounds, { padding: 72, duration: 800, maxZoom: 15 });
}
