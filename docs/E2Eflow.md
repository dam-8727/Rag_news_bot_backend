# RAG News Bot - End-to-End Flow Documentation

## System Architecture Overview

This RAG (Retrieval-Augmented Generation) news bot combines vector search with LLM generation to answer questions using news articles as context.

## Technology Stack

**Jina AI**: Simple HTTP + free tier, good embeddings  
**Qdrant**: Fast vector DB, payload/citations easy  
**Redis**: Simple session list + TTL (auto cleanup)  
**Gemini**: Fast LLM, good RAG performance  
**Express**: REST API, easy debugging, SSE ready  
**Cheerio**: jQuery-like scraping, multiple selectors

##  Architecture Components

### 1. **Data Ingestion Pipeline** (`ingest/ingest.js`)
```
URLs → Web Scraping → Text Chunking → Embedding → Vector Storage
```

**Process:**
- **Input**: List of news URLs from `data/urls.txt`
- **Scraping**: Uses Cheerio to extract article content with multiple CSS selectors
- **Cleaning**: Removes ads, navigation, comments; keeps main content
- **Chunking**: Smart text splitting at sentence boundaries (1500 chars max)
- **Embedding**: Jina AI converts text chunks to vectors
- **Storage**: Qdrant vector database stores embeddings + metadata

### 2. **Vector Database** (`vecdb/qdrant.js`)
```
Embeddings → Cosine Similarity Search → Ranked Results
```

**Features:**
- **Collection**: Named "news" with cosine distance metric
- **Points**: Each contains `{id, vector, payload: {title, url, text}}`
- **Search**: Finds most similar chunks to user queries
- **Scoring**: Returns similarity scores (0-1)

### 3. **Embedding Service** (`embed/jina.js`)
```
Text → Jina AI API → Vector Embeddings
```

**Process:**
- **Model**: `jina-embeddings-v1` (512-768 dimensions)
- **Batch Processing**: Handles multiple texts efficiently
- **Rate Limiting**: Built-in delays to respect API limits

### 4. **LLM Integration** (`llm/gemini.js`)
```
Context + History + Query → Gemini → Response
```

**Features:**
- **Model**: Gemini 1.5 Flash (fast, good for RAG)
- **Retry Logic**: Exponential backoff for API overload
- **Context Formatting**: Structures news articles for LLM
- **Citation Support**: References sources [1], [2], etc.

### 5. **Session Management** (`cache/redis.js`)
```
Conversations → Redis/Memory → Context Preservation
```

**Storage:**
- **Primary**: Redis with TTL (24 hours)
- **Fallback**: In-memory storage
- **Format**: `{message, role, timestamp}`

##  Key Functions by Component (In Data Flow Order)

### 1. **Data Ingestion Functions** (`ingest/ingest.js`)
```javascript
// Main ingestion pipeline
main()

// Web scraping with content extraction
scrape(url)

// Smart text chunking at sentence boundaries
chunkText(text, maxChars = 1500, overlap = 150)

// Get embedding dimensions from Jina API
inferDim()
```

### 2. **Embedding Functions** (`embed/jina.js`)
```javascript
// Single text to vector conversion
getEmbedding(input)

// Batch processing for multiple texts (more efficient)
embedMany(texts)
```

### 3. **Vector Database Functions** (`vecdb/qdrant.js`)
```javascript
// Create collection with proper dimensions
ensureCollection(name, dim)

// Store vectors with metadata in database
upsertPoints(name, points)

// Search for similar vectors
search(name, vector, k = 5)

// Delete collection (for fresh start)
deleteCollection(name)
```

### 4. **Session Management Functions** (`cache/redis.js`)
```javascript
// Store conversation message
storeMessage(sessionId, message, role)

// Retrieve conversation history
getHistory(sessionId)

// Clear/reset session
clearSession(sessionId)
```

### 5. **RAG Pipeline Functions** (`chat/rag.js`)
```javascript
// Main RAG processing function
processQuery(sessionId, message)

// Vector search with similarity filtering
searchSimilarChunks(query)

// Generate LLM response with context
generateResponse(context, history, query)
```

### 6. **LLM Functions** (`llm/gemini.js`)
```javascript
// Generate response with context and history
generateResponse(context, history, query)

// Retry logic with exponential backoff
retryWithBackoff(fn, maxRetries = 3)
```

### 7. **Server Functions** (`server.js`)
```javascript
// Main Express server setup
// API endpoints: /api/chat, /api/session/:id/history, /api/session/:id, /health
```

##  Complete User Interaction Flow

### Step 1: User Query
```
User sends: "What's happening with AI regulation?"
↓
POST /api/chat
{ sessionId: "abc123", message: "What's happening with AI regulation?" }
```

### Step 2: Session Context
```
Server retrieves conversation history from Redis
↓
History: [previous messages with timestamps]
```

### Step 3: Query Embedding
```
User message → Jina AI → Vector embedding
↓
[0.1, 0.3, 0.7, ...] (512-dimensional vector)
```

