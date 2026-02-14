export interface CommodityPrice {
  name: string;
  ticker: string;
  current_price: number;
  currency: string;
  unit?: string;
  change_30d: number | null;
}

export interface HistoricalPrice {
  date: string;
  [commodity: string]: string | number;
}

export interface InterestRate {
  value: number | null;
  label: string;
  series_id?: string;
  as_of?: string;
  error?: string;
}

export interface NewsItem {
  title: string;
  link: string;
  published: string;
  source: string;
  summary: string;
}

export interface MarketSummary {
  summary_text: string;
  commodities_used: number;
  news_count: number;
}
