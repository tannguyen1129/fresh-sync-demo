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

export type PortMapTerminal = {
  code: string;
  name: string;
  gate: string;
  zone: string;
  lat: number;
  lng: number;
};

export type PortMapGate = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  usedSlots: number;
  maxSlots: number;
  utilizationPct: number;
  status: string;
  isPeakHour?: boolean;
};

export type PortMapDepot = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  currentLoad: number;
  loadPct: number;
  status: string;
};

export type PortMapTruck = {
  assignmentId: string;
  containerNo: string;
  driverName: string;
  type: 'PICKUP' | 'RETURN_EMPTY';
  status: string;
  gate?: string;
  terminalCode?: string;
  companyName?: string;
  licensePlate?: string;
  lat: number;
  lng: number;
};

export type PortMapDisruption = {
  id: string;
  type: string;
  severity: string;
  description: string;
  affectedZones: string[];
};

export interface PortMapProps {
  center?: { lat: number; lng: number };
  height?: number | string;
  zoom?: number;
  terminals?: PortMapTerminal[];
  gates?: PortMapGate[];
  depots?: PortMapDepot[];
  trucks?: PortMapTruck[];
  disruptions?: PortMapDisruption[];
  highlightedDepotId?: string;
  showRoutes?: boolean;
  selectedTruckId?: string;
}

export function PortMap({
  center,
  height = 560,
  zoom = 14,
  terminals = [],
  gates = [],
  depots = [],
  trucks = [],
  disruptions = [],
  highlightedDepotId,
  showRoutes = true,
  selectedTruckId,
}: PortMapProps) {
  const mapCenter: [number, number] = center ? [center.lat, center.lng] : [10.7756, 106.7961];

  const terminalIcon = useMemo(
    () =>
      L.divIcon({
        className: 'freshsync-terminal-icon',
        html: `
          <div style="
            min-width: 130px;
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
        iconSize: [130, 54],
        iconAnchor: [65, 27],
      }),
    [],
  );

  const depotIcon = useMemo(
    () => (highlighted: boolean, status: string) =>
      L.divIcon({
        className: 'freshsync-depot-icon',
        html: `
          <div style="
            min-width: 90px;
            border-radius: 12px;
            border: 2px solid ${highlighted ? '#16a34a' : status === 'FULL' ? '#dc2626' : '#0ea5e9'};
            background: ${highlighted ? '#dcfce7' : status === 'FULL' ? '#fee2e2' : '#e0f2fe'};
            box-shadow: 0 6px 18px rgba(15,23,42,0.12);
            padding: 6px 8px;
            color: #0f172a;
          ">
            <div style="font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${highlighted ? '#15803d' : status === 'FULL' ? '#b91c1c' : '#0369a1'};">Depot</div>
            <div style="font-size: 11px; font-weight: 700;">${status}</div>
          </div>
        `,
        iconSize: [90, 42],
        iconAnchor: [45, 21],
      }),
    [],
  );

  const gateLookup = useMemo(() => new Map(gates.map((gate) => [gate.id, gate])), [gates]);

  return (
    <div className="h-full w-full overflow-hidden" style={{ height }}>
      <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom className="h-full w-full">
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
              <div className="text-xs text-slate-500">
                {gate.usedSlots}/{gate.maxSlots} slots • {gate.utilizationPct}%{gate.isPeakHour ? ' • Peak' : ''}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

        {depots.map((depot) => {
          const highlighted = depot.id === highlightedDepotId;
          return (
            <Marker
              key={depot.id}
              position={[depot.lat, depot.lng]}
              icon={depotIcon(highlighted, depot.status)}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-semibold">{depot.name}</div>
                  <div className="text-sm text-slate-600">
                    {depot.currentLoad}/{depot.capacity} TEUs • {depot.loadPct}%
                  </div>
                  <div className="text-xs uppercase tracking-wide text-slate-500">{depot.status}</div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {trucks.map((truck) => {
          const gate = truck.gate ? gateLookup.get(truck.gate) : undefined;
          const isSelected = truck.assignmentId === selectedTruckId;
          const tone =
            truck.type === 'RETURN_EMPTY'
              ? { line: '#0ea5e9', fill: '#38bdf8' }
              : { line: '#1d4ed8', fill: '#3b82f6' };

          return (
            <Fragment key={truck.assignmentId}>
              <CircleMarker
                center={[truck.lat, truck.lng]}
                radius={isSelected ? 11 : 8}
                pathOptions={{
                  color: isSelected ? '#1e1b4b' : tone.line,
                  fillColor: tone.fill,
                  fillOpacity: 0.95,
                  weight: isSelected ? 3 : 2,
                }}
              >
                <Popup>
                  <div className="space-y-1">
                    <div className="font-semibold">{truck.containerNo}</div>
                    <div className="text-sm text-slate-600">{truck.driverName}</div>
                    {truck.licensePlate ? (
                      <div className="text-xs text-slate-500">{truck.licensePlate}</div>
                    ) : null}
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      {truck.type.replace('_', ' ')} • {truck.status}
                    </div>
                    {truck.companyName ? (
                      <div className="text-xs text-slate-500">{truck.companyName}</div>
                    ) : null}
                  </div>
                </Popup>
              </CircleMarker>

              {showRoutes && gate ? (
                <Polyline
                  positions={[
                    [truck.lat, truck.lng],
                    [gate.lat, gate.lng],
                  ]}
                  pathOptions={{
                    color: tone.line,
                    opacity: isSelected ? 0.85 : 0.55,
                    weight: isSelected ? 4 : 3,
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
                fillOpacity: 0.18,
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
