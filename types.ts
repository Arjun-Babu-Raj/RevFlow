import { Type } from '@google/genai';

export enum Step {
  TITLE = 'TITLE',
  DESCRIPTION = 'DESCRIPTION',
  TEMPLATE_UPLOAD = 'TEMPLATE_UPLOAD',
  EXTRACTING = 'EXTRACTING',
  RESULTS = 'RESULTS',
}

export interface TemplateField {
  field: string;
  description: string;
}

export interface ArticleFile {
  name: string;
  content: string; // Will be base64 data URL for PDFs
  mimeType: string; // e.g., 'text/plain' or 'application/pdf'
}

export type ExtractedDataRow = {
  'Article Name': string;
  [key: string]: string;
};

// This mirrors the schema from the Gemini API for typing
export const GeminiSchema = {
  type: Type.OBJECT,
  properties: {
    field: { type: Type.STRING },
    description: { type: Type.STRING },
  },
};