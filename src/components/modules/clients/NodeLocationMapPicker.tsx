"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Search,
  Navigation,
  Layers,
  ExternalLink,
  Loader2,
  Check,
  Globe,
} from "lucide-react";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DetectedLocationData {
  address?: string;
  canton?: string;
  parish?: string;
  province?: string;
  fullDisplayName?: string;
}

interface NodeLocationMapPickerProps {
  coordinates?: Coordinates | null;
  onChangeCoordinates: (coords: Coordinates) => void;
  onAddressDetected?: (data: DetectedLocationData) => void;
  province?: string;
  canton?: string;
  detailedAddress?: string;
}

const ECUADOR_PROVINCE_COORDINATES: Record<string, { lat: number; lng: number; zoom: number }> = {
  Pichincha: { lat: -0.180653, lng: -78.467838, zoom: 13 },
  Guayas: { lat: -2.189412, lng: -79.889066, zoom: 13 },
  Azuay: { lat: -2.900128, lng: -79.005896, zoom: 13 },
  Manabí: { lat: -1.054580, lng: -80.454450, zoom: 13 },
  "El Oro": { lat: -3.258111, lng: -79.955400, zoom: 13 },
  Tungurahua: { lat: -1.249080, lng: -78.616750, zoom: 13 },
  Loja: { lat: -3.993130, lng: -79.204220, zoom: 13 },
  Chimborazo: { lat: -1.663550, lng: -78.654640, zoom: 13 },
  Imbabura: { lat: 0.351710, lng: -78.122330, zoom: 13 },
  "Santo Domingo de los Tsáchilas": { lat: -0.253050, lng: -79.175360, zoom: 13 },
  Cotopaxi: { lat: -0.935210, lng: -78.615540, zoom: 13 },
  Esmeraldas: { lat: 0.959200, lng: -79.653970, zoom: 13 },
  "Los Ríos": { lat: -1.802170, lng: -79.534430, zoom: 13 },
  "Santa Elena": { lat: -2.226220, lng: -80.858730, zoom: 13 },
  Cañar: { lat: -2.741000, lng: -78.847000, zoom: 13 },
  Carchi: { lat: 0.812000, lng: -77.717000, zoom: 13 },
  Bolívar: { lat: -1.591000, lng: -79.004000, zoom: 13 },
  Pastaza: { lat: -1.488000, lng: -77.999000, zoom: 13 },
  "Morona Santiago": { lat: -2.308000, lng: -78.118000, zoom: 13 },
  Napo: { lat: -0.993000, lng: -77.813000, zoom: 13 },
  Orellana: { lat: -0.461000, lng: -76.988000, zoom: 13 },
  Sucumbíos: { lat: 0.085000, lng: -76.883000, zoom: 13 },
  "Zamora Chinchipe": { lat: -4.067000, lng: -78.956000, zoom: 13 },
  Galápagos: { lat: -0.743000, lng: -90.313000, zoom: 11 },
};

