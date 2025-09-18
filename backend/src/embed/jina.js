import axios from "axios";

const JINA_URL = "https://api.jina.ai/v1/embeddings";
const MODEL = "jina-embeddings-v2-base-en";


export async function getEmbedding(input) {
const text = Array.isArray(input) ? input.join("\n\n") : String(input || "");
console.log(`JINA_API_KEY loaded: ${process.env.JINA_API_KEY ? 'YES' : 'NO'}`);
console.log(`JINA_API_KEY length: ${process.env.JINA_API_KEY?.length || 0}`);
const res = await axios.post(
JINA_URL,
{ input: text, model: MODEL },
{ headers: { Authorization: `Bearer ${process.env.JINA_API_KEY}` } }
);
const emb = res.data?.data?.[0]?.embedding;
if (!emb) throw new Error("No embedding from Jina");
return emb;
}


export async function embedMany(texts) {
const payload = Array.isArray(texts) ? texts : [texts];
console.log(`Embedding ${payload.length} texts, first text length: ${payload[0]?.length || 0}`);
const res = await axios.post(
JINA_URL,
{ input: payload, model: MODEL },
{ headers: { Authorization: `Bearer ${process.env.JINA_API_KEY}` } }
);
console.log(`Jina response: ${res.data?.data?.length || 0} embeddings`);
return res.data.data.map((d) => d.embedding);
}