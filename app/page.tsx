'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ParticleBackground from './components/ParticleBackground';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Sim {
  id: number;
  href: string;
  num: string;
  type: string;
  question: string;
  desc: string;
  concept: string;
  previews?: string[];
  cx: number;
  cy: number;
  live: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const sims: Sim[] = [
  {
    id: 1,
    href: '/fireflies',
    num: '01',
    type: 'Sampling',
    question: "What makes a good sample?",
    desc: 'Chase fireflies in the dark. Watch what you catch — and what you miss.',
    concept: 'Sampling variability · Bias · Representativeness · Population vs sample',
    previews: ['/prev-f1.png', '/prev-f2.png', '/prev-f3.png'],
    cx: 10, cy: 80,
    live: true,
  },
  {
    id: 2,
    href: '/stars',
    num: '02',
    type: 'Correlation',
    question: 'Can one data point fool you?',
    desc: 'Move the stars and watch the relationship change.',
    concept: 'Pearson r · Regression · Residuals · Outlier influence · Spearman rank correlation · Correlation vs causation',
    previews: ['/prev-s1.png', '/prev-s2.png', '/prev-s3.png'],

    cx: 35, cy: 45,
    live: true,
  },
  {
    id: 3,
    href: '/garden',
    num: '03',
    type: 'Experimental Design',
    question: 'Can you trust your data?',
    desc: 'Plant seeds, run experiments, watch your confidence shrink.',
    concept: 'Sample size · p-value · Significance · Confidence intervals · Hypothesis testing · Effect size · Confounding variables',
    previews: ['/prev-g1.png', '/prev-g2.png', '/prev-g3.png'],
    cx: 60, cy: 25,
    live: true,
  },
  {
    id: 4,
    href: '#',
    num: '04',
    type: 'Estimation',
    question: "How do you count what you can't see?",
    desc: 'A concept in progress.',
    concept: 'Coming soon',
    previews: ['/prev-st1.png'],
    cx: 85, cy: 20,
    live: false,
  },
];




