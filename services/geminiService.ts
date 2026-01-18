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

// Batch extraction for multiple articles (up to 3) in a single API call
export async function extractDataFromArticleBatch(
  articles: ArticleFile[],
  template: TemplateField[],
  maxRetries: number = 2
): Promise<Array<{
  articleName: string;
  data: Omit<ExtractedDataRow, 'Article Name'>;
  status: 'success' | 'failed';
  errorMessage?: string;
  attemptCount: number;
}>> {
  const templateFields = template.map(t => t.field);
  
  // Create schema for batch extraction - array of objects
  const properties: any = {};
  template.forEach(item => {
    properties[item.field] = { type: "STRING", description: item.description };
  });

  // Build the batch prompt
  const articleNames = articles.map(a => a.name).join(', ');
  const basePrompt = `You are an expert research assistant performing data extraction for a systematic review. Extract data from the following ${articles.length} articles according to the provided template.

Data Extraction Template: ${JSON.stringify(template)}

For each article, extract the requested fields. Return an array of ${articles.length} objects, one for each article, in the same order as provided. Each object should contain the template fields.`;

  // Build request contents with all articles
  let requestContents;
  
  // Check if all articles are text-based or PDFs
  const allText = articles.every(a => a.mimeType.startsWith('text/'));
  
  if (allText) {
    // For text articles, concatenate them
    let textPrompt = basePrompt + '\n\n';
    articles.forEach((article, idx) => {
      const textContent = atob(article.content.split(',')[1]);
      textPrompt += `\n**Article ${idx + 1}: ${article.name}**\n---\n${textContent}\n---\n`;
    });
    requestContents = textPrompt;
  } else {
    // For PDF articles, use multimodal format
    const parts: any[] = [{ text: basePrompt }];
    articles.forEach((article, idx) => {
      parts.push({ text: `\n**Article ${idx + 1}: ${article.name}**\n` });
      parts.push({ 
        inlineData: { 
          data: article.content.split(',')[1], 
          mimeType: article.mimeType 
        } 
      });
    });
    requestContents = { parts };
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
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: properties,
            required: templateFields,
          }
        }
      });

      try {
        const parsedData = JSON.parse(data.text) as Array<Record<string, string>>;
        console.log(`Successfully extracted data from ${articles.length} articles (${articleNames}) on attempt ${attemptCount}`);
        
        // Validate that we got results for all articles
        if (parsedData.length !== articles.length) {
          console.warn(`Expected ${articles.length} results but got ${parsedData.length}`);
        }
        
        // Map results back to individual articles with validation
        return articles.map((article, idx) => {
          const articleData = parsedData[idx];
          
          // Check if we got valid data for this article
          if (!articleData || Object.keys(articleData).length === 0) {
            const failedData: Record<string, string> = {};
            template.forEach(field => {
              failedData[field.field] = "Extraction Failed";
            });
            return {
              articleName: article.name,
              data: failedData,
              status: 'failed' as const,
              errorMessage: 'No data returned for this article in batch',
              attemptCount
            };
          }
          
          return {
            articleName: article.name,
            data: articleData,
            status: 'success' as const,
            attemptCount
          };
        });
      } catch (parseError) {
        throw new Error('Failed to parse extraction response');
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error occurred');
      console.error(`Attempt ${attemptCount}/${maxRetries + 1} failed for batch (${articleNames}):`, lastError.message);
      
      // If not the last attempt, wait with exponential backoff
      if (attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 1s, 2s
        console.log(`Retrying batch (${articleNames}) after ${delayMs}ms...`);
        await sleep(delayMs);
      }
    }
  }

  // All retries exhausted - return failed results for all articles in batch
  const failedData: Record<string, string> = {};
  template.forEach(field => {
    failedData[field.field] = "Extraction Failed";
  });

  return articles.map(article => ({
    articleName: article.name,
    data: failedData,
    status: 'failed',
    errorMessage: lastError?.message || 'Unknown error',
    attemptCount
  }));
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