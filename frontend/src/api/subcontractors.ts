import api from "./client";
import type { Subcontractor, PromptTemplate } from "../types/subcontractor";

export async function listSubcontractors(trade?: string, location?: string): Promise<Subcontractor[]> {
  const params = new URLSearchParams();
  if (trade) params.append("trade", trade);
  if (location) params.append("location", location);
  const { data } = await api.get(`/api/subcontractors?${params}`);
  return data;
}

export async function createSubcontractor(sub: Omit<Subcontractor, "id">): Promise<Subcontractor> {
  const { data } = await api.post("/api/subcontractors", sub);
  return data;
}

export async function updateSubcontractor(id: string, sub: Omit<Subcontractor, "id">): Promise<Subcontractor> {
  const { data } = await api.put(`/api/subcontractors/${id}`, sub);
  return data;
}

export async function deleteSubcontractor(id: string): Promise<void> {
  await api.delete(`/api/subcontractors/${id}`);
}

export async function uploadSubcontractorsCsv(file: File): Promise<{ imported: number; errors: string[] }> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/api/subcontractors/upload-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function downloadCsvTemplate(): Promise<void> {
  const response = await api.get("/api/subcontractors/csv-template", { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", "subcontractor_template.csv");
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export async function listPrompts(): Promise<PromptTemplate[]> {
  const { data } = await api.get("/api/prompts");
  return data;
}

export async function updatePrompt(id: string, update: { template_text?: string; model?: string; max_tokens?: number }): Promise<void> {
  await api.put(`/api/prompts/${id}`, update);
}

export async function resetPrompts(): Promise<void> {
  await api.post("/api/prompts/reset");
}
