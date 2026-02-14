import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listBids, deleteBid } from "../api/bids";
import type { BidSummary } from "../types/bid";

const statusFlow = [
  { key: "all", label: "All" },
  { key: "uploaded", label: "Uploaded" },
  { key: "analyzing", label: "Analyzing" },
  { key: "complete", label: "Analyzed" },
  { key: "preparation", label: "Preparation" },
  { key: "finalized", label: "Finalized" },
  { key: "error", label: "Error" },
];

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string; action: string; actionLink: (id: string) => string }> = {
  uploaded: {
    bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400",
    label: "Uploaded", action: "Analyze", actionLink: (id) => `/bid/${id}`,
  },
  analyzing: {
    bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-400 animate-pulse",
    label: "Analyzing", action: "View Progress", actionLink: (id) => `/bid/${id}`,
  },
  complete: {
    bg: "bg-green-50", text: "text-green-700", dot: "bg-green-400",
    label: "Analyzed", action: "Review & Prepare", actionLink: (id) => `/bid/${id}`,
  },
  preparation: {
    bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400",
    label: "In Preparation", action: "Continue Prep", actionLink: (id) => `/bid/${id}/preparation`,
  },
  finalized: {
    bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400",
    label: "Finalized", action: "View Final", actionLink: (id) => `/bid/${id}/preparation`,
  },
  error: {
    bg: "bg-red-50", text: "text-red-700", dot: "bg-red-400",
    label: "Error", action: "Retry", actionLink: (id) => `/bid/${id}`,
  },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function BidManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");

  const { data: bids = [], isLoading } = useQuery<BidSummary[]>({
    queryKey: ["bids"],
    queryFn: listBids,
    refetchInterval: (query) => {
      const data = query.state.data as BidSummary[] | undefined;
      const hasAnalyzing = data?.some(b => b.status === "analyzing");
      return hasAnalyzing ? 3000 : false;
    },
  });

  const deleteM = useMutation({
    mutationFn: deleteBid,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bids"] }),
  });

  const filtered = filter === "all" ? bids : bids.filter(b => b.status === filter);

  // Counts per status
  const counts: Record<string, number> = {};
  for (const b of bids) {
    counts[b.status] = (counts[b.status] || 0) + 1;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bid Management</h1>
          <p className="text-gray-500 mt-1">{bids.length} total project{bids.length !== 1 ? "s" : ""}</p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center px-5 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload New Bid
        </Link>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {statusFlow.map(s => {
          const count = s.key === "all" ? bids.length : (counts[s.key] || 0);
          const isActive = filter === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s.label}
              {count > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  isActive ? "bg-indigo-500 text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Bid Cards */}
      {isLoading && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
          <p className="text-gray-400">Loading bids...</p>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <svg className="mx-auto w-12 h-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">
            {filter === "all" ? "No bids yet. Upload your first bid to get started." : `No bids with status "${filter}".`}
          </p>
        </div>
      )}

      <div className="grid gap-4">
        {filtered.map(bid => {
          const cfg = statusConfig[bid.status] || statusConfig.uploaded;
          return (
            <div
              key={bid.bid_id}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate(cfg.actionLink(bid.bid_id))}
            >
              <div className="flex items-start justify-between">
                {/* Left */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">{bid.project_name}</h3>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{bid.client_name}</span>
                    {bid.location && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{bid.location}</span>
                      </>
                    )}
                    {bid.project_type && (
                      <>
                        <span className="text-gray-300">|</span>
                        <span>{bid.project_type}</span>
                      </>
                    )}
                    <span className="text-gray-300">|</span>
                    <span>{formatDate(bid.created_at)}</span>
                  </div>
                  {bid.bid_due_date && (
                    <p className="text-xs text-gray-400 mt-1">
                      Due: {formatDate(bid.bid_due_date)}
                    </p>
                  )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(cfg.actionLink(bid.bid_id));
                    }}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    {cfg.action}
                  </button>
                  {bid.status !== "analyzing" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${bid.project_name}"? This cannot be undone.`)) {
                          deleteM.mutate(bid.bid_id);
                        }
                      }}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50"
                      title="Delete bid"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress bar showing workflow stage */}
              <div className="mt-4 flex items-center gap-1">
                {["uploaded", "analyzing", "complete", "preparation", "finalized"].map((step, i) => {
                  const steps = ["uploaded", "analyzing", "complete", "preparation", "finalized"];
                  const currentIdx = steps.indexOf(bid.status);
                  const isComplete = i <= currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={step} className="flex-1 flex items-center gap-1">
                      <div className={`h-1.5 flex-1 rounded-full transition-colors ${
                        isComplete ? (isCurrent && bid.status === "analyzing" ? "bg-blue-400 animate-pulse" : "bg-indigo-500") : "bg-gray-200"
                      }`} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-gray-400">
                <span>Upload</span>
                <span>Analyze</span>
                <span>Review</span>
                <span>Prepare</span>
                <span>Final</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