### Step 4: Vector Search
```
Query vector → Qdrant search → Similar news chunks
↓
Results: [
  {score: 0.89, title: "AI Regulation Update", url: "...", text: "..."},
  {score: 0.76, title: "Tech Policy Changes", url: "...", text: "..."},
  ...
]
```

### Step 5: Context Filtering
```
Filter by similarity threshold (60%)
↓
Keep top results or fallback to top 3
```

### Step 6: LLM Generation
```
Context + History + Query → Gemini → Response
↓
Prompt: "You are a helpful news assistant. Only use the CONTEXT..."
```

### Step 7: Response Processing
```
LLM response + Citations → User
↓
{
  reply: "Based on recent news, AI regulation is...",
  citations: [
    {title: "AI Regulation Update", url: "...", score: 0.89}
  ],
  sessionId: "abc123"
}
```

### Step 8: Session Update
```
Save user message + AI response to Redis
↓
Conversation history updated for next interaction
```

##  Key Data Flows

### Ingestion Flow (One-time setup)
```
URLs.txt → Scraper → Cleaner → Chunker → Embedder → Qdrant
```

### Query Flow (Per user interaction)
```
User Query → Embedder → Qdrant Search → Filter → LLM → Response
```

### Session Flow (Per conversation)
```
Message → Redis Store → Context Retrieval → LLM → Response Store
```


##  Important Dependencies

### Core Dependencies
```json
{
  "@google/generative-ai": "^0.24.1",    // Gemini LLM integration
  "@qdrant/js-client-rest": "^1.15.1",   // Vector database client
  "axios": "^1.12.2",                    // HTTP requests for APIs
  "cheerio": "^1.1.2",                   // Web scraping and HTML parsing
  "express": "^5.1.0",                   // Web server framework
  "redis": "^5.8.2",                     // Session caching
  "uuid": "^13.0.0",                     // Unique ID generation
  "cors": "^2.8.5",                      // Cross-origin requests
  "dotenv": "^17.2.2"                    // Environment variables
}
```

### Key Dependencies by Function
- **LLM Integration**: `@google/generative-ai` (Gemini API)
- **Vector Database**: `@qdrant/js-client-rest` (Qdrant client)
- **Web Scraping**: `cheerio` (HTML parsing), `axios` (HTTP requests)
- **Web Server**: `express` (API endpoints), `cors` (CORS handling)
- **Session Management**: `redis` (caching), `uuid` (ID generation)
- **Configuration**: `dotenv` (environment variables)

### Required Environment Variables
```bash

GEMINI_API_KEY=your_gemini_key
JINA_API_KEY=your_jina_key
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key
REDIS_URL=your_redis_url
SESSION_TTL_SECONDS=86400
QDRANT_COLLECTION=news
_____________________________________________________________________________________________
## API Endpoints

### POST `/api/chat`
Send a message to the bot
```json
{
  "sessionId": "optional-session-id",
  "message": "Your question here"
}
```

**Response:**
```json
{
  "reply": "AI response with context",
  "citations": [
    {
      "title": "Article Title",
      "url": "https://example.com",
      "score": 0.89
    }
  ],
  "sessionId": "session-id"
}
```

### GET `/api/session/:id/history`
Get conversation history for a session

### DELETE `/api/session/:id`
Clear/reset a conversation session

### GET `/health`
Health check endpoint
---------------------------------------------------------------------------------------------

## overall  Flow Diagram

```
 USER QUERY
    ↓
Express Server (server.js)
    ↓
 RAG Pipeline (chat/rag.js)
    ↓
 Query Embedding (jina.js)
    ↓
 Vector Search (qdrant.js)
    ↓
 Relevant News Chunks
    ↓
 LLM Generation (gemini.js)
    ↓
 AI Response + Citations
    ↓
 Save to Redis (redis.js)
    ↓
 Response to User
```

**Data Ingestion Flow:**
```
 URLs.txt → 🕷️ Scraper →  Chunker →  Embedder → Qdrant
```



###  **Noteworthy Design Decisions**


1. **Backup System** - If Redis fails, use memory storage so the system keeps working instead of crashing.

2. **Quality Filter** - Only use articles that are 60% similar to the question, but always keep at least 3 results to avoid empty answers.

3. **Efficient Processing** - Process multiple texts together and add small delays to avoid hitting API limits.

### **Potential Improvements**

1. **Better Search** - Add regular keyword search along with AI search so it can find specific names, dates, and terms more easily.

2. **Smarter Text Splitting** - Instead of cutting text at fixed lengths, split it by paragraphs or topics to keep related information together.

3. **Faster Responses** - Remember similar questions and their answers so users don't have to wait for the same AI processing every time.

4. **Track Performance** - Keep track of how well the system is working - response speed, accuracy, and user satisfaction to keep improving it.

5. **RSS Feed Integration** - Instead of manually adding news URLs, automatically fetch latest articles from multiple news RSS feeds (Reuters, BBC, CNN, etc.) every 15-30 minutes to keep the knowledge base fresh and up-to-date.

