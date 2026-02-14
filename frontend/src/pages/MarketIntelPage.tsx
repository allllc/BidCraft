import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getCommodities, getRates, getNews, getMarketSummary, refreshCommodities } from "../api/market";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceArea, ReferenceLine,
} from "recharts";
import type { CommodityPrice, NewsItem } from "../types/market";

/* ---------- constants ---------- */

const TABS = ["Commodity Prices", "Interest Rates", "Industry News", "AI Insights"] as const;
type Tab = (typeof TABS)[number];

const LINE_COLORS: Record<string, string> = {
  "Structural Steel (HRC)": "#2563eb",
  Copper: "#dc2626",
  "Diesel Fuel": "#16a34a",
  "Lumber (Framing)": "#d97706",
  "Gypsum Board": "#7c3aed",
};

const COMMODITY_UNITS: Record<string, string> = {
  "Structural Steel (HRC)": "$/ton",
  Copper: "$/lb",
  "Diesel Fuel": "$/gal",
  "Lumber (Framing)": "PPI Index",
  "Gypsum Board": "PPI Index",
};

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Feb", "03": "Mar", "04": "Apr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Aug",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dec",
};

function fmtMonth(m: string) {
  const [year, mo] = m.split("-");
  return `${MONTH_LABELS[mo] || mo} ${year}`;
}

/* ---------- types for historical payload ---------- */

interface MonthlyRow {
  month: string;
  type: string;
  [commodity: string]: string | number;
}

interface HistoricalPayload {
  monthly: MonthlyRow[];
  commodities: string[];
}

/* ---------- component ---------- */

export default function MarketIntelPage() {
  const [activeTab, setActiveTab] = useState<Tab>("Commodity Prices");

  const { data: commodities, isLoading: loadingCommodities } = useQuery({
    queryKey: ["commodities"],
    queryFn: getCommodities,
  });
  const { data: rates, isLoading: loadingRates } = useQuery({
    queryKey: ["rates"],
    queryFn: getRates,
  });
  const { data: news, isLoading: loadingNews } = useQuery({
    queryKey: ["news"],
    queryFn: getNews,
  });
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["market-summary"],
    queryFn: getMarketSummary,
  });

  return (
    <div>
      {/* -------- Tab Bar -------- */}
      <div className="border-b border-gray-200 mb-8">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* -------- Tab Content -------- */}
      {activeTab === "Commodity Prices" && (
        <CommodityPricesTab commodities={commodities} loading={loadingCommodities} />
      )}
      {activeTab === "Interest Rates" && (
        <InterestRatesTab rates={rates} loading={loadingRates} />
      )}
      {activeTab === "Industry News" && (
        <IndustryNewsTab news={news} loading={loadingNews} />
      )}
      {activeTab === "AI Insights" && (
        <AIInsightsTab summary={summary} loading={loadingSummary} />
      )}
    </div>
  );
}

/* ================================================================
   Commodity Prices Tab
   ================================================================ */

