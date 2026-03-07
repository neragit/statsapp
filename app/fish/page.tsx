"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type FishType = "srdela" | "trlja" | "macka" | "knez" | "modrulj";
type Direction = "left" | "right";
type Phase = "start" | "experiment" | "question" | "results";
type NoticedOption = "large" | "change" | "nothing";

interface Fish {
    id: string;
    type: FishType;
    x: number;
    y: number;
    /** px per frame; negative = moving left */
    speed: number;
    direction: Direction;
    /** ms after experiment start before this fish becomes active */
    spawnAt: number;
    /** phase offset for sinusoidal y-wobble */
    offset: number;
    active: boolean;
    gone: boolean;
}

interface ExperimentResult {
    sardineCountUser: number;
    sardineActual: number;
    noticedCatfish: boolean;
}

interface BubbleConfig {
    id: number;
    /** percentage of scene width */
    x: number;
    size: number;
    duration: number;
    delay: number;
}

interface SeaweedConfig {
    id: number;
    /** percentage of scene width */
    x: number;
    height: number;
    delay: number;
}

// ─── SVG Fish ─────────────────────────────────────────────────────────────────

interface SVGFishProps {
    flipped: boolean;
    scale?: number;
}

function SardineSVG({ flipped, scale = 1 }: SVGFishProps) {
    const w = 52 * scale, h = 26 * scale;
    return (
        <svg width={w} height={h} viewBox="0 0 52 26" fill="none"
            style={{ transform: flipped ? "scaleX(-1)" : "none", display: "block" }}>
            <ellipse cx="24" cy="13" rx="18" ry="7" fill="#7EC8E3" />
            <ellipse cx="24" cy="13" rx="18" ry="7" fill="url(#ss)" />
            <path d="M6 13 L0 6 L0 20 Z" fill="#5BB8D4" />
            <path d="M20 6 Q24 2 28 6" stroke="#5BB8D4" strokeWidth="1.5" fill="none" />
            <circle cx="38" cy="11" r="2.5" fill="white" />
            <circle cx="38.8" cy="11" r="1.2" fill="#1a3a4a" />
            <path d="M10 10 Q24 8 40 11" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" fill="none" />
            <defs>
                <linearGradient id="ss" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
                    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </linearGradient>
            </defs>
        </svg>
    );
}

// ─── Ambient ──────────────────────────────────────────────────────────────────

type BubbleProps = Omit<BubbleConfig, "id">;
type SeaweedProps = Omit<SeaweedConfig, "id">;

function Bubble({ x, size, duration, delay }: BubbleProps) {
    return (
        <div style={{
            position: "absolute", left: `${x}%`, bottom: 0,
            width: size, height: size, borderRadius: "50%",
            background: "rgba(255,255,255,0.14)",
            border: "1px solid rgba(255,255,255,0.28)",
            animation: `bubbleRise ${duration}s ${delay}s linear infinite`,
            pointerEvents: "none",
        }} />
    );
}

function Seaweed({ x, height, delay }: SeaweedProps) {
    return (
        <div style={{
            position: "absolute", bottom: 0, left: `${x}%`,
            width: 18, height, transformOrigin: "bottom center",
            animation: `sway 3.5s ${delay}s ease-in-out infinite alternate`,
        }}>
            <svg width="18" height={height} viewBox={`0 0 18 ${height}`} fill="none">
                {Array.from({ length: Math.floor(height / 20) }).map((_, i) => (
                    <ellipse key={i}
                        cx={9 + (i % 2 === 0 ? 1 : -1) * 4}
                        cy={height - i * 20 - 10}
                        rx="5" ry="10"
                        fill={i % 3 === 0 ? "#2d7a4f" : "#1e6b42"} opacity={0.85} />
                ))}
            </svg>
        </div>
    );
}

// ─── Config ───────────────────────────────────────────────────────────────────

const EXPERIMENT_DURATION = 55000;
const CATFISH_APPEAR_AT = 7000;
const SARDINE_ACTUAL = 12;
const TRLJA_COUNT = 18;
const KNEZ_COUNT = 6;

