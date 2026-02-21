DEFAULT_PROMPTS = [
    {
        "slug": "bid_extraction",
        "name": "Bid Extraction & Analysis",
        "description": "Extracts project scope, risk flags, and GC questions from uploaded bid documents",
        "category": "bid_extraction",
        "template_text": """You are a construction estimating expert. Analyze the following bid document text and extract the project scope organized by CSI MasterFormat divisions.

PROJECT TYPE: {project_type}

DOCUMENT TEXT:
{document_text}

TABLES FROM DOCUMENT:
{tables_text}

Return a JSON object with:
- "summary": A 2-3 sentence overall scope summary
- "divisions": An array of objects, each with:
  - "division_code": CSI division number (e.g., "03" for Concrete)
  - "division_name": Division name
  - "description": What work is included
  - "key_items": Array of specific scope items
- "risk_flags": An array of objects, each with:
  - "severity": "high", "medium", or "low"
  - "category": e.g., "Scope Gap", "Ambiguity", "Regulatory"
  - "description": Clear description of the risk
  - "recommendation": Suggested action
- "gc_questions": An array of objects, each with:
  - "question": The specific clarifying question
  - "context": Why this question matters
  - "priority": "high", "medium", or "low"
- "confidence_level": "low", "medium", or "high" — your confidence in the completeness and accuracy of the extraction. "high" if the document is detailed with clear specs; "medium" if some sections are vague or missing; "low" if the document is sparse or ambiguous
- "schedule": An array of objects representing the construction schedule, each with:
  - "activity": Name of the construction activity or task
  - "trade": The trade or discipline responsible (e.g., "Concrete", "Electrical", "Plumbing")
  - "start_week": Estimated start week number (integer)
  - "duration_weeks": Estimated duration in weeks (integer)
  - "dependencies": Array of activity names this task depends on (empty array if none)
  - "materials_needed": Array of key materials required for this activity

Infer the construction schedule from the scope, project type, and any timeline references in the document. Use standard construction sequencing for {project_type} projects. Include all major activities from site work through closeout.

Return ONLY valid JSON. No markdown formatting.""",
        "variables": ["document_text", "tables_text", "project_type"],
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 8192,
        "version": 1,
        "is_default": True,
    },
    {
        "slug": "material_procurement",
        "name": "Material Procurement & Scheduling",
        "description": "Determines materials to buy, ordering schedule based on commodity forecasts, and cost estimates",
        "category": "material_procurement",
        "template_text": """You are a senior commercial construction estimator and procurement specialist. Generate a cost estimate and material procurement schedule for the following scope of work. Use the commodity price data and trends to recommend optimal ordering timing.

SCOPE SUMMARY:
{scope_summary}

CURRENT COMMODITY PRICES:
{commodity_prices}

COMMODITY PRICE TRENDS (3-month):
{commodity_trends}

PROJECT LOCATION: {location}

Return a JSON object with:
- "line_items": Array of objects with: division, description, quantity, unit, unit_cost, total, commodity_adjusted (boolean), commodity_ref (string or null)
- "total_estimated_cost": Sum of all line items
- "confidence_level": "low", "medium", or "high"
- "assumptions": Array of key assumptions made
- "timeline": object with:
  - "total_duration_weeks": Estimated project duration
  - "phases": Array of {{ "phase_name", "start_week", "duration_weeks", "materials_needed": [] }}
- "material_orders": Array of objects with:
  - "material": Material name
  - "estimated_cost": Dollar amount
  - "order_by_week": When to place the order
  - "needed_by_week": When material is needed on site
  - "commodity_trend": "rising", "falling", or "stable"
  - "recommendation": Specific buying recommendation (e.g., "Order early - prices trending up 5% over 3 months")

For material ordering, apply these rules:
- If commodity prices are RISING: recommend ordering earlier to lock in current prices
- If commodity prices are FALLING: recommend deferring purchase if schedule allows
- If STABLE: order per standard lead times

Use realistic commercial construction unit costs for the given location.
Return ONLY valid JSON.""",
        "variables": ["scope_summary", "commodity_prices", "commodity_trends", "location"],
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 8192,
        "version": 1,
        "is_default": True,
    },
    {
        "slug": "sub_scheduling",
        "name": "Subcontractor Scheduling",
        "description": "Determines trades needed, mobilization dates, and matches against subcontractor database",
        "category": "sub_scheduling",
        "template_text": """You are a construction project scheduler. Based on the project scope and estimate, determine which subcontractor trades are needed, when they should be mobilized, and match them against the available subcontractor database.

SCOPE SUMMARY:
{scope_summary}

ESTIMATE SUMMARY:
{estimate_summary}

AVAILABLE SUBCONTRACTORS (from database):
{subcontractor_data}

PROJECT TIMELINE:
{project_timeline}

IMPORTANT: Each subcontractor in the database has the following fields you MUST consider:
- "available_from" / "available_to": Overall date range when the sub is available
- "booked_weeks": Array of existing commitments, each with {{"project": str, "start_week": int, "end_week": int}}. Weeks NOT listed are AVAILABLE. Check for scheduling conflicts by comparing the project's mobilize_week + duration against each sub's booked_weeks ranges.
- "hourly_rate" and "project_rate": Cost comparison
- "rating": Quality score (1-5)

Return a JSON object with:
- "required_trades": Array of objects with:
  - "trade": Trade name (e.g., "Electrical", "Demolition", "Framing")
  - "scope_description": What work this trade covers
  - "estimated_duration_weeks": How long they'll be on site
  - "mobilize_week": When they should start (week number)
  - "priority": "critical_path" or "flexible"
- "matches": Array of ALL matching subcontractors per trade (return every sub that matches the trade, not just the best one). Each match object:
  - "trade": Trade name
  - "company_name": From the subcontractor database
  - "confidence": 0-100 match score (factor in scheduling availability, location, cost, and rating)
  - "location": Sub's location
  - "hourly_rate": Their rate
  - "project_rate": Their project rate if available
  - "available_from": Their availability start
  - "available_to": Their availability end
  - "booked_weeks": Their existing commitments array (copy from database)
  - "scheduling_conflict": true/false — whether this sub has a booking that overlaps with the project's needed weeks
  - "available_weeks_during_project": Description of which weeks they're free during the project window
  - "rating": Their quality rating
  - "mobilize_week": Recommended mobilization week
  - "reasoning": Why this sub was ranked at this confidence level — specifically mention their scheduling availability (booked vs. free weeks), cost competitiveness, and quality rating
  - "contact_name": Contact info
  - "email": Email
  - "phone": Phone
- "schedule_notes": Array of scheduling recommendations or conflicts

Match and rank subcontractors based on these criteria (in order of importance):
1. Trade match (required)
2. Scheduling availability — sub must be FREE (not booked) during the mobilize_week through mobilize_week + duration. Check their booked_weeks array: if any booking's [start_week, end_week] overlaps with the project's needed weeks, flag it as a conflict and lower confidence
3. Quality rating (higher is better)
4. Location proximity to the project
5. Rate competitiveness (lower cost is better for same quality)

Return ONLY valid JSON.""",
        "variables": ["scope_summary", "estimate_summary", "subcontractor_data", "project_timeline"],
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 16384,
        "version": 1,
        "is_default": True,
    },
    {
        "slug": "market_summary",
        "name": "Market Intelligence Summary",
        "description": "Generates a market intelligence briefing from commodity, rate, and news data",
        "category": "market_summary",
        "template_text": """You are a construction market analyst. Summarize the current market conditions for a commercial general contractor based on the following data.

COMMODITY PRICES:
{commodity_data}

INTEREST RATES:
{rate_data}

RECENT INDUSTRY NEWS:
{news_headlines}

Write a 3-4 paragraph market intelligence briefing covering:
1. Material cost trends and their impact on bidding
2. Interest rate environment and financing implications
3. Industry news and developments affecting the construction market
4. Actionable recommendations for GCs preparing bids

Write in a professional, concise tone. No JSON required for this prompt.""",
        "variables": ["commodity_data", "rate_data", "news_headlines"],
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 1500,
        "version": 1,
        "is_default": True,
    },
    {
        "slug": "judge_validation",
        "name": "AI Judge Validation",
        "description": "Cross-validates the full AI analysis using a separate LLM (Llama 4 Maverick) to detect hallucinations, pricing errors, and contradictions",
        "category": "judge_validation",
        "template_text": """You are an independent quality assurance reviewer for construction bid analysis. A different AI system has analyzed a bid document and produced three outputs. Your job is to validate the analysis by checking for errors, hallucinations, and contradictions.

ORIGINAL BID DOCUMENT (excerpt):
{raw_text}

=== AI ANALYSIS OUTPUT TO VALIDATE ===

STEP 1 — BID EXTRACTION (scope, divisions, risks, schedule):
{bid_extraction}

STEP 2 — MATERIAL PROCUREMENT (cost estimate, material orders, timeline):
{material_procurement}

STEP 3 — SUBCONTRACTOR SCHEDULING (required trades, matches, conflicts):
{sub_scheduling}

=== YOUR VALIDATION TASK ===

Check for the following issues:

1. HALLUCINATED SCOPE: Are there divisions, materials, or trades in the analysis that are NOT supported by the original bid document text? Flag any items the AI may have invented.

2. PRICING PLAUSIBILITY: Are unit costs and totals within reasonable ranges for commercial construction? Flag any obviously wrong numbers (e.g., $1/sqft for concrete, $1M for paint).

3. SCHEDULE CONSISTENCY: Do task dependencies make sense? Are durations realistic for the scope described? Does the mobilization sequence follow standard construction logic?

4. CROSS-STEP CONTRADICTIONS: Does the material procurement timeline align with the construction schedule? Do the trades in sub_scheduling match the trades in the schedule? Are there conflicts between steps?

5. SUBCONTRACTOR MATCH QUALITY: Are confidence scores reasonable given the data? Are scheduling conflicts correctly identified?

Return a JSON object with:
- "overall_score": Integer 0-100 representing overall analysis quality
- "passed": true if overall_score >= 70, false otherwise
- "issues": Array of objects, each with:
  - "severity": "error", "warning", or "info"
  - "step": "bid_extraction", "material_procurement", or "sub_scheduling"
  - "finding": Clear description of the issue found
  - "recommendation": Specific suggestion to fix it
- "summary": 1-2 sentence overall assessment of the analysis quality

Scoring guide:
- 90-100: Analysis is thorough and well-grounded in the source document
- 70-89: Generally accurate with minor issues
- 50-69: Several concerns that should be reviewed by a human
- Below 50: Significant errors or hallucinations detected

Return ONLY valid JSON. No markdown formatting.""",
        "variables": ["raw_text", "bid_extraction", "material_procurement", "sub_scheduling"],
        "model": "llama-4-maverick",
        "max_tokens": 4096,
        "version": 1,
        "is_default": True,
    },
]
