"use client";

import { useState, useEffect, useCallback, useRef } from "react";


// ─── Types ────────────────────────────────────────────────────────────────────
type ConditionLevel = 0 | 1 | 2;
type RandomEvent = "storm" | "sunflare" | "pests" | "drought" | null;
type TestedCondition = "sun" | "water" | "fertilizer" | null;
type HypothesisValue = "a" | "none" | "b";
type Hypothesis = HypothesisValue | null;

interface PlantConfig {
    id: string; label: string; file: string;
    idealSun: ConditionLevel; idealWater: ConditionLevel; idealFertilizer: ConditionLevel;
    tolerance: number;
    eventSensitivity: { storm: number; sunflare: number; pests: number; drought: number };
}

interface PlantOutcome {
    thriving: boolean; opacity: number; scale: number;
    x: number; y: number; rotation: number; zIndex: number;
    isDead?: boolean; flip?: boolean; baseRoll: number; growDelay: number; planted: boolean;
}

interface ExperimentRecord {
    id: number;
    timestamp: string;
    testedCondition: TestedCondition;
    levelA: ConditionLevel;
    levelB: ConditionLevel;
    events: RandomEvent[];
    results: Record<string, { thrivingA: number; totalA: number; thrivingB: number; totalB: number }>;
}

const PLANTS: PlantConfig[] = [
    { id: "portulacaria", label: "Portulacaria", file: "portulacaria.png", idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.85, eventSensitivity: { storm: -0.10, sunflare: +0.1, pests: -0.10, drought: +0.1 } },
    { id: "pothos", label: "Pothos", file: "pothos.png", idealSun: 1, idealWater: 1, idealFertilizer: 0, tolerance: 0.80, eventSensitivity: { storm: -0.05, sunflare: -0.10, pests: -0.20, drought: -0.10 } },
    { id: "pansy", label: "Pansy", file: "pansy.png", idealSun: 1, idealWater: 2, idealFertilizer: 1, tolerance: 0.45, eventSensitivity: { storm: -0.25, sunflare: -0.20, pests: -0.25, drought: -0.30 } },
    { id: "zinnia", label: "Zinnia", file: "zinnia.png", idealSun: 2, idealWater: 1, idealFertilizer: 0, tolerance: 0.65, eventSensitivity: { storm: -0.10, sunflare: +0.10, pests: -0.1, drought: +0.05 } },
    { id: "sunflower", label: "Sunflower", file: "sunflower.png", idealSun: 2, idealWater: 1, idealFertilizer: 2, tolerance: 0.60, eventSensitivity: { storm: -0.1, sunflare: +0.20, pests: -0.1, drought: -0.10 } },
    { id: "domino", label: "Domino Cactus", file: "domino.png", idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.80, eventSensitivity: { storm: -0.05, sunflare: +0.1, pests: -0.05, drought: +0.20 } },
    { id: "orchid", label: "Orchid", file: "orchid.png", idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.25, eventSensitivity: { storm: -0.30, sunflare: -0.25, pests: -0.30, drought: -0.25 } },
    { id: "gardenia", label: "Gardenia", file: "gardenia.png", idealSun: 2, idealWater: 2, idealFertilizer: 2, tolerance: 0.30, eventSensitivity: { storm: -0.20, sunflare: -0.1, pests: -0.30, drought: -0.25 } },
    { id: "mint", label: "Mint", file: "mint.png", idealSun: 1, idealWater: 2, idealFertilizer: 1, tolerance: 0.85, eventSensitivity: { storm: -0.05, sunflare: -0.05, pests: -0.10, drought: -0.20 } },
    { id: "venus", label: "Venus Flytrap", file: "venus.png", idealSun: 2, idealWater: 2, idealFertilizer: 0, tolerance: 0.30, eventSensitivity: { storm: -0.1, sunflare: +0.10, pests: +0.10, drought: -0.30 } },
    { id: "monstera", label: "Monstera", file: "monstera.png", idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.75, eventSensitivity: { storm: -0.05, sunflare: -0.20, pests: -0.25, drought: -0.1 } },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcBaseProb(plant: PlantConfig, sun: ConditionLevel, water: ConditionLevel, fertilizer: ConditionLevel): number {
    const d = Math.abs(sun - plant.idealSun) + Math.abs(water - plant.idealWater) + Math.abs(fertilizer - plant.idealFertilizer);
    return Math.max(0, Math.min(0.98, 1 - (d / 6) * (1 - plant.tolerance)));
}

function calcSuccessProb(plant: PlantConfig, sun: ConditionLevel, water: ConditionLevel, fertilizer: ConditionLevel, events: RandomEvent[]): number {
    const base = calcBaseProb(plant, sun, water, fertilizer);
    const bonus = events.reduce((s, e) => { if (!e) return s; const r = plant.eventSensitivity[e]; return s + (r < 0 ? r * (1 + (1 - plant.tolerance)) : r); }, 0);
    return Math.max(0, Math.min(0.98, base + bonus));
}

function seededRandom(seed: number) {
    let s = seed;
    return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return ((s >>> 0) / 0xffffffff); };
}

function generatePlantPositions(count: number, seed: number, xMin = 4, xMax = 92) {
    const rng = seededRandom(seed);
    return Array.from({ length: count }, () => ({ x: xMin + rng() * (xMax - xMin), y: 4 + rng() * 84, rotation: (rng() - 0.5) * 20, zIndex: Math.floor(rng() * 60) }));
}

function levelLabel(l: ConditionLevel) { return ["Low", "Medium", "High"][l]; }
function levelShort(l: ConditionLevel) { return ["Low", "Med", "High"][l]; }

function normalCDF(z: number): number {
    const t = 1 / (1 + 0.2316419 * Math.abs(z));
    const d = 0.3989423 * Math.exp(-z * z / 2);
    const p = t * (0.3193815 + t * (-0.3565638 + t * (1.7814779 + t * (-1.8212560 + t * 1.3302744))));
    return z > 0 ? 1 - d * p : d * p;
}

