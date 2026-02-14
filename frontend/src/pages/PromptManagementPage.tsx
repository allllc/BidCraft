import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPrompts, updatePrompt, resetPrompts } from "../api/subcontractors";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import type { PromptTemplate } from "../types/subcontractor";

/* ------------------------------------------------------------------ */
/*  Category color mapping                                            */
/* ------------------------------------------------------------------ */
const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  scope:    { bg: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200" },
  estimate: { bg: "bg-green-50",   text: "text-green-700",   border: "border-green-200" },
  risk:     { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  market:   { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
};

function categoryColor(category: string) {
  const key = category.toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (key.includes(k)) return v;
  }
  return { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
function shortCategory(raw: string): string {
  // e.g. "bid_extraction" -> "scope", "material_procurement" -> "estimate", etc.
  const lower = raw.toLowerCase();
  if (lower.includes("scope") || lower.includes("extract")) return "scope";
  if (lower.includes("estimate") || lower.includes("material") || lower.includes("procurement")) return "estimate";
  if (lower.includes("risk") || lower.includes("schedule") || lower.includes("sub")) return "risk";
  if (lower.includes("market") || lower.includes("summary")) return "market";
  return raw;
}

function truncateTemplate(text: string, maxLines = 6): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + "\n...";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${String(d.getDate()).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

/* ------------------------------------------------------------------ */
/*  SVG Icons (inline to avoid external deps)                         */
/* ------------------------------------------------------------------ */
function GearIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function DocumentIcon({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}

function PencilIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  );
}

/* ================================================================== */
/*  Main Page Component                                               */
/* ================================================================== */
export default function PromptManagementPage() {
  const queryClient = useQueryClient();
  const { data: prompts, isLoading, error } = useQuery({
    queryKey: ["prompts"],
    queryFn: listPrompts,
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  /* ---- Mutations ---- */
  const updateMutation = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) =>
      updatePrompt(id, { template_text: text }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts"] });
      setEditingId(null);
    },
  });

  const resetMutation = useMutation({
    mutationFn: resetPrompts,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prompts"] }),
  });

  /* ---- Derived stats ---- */
  const stats = useMemo(() => {
    if (!prompts || prompts.length === 0) {
      return { total: 0, categories: [] as string[], lastUpdated: "N/A", model: "N/A" };
    }

    const cats = [...new Set(prompts.map((p) => shortCategory(p.category)))];

    // Try to find the most recent date from any date-like field; fall back to "today"
    const lastUpdated = (() => {
      const withDates = prompts
        .map((p) => (p as any).updated_at || (p as any).created_at)
        .filter(Boolean);
      if (withDates.length > 0) {
        const sorted = withDates.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime());
        return formatDate(sorted[0]);
      }
      return formatDate(new Date().toISOString());
    })();

    return {
      total: prompts.length,
      categories: cats,
      lastUpdated,
      model: prompts[0]?.model || "N/A",
    };
  }, [prompts]);

  /* ---- Loading / Error ---- */
  if (isLoading) return <LoadingSpinner message="Loading prompt templates..." />;
  if (error) {
    return (
      <div className="text-red-600 p-4">
        Error loading prompts: {String(error)}
      </div>
    );
  }

  const sortedPrompts = (prompts || []).slice().sort((a, b) => a.category.localeCompare(b.category));

  /* ---- Handlers ---- */
  function handleStartEdit(prompt: PromptTemplate) {
    setEditingId(prompt.id);
    setEditText(prompt.template_text);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  function handleSave(id: string) {
    updateMutation.mutate({ id, text: editText });
  }

  function handleResetSingle(prompt: PromptTemplate) {
    if (window.confirm(`Reset "${prompt.name}" to its default template? This cannot be undone.`)) {
      resetMutation.mutate();
    }
  }

  /* ================================================================ */
  /*  Render                                                          */
  /* ================================================================ */
  return (
    <div>
      {/* ------- Page Header ------- */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Prompt Management</h1>
        <p className="text-gray-500 mt-1">
          View, edit, and manage all LLM prompt templates used across BidCraft
        </p>
      </div>

      {/* ------- Info Banner ------- */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 mb-8 flex items-start gap-4">
        <div className="flex-shrink-0 mt-0.5 bg-indigo-100 rounded-lg p-2">
          <GearIcon className="w-6 h-6 text-indigo-700" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-indigo-900">
            In-App Prompt Engineering
          </h2>
          <p className="text-indigo-700 mt-1 text-sm leading-relaxed">
            BidCraft stores all LLM prompts as editable templates within the application.
            This design decision allows your team to continuously improve AI analysis quality
            without code changes or redeployment. Test different prompt strategies, incorporate
            domain expertise, and iterate based on real bid results.
          </p>
        </div>
      </div>

      {/* ------- Stat Cards ------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Prompts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Prompts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>

        {/* Categories */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Categories</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.categories.length}</p>
          <p className="text-xs text-gray-400 mt-1 capitalize">
            {stats.categories.join(", ")}
          </p>
        </div>

        {/* Last Updated */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Last Updated</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.lastUpdated}</p>
        </div>

        {/* AI Model */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500">AI Model</p>
          <p className="text-lg font-bold text-gray-900 mt-1 truncate" title={stats.model}>
            {stats.model}
          </p>
          <p className="text-xs text-gray-400 mt-1">Anthropic</p>
        </div>
      </div>

      {/* ------- Prompt Cards ------- */}
      <div className="space-y-5">
        {sortedPrompts.map((prompt) => {
          const isEditing = editingId === prompt.id;
          const catKey = shortCategory(prompt.category);
          const colors = categoryColor(catKey);

          return (
            <div
              key={prompt.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              {/* ---- Card Body ---- */}
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  {/* Left: icon + text */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className={`flex-shrink-0 rounded-full p-2.5 ${colors.bg}`}>
                      <DocumentIcon className={`w-5 h-5 ${colors.text}`} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{prompt.name}</h3>
                        <span
                          className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                        >
                          {catKey}
                        </span>
                        {!prompt.is_default && (
                          <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                            Modified v{prompt.version}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{prompt.description}</p>
                    </div>
                  </div>

                  {/* Right: Edit button */}
                  {!isEditing && (
                    <button
                      onClick={() => handleStartEdit(prompt)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 border border-indigo-300 rounded-lg px-4 py-2 hover:bg-indigo-50 transition-colors"
                    >
                      <PencilIcon className="w-4 h-4" />
                      Edit Prompt
                    </button>
                  )}
                </div>

                {/* ---- Collapsed: Template Preview ---- */}
                {!isEditing && (
                  <div className="mt-4">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">
                      Template Preview
                    </p>
                    <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-xs text-gray-700 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {truncateTemplate(prompt.template_text)}
                    </pre>
                  </div>
                )}

                {/* ---- Expanded: Edit Mode ---- */}
                {isEditing && (
                  <div className="mt-4 space-y-4">
                    {/* Full textarea */}
                    <div>
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Template Text
                      </label>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        rows={14}
                        className="w-full border border-gray-300 rounded-lg p-4 text-sm font-mono text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y"
                      />
                    </div>

                    {/* Available variables */}
                    {prompt.variables.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                          Available Variables
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {prompt.variables.map((v) => (
                            <code
                              key={v}
                              className="inline-flex items-center text-xs bg-gray-100 text-gray-700 border border-gray-200 px-2.5 py-1 rounded-md font-mono"
                            >
                              {`{${v}}`}
                            </code>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center gap-3 pt-2">
                      <button
                        onClick={() => handleSave(prompt.id)}
                        disabled={updateMutation.isPending}
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleResetSingle(prompt)}
                        disabled={resetMutation.isPending}
                        className="ml-auto text-sm text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ---- Card Footer ---- */}
              <div className="border-t border-gray-100 bg-gray-50 px-6 py-3 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Last modified:{" "}
                  {formatDate(
                    (prompt as any).updated_at ||
                    (prompt as any).created_at ||
                    undefined
                  )}
                </span>
                <span className="font-mono">ID: {prompt.slug}</span>
              </div>
            </div>
          );
        })}

        {/* Empty state */}
        {sortedPrompts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-gray-500 text-lg">No prompt templates found</p>
            <p className="text-gray-400 mt-2">
              Prompt templates will appear here once the backend is configured.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
