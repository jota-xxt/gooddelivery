import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import AddressSearch from './AddressSearch';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const createColoredIcon = (color: string) =>
  L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

export interface MapMarker {
  lat: number;
  lng: number;
  label?: string;
  color?: string;
}

interface MapPickerProps {
  mode?: 'view' | 'pick';
  markers?: MapMarker[];
  onLocationSelect?: (lat: number, lng: number) => void;
  searchEnabled?: boolean;
  center?: [number, number];
  zoom?: number;
  height?: string;
  className?: string;
}

const MapPicker = ({
  mode = 'view',
  markers = [],
  onLocationSelect,
  searchEnabled = false,
  center = [-14.235, -51.925],
  zoom = 4,
  height = '300px',
  className,
}: MapPickerProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const pickMarkerRef = useRef<L.Marker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (mode === 'pick') {
      map.on('click', (e: L.LeafletMouseEvent) => {
        if (pickMarkerRef.current) {
          pickMarkerRef.current.setLatLng(e.latlng);
        } else {
          pickMarkerRef.current = L.marker(e.latlng, { icon: createColoredIcon('hsl(358, 82%, 53%)') }).addTo(map);
        }
        onLocationSelect?.(e.latlng.lat, e.latlng.lng);
      });
    }

    // Ensure proper sizing on init and container resize
    setTimeout(() => map.invalidateSize(), 100);

    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update markers
  useEffect(() => {
    if (!markersLayerRef.current || !mapRef.current) return;
    markersLayerRef.current.clearLayers();

    markers.forEach((m) => {
      const icon = m.color ? createColoredIcon(m.color) : new L.Icon.Default();
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(markersLayerRef.current!);
      if (m.label) marker.bindPopup(m.label);
    });

    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [markers]);

  const handleSearchSelect = (lat: number, lng: number) => {
    if (!mapRef.current) return;
    mapRef.current.setView([lat, lng], 16);
    if (mode === 'pick') {
      if (pickMarkerRef.current) {
        pickMarkerRef.current.setLatLng([lat, lng]);
      } else {
        pickMarkerRef.current = L.marker([lat, lng], { icon: createColoredIcon('hsl(358, 82%, 53%)') }).addTo(mapRef.current);
      }
      onLocationSelect?.(lat, lng);
    }
  };

  return (
    <div className={className}>
      {searchEnabled && (
        <div className="mb-2">
          <AddressSearch onSelect={(lat, lng) => handleSearchSelect(lat, lng)} />
        </div>
      )}
      <div
        ref={containerRef}
        style={{ height, width: '100%' }}
        className="rounded-lg overflow-hidden border"
      />
    </div>
  );
};

export default MapPicker;