function twoProportionZTest(t1: number, n1: number, t2: number, n2: number) {
    if (n1 === 0 || n2 === 0) return { z: 0, pValue: 1, significant: false };
    const p1 = t1 / n1, p2 = t2 / n2, pPool = (t1 + t2) / (n1 + n2);
    const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
    if (se === 0) return { z: 0, pValue: 1, significant: false };
    const z = (p1 - p2) / se;
    const pValue = 2 * (1 - normalCDF(Math.abs(z)));
    return { z, pValue, significant: pValue < 0.05 };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ConditionControl({ icon, label, value, onChange, locked = false, compact = false }: {
    icon?: string; label?: string; value: ConditionLevel; onChange: (v: ConditionLevel) => void; locked?: boolean; compact?: boolean;
}) {
    const labels = compact ? ["Low", "Medium", "High"] : ["Low", "Med", "High"];
    const imgClass = compact ? "w-5 h-5 object-contain flex-shrink-0" : "w-7 h-7 object-contain flex-shrink-0";
    return (
        <div className={`flex items-center gap-2 ${compact ? "mb-1.5" : "mb-3"} ${locked ? "opacity-60" : ""}`}>
            {icon && <img src={`/${icon}`} alt={label} className={imgClass} />}
            <div className="flex flex-col flex-1">
                {!compact && <span className="text-xs font-semibold tracking-widest uppercase text-garden-primary mb-1">{label}</span>}
                <div className="flex gap-1">
                    {([0, 1, 2] as ConditionLevel[]).map(v => (
                        <button
                            key={v}
                            onClick={() => !locked && onChange(v)}
                            disabled={locked}
                            className={`
  flex-1 
  rounded 
  font-bold 
  
  ${compact ? "py-0.5 text-[10px]" : "py-1 text-xs"}
  ${value === v ? "bg-garden-primary text-garden-secondary border-garden-primary "
                                    : "bg-garden-primary-opaque text-garden-primary "}
`}
                            style={{
                                cursor: locked ? "not-allowed" : "pointer",
                            }}
                        >
                            {labels[v]}
                        </button>
                    ))}
                </div>
            </div>
        </div >
    );
}

function SeedSelector({ plant, count, onChange, sun, water, fertilizer, locked = false, experimentRunning }: {
    plant: PlantConfig; count: number; onChange: (v: number) => void;
    sun: ConditionLevel; water: ConditionLevel; fertilizer: ConditionLevel; locked?: boolean; experimentRunning: boolean;
}) {
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltipTop, setTooltipTop] = useState(0);
    const [hovered, setHovered] = useState(false);
    const incrementRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countRef = useRef(count);
    useEffect(() => { countRef.current = count; }, [count]);
    const startPress = (fn: () => void) => { fn(); incrementRef.current = setInterval(fn, 150); };
    const stopPress = () => { if (incrementRef.current) { clearInterval(incrementRef.current); incrementRef.current = null; } };
    const updateTip = () => {
        if (!imageRef.current || !containerRef.current) return;
        const ir = imageRef.current.getBoundingClientRect(), cr = containerRef.current.getBoundingClientRect();
        setTooltipTop(ir.top - cr.top + ir.height / 2);
    };
    return (
        <div className="flex items-center gap-2 p-2 rounded-lg mb-2 bg-garden-primary-opaque border border-garden-primary-opaque">

            <div ref={containerRef} className="relative w-10 h-10 flex-shrink-0 overflow-visible" onMouseEnter={() => { updateTip(); setHovered(true); }} onMouseLeave={() => setHovered(false)}>
                <img ref={imageRef} src={`/${plant.file}`} alt={plant.label} className="w-10 h-10 object-contain" />
                {hovered && <PlantTooltip plant={plant} top={tooltipTop} sun={sun} water={water} fertilizer={fertilizer} experimentRunning={experimentRunning} />}
                {count > 0 && <div className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded text-xs font-bold bg-garden-primary" style={{ color: "#0a1a00", fontSize: "10px" }}>{count}</div>}
            </div>
            <span className="flex-1 text-xs text-garden-primary font-semibold">{plant.label}</span>
            <div className="flex items-center gap-1">
                {/* Decrement Button */}
                <button
                    onMouseDown={() => !locked && startPress(() => onChange(Math.max(0, countRef.current - 1)))}
                    onMouseUp={stopPress}
                    onMouseLeave={stopPress}
                    onTouchStart={() => !locked && startPress(() => onChange(Math.max(0, countRef.current - 1)))}
                    onTouchEnd={stopPress}
                    disabled={locked || count === 0}
                    className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold border-garden-primary-opaque
      ${count === 0 || locked ? 'text-garden-primary-dim-2 bg-garden-primary-opaque cursor-not-allowed'
                            : 'text-garden-primary bg-garden-primary-opaque cursor-pointer'}`}
                >
                    -
                </button>

                {/* Count Display */}
                <span
                    className={`w-5 text-center text-xs ${locked ? 'text-garden-primary-dim' : 'text-garden-primary'}`}
                >
                    {count}
                </span>

                {/* Increment Button */}
                <button
                    onMouseDown={() => (!locked && countRef.current < 50) && startPress(() => onChange(Math.min(50, countRef.current + 1)))}
                    onMouseUp={stopPress}
                    onMouseLeave={stopPress}
                    onTouchStart={() => (!locked && countRef.current < 50) && startPress(() => onChange(Math.min(50, countRef.current + 1)))}
                    onTouchEnd={stopPress}
                    disabled={locked || count >= 50}
                    className={`w-6 h-6 rounded flex items-center justify-center text-sm font-bold border-garden-primary-opaque
      ${count >= 50 || locked ? 'text-garden-primary-dim-2 bg-garden-primary-opaque cursor-not-allowed'
                            : 'text-garden-primary bg-garden-primary-opaque cursor-pointer'}`}
                >
                    +
                </button>
            </div>
        </div>
    );
}

function PlantTooltip({ plant, top, sun, water, fertilizer, experimentRunning }: {
    plant: PlantConfig; top: number; sun: ConditionLevel; water: ConditionLevel; fertilizer: ConditionLevel, experimentRunning: boolean;
}) {

    const prob = Math.round(calcBaseProb(plant, sun, water, fertilizer) * 100);
    const idealProb = Math.round(calcBaseProb(plant, plant.idealSun, plant.idealWater, plant.idealFertilizer) * 100);

    const gridCols = experimentRunning
        ? "grid-cols-[10px_1fr]"
        : "grid-cols-[10px_1fr_1fr]";

    return (
        <div
            className="absolute z-50 pointer-events-none left-[48px] -translate-y-1/2 bg-garden-tooltip-dark border border-garden-primary-opaque rounded-[10px] p-[10px_12px] min-w-[170px] text-xs text-garden-primary whitespace-nowrap "
            style={{ top }}
        >
            {/* Plant Header */}
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-garden-secondary">
                <img src={`/${plant.file}`} alt={plant.label} className="w-8 h-8 object-contain" />
                <div>
                    <div className="font-black tracking-wide text-garden-primary">{plant.label}</div>
                    <div className="text-garden-primary-dim">
                        Tolerance {Math.round(plant.tolerance * 100)}%
                    </div>
                </div>
            </div>

            <div
                className={`grid ${gridCols} gap-x-3 mb-1 items-center text-garden-secondary font-bold uppercase tracking-wide`}
            >
                <div></div>
                <div className="text-center">Ideal</div>

                {!experimentRunning && (
                    <div className="text-center">Current</div>
                )}
            </div>

            {[
                { icon: "sun.png", label: "Sun", ideal: plant.idealSun, cur: sun },
                { icon: "water.png", label: "Water", ideal: plant.idealWater, cur: water },
                { icon: "fertilizer.png", label: "Fert", ideal: plant.idealFertilizer, cur: fertilizer }
            ].map(({ icon, label, ideal, cur }) => (
                <div key={label} className={`grid ${gridCols} gap-x-3 mb-1 items-center`}>
                    <img src={`/${icon}`} alt={label} className="w-3 h-3 object-contain" />

                    <div className="text-center text-garden-primary">
                        {levelLabel(ideal)}
                    </div>

                    {!experimentRunning && (
                        <div className={`text-center ${cur === ideal ? 'text-garden-primary' : 'text-garden-danger'}`}>
                            {levelLabel(cur)}
                        </div>
                    )}
                </div>
            ))}

            <div className={`grid ${gridCols} gap-x-3 mt-2 pt-2 border-t border-garden-secondary`}>
                <div />

                <div className="text-center font-black text-garden-primary">
                    {idealProb}%
                </div>

                {!experimentRunning && (
                    <div
                        className={`text-center font-black ${prob >= 70
                            ? 'text-garden-primary'
                            : prob >= 40
                                ? 'text-garden-sample-beige'
                                : 'text-garden-danger'
                            }`}
                    >
                        {prob}%
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoTooltip({ text }: { text: string }) {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative inline-block">
            <span
                onMouseEnter={() => setVisible(true)}
                onMouseLeave={() => setVisible(false)}
                onTouchStart={() => setVisible(v => !v)}
                className="cursor-pointer"
            >
                <span
                    className="w-3.5 h-3.5 rounded-full inline-flex items-center justify-center text-[8px] font-black leading-none
                     bg-garden-primary-opaque border-2 border-garden-primary text-garden-primary"
                >
                    ?
                </span>
            </span>

            {visible && (
                <div
                    className="absolute z-50 right-0"
                    style={{ top: "calc(100% + 6px)", width: "235px" }}
                >
                    <div
                        className="bg-garden-tooltip-dark border-garden-primary-opaque text-garden-primary-dim
                       rounded px-2.5 py-2 text-xs leading-[1.6] whitespace-normal break-words"
                    >
                        {text}
                    </div>
                </div>
            )}
        </div>
    );
}



function InfoButton({ text }: { text: string }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="relative inline-block w-full">
            <button
                onClick={() => setOpen(v => !v)}
                className="italic text-garden-primary cursor-pointer"
            >
                Coincidence or not?
            </button>

            {open && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="bg-[#081000] border border-garden-primary-opaque rounded-lg p-4 text-sm text-garden-primary whitespace-normal break-words  sm:max-w-[300px] md:max-w-[450px] w-full">
                        <div dangerouslySetInnerHTML={{ __html: text }} />
                        <button
                            onClick={() => setOpen(false)}
                            className="mt-2 text-garden-primary font-bold text-right w-full cursor-pointer"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}


// ─── Beta Graph ───────────────────────────────────────────────────────────────
function BetaGraph({ thrivingA, totalA, thrivingB, totalB, label, showExpected, expectedProb }: {
    thrivingA: number; totalA: number; thrivingB?: number; totalB?: number;
    label: string; showExpected?: boolean; expectedProb?: number;
}) {
    const W = 220, H = 90, N = 100;
    const logG = (z: number): number => {
        const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
        if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logG(1 - z);
        z -= 1; let x = c[0]; for (let i = 1; i < g + 2; i++) x += c[i] / (z + i);
        const t = z + g + 0.5; return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
    };
    const bPDF = (x: number, a: number, b: number) => {
        if (x <= 0 || x >= 1) return 0;
        return Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - (logG(a) + logG(b) - logG(a + b)));
    };
    const xs = Array.from({ length: N }, (_, i) => (i + 0.5) / N);
    const aA = thrivingA + 1, bA = (totalA - thrivingA) + 1;
    const ysA = xs.map(x => bPDF(x, aA, bA));
    const dual = totalB !== undefined && totalB > 0;
    const aB = (thrivingB ?? 0) + 1, bB = ((totalB ?? 0) - (thrivingB ?? 0)) + 1;
    const ysB = dual ? xs.map(x => bPDF(x, aB, bB)) : [];
    const maxY = Math.max(...ysA, ...ysB, 0.001);
    const sv = (x: number, y: number) => `${(x * W).toFixed(1)},${(H - (y / maxY) * (H - 8)).toFixed(1)}`;
    const mkPath = (ys: number[]) => xs.map((x, i) => `${i === 0 ? "M" : "L"}${sv(x, ys[i])}`).join(" ");
    const mkFill = (ys: number[]) => `${mkPath(ys)} L${W},${H} L0,${H} Z`;
    const modeA = xs[ysA.indexOf(Math.max(...ysA))];
    const modeB = dual ? xs[ysB.indexOf(Math.max(...ysB))] : null;
    const cdf = xs.map((_, i) => ysA.slice(0, i + 1).reduce((s, v) => s + v, 0) / ysA.reduce((s, v) => s + v, 0));
    const lo = xs[cdf.findIndex(c => c >= 0.05)] ?? 0, hi = xs[cdf.findIndex(c => c >= 0.95)] ?? 1;
    const ciXs = xs.filter(x => x >= lo && x <= hi);
    const ciPath = ciXs.length > 1 ? `M${sv(ciXs[0], 0)} ${ciXs.map((x, i) => `L${sv(x, bPDF(x, aA, bA))}`).join(" ")} L${sv(ciXs[ciXs.length - 1], 0)} Z` : "";
    const expX = (showExpected && expectedProb != null) ? expectedProb * W : null;

    if (totalA === 0) return (
        <div className="p-2.5 rounded-lg mb-2 flex items-center justify-center" style={{ background: "rgba(183,210,109,0.1)", border: "1px solid rgba(183,210,109,0.2)", minHeight: "80px" }}>
            <div className="text-[10px] tracking-widest uppercase text-center" style={{ color: "rgba(183,210,109,0.5)" }}>click a plant<br />to see its rate</div>
        </div>
    );
    return (
        <div className="p-2.5 rounded-lg mb-2 bg-garden-primary-opaque border-garden-primary-dim-2">
            {label && <div className="text-[10px] text-garden-primary font-bold tracking-[0.1em] uppercase text-center py-1 mb-1">{label}</div>}
            <div className="flex justify-between mb-1.5 text-[9px]">
                <span className={dual ? "text-garden-sample-purple" : "text-garden-primary"}>
                    {dual ? " " : `${thrivingA}/${totalA} thriving`}
                </span>
                {!dual && (
                    <span className="text-garden-primary">
                        peak: {Math.round(modeA * 100)}%
                    </span>
                )}
            </div>
            <svg
                width="100%"
                viewBox={`0 0 ${W} ${H + 18}`}
                style={{ overflow: "visible" }}
                className={!dual ? "text-garden-primary" : "text-garden-sample-purple"}
            >
                {/* CI path */}
                {!dual && ciPath && <path d={ciPath} className="bg-garden-primary" />}

                {/* Fills */}
                <path d={mkFill(ysA)} fill={!dual ? "rgba(183,210,109,0.2)" : "rgba(177,168,240,0.3)"} />
                {dual && <path d={mkFill(ysB)} fill="rgba(240,213,168,0.3)" />}

                {/* Lines */}
                <path d={mkPath(ysA)} fill="none" stroke="currentColor" strokeWidth="1.5" />
                {dual && <path d={mkPath(ysB)} fill="none" stroke="#f0d5a8" strokeWidth="1.5" />}

                {/* Vertical mode lines */}
                <line
                    x1={modeA * W} y1={0} x2={modeA * W} y2={H}
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeDasharray="4,3"
                    opacity="0.7"
                />
                {modeB != null && (
                    <line
                        x1={modeB * W} y1={0} x2={modeB * W} y2={H}
                        stroke="#f0d5a8"
                        strokeWidth="1"
                        strokeDasharray="4,3"
                        opacity="0.7"
                    />
                )}
                {expX != null && (
                    <line
                        x1={expX} y1={0} x2={expX} y2={H}
                        stroke="#394d03"
                        strokeWidth="1"
                        strokeDasharray="4,3"
                        opacity="0.85"
                    />
                )}

                {/* X axis */}
                <line x1={0} y1={H} x2={W} y2={H} stroke="rgba(183,210,109,0.2)" strokeWidth="1" />

                {/* Axis labels */}
                {[0, 25, 50, 75, 100].map(v => (
                    <text
                        key={v}
                        x={(v / 100) * W}
                        y={H + 10}
                        textAnchor="middle"
                        className="text-garden-primary-dim-2"
                        fontSize="7"
                        fill="currentColor"
                    >
                        {v}%
                    </text>
                ))}
            </svg>
            {!dual && (
                <div className="flex items-center justify-center gap-3 px-1 mt-1 text-[10px]">
                    {/* Observed */}
                    <div className="flex items-center gap-1 text-garden-primary">
                        <svg width="16" height="8">
                            <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,2" />
                        </svg>
                        <span>observed</span>
                    </div>

                    {/* Expected */}
                    <div className="flex items-center gap-1 text-garden-secondary">
                        <svg width="16" height="8">
                            <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,2" />
                        </svg>
                        <span>expected</span>
                    </div>
                </div>
            )}
            {dual && (
                <div className="flex items-center justify-center gap-3 px-1 mt-1 text-[10px]">
                    {/* A */}
                    <div className="flex items-center gap-1 text-garden-sample-purple">
                        <svg width="16" height="8">
                            <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,2" />
                        </svg>
                        <span>A</span>
                    </div>

                    {/* B */}
                    <div className="flex items-center gap-1 text-garden-sample-beige">
                        <svg width="16" height="8">
                            <line x1="0" y1="4" x2="16" y2="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3,2" />
                        </svg>
                        <span>B</span>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Experiment Setup Modal ────────────────────────────────────────────────────
function ExperimentSetupModal({ seedCounts, testedCondition, setTestedCondition, levelA, setLevelA, levelB, setLevelB, sharedSun, setSharedSun, sharedWater, setSharedWater, sharedFertilizer, setSharedFertilizer, hypotheses, setHypothesis, onRun, onCancel }: {
    seedCounts: Record<string, number>;
    testedCondition: TestedCondition; setTestedCondition: (v: TestedCondition) => void;
    levelA: ConditionLevel; setLevelA: (v: ConditionLevel) => void;
    levelB: ConditionLevel; setLevelB: (v: ConditionLevel) => void;
    sharedSun: ConditionLevel; setSharedSun: (v: ConditionLevel) => void;
    sharedWater: ConditionLevel; setSharedWater: (v: ConditionLevel) => void;
    sharedFertilizer: ConditionLevel; setSharedFertilizer: (v: ConditionLevel) => void;
    hypotheses: Record<string, Hypothesis>; setHypothesis: (plantId: string, v: Hypothesis) => void;
    onRun: () => void; onCancel: () => void;
}) {
    const totalSeeds = Object.values(seedCounts).reduce((a, b) => a + b, 0);
    const selectedPlantIds = PLANTS.filter(p => (seedCounts[p.id] || 0) > 0).map(p => p.id);
    const allHypothesesSet = selectedPlantIds.length > 0 && selectedPlantIds.every(id => hypotheses[id] != null);
    const canRun = testedCondition !== null && levelA !== levelB && totalSeeds > 0 && allHypothesesSet;

    const handleLA = (v: ConditionLevel) => { setLevelA(v); if (v === levelB) setLevelB(v === 2 ? 0 : (v + 1) as ConditionLevel); };
    const handleLB = (v: ConditionLevel) => { setLevelB(v); if (v === levelA) setLevelA(v === 2 ? 0 : (v + 1) as ConditionLevel); };

    const condBtns = [
        { key: "sun" as TestedCondition, icon: "sun.png", label: "Sunlight" },
        { key: "water" as TestedCondition, icon: "water.png", label: "Water" },
        { key: "fertilizer" as TestedCondition, icon: "fertilizer.png", label: "Fertilizer" },
    ];
    const sharedCtrl = [
        { key: "sun", icon: "sun.png", label: "Sunlight", value: sharedSun, setter: setSharedSun },
        { key: "water", icon: "water.png", label: "Water", value: sharedWater, setter: setSharedWater },
        { key: "fertilizer", icon: "fertilizer.png", label: "Fertilizer", value: sharedFertilizer, setter: setSharedFertilizer },
    ].filter(c => c.key !== testedCondition);

    return (
        <div className="absolute inset-0 z-[200] rounded-xl flex flex-col" style={{ background: "rgba(8,16,0,0.97)" }}>
            <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgba(183,210,109,0.1)" }}>
                <div className="flex items-center gap-2">

                    <span className="text-xs text-garden-primary font-black tracking-[0.2em] uppercase" >New Experiment</span>
                </div>
                <button onClick={onCancel} className="w-6 h-6 rounded flex items-center justify-center text-sm cursor-pointer text-red-300">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto history-scroll px-5 py-4 flex flex-col gap-4">
                {/* Pick tested condition */}
                <div>
                    {/* Question */}
                    <div className="text-center text-garden-primary-dim text-[10px] font-black tracking-[0.15em] uppercase mb-3">
                        What condition are you testing?
                    </div>


                    {/* 3-column layout */}
                    <div className="flex gap-2">
                        {condBtns.map(({ key, icon, label }) => {
                            const isSelected = testedCondition === key;
                            const sharedForThis = sharedCtrl.find(c => c.key === key);

                            return (
                                <div key={key} className="flex-1 flex flex-col gap-2">
                                    {/* Condition button */}
                                    <button
                                        onClick={() => setTestedCondition(key)}
                                        className={`
              flex flex-col items-center gap-1.5 py-2.5 px-2 rounded-lg cursor-pointer
              text-garden-primary-dim bg-garden-primary-opaque 
              ${isSelected ? " border border-garden-primary" : ""}
            `}
                                    >
                                        <img src={`/${icon}`} alt={label} className="w-5 h-5 object-contain" />
                                        <span className="text-[10px] font-bold">{label}</span>
                                    </button>


                                    {/* Selected condition: show Sample A & B */}
                                    {testedCondition && isSelected && (
                                        <>
                                            {(["A", "B"] as const).map(side => {
                                                const val = side === "A" ? levelA : levelB;
                                                const setter = side === "A" ? handleLA : handleLB;
                                                const textCol = side === "A" ? "text-garden-sample-purple" : "text-garden-sample-beige";
                                                const bgCol = side === "A" ? "bg-garden-sample-purple" : "bg-garden-sample-beige";

                                                return (
                                                    <div key={side} className={`p-3 rounded-lg bg-garden-primary-opaque border-garden-secondary`}>
                                                        <div className={`text-[10px] font-black tracking-[0.15em] uppercase mb-3 ${textCol}`}>
                                                            Sample {side}
                                                        </div>
                                                        <div className="flex gap-1">
                                                            {([0, 1, 2] as ConditionLevel[]).map(v => (
                                                                <button
                                                                    key={v}
                                                                    onClick={() => setter(v)}
                                                                    className={`
                            flex-1 py-1 rounded text-[12px] font-bold cursor-pointer
                            bg-garden-primary-opaque border-garden-secondary
                            ${val === v ? bgCol : "bg-garden-secondary"}
                            ${val === v ? "text-garden-secondary" : textCol}
                          `}
                                                                >
                                                                    {["Low", "Med", "High"][v]}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}


                                    {/* Non-selected condition: show only shared if exists */}
                                    {testedCondition && !isSelected && sharedForThis && (
                                        <div className="p-3  rounded-lg bg-garden-primary-opaque border-garden-primary-dim-2">
                                            <div className="text-[10px] font-black tracking-[0.15em] uppercase mb-2 text-garden-primary ">
                                                Constant
                                            </div>
                                            <ConditionControl
                                                key={sharedForThis.key}


                                                value={sharedForThis.value}
                                                onChange={sharedForThis.setter}

                                            />
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>


                    {/* Warning if levels match */}
                    {levelA === levelB && testedCondition && (
                        <div className=" text-[10px] mt-1.5 text-center text-garden-danger">
                            Samples must have different levels
                        </div>
                    )}
                </div>


                {/* Seeds info */}
                {testedCondition && (totalSeeds === 0
                    ? <div>
                        <div className="text-[11px] text-center pt-2 font-semibold uppercase" style={{ color: "rgba(183,210,109)" }}>Add seeds from the menu</div>
                        <div className="text-[11px] text-center py-2" style={{ color: "rgba(183,210,109, 0.5)" }}>Both samples are assigned the same species and counts</div>
                    </div>
                    : <div className="text-[11px] font-semibold text-center py-1" style={{ color: "rgba(183,210,109)" }}>{totalSeeds} total seed{totalSeeds !== 1 ? "s" : ""} per sample</div>
                )}

                {/* Per-plant hypotheses */}
                {testedCondition && levelA !== levelB && totalSeeds > 0 && (
                    <div>
                        <div className="text-center text-garden-primary-dim text-[10px]  font-black tracking-[0.15em] uppercase mb-2">Your hypothesis per plant type</div>
                        <div className="flex flex-col gap-2">
                            {PLANTS.filter(p => (seedCounts[p.id] || 0) > 0).map(plant => {
                                const hyp = hypotheses[plant.id] ?? null;
                                return (
                                    <div key={plant.id} className="p-2.5 rounded-lg" style={{ background: "rgba(183,210,109,0.04)", border: `1px solid ${hyp ? "rgba(183,210,109,0.2)" : "rgba(183,210,109,0.1)"}` }}>
                                        <div className="flex  items-center gap-2 mb-2 text-[11px]  font-bold text-garden-primary">
                                            <img src={`/${plant.file}`} alt={plant.label} className="w-5 h-5 object-contain" />
                                            <span >{plant.label}</span>
                                            <span className="ml-auto">{seedCounts[plant.id]} seeds</span>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {([["a", "Sample A better"], ["none", "No difference"], ["b", "Sample B better"]] as [Hypothesis, string][]).map(([val, lbl]) => (
                                                <button
                                                    key={val}
                                                    onClick={() => setHypothesis(plant.id, val)}
                                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold cursor-pointer text-center ${hyp === val ? "text-garden-secondary bg-garden-primary" : "text-garden-primary bg-garden-primary-opaque"
                                                        }`}
                                                >
                                                    {lbl}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {!allHypothesesSet && (
                            <div className="text-[10px] mt-1.5 text-center" style={{ color: "rgba(183,210,109,0.4)" }}>Set a hypothesis for each plant to continue</div>
                        )}
                    </div>
                )}
            </div>



            <div className="px-5 py-4 border-t border-garden-primary-opaque flex justify-center">
                <button
                    onClick={onRun}
                    disabled={!canRun}
                    className={`w-50 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all
      ${canRun
                            ? "text-garden-secondary bg-garden-primary cursor-pointer"
                            : "text-garden-primary-dim-2 bg-garden-primary-opaque cursor-not-allowed"
                        }`}
                >
                    Run Experiment
                </button>
            </div>

        </div>

    );
}

