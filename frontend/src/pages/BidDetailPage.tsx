import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBid, analyzeBid, prepareBid } from "../api/bids";
import { listPrompts, listSubcontractors } from "../api/subcontractors";
import { getCommodities } from "../api/market";
import StatusBadge from "../components/shared/StatusBadge";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import type { BidDetail } from "../types/bid";
import type { PromptTemplate } from "../types/subcontractor";

const tabs = ["Scope", "Schedule", "Estimate", "Materials", "Subcontractors", "Risks & Questions"];

// Map each tab to the prompt slug that powers it
const tabToPromptSlug: Record<string, string> = {
  "Scope": "bid_extraction",
  "Schedule": "bid_extraction",
  "Risks & Questions": "bid_extraction",
  "Estimate": "material_procurement",
  "Materials": "material_procurement",
  "Subcontractors": "sub_scheduling",
};

// Analysis step descriptions
const promptStepInfo: Record<string, { step: number; label: string; description: string }> = {
  bid_extraction: {
    step: 1,
    label: "Step 1: Bid Extraction & Analysis",
    description: "Extracts scope, schedule, risks, and GC questions from the uploaded document text and tables.",
  },
  material_procurement: {
    step: 2,
    label: "Step 2: Material Procurement & Scheduling",
    description: "Generates cost estimates and material ordering schedule using scope from Step 1 + live commodity prices.",
  },
  sub_scheduling: {
    step: 3,
    label: "Step 3: Subcontractor Scheduling",
    description: "Matches required trades to subcontractors in the database and recommends mobilization timing.",
  },
};

// Variables that require a live API fetch when clicked
const ASYNC_VARIABLES = new Set(["subcontractor_data", "commodity_trends"]);

// Build the actual input data that gets fed into each prompt variable
function getInputDataForVariable(variable: string, bid: BidDetail): { label: string; data: string } | null {
  const analysis = bid.analysis;
  switch (variable) {
    case "document_text":
      return { label: "Document Text (raw_text)", data: bid.raw_text || "(empty)" };
    case "tables_text": {
      const tables = bid.raw_tables || [];
      if (!tables.length) return { label: "Tables Text", data: "No tables found in document." };
      const parts: string[] = [];
      tables.forEach((table: any, i: number) => {
        parts.push(`Table ${i + 1}:`);
        if (Array.isArray(table)) {
          table.forEach((row: any) => {
            parts.push(Array.isArray(row) ? row.join(" | ") : String(row));
          });
        }
        parts.push("");
      });
      return { label: "Tables Text (formatted)", data: parts.join("\n") };
    }
    case "project_type":
      return { label: "Project Type", data: bid.project_type || "Commercial" };
    case "location":
      return { label: "Location", data: bid.location || "(not specified)" };
    case "scope_summary":
      return { label: "Scope Summary (from Step 1)", data: analysis?.bid_extraction?.summary || "(not yet generated — run analysis first)" };
    case "commodity_prices":
      return { label: "Live Commodity Prices", data: analysis?.commodity_snapshot ? JSON.stringify(analysis.commodity_snapshot, null, 2) : "(fetched at analysis time from market data)" };
    case "commodity_trends":
      return { label: "Commodity Price Trends (3-month)", data: "Loading..." };
    case "estimate_summary":
      return {
        label: "Estimate Summary (top 5 line items from Step 2)",
        data: analysis?.material_procurement?.line_items
          ? JSON.stringify(analysis.material_procurement.line_items.slice(0, 5), null, 2)
          : "(not yet generated — run analysis first)",
      };
    case "subcontractor_data":
      return { label: "Subcontractor Database (all subs)", data: "Loading..." };
    case "project_timeline":
      return {
        label: "Project Timeline (from Step 2)",
        data: analysis?.material_procurement?.timeline
          ? JSON.stringify(analysis.material_procurement.timeline, null, 2)
          : "(not yet generated — run analysis first)",
      };
    default:
      return { label: variable, data: "(unknown variable)" };
  }
}

// Fetch live data for async variables
async function fetchVariableData(variable: string): Promise<string> {
  switch (variable) {
    case "subcontractor_data": {
      const subs = await listSubcontractors();
      return JSON.stringify(subs, null, 2);
    }
    case "commodity_trends": {
      const commodities = await getCommodities();
      // Extract the trend data: last 3 months of each commodity for trend calculation
      const current = commodities.current || [];
      const trendSummary = current.map((c: any) => ({
        name: c.name,
        current_price: c.current_price,
        unit: c.unit,
        change_30d: c.change_30d,
      }));
      return JSON.stringify(trendSummary, null, 2);
    }
    default:
      return "(unknown variable)";
  }
}

