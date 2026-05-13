'use client';

import { Fragment, useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';

export type DepotMapDepot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  currentLoad: number;
  loadPct: number;
  status: string;
};

interface DepotMapProps {
  driverLat: number;
  driverLng: number;
  driverName?: string;
  containerNo?: string;
  depots: DepotMapDepot[];
  recommendedDepotName?: string;
  height?: number | string;
}

export function DepotMap({
  driverLat,
  driverLng,
  driverName = 'Driver',
  containerNo,
  depots,
  recommendedDepotName,
  height = 360,
}: DepotMapProps) {
  const center = useMemo<[number, number]>(() => {
    if (depots.length === 0) return [driverLat, driverLng];
    const allLat = [driverLat, ...depots.map((depot) => depot.lat)];
    const allLng = [driverLng, ...depots.map((depot) => depot.lng)];
    return [
      allLat.reduce((acc, v) => acc + v, 0) / allLat.length,
      allLng.reduce((acc, v) => acc + v, 0) / allLng.length,
    ];
  }, [depots, driverLat, driverLng]);

  const driverIcon = useMemo(
    () =>
      L.divIcon({
        className: 'freshsync-driver-icon',
        html: `
          <div style="display:flex; align-items:center; justify-content:center;
            width: 38px; height: 38px; border-radius: 50%;
            background:#1d4ed8; color:#fff; font-weight:800; font-size: 16px;
            border: 3px solid #fff; box-shadow: 0 4px 12px rgba(15,23,42,0.25);
          ">🚛</div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      }),
    [],
  );

  const recommendedDepot = depots.find((depot) => depot.name === recommendedDepotName);

  return (
    <div className="w-full overflow-hidden rounded-xl border" style={{ height }}>
      <MapContainer center={center} zoom={11} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[driverLat, driverLng]} icon={driverIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{driverName}</div>
              {containerNo ? <div className="text-sm text-slate-600">{containerNo}</div> : null}
              <div className="text-xs text-slate-500">Empty container at hand</div>
            </div>
          </Popup>
        </Marker>

        {depots.map((depot) => {
          const isRecommended = depot.name === recommendedDepotName;
          const isFull = depot.status === 'FULL';
          const ringColor = isRecommended ? '#16a34a' : isFull ? '#dc2626' : depot.loadPct > 75 ? '#d97706' : '#0ea5e9';
          const fillColor = isRecommended ? '#22c55e' : isFull ? '#fca5a5' : depot.loadPct > 75 ? '#fcd34d' : '#7dd3fc';

          return (
            <Fragment key={depot.id}>
              <CircleMarker
                center={[depot.lat, depot.lng]}
                radius={isRecommended ? 14 : 10}
                pathOptions={{
                  color: ringColor,
                  fillColor,
                  fillOpacity: 0.85,
                  weight: isRecommended ? 3 : 2,
                }}
              >
                <Tooltip direction="top" opacity={1}>
                  <div className="space-y-1">
                    <div className="font-semibold">{depot.name}</div>
                    <div className="text-xs text-slate-600">
                      {depot.currentLoad}/{depot.capacity} • {depot.loadPct}% • {depot.status}
                    </div>
                  </div>
                </Tooltip>
              </CircleMarker>

              <Polyline
                positions={[
                  [driverLat, driverLng],
                  [depot.lat, depot.lng],
                ]}
                pathOptions={{
                  color: isRecommended ? '#16a34a' : isFull ? '#dc2626' : '#94a3b8',
                  weight: isRecommended ? 4 : 2,
                  opacity: isRecommended ? 0.9 : 0.45,
                  dashArray: isRecommended ? undefined : '6 8',
                }}
              />
            </Fragment>
          );
        })}

        {recommendedDepot ? null : null}
      </MapContainer>
    </div>
  );
}
