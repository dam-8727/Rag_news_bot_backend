// Import our custom modules for different parts of the RAG pipeline
import { getHistory, appendMessage } from '../cache/redis.js';
import { getEmbedding } from '../embed/jina.js';
import { search } from '../vecdb/qdrant.js';
import { answerWithContext } from '../llm/gemini.js';

// Use the collection name from environment or default to "news"
const COLLECTION = process.env.QDRANT_COLLECTION || "news";

/**
 * Main RAG (Retrieval-Augmented Generation) function that handles chat messages
 * This is the heart of our system - it retrieves relevant news articles and generates responses
 */
export async function handleChat({ sessionId, message }) {
  try {
    // First, get the conversation history to maintain context
    const history = await getHistory(sessionId);
    
    // Convert the user's message into a vector embedding so we can search for similar content
    const queryVector = await getEmbedding(message);
    
    // Search our vector database for the most relevant news articles
    // We ask for 8 results initially, then filter them
    const searchResults = await search(COLLECTION, queryVector, 8);
    
    // Filter out results that aren't similar enough (below 60% similarity)
    // This threshold was lowered to include more sports content
    const filteredResults = searchResults.filter(result => result.score >= 0.6);
    
    // If we don't have enough good results, take the top 3 regardless of score
    // This ensures we always have some context to work with
    const finalResults = filteredResults.length > 0 ? filteredResults : searchResults.slice(0, 3);
    
    // Format the search results into a clean structure for the LLM
    const contextDocs = finalResults.map(result => ({
      title: result.title,
      text: result.text,
      url: result.url
    }));
    
    // Send everything to the LLM to generate a response with context
    const response = await answerWithContext({ 
      message, 
      contextDocs, 
      history 
    });
    const reply = response.text;
    
    // Create citations for the sources we used
    // We deduplicate by URL and keep the highest scoring version of each source
    const citationsMap = new Map();
    finalResults.forEach(result => {
      const key = result.url;
      if (!citationsMap.has(key) || result.score > citationsMap.get(key).score) {
        citationsMap.set(key, {
          title: result.title,
          url: result.url,
          score: result.score
        });
      }
    });
    const citations = Array.from(citationsMap.values());
    
    // Save both the user's message and our response to the conversation history
    await appendMessage(sessionId, { message, role: 'user' });
    await appendMessage(sessionId, { message: reply, role: 'assistant' });
    
    return { reply, citations };
  } catch (error) {
    console.error('Error in handleChat:', error);
    throw new Error('Failed to process chat message');
  }
}