export default function BidDetailPage() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("Scope");
  const [promptPanelOpen, setPromptPanelOpen] = useState(false);
  const [inputDataModal, setInputDataModal] = useState<{ variable: string; label: string; data: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: bid, isLoading } = useQuery({
    queryKey: ["bid", bidId],
    queryFn: () => getBid(bidId!),
    refetchInterval: (query) => {
      const data = query.state.data as BidDetail | undefined;
      return data?.status === "analyzing" ? 3000 : false;
    },
  });

  const { data: prompts } = useQuery<PromptTemplate[]>({
    queryKey: ["prompts"],
    queryFn: listPrompts,
  });

  const analyzeMutation = useMutation({
    mutationFn: () => analyzeBid(bidId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["bid", bidId] }),
  });

  const prepareMutation = useMutation({
    mutationFn: () => prepareBid(bidId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bid", bidId] });
      navigate(`/bid/${bidId}/preparation`);
    },
  });

  if (isLoading) return <LoadingSpinner message="Loading bid..." />;
  if (!bid) return <div className="text-red-600">Bid not found</div>;

  const analysis = bid.analysis;

  // Get the prompt for the current tab
  const currentSlug = tabToPromptSlug[activeTab] || "bid_extraction";
  const currentPrompt = prompts?.find(p => p.slug === currentSlug);
  const stepInfo = promptStepInfo[currentSlug];

  const handleExportPdf = async () => {
    if (!analysis) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(24);
    doc.text("Bid Package", 20, 30);
    doc.setFontSize(14);
    doc.text(bid.project_name, 20, 45);
    doc.setFontSize(10);
    doc.text(`Client: ${bid.client_name}`, 20, 55);
    doc.text(`Location: ${bid.location || "N/A"}`, 20, 62);
    doc.text(`Type: ${bid.project_type || "N/A"}`, 20, 69);
    doc.text(`Due: ${bid.bid_due_date || "N/A"}`, 20, 76);

    doc.addPage();
    doc.setFontSize(16);
    doc.text("Scope Summary", 20, 20);
    doc.setFontSize(10);
    const scopeText = analysis.bid_extraction?.summary || "N/A";
    doc.text(doc.splitTextToSize(scopeText, 170), 20, 30);

    if (analysis.material_procurement?.line_items?.length) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Cost Estimate", 20, 20);
      autoTable(doc, {
        startY: 30,
        head: [["Division", "Description", "Qty", "Unit", "Unit Cost", "Total"]],
        body: analysis.material_procurement.line_items.map((item: any) => [
          item.division, item.description, item.quantity, item.unit,
          `$${item.unit_cost?.toLocaleString()}`, `$${item.total?.toLocaleString()}`,
        ]),
      });
    }

    if (analysis.bid_extraction?.risk_flags?.length) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Risk Flags", 20, 20);
      let y = 30;
      analysis.bid_extraction.risk_flags.forEach((r: any) => {
        doc.setFontSize(10);
        doc.text(`[${r.severity?.toUpperCase()}] ${r.category}: ${r.description}`, 20, y);
        y += 8;
        doc.text(`  Recommendation: ${r.recommendation}`, 20, y);
        y += 10;
        if (y > 270) { doc.addPage(); y = 20; }
      });
    }

    doc.save(`${bid.project_name.replace(/\s+/g, "_")}_bid_package.pdf`);
  };

  const handleExportCsv = () => {
    window.open(`/api/export/${bidId}/csv`, "_blank");
  };

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">{bid.project_name}</h1>
            <StatusBadge status={bid.status} />
          </div>
          <p className="text-gray-500 mt-1">{bid.client_name} &middot; {bid.location} &middot; {bid.project_type}</p>
        </div>
        <div className="flex gap-2">
          {analysis && (
            <>
              <button onClick={handleExportPdf} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">Export PDF</button>
              <button onClick={handleExportCsv} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 text-sm">Export CSV</button>
            </>
          )}
          {(bid.status === "uploaded" || bid.status === "error") && (
            <button
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {analyzeMutation.isPending ? "Starting..." : "Analyze with AI"}
            </button>
          )}
          {bid.status === "complete" && (
            <button
              onClick={() => prepareMutation.mutate()}
              disabled={prepareMutation.isPending}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 text-sm font-medium"
            >
              {prepareMutation.isPending ? "Submitting..." : "Submit for Preparation"}
            </button>
          )}
          {(bid.status === "preparation" || bid.status === "finalized") && (
            <button
              onClick={() => navigate(`/bid/${bidId}/preparation`)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 text-sm font-medium"
            >
              {bid.status === "finalized" ? "View Final Bid" : "Go to Preparation"}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards (when analysis exists) */}
      {analysis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500">Total Estimate</span>
            <p className="text-xl font-bold text-gray-900">
              ${analysis.material_procurement?.total_estimated_cost?.toLocaleString() || "N/A"}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500">Duration</span>
            <p className="text-xl font-bold text-gray-900">
              {analysis.material_procurement?.timeline?.total_duration_weeks || "N/A"} weeks
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500">Trades Required</span>
            <p className="text-xl font-bold text-gray-900">
              {analysis.sub_scheduling?.required_trades?.length || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <span className="text-sm text-gray-500">Risk Flags</span>
            <p className="text-xl font-bold text-gray-900">
              {analysis.bid_extraction?.risk_flags?.length || 0}
              {(() => {
                const highCount = (analysis.bid_extraction?.risk_flags || []).filter((r: any) => r.severity === "high").length;
                return highCount > 0 ? <span className="text-sm text-red-600 ml-1">({highCount} high)</span> : null;
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Analyzing state */}
      {bid.status === "analyzing" && (
        <LoadingSpinner message="AI is analyzing your bid document... This may take 1-2 minutes." />
      )}

      {/* No analysis yet */}
      {!analysis && bid.status === "uploaded" && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-lg">Document uploaded successfully</p>
          <p className="text-gray-400 mt-2">Click "Analyze with AI" to extract scope, generate estimates, and more</p>
        </div>
      )}

      {/* Tabs */}
      {analysis && (
        <>
          <div className="border-b border-gray-200 mb-6 flex items-center justify-between">
            <div className="flex gap-0">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPromptPanelOpen(!promptPanelOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors mb-1 ${
                promptPanelOpen
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              {promptPanelOpen ? "Hide Prompt" : "View Prompt"}
            </button>
          </div>

          <div className="flex gap-6">
            {/* Main content */}
            <div className={`transition-all ${promptPanelOpen ? "flex-1 min-w-0" : "w-full"}`}>
              {activeTab === "Scope" && <ScopeTab analysis={analysis} />}
              {activeTab === "Schedule" && <ScheduleTab analysis={analysis} />}
              {activeTab === "Estimate" && <EstimateTab analysis={analysis} />}
              {activeTab === "Materials" && <MaterialsTab analysis={analysis} />}
              {activeTab === "Subcontractors" && <SubsTab analysis={analysis} />}
              {activeTab === "Risks & Questions" && <RisksTab analysis={analysis} />}
            </div>

            {/* Prompt Side Panel */}
            {promptPanelOpen && (
              <div className="w-[480px] flex-shrink-0">
                <div className="bg-white rounded-xl border border-gray-200 sticky top-4 max-h-[calc(100vh-120px)] overflow-y-auto">
                  {/* Panel Header */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded">
                          {stepInfo?.step ? `Step ${stepInfo.step}` : "Prompt"}
                        </span>
                        <h3 className="font-semibold text-sm text-gray-900">
                          {currentPrompt?.name || currentSlug}
                        </h3>
                      </div>
                      <button
                        onClick={() => setPromptPanelOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">{stepInfo?.description}</p>
                  </div>

                  {/* Prompt metadata */}
                  {currentPrompt && (
                    <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-3 text-xs">
                      <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                        Model: {currentPrompt.model}
                      </span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        Max tokens: {currentPrompt.max_tokens.toLocaleString()}
                      </span>
                      <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        v{currentPrompt.version}
                      </span>
                      {!currentPrompt.is_default && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                          Customized
                        </span>
                      )}
                    </div>
                  )}

                  {/* Variables — clickable to view actual input data */}
                  {currentPrompt && (
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-xs font-medium text-gray-500 mb-2">INPUT VARIABLES <span className="text-gray-400 font-normal">(click to view data)</span></p>
                      <div className="flex flex-wrap gap-1.5">
                        {currentPrompt.variables.map(v => (
                          <button
                            key={v}
                            onClick={async () => {
                              const info = getInputDataForVariable(v, bid);
                              if (!info) return;
                              // Show modal immediately (with "Loading..." for async vars)
                              setInputDataModal({ variable: v, ...info });
                              // If this variable requires a live fetch, do it now
                              if (ASYNC_VARIABLES.has(v)) {
                                const liveData = await fetchVariableData(v);
                                setInputDataModal(prev =>
                                  prev?.variable === v ? { ...prev, data: liveData } : prev
                                );
                              }
                            }}
                            className={`text-xs font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                              ASYNC_VARIABLES.has(v)
                                ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:border-blue-400"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-400"
                            }`}
                            title={ASYNC_VARIABLES.has(v) ? "Click to fetch live data" : "Click to view data"}
                          >
                            {ASYNC_VARIABLES.has(v) && (
                              <svg className="w-3 h-3 inline mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            )}
                            {`{${v}}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full prompt text */}
                  <div className="p-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">FULL PROMPT TEMPLATE</p>
                    {currentPrompt ? (
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-3 border border-gray-200 leading-relaxed">
                        {highlightVariables(currentPrompt.template_text, currentPrompt.variables)}
                      </pre>
                    ) : (
                      <p className="text-sm text-gray-400">Loading prompt template...</p>
                    )}
                  </div>

                  {/* Pipeline visualization */}
                  <div className="px-4 pb-4">
                    <p className="text-xs font-medium text-gray-500 mb-2">ANALYSIS PIPELINE</p>
                    <div className="space-y-2">
                      {Object.entries(promptStepInfo).map(([slug, info]) => {
                        const isActive = slug === currentSlug;
                        return (
                          <div
                            key={slug}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                              isActive ? "bg-indigo-50 border border-indigo-200" : "bg-gray-50"
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              isActive ? "bg-indigo-600 text-white" : "bg-gray-300 text-white"
                            }`}>
                              {info.step}
                            </span>
                            <span className={`font-medium ${isActive ? "text-indigo-700" : "text-gray-500"}`}>
                              {info.label.replace(`Step ${info.step}: `, "")}
                            </span>
                            {isActive && (
                              <span className="ml-auto text-indigo-500">
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Input Data Modal */}
      {inputDataModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setInputDataModal(null)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-mono font-bold px-2 py-0.5 rounded border border-emerald-200">
                    {`{${inputDataModal.variable}}`}
                  </span>
                  <h3 className="font-semibold text-gray-900">{inputDataModal.label}</h3>
                </div>
                <p className="text-xs text-gray-500">
                  This is the actual data passed into the prompt template for this variable
                </p>
              </div>
              <button
                onClick={() => setInputDataModal(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono bg-gray-50 rounded-lg p-4 border border-gray-200 leading-relaxed max-h-[60vh] overflow-y-auto">
                {inputDataModal.data}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {inputDataModal.data.length.toLocaleString()} characters
              </span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inputDataModal.data);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy to clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Render prompt text with highlighted variables
function highlightVariables(text: string, variables: string[]): React.ReactNode {
  if (!variables.length) return text;

  const pattern = new RegExp(`(\\{(?:${variables.join("|")})\\})`, "g");
  const parts = text.split(pattern);

  return parts.map((part, i) => {
    if (pattern.test(part)) {
      return (
        <span key={i} className="bg-emerald-100 text-emerald-800 px-0.5 rounded font-semibold">
          {part}
        </span>
      );
    }
    return part;
  });
}

function ScopeTab({ analysis }: { analysis: any }) {
  const ext = analysis.bid_extraction || {};
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-lg mb-2">Scope Summary</h3>
        <p className="text-gray-700">{ext.summary || "No summary available"}</p>
      </div>
      <div className="grid gap-4">
        {(ext.divisions || []).map((div: any, i: number) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-100 text-blue-700 text-xs font-mono px-2 py-1 rounded">
                {div.division_code}
              </span>
              <h4 className="font-semibold">{div.division_name}</h4>
            </div>
            <p className="text-gray-600 text-sm mb-3">{div.description}</p>
            <div className="flex flex-wrap gap-2">
              {(div.key_items || []).map((item: string, j: number) => (
                <span key={j} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                  {item}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ScheduleTab({ analysis }: { analysis: any }) {
  const schedule = analysis.bid_extraction?.schedule || [];
  const mp = analysis.material_procurement || {};
  const phases = mp.timeline?.phases || [];
  const totalWeeks = mp.timeline?.total_duration_weeks || 52;

  return (
    <div className="space-y-6">
      {phases.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold text-lg mb-4">
            Project Phases
            {totalWeeks && (
              <span className="text-sm font-normal text-gray-500 ml-2">
                ({totalWeeks} weeks total)
              </span>
            )}
          </h3>
          <div className="space-y-3">
            {phases.map((phase: any, i: number) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-48 text-sm font-medium truncate">{phase.phase_name}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-blue-500 rounded-full h-6 flex items-center justify-center text-white text-xs"
                    style={{
                      marginLeft: `${(phase.start_week / totalWeeks) * 100}%`,
                      width: `${Math.max((phase.duration_weeks / totalWeeks) * 100, 5)}%`,
                    }}
                  >
                    W{phase.start_week}-{phase.start_week + phase.duration_weeks}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-lg">Construction Schedule</h3>
          <p className="text-sm text-gray-500">Activities extracted from bid document</p>
        </div>
        {schedule.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-700">Activity</th>
                <th className="text-left p-3 font-medium text-gray-700">Trade</th>
                <th className="text-center p-3 font-medium text-gray-700">Start Week</th>
                <th className="text-center p-3 font-medium text-gray-700">Duration</th>
                <th className="text-left p-3 font-medium text-gray-700">Dependencies</th>
                <th className="text-left p-3 font-medium text-gray-700">Materials</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((act: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="p-3 font-medium">{act.activity}</td>
                  <td className="p-3">
                    <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">
                      {act.trade}
                    </span>
                  </td>
                  <td className="p-3 text-center">W{act.start_week}</td>
                  <td className="p-3 text-center">{act.duration_weeks}wk</td>
                  <td className="p-3 text-sm text-gray-500">
                    {(act.dependencies || []).join(", ") || "-"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {(act.materials_needed || []).map((m: string, j: number) => (
                        <span key={j} className="bg-gray-100 text-gray-600 text-xs px-1.5 py-0.5 rounded">
                          {m}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No schedule data extracted. Re-analyze the bid to generate the construction schedule.
          </div>
        )}
      </div>
    </div>
  );
}

function EstimateTab({ analysis }: { analysis: any }) {
  const mp = analysis.material_procurement || {};
  const items = mp.line_items || [];
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3 font-medium text-gray-700">Division</th>
              <th className="text-left p-3 font-medium text-gray-700">Description</th>
              <th className="text-right p-3 font-medium text-gray-700">Qty</th>
              <th className="text-left p-3 font-medium text-gray-700">Unit</th>
              <th className="text-right p-3 font-medium text-gray-700">Unit Cost</th>
              <th className="text-right p-3 font-medium text-gray-700">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any, i: number) => (
              <tr key={i} className={`border-t ${item.commodity_adjusted ? "bg-amber-50" : ""}`}>
                <td className="p-3">{item.division}</td>
                <td className="p-3">
                  {item.description}
                  {item.commodity_adjusted && (
                    <span className="ml-2 text-xs bg-amber-200 text-amber-800 px-1 rounded">commodity-adjusted</span>
                  )}
                </td>
                <td className="p-3 text-right">{item.quantity}</td>
                <td className="p-3">{item.unit}</td>
                <td className="p-3 text-right">${item.unit_cost?.toLocaleString()}</td>
                <td className="p-3 text-right font-medium">${item.total?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-semibold">
            <tr>
              <td colSpan={5} className="p-3 text-right">Total Estimated Cost:</td>
              <td className="p-3 text-right text-lg">${mp.total_estimated_cost?.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex-1">
          <span className="text-sm text-gray-500">Confidence Level</span>
          <p className="text-lg font-semibold capitalize">{mp.confidence_level || "N/A"}</p>
        </div>
      </div>
      {mp.assumptions?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-semibold mb-3">Key Assumptions</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            {mp.assumptions.map((a: string, i: number) => <li key={i}>{a}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function MaterialsTab({ analysis }: { analysis: any }) {
  const orders = analysis.material_procurement?.material_orders || [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-lg">Material Procurement Schedule</h3>
          <p className="text-sm text-gray-500">Order timing based on commodity price trends and project schedule</p>
        </div>
        {orders.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-700">Material</th>
                <th className="text-right p-3 font-medium text-gray-700">Est. Cost</th>
                <th className="text-center p-3 font-medium text-gray-700">Order By</th>
                <th className="text-center p-3 font-medium text-gray-700">Needed By</th>
                <th className="text-center p-3 font-medium text-gray-700">Trend</th>
                <th className="text-left p-3 font-medium text-gray-700">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="p-3 font-medium">{order.material}</td>
                  <td className="p-3 text-right">
                    {order.estimated_cost ? `$${order.estimated_cost.toLocaleString()}` : "-"}
                  </td>
                  <td className="p-3 text-center">Week {order.order_by_week}</td>
                  <td className="p-3 text-center">Week {order.needed_by_week}</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      order.commodity_trend === "rising" ? "bg-red-100 text-red-700" :
                      order.commodity_trend === "falling" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-700"
                    }`}>
                      {order.commodity_trend}
                    </span>
                  </td>
                  <td className="p-3 text-sm text-gray-600">{order.recommendation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">No material orders generated</div>
        )}
      </div>
    </div>
  );
}

function RisksTab({ analysis }: { analysis: any }) {
  const ext = analysis.bid_extraction || {};
  const risks = ext.risk_flags || [];
  const questions = ext.gc_questions || [];

  const severityColors: Record<string, string> = {
    high: "border-l-red-500 bg-red-50",
    medium: "border-l-yellow-500 bg-yellow-50",
    low: "border-l-gray-400 bg-gray-50",
  };
  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-700",
    medium: "bg-yellow-100 text-yellow-700",
    low: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-semibold text-lg mb-4">Risk Flags ({risks.length})</h3>
        <div className="space-y-3">
          {risks.map((risk: any, i: number) => (
            <div key={i} className={`border-l-4 rounded-lg p-4 ${severityColors[risk.severity] || severityColors.low}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase">{risk.severity}</span>
                <span className="text-xs text-gray-500">{risk.category}</span>
              </div>
              <p className="text-sm font-medium">{risk.description}</p>
              <p className="text-sm text-gray-600 mt-1">Recommendation: {risk.recommendation}</p>
            </div>
          ))}
          {risks.length === 0 && <p className="text-gray-500">No risks identified</p>}
        </div>
      </div>
      <div>
        <h3 className="font-semibold text-lg mb-4">GC Questions ({questions.length})</h3>
        <div className="space-y-3">
          {questions.map((q: any, i: number) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between">
                <p className="font-medium">{i + 1}. {q.question}</p>
                <span className={`text-xs px-2 py-0.5 rounded ml-2 shrink-0 ${priorityColors[q.priority] || ""}`}>
                  {q.priority}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{q.context}</p>
            </div>
          ))}
          {questions.length === 0 && <p className="text-gray-500">No questions generated</p>}
        </div>
      </div>
    </div>
  );
}

function SubsTab({ analysis }: { analysis: any }) {
  const sched = analysis.sub_scheduling || {};
  const trades = sched.required_trades || [];
  const matches = sched.matches || [];
  const notes = sched.schedule_notes || [];

  // Group matches by trade
  const matchesByTrade: Record<string, any[]> = {};
  for (const m of matches) {
    const trade = m.trade || "Unknown";
    if (!matchesByTrade[trade]) matchesByTrade[trade] = [];
    matchesByTrade[trade].push(m);
  }
  // Sort each group by confidence desc
  for (const trade of Object.keys(matchesByTrade)) {
    matchesByTrade[trade].sort((a: any, b: any) => (b.confidence || 0) - (a.confidence || 0));
  }

  return (
    <div className="space-y-6">
      {/* Required Trades Overview */}
      {trades.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-lg">Required Trades</h3>
            <p className="text-sm text-gray-500">{trades.length} trades identified &middot; {matches.length} subcontractor options matched</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3 font-medium text-gray-700">Trade</th>
                <th className="text-left p-3 font-medium text-gray-700">Scope</th>
                <th className="text-center p-3 font-medium text-gray-700">Mobilize</th>
                <th className="text-center p-3 font-medium text-gray-700">Duration</th>
                <th className="text-center p-3 font-medium text-gray-700">Priority</th>
                <th className="text-center p-3 font-medium text-gray-700">Options</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t: any, i: number) => {
                const tradeMatches = matchesByTrade[t.trade] || [];
                return (
                  <tr key={i} className="border-t">
                    <td className="p-3 font-medium">{t.trade}</td>
                    <td className="p-3 text-sm text-gray-600 max-w-xs truncate">{t.scope_description}</td>
                    <td className="p-3 text-center">W{t.mobilize_week}</td>
                    <td className="p-3 text-center">{t.estimated_duration_weeks}wk</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        t.priority === "critical_path" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {t.priority === "critical_path" ? "Critical" : "Flexible"}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="bg-gray-100 text-gray-700 text-xs font-medium px-2 py-0.5 rounded">
                        {tradeMatches.length} sub{tradeMatches.length !== 1 ? "s" : ""}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Matches grouped by trade */}
      {trades.map((t: any) => {
        const tradeMatches = matchesByTrade[t.trade] || [];
        if (tradeMatches.length === 0) return null;
        return (
          <div key={t.trade} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">{t.trade}</h3>
                <p className="text-sm text-gray-500">
                  Need by Week {t.mobilize_week} &middot; {t.estimated_duration_weeks} weeks &middot;{" "}
                  {tradeMatches.length} option{tradeMatches.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-medium ${
                t.priority === "critical_path" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
              }`}>
                {t.priority === "critical_path" ? "Critical Path" : "Flexible"}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700">Company</th>
                  <th className="text-center p-3 font-medium text-gray-700">Confidence</th>
                  <th className="text-center p-3 font-medium text-gray-700">Rating</th>
                  <th className="text-left p-3 font-medium text-gray-700">Scheduling</th>
                  <th className="text-right p-3 font-medium text-gray-700">Hourly</th>
                  <th className="text-right p-3 font-medium text-gray-700">Project Rate</th>
                  <th className="text-center p-3 font-medium text-gray-700">Mobilize</th>
                </tr>
              </thead>
              <tbody>
                {tradeMatches.map((m: any, i: number) => {
                  const bookedWeeks: Array<{ project: string; start_week: number; end_week: number }> = m.booked_weeks || [];
                  const hasConflict = m.scheduling_conflict === true;
                  return (
                  <tr key={i} className={`border-t ${i === 0 ? "bg-blue-50/30" : ""}`}>
                    <td className="p-3">
                      <div className="font-medium">{m.company_name}</div>
                      <div className="text-xs text-gray-500">{m.location}</div>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`font-bold ${
                        m.confidence >= 80 ? "text-green-600" : m.confidence >= 50 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {m.confidence}%
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {m.rating ? (
                        <span className="flex items-center justify-center gap-1">
                          <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm font-medium">{m.rating}</span>
                        </span>
                      ) : "-"}
                    </td>
                    <td className="p-3">
                      <div className="space-y-1">
                        {/* Conflict indicator */}
                        {hasConflict ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            Conflict
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Available
                          </span>
                        )}
                        {/* Booked weeks summary */}
                        {bookedWeeks.length > 0 ? (
                          <div className="text-xs text-gray-500">
                            {bookedWeeks.map((bw, j) => (
                              <div key={j} className="flex items-center gap-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-red-300 flex-shrink-0"></span>
                                <span>W{bw.start_week}-{bw.end_week}: {bw.project}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-green-600">Fully available</div>
                        )}
                        {/* Available weeks during project if AI returned it */}
                        {m.available_weeks_during_project && (
                          <div className="text-xs text-blue-600 mt-0.5">{m.available_weeks_during_project}</div>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-right">{m.hourly_rate ? `$${m.hourly_rate}/hr` : "-"}</td>
                    <td className="p-3 text-right">{m.project_rate ? `$${m.project_rate.toLocaleString()}` : "-"}</td>
                    <td className="p-3 text-center">W{m.mobilize_week}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {/* Show reasoning for top match */}
            {tradeMatches[0]?.reasoning && (
              <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  <span className="font-medium text-gray-700">Top match reasoning:</span> {tradeMatches[0].reasoning}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* Unmatched trades */}
      {trades.filter((t: any) => !(matchesByTrade[t.trade]?.length > 0)).length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Trades Without Matches</h4>
          <div className="flex flex-wrap gap-2">
            {trades.filter((t: any) => !(matchesByTrade[t.trade]?.length > 0)).map((t: any) => (
              <span key={t.trade} className="bg-yellow-100 text-yellow-700 text-xs font-medium px-2 py-1 rounded">
                {t.trade}
              </span>
            ))}
          </div>
        </div>
      )}

      {matches.length === 0 && trades.length === 0 && (
        <p className="text-gray-500">No subcontractor matches found</p>
      )}

      {notes.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">Schedule Notes</h4>
          <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
            {notes.map((n: string, i: number) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
