'use client';

import { Fragment, useMemo } from 'react';
import L from 'leaflet';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
} from 'react-leaflet';

type Terminal = {
  code: string;
  name: string;
  gate: string;
  zone: string;
  lat: number;
  lng: number;
};

type Gate = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  usedSlots: number;
  maxSlots: number;
  utilizationPct: number;
  status: string;
};

type Truck = {
  assignmentId: string;
  containerNo: string;
  driverName: string;
  type: 'PICKUP' | 'RETURN_EMPTY';
  status: string;
  gate: string;
  terminalCode: string;
  lat: number;
  lng: number;
};

type Disruption = {
  id: string;
  type: string;
  severity: string;
  description: string;
  affectedZones: string[];
};

interface OperatorLiveMapProps {
  center?: { lat: number; lng: number };
  terminals: Terminal[];
  gates: Gate[];
  trucks: Truck[];
  disruptions: Disruption[];
}

export function OperatorLiveMap({
  center,
  terminals,
  gates,
  trucks,
  disruptions,
}: OperatorLiveMapProps) {
  const mapCenter: [number, number] = center ? [center.lat, center.lng] : [10.7756, 106.7961];

  const terminalIcon = useMemo(
    () =>
      L.divIcon({
        className: 'freshsync-terminal-icon',
        html: `
          <div style="
            min-width: 126px;
            border-radius: 14px;
            border: 1px solid rgba(15,23,42,0.12);
            background: rgba(255,255,255,0.94);
            box-shadow: 0 10px 26px rgba(15,23,42,0.14);
            padding: 8px 10px;
            color: #0f172a;
            backdrop-filter: blur(10px);
          ">
            <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #475569;">Terminal</div>
            <div style="margin-top: 4px; font-size: 13px; font-weight: 800;">FreshSync Hub</div>
          </div>
        `,
        iconSize: [126, 54],
        iconAnchor: [63, 27],
      }),
    [],
  );

  const gateLookup = useMemo(
    () =>
      new Map(
        gates.map((gate) => [gate.id, gate]),
      ),
    [gates],
  );

  return (
    <div className="h-[560px] w-full overflow-hidden">
      <MapContainer
        center={mapCenter}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {terminals.map((terminal) => (
          <Marker key={terminal.code} position={[terminal.lat, terminal.lng]} icon={terminalIcon}>
            <Popup>
              <div className="space-y-1">
                <div className="font-semibold">{terminal.name}</div>
                <div className="text-sm text-slate-600">{terminal.code} • {terminal.gate}</div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{terminal.zone}</div>
              </div>
            </Popup>
          </Marker>
        ))}

        {gates.map((gate) => (
          <CircleMarker
            key={gate.id}
            center={[gate.lat, gate.lng]}
            radius={12}
            pathOptions={{
              color: gate.utilizationPct >= 90 ? '#dc2626' : gate.utilizationPct >= 70 ? '#d97706' : '#059669',
              fillColor: gate.utilizationPct >= 90 ? '#ef4444' : gate.utilizationPct >= 70 ? '#f59e0b' : '#10b981',
              fillOpacity: 0.78,
              weight: 2,
            }}
          >
            <Tooltip direction="top" offset={[0, -8]} opacity={1}>
              <div className="text-sm font-medium">{gate.label}</div>
              <div className="text-xs text-slate-500">{gate.usedSlots}/{gate.maxSlots} slots • {gate.utilizationPct}%</div>
            </Tooltip>
          </CircleMarker>
        ))}

        {trucks.map((truck) => {
          const gate = gateLookup.get(truck.gate);
          const tone = truck.type === 'RETURN_EMPTY'
            ? { line: '#0ea5e9', fill: '#38bdf8' }
            : { line: '#1d4ed8', fill: '#3b82f6' };

          return (
            <Fragment key={truck.assignmentId}>
              <CircleMarker
                center={[truck.lat, truck.lng]}
                radius={8}
                pathOptions={{
                  color: tone.line,
                  fillColor: tone.fill,
                  fillOpacity: 0.95,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">{truck.containerNo}</div>
                    <div className="text-sm text-slate-600">{truck.driverName}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {truck.type.replace('_', ' ')} • {truck.status}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>

              {gate ? (
                <Polyline
                  positions={[
                    [truck.lat, truck.lng],
                    [gate.lat, gate.lng],
                  ]}
                  pathOptions={{
                    color: tone.line,
                    opacity: 0.55,
                    weight: 3,
                    dashArray: truck.type === 'RETURN_EMPTY' ? '8 8' : '6 6',
                  }}
                />
              ) : null}
            </Fragment>
          );
        })}

        {disruptions.map((disruption) => {
          const targetGate = gates.find((gate) => disruption.affectedZones.includes(gate.id));
          const targetTerminal = terminals.find(
            (terminal) =>
              disruption.affectedZones.includes(terminal.zone) ||
              disruption.affectedZones.includes(terminal.gate),
          );
          const lat = targetGate?.lat ?? targetTerminal?.lat ?? mapCenter[0];
          const lng = targetGate?.lng ?? targetTerminal?.lng ?? mapCenter[1];
          const radius = disruption.severity === 'CRITICAL' ? 420 : 280;

          return (
            <Circle
              key={disruption.id}
              center={[lat, lng]}
              radius={radius}
              pathOptions={{
                color: disruption.severity === 'CRITICAL' ? '#dc2626' : '#ea580c',
                fillColor: disruption.severity === 'CRITICAL' ? '#fca5a5' : '#fdba74',
                fillOpacity: 0.16,
                weight: 2,
              }}
            >
              <Tooltip direction="top" opacity={1}>
                <div className="space-y-1">
                  <div className="font-semibold">{disruption.type.replace(/_/g, ' ')}</div>
                  <div className="text-xs text-slate-500">{disruption.description}</div>
                </div>
              </Tooltip>
            </Circle>
          );
        })}
      </MapContainer>
    </div>
  );
}
