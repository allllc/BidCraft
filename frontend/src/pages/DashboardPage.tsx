import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listBids } from "../api/bids";
import type { BidSummary } from "../types/bid";

interface Bid extends BidSummary {
  estimated_cost?: number | null;
  confidence_level?: number | null;
}

const statusMap: Record<string, { label: string; classes: string }> = {
  uploaded: {
    label: "Draft",
    classes: "bg-gray-100 text-gray-600",
  },
  analyzing: {
    label: "Analyzing",
    classes: "bg-yellow-100 text-yellow-700 animate-pulse",
  },
  complete: {
    label: "Analyzed",
    classes: "bg-green-100 text-green-700",
  },
  preparation: {
    label: "Preparation",
    classes: "bg-purple-100 text-purple-700",
  },
  finalized: {
    label: "Finalized",
    classes: "bg-emerald-100 text-emerald-700",
  },
  error: {
    label: "Error",
    classes: "bg-red-100 text-red-600",
  },
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const {
    data: bids = [],
    isLoading,
    isError,
  } = useQuery<Bid[]>({
    queryKey: ["bids"],
    queryFn: listBids,
  });

  // Compute stats from bids data
  const activeBids = bids.filter((b) => b.status !== "complete").length;
  const readyToSubmit = bids.filter((b) => b.status === "complete").length;
  const totalBidValue = bids.reduce(
    (sum, b) => sum + (b.estimated_cost ?? 0),
    0
  );
  const confidenceLevels = bids
    .map((b) => b.confidence_level)
    .filter((c): c is number => c !== null && c !== undefined);
  const avgConfidence =
    confidenceLevels.length > 0
      ? Math.round(
          confidenceLevels.reduce((sum, c) => sum + c, 0) /
            confidenceLevels.length
        )
      : 0;

  const stats = [
    {
      title: "Active Bids",
      value: activeBids,
      subtitle: "In progress",
      icon: (
        <svg
          className="w-6 h-6 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      title: "Ready to Submit",
      value: readyToSubmit,
      subtitle: "Completed analysis",
      icon: (
        <svg
          className="w-6 h-6 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: "Total Bid Value",
      value: formatCurrency(totalBidValue),
      subtitle: "Combined estimates",
      icon: (
        <svg
          className="w-6 h-6 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      title: "Avg. Confidence",
      value: `${avgConfidence}%`,
      subtitle: "Across all bids",
      icon: (
        <svg
          className="w-6 h-6 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      ),
    },
  ];

  const quickActions = [
    {
      title: "Find Subcontractors",
      description: "Browse qualified subs by trade and location",
      link: "/subcontractors",
      icon: (
        <svg
          className="w-6 h-6 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
    },
    {
      title: "Market Intelligence",
      description: "Live commodity prices and construction news",
      link: "/market",
      icon: (
        <svg
          className="w-6 h-6 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      title: "Manage Prompts",
      description: "Edit AI templates for better analysis",
      link: "/prompts",
      icon: (
        <svg
          className="w-6 h-6 text-indigo-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-gray-500">
            Welcome back! Here's an overview of your active bids.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div
              key={stat.title}
              className="bg-white rounded-xl border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-gray-500">
                  {stat.title}
                </span>
                <div className="p-2 bg-gray-50 rounded-lg">{stat.icon}</div>
              </div>
              <div className="text-3xl font-bold text-gray-900">
                {isLoading ? (
                  <span className="inline-block w-16 h-8 bg-gray-200 rounded animate-pulse" />
                ) : (
                  stat.value
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">{stat.subtitle}</p>
            </div>
          ))}
        </div>

        {/* Recent Bids Section */}
        <div className="bg-white rounded-xl border border-gray-200 mb-8">
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Bids
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Your latest bid submissions and drafts
              </p>
            </div>
            <Link
              to="/upload"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Bid
            </Link>
          </div>

          {/* Bid List */}
          <div className="divide-y divide-gray-100">
            {isLoading && (
              <div className="px-6 py-12 text-center text-gray-400">
                <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-indigo-600 rounded-full animate-spin mb-3" />
                <p>Loading bids...</p>
              </div>
            )}

            {isError && (
              <div className="px-6 py-12 text-center text-red-500">
                <p>Failed to load bids. Please try again.</p>
              </div>
            )}

            {!isLoading && !isError && bids.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-400">
                <svg
                  className="mx-auto w-12 h-12 mb-3 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm">
                  No bids yet. Upload your first bid to get started.
                </p>
              </div>
            )}

            {!isLoading &&
              !isError &&
              bids.map((bid) => {
                const status = statusMap[bid.status] ?? statusMap.uploaded;
                return (
                  <div
                    key={bid.bid_id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    {/* Left side */}
                    <div className="flex items-center min-w-0">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-4">
                        <svg
                          className="w-5 h-5 text-indigo-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {bid.project_name}
                        </p>
                        <p className="text-sm text-gray-500 truncate">
                          {bid.location}
                        </p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-400">
                            {formatDate(bid.created_at)}
                          </span>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.classes}`}
                          >
                            {status.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex-shrink-0 text-right ml-4">
                      {bid.estimated_cost !== null &&
                        bid.estimated_cost !== undefined && (
                          <>
                            <p className="text-xs text-gray-400">
                              Estimated Value
                            </p>
                            <p className="text-sm font-semibold text-gray-900">
                              ${bid.estimated_cost.toLocaleString()}
                            </p>
                          </>
                        )}
                      {bid.status === "analyzing" ? (
                        <span className="text-xs text-yellow-600 font-medium">
                          Processing...
                        </span>
                      ) : (
                        <Link
                          to={`/bid/${bid.bid_id}`}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          View Details
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              to={action.link}
              className="bg-white rounded-xl border border-gray-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all group"
            >
              <div className="p-3 bg-indigo-50 rounded-lg w-fit mb-4 group-hover:bg-indigo-100 transition-colors">
                {action.icon}
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">
                {action.title}
              </h3>
              <p className="text-sm text-gray-500">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
