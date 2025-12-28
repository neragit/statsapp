'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

type Firefly = {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  color: string;
};

const COLORS = ['#f9d71c', '#ff6f61', '#6af59c', '#6bb0ff', '#ff9ff3'];
const FIREFLY_SIZE = 12;
const HIT_RADIUS = 20;
const HIT_RADIUS_SQ = HIT_RADIUS * HIT_RADIUS;

export default function SamplingFireflies() {
  const [fireflies, setFireflies] = useState<Firefly[]>([]);
  const firefliesRef = useRef<Firefly[]>([]); // ✅ animation without recreating objects

  const [histCounts, setHistCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const [, forceRender] = useState(0); // only to show/hide cursor

  const [userAnswer, setUserAnswer] = useState('');
  const [biasAnswer, setBiasAnswer] = useState('');
  const [sizeAnswer, setSizeAnswer] = useState('');
  const [exactAnswer, setExactAnswer] = useState('');
  const [showPercent, setShowPercent] = useState(false);
  const [showGoodSample, setShowGoodSample] = useState(false);
  const [isTouching, setIsTouching] = useState(false);

  const router = useRouter();
  const totalCollected = histCounts.reduce((a, b) => a + b, 0);

  /* -------------------- INIT -------------------- */
  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth: width, clientHeight: height } = containerRef.current;

    const initial: Firefly[] = Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      dx: (Math.random() - 0.5) * 1.5,
      dy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    firefliesRef.current = initial;
    setFireflies(initial);
  }, []);

  /* -------------------- ANIMATION LOOP (30 FPS) -------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      firefliesRef.current.forEach(f => {
        f.x += f.dx;
        f.y += f.dy;
      });
      setFireflies([...firefliesRef.current]); // cheap shallow copy
    }, 30);

    return () => clearInterval(interval);
  }, []);

  /* -------------------- CATCH LOGIC -------------------- */
  const handleCatch = (e: React.MouseEvent | React.TouchEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clientX =
      'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY =
      'touches' in e ? e.touches[0].clientY : e.clientY;

    mousePosRef.current = { x: clientX, y: clientY };

    if (!isDragging) return;

    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const removed: Firefly[] = [];

    firefliesRef.current = firefliesRef.current.filter(f => {
      const dx = f.x + f.size - mx;
      const dy = f.y + f.size - my;
      if (dx * dx + dy * dy <= HIT_RADIUS_SQ) {
        removed.push(f);
        return false;
      }
      return true;
    });

    if (!removed.length) return;

    setFireflies([...firefliesRef.current]);

    setHistCounts(prev => {
      const next = [...prev];
      removed.forEach(f => {
        const idx = COLORS.indexOf(f.color);
        if (idx >= 0) next[idx]++;
      });
      return next;
    });
  };

  /* -------------------- UI HELPERS -------------------- */
  const Bubble = ({ color, size }: { color: string; size: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
      }}
    />
  );

