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

export default function samplingFireflies() {
  const [fireflies, setFireflies] = useState<Firefly[]>([]);
  const [histCounts, setHistCounts] = useState<number[]>([0, 0, 0, 0, 0]);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const [biasAnswer, setBiasAnswer] = useState('');
  const [sizeAnswer, setSizeAnswer] = useState('');
  const [exactAnswer, setExactAnswer] = useState('');
  const [showPercent, setShowPercent] = useState(false);
  const [showGoodSample, setShowGoodSample] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const router = useRouter();
  const [isTouching, setIsTouching] = useState(false);


  const totalCollected = histCounts.reduce((a, b) => a + b, 0);

  useEffect(() => {
    if (!containerRef.current) return;
    const { clientWidth: width, clientHeight: height } = containerRef.current;
    const initialFireflies: Firefly[] = Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      dx: (Math.random() - 0.5) * 1.5,
      dy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
    setFireflies(initialFireflies);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (!containerRef.current) return;
      setFireflies(prev => prev.map(f => ({ ...f, x: f.x + f.dx, y: f.y + f.dy })));
    }, 30);
    return () => clearInterval(interval);
  }, []);

  const handleCatch = (e: React.MouseEvent | React.TouchEvent, isTouch = false) => {
  if (!containerRef.current) return;

  const rect = containerRef.current.getBoundingClientRect();

  // Get coordinates for mouse or touch
  let clientX: number, clientY: number;
  if ('touches' in e) {
    clientX = e.touches[0].clientX;
    clientY = e.touches[0].clientY;
  } else {
    clientX = e.clientX;
    clientY = e.clientY;
  }

  const mouseX = clientX - rect.left;
  const mouseY = clientY - rect.top;

  setMousePos({ x: clientX, y: clientY });

  if (!isDragging) return;

  const removedIds = fireflies
    .filter(f => Math.hypot(f.x + f.size - mouseX, f.y + f.size - mouseY) <= HIT_RADIUS)
    .map(f => f.id);

  if (!removedIds.length) return;

  setFireflies(prev => prev.filter(f => !removedIds.includes(f.id)));
  setHistCounts(prev => {
    const newCounts = [...prev];
    fireflies.forEach(f => {
      if (removedIds.includes(f.id)) {
        const idx = COLORS.indexOf(f.color);
        if (idx >= 0) newCounts[idx] += 1;
      }
    });
    return newCounts;
  });
};


  const Bubble = ({ color, size }: { color: string; size: number }) => (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: color,
        boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`
      }}
    />
  );

  const renderRadio = (answer: string, setAnswer: (a: string) => void) =>
    ['yes', 'no'].map(option => (
      <label key={option} className="label-container">
        <span className={`radio-circle ${answer === option ? 'selected' : ''}`}>
          {answer === option && <span className="radio-inner" />}
        </span>
        {option === 'yes' ? 'Yes' : 'No'}
        <input
          type="radio"
          name="radio"
          value={option}
          checked={answer === option}
          onChange={() => setAnswer(option)}
          style={{ display: 'none' }}
        />
      </label>
    ));

  const resetSample = () => {
    if (!containerRef.current) return;
    const { clientWidth: width, clientHeight: height } = containerRef.current;
    const newFireflies: Firefly[] = Array.from({ length: 100 }).map((_, i) => ({
      id: i,
      x: Math.random() * width,
      y: Math.random() * height,
      dx: (Math.random() - 0.5) * 1.5,
      dy: (Math.random() - 0.5) * 1.5,
      size: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
    setFireflies(newFireflies);
    setHistCounts([0, 0, 0, 0, 0]);
    setUserAnswer('');
    setBiasAnswer('');
    setSizeAnswer('');
    setExactAnswer('');
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <div
        ref={containerRef}
        className="firefly-container"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={handleCatch}
        onTouchStart={e => {
    if (!isTouching) {      // only start dragging if not touching UI
      setIsDragging(true);
      setIsTouching(true);
      e.preventDefault();   // prevent scroll when dragging
    }
  }}
  onTouchMove={e => {
    if (isDragging) {
      e.preventDefault();   // still prevent scroll while dragging
      handleCatch(e, true);
    }
  }}
  onTouchEnd={() => {
  setIsDragging(false);
  setIsTouching(false);
  setMousePos(null); 
}}


      >
        {fireflies.map(f => (
          <div
            key={f.id}
            className="firefly"
            style={{ left: f.x, top: f.y, width: f.size * 2, height: f.size * 2, color: f.color }}
          />
        ))}
      </div>

      {isTouching || mousePos && (
      <div
        className="cursor-circle"
        style={{
          left: mousePos.x - HIT_RADIUS,
          top: mousePos.y - HIT_RADIUS,
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
                  className="feedback-text"
                  style={{ color: COLORS[colorIndex], textShadow: `0 0 10px ${COLORS[colorIndex]}` }}
                >
                  {((count / totalCollected) * 100).toFixed(0)}%
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="description-text">Collected Sample</div>
        <button className="button" onClick={() => setShowPercent(prev => !prev)}>
          {showPercent ? 'Hide proportions' : 'Show proportions'}
        </button>
      </div>

      <div className="top-buttons">
        <button className="top-right-button" onClick={resetSample}>
          Collect Another Sample
        </button>

        <div className="top-left-box">
          <div style={{ marginBottom: 12 }}>Are firefly colors equal every time you sample them?</div>
          {renderRadio(userAnswer, setUserAnswer)}
          {userAnswer && (
            <div className="feedback-text">
              {userAnswer === 'no'
                ? '✅ Congrats, you experienced sampling variability!'
                : '❌ Every time you sampled? Try again.'}
            </div>
          )}

          {userAnswer === 'no' && (
            <>
              <div style={{ marginTop: 12, marginBottom: 8 }}>Did you try to catch specific fireflies?</div>
              {renderRadio(biasAnswer, setBiasAnswer)}
              {biasAnswer && (
                <div className="feedback-text">
                  {biasAnswer === 'yes'
                    ? "✅ That's sampling bias. Did you aim for a specific color?"
                    : 'Collect another sample.'}
                </div>
              )}
            </>
          )}

          {biasAnswer === 'yes' && (
            <>
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                If you catch more fireflies, does that describe the population better?
              </div>
              {renderRadio(sizeAnswer, setSizeAnswer)}
              {sizeAnswer && (
                <div className="feedback-text">
                  {sizeAnswer === 'yes'
                    ? '✅ Exactly! Larger samples are usually more representative.'
                    : 'Are you sure?'}
                </div>
              )}
            </>
          )}

          {sizeAnswer === 'yes' && (
            <>
              <div style={{ marginTop: 12, marginBottom: 8 }}>
                Can your sample tell you exactly how many fireflies of each color there are if you knew there are 100
                in total?
              </div>
              {renderRadio(exactAnswer, setExactAnswer)}
              {exactAnswer && (
                <div className="feedback-text">
                  {exactAnswer === 'no'
                    ? '✅ You can approximate, but not exactly. Statistics always has some uncertainty.'
                    : 'Samples rarely match perfectly. Statistics helps us see patterns despite uncertainty.'}
                </div>
              )}
            </>
          )}

          {exactAnswer === 'no' && (
            <>
              <button className="button" onClick={() => setShowGoodSample(prev => !prev)}>
                {showGoodSample ? 'Too much info?' : 'How to get a good sample?'}
              </button>
              {showGoodSample && (
                <div><div className="sample-text">
                  Good sample is <b>representative</b>. This means that each firefly has to have an <b>equal chance</b> of getting sampled.
                  <br /><br />Best way to get a good sample?
                  <br /><b>Randomization</b> reduces sampling bias. Errors do not matter so much when they are <b>equally distributed</b>.
                  <br /><br />It also needs to be large enough to capture the diversity of the population (can't have just one blue firefly, eh?).
                </div>
                <button
                    className="link-button"
                    onClick={() => router.push('/random')}
                  >
                    Random Sample
                  </button>
                  </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
