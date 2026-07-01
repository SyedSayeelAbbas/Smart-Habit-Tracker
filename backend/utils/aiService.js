import { GoogleGenAI } from "@google/genai";

let client = null;
const getClient = () => {
  if (client) return client;
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  client = new GoogleGenAI({ apiKey: key });
  return client;
};

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export const isAIEnabled = () => !!process.env.GEMINI_API_KEY;

export const parseJSON = (text) => {
  let cleaned = (text || "").trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\n?/g, "").replace(/\n?```\$/g, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\n?/g, "").replace(/\n?```$/g, "");
  }
  return JSON.parse(cleaned.trim());
};

export const chatCompletion = async ({ system, user, temperature = 0.7 }) => {
  const c = getClient();
  if (!c) {
    return {
      ok: false,
      content:
        "AI features are disabled - set GEMINI_API_KEY in the backend .env to enable real AI responses. Meanwhile, mock fallback data will be used.",
    };
  }
  try {
    const res = await c.models.generateContent({
      model: MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        temperature,
      },
    });
    return { ok: true, content: (res.text || "").trim() };
  } catch (err) {
    console.error("AI error:", err.message);
    return { ok: false, content: "AI request failed. Please try again later." };
  }
};

export const SYSTEM_PROMPTS = {
  weekly:
    "You are a warm, encouraging habit coach. Analyse the user's last 7 days of habit data and write a short weekly review. Highlight where they struggled, patterns noticed, and one specific piece of encouragement. Use the user's activity details to keep it personalized.",
  suggestion:
    "You are a helpful habit coach. Based on the user's goals, productive time, and past struggles, suggest new habits. Respond ONLY with a valid JSON object matching this exact shape: {\"suggestions\": [{\"name\": \"...\", \"description\": \"...\", \"frequency\": \"daily|weekly\"}]}.",
  recovery:
    "You are a compassionate habit recovery coach. The user broke a streak. Write a 3-day recovery plan following this structure: short empathetic opening (1-2 sentences), then Day 1 / Day 2 / Day 3 sections with dynamic actionable tasks.",
  chat:
    "You are a helpful habit analysis assistant. Answer the user's question using ONLY the provided habit data. Provide useful stats and strategies. Keep replies under 120 words. If the data is insufficient, say so briefly.",
  morning:
    "You are a warm, motivating friend. Write a single short morning message (30-60 words) using the user's objectives. Tone: Energetic but not cheesy. No emojis overload – max 1.",
};
