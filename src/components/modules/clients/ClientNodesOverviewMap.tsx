"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import "leaflet/dist/leaflet.css";
import { NodeLocation } from "@/types";
import {
  MapPin,
  Layers,
  ExternalLink,
  Edit2,
  Radio,
  Building2,
  AlertCircle,
} from "lucide-react";

interface ClientNodesOverviewMapProps {
  nodes: NodeLocation[];
  onEditNode?: (node: NodeLocation) => void;
}

export default function ClientNodesOverviewMap({
  nodes,
  onEditNode,
}: ClientNodesOverviewMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [selectedNode, setSelectedNode] = useState<NodeLocation | null>(null);

  // Filtrar solo los nodos que tienen coordenadas válidas
  const nodesWithCoords = nodes.filter(
    (n) =>
      n.coordinates &&
      typeof n.coordinates.lat === "number" &&
      typeof n.coordinates.lng === "number" &&
      !isNaN(n.coordinates.lat) &&
      !isNaN(n.coordinates.lng)
  );

  const nodesWithoutCoords = nodes.filter(
    (n) => !n.coordinates || isNaN(n.coordinates.lat) || isNaN(n.coordinates.lng)
  );

  // Crear icono SVG para el nodo según su estado
  const createNodeIcon = useCallback((L: any, node: NodeLocation) => {
    const st = (node.status || "activo").toLowerCase();
    let bgGradient = "linear-gradient(135deg, #10b981 0%, #047857 100%)"; // activo
    let shadowColor = "rgba(16, 185, 129, 0.45)";

    if (st === "suspendido") {
      bgGradient = "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)";
      shadowColor = "rgba(245, 158, 11, 0.45)";
    } else if (st === "retirado") {
      bgGradient = "linear-gradient(135deg, #f43f5e 0%, #be123c 100%)";
      shadowColor = "rgba(244, 63, 94, 0.45)";
    } else if (st === "online" || st === "reportado") {
      bgGradient = "linear-gradient(135deg, #004ac6 0%, #002d7a 100%)";
      shadowColor = "rgba(0, 74, 198, 0.45)";
    }

    return L.divIcon({
      className: "custom-node-overview-pin",
      html: `
        <div style="position: relative; transform: translate(-50%, -100%); cursor: pointer;">
          <div style="
            background: ${bgGradient};
            width: 36px;
            height: 36px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px ${shadowColor};
            border: 2.5px solid #ffffff;
          ">
            <svg style="transform: rotate(45deg); width: 17px; height: 17px; color: #ffffff;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/>
              <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
              <circle cx="12" cy="12" r="2" fill="#ffffff"/>
              <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
              <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>
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
      iconSize: [36, 36],
      iconAnchor: [18, 36],
    });
  }, []);

  // Inicializar Leaflet y cargar marcadores
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return;

    let isMounted = true;

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Centro por defecto: Ecuador
      const map = L.map(mapContainerRef.current, {
        center: [-1.831239, -78.183406],
        zoom: 7,
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
      mapInstanceRef.current = map;

      // Limpiar marcadores previos
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Añadir marcadores
      const bounds = L.latLngBounds([]);

      nodesWithCoords.forEach((node) => {
        if (!node.coordinates) return;
        const icon = createNodeIcon(L, node);
        const marker = L.marker([node.coordinates.lat, node.coordinates.lng], { icon }).addTo(map);

        marker.on("click", () => {
          setSelectedNode(node);
          map.panTo([node.coordinates!.lat, node.coordinates!.lng]);
        });

        bounds.extend([node.coordinates.lat, node.coordinates.lng]);
        markersRef.current.push(marker);
      });

      // Ajustar vista a todos los marcadores si hay alguno
      if (nodesWithCoords.length > 0) {
        if (nodesWithCoords.length === 1) {
          const first = nodesWithCoords[0].coordinates!;
          map.setView([first.lat, first.lng], 15);
        } else {
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        }
      }

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
  }, [nodesWithCoords.length]);

  // Cambiar capa (Calles vs Satélite)
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

  return (
    <div className="space-y-3">
      {/* Barra de control del mapa */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-[6px] border border-slate-200">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-800">
            {nodesWithCoords.length} {nodesWithCoords.length === 1 ? "Sede Georreferenciada" : "Sedes Georreferenciadas"}
          </span>
          {nodesWithoutCoords.length > 0 && (
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-[4px] font-semibold flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-amber-600" />
              {nodesWithoutCoords.length} sin coordenadas GPS
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Selector de capa */}
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
        </div>
      </div>

      {/* Mapa */}
      <div className="relative rounded-[6px] border border-slate-200 overflow-hidden bg-slate-100 shadow-2xs">
        <div ref={mapContainerRef} className="w-full h-[400px] z-10" />

        {/* Ficha flotante de la sede seleccionada */}
        {selectedNode && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-md z-20 bg-white/95 backdrop-blur-md rounded-[6px] border border-slate-200 p-3.5 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150 space-y-2.5">
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-[4px] bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center font-bold">
                  <Radio className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-bold text-slate-900 text-xs leading-tight">
                    {selectedNode.name}
                  </h5>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {selectedNode.province} / {selectedNode.canton || "Sin cantón"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold cursor-pointer p-0.5"
                title="Cerrar ficha"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1 text-[11px] text-slate-600">
              {(selectedNode.detailedAddress || selectedNode.address) && (
                <p className="flex items-start gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>{selectedNode.detailedAddress || selectedNode.address}</span>
                </p>
              )}
              {selectedNode.totalCapacityMbps > 0 && (
                <p className="font-semibold text-slate-700">
                  Capacidad: <span className="text-[#004ac6] font-bold">{selectedNode.totalCapacityMbps} Mbps</span>
                </p>
              )}
            </div>

            {/* Botones de acción de la ficha */}
            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
              {selectedNode.coordinates && (
                <a
                  href={`https://www.google.com/maps?q=${selectedNode.coordinates.lat},${selectedNode.coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] border border-slate-200 bg-white hover:bg-slate-50 text-[#004ac6] text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Google Maps</span>
                </a>
              )}
              {onEditNode && (
                <button
                  type="button"
                  onClick={() => onEditNode(selectedNode)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[4px] bg-[#004ac6] hover:bg-[#003da6] text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Editar Sede</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