// ─── Results Modal ────────────────────────────────────────────────────────────
function ResultsModal({ selectedPlants, outcomesA, outcomesB, hypotheses, testedCondition, levelA, levelB, eventLog, onSave }: {
    selectedPlants: { plant: PlantConfig; count: number }[];
    outcomesA: Record<string, PlantOutcome[]>; outcomesB: Record<string, PlantOutcome[]>;
    hypotheses: Record<string, Hypothesis>; testedCondition: TestedCondition;
    levelA: ConditionLevel; levelB: ConditionLevel;
    eventLog: RandomEvent[]; onSave: () => void;
}) {
    const condIcon = testedCondition === "sun" ? "sun.png" : testedCondition === "water" ? "water.png" : "fertilizer.png";
    const eventCount = eventLog.filter(Boolean).length;
    const tooMuchRandomness = eventCount >= 2;

    const results = selectedPlants.map(({ plant }) => {
        const outsA = outcomesA[plant.id] || [], outsB = outcomesB[plant.id] || [];
        const tA = outsA.filter(o => o.thriving).length, nA = outsA.length;
        const tB = outsB.filter(o => o.thriving).length, nB = outsB.length;
        const pA = nA > 0 ? Math.round(tA / nA * 100) : 0;
        const pB = nB > 0 ? Math.round(tB / nB * 100) : 0;
        const hyp = hypotheses[plant.id] ?? null;
        const diff = pA - pB;
        const actualOutcome: HypothesisValue = Math.abs(diff) < 5 ? "none" : diff > 0 ? "a" : "b";
        const { z, pValue, significant } = twoProportionZTest(tA, nA, tB, nB);

        const confirmed =
            hyp !== null &&
            hyp === actualOutcome &&
            significant; // or pValue < 0.05
        return { plant, tA, nA, tB, nB, pA, pB, hyp, actualOutcome, confirmed, ...twoProportionZTest(tA, nA, tB, nB) };
    });

    return (
        <div className="absolute inset-0 z-[200] rounded-xl flex flex-col bg-[#081000]" >
            {/* Header: A vs B */}
            <div className="px-5 pt-5 border-b border-garden-primary-opaque" >
                <div className="flex items-center justify-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-garden-primary-opaque text-sm font-black text-garden-sample-purple" >
                        <img src={`/${condIcon}`} className="w-4 h-4 object-contain" />
                        <span>A: {levelShort(levelA)}</span>
                    </div>
                    <span className="text-xs font-black tracking-widest text-garden-primary-dim">VS</span>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-garden-primary-opaque text-sm font-black text-garden-sample-beige">
                        <img src={`/${condIcon}`} className="w-4 h-4 object-contain" />
                        <span>B: {levelShort(levelB)}</span>
                    </div>
                </div>
                <div className="py-3 text-garden-primary-dim text-center font-semibold tracking-widest">RESULTS</div>
            </div>

            <div className="flex-1 overflow-y-auto history-scroll px-5 py-4 flex flex-col gap-4">
                {tooMuchRandomness && (
                    <div className="p-1 rounded-lg text-[11px] text-center leading-relaxed text-garden-primary-dim">
                        TOO MUCH RANDOMNESS <br />
                        {eventCount} random events occurred
                    </div>
                )}

                {results.map(({ plant, tA, nA, tB, nB, pA, pB, hyp, confirmed, pValue, significant }) => (
                    <div key={plant.id} className="p-3 rounded-lg" style={{ background: "rgba(183,210,109,0.04)", border: "1px solid rgba(183,210,109,0.1)" }}>
                        <div className="flex items-center gap-2 mb-2">
                            <img src={`/${plant.file}`} alt={plant.label} className="w-6 h-6 object-contain" />
                            <span className="text-xs font-bold text-garden-primary" >{plant.label}</span>
                            <div className="text-[11px] text-center py-1" style={{ color: "rgba(183,210,109,0.5)" }}>{nA} seed{nA !== 1 ? "s" : ""} per sample</div>
                        </div>
                        <div className="flex flex-row gap-5">
                            {/* Beta Graph */}
                            <div className="flex-1 flex-start">
                                <BetaGraph thrivingA={tA} totalA={nA} thrivingB={tB} totalB={nB} label="" />
                            </div>

                            {/* Hypothesis verdict */}
                            <div className="flex-1 flex-end">
                                <div className="flex flex-col gap-2">

                                    {/* Hypothesis */}
                                    <span className="text-xs font-black px-2 py-0.5 rounded text-center text-garden-primary">
                                        Hypothesis: {hyp === "a" ? "Sample A better" : hyp === "b" ? "Sample B better" : "No difference"}
                                    </span>

                                    {/* Confirmed / Not confirmed */}
                                    {hyp !== null && (
                                        <div className={`flex items-center justify-between px-2 py-1.5 rounded ${confirmed ? "bg-garden-primary-secondary" : "bg-red-500/5"}`}>
                                            <span className={`text-xs font-black ${confirmed ? "text-garden-primary" : "text-garden-danger"}`}>
                                                {confirmed ? "Confirmed" : "Not confirmed"}
                                            </span>
                                            <span className="text-xs text-garden-primary-dim-2">
                                                {significant ? "Significant" : "Not significant"} (p={pValue.toFixed(2)})
                                            </span>
                                        </div>
                                    )}

                                    {/* Sample stats */}
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="text-center p-2 rounded bg-garden-primary-opaque">
                                            <div className="text-xs tracking-widest uppercase mb-0.5 text-garden-primary-dim-2">Sample A</div>
                                            <div className="text-base font-black text-garden-sample-purple">{tA}/{nA} = {pA}%</div>
                                        </div>

                                        <div className="text-center p-2 rounded bg-garden-primary-opaque">
                                            <div className="text-xs tracking-widest uppercase mb-0.5 text-garden-warning-opaque">Sample B</div>
                                            <div className="text-base font-black text-garden-sample-beige">{tB}/{nB} = {pB}%</div>
                                        </div>
                                    </div>

                                    {/* Comparison */}
                                    {nA > 0 && nB > 0 && (
                                        <div className={`text-center mt-2 text-[11px] ${pA === pB ? "text-garden-primary" : pA > pB ? "text-garden-sample-purple" : "text-garden-sample-beige"
                                            }`}>
                                            {pA === pB ? "No difference" : `Sample ${pA > pB ? "A" : "B"} thrived ${Math.abs(pA - pB)}% more`}
                                        </div>
                                    )}

                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Conditional small sample warning */}
            {results.some(({ nA, nB, significant, pValue }) => !significant && pValue > 0.1 && (nA < 10 || nB < 10)) && (
                <div
                    className="px-5 pt-2 text-center text-[11px] rounded-lg mt-2 text-garden-primary-dim border-t border-garden-primary-opaque"
                >
                    Your sample was too small to confirm the effect.
                </div>
            )}


            <div className="px-5 py-4  flex justify-center">
                <button
                    onClick={onSave}
                    className="w-50 py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all text-garden-secondary bg-garden-primary cursor-pointer"
                >
                    Save Results
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
    const [showExpected, setShowExpected] = useState(false);
    const [sun, setSun] = useState<ConditionLevel>(1);
    const [water, setWater] = useState<ConditionLevel>(1);
    const [fertilizer, setFertilizer] = useState<ConditionLevel>(1);

    const [showSetupModal, setShowSetupModal] = useState(false);
    const [testedCondition, setTestedCondition] = useState<TestedCondition>(null);
    const [levelA, setLevelA] = useState<ConditionLevel>(0);
    const [levelB, setLevelB] = useState<ConditionLevel>(2);
    const [sharedSun, setSharedSun] = useState<ConditionLevel>(1);
    const [sharedWater, setSharedWater] = useState<ConditionLevel>(1);
    const [sharedFertilizer, setSharedFertilizer] = useState<ConditionLevel>(1);
    const [hypotheses, setHypotheses] = useState<Record<string, Hypothesis>>({});

    const [showPlants, setShowPlants] = useState(true);
    const [seedCounts, setSeedCounts] = useState<Record<string, number>>(Object.fromEntries(PLANTS.map(p => [p.id, 0])));
    const [simulated, setSimulated] = useState(false);
    const [positionSeed] = useState(() => Math.floor(Math.random() * 99999));
    const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);

    const [randomEvent, setRandomEvent] = useState<RandomEvent>(null);
    const [eventAnim, setEventAnim] = useState(false);
    const [eventLog, setEventLog] = useState<RandomEvent[]>([]);

    const [outcomes, setOutcomes] = useState<Record<string, PlantOutcome[]>>({});
    const [outcomesA, setOutcomesA] = useState<Record<string, PlantOutcome[]>>({});
    const [outcomesB, setOutcomesB] = useState<Record<string, PlantOutcome[]>>({});

    const [showHistory, setShowHistory] = useState(false);
    const [showResultsModal, setShowResultsModal] = useState(false);
    const [experimentHistory, setExperimentHistory] = useState<ExperimentRecord[]>([]);


    const gardenRef = useRef<HTMLDivElement>(null);
    const randomnessEnabled = experimentRunning ? true : exploreRandomnessEnabled;
    const selectedPlants = PLANTS.filter(p => (seedCounts[p.id] || 0) > 0).map(p => ({ plant: p, count: seedCounts[p.id] }));
    const totalSeeds = Object.values(seedCounts).reduce((a, b) => a + b, 0);

    const condA = useCallback(() => ({
        sun: testedCondition === "sun" ? levelA : sharedSun,
        water: testedCondition === "water" ? levelA : sharedWater,
        fertilizer: testedCondition === "fertilizer" ? levelA : sharedFertilizer,
    }), [testedCondition, levelA, sharedSun, sharedWater, sharedFertilizer]);

    const condB = useCallback(() => ({
        sun: testedCondition === "sun" ? levelB : sharedSun,
        water: testedCondition === "water" ? levelB : sharedWater,
        fertilizer: testedCondition === "fertilizer" ? levelB : sharedFertilizer,
    }), [testedCondition, levelB, sharedSun, sharedWater, sharedFertilizer]);

    // Drag
    const dragRef = useRef<{ sample: "explore" | "A" | "B"; plantId: string; index: number; startMouseX: number; startMouseY: number; startX: number; startY: number } | null>(null);

    const handlePlantMouseDown = useCallback((e: React.MouseEvent, sample: "explore" | "A" | "B", plantId: string, index: number, cx: number, cy: number) => {
        e.preventDefault(); e.stopPropagation();
        dragRef.current = { sample, plantId, index, startMouseX: e.clientX, startMouseY: e.clientY, startX: cx, startY: cy };
    }, []);

    const handlePlantTouchStart = useCallback((e: React.TouchEvent, sample: "explore" | "A" | "B", plantId: string, index: number, cx: number, cy: number) => {
        e.stopPropagation();
        const t = e.touches[0];
        dragRef.current = { sample, plantId, index, startMouseX: t.clientX, startMouseY: t.clientY, startX: cx, startY: cy };
    }, []);

    useEffect(() => {
        const move = (cx: number, cy: number) => {
            if (!dragRef.current || !gardenRef.current) return;
            const rect = gardenRef.current.getBoundingClientRect();
            const { sample, plantId, index, startMouseX, startMouseY, startX, startY } = dragRef.current;
            const dx = ((cx - startMouseX) / rect.width) * 100, dy = ((cy - startMouseY) / rect.height) * 100;
            let nx = Math.max(2, Math.min(98, startX + dx));
            const ny = Math.max(2, Math.min(96, startY + dy));
            if (sample === "A") nx = Math.max(2, Math.min(47, nx));
            if (sample === "B") nx = Math.max(53, Math.min(98, nx));
            const setter = sample === "A" ? setOutcomesA : sample === "B" ? setOutcomesB : setOutcomes;
            setter(prev => { const a = [...(prev[plantId] || [])]; if (a[index]) a[index] = { ...a[index], x: nx, y: ny, zIndex: 100 }; return { ...prev, [plantId]: a }; });
        };
        const up = () => {
            if (!dragRef.current) return;
            const { sample, plantId, index } = dragRef.current;
            const setter = sample === "A" ? setOutcomesA : sample === "B" ? setOutcomesB : setOutcomes;
            setter(prev => { const a = [...(prev[plantId] || [])]; if (a[index]) a[index] = { ...a[index], zIndex: Math.floor(Math.random() * 60) }; return { ...prev, [plantId]: a }; });
            dragRef.current = null;
        };
        const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
        const tm = (e: TouchEvent) => { e.preventDefault(); move(e.touches[0].clientX, e.touches[0].clientY); };
        window.addEventListener("mousemove", mm); window.addEventListener("mouseup", up);
        window.addEventListener("touchmove", tm, { passive: false }); window.addEventListener("touchend", up);
        return () => { window.removeEventListener("mousemove", mm); window.removeEventListener("mouseup", up); window.removeEventListener("touchmove", tm); window.removeEventListener("touchend", up); };
    }, []);

    // Build outcomes helper
    const buildOuts = useCallback((s: ConditionLevel, w: ConditionLevel, f: ConditionLevel, evts: RandomEvent[], xMin: number, xMax: number, offset: number): Record<string, PlantOutcome[]> => {
        const out: Record<string, PlantOutcome[]> = {};
        PLANTS.forEach((plant, pi) => {
            const count = seedCounts[plant.id] || 0;
            const prob = calcSuccessProb(plant, s, w, f, evts);
            out[plant.id] = generatePlantPositions(count, positionSeed + pi * 1000 + offset, xMin, xMax).map(pos => {
                const br = Math.random(), thriving = br < prob;
                return { thriving, baseRoll: br, growDelay: Math.round(br * 1000000), planted: false, isDead: prob <= 0, opacity: thriving ? 0.85 + (1 - br) * 0.13 : 0.22 + br * 0.12, scale: thriving ? 0.7 + (1 - br) * 0.5 : 0.35 + br * 0.25, flip: Math.random() < 0.5, ...pos };
            });
        });
        return out;
    }, [seedCounts, positionSeed]);

    const flipPlanted = (setter: React.Dispatch<React.SetStateAction<Record<string, PlantOutcome[]>>>) => {
        requestAnimationFrame(() => requestAnimationFrame(() => {
            setter(prev => { const n: Record<string, PlantOutcome[]> = {}; PLANTS.forEach(p => { n[p.id] = (prev[p.id] || []).map(o => o.planted ? o : { ...o, planted: true }); }); return n; });
        }));
    };

    const simulateExplore = useCallback(() => {
        setShowPlants(false);
        const evts = randomnessEnabled ? eventLog : [];
        const o = buildOuts(sun, water, fertilizer, evts, 4, 92, 0);
        setOutcomes(o); setSimulated(true); flipPlanted(setOutcomes);
    }, [sun, water, fertilizer, randomnessEnabled, eventLog, buildOuts]);

    const simulateExperiment = useCallback(() => {
        setShowPlants(false);
        const cA = condA(), cB = condB();
        const oA = buildOuts(cA.sun, cA.water, cA.fertilizer, eventLog, 2, 47, 100);
        const oB = buildOuts(cB.sun, cB.water, cB.fertilizer, eventLog, 53, 98, 200);
        setOutcomesA(oA); setOutcomesB(oB); setSimulated(true);
        flipPlanted(setOutcomesA); flipPlanted(setOutcomesB);
    }, [condA, condB, eventLog, buildOuts]);

    useEffect(() => { if (simulated && !experimentRunning) simulateExplore(); }, [sun, water, fertilizer, simulated]); // eslint-disable-line

    useEffect(() => {
        if (simulated && !experimentRunning) {  setTimeout(() => simulateExplore(), 0); }
    }, [seedCounts, simulated]); // eslint-disable-line

    const triggerEvent = () => {
        const evts: RandomEvent[] = ["storm", "sunflare", "pests", "drought"];
        const evt = evts[Math.floor(Math.random() * evts.length)];
        setRandomEvent(evt); const nl = [...eventLog, evt]; setEventLog(nl);
        setEventAnim(true); setTimeout(() => setEventAnim(false), 2000);
        if (!simulated) return;
        const reEval = (prev: Record<string, PlantOutcome[]>, s: ConditionLevel, w: ConditionLevel, f: ConditionLevel) => {
            const n: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach(plant => {
                const prob = calcSuccessProb(plant, s, w, f, nl);
                n[plant.id] = (prev[plant.id] || []).map(o => { const t = o.baseRoll < prob; return { ...o, thriving: t, opacity: t ? 0.85 + (1 - o.baseRoll) * 0.13 : 0.22 + o.baseRoll * 0.12, scale: t ? 0.7 + (1 - o.baseRoll) * 0.5 : 0.35 + o.baseRoll * 0.25 }; });
            });
            return n;
        };
        if (experimentRunning) { const cA = condA(), cB = condB(); setOutcomesA(p => reEval(p, cA.sun, cA.water, cA.fertilizer)); setOutcomesB(p => reEval(p, cB.sun, cB.water, cB.fertilizer)); }
        else setOutcomes(p => reEval(p, sun, water, fertilizer));
    };

    const openSetup = () => {
        setOutcomes({}); setOutcomesA({}); setOutcomesB({});
        setShowPlants(false); setSimulated(false); setEventLog([]); setRandomEvent(null);
        setShowSetupModal(true);
    };

    const runExperiment = () => { setShowSetupModal(false); setMode("experiment"); simulateExperiment(); };
    const endExperiment = () => setShowResultsModal(true);

    const reset = () => {
    if (simulated) {
        const record: ExperimentRecord = {
            id: experimentHistory.length + 1,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            testedCondition,
            levelA, levelB,
            events: eventLog,
            results: Object.fromEntries(
    PLANTS.map(p => [
        p.id,
        {
            thrivingA: (outcomesA[p.id] || []).filter(o => o.thriving).length,
            totalA: (outcomesA[p.id] || []).length,
            thrivingB: (outcomesB[p.id] || []).filter(o => o.thriving).length,
            totalB: (outcomesB[p.id] || []).length,
        }
    ])
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
    setShowResultsModal(false);
    setShowSetupModal(false);
    setShowExpected(false);
    setOutcomesA({});
    setOutcomesB({});
    setTestedCondition(null);
    setLevelA(0);
    setLevelB(2);
    setSharedSun(1);
    setSharedWater(1);
    setSharedFertilizer(1);
    setHypotheses({});
    setSelectedPlantId(null);
};

    // Stats
    const stats = PLANTS.map(plant => {
        if (experimentRunning) {
            const oA = outcomesA[plant.id] || [], oB = outcomesB[plant.id] || [];
            const tA = oA.filter(o => o.thriving).length, nA = oA.length;
            const tB = oB.filter(o => o.thriving).length, nB = oB.length;
            return { plant, tA, nA, tB, nB, pA: nA > 0 ? Math.round(tA / nA * 100) : 0, pB: nB > 0 ? Math.round(tB / nB * 100) : 0, total: nA, thriving: tA, expectedProb: 0, observedProb: 0 };
        }
        const outs = outcomes[plant.id] || [];
        const total = outs.length, thriving = outs.filter(o => o.thriving).length;
        return { plant, total, thriving, tA: 0, nA: 0, tB: 0, nB: 0, pA: 0, pB: 0, expectedProb: Math.round(calcBaseProb(plant, sun, water, fertilizer) * 100), observedProb: Math.round(calcSuccessProb(plant, sun, water, fertilizer, randomnessEnabled ? eventLog : []) * 100) };
    });
    const sidebarPlants = experimentRunning ? stats.filter(s => s.nA > 0) : stats;
    const sel = selectedPlantId ? stats.find(s => s.plant.id === selectedPlantId) : null;
    const isDragging = dragRef.current !== null;
    const condIcon = testedCondition === "sun" ? "sun.png" : testedCondition === "water" ? "water.png" : "fertilizer.png";

    const EC: Record<string, string> = { storm: "rgba(80,120,255,0.25)", sunflare: "rgba(255,220,60,0.25)", pests: "rgba(180,80,20,0.25)", drought: "rgba(200,140,0,0.25)" };
    const EL: Record<string, string> = { storm: "STORM!", sunflare: "SUN FLARE!", pests: "PEST ATTACK!", drought: "DROUGHT!" };

    const renderPlants = (sample: "explore" | "A" | "B", outs: Record<string, PlantOutcome[]>) =>
        PLANTS.map(plant => (outs[plant.id] || []).map((o, i) => {
            const dragging = dragRef.current?.plantId === plant.id && dragRef.current?.index === i && dragRef.current?.sample === sample;
            return (
                <div key={`${sample}-${plant.id}-${i}`}
                    onMouseDown={!o.isDead ? e => handlePlantMouseDown(e, sample, plant.id, i, o.x, o.y) : undefined}
                    onTouchStart={!o.isDead ? e => handlePlantTouchStart(e, sample, plant.id, i, o.x, o.y) : undefined}
                    style={{ position: "absolute", left: `${o.x}%`, top: `${o.y}%`, zIndex: dragging ? 200 : o.zIndex, transform: `translate(-50%,-50%) scale(${!o.planted ? 0 : o.scale}) rotate(${o.rotation}deg)`, opacity: !o.planted ? 0 : o.opacity, transition: dragging ? "transform 0.1s ease" : "transform 70s cubic-bezier(0.34,1.56,0.64,1), opacity 50s cubic-bezier(0.34,1.56,0.64,1)", cursor: dragging ? "grabbing" : "grab", userSelect: "none", touchAction: "none" }}>
                    <img draggable={false} src={`/${plant.file}`} alt={plant.label}
                        style={{ width: "clamp(28px,4vw,60px)", height: "clamp(28px,4vw,60px)", objectFit: "contain", display: "block", transform: o.flip ? "scaleX(-1)" : undefined, filter: o.thriving ? (dragging ? "drop-shadow(0 4px 12px rgba(183,210,109,0.8))" : "") : `grayscale(80%) brightness(0.5) blur(0.5px)`, transition: "filter 0.5s ease", pointerEvents: "none" }} />
                    {dragging && <div style={{ position: "absolute", inset: "-4px", borderRadius: "50%", border: `2px dashed ${o.thriving ? "rgba(183,210,109,0.7)" : "rgba(255,100,100,0.5)"}`, animation: "spin 3s linear infinite", pointerEvents: "none" }} />}
                </div>
            );
        }));

    return (
        <div className="min-h-screen overflow-x-hidden garden-primary bg-[#020100]">
            <header className="text-center px-4 pt-6 pb-3" style={{ borderBottom: "1px solid rgba(183,210,109,0.1)" }}>
                <h1 className="text-3xl md:text-4xl font-black uppercase tracking-widest m-0 bg-garden-primary" style={{ WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Grow Your Garden</h1>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_260px] md:grid-rows-[auto_1fr] gap-3 px-4 py-3 max-w-[1280px] mx-auto" style={{ maxHeight: "calc(100vh - 150px)" }}>

                {/* ── Top bar ── */}
                <section className="p-3 md:px-4 rounded-xl md:col-start-2 md:row-start-1" style={{ background: "rgba(183,210,109,0.05)", border: "1px solid rgba(183,210,109,0.1)" }}>
                    {!experimentRunning ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center">
                            <ConditionControl icon="sun.png" label="Sunlight" value={sun} onChange={setSun} />
                            <ConditionControl icon="water.png" label="Water" value={water} onChange={setWater} />
                            <ConditionControl icon="fertilizer.png" label="Fertilizer" value={fertilizer} onChange={setFertilizer} />
                            <div className="flex flex-col gap-1 mx-auto lg:ml-2 w-35">
                                <button onClick={() => { setExploreRandomnessEnabled(v => !v); if (randomnessEnabled) setRandomEvent(null); }}
                                    className="py-2 px-3 rounded-lg text-xs font-bold tracking-wide uppercase whitespace-nowrap transition-all cursor-pointer"
                                    style={{ background: "rgba(255,204,68,0.1)", border: "1.5px solid rgba(255,204,68,0.1)", color: "#f0d5a8" }}>
                                    {exploreRandomnessEnabled ? "RANDOMNESS ON" : "RANDOMNESS OFF"}
                                </button>
                                <button onClick={() => { if (exploreRandomnessEnabled) triggerEvent(); }} disabled={!exploreRandomnessEnabled}
                                    className="py-1.5 px-3 rounded-lg text-[11px] font-bold tracking-wide uppercase transition-all"
                                    style={{ background: exploreRandomnessEnabled ? "rgba(255,204,68,0.1)" : "rgba(255,204,68,0.05)", border: "1.5px solid rgba(255,204,68,0.1)", color: exploreRandomnessEnabled ? "#f0d5a8" : "rgba(255,204,68,0.4)", cursor: exploreRandomnessEnabled ? "pointer" : "not-allowed", opacity: exploreRandomnessEnabled ? 1 : 0.5 }}>
                                    trigger event
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-start text-center">
                            {/* Sample A */}
                            <div className="p-2.5 rounded-lg " style={{ background: "rgba(183,210,109,0.05)", border: "1px solid rgba(183,210,109,0.15)" }}>

                                <div className="text-[10px] font-black tracking-[0.15em] uppercase mb-2" style={{ color: "#b1a8f0" }}>Sample A</div>
                                {testedCondition && <div className="flex items-center gap-1.5 mb-1.5 justify-center"><img src={`/${condIcon}`} className="w-4 h-4 object-contain" /><span className="text-xs font-bold" style={{ color: "#b1a8f0" }}>{levelLabel(levelA)}</span></div>}
                            </div>

                            {/* Shared / trigger */}
                            <div className="flex flex-col items-center gap-3 px-1 pt-1">

                                <button onClick={triggerEvent} className="py-1.5 px-2 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap transition-all cursor-pointer" style={{ background: "rgba(255,204,68,0.1)", border: "1.5px solid rgba(255,204,68,0.15)", color: "#f0d5a8" }}>
                                    random event
                                </button>
                                <div className="flex flex-row gap-2">
                                    {[{ k: "sun", ic: "sun.png", v: sharedSun }, { k: "water", ic: "water.png", v: sharedWater }, { k: "fertilizer", ic: "fertilizer.png", v: sharedFertilizer }].filter(c => c.k !== testedCondition).map(({ k, ic, v }) => (
                                        <div key={k} className="flex items-center gap-1"><img src={`/${ic}`} className="w-3 h-3 object-contain " /><span className="text-[12px]" style={{ color: "rgba(240,213,168)" }}>{levelShort(v)}</span></div>
                                    ))}
                                </div>


                            </div>
                            {/* Sample B */}
                            <div className="p-2.5 rounded-lg " style={{ background: "rgba(240,213,168,0.05)", border: "1px solid rgba(240,213,168,0.1)" }}>
                                <div className="text-[10px] font-black tracking-[0.15em] uppercase mb-1.5 justify-center" style={{ color: "#f0d5a8" }}>Sample B</div>
                                {testedCondition && <div className="flex items-center gap-1.5 mb-2 justify-center ">
                                    <img src={`/${condIcon}`} className="w-4 h-4 object-contain" />
                                    <span className="text-xs font-bold" style={{ color: "#f0d5a8" }}>{levelLabel(levelB)}</span>
                                </div>}

                            </div>
                        </div>
                    )}
                </section>

                {/* ── Left sidebar ── */}
                <aside className="flex flex-col gap-2 p-3 rounded-xl md:col-start-1 md:row-start-1 md:row-span-2" style={{ border: "1px solid rgba(183,210,109,0.1)" }}>
                    <div className="flex gap-2">
                        <button onClick={reset} className="flex-1 py-2 rounded-lg text-xs text-garden-primary font-bold tracking-widest uppercase cursor-pointer transition-all" style={{ background: "rgba(183,210,109,0.1)", border: "1.5px solid rgba(183,210,109,0.1)" }}>
                            {simulated ? "RESET" : "EXPLORE"}
                        </button>
                        <button onClick={() => experimentRunning ? endExperiment() : openSetup()} className="flex-1 py-2 rounded-lg text-xs font-bold tracking-widests uppercase cursor-pointer transition-all"
                            style={{ background: experimentRunning ? "rgba(255,159,66,0.1)" : "rgba(242,167,184,0.1)", border: `1.5px solid ${experimentRunning ? "rgba(255,159,66,0.1)" : "rgba(255,204,68,0.1)"}`, color: experimentRunning ? "#ff9f42" : "#f0d5a8" }}>
                            {experimentRunning ? "END EXPERIMENT" : "NEW EXPERIMENT"}
                        </button>
                    </div>
                    <div className="text-garden-primary text-xs font-bold tracking-[0.2em] uppercase flex justify-center items-center pt-3">SELECT SEEDS</div>
                    <div className="overflow-y-auto sidebar-scroll max-h-[200px] md:max-h-none">
                        {PLANTS.map(plant => (
                            <SeedSelector key={plant.id} plant={plant} count={seedCounts[plant.id]}
                                onChange={v => !experimentRunning && setSeedCounts(prev => ({ ...prev, [plant.id]: v }))}
                                sun={experimentRunning ? sharedSun : sun} water={experimentRunning ? sharedWater : water} fertilizer={experimentRunning ? sharedFertilizer : fertilizer}
                                locked={experimentRunning}
                                experimentRunning={experimentRunning} />
                        ))}
                    </div>
                </aside>

                {/* ── Garden plot ── */}
                <div className="relative md:col-start-2 md:row-start-2">
                    <div ref={gardenRef} className="w-full relative rounded-xl overflow-hidden"
                        style={{ paddingBottom: "70%", background: "linear-gradient(160deg, #3d1f00 0%, #5a2d00 40%, #3a1800 100%)", border: "2px solid rgba(120,80,20,0.6)", boxShadow: "0 0 40px rgba(80,40,0,0.5), inset 0 0 60px rgba(0,0,0,0.4)", cursor: isDragging ? "grabbing" : "default" }}>

                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "radial-gradient(ellipse at 30% 60%, rgba(90,50,10,0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(60,30,5,0.4) 0%, transparent 50%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)" }} />

                        {/* Fence */}
                        {experimentRunning && (
                            <div className="absolute inset-y-0 pointer-events-none z-[50]" style={{ left: "50%", transform: "translateX(-50%)", width: "4px" }}>
                                <div className="h-full" style={{ background: "repeating-linear-gradient(to bottom, rgba(183,210,109,0.5) 0px, rgba(183,210,109,0.5) 8px, transparent 8px, transparent 14px)", width: "2px", margin: "0 auto" }} />

                            </div>
                        )}

                        {/* Event overlay */}
                        {eventAnim && randomEvent && (
                            <div className="absolute inset-0 z-[10000] rounded-xl pointer-events-none flex flex-col items-center justify-center" style={{ background: EC[randomEvent], animation: "eventFlash 3s ease-out forwards" }}>
                                <img src={randomEvent === "storm" ? "/storm.png" : randomEvent === "sunflare" ? "/sun.png" : randomEvent === "drought" ? "/drought.png" : "/pest.png"} alt={randomEvent} className="object-contain" style={{ width: "clamp(70px,10vw,140px)", height: "clamp(70px,10vw,140px)", filter: "drop-shadow(0 0 25px rgba(255,255,255,0.8))", animation: "pulse 0.8s ease-in-out infinite alternate" }} />
                                <span style={{ fontSize: "clamp(1rem,3vw,2rem)", fontWeight: 900, letterSpacing: "0.2em", color: "rgba(255,200,0)", textShadow: "0 0 20px rgba(255,255,255,0.8)", animation: "pulse 0.8s ease-in-out infinite alternate" }}>{EL[randomEvent]}</span>
                            </div>
                        )}

                        {/* Plants */}
                        {experimentRunning ? <>{renderPlants("A", outcomesA)}{renderPlants("B", outcomesB)}</> : renderPlants("explore", outcomes)}

                        {/* Intro */}
                        {showPlants && !showSetupModal && (
                            <div className="absolute inset-0 flex justify-center items-center ">
                                <div className="w-full h-full p-[30px_60px_30px]">

                                    {/* Label */}
                                    <div className="mb-1.5 text-center">
                                        <span className="text-[10px] font-black tracking-widest uppercase text-garden-primary-dim-2">
                                            Garden Lab
                                        </span>
                                    </div>

                                    {/* Heading */}
                                    <h3 className="mb-7 text-center text-[clamp(1.2rem,4vw,1.7rem)] font-extrabold leading-[1.15] bg-garden-primary bg-clip-text text-transparent">
                                        Can you trust your data?
                                    </h3>

                                    {/* Image */}
                                    <img
                                        src="/orchid.png"
                                        alt="Description"
                                        className="mx-auto my-5 max-w-[28%] h-auto block "
                                    />

                                    {/* Description */}
                                    <div className="mb-5 text-[13.5px] leading-8 text-center font-medium text-garden-primary">
                                        Each plant you put in the ground is one observation. Is it thriving?
                                        <br />
                                        What does that tell you about the species?
                                        <br />
                                        <InfoButton
                                            text={`
    Well, think of it like surveying one person: useful, but one answer rarely tells the full story.
    <br /><br />
    Plant more seeds and you'll get a better idea of how well a species does in a given environment. That's statistical power in action.
    <br /><br />

    But... real life isn't a controlled lab. Sometimes unexpected things mess with your results. Toggle randomness to trigger events and watch what happens.
  `}
                                        />


                                    </div>

                                    {/* Button */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={simulateExplore}
                                            disabled={totalSeeds === 0}
                                            className={`pointer-events-auto w-[150px] py-3 rounded-xl text-xs font-black tracking-widest uppercase transition-all
            bg-garden-primary text-garden-secondary
            ${totalSeeds === 0 ? "opacity-20 cursor-not-allowed" : "opacity-90 cursor-pointer"}`}
                                        >
                                            Ready to grow?
                                        </button>
                                    </div>

                                </div>
                            </div>
                        )}

                        {showSetupModal && <ExperimentSetupModal seedCounts={seedCounts} testedCondition={testedCondition} setTestedCondition={setTestedCondition} levelA={levelA} setLevelA={setLevelA} levelB={levelB} setLevelB={setLevelB} sharedSun={sharedSun} setSharedSun={setSharedSun} sharedWater={sharedWater} setSharedWater={setSharedWater} sharedFertilizer={sharedFertilizer} setSharedFertilizer={setSharedFertilizer} hypotheses={hypotheses} setHypothesis={(plantId, v) => setHypotheses(prev => ({ ...prev, [plantId]: v }))} onRun={runExperiment} onCancel={reset} />}

                        {showResultsModal && <ResultsModal selectedPlants={selectedPlants} outcomesA={outcomesA} outcomesB={outcomesB} hypotheses={hypotheses} testedCondition={testedCondition} levelA={levelA} levelB={levelB} eventLog={eventLog} onSave={reset} />}

                        {showHistory && (
    <div className="absolute inset-0 z-[200] rounded-xl flex flex-col bg-[#081000]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-garden-primary-opaque">
            <div className="flex items-center">
                <span className="text-xs text-garden-primary font-black tracking-[0.2em] uppercase">Experiment History</span>
            </div>
            <button onClick={() => setShowHistory(false)} className="w-6 h-6 rounded flex items-center justify-center text-sm text-red-300 cursor-pointer">✕</button>
        </div>

        <div className="history-scroll" style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
            {experimentHistory.length === 0 ? (
                <div className="flex items-center justify-center h-full text-[10px] tracking-widest uppercase"
                    style={{ color: "rgba(138, 158, 85,0.3)" }}>
                    No experiments yet
                </div>
            ) : (() => {
                const activePlants = PLANTS.filter(p =>
                    experimentHistory.some(exp => (exp.results[p.id]?.totalA ?? 0) > 0)
                );

                const W_EXP = 88;
                const W_TESTED = 90;
                const W_EVENT = 100;
                const W_PLANT = 80;

                const DIVIDER_SHADOW = "inset -1px 0 0 rgba(138, 158, 85,0.15)";
                const EVENT_DIVIDER = "inset -1px 0 0 rgba(138, 158, 85,0.25)";
                const HEADER_BOTTOM = "inset 0 -2px 0 rgba(138, 158, 85,0.2)";

                const stickyHead = (left: number, extra?: React.CSSProperties): React.CSSProperties => ({
                    position: "sticky", top: 0, left, zIndex: 4,
                    background: "rgba(8,16,0,0.99)", ...extra,
                });

                const stickyBody = (left: number, bg: string, extra?: React.CSSProperties): React.CSSProperties => ({
                    position: "sticky", left, zIndex: 2, background: bg, ...extra,
                });

                const condIcon = (c: TestedCondition) =>
                    c === "sun" ? "/sun.png" : c === "water" ? "/water.png" : "/fertilizer.png";

                return (
                    <table style={{
                        borderCollapse: "collapse",
                        fontSize: "10px",
                        tableLayout: "fixed",
                        width: "100%",
                        minWidth: W_EXP + W_TESTED + W_EVENT + activePlants.length * W_PLANT,
                    }}>
                        <thead>
                            <tr>
                                {/* Exp ID */}
                                <th style={stickyHead(0, { width: W_EXP, minWidth: W_EXP, padding: "12px 20px 10px", textAlign: "left", verticalAlign: "bottom", boxShadow: `${DIVIDER_SHADOW}, ${HEADER_BOTTOM}` })}>
                                    <span style={{ color: "rgba(138, 158, 85,0.5)", fontWeight: 700, letterSpacing: "0.15em", fontSize: "10px", textTransform: "uppercase" }}>
                                        {experimentHistory.length} total
                                    </span>
                                </th>

                                {/* Tested condition */}
                                <th style={stickyHead(W_EXP, { width: W_TESTED, minWidth: W_TESTED, padding: "12px 4px 10px", textAlign: "center", verticalAlign: "bottom", boxShadow: `${DIVIDER_SHADOW}, ${HEADER_BOTTOM}` })}>
                                    <span style={{ color: "rgba(138, 158, 85,0.4)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                                        A vs B
                                    </span>
                                </th>

                                {/* Random event */}
                                <th style={stickyHead(W_EXP + W_TESTED, { width: W_EVENT, minWidth: W_EVENT, padding: "12px 4px 10px", textAlign: "center", verticalAlign: "bottom", boxShadow: `${EVENT_DIVIDER}, ${HEADER_BOTTOM}` })}>
                                    <span style={{ color: "rgba(138, 158, 85,0.4)", fontWeight: 700, fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                                        RANDOM<br />EVENT
                                    </span>
                                </th>

                                {/* Per-plant headers */}
                                {activePlants.map(plant => (
                                    <th key={plant.id} style={{ position: "sticky", top: 0, zIndex: 3, background: "rgba(8,16,0,0.99)", width: W_PLANT, minWidth: W_PLANT, padding: "8px 4px 10px", textAlign: "center", verticalAlign: "bottom", borderLeft: "1px solid rgba(138, 158, 85,0.06)", boxShadow: HEADER_BOTTOM }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                                            <img src={`/${plant.file}`} style={{ width: 30, height: 30, objectFit: "contain" }} />
                                            <span style={{ color: "rgba(138, 158, 85,0.45)", fontSize: "10px", lineHeight: 1.2, textAlign: "center" }}>{plant.label}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {experimentHistory.map((exp, ei) => {
                                const rowBg = ei % 2 === 0 ? "rgba(138, 158, 85,0.025)" : "transparent";
                                const stickyBg = ei % 2 === 0 ? "rgba(12,22,4,0.99)" : "rgba(8,16,0,0.99)";
                                return (
                                    <tr key={exp.id} style={{ background: rowBg, borderBottom: "1px solid rgba(138, 158, 85,0.08)" }}>

                                        {/* Exp ID + timestamp */}
                                        <td style={stickyBody(0, stickyBg, { width: W_EXP, padding: "8px 20px", verticalAlign: "middle", boxShadow: DIVIDER_SHADOW })}>
                                            <div style={{ color: "#f0d5a8", fontWeight: 900, fontSize: "11px", letterSpacing: "0.08em" }}>EXP {exp.id}</div>
                                            <div style={{ color: "rgba(138, 158, 85,0.38)", fontSize: "10px", marginTop: "2px" }}>{exp.timestamp}</div>
                                        </td>

                                        {/* Tested condition: icon + A level vs B level */}
                                        <td style={stickyBody(W_EXP, stickyBg, { width: W_TESTED, padding: "8px 4px", textAlign: "center", verticalAlign: "middle", boxShadow: DIVIDER_SHADOW })}>
                                            {exp.testedCondition ? (
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                                    
                                                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "center" }}>
                                                        <span style={{ color: "#b1a8f0", fontWeight: 700, fontSize: "11px" }}>{["Low", "Medium", "High"][exp.levelA]}</span>
                                                        <img src={condIcon(exp.testedCondition)} style={{ width: 14, height: 14, objectFit: "contain" }} />
                                                        <span style={{ color: "#f0d5a8", fontWeight: 700, fontSize: "11px" }}>{["Low", "Medium", "High"][exp.levelB]}</span>
                                                    </div>

                                                    
                                                </div>
                                            ) : (
                                                <span style={{ color: "rgba(138, 158, 85,0.18)", fontSize: "11px" }}>—</span>
                                            )}
                                        </td>

                                        {/* Random events */}
                                        <td style={stickyBody(W_EXP + W_TESTED, stickyBg, { width: W_EVENT, padding: "8px 4px", textAlign: "center", verticalAlign: "middle", boxShadow: EVENT_DIVIDER })}>
                                            {(() => {
                                                const counts = {} as Record<string, number>;
                                                exp.events.forEach(e => { if (e) counts[e] = (counts[e] || 0) + 1; });
                                                const entries = Object.entries(counts);
                                                return entries.length === 0 ? (
                                                    <span style={{ color: "rgba(138, 158, 85,0.18)", fontSize: "11px" }}>—</span>
                                                ) : (
                                                    <div style={{ display: "flex", gap: "4px", justifyContent: "center", flexWrap: "wrap" }}>
                                                        {entries.map(([evt, count]) => (
                                                            <div key={evt} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                                                                <img src={evt === "storm" ? "/storm.png" : evt === "sunflare" ? "/sun.png" : evt === "drought" ? "/drought.png" : "/pest.png"} style={{ width: 18, height: 18, objectFit: "contain" }} />
                                                                <span style={{ color: "#8a9e55", fontSize: "10px", fontWeight: 700 }}>{count}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })()}
                                        </td>

                                        {/* Per-plant A% vs B% */}
                                        {activePlants.map(plant => {
                                            const r = exp.results[plant.id];
                                            if (!r || r.totalA === 0) return (
                                                <td key={plant.id} style={{ width: W_PLANT, padding: "8px 4px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid rgba(138, 158, 85,0.06)", color: "rgba(138, 158, 85,0.15)", fontSize: "11px" }}>—</td>
                                            );
                                            const pA = Math.round(r.thrivingA / r.totalA * 100);
                                            const pB = r.totalB > 0 ? Math.round(r.thrivingB / r.totalB * 100) : 0;
                                            return (
                                                <td key={plant.id} style={{ width: W_PLANT, padding: "6px 4px", textAlign: "center", verticalAlign: "middle", borderLeft: "1px solid rgba(138, 158, 85,0.06)" }}>
                                                    <div style={{ color: "#b1a8f0", fontWeight: 900, fontSize: "11px" }}>{pA}%</div>
                                                    <div style={{ color: "rgba(138,158,85,0.5)", fontSize: "10px", margin: "1px 0" }}>vs</div>
                                                    <div style={{ color: "#f0d5a8", fontWeight: 900, fontSize: "11px" }}>{pB}%</div>
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



                        {/* All dead */}
                        {simulated && !showPlants && !experimentRunning && PLANTS.every(p => { const o = outcomes[p.id] || []; return o.length === 0 || o.every(x => !x.thriving); }) && (
                            <div className="absolute inset-0 flex flex-col gap-3 justify-center items-center z-[100]" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
                                <div className="text-lg font-black tracking-widest uppercase" style={{ color: "#ff7070" }}>ALL PLANTS FAILED</div>
                                <button onClick={reset} className="py-2 px-5 rounded-lg text-xs font-black tracking-widest uppercase cursor-pointer" style={{ background: "rgba(255,80,80,0.1)", border: "1.5px solid rgba(255,80,80,0.5)", color: "#ff7070" }}>↺ START AGAIN</button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right sidebar ── */}
                <aside className="flex flex-col gap-1.5 p-3 rounded-xl md:row-span-2" style={{ background: "rgba(183,210,109,0.05)", border: "1px solid rgba(183,210,109,0.1)" }}>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1.5">
                        <button onClick={() => setShowHistory(v => !v)} className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-garden-primary" >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        </button>
                        <div className="text-[11px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "rgba(183,210,109,0.5)" }}>OBSERVED</div>
                        <div className="flex justify-end">
                            <InfoTooltip text="You observed X plants thriving out of N total. The question is: what is the real underlying success rate? How likely is the plant going to thrive in certain conditions? You can't know it exactly, but given what you saw, this curve shows how likely each possible success rate is. The shaded band is the 90% confidence interval. With 3 seeds it's almost full width. With 30 seeds it shrinks dramatically. If you plant more, you are more certain. That's statistical power." /></div>
                    </div>

                    {experimentRunning && sel ? (
                        <BetaGraph thrivingA={sel.tA} totalA={sel.nA} thrivingB={sel.tB} totalB={sel.nB} label={sel.plant.label} />
                    ) : (
                        <BetaGraph thrivingA={sel?.thriving ?? 0} totalA={sel?.total ?? 0} label={sel?.plant.label ?? ""} showExpected={!experimentRunning && showExpected} expectedProb={sel && !experimentRunning ? sel.expectedProb / 100 : undefined} />
                    )}

                    {!experimentRunning && (
                        <button onClick={() => setShowExpected(v => !v)} className="text-[11px] font-bold tracking-[0.2em] uppercase text-center transition-all cursor-pointer py-1 rounded" style={{ color: showExpected ? "rgba(183,210,109,0.5)" : "rgba(183,210,109,0.25)", background: "transparent", border: "none" }}>
                            {showExpected ? "▾ EXPECTED" : "▸ EXPECTED"}
                        </button>
                    )}

                    <div className="overflow-y-auto sidebar-scroll">
                        {sidebarPlants.map(s => {
                            const { plant, total, thriving, tA, nA, tB, nB, pA, pB, expectedProb, observedProb } = s;
                            const hasSims = simulated && (experimentRunning ? nA > 0 : total > 0);
                            return (
                                <div key={plant.id} onClick={() => setSelectedPlantId(plant.id)} className="p-2 my-1 rounded-lg cursor-pointer transition-all"
                                    style={{ background: selectedPlantId === plant.id ? "rgba(183,210,109,0.1)" : "rgba(183,210,109,0.05)", border: selectedPlantId === plant.id ? "1px solid rgba(183,210,109,0.4)" : "1px solid rgba(183,210,109,0.1)", opacity: (!experimentRunning && total === 0) ? 0.4 : 1 }}>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-garden-primary font-semibold">{plant.label}</span>

                                        {!experimentRunning && showExpected && (
                                            <span
                                                className="text-[11px] font-bold text-garden-secondary"
                                            >
                                                expected {expectedProb}%
                                            </span>
                                        )}
                                    </div>
                                    {!experimentRunning && showExpected && (
                                        <div className="h-1 rounded-sm overflow-hidden mb-0.5 bg-garden-primary-opaque">
                                            <div
                                                className="h-full rounded-sm transition-all duration-500 bg-garden-secondary"
                                                style={{ width: `${expectedProb}%` }}
                                            />
                                        </div>
                                    )}
                                    {hasSims && experimentRunning && (
                                        <>
                                            <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-garden-sample-purple">
                                                <span>{tA}/{nA}</span>
                                                <span className="flex-end" >A {pA}%</span>
                                            </div>
                                            <div className="h-1 rounded-sm overflow-hidden mb-0.5" style={{ background: "rgba(183,210,109,0.1)" }}><div className="h-full rounded-sm transition-all duration-700" style={{ width: `${pA}%`, background: "#b1a8f0", opacity: 0.8 }} /></div>
                                            <div className="h-1 rounded-sm overflow-hidden" style={{ background: "rgba(240,213,168,0.1)" }}><div className="h-full rounded-sm transition-all duration-700" style={{ width: `${pB}%`, background: "#f0d5a8", opacity: 0.8 }} /></div>
                                            <div className="flex justify-between items-center mt-1.5 text-[10px] font-bold text-garden-sample-beige">
                                                <span>{tB}/{nB}</span>
                                                <span>B {pB}%</span>
                                            </div>
                                        </>
                                    )}
                                    {hasSims && !experimentRunning && (
                                        <>
                                            <div className="h-1 rounded-sm overflow-hidden" style={{ background: "rgba(183,210,109,0.05)" }}><div className="h-full rounded-sm transition-all duration-700" style={{ width: `${observedProb}%`, background: observedProb >= 70 ? "rgba(183,210,109,0.9)" : observedProb >= 40 ? "#ffcc44" : "#ff7070" }} /></div>
                                            <div className="flex justify-between items-center mt-2 text-[10px] font-bold text-garden-primary">
                                                <div >{thriving}/{total} thriving</div>
                                                <div style={{ color: observedProb >= 70 ? "rgba(183,210,109,0.9)" : observedProb >= 40 ? "rgba(255,204,68,0.9)" : "rgba(255,112,112,0.9)" }}>observed {observedProb}%</div>
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
    @keyframes pulse { from { opacity: 0.7; transform: scale(1); } to { opacity: 1; transform: scale(1.05); } }
    @keyframes eventFlash { 0% { opacity: 0; } 20% { opacity: 1; } 80% { opacity: 1; } 100% { opacity: 0; } }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    button:hover { filter: brightness(1.15); }
    * { box-sizing: border-box; } body { margin: 0; }
    .sidebar-scroll::-webkit-scrollbar { width: 2px; }
    .sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
    .sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(183,210,109,0.2); border-radius: 999px; }
    .sidebar-scroll::-webkit-scrollbar-thumb:hover { background: rgba(183,210,109,0.4); }
    .history-scroll::-webkit-scrollbar { width: 2px; height: 7px; }
    .history-scroll::-webkit-scrollbar-track { background: transparent; }
    .history-scroll::-webkit-scrollbar-thumb { background: rgba(183,210,109,0.2); border-radius: 999px; }
    .history-scroll { scrollbar-gutter: stable; overflow-y: auto; }
    .history-scroll::-webkit-scrollbar-corner { background: transparent; }
`}</style>
        </div>
    );
}