"use client";


import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
type ConditionLevel = 0 | 1 | 2; // Low/None=0, Med=1, High=2

interface PlantConfig {
    id: string;
    label: string;
    file: string;
    idealSun: ConditionLevel;
    idealWater: ConditionLevel;
    idealFertilizer: ConditionLevel;
    tolerance: number; // how forgiving (0-1, higher = more forgiving)
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

// ─── Plant Configs ─────────────────────────────────────────────────────────────
const PLANTS: PlantConfig[] = [
    { id: "portulacaria", label: "Portulacaria", file: "portulacaria.png", idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.5 },
    { id: "pothos", label: "Pothos", file: "pothos.png", idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.7 },
    { id: "pansy", label: "Pansy", file: "pansy.png", idealSun: 1, idealWater: 1, idealFertilizer: 1, tolerance: 0.6 },
    { id: "zinnia", label: "Zinnia", file: "zinnia.png", idealSun: 2, idealWater: 1, idealFertilizer: 1, tolerance: 0.55 },
    { id: "sunflower", label: "Sunflower", file: "sunflower.png", idealSun: 2, idealWater: 1, idealFertilizer: 1, tolerance: 0.6 },
    { id: "domino", label: "Domino Cactus", file: "domino.png", idealSun: 2, idealWater: 0, idealFertilizer: 0, tolerance: 0.5 },
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

function SliderControl({
    icon, label, value, onChange,
}: { icon: string; label: string; value: ConditionLevel; onChange: (v: ConditionLevel) => void }) {
    const labels = ["Low", "Med", "High"];
    return (
        <div className="flex items-center gap-2 mb-3">
            <img src={`/${icon}`} alt={label} className="w-7 h-7 object-contain flex-shrink-0" style={{ filter: "drop-shadow(0 0 4px #a8ff78)" }} />
            <div className="flex flex-col flex-1">
                <span className="text-xs font-semibold tracking-widest uppercase text-[#a8ff78] mb-1" >{label}</span>
                <div className="flex gap-1">
                    {[0, 1, 2].map((v) => (
                        <button
                            key={v}
                            onClick={() => onChange(v as ConditionLevel)}
                            className="flex-1 py-1 rounded text-xs font-bold transition-all duration-200 cursor-pointer"
                            style={{
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
    plant, count, onChange,
}: { plant: PlantConfig; count: number; onChange: (v: number) => void }) {

    const eventIcons: Record<string, string> = {
    storm: "/storm.png",
    sunflare: "/sun.png",
    pests: "/pest.png",
};

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [tooltipTop, setTooltipTop] = useState(0);
    const [hovered, setHovered] = useState(false);

    const updateTooltipPosition = () => {
    if (!imageRef.current || !containerRef.current) return;

    const imageRect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    const centerY =
        imageRect.top - containerRect.top + imageRect.height / 2;

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
                onMouseEnter={() => {
                    updateTooltipPosition();
                    setHovered(true);
                }}
                onMouseLeave={() => setHovered(false)}
            >
                <img ref={imageRef} src={`/${plant.file}`} alt={plant.label} className="w-10 h-10 object-contain" />

                {hovered && <PlantTooltip plant={plant} top={tooltipTop} />}


                {count > 0 && (
                    <div
                        className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded text-xs font-bold"
                        style={{
                            background: "#a8ff78",
                            color: "#0a1a00",
                            fontSize: "10px",
                        }}
                    >
                        {count}
                    </div>
                )}
            </div>

            

            <span className="flex-1 text-xs text-[#a8ff78] font-semibold" >
                {plant.label}
            </span>
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
                <span className="w-5 text-center text-xs text-[#a8ff78]" >{count}</span>
                <button
                    onClick={() => onChange(Math.min(15, count + 1))}
                    className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold transition-all cursor-pointer"
                    style={{
                        background: count >= 15 ? "rgba(168,255,120,0.05)" : "rgba(168,255,120,0.15)",
                        color: count >= 15 ? "rgba(168,255,120,0.3)" : "#a8ff78",
                        border: "1px solid rgba(168,255,120,0.3)",
                    }}
                    disabled={count >= 15}
                >+</button>
            </div>
        </div>
    );
}


function levelLabel(level: ConditionLevel) {
    return ["Low", "Medium", "High"][level];
}

function PlantTooltip({
    plant,
    top,
}: {
    plant: PlantConfig;
    top: number;
}) {
    return (
        <div
            className="absolute z-50 pointer-events-none"
            style={{
                 left: 48,
                top: top,
                transform: "translateY(-50%)",
                background: "rgba(10,20,0,0.95)",
                border: "1px solid rgba(168,255,120,0.4)",
                borderRadius: "8px",
                padding: "6px 8px",
                fontSize: "10px",
                color: "#a8ff78",
                whiteSpace: "nowrap",
                boxShadow: "0 0 12px rgba(168,255,120,0.25)",
            }}
        >
            <div><strong>{plant.label}</strong></div>
            <div>Sun: {levelLabel(plant.idealSun)}</div>
            <div>Water: {levelLabel(plant.idealWater)}</div>
            <div>Fert: {levelLabel(plant.idealFertilizer)}</div>
            <div>Tolerance: {Math.round(plant.tolerance * 100)}%</div>
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
    const [randomBonus, setRandomBonus] = useState(0);
    const [randomEvent, setRandomEvent] = useState<RandomEvent>(null);
    const [outcomes, setOutcomes] = useState<Record<string, PlantOutcome[]>>({});
    const [positionSeed] = useState(() => Math.floor(Math.random() * 99999));
    const [simulated, setSimulated] = useState(false);
    const [eventAnim, setEventAnim] = useState(false);
    const [controlsOpen, setControlsOpen] = useState(true);
    const gardenRef = useRef<HTMLDivElement>(null);

    // Drag state
    const dragRef = useRef<{
        plantId: string;
        index: number;
        startMouseX: number;
        startMouseY: number;
        startX: number;
        startY: number;
    } | null>(null);

    const handlePlantMouseDown = useCallback((
        e: React.MouseEvent,
        plantId: string,
        index: number,
        currentX: number,
        currentY: number
    ) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = {
            plantId,
            index,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startX: currentX,
            startY: currentY,
        };
    }, []);

    const handlePlantTouchStart = useCallback((
        e: React.TouchEvent,
        plantId: string,
        index: number,
        currentX: number,
        currentY: number
    ) => {
        e.stopPropagation();
        const touch = e.touches[0];
        dragRef.current = {
            plantId,
            index,
            startMouseX: touch.clientX,
            startMouseY: touch.clientY,
            startX: currentX,
            startY: currentY,
        };
    }, []);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!dragRef.current || !gardenRef.current) return;
            const garden = gardenRef.current;
            const rect = garden.getBoundingClientRect();
            const { plantId, index, startMouseX, startMouseY, startX, startY } = dragRef.current;

            const dx = ((e.clientX - startMouseX) / rect.width) * 100;
            const dy = ((e.clientY - startMouseY) / rect.height) * 100;

            const newX = Math.max(2, Math.min(98, startX + dx));
            const newY = Math.max(2, Math.min(96, startY + dy));

            setOutcomes((prev) => {
                const plantOutcomes = [...(prev[plantId] || [])];
                if (plantOutcomes[index]) {
                    plantOutcomes[index] = { ...plantOutcomes[index], x: newX, y: newY, zIndex: 100 };
                }
                return { ...prev, [plantId]: plantOutcomes };
            });
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!dragRef.current || !gardenRef.current) return;
            e.preventDefault();
            const touch = e.touches[0];
            const garden = gardenRef.current;
            const rect = garden.getBoundingClientRect();
            const { plantId, index, startMouseX, startMouseY, startX, startY } = dragRef.current;

            const dx = ((touch.clientX - startMouseX) / rect.width) * 100;
            const dy = ((touch.clientY - startMouseY) / rect.height) * 100;

            const newX = Math.max(2, Math.min(98, startX + dx));
            const newY = Math.max(2, Math.min(96, startY + dy));

            setOutcomes((prev) => {
                const plantOutcomes = [...(prev[plantId] || [])];
                if (plantOutcomes[index]) {
                    plantOutcomes[index] = { ...plantOutcomes[index], x: newX, y: newY, zIndex: 100 };
                }
                return { ...prev, [plantId]: plantOutcomes };
            });
        };

        const handleMouseUp = () => {
            if (!dragRef.current) return;
            const { plantId, index } = dragRef.current;
            // Restore zIndex after drop
            setOutcomes((prev) => {
                const plantOutcomes = [...(prev[plantId] || [])];
                if (plantOutcomes[index]) {
                    plantOutcomes[index] = { ...plantOutcomes[index], zIndex: Math.floor(Math.random() * 60) };
                }
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

    // Simulate growth all
    const simulate = useCallback(() => {
        setShowPlants(false);
        const bonus = randomBonus + (randomEvent ? (Math.random() - 0.5) * 0.3 : 0);
        setOutcomes((prevOutcomes) => {
            const newOutcomes: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach((plant) => {
                const count = seedCounts[plant.id] || 0;
                const prob = calcSuccessProb(plant, sun, water, fertilizer, bonus);
                const existing = prevOutcomes[plant.id] || [];

                // Re-evaluate thriving for existing plants but KEEP their positions
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

        // Simulate growth only new!!!
    const simulateNew = useCallback(() => {
        setShowPlants(false);
        const bonus = randomBonus + (randomEvent ? (Math.random() - 0.5) * 0.3 : 0);
        setOutcomes((prevOutcomes) => {
            const newOutcomes: Record<string, PlantOutcome[]> = {};
            PLANTS.forEach((plant) => {
                const count = seedCounts[plant.id] || 0;
                const prob = calcSuccessProb(plant, sun, water, fertilizer, bonus);
                const existing = prevOutcomes[plant.id] || [];

                // Re-evaluate thriving for existing plants but KEEP their positions
                const updated = existing.slice(0, count).map((prev) => {
                    const thriving = Math.random() < prob;
                   
                    return {
                        ...prev,
                    };
                });

                // Generate positions only for newly added plants
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
    }, [seedCounts ]);

// When environment changes, recalc all existing plants
useEffect(() => {
    if (simulated) simulate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [sun, water, fertilizer, simulated]);

// When new seeds are added, generate them without touching existing
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
    };

    // Stats
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
        <div
            style={{
                minHeight: "100vh",
                background: "#050d00",
                color: "#a8ff78",
                padding: "0",
                overflowX: "hidden",
            }}
        >
            {/* Title */}
            <header
                style={{
                    textAlign: "center",
                    padding: "24px 16px 12px",
                    borderBottom: "1px solid rgba(168,255,120,0.15)",
                }}
            >
                <h1
                    style={{
                        fontSize: "clamp(1.4rem, 4vw, 2.5rem)",
                        fontWeight: 900,
                        letterSpacing: "0.15em",
                        textTransform: "uppercase",
                        background: "linear-gradient(135deg, #a8ff78, #78ffd6)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        margin: 0,
                        textShadow: "none",
                    }}
                >
                    Grow Your Garden
                </h1>
            </header>

            {/* Main layout */}
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "280px 1fr 260px",
                    gridTemplateRows: "auto 1fr",
                    gap: "12px",
                    padding: "12px 16px 24px",
                    maxWidth: "1280px",
                    margin: "0 auto",
                    minHeight: "calc(100vh - 100px)",
                }}
                className="garden-grid"
            >
                {/* ── Left column: seed selection ─────────────────────────────────── */}
                <aside
                    style={{
                        gridColumn: "1",
                        gridRow: "1 / 3",
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                        borderRadius: "12px",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                    }}
                >
                    {/* Reset */}
                    <button
                        onClick={reset}
                        style={{
                            width: "100%",
                            padding: "8px",
                            background: "rgba(255,80,80,0.12)",
                            border: "1.5px solid rgba(255,80,80,0.4)",
                            borderRadius: "8px",
                            color: "#ff7070",
                            fontSize: "12px",
                            fontWeight: 700,
                            letterSpacing: "0.15em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            marginBottom: "6px",
                            transition: "all 0.2s",
                        }}
                    >
                        ↺ RESET
                    </button>



                    {/* Collapsible label */}
                    <button
                        onClick={() => setControlsOpen(!controlsOpen)}
                        style={{
                            background: "none",
                            border: "none",
                            color: "#a8ff78",
                            fontSize: "11px",
                            fontWeight: 700,
                            letterSpacing: "0.2em",
                            textTransform: "uppercase",
                            cursor: "pointer",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            padding: "0",
                        }}
                    >
                        <span>SELECT SEEDS</span>
                    </button>

                    {controlsOpen && (
                        <div>
                            {PLANTS.map((plant) => (
                                <SeedSelector
                                    key={plant.id}
                                    plant={plant}
                                    count={seedCounts[plant.id]}
                                    onChange={(v) => setSeedCounts((prev) => ({ ...prev, [plant.id]: v }))}
                                />
                            ))}
                        </div>
                    )}
                </aside>

                {/* ── Top: environmental controls ─────────────────────────────────── */}
                <section
                    style={{
                        gridColumn: "2",
                        gridRow: "1",
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                        borderRadius: "12px",
                        padding: "14px 18px",
                    }}
                >
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr auto",
                            gap: "16px",
                            alignItems: "center",
                        }}
                    >
                        <SliderControl icon="sun.png" label="Sunlight" value={sun} onChange={setSun} />
                        <SliderControl icon="water.png" label="Water" value={water} onChange={setWater} />
                        <SliderControl icon="fertilizer.png" label="Fertilizer" value={fertilizer} onChange={setFertilizer} />

                        {/* Random event */}
                        <button
                            onClick={triggerRandomEvent}
                            style={{
                                padding: "8px 14px",
                                background: "rgba(255,180,0,0.1)",
                                border: "1.5px solid rgba(255,180,0,0.4)",
                                borderRadius: "8px",
                                color: "#ffcc44",
                                alignItems: "center",
                                fontSize: "11px",
                                fontWeight: 700,
                                letterSpacing: "0.1em",
                                textTransform: "uppercase",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                transition: "all 0.2s",
                            }}
                        >
                            ⚡ RANDOM EVENT
                        </button>
                    </div>
                </section>

                {/* ── Center: garden plot ──────────────────────────────────────────── */}
                <div
                    style={{
                        gridColumn: "2",
                        gridRow: "2",
                        position: "relative",
                    }}
                >


                    <div
                        ref={gardenRef}
                        style={{
                            width: "100%",
                            paddingBottom: "70%",
                            position: "relative",
                            borderRadius: "12px",
                            overflow: "hidden",
                            background: "linear-gradient(160deg, #3d1f00 0%, #5a2d00 40%, #3a1800 100%)",
                            border: "2px solid rgba(120,80,20,0.6)",
                            boxShadow: "0 0 40px rgba(80,40,0,0.5), inset 0 0 60px rgba(0,0,0,0.4)",
                            cursor: isDragging ? "grabbing" : "default",
                        }}
                    >
                        {/* Soil texture + Scanline overlay */}
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                backgroundImage:
                                    "radial-gradient(ellipse at 30% 60%, rgba(90,50,10,0.3) 0%, transparent 60%), radial-gradient(ellipse at 70% 30%, rgba(60,30,5,0.4) 0%, transparent 50%), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
                                pointerEvents: "none",
                            }}
                        />

                        {/* Random event overlay */}
                        {eventAnim && randomEvent && (
    <div
        style={{
            position: "absolute",
            inset: 0,
            background: eventColors[randomEvent],
            zIndex: 90,
            borderRadius: "12px",
            animation: "eventFlash 2s ease-out forwards",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }}
    >
        <img
            src={
                randomEvent === "storm"
                    ? "/storm.png"
                    : randomEvent === "sunflare"
                    ? "/sun.png"
                    : "/pest.png"
            }
            alt={randomEvent}
            style={{
                width: "clamp(70px, 10vw, 140px)",
                height: "clamp(70px, 10vw, 140px)",
                objectFit: "contain",
                filter: "drop-shadow(0 0 25px rgba(255,255,255,0.8))",
                animation: "pulse 0.8s ease-in-out infinite alternate",
            }}
        />
    </div>
)}

                        {/* Plants */}
                        {PLANTS.map((plant) =>
                            (outcomes[plant.id] || []).map((outcome, i) => {
                                const isDraggingThis =
                                    dragRef.current?.plantId === plant.id &&
                                    dragRef.current?.index === i;
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
                                            transition: isDraggingThis ? "transform 0.1s ease, box-shadow 0.1s ease" : "all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
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
                                                transition: "all 0.2s ease",
                                                pointerEvents: "none",
                                            }}
                                        />
                                        {/* Drag target ring on hover */}
                                        {isDraggingThis && (
                                            <div style={{
                                                position: "absolute",
                                                inset: "-4px",
                                                borderRadius: "50%",
                                                border: `2px dashed ${outcome.thriving ? "rgba(168,255,120,0.7)" : "rgba(255,100,100,0.5)"}`,
                                                animation: "spin 2s linear infinite",
                                                pointerEvents: "none",
                                            }} />
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {/* Grow button */}
                        {showPlants && (
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 0,
                                    display: "flex",
                                    justifyContent: "center",
                                    alignItems: "center",
                                    pointerEvents: "none", // important
                                    zIndex: 100,
                                }}
                            >
                                <button
                                    onClick={simulate}
                                    style={{
                                        pointerEvents: "auto", // allow clicking
                                        width: "150px",
                                        padding: "12px",
                                        background: totalSeeds === 0
                                            ? "rgba(168,255,120,0.5)"
                                            : "linear-gradient(135deg, #a8ff78, #78ffd6)",
                                        border: "none",
                                        borderRadius: "10px",
                                        color: "#0a1a00",
                                        fontSize: "13px",
                                        fontWeight: 900,
                                        letterSpacing: "0.15em",
                                        textTransform: "uppercase",
                                        cursor: totalSeeds === 0 ? "not-allowed" : "pointer",
                                        opacity: totalSeeds === 0 ? 0.4 : 1,
                                        boxShadow: totalSeeds > 0 ? "0 0 20px rgba(168,255,120,0.4)" : "none",
                                        transition: "all 0.3s",
                                    }}
                                    disabled={totalSeeds === 0}
                                >
                                    PLANT SEEDS
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right column: stats ──────────────────────────────────────────── */}
                <aside
                    style={{
                        gridColumn: "3",
                        gridRow: "1 / 3",
                        background: "rgba(168,255,120,0.03)",
                        border: "1px solid rgba(168,255,120,0.15)",
                        borderRadius: "12px",
                        padding: "14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                    }}
                >
                    <div
                        style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            letterSpacing: "0.2em",
                            textTransform: "uppercase",
                            color: "rgba(168,255,120,0.6)",
                            marginBottom: "6px",
                            textAlign: "center",
                        }}
                    >
                        SUCCESS RATE
                    </div>

                    {/* Total thriving */}
                    {simulated && (
                        <div
                            style={{
                                padding: "10px",
                                background: "rgba(168,255,120,0.08)",
                                borderRadius: "8px",
                                border: "1px solid rgba(168,255,120,0.2)",
                                textAlign: "center",
                                marginBottom: "8px",
                            }}
                        >
                            <div style={{ fontSize: "28px", fontWeight: 900, color: "#a8ff78", lineHeight: 1 }}>
                                {totalThriving}
                            </div>
                            <div style={{ fontSize: "9px", color: "rgba(168,255,120,0.5)", letterSpacing: "0.15em", marginTop: "2px" }}>
                                THRIVING TOTAL
                            </div>
                        </div>
                    )}

                    {/* Per-plant stats */}
                    {stats.map(({ plant, total, thriving, prob }) => {
                        const hasSims = simulated && total > 0;
                        return (
                            <div
                                key={plant.id}
                                style={{
                                    padding: "8px",
                                    borderRadius: "8px",
                                    background: "rgba(168,255,120,0.03)",
                                    border: "1px solid rgba(168,255,120,0.1)",
                                    opacity: total === 0 ? 0.4 : 1,
                                }}
                            >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                    <span style={{ fontSize: "10px", fontWeight: 700, color: "#a8ff78", letterSpacing: "0.05em" }}>
                                        {plant.label}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: "11px",
                                            fontWeight: 900,
                                            color: prob >= 70 ? "#a8ff78" : prob >= 40 ? "#ffcc44" : "#ff7070",
                                        }}
                                    >
                                        {prob}%
                                    </span>
                                </div>
                                {/* Probability bar */}
                                <div
                                    style={{
                                        height: "4px",
                                        background: "rgba(168,255,120,0.1)",
                                        borderRadius: "2px",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${prob}%`,
                                            background: prob >= 70 ? "#a8ff78" : prob >= 40 ? "#ffcc44" : "#ff7070",
                                            borderRadius: "2px",
                                            transition: "width 0.5s ease",
                                        }}
                                    />
                                </div>
                                {hasSims && (
                                    <div style={{ fontSize: "9px", color: "rgba(168,255,120,0.5)", marginTop: "3px" }}>
                                        {thriving}/{total} thriving
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Random event effect indicator */}
                    {randomEvent && (
                        <div
                            style={{
                                marginTop: "8px",
                                padding: "8px",
                                background: "rgba(255,180,0,0.08)",
                                border: "1px solid rgba(255,180,0,0.25)",
                                borderRadius: "8px",
                                fontSize: "10px",
                                color: "#ffcc44",
                                textAlign: "center",
                                letterSpacing: "0.1em",
                            }}
                        >
                            <div style={{ fontWeight: 700, marginBottom: "2px" }}>{eventLabel[randomEvent]}</div>
                            <div style={{ color: "rgba(255,200,0,0.6)", fontSize: "9px" }}>
                                {randomBonus > 0 ? `+${Math.round(randomBonus * 100)}%` : `${Math.round(randomBonus * 100)}%`} modifier
                            </div>
                        </div>
                    )}
                </aside>
            </div>

            {/* Responsive styles */}
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

        @media (max-width: 768px) {
          .garden-grid {
            grid-template-columns: 1fr !important;
            grid-template-rows: auto auto auto auto !important;
          }
          .garden-grid > aside:first-child  { grid-column: 1 !important; grid-row: 1 !important; }
          .garden-grid > section            { grid-column: 1 !important; grid-row: 2 !important; }
          .garden-grid > div               { grid-column: 1 !important; grid-row: 3 !important; }
          .garden-grid > aside:last-child   { grid-column: 1 !important; grid-row: 4 !important; }
        }

        button:hover { filter: brightness(1.15); }

        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
        </div>
    );
}