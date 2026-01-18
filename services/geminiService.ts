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

export async function extractDataFromArticleBatch(
  articles: ArticleFile[],
  template: TemplateField[]
): Promise<Array<Omit<ExtractedDataRow, 'Article Name'>>> {
  if (articles.length === 0) {
    return [];
  }

  const templateFields = template.map(t => t.field);
  const properties: any = {};
  template.forEach(item => {
    properties[item.field] = { type: "STRING", description: item.description };
  });

  // Build batch prompt
  const basePrompt = `You are an expert research assistant extracting data from multiple research articles.

Data Extraction Template:
${JSON.stringify(template, null, 2)}

Process each of the following ${articles.length} article(s) and return a JSON array with extraction results in the same order.`;

  // Collect all article parts
  const parts: any[] = [{ text: basePrompt }];

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const articleNumber = i + 1;
    
    if (article.mimeType.startsWith('text/')) {
      const textContent = atob(article.content.split(',')[1]);
      parts.push({ 
        text: `\n\n---ARTICLE ${articleNumber}: ${article.name}---\n${textContent}\n---END ARTICLE ${articleNumber}---` 
      });
    } else {
      parts.push({ 
        text: `\n\n---ARTICLE ${articleNumber}: ${article.name}---` 
      });
      parts.push({ 
        inlineData: { 
          data: article.content.split(',')[1], 
          mimeType: article.mimeType 
        } 
      });
      parts.push({ 
        text: `\n---END ARTICLE ${articleNumber}---` 
      });
    }
  }

  parts.push({ 
    text: `\n\nReturn a JSON array of exactly ${articles.length} object(s), each containing the extracted fields. Maintain the same order as the input articles.` 
  });

  const requestContents = { parts };

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
    return JSON.parse(data.text);
  } catch (e) {
    console.error("Failed to parse batch extraction response:", e);
    // Return empty objects for each article if parsing fails
    return articles.map(() => ({}));
  }
}