// ─── Dot Chart ────────────────────────────────────────────────────────────────
function DotChart({ activeId, onHover }: {
  activeId: number | null;
  onHover: (id: number | null) => void;
}) {
  const liveDots = sims.filter(t => t);
  const AXIS_H = 40;

  return (
    <div className="relative w-full h-full border-l-2 border-b-2 border-[#3a3a34] bg-white/[0.012]">
      {/* Connector lines */}
      <svg
        className="absolute left-0 top-0 w-full overflow-visible pointer-events-none"
        style={{ height: `calc(100% - ${AXIS_H}px)` }}
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {liveDots.slice(0, -1).map((a, i) => {
          const b = liveDots[i + 1];
          return (
            <line
              key={a.id}
              x1={`${a.cx}%`} y1={`${a.cy}%`}
              x2={`${b.cx}%`} y2={`${b.cy}%`}
              stroke="rgba(201,160,0,0.22)"
              strokeWidth="0.5"
              strokeDasharray="3 3"
            />
          );
        })}
        {(() => {
          const last = liveDots[liveDots.length - 1];
          const cs = sims[sims.length - 1];
          return (
            <line
              x1={`${last.cx}%`} y1={`${last.cy}%`}
              x2={`${cs.cx}%`} y2={`${cs.cy}%`}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.5"
              strokeDasharray="2 6"
            />
          );
        })()}
      </svg>

      {/* Dots */}
      {sims.map(sim => {
        const isActive = activeId === sim.id;
        return (
          <div
            key={sim.id}
            onMouseEnter={() => sim && onHover(sim.id)}
            onClick={() => sim && (window.location.href = sim.href)}
            className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${sim.cx}%`,
              top: `calc(${sim.cy}% * ((100% - ${AXIS_H}px) / 100%))`,
            }}
          >
            {/* tooltip */}
            <div
              className={[
                'absolute pointer-events-none rounded-lg bg-[#0d0d0b] border border-white/[0.08]',
                'px-[0.85rem] py-[0.55rem] whitespace-nowrap min-w-[170px] z-50',
                'transition-opacity duration-150',
                isActive ? 'opacity-100' : 'opacity-0',
              ].join(' ')}
              style={{ bottom: 'calc(100% + 12px)', left: '50%', transform: 'translateX(-50%)' }}
            >
              <span className="block font-bold mb-0.5 font-[Kanit] text-xs text-[#c9a000] tracking-[0.1em]">
                {sim.num}
              </span>
              <span className="block font-base font-[Kanit] text-sm text-[#f0efe8] tracking-[0.02em]">
                {sim.question}
              </span>
              <span className="block font-semibold mt-0.5 font-[Mukta] text-xs text-[#c9a000]">
                // {sim.type}
              </span>
              <span className="block font-normal mt-1 font-[Kanit] text-xs text-stone-400 tracking-[0.04em]">
                {sim.live
                  ? <><span className="text-[#c9a000]">+</span> Click to explore</>
                  : 'Coming soon'}
              </span>
            </div>

            {/* Dot */}
            <div
              className={[
                'relative rounded-full border-2 border-[#0a0a08] transition-all duration-[180ms]',
                !sim
                  ? 'bg-white/10 shadow-[0_0_0_1.5px_rgba(255,255,255,0.1)]'
                  : isActive
                    ? 'bg-[#FFCC00] shadow-[0_0_0_1.5px_#c9a000,0_0_12px_rgba(255,204,0,0.35)] scale-125'
                    : 'bg-[#6a6a64] shadow-[0_0_0_1.5px_#6a6a64]',
              ].join(' ')}
              style={{ width: 14, height: 14, cursor: sim ? 'pointer' : 'default' }}
            >
              <div
                className={[
                  'absolute inset-[-6px] rounded-full border animate-[pulse_2.5s_ease-out_infinite]',
                  isActive
                    ? 'border-[rgba(201,160,0,0.4)]'
                    : sim
                      ? 'border-[rgba(201,160,0,0.15)]'
                      : 'border-white/[0.04]',
                ].join(' ')}
              />
            </div>
          </div>
        );
      })}

      {/* X Axis line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/[0.07]">
        {sims.map(sim => (
          <div
            key={sim.id}
            className="absolute -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${sim.cx}%` }}
          >
            {/* Tick */}
            <div className={`w-0.5 h-2 ${sim ? 'bg-[#c9a000]' : 'bg-[#3a3a34]'}`} />
            {/* Label */}
            <span
              className={`mt-0.5 font-normal whitespace-nowrap font-[Kanit] text-xs tracking-[0.06em] ${sim ? 'text-stone-400' : 'text-stone-400'
                }`}
            >
              {sim.type}
            </span>
          </div>
        ))}
      </div>

      {/* Axis labels */}
      <span className="absolute flex items-center gap-1.5 font-normal uppercase bottom-[1.5rem] right-0 font-[Kanit] text-xs tracking-[0.1em] text-stone-400">
        Concepts <span className="text-[#c9a000]">+</span>
      </span>
      <span
        className="absolute flex items-center gap-1.5 font-normal uppercase top-0 left-[-3rem] font-[Kanit] text-xs tracking-[0.1em] text-stone-400"
        style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}
      >
        Complexity <span className="text-[#c9a000]">+</span>
      </span>
    </div>
  );
}

