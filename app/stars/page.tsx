"use client";

import React, { useState, useEffect, useRef } from "react";
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

interface StarData {
  id: number;
  x: number;
  y: number;
}

const STAR_SIZE = 30;
const STAR_PATH = "M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z";

export default function Page() {

  const [graphSize, setGraphSize] = useState(500);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);


  useEffect(() => {
    const updateSize = () => {
      const size = Math.min(window.innerWidth * 0.9, 500);
      setGraphSize(size);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);


  //initializing stars and handling drag

  const [stars, setStars] = useState<StarData[]>([]);

  useEffect(() => {
    const initialStars: StarData[] = Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: graphSize / 2 + (Math.random() - 0.5) * graphSize,
      y: graphSize / 2 + (Math.random() - 0.5) * graphSize,
    }));
    setStars(initialStars);
  }, [graphSize]);

  const [draggingStarId, setDraggingStarId] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);


  const getSVGPoint = (
    event: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>
  ) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    if ("touches" in event) {
      pt.x = event.touches[0].clientX;
      pt.y = event.touches[0].clientY;
    } else {
      pt.x = event.clientX;
      pt.y = event.clientY;
    }
    return pt.matrixTransform(svgRef.current.getScreenCTM()!.inverse());
  };

  const handleMove = (
    event: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>
  ) => {
    if (draggingStarId === null) return;
    event.preventDefault();
    const svgP = getSVGPoint(event);
    console.log("SVG Point:", svgP);
    setStars((prev) =>
      prev.map((s) =>
        s.id === draggingStarId ? { ...s, x: svgP.x, y: svgP.y } : s
      )
    );

    if (selectedConstellation !== "custom") {
      setSelectedConstellation("custom");
    }

  };

  const handleDragEnd = () => setDraggingStarId(null);

  useEffect(() => {
    const handleGlobalMouseUp = () => setDraggingStarId(null);
    const handleGlobalTouchEnd = () => setDraggingStarId(null);

    if (draggingStarId !== null) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("touchend", handleGlobalTouchEnd);
    }

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, [draggingStarId]);


  // ui elements

  const [yAxisLabel, setYAxisLabel] = useState("y axis");
  const [xAxisLabel, setXAxisLabel] = useState("x axis");
  const [rValue, setRValue] = useState(0);

  const [showRegression, setShowRegression] = useState(false);
  const [showEquation, setShowEquation] = useState(false);
  const [showResiduals, setShowResiduals] = useState(false);
  const [showSquaredResiduals, setShowSquaredResiduals] = useState(false);
  const [showCurvedInfo, setShowCurvedInfo] = useState(false);
  const [showMean, setShowMean] = useState(false);

  const [showFeedback, setShowFeedback] = useState(false);

  const [answerResidual, setAnswerResidual] = useState('');
  const [answerFake, setAnswerFake] = useState('');
  const [answerSlope, setAnswerSlope] = useState('');
  const [answerDetective, setAnswerDetective] = useState('');
  const [showUshape, setShowUshape] = useState(false);

  const [selectedConstellation, setSelectedConstellation] = useState("random");

  const CONSTELLATIONS: Record<string, StarData[]> = {

    diagonal: Array.from({ length: 10 }, (_, i) => ({
      id: i,
      x: (graphSize / 10) * i + 20,
      y: (graphSize / 10) * i + 20,
    })),

    outlier: Array.from({ length: 10 }, (_, i) => {
      if (i === 9) {
        return { id: i, x: graphSize - 50, y: 50 }; // outlier
      }
      return { id: i, x: (graphSize / 10) * i + 20, y: (graphSize / 10) * i + 20 };
    }),

    curved: Array.from({ length: 10 }, (_, i) => {
      const numStars = 10;
      const x = (i + 0.75) * (graphSize / (numStars + 0.25));
      const maxDrop = 450;
      const rate = 0.009;
      const y = graphSize - (maxDrop * (1 - Math.exp(-rate * x)));
      return { id: i, x, y };
    })
  };

  // calculations

  const meanY = stars.length
    ? stars.reduce((sum, s) => sum + (graphSize - s.y), 0) / stars.length
    : graphSize / 2;
  const meanYSVG = graphSize - meanY; // convert back to SVG coords

  const computeR = (stars: StarData[]) => {
    const n = stars.length;
    if (n === 0) return 0;

    const xs = stars.map((s) => s.x);
    const ys = stars.map((s) => graphSize - s.y);

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let numerator = 0,
      denomX = 0,
      denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    return numerator / Math.sqrt(denomX * denomY);
  };

  useEffect(() => {
    setRValue(computeR(stars));
  }, [stars]);

  const computeRegressionLine = (stars: StarData[]) => {
    const n = stars.length;
    if (n === 0) return { m: 0, b: 0 };

    const xs = stars.map((s) => s.x);
    const ys = stars.map((s) => graphSize - s.y); // invert y-axis for SVG

    const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
    const meanY = ys.reduce((sum, value) => sum + value, 0) / n;

    let numerator = 0;
    let denom = 0;

    for (let i = 0; i < n; i++) {
      numerator += (xs[i] - meanX) * (ys[i] - meanY);
      denom += (xs[i] - meanX) ** 2;
    }

    if (denom === 0) return { m: 0, b: meanY }; //if aligned vertical

    const m = numerator / denom;
    const b = meanY - m * meanX;
    return { m, b };
  };
  const { m: slope, b: intercept } = computeRegressionLine(stars);


  // residuals and outliers

  const computeResiduals = (stars: StarData[]) => {
    const { m, b } = computeRegressionLine(stars);
    return stars.map((s) => {
      const y = graphSize - s.y; // invert y-axis for SVG
      const yHat = m * s.x + b;
      return { x: s.x, yActual: graphSize - y, yPred: graphSize - yHat }; // SVG coords
    });
  };

  const computeSquaredResiduals = (stars: StarData[]) => {
    const { m, b } = computeRegressionLine(stars);
    return stars.map((s) => {
      const y = graphSize - s.y; // invert y-axis for SVG
      const yHat = m * s.x + b;
      const residual = y - yHat;
      return {
        x: s.x,
        y: graphSize - yHat, // SVG coordinate at the regression line
        size: residual ** 2,
        direction: residual > 0 ? -1 : 1,
      };
    });
  };

  const SSE = computeSquaredResiduals(stars).reduce((sum, sq) => sum + sq.size, 0);
  const maxSSE = 180000; // slightly above max observed
  const barWidth = Math.min(SSE / maxSSE, 1) * 150; // 150px max width

  const computeCovarianceInfluence = (stars: StarData[]) => {
    const n = stars.length;

    if (n === 0) return new Map<number, number>();

    const xs = stars.map(s => s.x);
    const ys = stars.map(s => graphSize - s.y);

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    const contributions = stars.map((s, i) => ({
      id: s.id,
      value: Math.abs((xs[i] - meanX) * (ys[i] - meanY)),

    }));

    const total = contributions.reduce((a, b) => a + b.value, 0);

    const influenceMap = new Map<number, number>();
    contributions.forEach(c => {
      influenceMap.set(c.id, total === 0 ? 0 : c.value / total);
    });

    return influenceMap;
  };

  const influenceMap = computeCovarianceInfluence(stars);

  const maxInfluence =
    influenceMap.size > 0
      ? Math.max(...influenceMap.values())
      : 0;

  const OUTLIER_THRESHOLD = 0.4;
  const hasDominantPoint = maxInfluence > OUTLIER_THRESHOLD;

  const squaredResiduals = computeSquaredResiduals(stars);
  const residualSizes = squaredResiduals.map(r => r.size);
  const meanSize = residualSizes.reduce((a, b) => a + b, 0) / residualSizes.length;
  const variance = residualSizes.reduce((a, b) => a + (b - meanSize) ** 2, 0) / residualSizes.length;
  const stdDev = Math.sqrt(variance);

  const OUTLIER_FACTOR = 2; //threshold
  const weakeningOutliers = squaredResiduals.filter(r => r.size > meanSize + OUTLIER_FACTOR * stdDev);

  // curvy

  function computeSpearman(stars: StarData[]): number {
    const n = stars.length;
    if (n === 0) return 0;

    // extract values
    const xs = stars.map(s => s.x);
    const ys = stars.map(s => graphSize - s.y); // invert y for SVG

    // average ranks for ties
    const rankArray = (arr: number[]) => {
      const paired = arr.map((val, idx) => ({ val, idx })); // pair values with indices
      paired.sort((a, b) => a.val - b.val);// sort ascending
      const ranks: number[] = new Array(n);
      let i = 0;
      while (i < n) {
        let j = i;
        while (j + 1 < n && paired[j + 1].val === paired[i].val) j++; // find ties
        const avgRank = (i + j + 2) / 2; //start at rank 1
        for (let k = i; k <= j; k++) ranks[paired[k].idx] = avgRank;
        i = j + 1;
      }
      return ranks;
    };

    const ranksX = rankArray(xs);
    const ranksY = rankArray(ys);

    //compute Pearson correlation of ranks
    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / n;

    const meanX = mean(ranksX);
    const meanY = mean(ranksY);

    let numerator = 0;
    let denomX = 0;
    let denomY = 0;

    for (let i = 0; i < n; i++) {
      const dx = ranksX[i] - meanX;
      const dy = ranksY[i] - meanY;
      numerator += dx * dy;
      denomX += dx * dx;
      denomY += dy * dy;
    }

    return numerator / Math.sqrt(denomX * denomY);
  }

  const spearmanRho = computeSpearman(stars);
  const spearmanMin = 0.2;

  const curvedDetected =
    Math.abs(spearmanRho) > spearmanMin &&
    Math.abs(spearmanRho) - Math.abs(rValue) > 0.1;



  //conditions

  const weakeningCondition =
    Math.abs(rValue) < 0.9 &&
    Math.abs(rValue) > 0.4 &&
    !hasDominantPoint &&
    weakeningOutliers.length > 0 &&
    SSE > 50000;

  const distantCondition =
    Math.abs(rValue) < 0.9 &&
    Math.abs(rValue) > 0.4 &&
    !hasDominantPoint &&
    weakeningOutliers.length > 0
    && SSE > 50000 && SSE < 160000;


  // feedback 

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

  return (

    <div>
      <div className="centered">

        <Tippy
          content={<>Did you know that blue stars are the hottest?<br />They burn fast and die young.</>}
          arrow
          delay={100}
        >
          <h2 className="page-title">Create your constellation</h2>
        </Tippy>


        <div className="dropdown-selector">
          <select
            value={selectedConstellation}
            className="text-sm"
            onChange={(e) => {
              const choice = e.target.value;
              setSelectedConstellation(choice);
              setShowFeedback(true);

              if (choice === "random") {
                const initialStars: StarData[] = Array.from({ length: 10 }, (_, i) => ({
                  id: i,
                  x: graphSize / 2 + (Math.random() - 0.5) * graphSize,
                  y: graphSize / 2 + (Math.random() - 0.5) * graphSize,
                }));
                setStars(initialStars);
              } else {
                setStars(CONSTELLATIONS[choice]);
              }
            }}
          >
            <option value="random">Random</option>
            <option value="diagonal">Diagonal</option>
            <option value="outlier">Outlier</option>
            <option value="curved">Curved</option>
            <option value="custom" disabled>Custom</option>
          </select>
        </div>



        {/* middle graph */}

        <svg className="notranslate responsive-graph"
          ref={svgRef}
          width={graphSize}
          height={graphSize}
          onMouseMove={handleMove}
          onMouseUp={handleDragEnd}

          onTouchMove={handleMove}

          style={{ cursor: draggingStarId !== null ? "crosshair" : "default" }}
        >
          <defs>
            <linearGradient id="starGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="blue" />
              <stop offset="25%" stopColor="white" />
              <stop offset="50%" stopColor="yellow" />
              <stop offset="75%" stopColor="orange" />
              <stop offset="100%" stopColor="red" />
            </linearGradient>

            <mask id="starMask" maskUnits="userSpaceOnUse">
              <rect width={graphSize} height={graphSize} fill="white" />
              {stars.map((s) => (
                <g
                  key={s.id}
                  transform={`translate(${s.x}, ${s.y}) translate(${-STAR_SIZE / 2
                    }, ${-STAR_SIZE / 2}) scale(${STAR_SIZE / 24})`}
                >
                  <path d={STAR_PATH} fill="black" />
                </g>
              ))}
            </mask>
          </defs>

          <rect width={graphSize} height={graphSize} fill="url(#starGradient)" />
          <rect width={graphSize} height={graphSize} fill="black" mask="url(#starMask)" />

          <line x1={0} y1={graphSize} x2={graphSize} y2={graphSize} stroke="white" />
          <line x1={0} y1={graphSize} x2={0} y2={0} stroke="white" />

          {stars.map((s) => (
            <g
              key={s.id}
              transform={`translate(${s.x}, ${s.y})`}
              onMouseDown={(e) => {
                e.stopPropagation();
                setDraggingStarId(s.id);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                setDraggingStarId(s.id);
              }}
              style={{ cursor: "crosshair" }}
            >
              <path
                d={STAR_PATH}
                fill="transparent"
                pointerEvents="none"
                transform={`translate(${-STAR_SIZE / 2}, ${-STAR_SIZE / 2}) scale(${STAR_SIZE / 24})`}
              />

              <circle
                cx={0}
                cy={0}
                r={20} // hit
                fill="transparent"
                pointerEvents="all"
              />
            </g>
          ))}

          {showRegression && (() => {
            const { m, b } = computeRegressionLine(stars);
            const lineStart = { x: 0, y: graphSize - (m * 0 + b) };
            const lineEnd = { x: graphSize, y: graphSize - (m * graphSize + b) };
            return (
              <line
                x1={lineStart.x}
                y1={lineStart.y}
                x2={lineEnd.x}
                y2={lineEnd.y}
                stroke="lime"
                strokeWidth={2}
              />
            );
          })()}

          {showResiduals &&
            computeResiduals(stars).map((res, i) => (
              <line
                key={i}
                x1={res.x}
                y1={res.yActual}
                x2={res.x}
                y2={res.yPred}
                stroke="white"
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            ))}

          {showSquaredResiduals &&
            computeSquaredResiduals(stars).map((sq, i) => {
              let pixelSize = Math.sqrt(sq.size) / 2;
              pixelSize *= 2;

              const starId = stars[i].id;
              const influence = influenceMap.get(starId) ?? 0;
              const isDominant = influence > OUTLIER_THRESHOLD;

              return (
                <rect
                  key={starId}
                  x={sq.x}
                  y={sq.y + (sq.direction > 0 ? 0 : -pixelSize)}
                  width={pixelSize}
                  height={pixelSize}
                  fill={isDominant ? "red" : "white"}
                  fillOpacity={0.1}
                  pointerEvents="none"
                />
              );
            })
          }

          {showMean && (
            <>
              {/* Mean y line */}
              <line
                x1={0}
                y1={meanYSVG}
                x2={graphSize}
                y2={meanYSVG}
                stroke="white"
                strokeWidth={1}
                strokeDasharray="4 2"
                opacity={0.5}
              />

              {/* Mean y label */}
              <Tippy content="Values are based on pixels." arrow delay={100} >
                <text
                  x={10}
                  y={meanYSVG - 7}
                  fill="white"
                  fontSize="12"
                  textAnchor="start"
                  cursor="help"
                >
                  Mean y ≈ {meanY.toFixed(1)}
                </text>
              </Tippy>


            </>
          )}

        </svg>


        {/* axis */}

        <button className="axis-label"
          style={
            isMobile
              ? {
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-290px, -300px) rotate(-90deg)",
                transformOrigin: "right center",
                minWidth: "8rem",
                textAlign: "center",
                whiteSpace: "nowrap",
              }
              : {
                position: "absolute",
                left: `calc(50% - ${graphSize / 2}px - 7rem)`,
                top: `calc(50% - ${graphSize / 2}px + 5px)`,
                textAlign: "right",
              }

          }
          onClick={() =>
            setYAxisLabel((p) => (p === "y axis" ? "Temperature" : "y axis"))
          }
        >
          {yAxisLabel}
        </button>

        <button className="axis-label"
          style={
            isMobile
              ? {
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(130px, 90px)",
              }
              : {
                position: "absolute",
                left: `calc(50% + ${graphSize / 2}px - 2rem)`,
                top: `calc(50% + ${graphSize / 2}px + 1rem)`,
              }

          }
          onClick={() =>
            setXAxisLabel((p) => (p === "x axis" ? "Age" : "x axis"))
          }
        >
          {xAxisLabel}
        </button>


        {/* slider below graph */}

        <div className="slider-container">
          <div className="slider-track">
            <div
              className="slider-indicator"
              style={{ left: `${((rValue + 1) / 2) * 100}%` }} // dynamic only
            />
          </div>

          <Tippy content="Pearson r" arrow delay={100}>
            <div className="slider-label notranslate" translate="no">
              r ≈ {rValue.toFixed(2)}
            </div>
          </Tippy>
        </div>

      </div>

      <div className="mobile-only" >

        {/* controls */}
        <div className="graph-controls">

          {/* Show Regression Line toggle */}
          <button className={`button btn-md ${showRegression ? "button-border" : ""}`} onClick={() => setShowRegression(prev => !prev)}>
            Regression Line
          </button>

          {/* Show Best-fit Equation toggle */}
          <button className={`button btn-md ${showEquation ? "button-border" : ""}`} onClick={() => setShowEquation(prev => !prev)}>
            Best-fit Equation
          </button>

          {/* Equation display */}
          {showEquation && (
            <Tippy content="Values are based on pixels." arrow delay={100}>
              <div className="top-right-equation">
                y = {intercept.toFixed(2)} + x * {slope.toFixed(2)}
              </div>
            </Tippy>
          )}

          {/* Show Squared Residuals toggle */}
          <button className={`button btn-md ${showSquaredResiduals ? "button-border" : ""}`} onClick={() => setShowSquaredResiduals(prev => !prev)}>
            Squared Residuals
          </button>

          {/* SSE bar */}
          {showSquaredResiduals && (
            <div className="sse-container">
              <div className="sse-row">
                <span className="sse-label">0</span>
                <div className="sse-track">
                  <div className="sse-fill" style={{ width: `${barWidth}px` }} />
                </div>
              </div>
              <span className="sse-label">Sum</span>
            </div>
          )}

          {/* Non-linear trend toggle */}
          <button className={`button btn-md ${showCurvedInfo ? "button-border" : ""}`} onClick={() => setShowCurvedInfo(prev => !prev)}>
            Non-linear trend
          </button>
          {showCurvedInfo && (
            <div style={{ paddingRight: "1rem" }}>
              Spearman’s ρ ≈ {spearmanRho.toFixed(2)}
            </div>
          )}

          {/* Show Mean Line toggle */}
          <button className={`button btn-md ${showMean ? "button-border" : ""}`} onClick={() => setShowMean(prev => !prev)}>
            Mean Line
          </button>
        </div>

        {/* left side feedback */}

        <div
          className="feedback-container"
          style={{ ['--graph-size' as keyof React.CSSProperties]: `${graphSize}px` }}
        >
          <button
            className={`button btn-md ${showFeedback ? "button-border" : ""}`}
            onClick={() => setShowFeedback(prev => !prev)}
          >
            {showFeedback ? "Hide Feedback" : "Show Feedback"}
          </button>

          {showFeedback && (
            <>
              {distantCondition && (
                <>
                  <div><strong>How do outliers affect the Pearson correlation coefficient?</strong></div>
                  <div>❗ Pearson r is extremely sensitive to outliers.</div>
                  <div>Is the relationship stronger when squared residuals are smaller?</div>
                  <div>{renderRadio(answerResidual, setAnswerResidual)}</div>
                  {answerResidual === 'yes' && (
                    <div className="text-sm">✅ Exactly! Data is closer to the regression line.</div>
                  )}
                  {answerResidual === 'no' && (
                    <div className="text-sm">❌ Are you sure? Look again.</div>
                  )}
                  <div>👁️ Move the distant star closer to the regression line to see how it affects the correlation.</div>
                </>
              )}

              {Math.abs(rValue) > 0.5 && hasDominantPoint && !curvedDetected && (
                <>
                  <div><strong>How do outliers affect the Pearson correlation coefficient?</strong></div>
                  <div>❗ Pearson r is extremely sensitive to outliers.</div>
                  <div>Can one distant star fake a strong correlation?</div>
                  <div>{renderRadio(answerFake, setAnswerFake)}</div>
                  {answerFake === 'yes' && (
                    <div className="text-sm">✅ Correct! A single outlier can inflate the correlation.</div>
                  )}
                  {answerFake === 'no' && (
                    <div className="text-sm">❌ Move the star and watch how it affects the regression line.</div>
                  )}
                </>
              )}

              {Math.abs(rValue) > 0.5 && !weakeningCondition && !distantCondition && curvedDetected && (
                <>
                  <div><strong>What happens when the trend is curved?</strong></div>
                  <div>❗ Pearson r only measures linear correlation.</div>
                  <div>Is Pearson r good curve detective?</div>
                  <div>{renderRadio(answerDetective, setAnswerDetective)}</div>
                  {answerDetective === 'no' && (
                    <div className="text-sm">✅ Exactly. Consider Spearman’s ρ for non-linear correlations or even Kendall’s τ.</div>
                  )}
                  {answerDetective === 'yes' && (
                    <div className="text-sm">❌ Not quite. Pearson is blind to curves.</div>
                  )}
                  <div>👁️ Spearman’s ρ ≈ {spearmanRho.toFixed(2)}</div>
                  <button className="button btn-sm" onClick={() => setShowUshape(p => !p)}>
                    {showUshape ? 'Too much info?' : 'What if the curve is U-shaped?'}
                  </button>
                  {showUshape && (
                    <div className="sample-text">
                      Neither Pearson nor Spearman are good indicators.
                      Split the sample or calculate polynomial regression.
                    </div>
                  )}
                </>
              )}

              {Math.abs(rValue) > 0.9 && !hasDominantPoint && !weakeningCondition && !curvedDetected && (
                <>
                  <div><strong>What does the correlation tell you?</strong></div>
                  <div>❗ Correlation coefficient is not the regression line. Can you see the slope direction just from the correlation coefficient?</div>
                  <div>{renderRadio(answerSlope, setAnswerSlope)}</div>
                  {answerSlope === 'yes' && (
                    <div className="text-sm">✅ You understand correlation! It measures strength and direction.</div>
                  )}
                  {answerSlope === 'no' && (
                    <div className="text-sm">❌ Change the direction of the stars and watch r.</div>
                  )}
                  <div>y = {intercept.toFixed(2)} + x * {slope.toFixed(2)}</div>
                  <div>👁️ If you know the x value, this model can help you predict the y value.</div>
                </>
              )}
            </>
          )}

        </div>

      </div>

    </div >

  );
};

