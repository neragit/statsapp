'use client';

import { useEffect, useState, useCallback } from 'react';

const COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f1c40f', '#9b59b6'];

type Bubble = {
  id: number;
  colorIndex: number;
  x: number;
  y: number;
};

const BUBBLE_SIZE = 30;
const HIT_SIZE = 50;
const MAX_PER_COLOR = 10;

function Bubble({ color, size }: { color: string; size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
      }}
    />
  );
}

export default function BubbleStatsGame() {
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [counts, setCounts] = useState<number[]>(Array(5).fill(0));
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizResult, setQuizResult] = useState('');
  const [pastDistributions, setPastDistributions] = useState<number[][]>([]);

  const distributionReady = counts.some(c => c >= MAX_PER_COLOR);

  // --- Bubble spawn & movement combined ---
  useEffect(() => {
    if (distributionReady) return;

    let lastSpawn = 0;
    let animationId: number;

    const tick = (time: number) => {
      if (time - lastSpawn > 400) {
        setBubbles(prev => [
          ...prev,
          {
            id: Math.random(),
            colorIndex: Math.floor(Math.random() * COLORS.length),
            x: Math.random() * 90 + 5,
            y: 100,
          },
        ]);
        lastSpawn = time;
      }

      setBubbles(prev =>
        prev
          .map(b => ({ ...b, y: b.y - 0.3 }))
          .filter(b => b.y > -10)
      );

      animationId = requestAnimationFrame(tick);
    };

    animationId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(animationId);
  }, [distributionReady]);

  // --- Handlers ---
  const popBubble = useCallback(
    (id: number, colorIndex: number) => {
      if (distributionReady) return;

      setBubbles(prev => prev.filter(b => b.id !== id));
      setCounts(prev => prev.map((c, i) => (i === colorIndex ? c + 1 : c)));
    },
    [distributionReady]
  );

  const handleTryAgain = useCallback(() => {
    setPastDistributions(prev => [...prev, counts]);
    setCounts(Array(5).fill(0));
    setBubbles([]);
    setQuizAnswered(false);
    setQuizResult('');
  }, [counts]);

  // --- Distribution Detection ---
  function getSkewType(counts: number[]): 'LEFT skewed' | 'RIGHT skewed' | null {
    const max = Math.max(...counts);
    const peakIndex = counts.indexOf(max);

    // Helper to check trend of at least 2 steps toward the peak
    const checkLeftTrend = () => {
        if (peakIndex < 2) return false; // not enough numbers
        const left = counts.slice(peakIndex - 2, peakIndex);
        return left[0] <= left[1] && left[1] <= counts[peakIndex];
    };

    const checkRightTrend = () => {
        if (peakIndex > counts.length - 3) return false; // not enough numbers
        const right = counts.slice(peakIndex + 1, peakIndex + 3);
        return counts[peakIndex] >= right[0] && right[0] >= right[1];
    };

    const leftTrend = checkLeftTrend();
    const rightTrend = checkRightTrend();

    if (leftTrend && !rightTrend) return 'LEFT skewed';
    if (rightTrend && !leftTrend) return 'RIGHT skewed';

    return null;
    }


  function getDistributionType(counts: number[]) {
    const max = Math.max(...counts);
    const middle = counts[2];
    const leftEnd = counts[0];
    const rightEnd = counts[4];

    if (counts.every(c => max - c <= 3)) return 'UNIFORM';
    if (middle === max && leftEnd <= middle * 0.8 && rightEnd <= middle * 0.8) return 'NORMAL';

    // --- Significant peak detection ---
  const minDifference = max * 0.2; // peak must be at least 20% higher than neighbors
  const threshold = max * 0.5; // only consider values >= 50% of max

  const peaks = counts
    .map((c, i) => {
      if (c < threshold) return -1;

      const left = i > 0 ? counts[i - 1] : c - minDifference - 1;
      const right = i < counts.length - 1 ? counts[i + 1] : c - minDifference - 1;

      return c - left >= minDifference && c - right >= minDifference ? i : -1;
    })
    .filter(i => i !== -1);

  // BIMODAL
  if (peaks.length >= 2) {
    // Take two highest peaks
    const sortedPeaks = peaks.sort((a, b) => counts[b] - counts[a]);
    const first = counts[sortedPeaks[0]];
    const second = counts[sortedPeaks[1]];

    if (Math.abs(first - second) <= max * 0.2) return 'BIMODAL';
  }

    const skew = getSkewType(counts);
    return skew ?? 'IRREGULAR';
  }

  const handleAnswer = useCallback(
    (answer: string) => {
      const correct = getDistributionType(counts);
      setQuizAnswered(true);
      setQuizResult(answer === correct ? `Correct! This is ${correct}` : `Not quite. This histogram is ${correct}`);
    },
    [counts]
  );

  const buttonStyle: React.CSSProperties = {
    padding: '10px 15px',
    fontSize: 16,
    fontWeight: 'bold',
    borderRadius: 6,
    border: '2px solid #333',
    backgroundColor: '#fff',
    cursor: 'pointer',
    transition: '0.2s',
  };

  const options = [
    { label: 'Basically EVEN colors', value: 'UNIFORM' },
    { label: 'Lower on the RIGHT', value: 'RIGHT skewed' },
    { label: 'Lower on the LEFT', value: 'LEFT skewed' },
    { label: 'Highest in the MIDDLE', value: 'NORMAL' },
    { label: 'Two high points', value: 'BIMODAL' },
    { label: 'None of these, TOO WEIRD', value: 'IRREGULAR' },
  ];

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', fontFamily: 'sans-serif', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', flex: 1 }}>
        {/* LEFT: Game area */}
        <div style={{ position: 'relative', width: '50%', borderRight: '1px solid #ddd', overflow: 'hidden' }}>
          {bubbles.map(b => (
            <div
              key={b.id}
              onClick={() => popBubble(b.id, b.colorIndex)}
              style={{
                position: 'absolute',
                left: `calc(${b.x}% - ${HIT_SIZE / 2}px)`,
                top: `calc(${b.y}% - ${HIT_SIZE / 2}px)`,
                width: HIT_SIZE,
                height: HIT_SIZE,
                cursor: distributionReady ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bubble color={COLORS[b.colorIndex]} size={BUBBLE_SIZE} />
            </div>
          ))}

          {/* Quiz overlay */}
          {distributionReady && !quizAnswered && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.85)',
                padding: 20,
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>You have just created a DISTRIBUTION!</div>

              <div style={{ display: 'flex', gap: 12, fontSize: 20, fontWeight: 'bold', justifyContent: 'center', marginBottom: 20 }}>
                {counts.map((count, i) => (
                  <span key={i} style={{ color: COLORS[i] }}>{count}</span>
                ))}
              </div>

              <div style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>What kind of HISTOGRAM is this?</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {options.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleAnswer(opt.value)}
                    style={buttonStyle}
                    onMouseOver={e => (e.currentTarget.style.backgroundColor = '#f0f0f0')}
                    onMouseOut={e => (e.currentTarget.style.backgroundColor = '#fff')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {quizAnswered && (
            <div
              style={{
                position: 'absolute',
                top: 40,
                left: '50%',
                transform: 'translateX(-50%)',
                textAlign: 'center',
                color: '#000',
                backgroundColor: 'rgba(255,255,255,0.85)',
                padding: 20,
                borderRadius: 8,
                fontSize: 24,
                fontWeight: 'bold',
              }}
            >
              {quizResult}
              <div style={{ marginTop: 20 }}>
                <button onClick={handleTryAgain} style={buttonStyle}>
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Histogram */}
        <div style={{ width: '50%', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-evenly', paddingBottom: 20 }}>
          {counts.map((count, colorIndex) => (
            <div key={colorIndex} style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 6 }}>
              {Array.from({ length: count }).map((_, i) => (
                <Bubble key={i} color={COLORS[colorIndex]} size={BUBBLE_SIZE} />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Past distributions */}
        <div style={{ display: 'flex', gap: 40, overflowX: 'auto', padding: '10px 20px', borderTop: '1px solid #ddd' }}>
          {pastDistributions.map((dist, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 4, alignItems: 'flex-end' }}>
              {dist.map((count, colorIndex) => (
                <div key={colorIndex} style={{ display: 'flex', flexDirection: 'column-reverse', gap: 2 }}>
                  {Array.from({ length: count }).map((_, i) => (
                    <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: COLORS[colorIndex] }} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      
    </div>
  );
}


