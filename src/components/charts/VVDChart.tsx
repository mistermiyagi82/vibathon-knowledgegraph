"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ComposedChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface Props {
  toolName: string;
  result: unknown;
}

const COLORS = ["#7c3aed", "#2563eb", "#0891b2", "#059669", "#d97706", "#dc2626"];

type DataRow = Record<string, unknown>;

function findArrayKey(obj: Record<string, unknown>): string | undefined {
  return Object.keys(obj).find((k) => Array.isArray(obj[k]));
}

function extractRows(result: unknown): DataRow[] | null {
  if (Array.isArray(result)) return result as DataRow[];
  if (result && typeof result === "object") {
    const key = findArrayKey(result as Record<string, unknown>);
    if (key) return (result as Record<string, unknown>)[key] as DataRow[];
  }
  return null;
}

function getNumericKeys(row: DataRow, exclude: string[]): string[] {
  return Object.keys(row).filter(
    (k) => !exclude.includes(k) && typeof row[k] === "number"
  );
}

function findPeriodKey(row: DataRow): string | undefined {
  return Object.keys(row).find(
    (k) =>
      k.toLowerCase().includes("period") ||
      k.toLowerCase().includes("date") ||
      k.toLowerCase().includes("jaar") ||
      k.toLowerCase().includes("maand")
  );
}

function findCategoryKey(row: DataRow): string | undefined {
  return Object.keys(row).find((k) => typeof row[k] === "string");
}

export default function VVDChart({ toolName, result }: Props) {
  const rows = extractRows(result);

  if (!rows || rows.length === 0) {
    return (
      <pre className="text-xs text-ink/60 bg-ink/5 rounded-lg p-3 overflow-x-auto my-3 max-h-48">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  }

  const firstRow = rows[0];

  // vvd_compare_forecast_actuals — forecast vs actual line/area chart
  if (toolName === "vvd_compare_forecast_actuals") {
    const periodKey = findPeriodKey(firstRow) ?? Object.keys(firstRow)[0];
    const forecastKey = Object.keys(firstRow).find(
      (k) => k.toLowerCase().includes("forecast") || k.toLowerCase().includes("prognose")
    );
    const actualKey = Object.keys(firstRow).find(
      (k) =>
        k.toLowerCase().includes("actual") ||
        k.toLowerCase().includes("werkelijk") ||
        k.toLowerCase().includes("realisatie")
    );

    if (forecastKey && actualKey) {
      const chartData = rows.map((r) => ({
        period: r[periodKey],
        forecast: r[forecastKey],
        actual: r[actualKey],
      }));
      return (
        <div className="my-3">
          <p className="text-xs text-ink/40 mb-2">Forecast vs Actuals</p>
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="period" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="forecast"
                fill="#a78bfa"
                stroke="#7c3aed"
                opacity={0.4}
              />
              <Line
                type="monotone"
                dataKey="actual"
                stroke="#10b981"
                dot={false}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      );
    }
  }

  // vvd_query_actuals / vvd_query_forecasts — time series line chart
  if (toolName === "vvd_query_actuals" || toolName === "vvd_query_forecasts") {
    const periodKey = findPeriodKey(firstRow);
    if (periodKey) {
      const numKeys = getNumericKeys(firstRow, [periodKey]);
      if (numKeys.length > 0) {
        const chartData = rows.map((r) => ({
          period: r[periodKey],
          ...Object.fromEntries(numKeys.map((k) => [k, r[k]])),
        }));
        return (
          <div className="my-3">
            <p className="text-xs text-ink/40 mb-2">{toolName}</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                {numKeys.map((k, i) => (
                  <Line
                    key={k}
                    type="monotone"
                    dataKey={k}
                    stroke={COLORS[i % COLORS.length]}
                    dot={false}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      }
    }
  }

  // vvd_actuals_summary / vvd_forecast_summary — bar chart by category
  const categoryKey = findCategoryKey(firstRow);
  const numKeys = getNumericKeys(firstRow, categoryKey ? [categoryKey] : []);
  if (categoryKey && numKeys.length > 0) {
    const chartData = rows.map((r) => ({
      name: String(r[categoryKey]).slice(0, 20),
      ...Object.fromEntries(numKeys.map((k) => [k, r[k]])),
    }));
    return (
      <div className="my-3">
        <p className="text-xs text-ink/40 mb-2">{toolName}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            {numKeys.map((k, i) => (
              <Bar key={k} dataKey={k} fill={COLORS[i % COLORS.length]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Fallback — formatted JSON
  return (
    <pre className="text-xs text-ink/60 bg-ink/5 rounded-lg p-3 overflow-x-auto my-3 max-h-48">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}
