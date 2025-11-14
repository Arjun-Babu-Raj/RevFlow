import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Securely access the key from the server environment
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    console.error("Server Error: GEMINI_API_KEY is missing.");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const { contents, responseMimeType, responseSchema, model } = req.body;
    const ai = new GoogleGenAI({ apiKey });

    const generateConfig = {
      model: model || 'gemini-2.5-flash',
      config: { temperature: 0.5 }
    };

    if (responseMimeType) generateConfig.config.responseMimeType = responseMimeType;
    if (responseSchema) generateConfig.config.responseSchema = responseSchema;

    const response = await ai.models.generateContent({
      ...generateConfig,
      contents: contents,
    });

    return res.status(200).json({ text: response.text });

  } catch (error) {
    console.error("Gemini API Error:", error);
    return res.status(500).json({ error: "AI Service Error" });
  }
}