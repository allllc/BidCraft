import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBid, updateBidPreparation, finalizeBid } from "../api/bids";
import StatusBadge from "../components/shared/StatusBadge";
import LoadingSpinner from "../components/shared/LoadingSpinner";


interface ScheduleRow {
  activity: string;
  trade: string;
  start_week: number;
  duration_weeks: number;
  dependencies: string;
  materials_needed: string;
}

interface SubRow {
  trade: string;
  company_name: string;
  mobilize_week: number;
  duration_weeks: number;
  rate: string;
  confidence: number;
}

interface MaterialRow {
  material: string;
  estimated_cost: number;
  order_by_week: number;
  needed_by_week: number;
  commodity_trend: string;
  recommendation: string;
}

const prepTabs = ["Schedule", "Subcontractors", "Materials"];

export default function BidPreparationPage() {
  const { bidId } = useParams<{ bidId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("Schedule");
  const [dirty, setDirty] = useState(false);

  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [subRows, setSubRows] = useState<SubRow[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialRow[]>([]);

  const { data: bid, isLoading } = useQuery({
    queryKey: ["bid", bidId],
    queryFn: () => getBid(bidId!),
  });

  // Initialize tables from analysis data
  useEffect(() => {
    if (!bid?.analysis) return;

    const analysis = bid.analysis;
    const existing = (bid as any).preparation;

    // Schedule: prefer saved preparation data, fall back to analysis
    if (existing?.schedule) {
      setScheduleRows(existing.schedule);
    } else {
      const schedule = analysis.bid_extraction?.schedule || [];
      const phases = analysis.material_procurement?.timeline?.phases || [];
      // Merge schedule activities with phase data
      if (schedule.length > 0) {
        setScheduleRows(schedule.map((a: any) => ({
          activity: a.activity,
          trade: a.trade,
          start_week: a.start_week,
          duration_weeks: a.duration_weeks,
          dependencies: (a.dependencies || []).join(", "),
          materials_needed: (a.materials_needed || []).join(", "),
        })));
      } else {
        setScheduleRows(phases.map((p: any) => ({
          activity: p.phase_name,
          trade: "",
          start_week: p.start_week,
          duration_weeks: p.duration_weeks,
          dependencies: "",
          materials_needed: (p.materials_needed || []).join(", "),
        })));
      }
    }

    // Subs
    if (existing?.subcontractors) {
      setSubRows(existing.subcontractors);
    } else {
      const trades = analysis.sub_scheduling?.required_trades || [];
      const matches = analysis.sub_scheduling?.matches || [];
      setSubRows(trades.map((t: any) => {
        const match = matches.find((m: any) => m.trade === t.trade);
        return {
          trade: t.trade,
          company_name: match?.company_name || "",
          mobilize_week: t.mobilize_week,
          duration_weeks: t.estimated_duration_weeks,
          rate: match?.project_rate ? `$${match.project_rate.toLocaleString()}` : match?.hourly_rate ? `$${match.hourly_rate}/hr` : "",
          confidence: match?.confidence || 0,
        };
      }));
    }

    // Materials
    if (existing?.materials) {
      setMaterialRows(existing.materials);
    } else {
      const orders = analysis.material_procurement?.material_orders || [];
      setMaterialRows(orders.map((o: any) => ({
        material: o.material,
        estimated_cost: o.estimated_cost || 0,
        order_by_week: o.order_by_week,
        needed_by_week: o.needed_by_week,
        commodity_trend: o.commodity_trend,
        recommendation: o.recommendation,
      })));
    }
  }, [bid]);

  const saveMutation = useMutation({
    mutationFn: () => updateBidPreparation(bidId!, {
      schedule: scheduleRows,
      subcontractors: subRows,
      materials: materialRows,
    }),
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["bid", bidId] });
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => finalizeBid(bidId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bid", bidId] });
    },
  });

  if (isLoading) return <LoadingSpinner message="Loading bid preparation..." />;
  if (!bid) return <div className="text-red-600">Bid not found</div>;
  if (!bid.analysis) return <div className="text-red-600">Bid has not been analyzed yet</div>;

  const analysis = bid.analysis;
  const isFinalized = bid.status === "finalized";

  const updateScheduleRow = (i: number, field: keyof ScheduleRow, value: string | number) => {
    setScheduleRows(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
    setDirty(true);
  };

  const updateSubRow = (i: number, field: keyof SubRow, value: string | number) => {
    setSubRows(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
    setDirty(true);
  };

  const updateMaterialRow = (i: number, field: keyof MaterialRow, value: string | number) => {
    setMaterialRows(prev => prev.map((row, idx) => idx === i ? { ...row, [field]: value } : row));
    setDirty(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate(`/bid/${bidId}`)} className="text-sm text-blue-600 hover:underline mb-2 inline-block">
            &larr; Back to Bid Analysis
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Bid Preparation</h1>
            <StatusBadge status={bid.status} />
          </div>
          <p className="text-gray-500 mt-1">{bid.project_name} &middot; {bid.client_name}</p>
        </div>
        <div className="flex gap-2">
          {!isFinalized && (
            <>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !dirty}
                className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-sm"
              >
                {saveMutation.isPending ? "Saving..." : dirty ? "Save Changes" : "Saved"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Finalize this bid? This marks the bid as complete and ready for submission.")) {
                    finalizeMutation.mutate();
                  }
                }}
                disabled={finalizeMutation.isPending}
                className="bg-emerald-600 text-white px-6 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
              >
                {finalizeMutation.isPending ? "Finalizing..." : "Finalize Bid"}
              </button>
            </>
          )}
          {isFinalized && (
            <span className="bg-emerald-100 text-emerald-800 px-4 py-2 rounded-lg text-sm font-medium">
              Bid Finalized
            </span>
          )}
        </div>
      </div>

      {/* Summary Cards */}
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
          <span className="text-sm text-gray-500">Trades</span>
          <p className="text-xl font-bold text-gray-900">{subRows.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <span className="text-sm text-gray-500">Materials</span>
          <p className="text-xl font-bold text-gray-900">{materialRows.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-0">
          {prepTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "Schedule" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">Construction Schedule</h3>
              <p className="text-sm text-gray-500">Edit activities, adjust timing, and set dependencies</p>
            </div>
            {!isFinalized && (
              <button
                onClick={() => {
                  setScheduleRows(prev => [...prev, {
                    activity: "", trade: "", start_week: 1, duration_weeks: 1,
                    dependencies: "", materials_needed: "",
                  }]);
                  setDirty(true);
                }}
                className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100"
              >
                + Add Row
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[200px]">Activity</th>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[120px]">Trade</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Start Wk</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Duration</th>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[180px]">Dependencies</th>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[180px]">Materials</th>
                  {!isFinalized && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {scheduleRows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <input
                        value={row.activity}
                        onChange={e => updateScheduleRow(i, "activity", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={row.trade}
                        onChange={e => updateScheduleRow(i, "trade", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.start_week}
                        onChange={e => updateScheduleRow(i, "start_week", parseInt(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.duration_weeks}
                        onChange={e => updateScheduleRow(i, "duration_weeks", parseInt(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={row.dependencies}
                        onChange={e => updateScheduleRow(i, "dependencies", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={row.materials_needed}
                        onChange={e => updateScheduleRow(i, "materials_needed", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    {!isFinalized && (
                      <td className="p-2">
                        <button
                          onClick={() => {
                            setScheduleRows(prev => prev.filter((_, idx) => idx !== i));
                            setDirty(true);
                          }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          X
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Subcontractors" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">Subcontractor Assignments</h3>
              <p className="text-sm text-gray-500">Review and adjust trade assignments and mobilization dates</p>
            </div>
            {!isFinalized && (
              <button
                onClick={() => {
                  setSubRows(prev => [...prev, {
                    trade: "", company_name: "", mobilize_week: 1, duration_weeks: 1, rate: "", confidence: 0,
                  }]);
                  setDirty(true);
                }}
                className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100"
              >
                + Add Row
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[140px]">Trade</th>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[180px]">Company</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Mobilize Wk</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Duration</th>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[120px]">Rate</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Confidence</th>
                  {!isFinalized && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {subRows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <input
                        value={row.trade}
                        onChange={e => updateSubRow(i, "trade", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={row.company_name}
                        onChange={e => updateSubRow(i, "company_name", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.mobilize_week}
                        onChange={e => updateSubRow(i, "mobilize_week", parseInt(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.duration_weeks}
                        onChange={e => updateSubRow(i, "duration_weeks", parseInt(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        value={row.rate}
                        onChange={e => updateSubRow(i, "rate", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <span className={`font-semibold text-sm ${
                        row.confidence >= 80 ? "text-green-600" : row.confidence >= 50 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {row.confidence}%
                      </span>
                    </td>
                    {!isFinalized && (
                      <td className="p-2">
                        <button
                          onClick={() => {
                            setSubRows(prev => prev.filter((_, idx) => idx !== i));
                            setDirty(true);
                          }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          X
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "Materials" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="font-semibold text-lg">Material Orders</h3>
              <p className="text-sm text-gray-500">Finalize material quantities, costs, and order timing</p>
            </div>
            {!isFinalized && (
              <button
                onClick={() => {
                  setMaterialRows(prev => [...prev, {
                    material: "", estimated_cost: 0, order_by_week: 1, needed_by_week: 1,
                    commodity_trend: "stable", recommendation: "",
                  }]);
                  setDirty(true);
                }}
                className="text-sm bg-purple-50 text-purple-700 px-3 py-1.5 rounded-lg hover:bg-purple-100"
              >
                + Add Row
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[180px]">Material</th>
                  <th className="text-right p-3 font-medium text-gray-700 w-28">Est. Cost</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Order By</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Needed By</th>
                  <th className="text-center p-3 font-medium text-gray-700 w-24">Trend</th>
                  <th className="text-left p-3 font-medium text-gray-700 min-w-[200px]">Recommendation</th>
                  {!isFinalized && <th className="w-12"></th>}
                </tr>
              </thead>
              <tbody>
                {materialRows.map((row, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <input
                        value={row.material}
                        onChange={e => updateMaterialRow(i, "material", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.estimated_cost}
                        onChange={e => updateMaterialRow(i, "estimated_cost", parseFloat(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-right disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.order_by_week}
                        onChange={e => updateMaterialRow(i, "order_by_week", parseInt(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        value={row.needed_by_week}
                        onChange={e => updateMaterialRow(i, "needed_by_week", parseInt(e.target.value) || 0)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm text-center disabled:bg-gray-50"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        row.commodity_trend === "rising" ? "bg-red-100 text-red-700" :
                        row.commodity_trend === "falling" ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {row.commodity_trend}
                      </span>
                    </td>
                    <td className="p-2">
                      <input
                        value={row.recommendation}
                        onChange={e => updateMaterialRow(i, "recommendation", e.target.value)}
                        disabled={isFinalized}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-sm disabled:bg-gray-50"
                      />
                    </td>
                    {!isFinalized && (
                      <td className="p-2">
                        <button
                          onClick={() => {
                            setMaterialRows(prev => prev.filter((_, idx) => idx !== i));
                            setDirty(true);
                          }}
                          className="text-red-400 hover:text-red-600 text-xs"
                        >
                          X
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
