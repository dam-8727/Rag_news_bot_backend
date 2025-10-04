# RAG News Bot - Simple Flow Chart

## Main User Query Flow

```
┌─────────────┐
│    USER     │
│   Query     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Frontend   │
│     UI      │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Express    │
│   Server    │
│ (server.js) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ RAG Pipeline│
│(chat/rag.js)│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Session   │
│ Management  │
│ (redis.js)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Query     │
│  Embedding  │
│ (jina.js)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Vector    │
│   Search    │
│(qdrant.js)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Relevant   │
│ News Chunks │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    LLM      │
│ Generation  │
│(gemini.js)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   AI        │
│ Response +  │
│ Citations   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Save to   │
│    Redis    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Response to │
│    User     │
└─────────────┘
```

## Data Ingestion Flow (One-time Setup)

```
┌─────────────┐
│   URLs.txt  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Web       │
│  Scraping   │
│(cheerio)    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Text      │
│  Cleaning   │
│ & Chunking  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Embedding  │
│ (jina.js)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Vector    │
│  Storage    │
│(qdrant.js)  │
└─────────────┘
```

## System Components Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    RAG NEWS BOT SYSTEM                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │    User     │    │  Frontend   │    │  Backend    │     │
│  │             │◄──►│     UI      │◄──►│  (Express)  │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
│                                                 │           │
│  ┌─────────────┐    ┌─────────────┐    ┌──────▼──────┐     │
│  │   Jina AI   │◄───│  Embedding  │◄───│ RAG Pipeline│     │
│  │ (Embeddings)│    │  Service    │    │             │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
│                                                 │           │
│  ┌─────────────┐    ┌─────────────┐    ┌──────▼──────┐     │
│  │   Qdrant    │◄───│   Vector    │◄───│   Vector    │     │
│  │  Vectors    │    │  Database   │    │   Search    │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
│                                                 │           │
│  ┌─────────────┐    ┌─────────────┐    ┌──────▼──────┐     │
│  │   Gemini    │◄───│     LLM     │◄───│   Context   │     │
│  │ 2.0 Flash   │    │ Generation  │    │  Filtering  │     │
│  └─────────────┘    └─────────────┘    └──────┬──────┘     │
│                                                 │           │
│  ┌─────────────┐    ┌─────────────┐    ┌──────▼──────┐     │
│  │    Redis    │◄───│   Session   │◄───│  Response   │     │
│  │   Cache     │    │ Management  │    │ Processing  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Decision Points

```
User Query
    │
    ▼
┌─────────────┐
│  Session    │
│  Exists?    │
└─────┬───────┘
      │
   Yes│    No
      ▼      ▼
┌─────────┐ ┌─────────────┐
│ Retrieve│ │ Create New  │
│ History │ │  Session    │
└─────┬───┘ └──────┬──────┘
      │            │
      └──────┬─────┘
             │
             ▼
┌─────────────┐
│  Embedding  │
│  Generation │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Vector      │
│ Search      │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Similarity  │
│ > 60%?      │
└─────┬───────┘
      │
   Yes│    No
      ▼      ▼
┌─────────┐ ┌─────────────┐
│ Use Top │ │ Use Top 3   │
│ Results │ │ Results     │
└─────┬───┘ └──────┬──────┘
      │            │
      └──────┬─────┘
             │
             ▼
┌─────────────┐
│ LLM         │
│ Generation  │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Save to     │
│ Redis       │
└─────┬───────┘
      │
      ▼
┌─────────────┐
│ Return      │
│ Response    │
└─────────────┘
```

## API Endpoints Flow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ POST /api/  │
│    chat     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GET /api/   │
│ session/:id │
│ /history    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ DELETE /api │
│ /session/:id│
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ GET /health │
└─────────────┘
```

## Error Handling Flow

```
┌─────────────┐
│   Request   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ Try Redis   │
└─────┬───────┘
      │
   Success│    Failure
      ▼      ▼
┌─────────┐ ┌─────────────┐
│ Continue│ │ Use Memory  │
│ Process │ │ Storage     │
└─────┬───┘ └──────┬──────┘
      │            │
      └──────┬─────┘
             │
             ▼
┌─────────────┐
│ Try Jina    │
│ API         │
└─────┬───────┘
      │
   Success│    Failure
      ▼      ▼
┌─────────┐ ┌─────────────┐
│ Continue│ │ Retry with  │
│ Process │ │ Backoff     │
└─────┬───┘ └──────┬──────┘
      │            │
      └──────┬─────┘
             │
             ▼
┌─────────────┐
│ Try Gemini  │
│ API         │
└─────┬───────┘
      │
   Success│    Failure
      ▼      ▼
┌─────────┐ ┌─────────────┐
│ Return  │ │ Return      │
│ Response│ │ Error       │
└─────────┘ └─────────────┘
```

This flowchart shows the complete flow of your RAG news bot system, including:
1. **Main user query flow** - from user input to response
2. **Data ingestion flow** - how news articles are processed and stored
3. **System components overview** - all the services and their relationships
4. **Key decision points** - important branching logic in your system
5. **API endpoints flow** - how different endpoints are used
6. **Error handling flow** - how the system handles failures gracefully

The flowcharts are designed to be simple and easy to follow, showing the logical progression through your system without getting too technical.

