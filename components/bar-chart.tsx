// A small single-series bar chart for the usage dashboard (server-rendered SVG, no library).
// One hue (the link token), thin bars with a 2px gap and rounded tops on a recessive baseline;
// the peak and the last value are labelled, every bar has a tooltip (its <title>), and a table
// view below holds every number. Time runs left to right, as charts do even in Hebrew.
import type { DayCount } from "@/lib/stats";
import { he } from "@/lib/i18n/he";

const W = 300;
const H = 110;
const TOP = 16; // room for the peak's label
const BOTTOM = 16; // room for the first/last dates
const GAP = 2;

const short = (day: string) => `${Number(day.slice(8))}.${Number(day.slice(5, 7))}`;

// A bar with only its top corners rounded (data-end), anchored to the baseline.
function bar(x: number, y: number, w: number, h: number) {
  const r = Math.min(2, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function BarChart(p: { title: string; data: DayCount[]; id: string }) {
  const max = Math.max(1, ...p.data.map((d) => d.n));
  const plotH = H - TOP - BOTTOM;
  const step = W / p.data.length;
  const peak = p.data.reduce((a, d, i) => (d.n > p.data[a].n ? i : a), 0);
  const last = p.data.length - 1;
  const total = p.data.reduce((a, d) => a + d.n, 0);
  return (
    <figure className="space-y-1 rounded-xl border border-neutral-200 p-3 text-start dark:border-neutral-800">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span id={p.id} className="font-bold">
          {p.title}
        </span>
        <span className="text-sm text-muted tabular-nums">{he.stats.total(total)}</span>
      </figcaption>
      {/* LTR wrapper (svg has no dir attribute): time and text run left to right. */}
      <div dir="ltr">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-labelledby={p.id}
          className="block h-auto w-full overflow-visible text-link"
        >
          <line
            x1={0}
            x2={W}
            y1={H - BOTTOM}
            y2={H - BOTTOM}
            stroke="currentColor"
            className="text-neutral-300 dark:text-neutral-700"
            strokeWidth={1}
          />
          {p.data.map((d, i) => {
            const h = (d.n / max) * plotH;
            const x = i * step + GAP / 2;
            const w = Math.max(1, step - GAP);
            const labelled = d.n > 0 && (i === peak || i === last);
            return (
              <g key={d.day}>
                {/* The hit area is the whole column, so thin or empty bars still get a tooltip. */}
                <rect x={i * step} y={0} width={step} height={H - BOTTOM} fill="transparent">
                  <title>{he.stats.tooltip(short(d.day), d.n)}</title>
                </rect>
                {h > 0 && (
                  <path d={bar(x, H - BOTTOM - h, w, h)} fill="currentColor" pointerEvents="none" />
                )}
                {labelled && (
                  <text
                    x={x + w / 2}
                    y={H - BOTTOM - h - 4}
                    textAnchor={i === last ? "end" : "middle"}
                    className="fill-foreground text-[9px] tabular-nums"
                    pointerEvents="none"
                  >
                    {d.n}
                  </text>
                )}
              </g>
            );
          })}
          {[0, last].map((i) => (
            <text
              key={i}
              x={i === 0 ? 0 : W}
              y={H - 3}
              textAnchor={i === 0 ? "start" : "end"}
              className="fill-muted text-[9px] tabular-nums"
            >
              {short(p.data[i].day)}
            </text>
          ))}
        </svg>
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted hover:underline">{he.stats.table}</summary>
        <table className="mt-1 w-full text-start tabular-nums">
          <thead className="text-muted">
            <tr>
              <th className="text-start font-normal">{he.stats.day}</th>
              <th className="text-start font-normal">{p.title}</th>
            </tr>
          </thead>
          <tbody>
            {p.data.map((d) => (
              <tr key={d.day}>
                <td>{short(d.day)}</td>
                <td>{d.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