export default function NodeLocationMapPicker({
  coordinates,
  onChangeCoordinates,
  onAddressDetected,
  province = "Pichincha",
  canton = "",
  detailedAddress = "",
}: NodeLocationMapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string | null>(null);
  const [detectedData, setDetectedData] = useState<DetectedLocationData | null>(null);
  const [hasAppliedAddress, setHasAppliedAddress] = useState(false);

  // Inputs manuales de latitud y longitud
  const [latInput, setLatInput] = useState(coordinates?.lat ? coordinates.lat.toFixed(6) : "");
  const [lngInput, setLngInput] = useState(coordinates?.lng ? coordinates.lng.toFixed(6) : "");

  // Crear icono SVG personalizado para Leaflet
  const createCustomIcon = useCallback((L: any) => {
    return L.divIcon({
      className: "custom-map-marker-pin",
      html: `
        <div style="position: relative; transform: translate(-50%, -100%); cursor: grab;">
          <div style="
            background: linear-gradient(135deg, #004ac6 0%, #002d7a 100%);
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(0, 74, 198, 0.45);
            border: 2.5px solid #ffffff;
          ">
            <svg style="transform: rotate(45deg); width: 17px; height: 17px; color: #ffffff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3" fill="#ffffff"/>
            </svg>
          </div>
          <div style="
            width: 10px;
            height: 5px;
            background: rgba(0, 0, 0, 0.25);
            border-radius: 50%;
            margin: -2px auto 0;
            filter: blur(1px);
          "></div>
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 34],
    });
  }, []);

  // Geocodificación inversa mediante Nominatim
  const performReverseGeocode = useCallback(
    async (lat: number, lng: number) => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "es" } }
        );
        if (!response.ok) return;
        const data = await response.json();
        const addr = data.address || {};

        const road = addr.road || addr.pedestrian || addr.footway || addr.path || "";
        const houseNum = addr.house_number ? ` #${addr.house_number}` : "";
        const neighbourhood = addr.neighbourhood || addr.suburb || addr.quarter || "";
        const city = addr.city || addr.town || addr.municipality || addr.county || "";
        const parishName = addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || "";
        const provinceName = addr.state || "";

        let cleanAddress = "";
        if (road) {
          cleanAddress = `${road}${houseNum}${neighbourhood ? ", " + neighbourhood : ""}`.trim();
        } else if (neighbourhood) {
          cleanAddress = neighbourhood;
        } else if (data.display_name) {
          cleanAddress = data.display_name.split(",").slice(0, 2).join(",").trim();
        }

        const info: DetectedLocationData = {
          address: cleanAddress,
          canton: city,
          parish: parishName,
          province: provinceName,
          fullDisplayName: data.display_name,
        };

        setDetectedAddress(cleanAddress || data.display_name);
        setDetectedData(info);
        setHasAppliedAddress(false);
      } catch (err) {
        console.warn("Aviso al geocodificar coordenadas:", err);
      }
    },
    []
  );

  // Inicialización de Leaflet
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Si ya hay un mapa instanciado en este contenedor, removerlo limpiamente
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Determinar centro inicial
      let initialLat = -0.180653;
      let initialLng = -78.467838;
      let initialZoom = 13;

      if (coordinates?.lat && coordinates?.lng) {
        initialLat = coordinates.lat;
        initialLng = coordinates.lng;
        initialZoom = 16;
      } else if (province && ECUADOR_PROVINCE_COORDINATES[province]) {
        const provData = ECUADOR_PROVINCE_COORDINATES[province];
        initialLat = provData.lat;
        initialLng = provData.lng;
        initialZoom = provData.zoom;
      }

      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: initialZoom,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      // Capa base
      const streetLayer = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
        }
      );

      streetLayer.addTo(map);
      tileLayerRef.current = streetLayer;

      // Marcador
      const icon = createCustomIcon(L);
      const marker = L.marker([initialLat, initialLng], {
        icon,
        draggable: true,
      }).addTo(map);

      markerRef.current = marker;
      mapInstanceRef.current = map;

      // Evento de arrastre de marcador
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setLatInput(pos.lat.toFixed(6));
        setLngInput(pos.lng.toFixed(6));
        onChangeCoordinates({ lat: pos.lat, lng: pos.lng });
        performReverseGeocode(pos.lat, pos.lng);
      });

      // Evento de click en el mapa
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setLatInput(lat.toFixed(6));
        setLngInput(lng.toFixed(6));
        onChangeCoordinates({ lat, lng });
        performReverseGeocode(lat, lng);
      });

      // Si había coordenadas previas, hacer geocodificación inversa inicial
      if (coordinates?.lat && coordinates?.lng) {
        performReverseGeocode(coordinates.lat, coordinates.lng);
      }

      // Forzar ajuste de tamaño tras renderizado del modal
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 250);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Cambio de tipo de mapa (Calles vs Satélite)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    import("leaflet").then((L) => {
      if (!mapInstanceRef.current) return;
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current);
      }

      if (mapType === "satellite") {
        tileLayerRef.current = L.tileLayer(
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          { maxZoom: 19 }
        ).addTo(mapInstanceRef.current);
      } else {
        tileLayerRef.current = L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          { maxZoom: 19, subdomains: "abcd" }
        ).addTo(mapInstanceRef.current);
      }
    });
  }, [mapType]);

  // Si cambian las coordenadas externas (y difieren de las actuales), mover el marcador
  useEffect(() => {
    if (!coordinates?.lat || !coordinates?.lng || !markerRef.current || !mapInstanceRef.current) return;
    const current = markerRef.current.getLatLng();
    if (Math.abs(current.lat - coordinates.lat) > 0.00001 || Math.abs(current.lng - coordinates.lng) > 0.00001) {
      markerRef.current.setLatLng([coordinates.lat, coordinates.lng]);
      mapInstanceRef.current.panTo([coordinates.lat, coordinates.lng]);
      setLatInput(coordinates.lat.toFixed(6));
      setLngInput(coordinates.lng.toFixed(6));
    }
  }, [coordinates?.lat, coordinates?.lng]);

  // Si el usuario cambia la provincia y aún no tiene coordenadas fijadas, reubicar el mapa en la provincia
  useEffect(() => {
    if (!coordinates?.lat && province && ECUADOR_PROVINCE_COORDINATES[province] && mapInstanceRef.current && markerRef.current) {
      const p = ECUADOR_PROVINCE_COORDINATES[province];
      mapInstanceRef.current.flyTo([p.lat, p.lng], p.zoom);
      markerRef.current.setLatLng([p.lat, p.lng]);
      setLatInput(p.lat.toFixed(6));
      setLngInput(p.lng.toFixed(6));
      onChangeCoordinates({ lat: p.lat, lng: p.lng });
    }
  }, [province]);

  // Búsqueda de dirección mediante Nominatim
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const fullQuery = `${searchQuery.trim()}, ${canton ? canton + ", " : ""}${province ? province + ", " : ""}Ecuador`;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1&addressdetails=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const item = data[0];
        const newLat = parseFloat(item.lat);
        const newLng = parseFloat(item.lon);

        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setLatLng([newLat, newLng]);
          mapInstanceRef.current.flyTo([newLat, newLng], 17);
        }

        setLatInput(newLat.toFixed(6));
        setLngInput(newLng.toFixed(6));
        onChangeCoordinates({ lat: newLat, lng: newLng });
        performReverseGeocode(newLat, newLng);
      } else {
        // Reintentar sin provincia si fue muy restrictivo
        const fallbackRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery.trim() + ", Ecuador")}&limit=1&addressdetails=1`,
          { headers: { "Accept-Language": "es" } }
        );
        const fallbackData = await fallbackRes.json();
        if (fallbackData && fallbackData.length > 0) {
          const item = fallbackData[0];
          const newLat = parseFloat(item.lat);
          const newLng = parseFloat(item.lon);

          if (markerRef.current && mapInstanceRef.current) {
            markerRef.current.setLatLng([newLat, newLng]);
            mapInstanceRef.current.flyTo([newLat, newLng], 17);
          }

          setLatInput(newLat.toFixed(6));
          setLngInput(newLng.toFixed(6));
          onChangeCoordinates({ lat: newLat, lng: newLng });
          performReverseGeocode(newLat, newLng);
        }
      }
    } catch (err) {
      console.warn("Error en búsqueda geográfica:", err);
    } finally {
      setIsSearching(false);
    }
  };

  // Geolocalización del navegador ("Mi Ubicación Actual")
  const handleGetMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const newCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setLatInput(newCoords.lat.toFixed(6));
        setLngInput(newCoords.lng.toFixed(6));
        onChangeCoordinates(newCoords);

        if (markerRef.current && mapInstanceRef.current) {
          markerRef.current.setLatLng([newCoords.lat, newCoords.lng]);
          mapInstanceRef.current.flyTo([newCoords.lat, newCoords.lng], 17);
        }
        performReverseGeocode(newCoords.lat, newCoords.lng);
      },
      (err) => {
        setIsLocating(false);
        console.warn("Error en geolocalización del dispositivo:", err);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Aplicar coordenadas manuales escritas en los inputs
  const handleApplyManualCoords = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      onChangeCoordinates({ lat, lng });
      if (markerRef.current && mapInstanceRef.current) {
        markerRef.current.setLatLng([lat, lng]);
        mapInstanceRef.current.panTo([lat, lng]);
      }
      performReverseGeocode(lat, lng);
    }
  };

  // Aplicar datos geocodificados a los campos del formulario
  const handleApplyAddressToForm = () => {
    if (detectedData && onAddressDetected) {
      onAddressDetected(detectedData);
      setHasAppliedAddress(true);
    }
  };

  const currentLat = coordinates?.lat ?? parseFloat(latInput);
  const currentLng = coordinates?.lng ?? parseFloat(lngInput);
  const hasValidCoords = !isNaN(currentLat) && !isNaN(currentLng);

  return (
    <div className="space-y-2">
      {/* Barra de herramientas superior */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-[240px]">
          <form onSubmit={handleSearch} className="relative flex-1">
            <input
              type="text"
              placeholder="Buscar dirección, calle o referencia en Ecuador..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-16 py-1.5 rounded-[6px] border border-slate-200 bg-white focus:outline-hidden focus:border-[#004ac6] font-medium"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 px-2 py-0.5 bg-[#004ac6] hover:bg-[#003da6] disabled:opacity-50 text-white rounded-[4px] text-[10px] font-bold cursor-pointer transition-colors"
            >
              {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Buscar"}
            </button>
          </form>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Botón Mi Ubicación */}
          <button
            type="button"
            onClick={handleGetMyLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
            title="Ubicar mi posición actual por GPS"
          >
            {isLocating ? (
              <Loader2 className="w-3.5 h-3.5 text-[#004ac6] animate-spin" />
            ) : (
              <Navigation className="w-3.5 h-3.5 text-[#004ac6]" />
            )}
            <span className="hidden sm:inline">Mi GPS</span>
          </button>

          {/* Selector de capa: Calles vs Satélite */}
          <div className="inline-flex rounded-[6px] border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setMapType("streets")}
              className={`px-2 py-1 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                mapType === "streets"
                  ? "bg-[#004ac6] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Calles
            </button>
            <button
              type="button"
              onClick={() => setMapType("satellite")}
              className={`px-2 py-1 rounded-[4px] text-[11px] font-bold transition-colors cursor-pointer ${
                mapType === "satellite"
                  ? "bg-[#004ac6] text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Satélite
            </button>
          </div>

          {/* Abrir en Google Maps */}
          {hasValidCoords && (
            <a
              href={`https://www.google.com/maps?q=${currentLat},${currentLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] border border-slate-200 bg-white hover:bg-slate-50 text-[#004ac6] text-xs font-bold cursor-pointer shadow-2xs transition-colors"
              title="Abrir punto en Google Maps oficial"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Google Maps</span>
            </a>
          )}
        </div>
      </div>

      {/* Contenedor del Mapa Interactivo Leaflet */}
      <div className="relative rounded-[6px] border border-slate-200 overflow-hidden bg-slate-100 shadow-2xs">
        <div ref={mapContainerRef} className="w-full h-[250px] sm:h-[280px] z-10" />

        {/* Indicador flotante sobre el mapa */}
        <div className="absolute top-2 left-2 z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-[4px] bg-slate-900/85 backdrop-blur-xs text-white text-[10px] font-bold shadow-sm">
            <MapPin className="w-3 h-3 text-emerald-400" />
            Haz clic o arrastra el marcador para fijar la ubicación exacta
          </span>
        </div>
      </div>

      {/* Barra de Coordenadas y Dirección Detectada */}
      <div className="p-2.5 bg-slate-50 rounded-[6px] border border-slate-200 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Inputs de coordenadas Lat y Lng */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-500 font-sans">Lat:</span>
              <input
                type="text"
                value={latInput}
                onChange={(e) => setLatInput(e.target.value)}
                onBlur={handleApplyManualCoords}
                placeholder="-0.180653"
                className="w-24 px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-800 font-mono font-semibold"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-500 font-sans">Lng:</span>
              <input
                type="text"
                value={lngInput}
                onChange={(e) => setLngInput(e.target.value)}
                onBlur={handleApplyManualCoords}
                placeholder="-78.467838"
                className="w-24 px-2 py-1 text-xs rounded border border-slate-200 bg-white text-slate-800 font-mono font-semibold"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyManualCoords}
              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded cursor-pointer transition-colors font-sans"
              title="Fijar estas coordenadas en el mapa"
            >
              Fijar
            </button>
          </div>

          {/* Botón para aplicar dirección detectada al formulario */}
          {detectedAddress && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleApplyAddressToForm}
                disabled={hasAppliedAddress}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-bold cursor-pointer transition-colors shadow-2xs ${
                  hasAppliedAddress
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                    : "bg-[#004ac6] hover:bg-[#003da6] text-white"
                }`}
              >
                {hasAppliedAddress ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-700" />
                    <span>Dirección Aplicada</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3 h-3" />
                    <span>Rellenar Dirección Detectada</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Texto de dirección detectada */}
        {detectedAddress && (
          <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200/80 flex items-start gap-1.5 leading-snug">
            <MapPin className="w-3.5 h-3.5 text-[#004ac6] shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-slate-800">Ubicación detectada: </span>
              <span className="text-slate-600">{detectedAddress}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
