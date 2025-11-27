import { GoogleGenAI } from "@google/genai";
import { Movie } from "../types";

// NOTE: In a real deployment, ensure process.env.API_KEY is set.
const apiKey = process.env.API_KEY;

export const getAIRecommendations = async (
  watchedMovies: string[], 
  favoriteGenre: string
): Promise<string> => {
  if (!apiKey || apiKey === 'dummy_key') {
      return "Gemini API Key is missing. Please add it to your environment variables to unlock smart recommendations.";
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const model = "gemini-2.5-flash";
    const prompt = `
      I am a student at VITAP who likes these movies: ${watchedMovies.join(", ")}.
      My favorite genre is ${favoriteGenre}.
      Recommend 3 hidden gem movies or series that I might like. 
      Keep the response short, friendly, and formatted as a bulleted list. 
      Mention why I might like them based on the VITAP student context (e.g. stress relief, binge-worthy).
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || "Could not generate recommendations at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI service is temporarily unavailable. Please try again later.";
  }
};