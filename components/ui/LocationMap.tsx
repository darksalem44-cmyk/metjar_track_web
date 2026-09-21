'use client';

import { MapContainer, TileLayer, Marker, useMapEvents, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';

const pinIcon = L.divIcon({
  className: 'custom-leaflet-pin',
  html: `<div style="width:34px;height:34px;display:grid;place-items:center;transform:translate(-50%,-100%);">
    <span style="display:block;width:30px;height:30px;border-radius:50% 50% 50% 0;background:#984399;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.35);">
      <span style="position:absolute;inset:0;display:grid;place-items:center;">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff" style="transform:rotate(45deg)"><path d="M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/></svg>
      </span>
    </span>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 34],
  popupAnchor: [0, -34],
});

export interface LatLngValue {
  latitude: number;
  longitude: number;
}

function ClickCatcher({ onSelect }: { onSelect?: (p: LatLngValue) => void }) {
  useMapEvents({
    click(e: L.LeafletMouseEvent) {
      if (onSelect) onSelect({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    },
  });
  return null;
}

function FlyTo({ center }: { center?: LatLngValue }) {
  const map = useMapEvents({});
  const prev = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!center) return;
    const key = `${center.latitude},${center.longitude}`;
    if (prev.current === key) return;
    prev.current = key;
    map.flyTo([center.latitude, center.longitude], Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [center, map]);
  return null;
}

export default function LocationMap({
  center,
  onSelect,
  zoom = 13,
  className,
  heightClass = 'h-[260px]',
}: {
  center?: LatLngValue;
  onSelect?: (p: LatLngValue) => void;
  zoom?: number;
  className?: string;
  heightClass?: string;
}) {
  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-[var(--border)] z-0', heightClass, className)}>
      <MapContainer
        center={center ? [center.latitude, center.longitude] : [34.8021, 38.9968]}
        zoom={zoom}
        scrollWheelZoom
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatcher onSelect={onSelect} />
        {center && <Marker position={[center.latitude, center.longitude]} icon={pinIcon} />}
        <FlyTo center={center} />
      </MapContainer>
      {onSelect && (
        <div className="absolute bottom-2 inset-x-2 z-[500] flex items-center justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-[var(--surface)]/95 border border-[var(--border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--text-secondary)] shadow-sm backdrop-blur">
            <MapPin className="w-3.5 h-3.5 text-[var(--primary)]" />
            اضغط على الخريطة لتحديد الموقع
          </span>
        </div>
      )}
    </div>
  );
}

export { pinIcon };