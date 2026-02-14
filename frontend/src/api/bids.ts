import api from "./client";
import type { BidSummary, BidDetail } from "../types/bid";

export async function uploadBid(file: File, metadata: {
  project_name: string;
  client_name: string;
  location: string;
  project_type: string;
  bid_due_date: string;
}): Promise<{ bid_id: string }> {
  const formData = new FormData();
  formData.append("file", file);
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, value);
  });
  const { data } = await api.post("/api/bids/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function listBids(): Promise<BidSummary[]> {
  const { data } = await api.get("/api/bids");
  return data;
}

export async function getBid(bidId: string): Promise<BidDetail> {
  const { data } = await api.get(`/api/bids/${bidId}`);
  return data;
}

export async function analyzeBid(bidId: string): Promise<{ bid_id: string; status: string; analysis: any }> {
  const { data } = await api.post(`/api/bids/${bidId}/analyze`);
  return data;
}

export async function deleteBid(bidId: string): Promise<void> {
  await api.delete(`/api/bids/${bidId}`);
}

export async function prepareBid(bidId: string): Promise<{ bid_id: string; status: string }> {
  const { data } = await api.post(`/api/bids/${bidId}/prepare`);
  return data;
}

export async function updateBidPreparation(bidId: string, updates: Record<string, unknown>): Promise<{ bid_id: string; status: string }> {
  const { data } = await api.put(`/api/bids/${bidId}/preparation`, updates);
  return data;
}

export async function finalizeBid(bidId: string): Promise<{ bid_id: string; status: string }> {
  const { data } = await api.post(`/api/bids/${bidId}/finalize`);
  return data;
}
