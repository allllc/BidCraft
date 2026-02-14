import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { uploadBid } from "../api/bids";

interface ProjectMetadata {
  project_name: string;
  location: string;
  owner_developer: string;
  bid_due_date: string;
  additional_notes: string;
}

const steps = [
  {
    number: 1,
    title: "Upload Document",
    subtitle: "PDF, DOCX, or TXT",
  },
  {
    number: 2,
    title: "AI Analysis",
    subtitle: "Scope & cost extraction",
  },
  {
    number: 3,
    title: "Ready to Submit",
    subtitle: "Export bid package",
  },
];

export default function BidUploadPage() {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<ProjectMetadata>({
    project_name: "",
    location: "",
    owner_developer: "",
    bid_due_date: "",
    additional_notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        [".docx"],
      "text/plain": [".txt"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setMetadata((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError("Please upload a bid document.");
      return;
    }
    if (!metadata.project_name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (!metadata.location.trim()) {
      setError("Location is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await uploadBid(file, {
        project_name: metadata.project_name.trim(),
        client_name: metadata.owner_developer.trim() || metadata.project_name.trim(),
        location: metadata.location.trim(),
        project_type: "Commercial",
        bid_due_date: metadata.bid_due_date || new Date().toISOString().split("T")[0],
      });
      navigate(`/bid/${result.bid_id}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Upload failed. Please try again.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload New Bid</h1>
          <p className="mt-1 text-gray-500">
            Upload bid documents and let AI extract scope, generate estimates,
            and identify risks.
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {steps.map((step) => {
            const isActive = step.number === 1;
            return (
              <div
                key={step.number}
                className={`rounded-xl border p-4 flex items-center gap-4 ${
                  isActive
                    ? "bg-white border-indigo-200 shadow-sm"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-400"
                  }`}
                >
                  {step.number}
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${
                      isActive ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {step.title}
                  </p>
                  <p
                    className={`text-xs ${
                      isActive ? "text-gray-500" : "text-gray-300"
                    }`}
                  >
                    {step.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Error Banner */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Document Upload Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Document Upload
            </h2>
            <p className="mt-1 text-sm text-gray-500 mb-5">
              Upload your bid solicitation document (RFP, IFB, or bid package)
            </p>

            {!file ? (
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? "border-indigo-400 bg-indigo-50"
                    : "border-gray-300 hover:border-indigo-300 hover:bg-gray-50"
                }`}
              >
                <input {...getInputProps()} />
                <svg
                  className="mx-auto w-12 h-12 text-gray-300 mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <p className="text-sm font-medium text-gray-700">
                  {isDragActive
                    ? "Drop the file here..."
                    : "Click to upload bid document"}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  PDF, DOCX, or TXT up to 50MB
                </p>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
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
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removeFile}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label="Remove file"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Project Information Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Project Information
            </h2>
            <p className="mt-1 text-sm text-gray-500 mb-5">
              Provide basic details about the project
            </p>

            {/* Row 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label
                  htmlFor="project_name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Project Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="project_name"
                  name="project_name"
                  value={metadata.project_name}
                  onChange={handleInputChange}
                  placeholder="e.g., Downtown Office Tower Renovation"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="location"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Location <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  value={metadata.location}
                  onChange={handleInputChange}
                  placeholder="e.g., Philadelphia, PA"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="owner_developer"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Owner/Developer
                </label>
                <input
                  type="text"
                  id="owner_developer"
                  name="owner_developer"
                  value={metadata.owner_developer}
                  onChange={handleInputChange}
                  placeholder="e.g., ABC Development Corp"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="bid_due_date"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Bid Due Date
                </label>
                <input
                  type="date"
                  id="bid_due_date"
                  name="bid_due_date"
                  value={metadata.bid_due_date}
                  onChange={handleInputChange}
                  placeholder="mm/dd/yyyy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Additional Notes Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Additional Notes
            </h2>
            <textarea
              name="additional_notes"
              value={metadata.additional_notes}
              onChange={handleInputChange}
              rows={4}
              placeholder="Any special considerations, known risks, or additional context..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                Upload &amp; Analyze Bid
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
