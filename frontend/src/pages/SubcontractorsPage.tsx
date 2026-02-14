import { useState, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { listSubcontractors, uploadSubcontractorsCsv, downloadCsvTemplate } from "../api/subcontractors";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import type { Subcontractor } from "../types/subcontractor";

/* ---------- helpers ---------- */

function tradeDescription(trade: string): string {
  const map: Record<string, string> = {
    Electrical: "Commercial & residential electrical systems",
    Plumbing: "Full-service plumbing & piping",
    HVAC: "Commercial cooling & heating systems",
    Concrete: "Foundations, flatwork & structural concrete",
    Framing: "Wood & metal framing structures",
    Roofing: "Commercial & industrial roofing",
    Drywall: "Interior wall & ceiling finishing",
    Painting: "Interior & exterior coatings",
    Flooring: "Tile, hardwood & epoxy flooring",
    Landscaping: "Site grading & landscape installation",
    Demolition: "Selective & full demolition services",
    Masonry: "Brick, block & stone construction",
    Insulation: "Thermal & acoustic insulation",
    "Fire Protection": "Sprinkler & suppression systems",
    Excavation: "Site excavation & earthwork",
    Steel: "Structural & miscellaneous steel erection",
    Glazing: "Curtain wall & storefront glazing",
    Elevator: "Elevator installation & modernisation",
  };
  return map[trade] || `Specialty ${trade.toLowerCase()} services`;
}

function pseudoRandom(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/* ---------- component ---------- */

export default function SubcontractorsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: subs, isLoading, error } = useQuery({
    queryKey: ["subcontractors"],
    queryFn: () => listSubcontractors(),
  });

  const [search, setSearch] = useState("");
  const [tradeFilter, setTradeFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ imported: number; errors: string[] } | null>(null);
  const [uploading, setUploading] = useState(false);

  /* derived data */
  const allTrades = useMemo(() => {
    if (!subs) return [];
    return Array.from(new Set(subs.map((s) => s.trade))).sort();
  }, [subs]);

  const allStates = useMemo(() => {
    if (!subs) return [];
    return Array.from(new Set(subs.map((s) => s.state))).sort();
  }, [subs]);

  const filtered = useMemo(() => {
    if (!subs) return [];
    return subs.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        s.company_name.toLowerCase().includes(q) ||
        s.trade.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.state.toLowerCase().includes(q);
      const matchesTrade = !tradeFilter || s.trade === tradeFilter;
      const matchesLocation = !locationFilter || s.state === locationFilter;
      return matchesSearch && matchesTrade && matchesLocation;
    });
  }, [subs, search, tradeFilter, locationFilter]);

  const avgRating = useMemo(() => {
    if (!subs || subs.length === 0) return 0;
    return subs.reduce((acc, s) => acc + s.rating, 0) / subs.length;
  }, [subs]);

  /* upload handler */
  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadSubcontractorsCsv(file);
      setUploadResult(result);
      queryClient.invalidateQueries({ queryKey: ["subcontractors"] });
    } catch {
      setUploadResult({ imported: 0, errors: ["Upload failed. Please check file format."] });
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) return <LoadingSpinner message="Loading subcontractors..." />;
  if (error) return <div className="text-red-600 p-4">Error loading subcontractors: {String(error)}</div>;

  return (
    <div>
      {/* -------- Header -------- */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Subcontractor Directory</h1>
          <p className="text-gray-500 mt-1">
            Browse and filter qualified subcontractors by trade, location, and performance.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowUpload(!showUpload)}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            {showUpload ? "Hide Upload" : "Upload CSV"}
          </button>
          <button
            onClick={downloadCsvTemplate}
            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Download Template
          </button>
        </div>
      </div>

      {/* -------- CSV Upload (collapsible) -------- */}
      {showUpload && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3">Import Subcontractors from CSV</h3>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFileUpload(file);
            }}
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
            <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            <p className="text-gray-600">{uploading ? "Uploading..." : "Drag & drop a CSV file here, or click to browse"}</p>
          </div>
          {uploadResult && (
            <div className={`mt-3 p-3 rounded-lg text-sm ${uploadResult.errors.length > 0 && uploadResult.imported === 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
              {uploadResult.imported > 0 && (
                <p className="text-green-700">Successfully imported {uploadResult.imported} subcontractors.</p>
              )}
              {uploadResult.errors.length > 0 && (
                <ul className="mt-1 text-red-600 list-disc list-inside">
                  {uploadResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* -------- Stat Cards -------- */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Subcontractors" value={subs?.length ?? 0} icon={
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6 5.87v-2a4 4 0 00-3-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        } />
        <StatCard label="Trades Covered" value={allTrades.length} icon={
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        } />
        <StatCard
          label="Avg. Rating"
          value={avgRating.toFixed(1)}
          highlight
          icon={
            <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" /></svg>
          }
        />
        <StatCard label="Total Projects" value={809} icon={
          <svg className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" /></svg>
        } />
      </div>

      {/* -------- Search & Filter -------- */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Search & Filter</h2>
        <p className="text-sm text-gray-500 mb-4">Find subcontractors by name, trade, or location</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name or specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Trade</label>
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Trades</option>
              {allTrades.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">All Locations</option>
              {allStates.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* -------- Results count -------- */}
      <p className="text-sm text-gray-600 mb-4">
        Showing <span className="font-semibold">{filtered.length}</span> subcontractors
      </p>

      {/* -------- Subcontractor Cards -------- */}
      <div className="space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-lg">No subcontractors match your filters.</p>
          </div>
        )}

        {filtered.map((sub) => (
          <SubcontractorCard key={sub.id} sub={sub} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Stat Card ---------- */

function StatCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`p-2 rounded-lg ${highlight ? "bg-amber-50" : "bg-indigo-50"}`}>{icon}</div>
      </div>
      <p className={`text-2xl font-bold ${highlight ? "text-amber-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}

/* ---------- Subcontractor Card ---------- */

function SubcontractorCard({ sub }: { sub: Subcontractor }) {
  const baseRate = sub.project_rate ?? sub.hourly_rate ?? 50000;
  const costLow = Math.round(baseRate * 0.65);
  const costHigh = Math.round(baseRate * 1.35);
  const projectCount = 100 + (pseudoRandom(sub.id) % 201); // 100-300
  const bookedWeeks = sub.booked_weeks || [];

  // Build a set of booked week numbers for the timeline bar
  const TOTAL_WEEKS = 52;
  const bookedSet = new Set<number>();
  for (const bw of bookedWeeks) {
    for (let w = bw.start_week; w <= bw.end_week; w++) bookedSet.add(w);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        {/* Left side */}
        <div className="flex-1">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>

            <div className="flex-1">
              {/* Name + trade badge */}
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{sub.company_name}</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700">
                  {sub.trade}
                </span>
              </div>

              {/* Location, Rating, Projects */}
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {sub.city}, {sub.state}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                  </svg>
                  {sub.rating.toFixed(1)}
                </span>
                <span className="flex items-center gap-1">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  {projectCount} projects
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-600 mb-3">{tradeDescription(sub.trade)}</p>

              {/* Availability Timeline (52-week bar) */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-gray-500">Availability (52 weeks)</p>
                  <p className="text-xs text-gray-400">
                    <span className="inline-block w-2 h-2 rounded-sm bg-green-400 mr-1 align-middle"></span>Available
                    <span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-1 ml-2 align-middle"></span>Booked
                  </p>
                </div>
                <div className="flex gap-px h-4 rounded overflow-hidden border border-gray-200">
                  {Array.from({ length: TOTAL_WEEKS }, (_, i) => {
                    const week = i + 1;
                    const isBooked = bookedSet.has(week);
                    const booking = bookedWeeks.find(bw => week >= bw.start_week && week <= bw.end_week);
                    return (
                      <div
                        key={week}
                        className={`flex-1 ${isBooked ? "bg-red-400" : "bg-green-400"}`}
                        title={isBooked && booking ? `W${week}: ${booking.project} (W${booking.start_week}-${booking.end_week})` : `W${week}: Available`}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                  <span>W1</span>
                  <span>W13</span>
                  <span>W26</span>
                  <span>W39</span>
                  <span>W52</span>
                </div>
                {bookedWeeks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {bookedWeeks.map((bw, j) => (
                      <span key={j} className="inline-flex items-center gap-1 text-[11px] text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400"></span>
                        W{bw.start_week}-{bw.end_week}: {bw.project}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button className="border border-gray-300 text-gray-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                  Contact
                </button>
                <button className="border border-indigo-300 text-indigo-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors">
                  Request Quote
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right side -- Cost Range + Availability */}
        <div className="ml-8 flex-shrink-0 w-48 text-right">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Est. Cost Range</p>
          <p className="text-sm font-semibold text-gray-900">
            ${costLow.toLocaleString()} &ndash; ${costHigh.toLocaleString()}
          </p>

          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mt-4 mb-1">Availability</p>
          <p className="text-sm font-semibold">
            {bookedWeeks.length === 0 ? (
              <span className="text-green-600">Fully Open</span>
            ) : (
              <span className="text-amber-600">{TOTAL_WEEKS - bookedSet.size}/{TOTAL_WEEKS} wks free</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
