# BidCraft

AI-powered bid management platform for commercial general contractors. BidCraft automates the analysis of construction bid documents, generates cost estimates using live commodity data, matches subcontractors based on trade, availability, and scheduling conflicts, and provides real-time market intelligence — all powered by Claude AI.

## Team

- **Leonard Lwakabamba**
- **Alpha Bah**
- **Julissa Estrada**
- **Andrew Scranton**
- **Chandler White**

## Features

### Bid Analysis Pipeline
Upload `.docx` bid documents and run a 3-step AI analysis pipeline:
1. **Bid Extraction** — Extracts project scope by CSI MasterFormat division, identifies risk flags, generates GC clarification questions, and infers the construction schedule
2. **Material Procurement** — Generates line-item cost estimates adjusted for live commodity prices, recommends optimal material ordering timing based on price trends
3. **Subcontractor Scheduling** — Matches required trades against a subcontractor database, evaluates scheduling conflicts using a 52-week booking model, and ranks matches by availability, quality rating, location, and cost

### Bid Preparation & Finalization
- Editable tables for schedule, subcontractor assignments, and material orders
- Save drafts and finalize bids for submission
- Export to PDF and CSV

### Subcontractor Management
- Searchable subcontractor database with trade, location, rating, and rate information
- 52-week availability timeline visualization showing booked vs. available weeks
- Bulk CSV import/export with scheduling data
- Scheduling conflict detection during bid analysis

### Market Intelligence
- Live commodity prices (Steel, Copper, Diesel, Lumber, Gypsum) via Yahoo Finance
- Interest rate data from the Federal Reserve (FRED API)
- Construction industry news aggregation via RSS
- AI-generated market briefings summarizing trends and recommendations

### Prompt Management
- View and customize the AI prompt templates powering each analysis step
- Adjust model, token limits, and prompt text
- Version tracking with reset-to-defaults

## Tech Stack

### Backend
- **Python 3.11** / **FastAPI** / **Uvicorn**
- **Anthropic Claude API** (claude-sonnet) — AI analysis engine
- **Google Cloud Firestore** — NoSQL database
- **yfinance** — Commodity price data
- **FRED API** — Interest rate data
- **python-docx** — Document parsing
- **feedparser** — News RSS feeds

### Frontend
- **React 19** / **TypeScript** / **Vite**
- **Tailwind CSS** — Styling
- **TanStack React Query** — Server state management
- **Recharts** — Data visualization
- **React Router** — Client-side routing
- **jsPDF** — PDF export
- **react-dropzone** — File uploads

### Infrastructure
- **Docker Compose** — Container orchestration
- **Nginx** — Frontend static file serving (production)

## Project Structure

```
bidcraft/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, route registration
│   │   ├── config.py               # Environment settings (Pydantic)
│   │   ├── db/
│   │   │   ├── firestore_client.py # Firestore connection
│   │   │   └── seed.py             # Seed subcontractors & prompts
│   │   ├── models/                 # Pydantic models
│   │   ├── prompts/
│   │   │   └── defaults.py         # Default AI prompt templates
│   │   ├── routers/
│   │   │   ├── bids.py             # Bid CRUD & analysis
│   │   │   ├── market.py           # Commodity, rates, news
│   │   │   ├── subcontractors.py   # Sub database & CSV
│   │   │   ├── prompts.py          # Prompt template management
│   │   │   └── export.py           # CSV/PDF export
│   │   └── services/
│   │       ├── bid_analyzer.py     # 3-step analysis orchestrator
│   │       ├── claude_service.py   # Anthropic API wrapper
│   │       ├── commodity_service.py
│   │       ├── subcontractor_service.py
│   │       └── document_parser.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── DashboardPage.tsx
    │   │   ├── BidUploadPage.tsx
    │   │   ├── BidDetailPage.tsx
    │   │   ├── BidPreparationPage.tsx
    │   │   ├── SubcontractorsPage.tsx
    │   │   ├── MarketIntelPage.tsx
    │   │   └── PromptManagementPage.tsx
    │   ├── api/                    # Axios API clients
    │   ├── components/             # Shared UI components
    │   └── types/                  # TypeScript interfaces
    ├── package.json
    ├── vite.config.ts
    └── Dockerfile
```

## Getting Started

### Prerequisites
- Python 3.11+
- Node.js 20+
- Google Cloud project with Firestore enabled
- Anthropic API key
- FRED API key (for interest rate data)

### Environment Setup

Create `backend/.env` from the example:

```bash
cp backend/.env.example backend/.env
```

Required variables:

```env
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
FRED_API_KEY=your_fred_api_key
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Place your Firebase service account JSON file at `backend/service-account.json`.

### Run with Docker

```bash
docker-compose up
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8000

### Run Locally (Development)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173 (proxies `/api` to backend)
- Backend: http://localhost:8000
- API docs: http://localhost:8000/docs

### Seed Data

Seed the database with default prompt templates and sample Arizona-based subcontractors:

```bash
cd backend
python -m app.db.seed
```

## API Overview

| Endpoint | Description |
|---|---|
| `POST /api/bids/upload` | Upload a `.docx` bid document |
| `POST /api/bids/{id}/analyze` | Run 3-step AI analysis |
| `GET /api/bids/{id}` | Get bid with analysis results |
| `PUT /api/bids/{id}/preparation` | Save preparation edits |
| `POST /api/bids/{id}/finalize` | Finalize bid |
| `GET /api/subcontractors` | List all subcontractors |
| `POST /api/subcontractors/upload-csv` | Bulk import from CSV |
| `GET /api/market/commodities` | Live commodity prices |
| `GET /api/market/rates` | Interest rate data |
| `GET /api/market/summary` | AI market briefing |
| `GET /api/prompts` | List prompt templates |
| `POST /api/prompts/reset` | Reset prompts to defaults |
| `GET /api/health` | Health check |

Full interactive API documentation available at `/docs` when the backend is running.
