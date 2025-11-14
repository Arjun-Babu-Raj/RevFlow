import { Handler } from '@netlify/functions';
import { GoogleGenAI, Type } from "@google/genai";
import type { TemplateField, ExtractedDataRow, ArticleFile } from '../../types';

const handler: Handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    if (!process.env.API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'API_KEY environment variable is not set on the server.' }) };
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    try {
        const { action, payload } = JSON.parse(event.body || '{}');

        switch (action) {
            case 'generateDescription': {
                const { title } = payload;
                const prompt = `Based on the systematic review title "${title}", generate a concise one-paragraph description of the review's objective, scope, and primary outcomes. This description will be used to guide the data extraction process.`;

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: prompt,
                    config: { temperature: 0.5 }
                });

                return { statusCode: 200, body: JSON.stringify({ description: response.text }) };
            }

            case 'generateTemplate': {
                const { description } = payload;
                const prompt = `Based on the following systematic review description, create a comprehensive data extraction template. The template should be a list of relevant data points to extract from primary research articles. Focus on study characteristics, methodology, participant demographics, interventions, outcomes, and results. \n\nDescription: "${description}"`;

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    field: { type: Type.STRING, description: 'The name of the data point (e.g., "Study Design").' },
                                    description: { type: Type.STRING, description: 'A brief explanation of what to extract for this field.' },
                                },
                                required: ["field", "description"],
                            },
                        },
                    },
                });

                const parsed = JSON.parse(response.text.trim());
                return { statusCode: 200, body: JSON.stringify({ template: parsed as TemplateField[] }) };
            }

            case 'extractData': {
                const { article, template } = payload as { article: ArticleFile, template: TemplateField[] };
                const templateFields = template.map(t => t.field);
                const basePrompt = `You are an expert research assistant performing data extraction for a systematic review. Based on the provided article, extract the data points according to the template. If a specific data point is not mentioned, use the value "Not Found". Return a single JSON object where keys are the field names. \n\n**Template:**\n${JSON.stringify(template, null, 2)}`;

                const properties: { [key: string]: { type: Type.STRING, description: string } } = {};
                template.forEach(item => {
                    properties[item.field] = { type: Type.STRING, description: item.description };
                });

                const filePart = {
                    inlineData: {
                        data: article.content.split(',')[1],
                        mimeType: article.mimeType,
                    },
                };
                const requestContents = { parts: [{ text: basePrompt }, filePart] };

                const response = await ai.models.generateContent({
                    model: "gemini-2.5-flash",
                    contents: requestContents,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: properties,
                            required: templateFields,
                        },
                    },
                });

                const parsed = JSON.parse(response.text.trim());
                return { statusCode: 200, body: JSON.stringify({ data: parsed as Omit<ExtractedDataRow, 'Article Name'> }) };
            }

            default:
                return { statusCode: 400, body: JSON.stringify({ error: 'Invalid action specified.' }) };
        }
    } catch (error: any) {
        console.error('Error in Netlify function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || 'An internal server error occurred.' }),
        };
    }
};

export { handler };