const BUBBLES: BubbleConfig[] = Array.from({ length: 20 }, (_, i) => ({
    id: i, x: 2 + i * 4.9,
    size: 4 + (i * 3.7 % 9),
    duration: 5 + (i * 1.3 % 6),
    delay: (i * 0.7) % 6,
}));

const SEAWEEDS: SeaweedConfig[] = Array.from({ length: 12 }, (_, i) => ({
    id: i, x: 1 + i * 8.5 + (i % 3) * 2,
    height: 50 + (i * 17 % 90),
    delay: (i * 0.6) % 2,
}));

function buildFish(W: number, H: number): Fish[] {
    const list: Fish[] = [];

    for (let i = 0; i < SARDINE_ACTUAL; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        list.push({
            id: `srdela-${i}`, type: "srdela",
            x: dir === 1 ? -70 : W + 70,
            y: 80 + (i * 47 % Math.floor(H * 0.7)),
            speed: (2 + (i * 0.23 % 1.2)) * dir,
            direction: dir === 1 ? "left" : "right",
            spawnAt: 150 + i * 1500,
            offset: i * 0.9,
            active: false, gone: false,
        });
    }

    for (let i = 0; i < TRLJA_COUNT; i++) {
        const dir = i % 2 === 0 ? -1 : 1;
        list.push({
            id: `trlja-${i}`, type: "trlja",
            x: dir === 1 ? -60 : W + 60,
            y: 70 + (i * 53 % Math.floor(H * 0.7)),
            speed: (1. + (i * 0.19 % 1.3)) * dir,
            direction: dir === 1 ? "right" : "left",
            spawnAt: 80 + i * 1000,
            offset: i * 1.1,
            active: false, gone: false,
        });
    }

    for (let i = 0; i < KNEZ_COUNT; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        list.push({
            id: `knez-${i}`, type: "knez",
            x: dir === 1 ? -60 : W + 60,
            y: 30 + (i * 61 % Math.floor(H * 0.7)),
            speed: (1.0 + (i * 0.21 % 0.8)) * dir,
            direction: dir === 1 ? "left" : "right",
            spawnAt: 400 + i * 2000,
            offset: 0, active: false, gone: false,
        });
    }


    list.push({
        id: "macka-0", type: "macka",
        x: -200, y: H * 0.6 + H * 0.02,
        speed: 1, direction: "left",
        spawnAt: CATFISH_APPEAR_AT,
        offset: 0, active: false, gone: false,
    });

    list.push({
        id: "modrulj-0", type: "modrulj",
        x: W + 200, y: H * 0.20,
        speed: -0.35,
        direction: "right",
        spawnAt: 1,
        offset: 0, active: false, gone: false,
    });

    return list;
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function OceanExperiment() {
    const [phase, setPhase] = useState<Phase>("start");
    const [countdown, setCountdown] = useState<number>(Math.ceil(EXPERIMENT_DURATION / 1000));
    const [userCount, setUserCount] = useState<string>("");
    const [noticedOption, setNoticedOption] = useState<NoticedOption | null>(null);
    const [result, setResult] = useState<ExperimentResult | null>(null);

    const sceneRef = useRef<HTMLDivElement>(null);
    const fishRef = useRef<Fish[]>([]);
    const fishElsRef = useRef<Record<string, HTMLDivElement>>({});
    const rafRef = useRef<number>(0);
    const startRef = useRef<number>(0);

    const startExperiment = useCallback(() => setPhase("experiment"), []);

    useEffect(() => {
        if (phase !== "experiment") return;
        const scene = sceneRef.current;
        if (!scene) return;
        const W = scene.clientWidth;
        const H = scene.clientHeight;

        fishRef.current = buildFish(W, H);
        fishElsRef.current = {};
        startRef.current = performance.now();

        const tick = (now: number): void => {
            const elapsed = now - startRef.current;
            setCountdown(Math.max(0, Math.ceil((EXPERIMENT_DURATION - elapsed) / 1000)));

            fishRef.current.forEach((f: Fish) => {
                if (f.gone) return;
                if (!f.active && elapsed >= f.spawnAt) f.active = true;
                if (!f.active) return;

                const t = elapsed / 1000;
                f.x += f.speed;


                const margin = f.type === "macka" ? 250 : 80;
                if ((f.speed > 0 && f.x > W + margin) || (f.speed < 0 && f.x < -margin)) {
                    f.gone = true;
                }

                const el = fishElsRef.current[f.id];
                if (el) {
                    el.style.transform = `translate(${f.x}px,${f.y}px)`;
                    el.style.opacity = f.type === "modrulj" ? "0.3" : "1";
                }
            });

            if (elapsed >= EXPERIMENT_DURATION) {
                cancelAnimationFrame(rafRef.current);
                setPhase("question");
                return;
            }
            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [phase]);

    const handleSubmit = (): void => {
        if (!userCount || noticedOption === null) return;
        setResult({
            sardineCountUser: parseInt(userCount, 10),
            sardineActual: SARDINE_ACTUAL,
            noticedCatfish: noticedOption === "large",
        });
        setPhase("results");
    };

    const restart = (): void => {
        setPhase("start");
        setUserCount("");
        setNoticedOption(null);
        setResult(null);
        setCountdown(Math.ceil(EXPERIMENT_DURATION / 1000));
        fishRef.current = [];
        fishElsRef.current = {};
    };

    const options: { value: NoticedOption; label: string }[] = [
        { value: "large", label: "A large fish passed by" },
        { value: "change", label: "Something seemed to change" },
        { value: "nothing", label: "Nothing unusual" },
    ];

    return (
        <>
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Mono:wght@300;400&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        body{background:#070f1e}

        @keyframes bubbleRise{
          0%{transform:translateY(0) scale(1);opacity:.55}
          90%{opacity:.25}
          100%{transform:translateY(-700px) scale(1.5);opacity:0}
        }
        @keyframes sway{0%{transform:rotate(-7deg)}100%{transform:rotate(7deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 18px rgba(126,200,227,.28)}50%{box-shadow:0 0 36px rgba(126,200,227,.6)}}
        @keyframes swimPreview{
          0%{transform:translateX(-90px)}
          100%{transform:translateX(520px)}
        }

        .scene{
          position:relative;width:100%;max-width:900px;aspect-ratio:16/9;
          overflow:hidden;border-radius:16px;
          background:linear-gradient(180deg,#1a4a7a 0%,#1060a8 32%,#0d4d8a 66%,#0a3d6d 100%);
          box-shadow:0 0 80px rgba(16,96,168,.45),inset 0 0 80px rgba(0,0,0,.25);
        }
        .caustics{
          position:absolute;inset:0;pointer-events:none;
          background:
            radial-gradient(ellipse 60% 30% at 20% 18%,rgba(126,200,227,.08) 0%,transparent 70%),
            radial-gradient(ellipse 40% 22% at 75% 14%,rgba(126,200,227,.06) 0%,transparent 60%);
        }
        .scanlines{
          position:absolute;inset:0;pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.011) 3px,rgba(255,255,255,.011) 4px);
        }
        .seabed{
          position:absolute;bottom:0;left:0;right:0;height:20%;
          background:linear-gradient(180deg,transparent 0%,rgba(20,55,25,.45) 45%,rgba(14,45,18,.75) 100%);
        }
        .fish-item{
          position:absolute;top:0;left:0;will-change:transform;
          opacity:0;transition:opacity .25s;
          filter:drop-shadow(0 3px 8px rgba(0,0,0,.35));
        }
        .btn{
          display:inline-block;padding:13px 40px;
          background:linear-gradient(135deg,#7EC8E3,#4fa8c8);
          color:#071424;font-family:'DM Mono',monospace;font-size:14px;
          letter-spacing:.1em;text-transform:uppercase;
          border:none;border-radius:40px;cursor:pointer;
          animation:glow 2.5s infinite;
          transition:transform .15s,opacity .15s;
        }
        .btn:hover{transform:scale(1.04)}
        .btn:active{transform:scale(.97)}
        .btn:disabled{opacity:.35;cursor:default;animation:none}
        .pill{
          display:flex;align-items:center;gap:12px;
          padding:13px 20px;border-radius:11px;width:100%;text-align:left;
          border:1.5px solid rgba(126,200,227,.22);
          background:rgba(126,200,227,.04);
          color:#c8e8f4;font-family:'DM Mono',monospace;font-size:13px;
          cursor:pointer;transition:all .16s;
        }
        .pill:hover{border-color:rgba(126,200,227,.55);background:rgba(126,200,227,.09)}
        .pill.sel{border-color:#7EC8E3;background:rgba(126,200,227,.16);color:#fff}
        .card{
          background:rgba(14,36,64,.78);border:1px solid rgba(126,200,227,.18);
          border-radius:20px;padding:36px 40px;backdrop-filter:blur(14px);
        }
        .mono{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:rgba(126,200,227,.65)}
      `}</style>

            <div style={{
                minHeight: "100vh", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                background: "linear-gradient(160deg,#060d1a 0%,#0a1628 60%,#050e1c 100%)",
                padding: "24px 16px", fontFamily: "'Playfair Display',serif",
            }}>

                {/* Header */}
                <div style={{ textAlign: "center", marginBottom: 26, animation: "fadeUp .8s ease both" }}>
                    <div className="mono" style={{ marginBottom: 10 }}>Human-Computer Interaction Lab</div>
                    <h1 style={{ fontSize: "clamp(22px,4vw,40px)", fontWeight: 700, color: "#e8f4fc", lineHeight: 1.15, letterSpacing: "-.01em" }}>
                        The Ocean <em style={{ color: "#7EC8E3" }}>Attention</em> Experiment
                    </h1>
                </div>

                {/* ══ START ══ */}
                {phase === "start" && (
                    <div style={{ maxWidth: 520, width: "100%", animation: "fadeUp .85s .1s ease both", opacity: 0 }}>
                        <div className="card" style={{ marginBottom: 22 }}>

                            {/* Sardine preview strip */}
                            <div style={{
                                position: "relative", overflow: "hidden", height: 64, borderRadius: 10, marginBottom: 24,
                                background: "linear-gradient(90deg,rgba(8,28,58,.9),rgba(12,40,80,.95),rgba(8,28,58,.9))",
                                border: "1px solid rgba(126,200,227,.18)",
                            }}>
                                {[0, 1, 2, 3].map(i => (
                                    <div key={i} style={{
                                        position: "absolute",
                                        top: "50%", marginTop: -13,
                                        animation: `swimPreview ${3.5 + i * 1.2}s ${i * 0.9}s linear infinite`,
                                    }}>
                                        <img
                                            src="/srdela.png"
                                            alt="sardine"
                                            style={{ width: 52, height: "auto", display: "block", transform: "scaleX(-1)" }}
                                        />
                                    </div>
                                ))}
                                <div style={{
                                    position: "absolute", inset: 0,
                                    display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
                                    padding: "0 12px 7px",
                                    fontFamily: "'DM Mono',monospace", fontSize: 10,
                                    letterSpacing: ".14em", color: "rgba(126,200,227,.38)",
                                    textTransform: "uppercase", pointerEvents: "none",
                                }}>
                                    sardine
                                </div>
                            </div>

                            <p style={{ color: "#c8e8f4", fontSize: 16, lineHeight: 1.8, marginBottom: 12 }}>
                                Observe the reef and count how many{" "}
                                <strong style={{ color: "#7EC8E3" }}>sardines</strong>{" "}
                                swim across the screen.
                            </p>
                            <p style={{ color: "rgba(200,232,244,.55)", fontSize: 14, lineHeight: 1.75, marginBottom: 20 }}>

                                The experiment lasts <strong style={{ color: "#c8e8f4" }}>26 seconds</strong>.
                            </p>
                            <div style={{
                                padding: "12px 16px",
                                background: "rgba(126,200,227,.04)", border: "1px dashed rgba(126,200,227,.16)",
                                borderRadius: 9, fontFamily: "'DM Mono',monospace", fontSize: 11.5,
                                color: "rgba(200,232,244,.4)", lineHeight: 1.65,
                            }}>
                                Behavioral experiment studying selective attention.
                                Anonymized data collected for research purposes.
                            </div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <button className="btn" onClick={startExperiment}>Start Dive</button>
                        </div>
                    </div>
                )}

                {/* ══ EXPERIMENT ══ */}
                {phase === "experiment" && (
                    <div style={{ width: "100%", maxWidth: 900, animation: "fadeUp .4s ease both" }}>
                        <div className="scene" ref={sceneRef}>
                            <div className="caustics" />
                            <div className="scanlines" />
                            {SEAWEEDS.map(s => <Seaweed key={s.id} x={s.x} height={s.height} delay={s.delay} />)}
                            {BUBBLES.map(b => <Bubble key={b.id} x={b.x} size={b.size} duration={b.duration} delay={b.delay} />)}
                            <div className="seabed" />
                            <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                                {fishRef.current.map(f => (
                                    <div
                                        key={f.id}
                                        className="fish-item"
                                        ref={(el: HTMLDivElement | null) => { if (el) fishElsRef.current[f.id] = el; }}
                                        style={{ zIndex:
                                                f.type === "modrulj" ? 0 :
                                                    f.type === "macka" ? 1 :
                                                        f.type === "srdela" ? 3 : 2,
                                        }}
                                    >
                                        <img

                                            src={
                                                f.type === "srdela"
                                                    ? "/srdela.png"
                                                    : f.type === "trlja"
                                                        ? "/trlja.png"
                                                        : f.type === "knez"
                                                            ? "/knez.png"
                                                            : f.type === "modrulj"
                                                                ? "/modrulj.png"
                                                                : "/macka.png"
                                            }
                                            alt={f.type}
                                            style={{
                                                width:
                                                    f.type === "macka" ? 200 :
                                                        f.type === "modrulj" ? 150 :
                                                            f.type === "srdela" ? 58 :
                                                                f.type === "knez" ? 50 : 52,
                                                height: "auto",
                                                transform: f.direction === "left" ? "scaleX(-1)" : "none",
                                                display: "block",
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                            {/* HUD */}
                            <div style={{
                                position: "absolute", top: 14, left: 14,
                                background: "rgba(6,16,34,.7)", border: "1px solid rgba(126,200,227,.32)",
                                borderRadius: 20, padding: "7px 16px", backdropFilter: "blur(6px)",
                                fontFamily: "'DM Mono',monospace", fontSize: 12, letterSpacing: ".08em", color: "#7EC8E3",
                            }}>Count sardines</div>
                            <div style={{
                                position: "absolute", top: 14, right: 14, width: 48, height: 48, borderRadius: "50%",
                                background: "rgba(6,16,34,.7)", border: "2px solid rgba(126,200,227,.38)",
                                backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center",
                                fontFamily: "'DM Mono',monospace", fontSize: 18, color: "#7EC8E3",
                            }}>{countdown}</div>
                        </div>
                    </div>
                )}

                {/* ══ QUESTION ══ */}
                {phase === "question" && (
                    <div style={{ maxWidth: 500, width: "100%", animation: "fadeUp .5s ease both" }}>
                        <div className="card">
                            <h2 style={{ color: "#e8f4fc", fontSize: 21, fontWeight: 700, marginBottom: 28 }}>How did you do?</h2>
                            <div style={{ marginBottom: 28 }}>
                                <div className="mono" style={{ marginBottom: 10 }}>How many sardines did you count?</div>
                                <input
                                    type="number" min="0" max="40"
                                    value={userCount}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUserCount(e.target.value)}
                                    placeholder="0"
                                    style={{
                                        width: "100%", padding: "13px 18px",
                                        background: "rgba(126,200,227,.06)",
                                        border: "1.5px solid rgba(126,200,227,.28)",
                                        borderRadius: 10, color: "#e8f4fc",
                                        fontFamily: "'DM Mono',monospace", fontSize: 24,
                                        outline: "none",
                                    }}
                                />
                            </div>
                            <div style={{ marginBottom: 30 }}>
                                <div className="mono" style={{ marginBottom: 12 }}>Did you notice anything unusual?</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                                    {options.map(opt => (
                                        <button
                                            key={opt.value}
                                            className={`pill ${noticedOption === opt.value ? "sel" : ""}`}
                                            onClick={() => setNoticedOption(opt.value)}
                                        >
                                            <span style={{
                                                width: 16, height: 16, borderRadius: "50%", flexShrink: 0, border: "2px solid",
                                                borderColor: noticedOption === opt.value ? "#7EC8E3" : "rgba(126,200,227,.3)",
                                                background: noticedOption === opt.value ? "#7EC8E3" : "transparent",
                                            }} />
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                className="btn"
                                style={{ width: "100%", textAlign: "center" }}
                                onClick={handleSubmit}
                                disabled={!userCount || noticedOption === null}
                            >
                                See Results
                            </button>
                        </div>
                    </div>
                )}

                {/* ══ RESULTS ══ */}
                {phase === "results" && result && (
                    <div style={{ maxWidth: 520, width: "100%", animation: "fadeUp .55s ease both" }}>
                        <div className="card" style={{ marginBottom: 14 }}>
                            <h2 style={{ color: "#e8f4fc", fontSize: 21, fontWeight: 700, marginBottom: 26 }}>Your Results</h2>
                            <div style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "18px 0", borderBottom: "1px solid rgba(126,200,227,.12)", marginBottom: 22,
                            }}>
                                <div>
                                    <div className="mono">You counted</div>
                                    <div style={{ fontSize: 44, fontWeight: 700, color: "#e8f4fc", lineHeight: 1.1 }}>{result.sardineCountUser}</div>
                                </div>
                                <div style={{ color: "rgba(200,232,244,.22)", fontSize: 26 }}>vs</div>
                                <div style={{ textAlign: "right" }}>
                                    <div className="mono">Actual</div>
                                    <div style={{ fontSize: 44, fontWeight: 700, color: "#7EC8E3", lineHeight: 1.1 }}>{result.sardineActual}</div>
                                </div>
                            </div>

                            {!result.noticedCatfish ? (
                                <div style={{
                                    background: "rgba(230,155,50,.07)", border: "1px solid rgba(230,155,50,.28)",
                                    borderRadius: 12, padding: "20px 22px", marginBottom: 20,
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                                        <img src="/macka.png" alt="catfish" style={{ width: 60, height: "auto", opacity: 0.85 }} />
                                        <p style={{ color: "#f0cc80", fontWeight: 700, fontSize: 16 }}>You missed the catfish.</p>
                                    </div>
                                    <p style={{ color: "rgba(240,204,128,.72)", fontSize: 14, lineHeight: 1.7 }}>
                                        A large catfish slowly crossed the screen around the 9-second mark.
                                        This is <em>inattentional blindness</em> — your brain suppressed it
                                        while focused on counting.
                                    </p>
                                </div>
                            ) : (
                                <div style={{
                                    background: "rgba(50,200,110,.07)", border: "1px solid rgba(50,200,110,.28)",
                                    borderRadius: 12, padding: "20px 22px", marginBottom: 20,
                                }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                                        <img src="/macka.png" alt="catfish" style={{ width: 60, height: "auto", opacity: 0.85 }} />
                                        <p style={{ color: "#90f0b0", fontWeight: 700, fontSize: 16 }}>You spotted the catfish.</p>
                                    </div>
                                    <p style={{ color: "rgba(144,240,176,.72)", fontSize: 14, lineHeight: 1.7 }}>
                                        Impressive — you noticed the large catfish despite the counting task.
                                        Most people miss it due to <em>selective attention</em>.
                                    </p>
                                </div>
                            )}

                            <div style={{
                                fontFamily: "'DM Mono',monospace", fontSize: 12,
                                color: "rgba(200,232,244,.38)", textAlign: "center", lineHeight: 1.7,
                            }}>
                                ~52% of participants miss the catfish entirely.<br />
                                Simons &amp; Chabris, 1999 — Inattentional Blindness.
                            </div>
                        </div>

                        <div style={{
                            background: "rgba(12,30,56,.55)", border: "1px solid rgba(126,200,227,.1)",
                            borderRadius: 14, padding: "22px 26px", marginBottom: 20,
                        }}>
                            <div className="mono" style={{ marginBottom: 12 }}>What just happened?</div>
                            <p style={{ color: "rgba(200,232,244,.62)", fontSize: 14, lineHeight: 1.75 }}>
                                <strong style={{ color: "#c8e8f4" }}>Inattentional blindness</strong> — when your brain
                                is occupied with a task, it actively suppresses irrelevant stimuli. Even large,
                                slow-moving objects become effectively invisible. This matters for interface design,
                                aviation safety, and medical imaging.
                            </p>
                        </div>

                        <div style={{ textAlign: "center" }}>
                            <button className="btn" onClick={restart}>Try Again</button>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}