function CommodityPricesTab({
  commodities,
  loading,
}: {
  commodities: { current: CommodityPrice[]; historical: HistoricalPayload } | undefined;
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshCommodities();
      await queryClient.invalidateQueries({ queryKey: ["commodities"] });
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading commodity data..." />;

  const current = commodities?.current ?? [];
  const historical = commodities?.historical;
  const monthly = historical?.monthly ?? [];
  const commodityNames = historical?.commodities ?? current.map((c) => c.name);

  // Filter out rows where all commodity values are missing/zero (breaks log scale)
  const chartData = monthly.map((row) => {
    const cleaned: Record<string, string | number> = { month: row.month, type: row.type };
    for (const name of commodityNames) {
      const val = row[name];
      if (val != null && Number(val) > 0) {
        cleaned[name] = Number(val);
      }
    }
    return cleaned;
  });

  // Find where forecast starts for the shaded region
  const firstForecastIdx = monthly.findIndex((r) => r.type === "forecast");
  const lastActualMonth = firstForecastIdx > 0 ? monthly[firstForecastIdx - 1].month : null;
  const lastForecastMonth = monthly.length > 0 ? monthly[monthly.length - 1].month : null;

  // Find where 2026 starts for the year divider
  const first2026Idx = monthly.findIndex((r) => (r.month as string).startsWith("2026"));
  const first2026Month = first2026Idx >= 0 ? monthly[first2026Idx].month : null;

  return (
    <div>
      {/* Refresh Button */}
      <div className="flex items-center justify-between mb-4">
        <div />
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {/* Commodity Cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {current.map((c) => (
          <CommodityCard key={c.ticker} commodity={c} />
        ))}
        {current.length === 0 && (
          <p className="col-span-full text-gray-500 text-center py-8">No commodity data available.</p>
        )}
      </div>

      {/* Price Trends Chart (Log Scale) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-gray-900">Commodity Price Trends</h2>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-gray-100 border border-gray-300 rounded-sm" />
              Actual
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 bg-indigo-50 border border-indigo-200 rounded-sm" />
              Forecast
            </span>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Jan 2025 &ndash; Dec 2026 &bull; Log scale &bull; Forecast extrapolated from 2025 trends
        </p>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={420}>
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
              {/* Forecast shading */}
              {lastActualMonth && lastForecastMonth && (
                <ReferenceArea
                  x1={lastActualMonth}
                  x2={lastForecastMonth}
                  fill="#eef2ff"
                  fillOpacity={0.6}
                  strokeOpacity={0}
                />
              )}
              {/* Year divider */}
              {first2026Month && (
                <ReferenceLine
                  x={first2026Month}
                  stroke="#9ca3af"
                  strokeDasharray="4 4"
                  label={{ value: "2026", position: "top", fontSize: 11, fill: "#6b7280" }}
                />
              )}

              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => {
                  const mo = v.split("-")[1];
                  return MONTH_LABELS[mo] || mo;
                }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
              />
              <YAxis
                scale="log"
                domain={["auto", "auto"]}
                allowDataOverflow
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#e5e7eb" }}
                tickFormatter={(v: number) => {
                  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                  if (v >= 100) return v.toFixed(0);
                  return v.toFixed(1);
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label) => fmtMonth(String(label))}
                formatter={(value, name) => {
                  if (value == null) return ["\u2014", name ?? ""];
                  const unit = COMMODITY_UNITS[name ?? ""] || "";
                  return [`${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`, name ?? ""];
                }}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />

              {commodityNames.map((name) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={LINE_COLORS[name] || "#6b7280"}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-8">No historical data available.</p>
        )}
      </div>

      {/* Monthly Data Table */}
      {monthly.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Monthly Data</h2>
            <p className="text-sm text-gray-500">All values at month-end close. Forecast values shown in italics.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-t border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 font-medium text-gray-500">Month</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  {commodityNames.map((name) => (
                    <th key={name} className="text-right px-4 py-3 font-medium text-gray-500 whitespace-nowrap">
                      {name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthly.map((row) => {
                  const rowType = row.type as string;
                  const isForecast = rowType === "forecast";
                  const isCurrent = rowType === "current";

                  return (
                    <tr
                      key={row.month}
                      className={
                        isCurrent
                          ? "bg-indigo-50/50"
                          : isForecast
                          ? "bg-amber-50/30"
                          : ""
                      }
                    >
                      <td className="px-6 py-2.5 font-medium text-gray-900 whitespace-nowrap">
                        {fmtMonth(row.month as string)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${
                            isCurrent
                              ? "bg-indigo-100 text-indigo-700"
                              : isForecast
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {isCurrent ? "Current" : isForecast ? "Forecast" : "Past"}
                        </span>
                      </td>
                      {commodityNames.map((name) => {
                        const val = row[name];
                        return (
                          <td
                            key={name}
                            className={`text-right px-4 py-2.5 tabular-nums ${
                              isForecast ? "text-gray-400 italic" : "text-gray-700"
                            }`}
                          >
                            {val != null
                              ? Number(val).toLocaleString(undefined, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : "\u2014"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Data Sources */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Data Sources</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-500">
          <div className="flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: LINE_COLORS["Structural Steel (HRC)"] }} />
            <span><span className="font-medium text-gray-600">Structural Steel (HRC)</span> &mdash; Yahoo Finance futures (HRC=F) + FRED PPI: Steel Mill Products (WPU101)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: LINE_COLORS["Copper"] }} />
            <span><span className="font-medium text-gray-600">Copper</span> &mdash; Yahoo Finance futures (HG=F) + FRED PPI: Copper Wire &amp; Cable (WPU102502)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: LINE_COLORS["Diesel Fuel"] }} />
            <span><span className="font-medium text-gray-600">Diesel Fuel</span> &mdash; Yahoo Finance futures (HO=F) + FRED Avg Price: Diesel (APU000074714)</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: LINE_COLORS["Lumber (Framing)"] }} />
            <span><span className="font-medium text-gray-600">Lumber (Framing)</span> &mdash; FRED PPI: Lumber (WPU0811). No reliable futures ticker available.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: LINE_COLORS["Gypsum Board"] }} />
            <span><span className="font-medium text-gray-600">Gypsum Board</span> &mdash; FRED PPI: Gypsum Products (WPU057303). No market-traded instrument.</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="inline-block w-2 h-2 rounded-full mt-1 flex-shrink-0 bg-amber-400" />
            <span><span className="font-medium text-gray-600">Forecast</span> &mdash; Extrapolated using 2025 month-over-month percentage changes applied to current values.</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Interest rates sourced from FRED: 30-Year Mortgage (MORTGAGE30US), Prime Rate (DPRIME), Construction PPI (WPUSI012011).
          News from Construction Dive, ENR, and For Construction Pros RSS feeds.
        </p>
      </div>
    </div>
  );
}

/* ---------- Single Commodity Card ---------- */

function CommodityCard({ commodity }: { commodity: CommodityPrice }) {
  const change = commodity.change_30d ?? 0;
  const isPositive = change >= 0;
  const pctChange =
    commodity.current_price !== 0
      ? ((change / (commodity.current_price - change)) * 100).toFixed(2)
      : "0.00";
  const unit = COMMODITY_UNITS[commodity.name] || commodity.currency;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 relative">
      <div className="absolute top-4 right-4 text-gray-300">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V6m0 8v2m0-8c1.11 0 2.08.402 2.599 1M12 8c-1.11 0-2.08.402-2.599 1M12 16c-1.11 0-2.08-.402-2.599-1M12 16c1.11 0 2.08-.402 2.599-1" />
        </svg>
      </div>

      <p className="text-sm font-medium text-gray-500 mb-1">{commodity.name}</p>
      <p className="text-2xl font-bold text-gray-900 mb-2">
        {commodity.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
        <span className="text-sm font-normal text-gray-500">{unit}</span>
      </p>

      <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        ) : (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
        <span>
          {isPositive ? "+" : ""}
          {change.toFixed(2)} ({isPositive ? "+" : ""}
          {pctChange}%)
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-2">
        Source: {commodity.ticker?.startsWith("WPU") || commodity.ticker?.startsWith("APU") ? "FRED PPI" : "yfinance"}
      </p>
    </div>
  );
}

/* ================================================================
   Interest Rates Tab
   ================================================================ */

function InterestRatesTab({
  rates,
  loading,
}: {
  rates: Record<string, any> | undefined;
  loading: boolean;
}) {
  if (loading) return <LoadingSpinner message="Loading interest rates..." />;

  const entries = rates ? Object.entries(rates) : [];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Current Interest Rates</h2>
      <p className="text-sm text-gray-500 mb-6">Key benchmark rates affecting construction financing</p>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No rate data available.</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {entries.map(([key, rate]: [string, any]) => (
            <div key={key} className="bg-white rounded-xl border border-gray-200 p-5 relative">
              <div className="absolute top-4 right-4 text-gray-300">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-500 mb-1">{rate.label}</p>
              <p className="text-3xl font-bold text-gray-900">
                {rate.value != null ? `${rate.value}%` : "N/A"}
              </p>
              {rate.as_of && (
                <p className="text-xs text-gray-400 mt-2">As of {rate.as_of}</p>
              )}
              {rate.error && (
                <p className="text-xs text-red-500 mt-2">{rate.error}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Industry News Tab
   ================================================================ */

function IndustryNewsTab({
  news,
  loading,
}: {
  news: NewsItem[] | undefined;
  loading: boolean;
}) {
  if (loading) return <LoadingSpinner message="Loading industry news..." />;

  const items = news ?? [];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Construction Industry News</h2>
      <p className="text-sm text-gray-500 mb-6">Latest headlines and developments</p>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No news available.</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-base font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                  >
                    {item.title}
                  </a>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                      {item.source}
                    </span>
                    <span className="text-xs text-gray-400">{item.published}</span>
                  </div>
                  {item.summary && (
                    <p className="text-sm text-gray-600 mt-2 leading-relaxed">{item.summary}</p>
                  )}
                </div>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-4 flex-shrink-0 text-gray-400 hover:text-indigo-600"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   AI Insights Tab
   ================================================================ */

function AIInsightsTab({
  summary,
  loading,
}: {
  summary: { summary_text: string; commodities_used: number; news_count: number } | undefined;
  loading: boolean;
}) {
  if (loading) return <LoadingSpinner message="Generating AI market insights..." />;

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-1">AI Market Insights</h2>
      <p className="text-sm text-gray-500 mb-6">AI-generated analysis of current market conditions</p>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">Commodities Analyzed</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.commodities_used ?? 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">News Sources Reviewed</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.news_count ?? 0}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Market Summary</h3>
        </div>
        <div className="text-gray-700 whitespace-pre-line leading-relaxed">
          {summary?.summary_text || "No AI summary available. Market data may still be loading."}
        </div>
      </div>
    </div>
  );
}
