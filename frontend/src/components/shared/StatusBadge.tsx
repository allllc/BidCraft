const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  uploaded: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Uploaded" },
  analyzing: { bg: "bg-blue-100", text: "text-blue-800", label: "Analyzing" },
  complete: { bg: "bg-green-100", text: "text-green-800", label: "Complete" },
  preparation: { bg: "bg-purple-100", text: "text-purple-800", label: "Preparation" },
  finalized: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Finalized" },
  error: { bg: "bg-red-100", text: "text-red-800", label: "Error" },
};

export default function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.uploaded;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}
