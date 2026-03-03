"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
}

type RandomEvent = "storm" | "sunflare" | "pests" | null;

const PLANTS: PlantConfig[] = [
    // Succulent — loves neglect, hates overwatering, very tolerant
    { id: "portulacaria", label: "Portulacaria", file: "portulacaria.png", idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.85 },

    // Pothos — adaptable, survives low light, medium everything, very forgiving
    { id: "pothos", label: "Pothos", file: "pothos.png", idealSun: 1, idealWater: 1, idealFertilizer: 0, tolerance: 0.80 },

    // Pansy — cool weather annual, needs consistent water, moderate sun, fussy
    { id: "pansy", label: "Pansy", file: "pansy.png", idealSun: 1, idealWater: 2, idealFertilizer: 1, tolerance: 0.45 },
    // Zinnia — full sun lover, drought tolerant once established, light feeder
    { id: "zinnia", label: "Zinnia", file: "zinnia.png", idealSun: 2, idealWater: 1, idealFertilizer: 0, tolerance: 0.65 },

    // Sunflower — full sun, moderate water, heavy feeder, fairly robust
    { id: "sunflower", label: "Sunflower", file: "sunflower.png", idealSun: 2, idealWater: 1, idealFertilizer: 2, tolerance: 0.60 },

    // Domino Cactus — extreme sun/dry, very unforgiving of overwatering
    { id: "domino", label: "Domino Cactus", file: "domino.png", idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.80 },

    // Orchid — small deviations = big failures
    { id: "orchid", label: "Orchid", file: "orchid.png", idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.25 },

    // Gardenia — needs everything high, very unforgiving
    { id: "gardenia", label: "Gardenia", file: "gardenia.png", idealSun: 2, idealWater: 2, idealFertilizer: 2, tolerance: 0.3 },

    // Mint — survives almost anything, aggressive grower
    { id: "mint", label: "Mint", file: "mint.png", idealSun: 1, idealWater: 2, idealFertilizer: 1, tolerance: 0.85 },


];



// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcSuccessProb(
    plant: PlantConfig,
    sun: ConditionLevel,
    water: ConditionLevel,
    fertilizer: ConditionLevel,
    randomBonus: number
): number {
    const sunDev = Math.abs(sun - plant.idealSun);
    const waterDev = Math.abs(water - plant.idealWater);
    const fertDev = Math.abs(fertilizer - plant.idealFertilizer);
    const totalDev = sunDev + waterDev + fertDev;
    const maxDev = 6;
    const base = 1 - (totalDev / maxDev) * (1 - plant.tolerance * 0.4);
    return Math.max(0.05, Math.min(0.98, base + randomBonus));
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
    plant, count, onChange, sun, water, fertilizer,
}: {
    plant: PlantConfig;
    count: number;
    onChange: (v: number) => void;
    sun: ConditionLevel;
    water: ConditionLevel;
    fertilizer: ConditionLevel;
}) {
    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltipTop, setTooltipTop] = useState(0);
    const [hovered, setHovered] = useState(false);

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
                className="relative w-10 h-10 flex-shrink-0"
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
                    onClick={() => onChange(Math.max(0, count - 1))}
                    className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                    style={{
                        background: "rgba(168,255,120,0.15)",
                        color: "#a8ff78",
                        border: "1px solid rgba(168,255,120,0.3)",
                    }}
                >-</button>
                <span className="w-5 text-center text-xs text-[#a8ff78]">{count}</span>
                <button
                    onClick={() => onChange(Math.min(50, count + 1))}
                    className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                    disabled={count >= 50}
                    style={{
                        background: count >= 50 ? "rgba(168,255,120,0.05)" : "rgba(168,255,120,0.15)",
                        color: count >= 50 ? "rgba(168,255,120,0.3)" : "#a8ff78",
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

function BetaDistributionGraph({ thriving, total, label }: {
    thriving: number;
    total: number;
    label: string;
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

    // Empty state — no plant selected or no seeds planted
    if (total === 0) return (
        <div className="p-2.5 rounded-lg mb-2 flex items-center justify-center"
            style={{ background: "rgba(168,255,120,0.08)", border: "1px solid rgba(168,255,120,0.2)", minHeight: "80px" }}>
            <div className="text-[9px] tracking-widest uppercase text-center" style={{ color: "rgba(168,255,120,0.3)" }}>
                click a plant to see<br />its distribution
            </div>
        </div>
    );

    return (
        <div className="p-2.5 rounded-lg mb-2" style={{ background: "rgba(168,255,120,0.08)", border: "1px solid rgba(168,255,120,0.2)" }}>

            {/* Header row */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-2">
                <div />
                <div className="text-[9px] font-bold tracking-[0.15em] uppercase text-center" style={{ color: "rgba(168,255,120,0.5)" }}>
                    {label}
                </div>
            </div>

            {/* Stats row */}
            <div className="flex justify-between mb-1.5 text-[9px]" style={{ color: "rgba(168,255,120,0.6)" }}>
                <span>90% CI: <span style={{ color: "#a8ff78" }}>{Math.round(lo * 100)}-{Math.round(hi * 100)}%</span></span>
                <span>peak: <span style={{ color: "#a8ff78" }}>{Math.round(mode * 100)}%</span></span>
                <span>{thriving}/{total} thriving</span>
            </div>

            <svg width="100%" viewBox={`0 0 ${width} ${height + 10}`} style={{ overflow: "visible" }}>
                {ciPath && <path d={ciPath} fill="rgba(168,255,120,0.15)" />}
                <path d={fillPath} fill="rgba(168,255,120,0.05)" />
                <path d={path} fill="none" stroke="#a8ff78" strokeWidth="1.5" />
                <line x1={mode * width} y1={0} x2={mode * width} y2={height} stroke="#a8ff78" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                <line x1={0} y1={height} x2={width} y2={height} stroke="rgba(168,255,120,0.2)" strokeWidth="1" />
                {[0, 25, 50, 75, 100].map((v) => (
                    <text key={v} x={v / 100 * width} y={height + 10} textAnchor="middle" fill="rgba(168,255,120,0.4)" fontSize="7">{v}%</text>
                ))}
            </svg>
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
    const prob = Math.round(calcSuccessProb(plant, sun, water, fertilizer, 0) * 100);
    const idealProb = Math.round(calcSuccessProb(plant, plant.idealSun, plant.idealWater, plant.idealFertilizer, 0) * 100);

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
            {/* Header */}
            <div className="flex items-center gap-2 mb-2 pb-2" style={{ borderBottom: "1px solid rgba(168,255,120,0.2)" }}>
                <img src={`/${plant.file}`} alt={plant.label} className="w-8 h-8 object-contain" />
                <div>
                    <div className="font-black tracking-wide">{plant.label}</div>
                    <div style={{ color: "rgba(168,255,120,0.5)", fontSize: "9px" }}>
                        Tolerance {Math.round(plant.tolerance * 100)}%
                    </div>
                </div>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-[10px_1fr_1fr] gap-x-3 mb-1">
                <div />
                <div className="text-[9px] tracking-widest uppercase text-center" style={{ color: "rgba(168,255,120,0.4)" }}>ideal</div>
                <div className="text-[9px] tracking-widest uppercase text-center" style={{ color: "rgba(168,255,120,0.4)" }}>current</div>
            </div>

            {/* Condition rows */}
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

            {/* Probability row */}
            <div className="grid grid-cols-[10px_1fr_1fr] gap-x-3 mt-2 pt-2" style={{ borderTop: "1px solid rgba(168,255,120,0.2)" }}>
                <div />
                <div className="text-center text-xs font-black" style={{ color: "#a8ff78" }}>{idealProb}%</div>
                <div className="text-center text-xs font-black" style={{ color: prob >= 70 ? "#a8ff78" : prob >= 40 ? "#ffcc44" : "#ff7070" }}>{prob}%</div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function GardenSimulator() {
    const [showPlants, setShowPlants] = useState(true);
    const [seedCounts, setSeedCounts] = useState<Record<string, number>>(
        Object.fromEntries(PLANTS.map((p) => [p.id, 0]))
    );
    const [sun, setSun] = useState<ConditionLevel>(1);
    const [water, setWater] = useState<ConditionLevel>(1);
    const [fertilizer, setFertilizer] = useState<ConditionLevel>(1);
    const [randomnessEnabled, setRandomnessEnabled] = useState(false);
    const [randomBonus, setRandomBonus] = useState(0);
    const [randomEvent, setRandomEvent] = useState<RandomEvent>(null);
    const [outcomes, setOutcomes] = useState<Record<string, PlantOutcome[]>>({});
    const [positionSeed] = useState(() => Math.floor(Math.random() * 99999));
    const [simulated, setSimulated] = useState(false);
    const [conditionsLocked, setConditionsLocked] = useState(false);
    const [eventAnim, setEventAnim] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(true);
    const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
    const gardenRef = useRef<HTMLDivElement>(null);

    const handleToggleRandomness = () => {
        if (conditionsLocked) return;
        setRandomnessEnabled(v => !v);
        if (randomnessEnabled) {
            setRandomEvent(null);
            setRandomBonus(0);
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

    const simulate = useCallback(() => {
        setShowPlants(false);
        setConditionsLocked(true);
        const bonus = randomnessEnabled
            ? randomBonus + (randomEvent ? (Math.random() - 0.5) * 0.3 : 0)
            : 0;
        setOutcomes((prevOutcomes) => {
            const newOutcomes: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach((plant) => {
                const count = seedCounts[plant.id] || 0;
                const prob = calcSuccessProb(plant, sun, water, fertilizer, bonus);
                const existing = prevOutcomes[plant.id] || [];
                const updated = existing.slice(0, count).map((prev) => {
                    const thriving = Math.random() < prob;
                    return {
                        ...prev,
                        thriving,
                        isDead: prev.isDead || prob < 0.2,
                        opacity: thriving ? 0.85 + Math.random() * 0.15 : 0.25 + Math.random() * 0.15,
                        scale: thriving ? 0.7 + Math.random() * 0.5 : 0.4 + Math.random() * 0.3,
                    };
                });
                newOutcomes[plant.id] = updated;
            });
            return newOutcomes;
        });
        setSimulated(true);
    }, [sun, water, fertilizer, randomBonus, randomEvent, positionSeed]);

    const simulateNew = useCallback(() => {
        setShowPlants(false);
        const bonus = randomBonus + (randomEvent ? (Math.random() - 0.5) * 0.3 : 0);
        setOutcomes((prevOutcomes) => {
            const newOutcomes: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach((plant) => {
                const count = seedCounts[plant.id] || 0;
                const prob = calcSuccessProb(plant, sun, water, fertilizer, bonus);
                const existing = prevOutcomes[plant.id] || [];
                const updated = existing.slice(0, count).map((prev) => ({ ...prev }));
                if (count > existing.length) {
                    const newPositions = generatePlantPositions(
                        count - existing.length,
                        positionSeed + PLANTS.indexOf(plant) * 1000 + existing.length * 37
                    );
                    newPositions.forEach((pos) => {
                        const thriving = Math.random() < prob;
                        updated.push({
                            thriving,
                            isDead: prob < 0.2,
                            opacity: thriving ? 0.85 + Math.random() * 0.15 : 0.25 + Math.random() * 0.15,
                            scale: thriving ? 0.7 + Math.random() * 0.5 : 0.4 + Math.random() * 0.3,
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
    }, [seedCounts]);

    useEffect(() => {
        if (simulated) simulate();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sun, water, fertilizer, simulated]);

    useEffect(() => {
        if (simulated) simulateNew();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [seedCounts, simulated]);

    const triggerRandomEvent = () => {
        const events: RandomEvent[] = ["storm", "sunflare", "pests"];
        const evt = events[Math.floor(Math.random() * 3)];
        const bonusMap: Record<string, number> = { storm: -0.2, sunflare: 0.15, pests: -0.25 };
        setRandomEvent(evt);
        setRandomBonus(bonusMap[evt!] || 0);
        setEventAnim(true);
        setTimeout(() => setEventAnim(false), 2000);
    };

    const reset = () => {
        setSeedCounts(Object.fromEntries(PLANTS.map((p) => [p.id, 0])));
        setSun(1);
        setWater(1);
        setFertilizer(1);
        setRandomBonus(0);
        setRandomEvent(null);
        setOutcomes({});
        setShowPlants(true);
        setSimulated(false);
        setConditionsLocked(false);
    };

    const stats = PLANTS.map((plant) => {
        const outs = outcomes[plant.id] || [];
        const total = outs.length;
        const thriving = outs.filter((o) => o.thriving).length;
        const prob = calcSuccessProb(plant, sun, water, fertilizer, randomBonus);
        return { plant, total, thriving, prob: Math.round(prob * 100) };
    });

    const totalSeeds = Object.values(seedCounts).reduce((a, b) => a + b, 0);
    const totalThriving = Object.values(outcomes).flat().filter((o) => o.thriving).length;

    const eventColors: Record<string, string> = {
        storm: "rgba(80,120,255,0.25)",
        sunflare: "rgba(255,220,60,0.25)",
        pests: "rgba(180,80,20,0.25)",
    };
    const eventLabel: Record<string, string> = {
        storm: "STORM!",
        sunflare: "SUN FLARE!",
        pests: "PEST ATTACK!",
    };

    const isDragging = dragRef.current !== null;

    return (
        <div className="min-h-screen  overflow-x-hidden" style={{ color: "#a8ff78" }}>

            {/* Title */}
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

            {/* Main layout — single col on mobile, 3-col on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr_260px] md:grid-rows-[auto_1fr] gap-3 px-4 py-3 max-w-[1280px] mx-auto"
                style={{ maxHeight: "calc(100vh - 150px)" }}>
                {/* ── Left: seed selection ─────────────────────────────────────── */}
                <aside
                    className="flex flex-col gap-2 p-3 rounded-xl md:col-start-1 md:row-start-1 md:row-span-2 "
                    style={{
                        border: "1px solid rgba(168,255,120,0.15)",
                    }}
                >
                    <button
                        onClick={reset}
                        className="w-full py-2 rounded-lg text-xs font-bold tracking-widest uppercase cursor-pointer transition-all"
                        style={{
                            background: "rgba(255,80,80,0.12)",
                            border: "1.5px solid rgba(255,80,80,0.4)",
                            color: "#ff7070",
                        }}
                    >
                        ↺ NEW EXPERIMENT
                    </button>

                    <button
                        onClick={() => setControlsOpen(!controlsOpen)}
                        className="bg-transparent border-none text-[#a8ff78] text-xs font-bold tracking-[0.2em] uppercase cursor-pointer flex justify-center items-center py-0"
                    >
                        SELECT SEEDS
                    </button>

                    {controlsOpen && (
                        <div className="overflow-y-auto sidebar-scroll">
                            {PLANTS.map((plant) => (
                                <SeedSelector
                                    key={plant.id}
                                    plant={plant}
                                    count={seedCounts[plant.id]}
                                    onChange={(v) => setSeedCounts((prev) => ({ ...prev, [plant.id]: v }))}
                                    sun={sun}
                                    water={water}
                                    fertilizer={fertilizer}
                                />
                            ))}
                        </div>
                    )}
                </aside>

                {/* ── Top centre: environmental controls ──────────────────────────── */}
                <section
                    className="p-3 md:px-4 rounded-xl md:col-start-2 md:row-start-1"
                    style={{
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                    }}
                >

                    {/* Stack controls vertically on mobile, row on md+ */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 md:gap-4 items-center">

                        <ConditionControl icon="sun.png" label="Sunlight" value={sun} onChange={conditionsLocked ? () => { } : setSun} locked={conditionsLocked} />
                        <ConditionControl icon="water.png" label="Water" value={water} onChange={conditionsLocked ? () => { } : setWater} locked={conditionsLocked} />
                        <ConditionControl icon="fertilizer.png" label="Fertilizer" value={fertilizer} onChange={conditionsLocked ? () => { } : setFertilizer} locked={conditionsLocked} />

                        <div className="flex flex-col gap-1 mx-auto lg:ml-2  w-35">
                            {/* Toggle — locked once experiment starts */}
                            <button
                                onClick={handleToggleRandomness}
                                disabled={conditionsLocked}
                                className="py-2 px-3 rounded-lg text-xs font-bold tracking-wide uppercase whitespace-nowrap transition-all "
                                style={{
                                    background: conditionsLocked ? "rgba(255,180,0,0.05)" : " rgba(255,180,0,0.15)",
                                    border: `1.5px solid ${conditionsLocked ? "rgba(255,180,0,0.2)" : "rgba(255,180,0,0.6) "}`,
                                    color: conditionsLocked ? " rgba(255,180,0,0.4)" : "#ffcc44",
                                    cursor: conditionsLocked ? "not-allowed" : "pointer",
                                    opacity: conditionsLocked ? 0.5 : 1,
                                }}
                            >
                                {randomnessEnabled ? "RANDOMNESS ON" : "RANDOMNESS OFF"}
                            </button>

                            {/* Trigger — only blocked when randomness is off */}
                            <button
                                onClick={() => { if (randomnessEnabled) triggerRandomEvent(); }}
                                disabled={!randomnessEnabled}
                                className="py-1.5 px-3 rounded-lg text-[10px] font-bold tracking-wide uppercase transition-all  "
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
                    <div className="flex items-center justify-center ">
                        {conditionsLocked && (
                            <div className="text-[9px] tracking-widest uppercase flex items-center gap-1"
                                style={{ color: "#ffcc44" }}>
                                experiment running
                            </div>
                        )}
                    </div>
                </section>

                {/* ── Centre: garden plot ──────────────────────────────────────────── */}
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
                        {/* Soil texture overlay */}
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
                                className="absolute inset-0 z-[90] rounded-xl pointer-events-none flex flex-col  items-center justify-center"
                                style={{
                                    background: eventColors[randomEvent],
                                    animation: "eventFlash 3s ease-out forwards",
                                    color: "rgba(255,200,0,0.6)",
                                }}
                            >
                                <img
                                    src={randomEvent === "storm" ? "/storm.png" : randomEvent === "sunflare" ? "/sun.png" : "/pest.png"}
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


                                <div className="text-5" >
                                    {randomBonus > 0 ? `+${Math.round(randomBonus * 100)}%` : `${Math.round(randomBonus * 100)}%`} modifier
                                </div>

                            </div>
                        )}

                        {/* Plants */}
                        {PLANTS.map((plant) =>
                            (outcomes[plant.id] || []).map((outcome, i) => {
                                const isDraggingThis = dragRef.current?.plantId === plant.id && dragRef.current?.index === i;
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
                                            transform: `translate(-50%, -50%) scale(${outcome.scale * (isDraggingThis ? 1.2 : 1)}) rotate(${outcome.rotation}deg)`,
                                            transition: isDraggingThis ? "transform 0.1s ease" : "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
                                                opacity: outcome.opacity,
                                                transform: `${outcome.flip ? "scaleX(-1) " : ""}scale(${outcome.scale * (isDraggingThis ? 1.2 : 1)}) rotate(${outcome.rotation}deg)`,
                                                filter: outcome.thriving
                                                    ? isDraggingThis ? "drop-shadow(0 4px 12px rgba(168,255,120,0.8))" : ""
                                                    : `grayscale(80%) brightness(0.5) blur(0.5px)${isDraggingThis ? " drop-shadow(0 4px 12px rgba(255,100,100,0.6))" : ""}`,
                                                transition: "all 0.3s ease",
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
                </div>

                {/* ── Right: stats ─────────────────────────────────────────────────── */}
                <aside
                    className="flex flex-col gap-1.5 p-3 rounded-xl md:row-span-2"
                    style={{
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                    }}
                >
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-1.5">
                        <div />
                        <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "rgba(168,255,120,0.6)" }}>
                            OBSERVED
                        </div>
                        <div className="flex justify-end">
                            <InfoTooltip text="You observed X plants thriving out of N total. The question is: what is the real underlying success rate? How likely is the plant going to thrive in certain conditions? You can't know it exactly, but given what you saw, this curve shows all possible true rates and how likely each one is. The shaded band is the 90% confidence zone. With 3 seeds it's almost full width. With 30 seeds it shrinks dramatically. If you plant more, you are more certain. That's statistical power." />
                        </div>
                    </div>

                    {simulated && (() => {
                        const selected = selectedPlantId
                            ? stats.find(s => s.plant.id === selectedPlantId)
                            : null;
                        return (
                            <BetaDistributionGraph
                                thriving={selected?.thriving ?? 0}
                                total={selected?.total ?? 0}
                                label={selected?.plant.label ?? ""}
                            />
                        );
                    })()}

                    <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-center" style={{ color: "rgba(168,255,120,0.6)" }}>
                        EXPECTED
                    </div>
                    <div className="overflow-y-auto sidebar-scroll">

                        {stats.map(({ plant, total, thriving, prob }) => {
                            const hasSims = simulated && total > 0;
                            return (
                                <div
                                    key={plant.id}
                                    onClick={() => setSelectedPlantId(plant.id)}
                                    className="p-2 my-1 rounded-lg cursor-pointer transition-all "
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
                                        <span
                                            className="text-[11px] font-black"
                                            style={{ color: prob >= 70 ? "#a8ff78" : prob >= 40 ? "#ffcc44" : "#ff7070" }}
                                        >
                                            {prob}%
                                        </span>
                                    </div>
                                    <div className="h-1 rounded-sm overflow-hidden" style={{ background: "rgba(168,255,120,0.1)" }}>
                                        <div
                                            className="h-full rounded-sm transition-all duration-500"
                                            style={{
                                                width: `${prob}%`,
                                                background: prob >= 70 ? "#a8ff78" : prob >= 40 ? "#ffcc44" : "#ff7070",
                                            }}
                                        />
                                    </div>
                                    {hasSims && (
                                        <div className="text-[9px] mt-0.5" style={{ color: "rgba(168,255,120,0.5)" }}>
                                            {thriving}/{total} thriving
                                        </div>
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
            `}</style>
        </div>
    );
}