# Comms

Unified communications hub — email, calls, SMS, contacts, calendar, and AI voice agents.

## Stack

- **Frontend**: Next.js 16, Tailwind v4, Motion
- **AI**: Vercel AI SDK v6, Google Gemini 2.5 Flash
- **Voice**: LiveKit Agents, Cartesia TTS, Deepgram STT
- **SMS/Voice**: Twilio (send/receive texts, voice calls)
- **Email**: Gmail API (OAuth), AI categorization + autopilot
- **Auth**: BetterAuth + Convex (cloud mode)
- **Deploy**: Fly.io (comms.soshi.dev)

## Features

### Email
- Gmail sync with AI processing (categorization, priority scoring, summaries)
- 5 category tabs: Primary, Transactions, Updates, Promotions, Newsletters
- List-Unsubscribe header detection + one-click unsubscribe
- Email autopilot: auto-archive promotions/newsletters, auto-mark-read updates
- AI draft replies with approval queue

### SMS
- Send/receive texts via Twilio
- Conversation-threaded UI (iMessage-style)
- Phone number auto-formatting (E.164)
- Inbound SMS webhook with activity logging

### Voice
- AI voice agents via LiveKit + Cartesia
- Inbound/outbound call handling
- Call transcripts and recording

### Contacts
- Full CRUD with search and tags
- Action buttons: call, text, email from contact card
- Notes and company tracking

### AI Tools (36 MCP tools)

| Category | Tools | Description |
|----------|-------|-------------|
| Contacts | 5 | List, get, create, update, search |
| Email | 5 | List, read, draft, send, reply |
| Gmail | 9 | Search, sync, send, draft, trash, archive, mark read, reply, threads |
| AI Email | 3 | Process, prioritize, summarize |
| SMS | 2 | Send, list conversations |
| Calls | 3 | List, transcripts, initiate |
| Calendar | 3 | List events, create, check availability |
| Approvals | 3 | List, approve, deny |
| Spaces | 3 | List, get, create presets |

## Setup

```bash
npm install
cp .env.local.example .env.local
# Fill in API keys
npm run dev
```

### Required Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key for AI processing |
| `GOOGLE_CLIENT_ID` | Gmail OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `TWILIO_FROM_NUMBER` | Your Twilio phone number |
| `LIVEKIT_URL` | LiveKit server URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |

### Optional (Cloud Mode)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_CONVEX_URL` | Enables Convex cloud + BetterAuth |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL for auth |
| `NEXT_PUBLIC_APP_URL` | Production URL (e.g. https://comms.soshi.dev) |

## Development

```bash
# Web app only
npm run dev

# Web + voice agent
npm run dev:all

# Voice agent only
npm run dev:voice
```

## Deploy

```bash
# Fly.io
fly deploy --app comms-web
```

## Architecture

```
src/
  app/                  # Next.js pages
    (chat)/             # Home chat page
    inbox/              # Email inbox with category tabs
    sms/                # SMS conversations
    calls/              # Call history
    contacts/           # Contact management
    settings/           # AI settings, voice config
    api/
      ai/               # AI processing endpoints
      gmail/            # Gmail OAuth + sync
      twilio/           # Voice + SMS endpoints
      mcp/              # MCP server (JSON-RPC 2.0)
  lib/
    ai/tools/           # 36 AI tools (MCP-compatible)
    stores/             # JSON file stores (local mode)
    mcp/                # MCP protocol handler
  components/
    layout/             # Sidebar, AppShell
    chat/               # Chat UI components
    ui/                 # Shared UI primitives
```
