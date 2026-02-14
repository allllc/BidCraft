import api from "./client";
import type { CommodityPrice, NewsItem, MarketSummary } from "../types/market";

export async function getCommodities(): Promise<{
  current: CommodityPrice[];
  historical: {
    monthly: Array<{ month: string; type: string; [commodity: string]: string | number }>;
    commodities: string[];
  };
}> {
  const { data } = await api.get("/api/market/commodities");
  return data;
}

export async function getRates(): Promise<Record<string, any>> {
  const { data } = await api.get("/api/market/rates");
  return data;
}

export async function getNews(): Promise<NewsItem[]> {
  const { data } = await api.get("/api/market/news");
  return data;
}

export async function getMarketSummary(): Promise<MarketSummary> {
  const { data } = await api.get("/api/market/summary");
  return data;
}

export async function refreshCommodities(): Promise<{ status: string; commodities: number; as_of: string }> {
  const { data } = await api.post("/api/market/commodities/refresh");
  return data;
}
