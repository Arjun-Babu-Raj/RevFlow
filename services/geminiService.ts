import type { TemplateField, ExtractedDataRow, ArticleFile, BatchExtractionResponse } from '../types';

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
  template: TemplateField[]
): Promise<Omit<ExtractedDataRow, 'Article Name'>> {
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
    return JSON.parse(data.text);
  } catch (e) {
    return {};
  }
}

/**
 * Extract data from multiple articles in a single batch API request
 * Accepts up to 3 articles per batch for efficiency
 * Returns extracted data for each article or null for failed extractions
 */
export async function extractDataFromArticlesBatch(
  articles: ArticleFile[],
  template: TemplateField[]
): Promise<BatchExtractionResponse> {
  // Limit batch size to 3 articles
  if (articles.length > 3) {
    throw new Error('Batch size cannot exceed 3 articles');
  }

  const templateFields = template.map(t => t.field);
  
  // Build the batch prompt
  let batchPrompt = `You are an expert research assistant performing data extraction from multiple research articles.

**Task:** Extract structured data from ${articles.length} articles according to the provided template.

**Data Extraction Template:**
${JSON.stringify(template, null, 2)}

**IMPORTANT INSTRUCTIONS:**
1. Extract data from EACH article separately
2. Return a JSON array with exactly ${articles.length} objects
3. Each object must have ALL template fields
4. If a field cannot be found, use "Not Found" as the value
5. Maintain the same order as the input articles
6. Each result object should match this structure with all template fields

`;

  // Build the response schema for the batch
  const batchSchema = {
    type: "ARRAY",
    items: {
      type: "OBJECT",
      properties: {} as any,
      required: templateFields,
    }
  };

  // Add all template fields to the schema
  template.forEach(item => {
    batchSchema.items.properties[item.field] = { 
      type: "STRING", 
      description: item.description 
    };
  });

  // Prepare request contents with all articles
  let requestContents;
  
  // Check if all articles are text-based
  const allText = articles.every(a => a.mimeType.startsWith('text/'));
  
  if (allText) {
    // Text-based articles - include all in prompt
    let articlesText = '';
    articles.forEach((article, idx) => {
      const textContent = atob(article.content.split(',')[1]);
      articlesText += `\n\n**Article ${idx + 1}: ${article.name}**\n---\n${textContent}\n---`;
    });
    requestContents = batchPrompt + articlesText;
  } else {
    // Mixed or binary articles - use multipart with inline data
    const parts: any[] = [{ text: batchPrompt }];
    
    articles.forEach((article, idx) => {
      parts.push({ text: `\n\n**Article ${idx + 1}: ${article.name}**\n` });
      
      if (article.mimeType.startsWith('text/')) {
        const textContent = atob(article.content.split(',')[1]);
        parts.push({ text: `---\n${textContent}\n---` });
      } else {
        parts.push({ 
          inlineData: { 
            data: article.content.split(',')[1], 
            mimeType: article.mimeType 
          } 
        });
      }
    });
    
    requestContents = { parts };
  }

  try {
    const data = await callRevFlowAPI({
      contents: requestContents,
      responseMimeType: "application/json",
      responseSchema: batchSchema,
      model: "gemini-2.5-flash" // Use flash model for batch processing
    });

    // Parse the batch response
    const batchResults = JSON.parse(data.text);
    
    // Validate we got the expected number of results
    if (!Array.isArray(batchResults) || batchResults.length !== articles.length) {
      console.warn(`Expected ${articles.length} results but got ${batchResults?.length || 0}`);
      // Return failure for all articles
      return {
        results: articles.map(article => ({
          articleName: article.name,
          data: {},
          success: false
        }))
      };
    }

    // Build the response
    return {
      results: articles.map((article, idx) => {
        const extractedData = batchResults[idx];
        const hasValidData = extractedData && Object.keys(extractedData).length > 0;
        
        return {
          articleName: article.name,
          data: extractedData || {},
          success: hasValidData
        };
      })
    };
  } catch (e) {
    console.error('Batch extraction failed:', e);
    // Return failure for all articles in the batch
    return {
      results: articles.map(article => ({
        articleName: article.name,
        data: {},
        success: false
      }))
    };
  }
}