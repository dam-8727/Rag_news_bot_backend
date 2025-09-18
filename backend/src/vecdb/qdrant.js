// Import Qdrant client for vector database operations
import { QdrantClient } from "@qdrant/js-client-rest";

// Initialize the Qdrant client with our configuration
// This connects us to our vector database where we store news article embeddings
console.log('QDRANT_URL:', process.env.QDRANT_URL);
console.log('QDRANT_API_KEY loaded:', process.env.QDRANT_API_KEY ? 'YES' : 'NO');
export const qdrant = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY || undefined,
});

/**
 * Make sure a collection exists in our vector database
 * If it doesn't exist, create it with the specified dimensions
 */
export async function ensureCollection(name, dim) {
  try {
    // Try to get the collection - if it exists, we're good
    await qdrant.getCollection(name);
  } catch {
    // Collection doesn't exist, so create it
    // We use cosine distance for similarity search (good for text embeddings)
    await qdrant.createCollection(name, { vectors: { size: dim, distance: "Cosine" } });
  }
}

/**
 * Add or update points (vectors + metadata) in our collection
 * This is how we store news articles with their embeddings
 */
export async function upsertPoints(name, points) {
  // points should be an array of objects: [{ id, vector, payload }]
  await qdrant.upsert(name, { points });
}

/**
 * Search for similar vectors in our collection
 * This is how we find relevant news articles for user questions
 */
export async function search(name, vector, k = 5) {
  // Search for the k most similar vectors
  const res = await qdrant.search(name, { vector, limit: k });
  
  // Return results with similarity scores and metadata
  return res.map((r) => ({ score: r.score, ...r.payload }));
}

/**
 * Delete a collection (useful for resetting the database)
 * This is used during data ingestion to start fresh
 */
export async function deleteCollection(name) {
  try {
    await qdrant.deleteCollection(name);
    console.log(`Collection ${name} deleted successfully`);
  } catch (error) {
    console.log(`Collection ${name} does not exist or could not be deleted:`, error.message);
  }
}