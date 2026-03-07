"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface ExperimentRecord {
    id: number;
    timestamp: string;
    sun: ConditionLevel;
    water: ConditionLevel;
    fertilizer: ConditionLevel;
    events: RandomEvent[];
    results: Record<string, { thriving: number; total: number }>;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ConditionLevel = 0 | 1 | 2;

interface PlantConfig {
    id: string;
    label: string;
    file: string;
    idealSun: ConditionLevel;
    idealWater: ConditionLevel;
    idealFertilizer: ConditionLevel;
    tolerance: number;
    eventSensitivity: {
        storm: number;
        sunflare: number;
        pests: number;
        drought: number;
    };
}

interface PlantOutcome {
    thriving: boolean;
    opacity: number;
    scale: number;
    x: number;
    y: number;
    rotation: number;
    zIndex: number;
    isDead?: boolean;
    flip?: boolean;
    // base roll stored so we can re-evaluate when events hit
    baseRoll: number;
    // ms stagger before grow animation fires — derived from baseRoll at creation time
    growDelay: number;
    // flips to true one rAF after creation, triggering the CSS scale/opacity transition
    planted: boolean;
}

type RandomEvent = "storm" | "sunflare" | "pests" | "drought" | null;

const PLANTS: PlantConfig[] = [
    {
        id: "portulacaria", label: "Portulacaria", file: "portulacaria.png",
        idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.85,
        eventSensitivity: { storm: -0.10, sunflare: +0.15, pests: -0.10, drought: +0.15 }
    },
    {
        id: "pothos", label: "Pothos", file: "pothos.png",
        idealSun: 1, idealWater: 1, idealFertilizer: 0, tolerance: 0.80,
        eventSensitivity: { storm: -0.05, sunflare: -0.10, pests: -0.20, drought: -0.10 }
    },
    {
        id: "pansy", label: "Pansy", file: "pansy.png",
        idealSun: 1, idealWater: 2, idealFertilizer: 1, tolerance: 0.45,
        eventSensitivity: { storm: -0.25, sunflare: -0.20, pests: -0.25, drought: -0.30 }
    },
    {
        id: "zinnia", label: "Zinnia", file: "zinnia.png",
        idealSun: 2, idealWater: 1, idealFertilizer: 0, tolerance: 0.65,
        eventSensitivity: { storm: -0.10, sunflare: +0.10, pests: -0.15, drought: +0.05 }
    },
    {
        id: "sunflower", label: "Sunflower", file: "sunflower.png",
        idealSun: 2, idealWater: 1, idealFertilizer: 2, tolerance: 0.60,
        eventSensitivity: { storm: -0.15, sunflare: +0.20, pests: -0.15, drought: -0.10 }
    },
    {
        id: "domino", label: "Domino Cactus", file: "domino.png",
        idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.80,
        eventSensitivity: { storm: -0.05, sunflare: +0.15, pests: -0.05, drought: +0.20 }
    },
    {
        id: "orchid", label: "Orchid", file: "orchid.png",
        idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.25,
        eventSensitivity: { storm: -0.30, sunflare: -0.25, pests: -0.30, drought: -0.25 }
    },
    {
        id: "gardenia", label: "Gardenia", file: "gardenia.png",
        idealSun: 2, idealWater: 2, idealFertilizer: 2, tolerance: 0.30,
        eventSensitivity: { storm: -0.20, sunflare: -0.15, pests: -0.30, drought: -0.25 }
    },
    {
        id: "mint", label: "Mint", file: "mint.png",
        idealSun: 1, idealWater: 2, idealFertilizer: 1, tolerance: 0.85,
        eventSensitivity: { storm: -0.05, sunflare: -0.05, pests: -0.10, drought: -0.20 }
    },
    {
        id: "venus", label: "Venus Flytrap", file: "venus.png",
        idealSun: 2, idealWater: 2, idealFertilizer: 0, tolerance: 0.30,
        eventSensitivity: { storm: -0.15, sunflare: +0.10, pests: +0.10, drought: -0.30 }
    },
    {
        id: "monstera", label: "Monstera", file: "monstera.png",
        idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.75,
        eventSensitivity: { storm: -0.05, sunflare: -0.20, pests: -0.25, drought: -0.15 }
    },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Base probability from conditions only — used for the "Expected" bar */
function calcBaseProb(
    plant: PlantConfig,
    sun: ConditionLevel,
    water: ConditionLevel,
    fertilizer: ConditionLevel,
): number {
    const totalDev = Math.abs(sun - plant.idealSun)
        + Math.abs(water - plant.idealWater)
        + Math.abs(fertilizer - plant.idealFertilizer);
    const base = 1 - (totalDev / 6) * (1 - plant.tolerance);
    return Math.max(0, Math.min(0.98, base));
}

/** Full probability including cumulative random events */
function calcSuccessProb(
    plant: PlantConfig,
    sun: ConditionLevel,
    water: ConditionLevel,
    fertilizer: ConditionLevel,
    events: RandomEvent[]
): number {
    const base = calcBaseProb(plant, sun, water, fertilizer);

    const eventBonus = events.reduce((sum, e) => {
        if (!e) return sum;
        const raw = plant.eventSensitivity[e];
        const scaled = raw < 0
            ? raw * (1 + (1 - plant.tolerance))
            : raw;
        return sum + scaled;
    }, 0);

    return Math.max(0, Math.min(0.98, base + eventBonus));
}

function seededRandom(seed: number) {
    let s = seed;
    return () => {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        return ((s >>> 0) / 0xffffffff);
    };
}

function generatePlantPositions(count: number, seed: number): { x: number; y: number; rotation: number; zIndex: number }[] {
    const rng = seededRandom(seed);
    const positions: { x: number; y: number; rotation: number; zIndex: number }[] = [];
    for (let i = 0; i < count; i++) {
        positions.push({
            x: 4 + rng() * 88,
            y: 4 + rng() * 84,
            rotation: (rng() - 0.5) * 20,
            zIndex: Math.floor(rng() * 60),
        });
    }
    return positions;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConditionControl({
    icon, label, value, onChange, locked = false,
}: {
    icon: string; label: string; value: ConditionLevel;
    onChange: (v: ConditionLevel) => void;
    locked?: boolean;
}) {
    const labels = ["Low", "Med", "High"];
    return (
        <div className={`flex items-center gap-2 mb-3 ${locked ? "opacity-60" : ""}`}>
            <img
                src={`/${icon}`}
                alt={label}
                className="w-7 h-7 object-contain flex-shrink-0"
                style={{ filter: "drop-shadow(0 0 4px #a8ff78)" }}
            />
            <div className="flex flex-col flex-1">
                <span className="text-xs font-semibold tracking-widest uppercase text-[#a8ff78] mb-1">{label}</span>
                <div className="flex gap-1">
                    {[0, 1, 2].map((v) => (
                        <button
                            key={v}
                            onClick={() => !locked && onChange(v as ConditionLevel)}
                            disabled={locked}
                            className="flex-1 py-1 rounded text-xs font-bold transition-all duration-200 cursor-pointer"
                            style={{
                                cursor: locked ? "not-allowed" : "pointer",
                                background: value === v ? "#a8ff78" : "rgba(168,255,120,0.1)",
                                color: value === v ? "#0a1a00" : "#a8ff78",
                                border: value === v ? "1.5px solid #a8ff78" : "1.5px solid rgba(168,255,120,0.3)",
                                boxShadow: value === v ? "0 0 8px #a8ff7888" : "none",
                            }}
                        >
                            {labels[v]}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function SeedSelector({
    plant, count, onChange, sun, water, fertilizer, locked = false
}: {
    plant: PlantConfig;
    count: number;
    onChange: (v: number) => void;
    sun: ConditionLevel;
    water: ConditionLevel;
    fertilizer: ConditionLevel;
    locked?: boolean;
}) {
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltipTop, setTooltipTop] = useState(0);
    const [hovered, setHovered] = useState(false);

    const incrementRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countRef = useRef(count);
    useEffect(() => { countRef.current = count; }, [count]);

    const startPress = (fn: () => void) => {
        fn();
        incrementRef.current = setInterval(fn, 150);
    };

    const stopPress = () => {
        if (incrementRef.current) {
            clearInterval(incrementRef.current);
            incrementRef.current = null;
        }
    };

    const updateTooltipPosition = () => {
        if (!imageRef.current || !containerRef.current) return;
        const imageRect = imageRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const centerY = imageRect.top - containerRect.top + imageRect.height / 2;
        setTooltipTop(centerY);
    };

    return (
        <div
            className="flex items-center gap-2 p-2 rounded-lg mb-2"
            style={{
                background: "rgba(168,255,120,0.04)",
                border: "1px solid rgba(168,255,120,0.15)",
            }}
        >
            <div
                ref={containerRef}
                className="relative w-10 h-10 flex-shrink-0 overflow-visible"
                onMouseEnter={() => { updateTooltipPosition(); setHovered(true); }}
                onMouseLeave={() => setHovered(false)}
            >
                <img ref={imageRef} src={`/${plant.file}`} alt={plant.label} className="w-10 h-10 object-contain" />
                {hovered && (
                    <PlantTooltip
                        plant={plant}
                        top={tooltipTop}
                        sun={sun}
                        water={water}
                        fertilizer={fertilizer}
                    />
                )}
                {count > 0 && (
                    <div
                        className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                        style={{ background: "#a8ff78", color: "#0a1a00", fontSize: "10px" }}
                    >
                        {count}
                    </div>
                )}
            </div>

            <span className="flex-1 text-xs text-[#a8ff78] font-semibold">{plant.label}</span>

            <div className="flex items-center gap-1">
                <button
                    onMouseDown={() => !locked && startPress(() => onChange(Math.max(0, countRef.current - 1)))}
                    onTouchStart={() => !locked && startPress(() => onChange(Math.max(0, countRef.current - 1)))}
                    onMouseUp={stopPress}
                    onMouseLeave={stopPress}
                    onTouchEnd={stopPress}
                    disabled={locked}
                    className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                    style={{
                        background: count === 0 && !locked ? "rgba(168,255,120,0.05)" : "rgba(168,255,120,0.15)",
                        color: count === 0 || locked ? "rgba(168,255,120,0.3)" : "#a8ff78",
                        cursor: locked || count === 0 ? "not-allowed" : "pointer",
                        border: "1px solid rgba(168,255,120,0.3)",
                    }}
                >-</button>
                <span className="w-5 text-center text-xs " style={{ color: locked ? "rgba(168,255,120,0.3)" : "#a8ff78" }}>{count}</span>
                <button
                    onMouseDown={() => (!locked && countRef.current < 50) && startPress(() => onChange(Math.min(50, countRef.current + 1)))}
                    onTouchStart={() => (!locked && countRef.current < 50) && startPress(() => onChange(Math.min(50, countRef.current + 1)))}
                    onMouseUp={stopPress}
                    onMouseLeave={stopPress}
                    onTouchEnd={stopPress}
                    disabled={locked || count >= 50}
                    className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                    style={{
                        background: count >= 50 && !locked ? "rgba(168,255,120,0.05)" : "rgba(168,255,120,0.15)",
                        color: count >= 50 || locked ? "rgba(168,255,120,0.3)" : "#a8ff78",
                        cursor: count >= 50 || locked ? "not-allowed" : "pointer",
                        border: "1px solid rgba(168,255,120,0.3)",
                    }}
                >+</button>
            </div>
        </div>
    );
}

function levelLabel(level: ConditionLevel) {
    return ["Low", "Medium", "High"][level];
}

function InfoTooltip({ text }: { text: string }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative inline-block">
            <button
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onTouchStart={() => setVisible(v => !v)}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black cursor-pointer leading-none"
                style={{
                    background: "rgba(168,255,120,0.15)",
                    border: "1px solid rgba(168,255,120,0.4)",
                    color: "#a8ff78",
                }}
            >
                ?
            </button>

            {visible && (
                <div
                    className="absolute z-50 right-0 text-left"
                    style={{
                        top: "calc(100% + 6px)",
                        width: "235px",
                        background: "rgba(10,20,0,0.97)",
                        border: "1px solid rgba(168,255,120,0.3)",
                        borderRadius: "8px",
                        padding: "10px 12px",
                        fontSize: "10px",
                        lineHeight: "1.6",
                        color: "rgba(168,255,120,0.8)",
                        boxShadow: "0 0 20px rgba(0,0,0,0.6)",
                    }}
                >
                    {text}
                </div>
            )}
        </div>
    );
}

function BetaDistributionGraph({ thriving, total, label, expectedProb }: {
    thriving: number;
    total: number;
    label: string;
    expectedProb?: number;
}) {
    const width = 220;
    const height = 90;
    const points = 100;

    const a = thriving + 1;
    const b = (total - thriving) + 1;

    const logGamma = (z: number): number => {
        const g = 7;
        const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
        if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
        z -= 1;
        let x = c[0];
        for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
        const t = z + g + 0.5;
        return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    };

    const betaPDF = (x: number, a: number, b: number): number => {
        if (x <= 0 || x >= 1) return 0;
        const logB = logGamma(a) + logGamma(b) - logGamma(a + b);
        return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - logB);
    };

    const xs = Array.from({ length: points }, (_, i) => (i + 0.5) / points);
    const ys = xs.map((x) => betaPDF(x, a, b));
    const maxY = Math.max(...ys);
    const cdf = xs.map((_, i) => ys.slice(0, i + 1).reduce((s, v) => s + v, 0) / ys.reduce((s, v) => s + v, 0));
    const lo = xs[cdf.findIndex((c) => c >= 0.05)] ?? 0;
    const hi = xs[cdf.findIndex((c) => c >= 0.95)] ?? 1;
    const mode = xs[ys.indexOf(maxY)];

    const toSVG = (x: number, y: number) => `${(x * width).toFixed(1)},${(height - (y / maxY) * (height - 8)).toFixed(1)}`;
    const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${toSVG(x, ys[i])}`).join(" ");
    const fillPath = `${path} L${width},${height} L0,${height} Z`;
    const ciXs = xs.filter((x) => x >= lo && x <= hi);
    const ciYs = ciXs.map((x) => betaPDF(x, a, b));
    const ciPath = ciXs.length > 1
        ? `M${toSVG(ciXs[0], 0)} ` + ciXs.map((x, i) => `L${toSVG(x, ciYs[i])}`).join(" ") + ` L${toSVG(ciXs[ciXs.length - 1], 0)} Z`
        : "";

    // Empty state
    if (total === 0) return (
        <div className="p-2.5 rounded-lg mb-2 flex items-center justify-center"
            style={{ background: "rgba(168,255,120,0.08)", border: "1px solid rgba(168,255,120,0.2)", minHeight: "80px" }}>
            <div className="text-[9px] tracking-widest uppercase text-center" style={{ color: "rgba(168,255,120,0.3)" }}>
                click a plant to see<br />its distribution
            </div>
        </div>
    );

    const expectedX = expectedProb != null ? expectedProb * width : null;

    return (
        <div className="p-2.5 rounded-lg mb-2" style={{ background: "rgba(168,255,120,0.08)", border: "1px solid rgba(168,255,120,0.2)" }}>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-2">
                <div />
                <div className="text-[9px] font-bold tracking-[0.15em] uppercase text-center" style={{ color: "rgba(168,255,120,0.5)" }}>
                    {label}
                </div>
            </div>

            <div className="flex justify-between mb-1.5 text-[9px]" style={{ color: "rgba(168,255,120,0.6)" }}>
                <span>90% CI: <span style={{ color: "#a8ff78" }}>{Math.round(lo * 100)}-{Math.round(hi * 100)}%</span></span>
                <span>peak: <span style={{ color: "#a8ff78" }}>{Math.round(mode * 100)}%</span></span>
                <span>{thriving}/{total} thriving</span>
            </div>

            <svg width="100%" viewBox={`0 0 ${width} ${height + 18}`} style={{ overflow: "visible" }}>
                {ciPath && <path d={ciPath} fill="rgba(168,255,120,0.15)" />}
                <path d={fillPath} fill="rgba(168,255,120,0.05)" />
                <path d={path} fill="none" stroke="#a8ff78" strokeWidth="1.5" />
                <line x1={mode * width} y1={0} x2={mode * width} y2={height} stroke="#a8ff78" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />

                {/* Expected baseline marker */}
                {expectedX != null && (
                    <g>
                        <line
                            x1={expectedX} y1={0}
                            x2={expectedX} y2={height}
                            stroke="#ffcc44"
                            strokeWidth="1.5"
                            strokeDasharray="4,3"
                            opacity="0.85"
                        />
                    </g>
                )}

                <line x1={0} y1={height} x2={width} y2={height} stroke="rgba(168,255,120,0.2)" strokeWidth="1" />
                {[0, 25, 50, 75, 100].map((v) => (
                    <text key={v} x={v / 100 * width} y={height + 10} textAnchor="middle" fill="rgba(168,255,120,0.4)" fontSize="7">{v}%</text>
                ))}
            </svg>

            <div className="flex items-center gap-3 px-1 mb-1">
                <div className="flex items-center gap-1">
                    <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#a8ff78" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
                    <span className="text-[9px]" style={{ color: "rgba(168,255,120,0.6)" }}>observed</span>
                </div>
                <div className="flex items-center gap-1">
                    <svg width="20" height="8"><line x1="0" y1="4" x2="20" y2="4" stroke="#ffcc44" strokeWidth="1.5" strokeDasharray="4,3" /></svg>
                    <span className="text-[9px]" style={{ color: "rgba(255,204,68,0.6)" }}>expected</span>
                </div>
            </div>
        </div>
    );
}

function PlantTooltip({ plant, top, sun, water, fertilizer }: {
    plant: PlantConfig;
    top: number;
    sun: ConditionLevel;
    water: ConditionLevel;
    fertilizer: ConditionLevel;
}) {
    const prob = Math.round(calcBaseProb(plant, sun, water, fertilizer) * 100);
    const idealProb = Math.round(calcBaseProb(plant, plant.idealSun, plant.idealWater, plant.idealFertilizer) * 100);

    const rows = [
        { icon: "sun.png", label: "Sun", ideal: plant.idealSun, current: sun },
        { icon: "water.png", label: "Water", ideal: plant.idealWater, current: water },
        { icon: "fertilizer.png", label: "Fert", ideal: plant.idealFertilizer, current: fertilizer },
    ];

    return (
        <div
            className="absolute z-50 pointer-events-none"
            style={{
                left: 48,
                top,
                transform: "translateY(-50%)",
                background: "rgba(10,20,0,0.97)",
                border: "1px solid rgba(168,255,120,0.4)",
                borderRadius: "10px",
                padding: "10px 12px",
                fontSize: "10px",
                color: "#a8ff78",
                whiteSpace: "nowrap",
                boxShadow: "0 0 20px rgba(168,255,120,0.15)",
                minWidth: "170px",
            }}
        >
            <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: "1px solid rgba(168,255,120,0.2)" }}>
                <img src={`/${plant.file}`} alt={plant.label} className="w-8 h-8 object-contain" />
                <div>
                    <div className="font-black tracking-wide">{plant.label}</div>
                    <div style={{ color: "rgba(168,255,120,0.5)", fontSize: "9px" }}>
                        Tolerance {Math.round(plant.tolerance * 100)}%
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-[10px_1fr_1fr] gap-x-3 mb-1">
                <div />
                <div className="text-[9px] tracking-widest uppercase text-center" style={{ color: "rgba(168,255,120,0.4)" }}>ideal</div>
                <div className="text-[9px] tracking-widest uppercase text-center" style={{ color: "rgba(168,255,120,0.4)" }}>current</div>
            </div>

            {rows.map(({ icon, label, ideal, current }) => (
                <div key={label} className="grid grid-cols-[10px_1fr_1fr] gap-x-3 mb-0.5 items-center">
                    <img src={`/${icon}`} alt={label} className="w-3 h-3 object-contain" />
                    <div className="text-center text-[10px]" style={{ color: "rgba(168,255,120,0.6)" }}>
                        {levelLabel(ideal)}
                    </div>
                    <div className="text-center text-[10px] font-bold" style={{ color: current === ideal ? "#a8ff78" : "#ff7070" }}>
                        {levelLabel(current)}
                    </div>
                </div>
            ))}

            <div className="grid grid-cols-[10px_1fr_1fr] gap-x-3 mt-2 pt-2" style={{ borderTop: "1px solid rgba(168,255,120,0.2)" }}>
                <div />
                <div className="text-center text-xs font-black" style={{ color: "#a8ff78" }}>{idealProb}%</div>
                <div className="text-center text-xs font-black" style={{ color: prob >= 70 ? "#a8ff78" : prob >= 40 ? "#ffcc44" : "#ff7070" }}>{prob}%</div>
            </div>
        </div>
    );
}

function WelcomeModal({ onClose }: { onClose: () => void }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 60);
        return () => clearTimeout(t);
    }, []);

    const handleClose = () => {
        setVisible(false);
        setTimeout(onClose, 350);
    };

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "20px",
                background: "rgba(4, 10, 0, 0.5)",
                backdropFilter: "blur(6px)",
                opacity: visible ? 1 : 0,
                transition: "opacity 0.35s ease",
            }}
        >
            <div
                style={{
                    maxWidth: "500px",
                    width: "100%",
                    background: "linear-gradient(160deg, #0d1f04 0%, #0a1600 100%)",
                    border: "1px solid rgba(168,255,120,0.25)",
                    borderRadius: "20px",
                    padding: "40px 36px 32px",
                    boxShadow: "0 0 80px rgba(168,255,120,0.08), 0 30px 60px rgba(0,0,0,0.6)",
                    transform: visible ? "translateY(0) scale(1)" : "translateY(16px) scale(0.98)",
                    transition: "transform 0.4s cubic-bezier(0.34, 1.36, 0.64, 1), opacity 0.35s ease",
                    opacity: visible ? 1 : 0,
                }}
            >
                <div style={{ marginBottom: "6px", textAlign: "center" }}>
                    <span style={{
                        fontSize: "10px",
                        fontWeight: 800,
                        letterSpacing: "0.25em",
                        textTransform: "uppercase",
                        color: "rgba(168,255,120,0.4)",
                    }}>
                        Garden Lab
                    </span>
                </div>
                <h3 style={{
                    margin: "0 0 30px",
                    fontSize: "clamp(1.2rem, 4vw, 1.7rem)",
                    fontWeight: 900,
                    lineHeight: 1.15,
                    letterSpacing: "-0.01em",
                    background: "linear-gradient(135deg, #a8ff78 30%, #78ffd6 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    textAlign: "center",
                }}>
                    Can you trust your data?
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "25px", marginBottom: "32px" }}>
                    {[
                        { text: "Each plant you put in the ground is one observation. Is it thriving?" },
                        { text: "Coincidence or maybe not? Think of it like surveying one person: useful, but one answer rarely tells the full story. So, plant more seeds and you'll get an idea of how well a species does in a given environment. That's statistical power in action. The graph shows your certainty." },
                        { text: "But... real life isn't a controlled lab. Sometimes unexpected things mess with your results. Toggle randomness to trigger events and watch what happens." },
                    ].map(({ text }, index) => (
                        <div key={index} style={{ display: "flex", gap: "20px", alignItems: "flex-start" }}>
                            <p style={{
                                margin: 0,
                                fontSize: "13.5px",
                                lineHeight: 2,
                                color: "rgba(168,255,120,0.72)",
                                fontWeight: 400,
                                textAlign: "justify",
                            }}>
                                {text}
                            </p>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleClose}
                    style={{
                        width: "100%",
                        padding: "14px 24px",
                        borderRadius: "12px",
                        border: "none",
                        background: "linear-gradient(135deg, #a8ff78, #78ffd6)",
                        color: "#0a1a00",
                        fontSize: "13px",
                        fontWeight: 900,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                        boxShadow: "0 0 30px rgba(168,255,120,0.25)",
                        transition: "all 0.2s ease",
                    }}
                    onMouseEnter={e => {
                        (e.target as HTMLButtonElement).style.boxShadow = "0 0 40px rgba(168,255,120,0.45)";
                        (e.target as HTMLButtonElement).style.transform = "translateY(-1px)";
                    }}
                    onMouseLeave={e => {
                        (e.target as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(168,255,120,0.25)";
                        (e.target as HTMLButtonElement).style.transform = "translateY(0)";
                    }}
                >
                    Ready to grow?
                </button>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GardenSimulator() {

    const [mode, setMode] = useState<"explore" | "experiment">("explore");
    const experimentRunning = mode === "experiment";
    const [exploreRandomnessEnabled, setExploreRandomnessEnabled] = useState(false);
    const randomnessEnabled = experimentRunning ? true : exploreRandomnessEnabled;

    const [sun, setSun] = useState<ConditionLevel>(1);
    const [water, setWater] = useState<ConditionLevel>(1);
    const [fertilizer, setFertilizer] = useState<ConditionLevel>(1);
    const [controlsOpen] = useState(true);

    const [showPlants, setShowPlants] = useState(true);
    const [seedCounts, setSeedCounts] = useState<Record<string, number>>(
        Object.fromEntries(PLANTS.map((p) => [p.id, 0]))
    );
    const [simulated, setSimulated] = useState(false);
    const [positionSeed] = useState(() => Math.floor(Math.random() * 99999));
    const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);

    const [randomEvent, setRandomEvent] = useState<RandomEvent>(null);
    const [eventAnim, setEventAnim] = useState(false);
    const [eventLog, setEventLog] = useState<RandomEvent[]>([]);
    const [outcomes, setOutcomes] = useState<Record<string, PlantOutcome[]>>({});
    const [experimentHistory, setExperimentHistory] = useState<ExperimentRecord[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const startExperiment = () => {
        setMode("experiment");
        if (showPlants && totalSeeds > 0) simulateNew();
    };

    const gardenRef = useRef<HTMLDivElement>(null);

    const handleToggleRandomness = () => {
        if (experimentRunning) return;
        setExploreRandomnessEnabled(v => !v);
        if (randomnessEnabled) {
            setRandomEvent(null);
        }
    };

    const dragRef = useRef<{
        plantId: string;
        index: number;
        startMouseX: number;
        startMouseY: number;
        startX: number;
        startY: number;
    } | null>(null);

    const handlePlantMouseDown = useCallback((
        e: React.MouseEvent, plantId: string, index: number, currentX: number, currentY: number
    ) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { plantId, index, startMouseX: e.clientX, startMouseY: e.clientY, startX: currentX, startY: currentY };
    }, []);

    const handlePlantTouchStart = useCallback((
        e: React.TouchEvent, plantId: string, index: number, currentX: number, currentY: number
    ) => {
        e.stopPropagation();
        const touch = e.touches[0];
        dragRef.current = { plantId, index, startMouseX: touch.clientX, startMouseY: touch.clientY, startX: currentX, startY: currentY };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current || !gardenRef.current) return;
            const rect = gardenRef.current.getBoundingClientRect();
            const { plantId, index, startMouseX, startMouseY, startX, startY } = dragRef.current;
            const dx = ((e.clientX - startMouseX) / rect.width) * 100;
            const dy = ((e.clientY - startMouseY) / rect.height) * 100;
            const newX = Math.max(2, Math.min(98, startX + dx));
            const newY = Math.max(2, Math.min(96, startY + dy));
            setOutcomes((prev) => {
                const plantOutcomes = [...(prev[plantId] || [])];
                if (plantOutcomes[index]) plantOutcomes[index] = { ...plantOutcomes[index], x: newX, y: newY, zIndex: 100 };
                return { ...prev, [plantId]: plantOutcomes };
            });
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!dragRef.current || !gardenRef.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            const rect = gardenRef.current.getBoundingClientRect();
            const { plantId, index, startMouseX, startMouseY, startX, startY } = dragRef.current;
            const dx = ((touch.clientX - startMouseX) / rect.width) * 100;
            const dy = ((touch.clientY - startMouseY) / rect.height) * 100;
            const newX = Math.max(2, Math.min(98, startX + dx));
            const newY = Math.max(2, Math.min(96, startY + dy));
            setOutcomes((prev) => {
                const plantOutcomes = [...(prev[plantId] || [])];
                if (plantOutcomes[index]) plantOutcomes[index] = { ...plantOutcomes[index], x: newX, y: newY, zIndex: 100 };
                return { ...prev, [plantId]: plantOutcomes };
            });
        };

        const handleMouseUp = () => {
            if (!dragRef.current) return;
            const { plantId, index } = dragRef.current;
            setOutcomes((prev) => {
                const plantOutcomes = [...(prev[plantId] || [])];
                if (plantOutcomes[index]) plantOutcomes[index] = { ...plantOutcomes[index], zIndex: Math.floor(Math.random() * 60) };
                return { ...prev, [plantId]: plantOutcomes };
            });
            dragRef.current = null;
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        window.addEventListener("touchmove", handleTouchMove, { passive: false });
        window.addEventListener("touchend", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("touchmove", handleTouchMove);
            window.removeEventListener("touchend", handleMouseUp);
        };
    }, []);

    /** Re-evaluate each existing plant's thriving state against the current event log.
     *  Uses the stored baseRoll so positions are stable; only thriving flips. */
    const reEvaluateOutcomes = useCallback((
        currentOutcomes: Record<string, PlantOutcome[]>,
        currentSun: ConditionLevel,
        currentWater: ConditionLevel,
        currentFertilizer: ConditionLevel,
        currentEvents: RandomEvent[]
    ) => {
        const next: Record<string, PlantOutcome[]> = {};
        PLANTS.forEach((plant) => {
            const existing = currentOutcomes[plant.id] || [];
            const prob = calcSuccessProb(plant, currentSun, currentWater, currentFertilizer, currentEvents);
            next[plant.id] = existing.map((o) => {
                const thriving = o.baseRoll < prob;
                return {
                    ...o,
                    thriving,
                    opacity: thriving ? 0.85 + (1 - o.baseRoll) * 0.13 : 0.22 + o.baseRoll * 0.12,
                    scale: thriving ? 0.7 + (1 - o.baseRoll) * 0.5 : 0.35 + o.baseRoll * 0.25,
                };
            });
        });
        return next;
    }, []);

    const simulate = useCallback(() => {
        setShowPlants(false);
        setOutcomes((prevOutcomes) => {
            const newOutcomes: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach((plant) => {
                const count = seedCounts[plant.id] || 0;
                const prob = calcSuccessProb(plant, sun, water, fertilizer, randomnessEnabled ? eventLog : []);

                const existing = prevOutcomes[plant.id] || [];
                const updated = existing.slice(0, count).map((prev) => {
                    const thriving = prev.baseRoll < prob;
                    return {
                        ...prev,
                        thriving,
                        planted: false,
                        opacity: thriving ? 0.85 + (1 - prev.baseRoll) * 0.13 : 0.22 + prev.baseRoll * 0.12,
                        scale: thriving ? 0.7 + (1 - prev.baseRoll) * 0.5 : 0.35 + prev.baseRoll * 0.25,
                    };
                });
                newOutcomes[plant.id] = updated;
            });
            return newOutcomes;
        });
        setSimulated(true);
    }, [sun, water, fertilizer, eventLog, randomnessEnabled, seedCounts, positionSeed]);

    const simulateNew = useCallback(() => {
        setShowPlants(false);
        setOutcomes((prevOutcomes) => {
            const newOutcomes: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach((plant) => {
                const count = seedCounts[plant.id] || 0;
                const prob = calcSuccessProb(plant, sun, water, fertilizer, randomnessEnabled ? eventLog : []);

                const existing = prevOutcomes[plant.id] || [];
                // Keep existing plants unchanged (already planted: true)
                const updated = existing.slice(0, count).map((prev) => ({ ...prev }));
                if (count > existing.length) {
                    const newPositions = generatePlantPositions(
                        count - existing.length,
                        positionSeed + PLANTS.indexOf(plant) * 1000 + existing.length * 37
                    );
                    newPositions.forEach((pos) => {
                        const baseRoll = Math.random();
                        const thriving = baseRoll < prob;
                        // Stagger each plant's grow animation by its baseRoll:
                        // low rolls (lucky plants) sprout first, high rolls come later.
                        const growDelay = Math.round(baseRoll * 1000000);
                        updated.push({
                            thriving,
                            baseRoll,
                            growDelay,
                            planted: false, // starts invisible; flips true after rAF below
                            isDead: prob <= 0,
                            opacity: thriving ? 0.85 + (1 - baseRoll) * 0.13 : 0.22 + baseRoll * 0.12,
                            scale: thriving ? 0.7 + (1 - baseRoll) * 0.5 : 0.35 + baseRoll * 0.25,
                            flip: Math.random() < 0.5,
                            ...pos,
                        });
                    });
                }
                newOutcomes[plant.id] = updated;
            });
            return newOutcomes;
        });
        setSimulated(true);

        // Two rAF ticks: first ensures React has committed the scale-0 DOM state,
        // second gives the browser a paint cycle so CSS transitions see 0 → target.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setOutcomes((prev) => {
                    const next: Record<string, PlantOutcome[]> = {};
                    PLANTS.forEach((plant) => {
                        next[plant.id] = (prev[plant.id] || []).map((o) =>
                            o.planted ? o : { ...o, planted: true }
                        );
                    });
                    return next;
                });
            });
        });
    }, [seedCounts, sun, water, fertilizer, randomnessEnabled, eventLog, positionSeed]);

    useEffect(() => {
        if (simulated && !experimentRunning) simulate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sun, water, fertilizer, simulated]);

    useEffect(() => {
        if (simulated && !experimentRunning) simulateNew();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seedCounts, simulated]);

    const triggerRandomEvent = () => {
        const events: RandomEvent[] = ["storm", "sunflare", "pests", "drought"];
        const evt = events[Math.floor(Math.random() * events.length)];

        setRandomEvent(evt);
        const newLog = [...eventLog, evt];
        setEventLog(newLog);
        setEventAnim(true);
        setTimeout(() => setEventAnim(false), 2000);

        if (simulated) {
            setOutcomes((prev) => reEvaluateOutcomes(prev, sun, water, fertilizer, newLog));
        }
    };

    const reset = () => {
        if (simulated) {
            const record: ExperimentRecord = {
                id: experimentHistory.length + 1,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                sun, water, fertilizer,
                events: eventLog,
                results: Object.fromEntries(
                    PLANTS.map(p => {
                        const outs = outcomes[p.id] || [];
                        return [p.id, {
                            total: outs.length,
                            thriving: outs.filter(o => o.thriving).length,
                        }];
                    })
                ),
            };
            setExperimentHistory(prev => [...prev, record]);
        }
        setExploreRandomnessEnabled(false);
        setMode("explore");
        setSeedCounts(Object.fromEntries(PLANTS.map((p) => [p.id, 0])));
        setSun(1);
        setWater(1);
        setFertilizer(1);
        setRandomEvent(null);
        setOutcomes({});
        setShowPlants(true);
        setSimulated(false);
        setEventLog([]);
    };

    const stats = PLANTS.map((plant) => {
        const outs = outcomes[plant.id] || [];
        const total = outs.length;
        const thriving = outs.filter((o) => o.thriving).length;
        const expectedProb = calcBaseProb(plant, sun, water, fertilizer);
        const observedProb = calcSuccessProb(plant, sun, water, fertilizer, randomnessEnabled ? eventLog : []);
        return { plant, total, thriving, expectedProb: Math.round(expectedProb * 100), observedProb: Math.round(observedProb * 100) };
    });

    const totalSeeds = Object.values(seedCounts).reduce((a, b) => a + b, 0);

    const eventColors: Record<string, string> = {
        storm: "rgba(80,120,255,0.25)",
        sunflare: "rgba(255,220,60,0.25)",
        pests: "rgba(180,80,20,0.25)",
        drought: "rgba(200,140,0,0.25)",
    };

    const eventLabel: Record<string, string> = {
        storm: "STORM!",
        sunflare: "SUN FLARE!",
        pests: "PEST ATTACK!",
        drought: "DROUGHT!",
    };

    const isDragging = dragRef.current !== null;
    const selectedStats = selectedPlantId ? stats.find(s => s.plant.id === selectedPlantId) : null;
    const [showWelcome, setShowWelcome] = useState(true);

    return (
        <div className="min-h-screen overflow-x-hidden" style={{ color: "#a8ff78" }}>
            {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

            <header
                className="text-center px-4 pt-6 pb-3"
                style={{ borderBottom: "1px solid rgba(168,255,120,0.15)" }}
            >
                <h1
                    className="text-3xl md:text-4xl font-black uppercase tracking-widest m-0"
                    style={{
                        background: "linear-gradient(135deg, #a8ff78, #78ffd6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                    }}
                >
                    Grow Your Garden
                </h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_260px] md:grid-rows-[auto_1fr] gap-3 px-4 py-3 max-w-[1280px] mx-auto"
                style={{ maxHeight: "calc(100vh - 150px)" }}>

                {/* ── Top centre: environmental controls ── */}
                <section
                    className="p-3 md:px-4 rounded-xl md:col-start-2 md:row-start-1"
                    style={{
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                    }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center">
                        <ConditionControl icon="sun.png" label="Sunlight" value={sun} onChange={experimentRunning ? () => { } : setSun} locked={experimentRunning} />
                        <ConditionControl icon="water.png" label="Water" value={water} onChange={experimentRunning ? () => { } : setWater} locked={experimentRunning} />
                        <ConditionControl icon="fertilizer.png" label="Fertilizer" value={fertilizer} onChange={experimentRunning ? () => { } : setFertilizer} locked={experimentRunning} />

                        <div className="flex flex-col gap-1 mx-auto lg:ml-2 w-35">
                            <button
                                onClick={handleToggleRandomness}
                                disabled={experimentRunning}
                                className="py-2 px-3 rounded-lg text-xs font-bold tracking-wide uppercase whitespace-nowrap transition-all"
                                style={{
                                    background: experimentRunning ? "rgba(255,180,0,0.05)" : "rgba(255,180,0,0.15)",
                                    border: `1.5px solid ${experimentRunning ? "rgba(255,180,0,0.2)" : "rgba(255,180,0,0.6)"}`,
                                    color: experimentRunning ? "rgba(255,180,0,0.4)" : "#ffcc44",
                                    cursor: experimentRunning ? "not-allowed" : "pointer",
                                    opacity: experimentRunning ? 0.5 : 1,
                                }}
                            >
                                {randomnessEnabled ? "RANDOMNESS ON" : "RANDOMNESS OFF"}
                            </button>

                            <button
                                onClick={() => { if (randomnessEnabled) triggerRandomEvent(); }}
                                disabled={!randomnessEnabled}
                                className="py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all"
                                style={{
                                    background: randomnessEnabled ? "rgba(255,180,0,0.15)" : "rgba(255,180,0,0.05)",
                                    border: `1.5px solid ${randomnessEnabled ? "rgba(255,180,0,0.6)" : "rgba(255,180,0,0.2)"}`,
                                    color: randomnessEnabled ? "#ffcc44" : "rgba(255,180,0,0.4)",
                                    cursor: !randomnessEnabled ? "not-allowed" : "pointer",
                                    opacity: !randomnessEnabled ? 0.5 : 1,
                                }}
                            >
                                trigger event
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-center">
                        {experimentRunning && (
                            <div className="text-[9px] tracking-widest uppercase flex items-center gap-1 mt-3 sm:mt-0"
                                style={{ color: "#ffcc44" }}>
                                experiment running
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Left: seed selection ── */}
                <aside
                    className="flex flex-col gap-2 p-3 rounded-xl md:col-start-1 md:row-start-1 md:row-span-2"
                    style={{ border: "1px solid rgba(168,255,120,0.15)" }}
                >
                    <div className="flex gap-2">
                        <button
                            onClick={() => { setMode("explore"); reset(); }}
                            className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widest uppercase cursor-pointer transition-all"
                            style={{
                                background: mode === "explore" ? "rgba(168,255,120,0.15)" : "rgba(168,255,120,0.04)",
                                border: `1.5px solid ${mode === "explore" ? "rgba(168,255,120,0.6)" : "rgba(168,255,120,0.15)"}`,
                                color: mode === "explore" ? "#a8ff78" : "rgba(168,255,120,0.4)",
                            }}
                        >
                            {simulated ? "RESET" : "EXPLORE"}
                        </button>
                        <button
                            onClick={() => experimentRunning ? reset() : startExperiment()}
                            disabled={!experimentRunning && totalSeeds === 0}
                            className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widest uppercase cursor-pointer transition-all"
                            style={{
                                background: experimentRunning ? "rgba(255,80,80,0.12)" : "rgba(255,204,68,0.12)",
                                border: `1.5px solid ${experimentRunning ? "rgba(255,80,80,0.4)" : "rgba(255,204,68,0.4)"}`,
                                color: experimentRunning ? "#ff7070" : "#ffcc44",
                                opacity: !experimentRunning && totalSeeds === 0 ? 0.4 : 1,
                                cursor: !experimentRunning && totalSeeds === 0 ? "not-allowed" : "pointer",
                            }}
                        >
                            {experimentRunning ? "END EXPERIMENT" : "NEW EXPERIMENT"}
                        </button>
                    </div>

                    <div className="bg-transparent border-none text-[#a8ff78] text-xs font-bold tracking-[0.2em] uppercase flex justify-center items-center py-0">
                        SELECT SEEDS
                    </div>

                    {controlsOpen && (
                        <div className="overflow-y-auto sidebar-scroll max-h-[200px] md:max-h-none">
                            {PLANTS.map((plant) => (
                                <SeedSelector
                                    key={plant.id}
                                    plant={plant}
                                    count={seedCounts[plant.id]}
                                    onChange={(v) => setSeedCounts((prev) => ({ ...prev, [plant.id]: v }))}
                                    sun={sun}
                                    water={water}
                                    fertilizer={fertilizer}
                                    locked={experimentRunning}
                                />
                            ))}
                        </div>
                    )}
                </aside>

                {/* ── Centre: garden plot ── */}
                <div className="relative md:col-start-2 md:row-start-2">
                    <div
                        ref={gardenRef}
                        className="w-full relative rounded-xl overflow-hidden"
                        style={{
                            paddingBottom: "70%",
                            background: "linear-gradient(160deg, #3d1f00 0%, #5a2d00 40%, #3a1800 100%)",
                            border: "2px solid rgba(120,80,20,0.6)",
                            boxShadow: "0 0 40px rgba(80,40,0,0.5), inset 0 0 60px rgba(0,0,0,0.4)",
                            cursor: isDragging ? "grabbing" : "default",
                        }}
                    >
                        {/* Soil texture */}
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage:
                                    "radial-gradient(ellipse at 30% 60%, rgba(90,50,10,0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(60,30,5,0.4) 0%, transparent 50%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
                            }}
                        />

                        {/* Random event overlay */}
                        {eventAnim && randomEvent && (
                            <div
                                className="absolute inset-0 z-[90] rounded-xl pointer-events-none flex flex-col items-center justify-center"
                                style={{
                                    background: eventColors[randomEvent],
                                    animation: "eventFlash 3s ease-out forwards",
                                    color: "rgba(255,200,0,0.6)",
                                }}
                            >
                                <img
                                    src={
                                        randomEvent === "storm" ? "/storm.png" :
                                            randomEvent === "sunflare" ? "/sun.png" :
                                                randomEvent === "drought" ? "/drought.png" :
                                                    "/pest.png"
                                    }
                                    alt={randomEvent}
                                    className="object-contain"
                                    style={{
                                        width: "clamp(70px, 10vw, 140px)",
                                        height: "clamp(70px, 10vw, 140px)",
                                        filter: "drop-shadow(0 0 25px rgba(255,255,255,0.8))",
                                        animation: "pulse 0.8s ease-in-out infinite alternate",
                                    }}
                                />
                                <span
                                    style={{
                                        fontSize: "clamp(1rem, 3vw, 2rem)",
                                        fontWeight: 900,
                                        letterSpacing: "0.2em",
                                        textShadow: "0 0 20px rgba(255,255,255,0.8)",
                                        animation: "pulse 0.8s ease-in-out infinite alternate",
                                    }}
                                >
                                    {eventLabel[randomEvent]}
                                </span>
                            </div>
                        )}

                        {/* Plants */}
                        {PLANTS.map((plant) =>
                            (outcomes[plant.id] || []).map((outcome, i) => {
                                const isDraggingThis = dragRef.current?.plantId === plant.id && dragRef.current?.index === i;

                                const displayScale = !outcome.planted ? 0 : outcome.scale * 1;
                                const displayOpacity = !outcome.planted ? 0 : outcome.opacity;
                                const transitionStyle = isDraggingThis
                                    ? "transform 0.1s ease"
                                    : "transform 70s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 50s cubic-bezier(0.34, 1.56, 0.64, 1)";

                                return (
                                    <div
                                        key={`${plant.id}-${i}`}
                                        onMouseDown={!outcome.isDead ? (e) => handlePlantMouseDown(e, plant.id, i, outcome.x, outcome.y) : undefined}
                                        onTouchStart={!outcome.isDead ? (e) => handlePlantTouchStart(e, plant.id, i, outcome.x, outcome.y) : undefined}
                                        style={{
                                            position: "absolute",
                                            left: `${outcome.x}%`,
                                            top: `${outcome.y}%`,
                                            zIndex: isDraggingThis ? 200 : outcome.zIndex,
                                            transform: `translate(-50%, -50%) scale(${displayScale}) rotate(${outcome.rotation}deg)`,
                                            opacity: displayOpacity,
                                            transition: transitionStyle,
                                            cursor: isDraggingThis ? "grabbing" : "grab",
                                            userSelect: "none",
                                            touchAction: "none",
                                        }}
                                    >
                                        <img
                                            draggable={false}
                                            src={`/${plant.file}`}
                                            alt={plant.label}
                                            style={{
                                                width: "clamp(28px, 4vw, 60px)",
                                                height: "clamp(28px, 4vw, 60px)",
                                                objectFit: "contain",
                                                display: "block",
                                                transform: outcome.flip ? "scaleX(-1)" : undefined,
                                                filter: outcome.thriving
                                                    ? isDraggingThis ? "drop-shadow(0 4px 12px rgba(168,255,120,0.8))" : ""
                                                    : `grayscale(80%) brightness(0.5) blur(0.5px)${isDraggingThis ? " drop-shadow(0 4px 12px rgba(255,100,100,0.6))" : ""}`,
                                                transition: "filter 0.5s ease",
                                                pointerEvents: "none",
                                            }}
                                        />
                                        {isDraggingThis && (
                                            <div style={{
                                                position: "absolute",
                                                inset: "-4px",
                                                borderRadius: "50%",
                                                border: `2px dashed ${outcome.thriving ? "rgba(168,255,120,0.7)" : "rgba(255,100,100,0.5)"}`,
                                                animation: "spin 3s linear infinite",
                                                pointerEvents: "none",
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {/* Grow button */}
                        {showPlants && (
                            <div className="absolute inset-0 flex justify-center items-center pointer-events-none z-[100]">
                                <button
                                    onClick={simulate}
                                    disabled={totalSeeds === 0}
                                    className="pointer-events-auto w-[150px] py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all"
                                    style={{
                                        background: totalSeeds === 0 ? "rgba(168,255,120,0.5)" : "linear-gradient(135deg, #a8ff78, #78ffd6)",
                                        border: "none",
                                        color: "#0a1a00",
                                        cursor: totalSeeds === 0 ? "not-allowed" : "pointer",
                                        opacity: totalSeeds === 0 ? 0.4 : 1,
                                        boxShadow: totalSeeds > 0 ? "0 0 20px rgba(168,255,120,0.4)" : "none",
                                    }}
                                >
                                    PLANT SEEDS
                                </button>
                            </div>
                        )}
                    </div>

                    {showHistory && (
                        <div
                            className="absolute inset-0 z-[200] rounded-xl flex flex-col"
                            style={{
                                background: "rgba(8,16,0,0.97)",
                                border: "2px solid rgba(168,255,120,0.25)",
                                backdropFilter: "blur(8px)",
                            }}
                        >
                            <div className="flex items-center justify-between px-4 py-3"
                                style={{ borderBottom: "1px solid rgba(168,255,120,0.15)" }}>
                                <div className="flex items-center gap-2">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a8ff78" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    <span className="text-xs font-black tracking-[0.2em] uppercase" style={{ color: "#a8ff78" }}>
                                        Experiment History
                                    </span>
                                </div>
                                <button
                                    onClick={() => setShowHistory(false)}
                                    className="w-6 h-6 rounded flex items-center justify-center text-sm cursor-pointer transition-all"
                                    style={{ background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff7070" }}
                                >✕</button>
                            </div>

                            <div className="history-scroll" style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
                                {experimentHistory.length === 0 ? (
                                    <div className="flex items-center justify-center h-full text-[10px] tracking-widest uppercase"
                                        style={{ color: "rgba(168,255,120,0.3)" }}>
                                        No experiments yet
                                    </div>
                                ) : (() => {
                                    const activePlants = PLANTS.filter(p =>
                                        experimentHistory.some(exp => (exp.results[p.id]?.total ?? 0) > 0)
                                    );

                                    const W_EXP = 88;
                                    const W_COND = 38;
                                    const W_EVENT = 100;
                                    const W_PLANT = 80;

                                    const DIVIDER_SHADOW = "inset -1px 0 0 rgba(168,255,120,0.15)";
                                    const EVENT_DIVIDER = "inset -1px 0 0 rgba(168,255,120,0.25)";
                                    const HEADER_BOTTOM = "inset 0 -2px 0 rgba(168,255,120,0.2)";

                                    const stickyHead = (left: number, extra?: React.CSSProperties): React.CSSProperties => ({
                                        position: "sticky",
                                        top: 0,
                                        left,
                                        zIndex: 4,
                                        background: "rgba(8,16,0,0.99)",
                                        ...extra,
                                    });

                                    const stickyBody = (left: number, bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
                                        position: "sticky",
                                        left,
                                        zIndex: 2,
                                        background: bg,
                                        ...extra,
                                    });

                                    return (
                                        <table style={{
                                            borderCollapse: "collapse",
                                            fontSize: "10px",
                                            tableLayout: "fixed",
                                            width: "100%",
                                            minWidth: W_EXP + W_COND * 3 + W_EVENT + activePlants.length * W_PLANT,
                                        }}>
                                            <thead>
                                                <tr>
                                                    <th style={stickyHead(0, { width: W_EXP, minWidth: W_EXP, padding: "12px 8px 10px", textAlign: "left", verticalAlign: "bottom", boxShadow: `${DIVIDER_SHADOW}, ${HEADER_BOTTOM}` })}>
                                                        <span style={{ color: "rgba(168,255,120,0.5)", fontWeight: 700, letterSpacing: "0.15em", fontSize: "10px", textTransform: "uppercase" }}>
                                                            {experimentHistory.length} total
                                                        </span>
                                                    </th>
                                                    <th style={stickyHead(W_EXP, { width: W_COND, minWidth: W_COND, padding: "12px 4px 10px", textAlign: "center", verticalAlign: "bottom", boxShadow: HEADER_BOTTOM })}>
                                                        <img src="/sun.png" style={{ width: 24, height: 24, objectFit: "contain", display: "block", margin: "0 auto" }} />
                                                    </th>
                                                    <th style={stickyHead(W_EXP + W_COND, { width: W_COND, minWidth: W_COND, padding: "12px 4px 10px", textAlign: "center", verticalAlign: "bottom", boxShadow: HEADER_BOTTOM })}>
                                                        <img src="/water.png" style={{ width: 24, height: 24, objectFit: "contain", display: "block", margin: "0 auto" }} />
                                                    </th>
                                                    <th style={stickyHead(W_EXP + W_COND * 2, { width: W_COND, minWidth: W_COND, padding: "12px 4px 10px", textAlign: "center", verticalAlign: "bottom", boxShadow: HEADER_BOTTOM })}>
                                                        <img src="/fertilizer.png" style={{ width: 24, height: 24, objectFit: "contain", display: "block", margin: "0 auto" }} />
                                                    </th>
                                                    <th style={stickyHead(W_EXP + W_COND * 3, { width: W_EVENT, minWidth: W_EVENT, padding: "12px 4px 10px", textAlign: "center", verticalAlign: "bottom", boxShadow: `${EVENT_DIVIDER}, ${HEADER_BOTTOM}` })}>
                                                        <span style={{ color: "rgba(168,255,120,0.4)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                                                            RANDOM<br />EVENT
                                                        </span>
                                                    </th>
                                                    {activePlants.map(plant => (
                                                        <th key={plant.id} style={{ position: "sticky", top: 0, zIndex: 3, background: "rgba(8,16,0,0.99)", width: W_PLANT, minWidth: W_PLANT, padding: "8px 4px 10px", textAlign: "center", verticalAlign: "bottom", borderLeft: "1px solid rgba(168,255,120,0.06)", boxShadow: HEADER_BOTTOM }}>
                                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                                                <img src={`/${plant.file}`} style={{ width: 30, height: 30, objectFit: "contain" }} />
                                                                <span style={{ color: "rgba(168,255,120,0.45)", fontSize: "10px", lineHeight: 1.2, textAlign: "center" }}>{plant.label}</span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {experimentHistory.map((exp, ei) => {
                                                    const rowBg = ei % 2 === 0 ? "rgba(168,255,120,0.025)" : "transparent";
                                                    const stickyBg = ei % 2 === 0 ? "rgba(12,22,4,0.99)" : "rgba(8,16,0,0.99)";
                                                    return (
                                                        <tr key={exp.id} style={{ background: rowBg, borderBottom: "1px solid rgba(168,255,120,0.08)" }}>
                                                            <td style={stickyBody(0, stickyBg, { width: W_EXP, padding: "8px 8px", verticalAlign: "middle", boxShadow: DIVIDER_SHADOW })}>
                                                                <div style={{ color: "#a8ff78", fontWeight: 900, fontSize: "11px", letterSpacing: "0.08em" }}>EXP {exp.id}</div>
                                                                <div style={{ color: "rgba(168,255,120,0.38)", fontSize: "10px", marginTop: "2px" }}>{exp.timestamp}</div>
                                                            </td>
                                                            <td style={stickyBody(W_EXP, stickyBg, { width: W_COND, padding: "8px 4px", textAlign: "center", verticalAlign: "middle" })}>
                                                                <span style={{ color: "rgba(168,255,120,0.8)", fontWeight: 700, fontSize: "10px" }}>{["L", "M", "H"][exp.sun]}</span>
                                                            </td>
                                                            <td style={stickyBody(W_EXP + W_COND, stickyBg, { width: W_COND, padding: "8px 4px", textAlign: "center", verticalAlign: "middle" })}>
                                                                <span style={{ color: "rgba(168,255,120,0.8)", fontWeight: 700, fontSize: "10px" }}>{["L", "M", "H"][exp.water]}</span>
                                                            </td>
                                                            <td style={stickyBody(W_EXP + W_COND * 2, stickyBg, { width: W_COND, padding: "8px 4px", textAlign: "center", verticalAlign: "middle" })}>
                                                                <span style={{ color: "rgba(168,255,120,0.8)", fontWeight: 700, fontSize: "10px" }}>{["L", "M", "H"][exp.fertilizer]}</span>
                                                            </td>
                                                            <td style={stickyBody(W_EXP + W_COND * 3, stickyBg, { width: W_EVENT, padding: "8px 4px", textAlign: "center", verticalAlign: "middle", boxShadow: EVENT_DIVIDER })}>
                                                                {(() => {
                                                                    const counts = {} as Record<string, number>;
                                                                    exp.events.forEach(e => { if (e) counts[e] = (counts[e] || 0) + 1; });
                                                                    const entries = Object.entries(counts);
                                                                    return entries.length === 0 ? (
                                                                        <span style={{ color: "rgba(168,255,120,0.18)", fontSize: "11px" }}>—</span>
                                                                    ) : (
                                                                        <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                                                                            {entries.map(([evt, count]) => (
                                                                                <div key={evt} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                                                                                    <img src={evt === "storm" ? "/storm.png" : evt === "sunflare" ? "/sun.png" : evt === "drought" ? "/drought.png" : "/pest.png"} style={{ width: 18, height: 18, objectFit: "contain" }} />
                                                                                    <span style={{ color: "#ffcc44", fontSize: "10px", fontWeight: 700 }}>{count}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </td>
                                                            {activePlants.map(plant => {
                                                                const r = exp.results[plant.id];
                                                                if (!r || r.total === 0) return (
                                                                    <td key={plant.id} style={{ width: W_PLANT, padding: "8px 4px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid rgba(168,255,120,0.06)", color: "rgba(168,255,120,0.15)", fontSize: "11px" }}>—</td>
                                                                );
                                                                const rate = Math.round((r.thriving / r.total) * 100);
                                                                const col = rate >= 70 ? "#a8ff78" : rate >= 40 ? "#ffcc44" : "#ff7070";
                                                                return (
                                                                    <td key={plant.id} style={{ width: W_PLANT, padding: "8px 4px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid rgba(168,255,120,0.06)" }}>
                                                                        <div style={{ color: "rgba(168,255,120,0.5)", fontSize: "10px", marginBottom: "1px" }}>{r.thriving}/{r.total}</div>
                                                                        <div style={{ color: col, fontWeight: 900, fontSize: "11px" }}>{rate}%</div>
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {simulated && !showPlants && (() => {
                        const allDead = PLANTS.every(plant => {
                            const outs = outcomes[plant.id] || [];
                            return outs.length === 0 || outs.every(o => !o.thriving);
                        });

                        if (!allDead) return null;

                        return (
                            <div className="absolute inset-0 flex flex-col gap-3 justify-center items-center z-[100]"
                                style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                                <div className="text-center">
                                    <div className="text-lg font-black tracking-widest uppercase mb-1"
                                        style={{ color: "#ff7070" }}>
                                        ALL PLANTS FAILED
                                    </div>
                                </div>
                                <button
                                    onClick={reset}
                                    className="py-2 px-5 rounded-lg text-xs font-black tracking-widest uppercase cursor-pointer transition-all"
                                    style={{
                                        background: "rgba(255,80,80,0.15)",
                                        border: "1.5px solid rgba(255,80,80,0.5)",
                                        color: "#ff7070",
                                        boxShadow: "0 0 20px rgba(255,80,80,0.2)",
                                    }}
                                >
                                    ↺ START AGAIN
                                </button>
                            </div>
                        );
                    })()}
                </div>

                {/* ── Right: stats ── */}
                <aside
                    className="flex flex-col gap-1.5 p-3 rounded-xl md:row-span-2"
                    style={{
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                    }}
                >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1.5">
                        <div>
                            <button
                                onClick={() => setShowHistory(v => !v)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold tracking-widest uppercase transition-all cursor-pointer"
                                style={{
                                    color: experimentHistory.length > 0 ? "#a8ff78" : "rgba(168,255,120,0.6)",
                                    cursor: "pointer",
                                }}
                            >
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                </svg>
                            </button>
                        </div>
                        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "rgba(168,255,120,0.6)" }}>
                            OBSERVED
                        </div>
                        <div className="flex justify-end">
                            <InfoTooltip text="You observed X plants thriving out of N total. The question is: what is the real underlying success rate? How likely is the plant going to thrive in certain conditions? You can't know it exactly, but given what you saw, this curve shows all possible true rates and how likely each one is. The shaded band is the 90% confidence zone. With 3 seeds it's almost full width. With 30 seeds it shrinks dramatically. If you plant more, you are more certain. That's statistical power." />
                        </div>
                    </div>

                    <BetaDistributionGraph
                        thriving={selectedStats?.thriving ?? 0}
                        total={selectedStats?.total ?? 0}
                        label={selectedStats?.plant.label ?? ""}
                        expectedProb={selectedStats ? selectedStats.expectedProb / 100 : undefined}
                    />

                    <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "rgba(168,255,120,0.6)" }}>
                        EXPECTED
                    </div>
                    <div className="overflow-y-auto sidebar-scroll">
                        {stats.map(({ plant, total, thriving, expectedProb, observedProb }) => {
                            const hasSims = simulated && total > 0;

                            return (
                                <div
                                    key={plant.id}
                                    onClick={() => setSelectedPlantId(plant.id)}
                                    className="p-2 my-1 rounded-lg cursor-pointer transition-all"
                                    style={{
                                        background: selectedPlantId === plant.id
                                            ? "rgba(168,255,120,0.08)"
                                            : "rgba(168,255,120,0.03)",
                                        border: selectedPlantId === plant.id
                                            ? "1px solid rgba(168,255,120,0.4)"
                                            : "1px solid rgba(168,255,120,0.1)",
                                        opacity: total === 0 ? 0.4 : 1,
                                    }}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-bold tracking-wide" style={{ color: "#a8ff78" }}>{plant.label}</span>
                                        <div className="flex items-center gap-1">
                                            <span className="text-[10px] font-bold" style={{ color: expectedProb >= 70 ? "#a8ff78" : expectedProb >= 40 ? "#ffcc44" : "#ff7070" }}>
                                                {expectedProb}%
                                            </span>
                                        </div>
                                    </div>

                                    <div className="h-1 rounded-sm overflow-hidden mb-0.5" style={{ background: "rgba(168,255,120,0.1)" }}>
                                        <div
                                            className="h-full rounded-sm transition-all duration-500"
                                            style={{
                                                width: `${expectedProb}%`,
                                                background: expectedProb >= 70 ? "#a8ff78" : expectedProb >= 40 ? "#ffcc44" : "#ff7070",
                                                opacity: 1,
                                            }}
                                        />
                                    </div>

                                    {hasSims && (
                                        <>
                                            <div className="h-1 rounded-sm overflow-hidden" style={{ background: "rgba(168,255,120,0.05)" }}>
                                                <div
                                                    className="h-full rounded-sm transition-all duration-700"
                                                    style={{
                                                        width: `${observedProb}%`,
                                                        background: observedProb >= 70 ? "rgba(168,255,120,0.9)" : observedProb >= 40 ? "#ffcc44" : "#ff7070",
                                                    }}
                                                />
                                            </div>

                                            <div className="flex justify-between items-center mt-2">
                                                <div className="text-[9px]" style={{ color: "rgba(168,255,120,0.5)" }}>
                                                    {hasSims ? `${thriving}/${total} thriving` : ""}
                                                </div>
                                                <div className="text-[10px] font-bold" style={{ color: observedProb >= 70 ? "rgba(168,255,120,0.9)" : observedProb >= 40 ? "rgba(255,204,68,0.9)" : "rgba(255,112,112,0.9)" }}>
                                                    {observedProb}%
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </aside>
            </div>

            <style>{`
    @keyframes pulse {
        from { opacity: 0.7; transform: scale(1); }
        to   { opacity: 1;   transform: scale(1.05); }
    }
    @keyframes eventFlash {
        0%   { opacity: 0; }
        20%  { opacity: 1; }
        80%  { opacity: 1; }
        100% { opacity: 0; }
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
    }
    button:hover { filter: brightness(1.15); }
    * { box-sizing: border-box; }
    body { margin: 0; }

    .sidebar-scroll::-webkit-scrollbar { width: 2px; }
    .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(168,255,120,0.2); border-radius: 999px; }
    .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(168,255,120,0.4); }

    .history-scroll::-webkit-scrollbar { width: 2px; height: 7px; }
    .history-scroll::-webkit-scrollbar-track { background: transparent; }
    .history-scroll::-webkit-scrollbar-thumb { background: rgba(168,255,120,0.2); border-radius: 999px; }
    .history-scroll::-webkit-scrollbar-thumb:hover { background: rgba(168,255,120,0.4); }

    .history-scroll {
        scrollbar-gutter: stable;
        overflow-y: auto;
    }

    .history-scroll::-webkit-scrollbar-corner {
        background: transparent;
    }
`}</style>
        </div>
    );
}