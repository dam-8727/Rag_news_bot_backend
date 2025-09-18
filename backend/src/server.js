// Load environment variables from .env file
import "dotenv/config";
import express from "express";
import cors from "cors";
import { v4 as uuid } from "uuid";
import { getHistory, resetSession } from "./cache/redis.js";
import { handleChat } from "./chat/rag.js";

// Create Express app instance
const app = express();

// Enable CORS for all routes (allows frontend to call this API)
app.use(cors());

// Parse JSON requests with 1MB limit to handle large messages
app.use(express.json({ limit: "1mb" }));
// status check
app.get("/", (req, res) => {
  res.send("rag-news-bot backend up!");
});

// Health check endpoint - simple way to verify the API is running
app.get("/health", (_req, res) => res.json({ ok: true }));

// Main chat endpoint - handles user messages and returns AI responses
app.post("/api/chat", async (req, res) => {
  try {
    // Extract sessionId and message from request body
    let { sessionId, message } = req.body || {};
    
    // Validate that we have a message to process
    if (!message) return res.status(400).json({ error: "message required" });
    
    // Generate a new session ID if one wasn't provided
    if (!sessionId) sessionId = uuid();

    // Process the chat message through our RAG pipeline
    const { reply, citations } = await handleChat({ sessionId, message });
    
    // Return the AI response along with source citations
    res.json({ reply, citations, sessionId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || "server_error" });
  }
});

// Get conversation history for a specific session
app.get("/api/session/:id/history", async (req, res) => {
  const messages = await getHistory(req.params.id);
  res.json({ sessionId: req.params.id, messages });
});

// Clear/reset a conversation session
app.delete("/api/session/:id", async (req, res) => {
  await resetSession(req.params.id);
  res.json({ ok: true });
});

// Start the server on the specified port (defaults to 3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API on :${PORT}`));
