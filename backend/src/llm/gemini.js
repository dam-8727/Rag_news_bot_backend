// Import Google's Generative AI library for LLM functionality
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google AI client with our API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use env override; default to a current, supported model
const MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";

/**
 * Smart retry logic for handling API rate limits and temporary failures
 * This prevents our app from crashing when the API is temporarily overloaded
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;

      const status = error?.status ?? error?.response?.status;
      const msg = String(error?.message || "");
      const transient =
        status === 503 ||
        status === 502 ||
        status === 500 ||
        status === 504 ||
        status === 429 ||
        /overload|quota|rate|exceed/i.test(msg);

      if (transient) {
        const delay = baseDelay * Math.pow(2, i);
        console.log(`Transient error (${status || "n/a"}), retrying in ${delay}ms... (${i + 1}/${maxRetries})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}

/**
 * Generate an AI response using context from our news database
 * This is where the magic happens - we combine user questions with relevant news articles
 */
export async function answerWithContext({ message, contextDocs = [], history = [] }) {
  // Get the Gemini model instance
  const model = genAI.getGenerativeModel({ model: MODEL });
  console.log("Using Gemini model:", MODEL);

  // Format the context documents into numbered blocks for the AI
  const ctxBlocks = contextDocs
    .map((d, i) => `---\n[${i + 1}] TITLE: ${d.title}\nURL: ${d.url}\nTEXT: ${d.text}`)
    .join("\n");

  // Format recent conversation history (last 6 messages) for context
  const histText = history
    .slice(-6)
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  // System prompt that tells the AI how to behave
  const sys = `You are a helpful news assistant. Only use the CONTEXT. Cite sources like [1], [2]. If unsure, say you are unsure.`;

  // Combine everything into the final prompt
  const prompt = `${sys}\n\nCONTEXT:\n${ctxBlocks}\n\nCHAT HISTORY:\n${histText}\n\nUSER: ${message}\nASSISTANT:`;

  // Generate the response with retry logic in case of API issues
  const resp = await retryWithBackoff(async () => {
    return await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }]}],
    });
  });

  return { text: resp.response.text() };
}
