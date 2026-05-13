'use client';

import { useMemo } from 'react';
import L from 'leaflet';
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';

const GATE_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  GATE_1: { lat: 10.7749, lng: 106.7894, label: 'Gate 1 (North)' },
  GATE_2: { lat: 10.7778, lng: 106.7974, label: 'Gate 2 (South)' },
  GATE_COLD: { lat: 10.7703, lng: 106.8043, label: 'Cold Gate' },
};

const YARD_COORDS: Record<string, { lat: number; lng: number }> = {
  ZONE_A: { lat: 10.7770, lng: 106.7896 },
  ZONE_B: { lat: 10.7791, lng: 106.7985 },
  ZONE_C: { lat: 10.7799, lng: 106.7916 },
  ZONE_REEFER: { lat: 10.7706, lng: 106.8042 },
};

const EXIT_COORDS: Record<string, { lat: number; lng: number; label: string }> = {
  EXIT_MAIN: { lat: 10.7806, lng: 106.7838, label: 'Exit Main' },
  EXIT_SOUTH: { lat: 10.7711, lng: 106.7929, label: 'Exit South' },
  EXIT_REEFER: { lat: 10.7682, lng: 106.8087, label: 'Exit Reefer' },
};

interface DriverJobMapProps {
  driverLat?: number | null;
  driverLng?: number | null;
  driverName?: string;
  containerNo?: string;
  routeJson?: any;
  type?: 'PICKUP' | 'RETURN_EMPTY';
  destinationLabel?: string;
  destinationLat?: number;
  destinationLng?: number;
  height?: number | string;
}

export function DriverJobMap({
  driverLat,
  driverLng,
  driverName = 'Driver',
  containerNo = '',
  routeJson,
  type = 'PICKUP',
  destinationLabel,
  destinationLat,
  destinationLng,
  height = 280,
}: DriverJobMapProps) {
  const gateId = String(routeJson?.gate ?? 'GATE_1');
  const gate = GATE_COORDS[gateId] ?? GATE_COORDS.GATE_1;
  const yardZone = String(routeJson?.yardZone ?? 'ZONE_A');
  const yard = YARD_COORDS[yardZone] ?? YARD_COORDS.ZONE_A;
  const exit = EXIT_COORDS[String(routeJson?.exitGate ?? 'EXIT_MAIN')] ?? EXIT_COORDS.EXIT_MAIN;

  const driver = useMemo(() => {
    if (driverLat != null && driverLng != null) {
      return { lat: driverLat, lng: driverLng };
    }
    return { lat: yard.lat - 0.011, lng: yard.lng - 0.012 };
  }, [driverLat, driverLng, yard.lat, yard.lng]);

  const driverIcon = useMemo(
    () =>
      L.divIcon({
        className: 'freshsync-driver-icon',
        html: `
          <div style="
            display:flex; align-items:center; justify-content:center;
            width: 36px; height: 36px; border-radius: 50%;
            background:#1d4ed8; color:#fff; font-weight:800; font-size: 14px;
            border: 3px solid #fff; box-shadow: 0 4px 12px rgba(15,23,42,0.25);
          ">🚛</div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      }),
    [],
  );

  const isReturn = type === 'RETURN_EMPTY';
  const finalDestLat = isReturn ? destinationLat ?? exit.lat : exit.lat;
  const finalDestLng = isReturn ? destinationLng ?? exit.lng : exit.lng;
  const finalDestLabel = isReturn ? destinationLabel || 'Assigned depot' : exit.label;

  const pathPositions: [number, number][] = isReturn
    ? [
        [driver.lat, driver.lng],
        [finalDestLat, finalDestLng],
      ]
    : [
        [driver.lat, driver.lng],
        [gate.lat, gate.lng],
        [yard.lat, yard.lng],
        [exit.lat, exit.lng],
      ];

  const tone = isReturn ? '#0ea5e9' : '#1d4ed8';

  return (
    <div className="w-full overflow-hidden rounded-xl border" style={{ height }}>
      <MapContainer center={[yard.lat, yard.lng]} zoom={14} scrollWheelZoom className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[driver.lat, driver.lng]} icon={driverIcon}>
          <Popup>
            <div className="space-y-1">
              <div className="font-semibold">{driverName}</div>
              {containerNo ? <div className="text-sm text-slate-600">{containerNo}</div> : null}
            </div>
          </Popup>
        </Marker>

        {!isReturn ? (
          <>
            <CircleMarker
              center={[gate.lat, gate.lng]}
              radius={9}
              pathOptions={{ color: '#0f172a', fillColor: '#facc15', fillOpacity: 0.9, weight: 2 }}
            >
              <Tooltip direction="top">{gate.label}</Tooltip>
            </CircleMarker>
            <CircleMarker
              center={[yard.lat, yard.lng]}
              radius={9}
              pathOptions={{ color: '#0f172a', fillColor: '#a855f7', fillOpacity: 0.9, weight: 2 }}
            >
              <Tooltip direction="top">{yardZone}</Tooltip>
            </CircleMarker>
          </>
        ) : null}

        <CircleMarker
          center={[finalDestLat, finalDestLng]}
          radius={10}
          pathOptions={{ color: '#0f172a', fillColor: '#22c55e', fillOpacity: 0.92, weight: 2 }}
        >
          <Tooltip direction="top">{finalDestLabel}</Tooltip>
        </CircleMarker>

        <Polyline
          positions={pathPositions}
          pathOptions={{
            color: tone,
            opacity: 0.85,
            weight: 4,
            dashArray: isReturn ? '8 8' : undefined,
          }}
        />
      </MapContainer>
    </div>
  );
}
