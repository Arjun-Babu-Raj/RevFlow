import type { TemplateField, ExtractedDataRow, ArticleFile } from '../types';

async function callRevFlowAPI(payload: any) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Failed to communicate with the AI service');
  }

  return response.json();
}

// Utility function for exponential backoff delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateDescription(title: string): Promise<string> {
  const prompt = `Based on the systematic review title "${title}", generate a concise one-paragraph description of the review's objective, scope, and primary outcomes.`;
  const data = await callRevFlowAPI({ contents: prompt });
  return data.text;
}

export async function generateTemplate(description: string): Promise<TemplateField[]> {
  const prompt = `Based on the following systematic review description, create a comprehensive data extraction template. Description: "${description}"`;

  const schema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {
        field: { type: "STRING" },
        description: { type: "STRING" },
      },
      required: ["field", "description"],
    },
  };

  const data = await callRevFlowAPI({
    contents: prompt,
    responseMimeType: "application/json",
    responseSchema: schema
  });
  
  try {
    return JSON.parse(data.text) as TemplateField[];
  } catch(e) {
    console.error("Failed to parse template JSON:", e);
    return [];
  }
}

export async function extractDataFromArticle(
  article: ArticleFile,
  template: TemplateField[],
  maxRetries: number = 2
): Promise<{
  data: Omit<ExtractedDataRow, 'Article Name'>;
  status: 'success' | 'failed';
  errorMessage?: string;
  attemptCount: number;
}> {
  const templateFields = template.map(t => t.field);
  const basePrompt = `You are an expert research assistant... Data Extraction Template: ${JSON.stringify(template)}`;

  const properties: any = {};
  template.forEach(item => {
    properties[item.field] = { type: "STRING", description: item.description };
  });

  let requestContents;
  if (article.mimeType.startsWith('text/')) {
    const textContent = atob(article.content.split(',')[1]);
    requestContents = `${basePrompt}\n\n**Article Text:**\n---\n${textContent}\n---`;
  } else {
    requestContents = {
      parts: [
        { text: basePrompt },
        { inlineData: { data: article.content.split(',')[1], mimeType: article.mimeType } }
      ]
    };
  }

  let attemptCount = 0;
  let lastError: Error | null = null;

  // Retry loop with exponential backoff
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attemptCount++;
    
    try {
      const data = await callRevFlowAPI({
        contents: requestContents,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: properties,
          required: templateFields,
        }
      });

      try {
        const parsedData = JSON.parse(data.text);
        console.log(`Successfully extracted data from ${article.name} on attempt ${attemptCount}`);
        return {
          data: parsedData,
          status: 'success',
          attemptCount
        };
      } catch (parseError) {
        throw new Error('Failed to parse extraction response');
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(`Attempt ${attemptCount}/${maxRetries + 1} failed for ${article.name}:`, lastError.message);
      
      // If not the last attempt, wait with exponential backoff
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s
        console.log(`Retrying ${article.name} after ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted
  const failedData: Record<string, string> = {};
  template.forEach(field => {
    failedData[field.field] = "Extraction Failed";
  });

  return {
    data: failedData,
    status: 'failed',
    errorMessage: lastError?.message || 'Unknown error',
    attemptCount
  };
}