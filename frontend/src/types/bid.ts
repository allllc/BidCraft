export interface BidSummary {
  bid_id: string;
  project_name: string;
  client_name: string;
  status: "uploaded" | "analyzing" | "complete" | "preparation" | "finalized" | "error";
  created_at: string;
  location?: string;
  project_type?: string;
  bid_due_date?: string;
}

export interface ScheduleActivity {
  activity: string;
  trade: string;
  start_week: number;
  duration_weeks: number;
  dependencies: string[];
  materials_needed: string[];
}

export interface Division {
  division_code: string;
  division_name: string;
  description: string;
  key_items: string[];
}

export interface RiskFlag {
  severity: "high" | "medium" | "low";
  category: string;
  description: string;
  recommendation: string;
}

export interface GCQuestion {
  question: string;
  context: string;
  priority: "high" | "medium" | "low";
}

export interface LineItem {
  division: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total: number;
  commodity_adjusted: boolean;
  commodity_ref: string | null;
}

export interface MaterialOrder {
  material: string;
  estimated_cost: number;
  order_by_week: number;
  needed_by_week: number;
  commodity_trend: "rising" | "falling" | "stable";
  recommendation: string;
}

export interface Phase {
  phase_name: string;
  start_week: number;
  duration_weeks: number;
  materials_needed: string[];
}

export interface SubMatch {
  trade: string;
  company_name: string;
  confidence: number;
  location: string;
  hourly_rate: number | null;
  project_rate: number | null;
  available_from: string;
  available_to: string;
  mobilize_week: number;
  reasoning: string;
  contact_name: string;
  email: string;
  phone: string;
}

export interface RequiredTrade {
  trade: string;
  scope_description: string;
  estimated_duration_weeks: number;
  mobilize_week: number;
  priority: "critical_path" | "flexible";
}

export interface BidAnalysis {
  bid_extraction: {
    summary: string;
    divisions: Division[];
    risk_flags: RiskFlag[];
    gc_questions: GCQuestion[];
    schedule?: ScheduleActivity[];
  };
  material_procurement: {
    line_items: LineItem[];
    total_estimated_cost: number;
    confidence_level: "low" | "medium" | "high";
    assumptions: string[];
    timeline: {
      total_duration_weeks: number;
      phases: Phase[];
    };
    material_orders: MaterialOrder[];
  };
  sub_scheduling: {
    required_trades: RequiredTrade[];
    matches: SubMatch[];
    schedule_notes: string[];
  };
  commodity_snapshot: Array<{
    name: string;
    ticker: string;
    current_price: number;
    change_30d: number | null;
  }>;
  generated_at: string;
}

export interface BidDetail extends BidSummary {
  raw_text: string;
  raw_tables: string[][];
  original_filename: string;
  analysis: BidAnalysis | null;
}
