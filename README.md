# RAG News Bot

A Retrieval-Augmented Generation (RAG) news bot that answers questions using news articles as context.

##  Project Structure

```
rag-news-bot/
├── backend/
│   ├── src/
│   │   ├── server.js          # Express API server
│   │   ├── chat/rag.js        # Main RAG pipeline
│   │   ├── llm/gemini.js      # LLM integration
│   │   ├── embed/jina.js      # Embedding service
│   │   ├── vecdb/qdrant.js    # Vector database
│   │   ├── cache/redis.js     # Session storage
│   │   └── ingest/ingest.js   # Data ingestion
│   ├── data/
│   │   ├── urls.txt           # News URLs to scrape
│   │   └── news.jsonl         # Processed articles backup
│   ├── package.json
│   └── package-lock.json
├── docs/
│   └── E2Eflow.md            # End-to-end flow documentation
└── README.md
```

##  Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Add your API keys to .env file
```

### 3. Ingest News Data
```bash
# Add URLs to data/urls.txt
node src/ingest/ingest.js
```

### 4. Start Server
```bash
node src/server.js
```

##  Environment Variables

```bash
# Required API Keys
GEMINI_API_KEY=your_gemini_key
JINA_API_KEY=your_jina_key
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key


REDIS_URL=your_redis_url
SESSION_TTL_SECONDS=86400
QDRANT_COLLECTION=news
```

## Configuration

### TTL (Time To Live) Configuration

#### Session TTL
Control how long conversation sessions are kept in cache:

```bash
# 24 hours (default)
SESSION_TTL_SECONDS=86400

# 2 hours
SESSION_TTL_SECONDS=7200

# 1 week
SESSION_TTL_SECONDS=604800
```

#### Redis TTL
For Redis-specific TTL configuration, modify `src/cache/redis.js`:

```javascript
// Default TTL: 24 hours
const TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS ?? 60 * 60 * 24);

// Custom TTL per session type
const TTL_CONFIG = {
  user_sessions: 86400,    // 24 hours
  admin_sessions: 3600,    // 1 hour
  temp_sessions: 300       // 5 minutes
};
```


##  Documentation

- [End-to-End Flow Documentation](docs/E2Eflow.md) - Complete system architecture and flow

##  Features

- **Vector Search**: Uses Qdrant for semantic similarity search
- **LLM Integration**: Google Gemini for response generation
- **Session Management**: Redis caching for conversation history
- **Web Scraping**: Automated news article ingestion
- **Smart Chunking**: Intelligent text splitting for better context
- **Citation Support**: References sources in responses

##  API Endpoints

- `POST /api/chat` - Send message to bot
- `GET /api/session/:id/history` - Get conversation history
- `DELETE /api/session/:id` - Clear session
- `GET /health` - Health check