// ─── Sim Card ────────────────────────────────────────────────────────────────
function SimCard({ sim, isActive, onHover }: {
  sim: Sim;
  isActive: boolean;
  onHover: (id: number | null) => void;
}) {
  return (
    <Link
      href={sim ? sim.href : '#'}
      onMouseEnter={() => sim && onHover(sim.id)}
      className={[
        'sim-card grid items-stretch no-underline transition-all duration-200',
        'border-b border-stone-700',
        isActive
          ? 'border-l-2 border-l-[#FFCC00] '
          : 'border-l-2 border-l-[#3a3a34]',
        sim ? 'cursor-pointer opacity-100' : 'cursor-default opacity-35 pointer-events-none',
      ].join(' ')}
      style={{ gridTemplateColumns: '80px 1fr 1fr auto auto', color: 'inherit' }}
    >

      {/* Number */}
      <div className="p-8 flex items-center ">
        <span
          className={`font-bold leading-none font-[Kanit] text-[3.5rem] tracking-[-0.02em] transition-colors duration-200 ${isActive ? 'text-[#FFCC00]' : 'text-stone-400'}`}
        >
          {sim.num}
        </span>
      </div>

      {/* Type + Question */}
      <div className="p-8 flex flex-col justify-center border-r border-stone-700">
        <p className="font-semibold uppercase mb-2 font-[Kanit] text-[0.6rem] tracking-[0.12em] text-[#c9a000]">
          {sim.type}{!sim && ' — coming soon'}
        </p>
        <p
          className="font-normal leading-tight font-[Kanit] text-base   text-[#f0efe8]"
        >
          {sim.question}
        </p>
      </div>

      {/* Description — hidden on mobile */}
      <div className="p-8 flex-col justify-center hidden md:flex border-r border-stone-700">

        <span className={`inline-flex items-center font-normal uppercase w-fit font-[Kanit] text-xs tracking-[0.1em] px-[0.55rem] py-[0.18rem]
        ${isActive ? 'text-[#c9a000]' : 'text-stone-400'}`}>
          // {sim.concept}
        </span>


      </div>

      {/* Preview images — only if previews exist */}
      {sim.previews && (
        <div className="relative overflow-hidden hidden md:flex items-center justify-center border-r border-stone-700 h-[150px] w-[150px]">
          <img src={sim.previews[0]} alt="" className="prev-img prev-img-1" />
          <img src={sim.previews[1]} alt="" className="prev-img prev-img-2" />
          <img src={sim.previews[2]} alt="" className="prev-img prev-img-3" />

          {/*
 <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" overflow="visible">
    <rect
  className="border-draw-rect"
  fill="none"
  stroke="#c9a000"
  strokeWidth="1"
  width="calc(100% - 2px)"
  height="calc(100% - 2px)"
  x="1"
  y="1"
  strokeDasharray="9999"
  strokeDashoffset="9999"
  style={{ transition: 'stroke-dashoffset 5s ease-out' }}
/>
  </svg>
  */}

        </div>
      )}

      {/* Arrow — hidden on mobile */}
      <div className="p-6 items-center justify-center hidden md:flex">
        <span
          className={`block font-[Kanit] text-[1.1rem] transition-all duration-200 ${isActive ? 'text-[#c9a000] translate-x-[3px] -translate-y-[3px]' : 'text-stone-400'}`}
        >
          ↗
        </span>
      </div>


    </Link>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ItDependsHome() {
  const [activeId, setActiveId] = useState<number | null>(1);

  useEffect(() => {
    function updatePerimeters() {
      document.querySelectorAll('.sim-card').forEach(card => {
        const el = card as HTMLElement;
        const rect = card.querySelector('.border-draw-rect') as SVGGeometryElement | null;
        if (!rect) return;
        const p = 2 * (el.offsetWidth + el.offsetHeight);
        rect.setAttribute('stroke-dasharray', String(p));
        rect.setAttribute('stroke-dashoffset', String(p));

        card.addEventListener('mouseenter', () => {
          (rect as any).style.transition = 'stroke-dashoffset 1s ease-out';
          (rect as any).style.strokeDashoffset = '0';
        });
        card.addEventListener('mouseleave', () => {
          (rect as any).style.transition = 'stroke-dashoffset 0.3s ease-in';
          (rect as any).style.strokeDashoffset = String(p);
        });
      });
    }

    updatePerimeters();
    window.addEventListener('resize', updatePerimeters);
    return () => window.removeEventListener('resize', updatePerimeters);
  }, []);


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&family=Mukta:wght@300;400;500;600&display=swap');

        @keyframes pulse {
          0%  { transform: scale(0.7); opacity: 0.8; }
          100% { transform: scale(1.8); opacity: 0; }
        }

       

      `}</style>



      {/* ── HERO SPLIT ── */}
      <section
        className="min-h-screen pt-[54px] grid grid-cols-1 xl:grid-cols-[1fr_2fr] bg-[#0a0a08]"
      >
        {/* LEFT */}
        <div className="flex flex-col justify-center px-6 py-12 px-[5.5rem] md:py-16 ">
          <p className="flex items-center gap-2.5 font-normal uppercase mb-5 font-[Kanit] text-xs tracking-[0.22em] text-stone-400">
            <span className="font-bold text-[#c9a000]">//</span>
            Linea Nera series
          </p>

          <h1 className="font-bold leading-[0.92] mb-[0.15em] font-[Kanit] text-8xl text-[#f0efe8] tracking-[-0.02em]">
            It<br />Depends
          </h1>

          <div className="w-[320px] h-0.5 my-6 bg-[#FFCC00]" />

          <p className="font-normal leading-[1.85] max-w-[420px] mb-8 font-[Mukta] text-base text-[#b8b7b0]">
            Interactive playground for exploring uncertainty.<br />
            <em className="not-italic font-normal text-[#f0efe8]">
              Not your usual statistics.
            </em>
          </p>

          <div className="flex items-center gap-5 flex-wrap">
            <a
              href="#sims"
              className="inline-flex items-center gap-1.5 font-[Kanit] text-[0.85rem] text-[#f0efe8] no-underline border border-stone-500 px-[1.35rem] py-[0.55rem] tracking-[0.02em] transition-all duration-200 hover:border-[#c9a000] hover:bg-[rgba(255,204,0,0.07)]"
            >
              Take a pick
            </a>
            <a
              href="https://lineanera.hr"
              className="flex items-center gap-1 font-normal no-underline transition-all hover:text-[#FFCC00] font-[Kanit] text-[0.8rem] text-stone-400"
            >
              About the author <span className="text-[#c9a000]">+</span>
            </a>
          </div>

          {/* Mini stats */}
          <div className="flex gap-8 mt-12">
            {[
              { val: '03', label: 'sims live' },
              { val: '20 +', label: 'concepts' },
              { val: '∞', label: 'uncertainty' },
            ].map(({ val, label }) => (
              <div key={label}>
                <div className="font-bold leading-none font-[Kanit] text-[1.6rem] text-[#f0efe8] tracking-[-0.02em]">
                  {val}
                </div>
                <div className="font-normal uppercase mt-1.5 font-[Kanit] text-[0.6rem] tracking-[0.12em] text-stone-400">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col justify-center gap-5 px-6 py-12 md:px-[5.5rem] md:py-20">
          <p className="flex items-center gap-2.5 font-base uppercase font-[Kanit] text-[0.62rem] tracking-[0.18em] text-[#c9a000]">
            <span className="font-bold text-[#FFCC00] text-[0.85rem]">//</span>
            Connect the dots
          </p>

          <div className="relative flex-1 min-h-[260px] mb-8 ml-14">
            <DotChart activeId={activeId} onHover={setActiveId} />
          </div>
        </div>
      </section>

      {/* ── QUOTE BAND ── */}
      <div className="bg-[rgba(255,204,0,0.035)] border-t border-[rgba(255,204,0,0.1)] border-b border-b-[rgba(255,204,0,0.1)]">
        <div className="px-6 py-14 md:px-[5.5rem]">
          <p className="font-normal leading-[1.65] max-w-[620px] font-[Kanit] text-[clamp(1rem,2.2vw,1.35rem)] text-[#b8b7b0] tracking-[0.01em]">
            No formulas. No anxiety. {' '}
            <span className="font-base text-[#c9a000] ">
              Only intuition.
            </span>

          </p>
        </div>
      </div>

      {/* ── Sim LIST ── */}
      <div id="sims" className="px-6 pb-10 md:px-[5.5rem] bg-[#0a0a08]">
        <p className="flex items-center gap-2.5 font-normal uppercase mb-8 pt-4 font-[Kanit] text-[0.65rem] tracking-[0.18em] text-stone-400">
          <span className="text-stone-400 text-[0.85rem]">//</span>
          All simulations
        </p>
        <div className="border-t border-stone-700">
          {sims.map(sim => (
            <SimCard
              key={sim.id}
              sim={sim}
              isActive={activeId === sim.id}
              onHover={setActiveId}
            />
          ))}
        </div>
      </div>

      {/* ── ABOUT BAND ── */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="quote-band-inner" style={{ padding: '5rem 5.5rem' }}>

          <p className="flex items-center gap-[0.6rem] mb-8 font-[Kanit] font-medium text-xs tracking-[0.18em] uppercase text-[#c9a000]">
            <span className="font-bold text-xs text-[#FFCC00]">//</span>
            WHO IS THIS FOR
          </p>

          <div className="max-w-[650px] flex flex-col gap-5">
            <p className="font-[Mukta] text-base  leading-[1.9] text-[#b8b7b0]">
              Statistics anxiety is real. Research shows it affects up to{' '}
              <span className="text-[#f0efe8] font-normal">80% of graduate students</span> in research-related programs.
              For many, trying to pass a test is torture.</p>

            <p className="font-[Mukta] text-base  leading-[1.9] text-[#b8b7b0]">
              It's not about intelligence. It's because formulas are taught before meaning is understood.
              Even experienced analysts run A/B tests and stop early when the numbers look good. Researchers sometimes interpret correlation as causation.
            </p>

            <p className="font-[Mukta] text-base  text-[#b8b7b0]">
              <span className="text-[#f0efe8] font-normal">It Depends</span>{' '}
              is built on a different assumption: understanding comes from experience,
              not explanation. This is a place where you can build intuition and critical
              thinking. Each simulation asks the same underlying question from a different angle. <em>Can you trust what you're seeing?</em>
              <br />The answer is almost always: <em>it depends</em>. </p>

            <p className="font-[Mukta] text-base  text-[#b8b7b0]">
              These simulations are for anyone curious, anyone who ever glazed over in a stats class, or left wondering if the problem was
              them. It wasn't.
            </p>

            <p className="font-[Kanit] font-normal text-base text-[#f0efe8] mt-2">
              If you have any thoughts on this project or ideas for future simulations —{' '}
              <a
                href="https://nektardizajn.hr"
                className="text-[#c9a000] no-underline transition-colors duration-150 hover:text-[#FFCC00]"
              >
                let's chat.
              </a>

            </p>
          </div>

        </div>
      </div>



      {/* ── FOOTER ── */}
      <footer className="bg-[#060605] border-t border-white/[0.04]">
        <div className="px-6 py-6 md:px-[5.5rem] flex justify-between items-center">
          <span className="flex items-center gap-1.5 font-normal font-[Kanit] text-[0.72rem] text-stone-400 tracking-[0.04em]">
            <span className="font-bold text-[#c9a000]">//</span>
            It Depends — {new Date().getFullYear()}
          </span>
          <span className="font-normal font-[Kanit] text-[0.72rem] text-stone-400 tracking-[0.04em]">
            part of{' '}
            <a href="https://lineanera.hr" className="text-stone-400 no-underline">
              lineanera<span className="font-bold text-[#c9a000]">.</span>hr
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}