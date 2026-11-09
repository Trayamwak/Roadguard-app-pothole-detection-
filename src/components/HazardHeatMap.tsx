import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as d3 from 'd3';
import {
  Flame,
  Radio,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Eye,
  EyeOff,
  Crosshair,
  MapPin,
  ChevronRight,
  Sliders,
  AlertTriangle,
  Camera,
  Compass,
  Sparkles,
} from 'lucide-react';
import type { PotholeReport, Severity } from '../App';
import { SEVERITY_STYLES, normalizeSeverity } from '../App';

interface HazardHeatMapProps {
  reports: PotholeReport[];
  onSelectReport: (report: PotholeReport) => void;
  onOpenScan: () => void;
  filterSeverity: string;
  onFilterSeverityChange: (severity: string) => void;
}

type ColorTheme = 'inferno' | 'turbo' | 'radar';

interface ProjectedPoint {
  x: number;
  y: number;
  weight: number;
  report: PotholeReport;
}

interface HotspotCluster {
  id: string;
  name: string;
  count: number;
  maxSeverity: Severity;
  latitude: number;
  longitude: number;
  x: number;
  y: number;
  reports: PotholeReport[];
}

export function HazardHeatMap({
  reports,
  onSelectReport,
  onOpenScan,
  filterSeverity,
  onFilterSeverityChange,
}: HazardHeatMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 500, height: 380 });

  // Map controls
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showPins, setShowPins] = useState(true);
  const [showRadarPulse, setShowRadarPulse] = useState(true);
  const [bandwidth, setBandwidth] = useState<number>(26); // Spread in px
  const [colorTheme, setColorTheme] = useState<ColorTheme>('inferno');
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [hoveredReport, setHoveredReport] = useState<PotholeReport | null>(null);

  // Pan & Zoom
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Responsive dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width } = entry.contentRect;
        const height = Math.max(340, Math.min(480, Math.round(width * 0.72)));
        setDimensions({ width: Math.round(width), height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Filter reports by severity
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (filterSeverity === 'All') return true;
      return normalizeSeverity(r.severity) === normalizeSeverity(filterSeverity);
    });
  }, [reports, filterSeverity]);

  // Compute spatial bounding box and D3 projection scales
  const { xScale, yScale, defaultCenter } = useMemo(() => {
    const { width, height } = dimensions;
    const padding = 42;

    const validReports = filteredReports.filter(
      (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number' && !isNaN(r.latitude) && !isNaN(r.longitude)
    );

    let minLat = 37.765;
    let maxLat = 37.795;
    let minLng = -122.455;
    let maxLng = -122.405;

    if (validReports.length > 0) {
      const lats = validReports.map((r) => r.latitude);
      const lngs = validReports.map((r) => r.longitude);
      const computedMinLat = Math.min(...lats);
      const computedMaxLat = Math.max(...lats);
      const computedMinLng = Math.min(...lngs);
      const computedMaxLng = Math.max(...lngs);

      const latSpan = Math.max(computedMaxLat - computedMinLat, 0.016);
      const lngSpan = Math.max(computedMaxLng - computedMinLng, 0.024);

      const latPad = latSpan * 0.25;
      const lngPad = lngSpan * 0.25;

      minLat = computedMinLat - latPad;
      maxLat = computedMaxLat + latPad;
      minLng = computedMinLng - lngPad;
      maxLng = computedMaxLng + lngPad;
    }

    const baseCenterX = width / 2;
    const baseCenterY = height / 2;

    const baseScaleX = d3.scaleLinear().domain([minLng, maxLng]).range([padding, width - padding]);
    const baseScaleY = d3.scaleLinear().domain([maxLat, minLat]).range([padding, height - padding]);

    // Apply zoom & pan transform
    const transformedScaleX = d3.scaleLinear()
      .domain([minLng, maxLng])
      .range([
        baseCenterX + (padding - baseCenterX) * zoomLevel + panOffset.x,
        baseCenterX + (width - padding - baseCenterX) * zoomLevel + panOffset.x,
      ]);

    const transformedScaleY = d3.scaleLinear()
      .domain([maxLat, minLat])
      .range([
        baseCenterY + (padding - baseCenterY) * zoomLevel + panOffset.y,
        baseCenterY + (height - padding - baseCenterY) * zoomLevel + panOffset.y,
      ]);

    return {
      xScale: transformedScaleX,
      yScale: transformedScaleY,
      defaultCenter: {
        x: baseScaleX((minLng + maxLng) / 2),
        y: baseScaleY((minLat + maxLat) / 2),
      },
    };
  }, [filteredReports, dimensions, zoomLevel, panOffset]);

  // Project points and compute weights for D3 density contours
  const projectedPoints = useMemo<ProjectedPoint[]>(() => {
    return filteredReports.map((report) => {
      const count = report.pothole_count ?? (report.potholes ? report.potholes.length : 1);
      const sev = normalizeSeverity(report.severity);
      const severityMultiplier = sev === 'High' ? 3.5 : sev === 'Medium' ? 2.0 : sev === 'Low' ? 1.0 : 0.5;
      const weight = Math.max(1, count * severityMultiplier);

      const x = xScale(report.longitude);
      const y = yScale(report.latitude);

      return { x, y, weight, report };
    });
  }, [filteredReports, xScale, yScale]);

  // D3 2D Density Contours Generation
  const { contours, maxDensity, geoPathStringGenerator } = useMemo(() => {
    const { width, height } = dimensions;
    if (projectedPoints.length === 0 || !showHeatmap) {
      return { contours: [], maxDensity: 1, geoPathStringGenerator: d3.geoPath() };
    }

    try {
      // Configure d3.contourDensity generator
      const densityGenerator = d3
        .contourDensity<ProjectedPoint>()
        .x((d) => d.x)
        .y((d) => d.y)
        .weight((d) => d.weight)
        .size([width, height])
        .bandwidth(bandwidth * Math.sqrt(zoomLevel))
        .thresholds(20);

      const computedContours = densityGenerator(projectedPoints);
      const maxVal = d3.max(computedContours, (d) => d.value) || 0.001;
      const pathGen = d3.geoPath();

      return {
        contours: computedContours,
        maxDensity: maxVal,
        geoPathStringGenerator: pathGen,
      };
    } catch (e) {
      console.warn('D3 contourDensity generation warning:', e);
      return { contours: [], maxDensity: 1, geoPathStringGenerator: d3.geoPath() };
    }
  }, [projectedPoints, dimensions, bandwidth, zoomLevel, showHeatmap]);

  // Color interpolator for D3 density contours
  const getContourColor = (value: number) => {
    const normalized = Math.min(1, Math.max(0, value / maxDensity));
    if (colorTheme === 'turbo') {
      return d3.interpolateTurbo(0.15 + normalized * 0.85);
    }
    if (colorTheme === 'radar') {
      // Emerald -> Amber -> Red -> Hot Coral
      if (normalized < 0.3) return d3.interpolateYlGn(normalized / 0.3);
      if (normalized < 0.7) return d3.interpolateYlOrRd((normalized - 0.3) / 0.4);
      return '#EF4444';
    }
    // Default: Inferno (ultra vibrant thermal radar)
    return d3.interpolateInferno(0.2 + normalized * 0.8);
  };

  // High-Frequency Pothole Clusters Detection
  const clusters = useMemo<HotspotCluster[]>(() => {
    if (projectedPoints.length === 0) return [];

    const clusterRadiusPx = 55 * zoomLevel;
    const clusterMap: HotspotCluster[] = [];

    projectedPoints.forEach((p) => {
      let matched = clusterMap.find((c) => {
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        return Math.sqrt(dx * dx + dy * dy) <= clusterRadiusPx;
      });

      const count = p.report.pothole_count ?? (p.report.potholes ? p.report.potholes.length : 1);
      const sev = normalizeSeverity(p.report.severity);

      if (matched) {
        matched.count += count;
        matched.reports.push(p.report);
        if (sev === 'High' || (sev === 'Medium' && matched.maxSeverity === 'Low')) {
          matched.maxSeverity = sev;
        }
      } else {
        const id = `cluster-${clusterMap.length + 1}`;
        const name = p.report.address || `Zone ${clusterMap.length + 1}`;
        clusterMap.push({
          id,
          name,
          count,
          maxSeverity: sev,
          latitude: p.report.latitude,
          longitude: p.report.longitude,
          x: p.x,
          y: p.y,
          reports: [p.report],
        });
      }
    });

    // Sort by highest frequency / pothole count
    return clusterMap.sort((a, b) => b.count - a.count);
  }, [projectedPoints, zoomLevel]);

  // Pan interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    setActiveClusterId(null);
  };

  const focusCluster = (c: HotspotCluster) => {
    setActiveClusterId(c.id);
    const { width, height } = dimensions;
    const targetCenterX = width / 2;
    const targetCenterY = height / 2;
    // Animate pan to cluster center
    setPanOffset({
      x: targetCenterX - c.x + panOffset.x,
      y: targetCenterY - c.y + panOffset.y,
    });
  };

  const totalPotholesInView = useMemo(() => {
    return filteredReports.reduce(
      (sum, r) => sum + (r.pothole_count ?? (r.potholes ? r.potholes.length : 1)),
      0
    );
  }, [filteredReports]);

  return (
    <div className="space-y-3.5 select-none">
      {/* Header with Title, Mode & Heat Map Switch */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-100 flex items-center gap-1.5">
              <Flame className="w-5 h-5 text-orange-500 animate-pulse" />
              <span>Hazard Heat Map</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-950/80 text-orange-400 border border-orange-800/60">
              D3 Density
            </span>
          </div>
          <p className="text-[11px] text-stone-400">
            {totalPotholesInView} potholes mapped • {clusters.length} high-frequency zones
          </p>
        </div>

        {/* Heatmap & Radar Toggle Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            title="Toggle D3 Heatmap Layer"
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition ${
              showHeatmap
                ? 'bg-orange-600/20 text-orange-400 border-orange-600/50'
                : 'bg-[#1C1413] text-stone-500 border-[#382320]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Heat {showHeatmap ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowRadarPulse(!showRadarPulse)}
            title="Toggle Radar Sweep Effect"
            className={`px-2 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1 transition ${
              showRadarPulse
                ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/50'
                : 'bg-[#1C1413] text-stone-500 border-[#382320]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter and Heatmap Settings Toolbar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 text-xs">
        {/* Severity filter pills */}
        <div className="flex gap-1 shrink-0">
          {['All', 'High', 'Medium', 'Low'].map((item) => (
            <button
              key={item}
              onClick={() => onFilterSeverityChange(item)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition shrink-0 ${
                filterSeverity === item
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-[#221715] text-stone-400 hover:text-stone-200 border border-[#3A2420]'
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        {/* Secondary layer switches */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setShowPins(!showPins)}
            className={`px-2 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 transition ${
              showPins
                ? 'bg-[#291816] text-stone-200 border-[#4A2824]'
                : 'bg-[#181110] text-stone-500 border-[#2D1B19]'
            }`}
          >
            {showPins ? <Eye className="w-3 h-3 text-orange-400" /> : <EyeOff className="w-3 h-3" />}
            <span>Pins</span>
          </button>

          {/* Bandwidth / Spread Selector */}
          <div className="flex items-center bg-[#1E1413] border border-[#3A2320] rounded-lg p-0.5">
            {[
              { label: 'Tight', val: 18 },
              { label: 'Normal', val: 26 },
              { label: 'Wide', val: 38 },
            ].map((b) => (
              <button
                key={b.val}
                onClick={() => setBandwidth(b.val)}
                className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                  bandwidth === b.val ? 'bg-orange-600 text-white' : 'text-stone-400 hover:text-stone-200'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>

          {/* Color Scheme Picker */}
          <button
            onClick={() => {
              const next: ColorTheme =
                colorTheme === 'inferno' ? 'turbo' : colorTheme === 'turbo' ? 'radar' : 'inferno';
              setColorTheme(next);
            }}
            title="Toggle Color Theme"
            className="px-2 py-1 rounded-lg bg-[#1E1413] border border-[#3A2320] text-stone-300 text-[10px] font-semibold uppercase hover:border-orange-500/50 transition"
          >
            {colorTheme}
          </button>
        </div>
      </div>

      {/* Main Interactive Map Canvas & D3 SVG Container */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ height: dimensions.height }}
        className={`relative w-full rounded-3xl overflow-hidden border border-[#3D2522] bg-[#0E0908] shadow-2xl transition cursor-${
          isDragging ? 'grabbing' : 'grab'
        }`}
      >
        {/* Background Radar Grid & Coordinates */}
        <div className="absolute inset-0 opacity-25 bg-[linear-gradient(to_right,#FF5500_1px,transparent_1px),linear-gradient(to_bottom,#FF5500_1px,transparent_1px)] bg-[size:36px_36px]" />

        {/* Concentric Range Rings centered on Map Center */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
          <circle cx={defaultCenter.x} cy={defaultCenter.y} r="60" fill="none" stroke="#FFAA00" strokeDasharray="3 3" />
          <circle cx={defaultCenter.x} cy={defaultCenter.y} r="120" fill="none" stroke="#FF7700" strokeDasharray="4 4" />
          <circle cx={defaultCenter.x} cy={defaultCenter.y} r="180" fill="none" stroke="#FF4400" strokeDasharray="4 4" />
          <text x={defaultCenter.x + 65} y={defaultCenter.y - 5} fill="#FFAA00" fontSize="9" fontFamily="monospace">
            250m
          </text>
          <text x={defaultCenter.x + 125} y={defaultCenter.y - 5} fill="#FF7700" fontSize="9" fontFamily="monospace">
            500m
          </text>
          <text x={defaultCenter.x + 185} y={defaultCenter.y - 5} fill="#FF4400" fontSize="9" fontFamily="monospace">
            1.0km
          </text>
        </svg>

        {/* Animated Radar Sweep */}
        {showRadarPulse && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            <div className="w-80 h-80 rounded-full border border-orange-500/25 animate-ping opacity-30" />
            <div className="w-64 h-64 rounded-full border border-orange-500/35 animate-pulse" />
            {/* Sweep beam */}
            <div
              className="absolute w-72 h-72 rounded-full border-t-2 border-r-2 border-orange-400/40 animate-spin"
              style={{ animationDuration: '4.5s' }}
            />
          </div>
        )}

        {/* =========================================================================
            D3 HEATMAP LAYER (Continuous Multi-Level Density Isobars + Thermal Glow)
            ========================================================================= */}
        {showHeatmap && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              {/* Radial Gaussian glow gradients for cluster centroids */}
              {clusters.map((c) => (
                <radialGradient key={`grad-${c.id}`} id={`glow-${c.id}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FF3B00" stopOpacity={0.65} />
                  <stop offset="40%" stopColor="#FF8800" stopOpacity={0.35} />
                  <stop offset="75%" stopColor="#FFCC00" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#FFCC00" stopOpacity={0} />
                </radialGradient>
              ))}

              <filter id="heat-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Ambient cluster glows beneath contours */}
            {clusters.map((c) => {
              const radius = Math.min(100, Math.max(35, c.count * 16 * Math.sqrt(zoomLevel)));
              return (
                <circle
                  key={`circle-${c.id}`}
                  cx={c.x}
                  cy={c.y}
                  r={radius}
                  fill={`url(#glow-${c.id})`}
                  style={{ mixBlendMode: 'screen' }}
                />
              );
            })}

            {/* D3 Multi-Polygon Contour Density Paths */}
            <g filter="url(#heat-blur)">
              {contours.map((contour, i) => {
                const pathStr = geoPathStringGenerator(contour) || '';
                const fillCol = getContourColor(contour.value);
                const alpha = Math.min(0.78, 0.18 + (i / contours.length) * 0.6);

                return (
                  <path
                    key={`contour-${i}`}
                    d={pathStr}
                    fill={fillCol}
                    fillOpacity={alpha}
                    stroke={fillCol}
                    strokeWidth={0.8}
                    strokeOpacity={alpha + 0.15}
                  />
                );
              })}
            </g>
          </svg>
        )}

        {/* Current User Device GPS Location Indicator */}
        <div
          style={{
            left: `${defaultCenter.x}px`,
            top: `${defaultCenter.y}px`,
            transform: 'translate(-50%, -50%)',
          }}
          className="absolute z-20 pointer-events-none"
        >
          <div className="relative flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 animate-ping absolute" />
            <div className="w-5 h-5 rounded-full bg-blue-600 border-2 border-white flex items-center justify-center shadow-lg shadow-blue-900">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </div>
            <span className="absolute top-6 px-1.5 py-0.5 rounded text-[8px] font-bold bg-blue-950/90 text-blue-300 border border-blue-800/80 whitespace-nowrap">
              My Location
            </span>
          </div>
        </div>

        {/* =========================================================================
            PIN MARKERS LAYER & INTERACTIVE CLUSTERS
            ========================================================================= */}
        {showPins &&
          projectedPoints.map(({ x, y, report }) => {
            const sev = normalizeSeverity(report.severity);
            const style = SEVERITY_STYLES[sev];
            const isHovered = hoveredReport?.id === report.id;
            const count = report.pothole_count ?? (report.potholes ? report.potholes.length : 1);

            return (
              <div
                key={report.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectReport(report);
                }}
                onMouseEnter={() => setHoveredReport(report)}
                onMouseLeave={() => setHoveredReport(null)}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-20 cursor-pointer group"
              >
                <div
                  className={`relative flex items-center justify-center transition ${
                    isHovered ? 'scale-125 z-40' : 'hover:scale-115'
                  }`}
                >
                  {/* Outer pulse dot */}
                  <div className={`w-6 h-6 rounded-full ${style.dot} opacity-30 animate-ping absolute`} />

                  {/* Core pin */}
                  <div
                    className={`w-6 h-6 rounded-full border-2 ${style.bg} ${style.border} flex items-center justify-center shadow-lg shadow-black/80`}
                  >
                    <span className="text-[9px] font-black text-white">
                      {count}
                    </span>
                  </div>
                </div>

                {/* Pin Tooltip Card on Hover */}
                {isHovered && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectReport(report);
                    }}
                    className="absolute bottom-8 -left-20 w-48 p-2.5 bg-[#1C1312] border border-[#482A26] rounded-2xl shadow-2xl text-stone-200 z-50 pointer-events-auto animate-fadeIn"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <img
                        src={report.image_uri}
                        alt="Pothole"
                        className="w-10 h-10 rounded-lg object-cover border border-[#442824] shrink-0"
                      />
                      <div className="min-w-0">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border inline-block ${style.bg} ${style.text} ${style.border}`}
                        >
                          {report.severity} Severity
                        </span>
                        <p className="text-[10px] font-bold text-stone-100 truncate mt-0.5">
                          {count} Pothole{count === 1 ? '' : 's'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-300 font-medium truncate">{report.address}</p>
                    <p className="text-[9px] text-stone-500 font-mono mt-0.5">
                      {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                    </p>
                    <div className="mt-2 pt-1.5 border-t border-[#311E1C] flex items-center justify-between text-[9px] text-orange-400 font-semibold">
                      <span>Click to view scan</span>
                      <ChevronRight className="w-3 h-3" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

        {/* Map Control Buttons (Zoom +, Zoom -, Reset, Crosshair) */}
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 z-30">
          <button
            onClick={() => setZoomLevel((z) => Math.min(3, Number((z + 0.35).toFixed(2))))}
            title="Zoom In"
            className="w-7 h-7 rounded-lg bg-[#1F1413]/90 hover:bg-[#2F1E1B] border border-[#3E2421] text-stone-300 flex items-center justify-center transition shadow-md"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel((z) => Math.max(0.8, Number((z - 0.35).toFixed(2))))}
            title="Zoom Out"
            className="w-7 h-7 rounded-lg bg-[#1F1413]/90 hover:bg-[#2F1E1B] border border-[#3E2421] text-stone-300 flex items-center justify-center transition shadow-md"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            title="Reset View"
            className="w-7 h-7 rounded-lg bg-[#1F1413]/90 hover:bg-[#2F1E1B] border border-[#3E2421] text-stone-300 flex items-center justify-center transition shadow-md"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Floating Thermal Scale Legend */}
        <div className="absolute bottom-2.5 left-3 right-3 p-2 rounded-2xl bg-[#140D0C]/90 backdrop-blur-md border border-[#38221F] flex items-center justify-between text-[10px] text-stone-400 z-20 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="font-bold text-stone-300 text-[10px] flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              <span>D3 Heat Density:</span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-stone-500">Low</span>
              <div
                className="w-20 h-2 rounded-full border border-stone-800"
                style={{
                  background:
                    colorTheme === 'turbo'
                      ? 'linear-gradient(to right, #30123B, #1AE4B6, #FEF832, #D82604)'
                      : colorTheme === 'radar'
                        ? 'linear-gradient(to right, #052E16, #EAB308, #EA580C, #DC2626)'
                        : 'linear-gradient(to right, #000004, #721F81, #F1605D, #FEF0A0)',
                }}
              />
              <span className="text-[9px] text-red-400 font-bold">Peak</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-stone-500">Zoom: {zoomLevel.toFixed(1)}x</span>
            <span className="text-orange-400 font-semibold">{projectedPoints.length} Pins</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          HIGH-FREQUENCY POTHOLE HOTSPOT ZONES (Ranked Cluster Analysis)
          ========================================================================= */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
            <Crosshair className="w-3.5 h-3.5 text-orange-400" />
            <span>High-Frequency Hazard Zones</span>
          </span>
          <span className="text-[11px] text-stone-500 font-mono">
            {clusters.length} Cluster{clusters.length === 1 ? '' : 's'} Detected
          </span>
        </div>

        {clusters.length === 0 ? (
          <div className="p-4 rounded-2xl bg-[#170F0E] border border-[#2F1D1A] text-center text-xs text-stone-500">
            No pothole reports found for this filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {clusters.slice(0, 4).map((c, idx) => {
              const style = SEVERITY_STYLES[c.maxSeverity];
              const isSelected = activeClusterId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => focusCluster(c)}
                  className={`p-2.5 rounded-2xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#2A1815] border-orange-500 shadow-md'
                      : 'bg-[#191110] hover:bg-[#231715] border-[#34201D]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-orange-400 flex items-center gap-1">
                      <span>#{idx + 1}</span>
                      <span>Cluster Zone</span>
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${style.bg} ${style.text} ${style.border}`}
                    >
                      {c.maxSeverity}
                    </span>
                  </div>

                  <p className="text-xs font-bold text-stone-200 truncate">{c.name}</p>

                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#291A18] text-[10px]">
                    <span className="text-stone-400 font-medium">
                      <strong className="text-orange-400">{c.count}</strong> potholes
                    </span>
                    <span className="text-[9px] text-stone-500 hover:text-orange-400 flex items-center">
                      <span>Center</span>
                      <ChevronRight className="w-3 h-3 ml-0.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Primary Action Button: Scan and Pin here */}
      <button
        onClick={onOpenScan}
        className="w-full py-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-semibold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40 transition"
      >
        <Camera className="w-4 h-4" />
        <span>Scan & Pin New Pothole Location</span>
      </button>
    </div>
  );
}