const renderRadio = (answer: string, setAnswer: (a: string) => void) => (
  <div className="inline">
    {['yes', 'no'].map(option => (
      <label key={option} className="radio-label"> 
        <span className={`radio-circle ${answer === option ? 'selected' : ''}`}>
          {answer === option && <span className="radio-inner" />}
        </span>
        {option === 'yes' ? 'Yes' : 'No'}
        <input
          type="radio"
          checked={answer === option}
          onChange={() => setAnswer(option)}
          style={{ display: 'none' }}
        />
      </label>
    ))}
  </div>
);


  /* -------------------- RESET -------------------- */
  const resetSample = () => {
    if (!containerRef.current) return;
    const { clientWidth: width, clientHeight: height } = containerRef.current;

    const fresh: Firefly[] = Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      dx: (Math.random() - 0.5) * 1.5,
      dy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    }));

    firefliesRef.current = fresh;
    setFireflies(fresh);
    setHistCounts([0, 0, 0, 0, 0]);
    setUserAnswer('');
    setBiasAnswer('');
    setSizeAnswer('');
    setExactAnswer('');
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div
        ref={containerRef}
        className="firefly-container"
        onMouseDown={() => {
          setIsDragging(true);
          forceRender(n => n + 1);
        }}
        onMouseUp={() => {
          setIsDragging(false);
          mousePosRef.current = null;
          forceRender(n => n + 1);
        }}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleCatch}
        onTouchStart={e => {
          if (!isTouching) {
            setIsDragging(true);
            setIsTouching(true);
            e.preventDefault();
            forceRender(n => n + 1);
          }
        }}
        onTouchMove={e => {
          if (isDragging) {
            e.preventDefault();
            handleCatch(e);
          }
        }}
        onTouchEnd={() => {
          setIsDragging(false);
          setIsTouching(false);
          mousePosRef.current = null;
          forceRender(n => n + 1);
        }}
      >
        {fireflies.map(f => (
          <div
            key={f.id}
            className="firefly"
            style={{
              transform: `translate3d(${f.x}px, ${f.y}px, 0)`,
              width: f.size * 2,
              height: f.size * 2,
              color: f.color,
            }}
          />
        ))}
      </div>

      {mousePosRef.current && (
        <div
          className="cursor-circle"
          style={{
            transform: `translate3d(${mousePosRef.current.x - HIT_RADIUS}px, ${mousePosRef.current.y - HIT_RADIUS}px, 0)`,
            width: HIT_RADIUS * 2,
            height: HIT_RADIUS * 2,
          }}
        />
      )}




      <div className="histogram-wrapper">
        <div className="histogram-bars">
          {histCounts.map((count, colorIndex) => (
            <div key={colorIndex} className="histogram-bar">
              {Array.from({ length: count }).map((_, i) => (
                <Bubble key={i} color={COLORS[colorIndex]} size={FIREFLY_SIZE} />
              ))}
              {showPercent && totalCollected > 0 && (
                <div
                  className="text-sm"
                  style={{ color: COLORS[colorIndex], textShadow: `0 0 10px ${COLORS[colorIndex]}` }}
                >
                  {((count / totalCollected) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="text-md">Collected Sample</div>
        <button className="button btn-sm" onClick={() => setShowPercent(prev => !prev)}>
          {showPercent ? 'Hide proportions' : 'Show proportions'}
        </button>
      </div>

      <div className="top-mobile">
        <button className="button btn-md top-right" onClick={resetSample}>
          Collect Another Sample
        </button>

        <div className="top-left-box">
          <div >Are firefly colors equal every time you sample them?</div>
          <div className="inline">
            {renderRadio(userAnswer, setUserAnswer)}
          </div>
          
          {userAnswer && (
            <div className="text-sm">
              {userAnswer === 'no'
                ? '✅ Congrats, you experienced sampling variability!'
                : '❌ Every time you sampled? Try again.'}
            </div>
          )}

          {userAnswer === 'no' && (
            <>
              <div >Did you try to catch specific fireflies?</div>
              <div className="inline">
                {renderRadio(biasAnswer, setBiasAnswer)}
              </div>
              {biasAnswer && (
                <div className="text-sm">
                  {biasAnswer === 'yes'
                    ? "✅ That's sampling bias. Did you aim for a specific color?"
                    : 'Collect another sample.'}
                </div>
              )}
            </>
          )}

          {biasAnswer === 'yes' && (
            <>
              <div >
                If you catch more fireflies, does that describe the population better?
              </div>
              <div className="inline">
                {renderRadio(sizeAnswer, setSizeAnswer)}
              </div>
              {sizeAnswer && (
                <div className="text-sm">
                  {sizeAnswer === 'yes'
                    ? '✅ Exactly! Larger samples are usually more representative.'
                    : 'Are you sure?'}
                </div>
              )}
            </>
          )}

          {sizeAnswer === 'yes' && (
            <>
              <div >
                Can your sample tell you exactly how many fireflies of each color there are if you knew there are 100
                in total?
              </div>
              <div className="inline">
                {renderRadio(exactAnswer, setExactAnswer)}
              </div>
              {exactAnswer && (
                <div className="text-sm">
                  {exactAnswer === 'no'
                    ? '✅ You can approximate, but not exactly. Statistics always has some uncertainty.'
                    : 'Samples rarely match perfectly. Statistics helps us see patterns despite uncertainty.'}
                </div>
              )}
            </>
          )}

          {exactAnswer === 'no' && (
            <>
              <button 
              className="button btn-sm no-stretch" 
              style={{ marginTop: '1rem' }}
              onClick={() => setShowGoodSample(prev => !prev)}>
                {showGoodSample ? 'Too much info?' : 'How to get a good sample?'}
              </button>
              {showGoodSample && (
                <div><div >
                  Good sample is <b>representative</b>. This means that each firefly has to have an <b>equal chance</b> of getting sampled.
                  <br /><b>Randomization</b> reduces sampling bias. Errors do not matter so much when they are <b>equally distributed</b>.
                  <br />It also needs to be large enough to capture the diversity of the population (can't have just one blue firefly, eh?).
                </div>
                  </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
