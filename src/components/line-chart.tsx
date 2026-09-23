"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { dayTicks, niceTicks } from "@/lib/chart";

/** `slot` pins a series to a palette color so it keeps its color when other series are absent. */
export type ChartSeries = { name: string; points: { x: number; y: number }[]; slot?: number };

type Props = {
  title: string;
  series: ChartSeries[];
  yDecimals: number;
  yUnit?: string;
  referenceLines?: { y: number; label: string }[];
  height?: number;
};

const COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const M = { top: 14, right: 16, bottom: 30, left: 48 };
const END_LABEL_W = 52;

/** Day-indexed line chart: one y-axis, crosshair tooltip, legend for 2+ series, table fallback. */
export function LineChart({ title, series: input, yDecimals, yUnit = "", referenceLines = [], height = 220 }: Props) {
  const series = useMemo(
    () =>
      input.slice(0, COLORS.length).map((s, i) => ({
        ...s,
        color: COLORS[(s.slot ?? i) % COLORS.length],
        points: [...s.points].sort((a, b) => a.x - b.x),
      })),
    [input],
  );
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const all = series.flatMap((s) => s.points);
  const xs = useMemo(() => [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort((a, b) => a - b), [series]);
  if (all.length === 0) return null;

  const fmt = (y: number) => `${y.toFixed(yDecimals)}${yUnit}`;
  const yVals = [...all.map((p) => p.y), ...referenceLines.map((r) => r.y)];
  const yTicks = niceTicks(Math.min(...yVals), Math.max(...yVals));
  const [y0, y1] = [yTicks[0], yTicks.at(-1)!];
  const xMin = Math.min(0, xs[0]);
  const xMax = Math.max(xs.at(-1)!, xMin + 1);
  const xTicks = dayTicks(xMin, xMax);

  const showEndLabels = series.length <= 4;
  const plotW = width - M.left - M.right - (showEndLabels ? END_LABEL_W : 0);
  const plotH = height - M.top - M.bottom;
  const sx = (x: number) => M.left + ((x - xMin) / (xMax - xMin)) * plotW;
  const sy = (y: number) => M.top + (1 - (y - y0) / (y1 - y0 || 1)) * plotH;

  // Drop end labels that would collide rather than nudging them off their lines.
  const ends = series.map((s) => s.points.at(-1)).filter((p): p is { x: number; y: number } => !!p);
  const endsCollide = ends.some((a, i) => ends.some((b, j) => i < j && Math.abs(sy(a.y) - sy(b.y)) < 14));

  const activeX = active == null ? null : xs[active];
  const nearestIndex = (clientX: number) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const x = xMin + ((clientX - rect.left - M.left) / plotW) * (xMax - xMin);
    let best = 0;
    xs.forEach((v, i) => {
      if (Math.abs(v - x) < Math.abs(xs[best] - x)) best = i;
    });
    return best;
  };
  const onMove = (e: PointerEvent) => setActive(nearestIndex(e.clientX));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowRight") setActive((i) => Math.min(xs.length - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? xs.length) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  };

  const tooltipLeft = activeX == null ? 0 : sx(activeX);
  const flip = tooltipLeft > width * 0.6;

  return (
    <figure className="flex min-w-0 flex-col gap-2">
      <figcaption className="text-sm font-semibold">{title}</figcaption>
      {series.length >= 2 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <svg width="14" height="4" aria-hidden>
                <line x1="0" y1="2" x2="14" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
              </svg>
              {s.name}
            </li>
          ))}
        </ul>
      )}
      <div
        ref={wrapRef}
        className="relative w-full min-w-0 touch-pan-y overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ height }}
        tabIndex={0}
        role="group"
        aria-label={`${title}. Use left and right arrow keys to read values.`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
      >
        {/* Absolutely positioned so the SVG never sets the layout width; the container does. */}
        <svg width={width} height={height} className="absolute top-0 left-0 block">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={M.left + plotW} y1={sy(t)} y2={sy(t)} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={M.left - 8} y={sy(t)} dy="0.32em" textAnchor="end" fontSize="11" fill="var(--chart-ink-muted)" className="tabular-nums">
                {t.toFixed(yDecimals)}
              </text>
            </g>
          ))}
          <line x1={M.left} x2={M.left + plotW} y1={M.top + plotH} y2={M.top + plotH} stroke="var(--chart-axis)" strokeWidth="1" />
          {xTicks.map((t) => (
            <text key={t} x={sx(t)} y={M.top + plotH + 18} textAnchor="middle" fontSize="11" fill="var(--chart-ink-muted)" className="tabular-nums">
              {t === xTicks[0] ? `Day ${t}` : t}
            </text>
          ))}

          {referenceLines.map((r) => (
            <g key={r.label}>
              <line x1={M.left} x2={M.left + plotW} y1={sy(r.y)} y2={sy(r.y)} stroke="var(--chart-ink-muted)" strokeWidth="1" />
              <text x={M.left + 6} y={sy(r.y) - 5} fontSize="11" fill="var(--chart-ink-muted)">
                {r.label}
              </text>
            </g>
          ))}

          {activeX != null && (
            <line x1={sx(activeX)} x2={sx(activeX)} y1={M.top} y2={M.top + plotH} stroke="var(--chart-axis)" strokeWidth="1" />
          )}

          {series.map((s) => (
            <g key={s.name}>
              <polyline
                points={s.points.map((p) => `${sx(p.x)},${sy(p.y)}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {s.points.map((p, j) => (
                <circle
                  key={j}
                  cx={sx(p.x)}
                  cy={sy(p.y)}
                  r={p.x === activeX ? 5.5 : 4}
                  fill={s.color}
                  stroke="var(--card)"
                  strokeWidth="2"
                />
              ))}
              {showEndLabels && !endsCollide && s.points.length > 0 && (
                <text
                  x={sx(s.points.at(-1)!.x) + 10}
                  y={sy(s.points.at(-1)!.y)}
                  dy="0.32em"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--foreground)"
                  className="tabular-nums"
                >
                  {fmt(s.points.at(-1)!.y)}
                </text>
              )}
            </g>
          ))}
        </svg>

        {activeX != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md"
            style={flip ? { right: width - tooltipLeft + 10 } : { left: tooltipLeft + 10 }}
          >
            <div className="mb-1 text-muted-foreground">Day {activeX}</div>
            {series.map((s) => {
              const p = s.points.find((pt) => pt.x === activeX);
              return (
                <div key={s.name} className="flex items-center gap-2">
                  <svg width="12" height="4" aria-hidden>
                    <line x1="0" y1="2" x2="12" y2="2" stroke={s.color} strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <strong className="tabular-nums">{p ? fmt(p.y) : "–"}</strong>
                  {series.length > 1 && <span className="text-muted-foreground">{s.name}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <details className="no-print text-xs">
        <summary className="cursor-pointer text-muted-foreground">Show data table</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 pr-3 font-medium">Day</th>
              {series.map((s) => (
                <th key={s.name} className="py-1 pr-3 font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {xs.map((x) => (
              <tr key={x}>
                <td className="py-1 pr-3">{x}</td>
                {series.map((s) => {
                  const p = s.points.find((pt) => pt.x === x);
                  return (
                    <td key={s.name} className="py-1 pr-3">
                      {p ? fmt(p.y) : "–"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
