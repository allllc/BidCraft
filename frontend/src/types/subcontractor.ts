export interface Subcontractor {
  id: string;
  company_name: string;
  trade: string;
  trades: string[];
  city: string;
  state: string;
  service_radius_miles: number;
  contact_name: string;
  email: string;
  phone: string;
  hourly_rate: number | null;
  project_rate: number | null;
  available_from: string;
  available_to: string;
  booked_weeks?: Array<{ project: string; start_week: number; end_week: number }>;
  project_types: string[];
  rating: number;
}

export interface PromptTemplate {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  template_text: string;
  variables: string[];
  model: string;
  max_tokens: number;
  version: number;
  is_default: boolean;
}
