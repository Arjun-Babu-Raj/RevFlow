import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Step } from './types';
import type { TemplateField, ArticleFile, ExtractionResult } from './types';
import { generateDescription, generateTemplate, extractDataFromArticle, extractDataFromArticlesBatch } from './services/geminiService';

import TitleInput from './components/TitleInput';
import DescriptionEditor from './components/DescriptionEditor';
import TemplateReviewAndUpload from './components/TemplateReviewAndUpload';
import ResultsTable from './components/ResultsTable';
import Loader from './components/Loader';

const stepOrder = [Step.TITLE, Step.DESCRIPTION, Step.TEMPLATE_UPLOAD, Step.RESULTS];

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.TITLE);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [template, setTemplate] = useState<TemplateField[]>([]);

  const [extractedData, setExtractedData] = useState<ExtractionResult[]>([]);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [fileReadProgress, setFileReadProgress] = useState<number | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const mainContentRef = useRef<HTMLElement>(null);
  const sectionRefs = {
    [Step.TITLE]: useRef<HTMLElement>(null),
    [Step.DESCRIPTION]: useRef<HTMLElement>(null),
    [Step.TEMPLATE_UPLOAD]: useRef<HTMLElement>(null),
    [Step.RESULTS]: useRef<HTMLElement>(null),
  };
  
  useEffect(() => {
    const stepKey = (step === Step.EXTRACTING ? Step.TEMPLATE_UPLOAD : step) as keyof typeof sectionRefs;
    const currentStepRef = sectionRefs[stepKey];
    
    if (currentStepRef?.current) {
        currentStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step]);


  const handleStartOver = () => {
    setTitle('');
    setDescription('');
    setTemplate([]);

    setExtractedData([]);
    setError(null);
    setIsLoading(false);
    setIsReadingFiles(false);
    setIsExtracting(false);
    setIsRetrying(false);
    setFileReadProgress(null);
    setExtractionProgress(null);
    setStep(Step.TITLE);
  };
  
  const handleDescriptionGeneration = useCallback(async (newTitle: string) => {
    setTitle(newTitle);
    setIsLoading(true);
    setLoadingMessage('Generating description...');
    setError(null);
    try {
      const generatedDesc = await generateDescription(newTitle);
      setDescription(generatedDesc);
      setStep(Step.DESCRIPTION);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate description: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTemplateGeneration = useCallback(async (newDescription: string) => {
    setDescription(newDescription);
    setIsLoading(true);
    setLoadingMessage('Generating data extraction template...');
    setError(null);
    try {
      const generatedTemplate = await generateTemplate(newDescription);
      setTemplate(generatedTemplate);
      setStep(Step.TEMPLATE_UPLOAD);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate template: ${errorMessage}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  /**
   * Process articles in batches of 3, with automatic fallback to individual extraction
   * if batch processing fails
   */
  const performBatchExtraction = useCallback(async (
    articlesToProcess: Array<{ article: ArticleFile; originalIndex: number }>
  ): Promise<ExtractionResult[]> => {
    const BATCH_SIZE = 3;
    const results: ExtractionResult[] = [];
    const totalArticles = articlesToProcess.length;
    
    // Process in batches
    for (let i = 0; i < articlesToProcess.length; i += BATCH_SIZE) {
      const batchItems = articlesToProcess.slice(i, Math.min(i + BATCH_SIZE, articlesToProcess.length));
      const batchArticles = batchItems.map(item => item.article);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(articlesToProcess.length / BATCH_SIZE);
      
      setLoadingMessage(`Processing batch ${batchNumber} of ${totalBatches} (${batchArticles.length} articles)`);
      
      try {
        // Try batch extraction first
        const batchResponse = await extractDataFromArticlesBatch(batchArticles, template);
        
        // Process each result in the batch
        for (let j = 0; j < batchResponse.results.length; j++) {
          const result = batchResponse.results[j];
          const batchItem = batchItems[j];
          
          if (result.success && Object.keys(result.data).length > 0) {
            // Batch extraction succeeded for this article
            results.push({
              'Article Name': result.articleName,
              ...result.data,
              _extractionStatus: 'success',
              _articleFile: batchItem.article
            });
          } else {
            // Batch extraction failed for this article, try individual fallback
            console.log(`Batch extraction failed for ${result.articleName}, trying individual extraction...`);
            try {
              const individualData = await extractDataFromArticle(batchItem.article, template);
              const hasValidData = Object.keys(individualData).length > 0;
              
              if (hasValidData) {
                results.push({
                  'Article Name': result.articleName,
                  ...individualData,
                  _extractionStatus: 'success',
                  _articleFile: batchItem.article
                });
              } else {
                // Individual extraction also failed
                const failedRow: ExtractionResult = {
                  'Article Name': result.articleName,
                  _extractionStatus: 'failed',
                  _articleFile: batchItem.article
                };
                template.forEach(field => {
                  failedRow[field.field] = "Extraction Failed";
                });
                results.push(failedRow);
              }
            } catch (err) {
              console.error(`Individual extraction also failed for ${result.articleName}:`, err);
              const failedRow: ExtractionResult = {
                'Article Name': result.articleName,
                _extractionStatus: 'failed',
                _articleFile: batchItem.article
              };
              template.forEach(field => {
                failedRow[field.field] = "Extraction Failed";
              });
              results.push(failedRow);
            }
          }
        }
      } catch (batchError) {
        // Entire batch failed, fall back to individual extraction for all articles in batch
        console.error('Entire batch failed, falling back to individual extraction:', batchError);
        
        for (const batchItem of batchItems) {
          try {
            const individualData = await extractDataFromArticle(batchItem.article, template);
            const hasValidData = Object.keys(individualData).length > 0;
            
            if (hasValidData) {
              results.push({
                'Article Name': batchItem.article.name,
                ...individualData,
                _extractionStatus: 'success',
                _articleFile: batchItem.article
              });
            } else {
              const failedRow: ExtractionResult = {
                'Article Name': batchItem.article.name,
                _extractionStatus: 'failed',
                _articleFile: batchItem.article
              };
              template.forEach(field => {
                failedRow[field.field] = "Extraction Failed";
              });
              results.push(failedRow);
            }
          } catch (err) {
            console.error(`Individual extraction failed for ${batchItem.article.name}:`, err);
            const failedRow: ExtractionResult = {
              'Article Name': batchItem.article.name,
              _extractionStatus: 'failed',
              _articleFile: batchItem.article
            };
            template.forEach(field => {
              failedRow[field.field] = "Extraction Failed";
            });
            results.push(failedRow);
          }
        }
      }
      
      // Update progress after each batch
      const processedCount = Math.min(i + BATCH_SIZE, totalArticles);
      setExtractionProgress((processedCount / totalArticles) * 100);
    }
    
    return results;
  }, [template]);
  
  const handleDataExtraction = useCallback(async (filesToProcess: File[]) => {
      // 1. File Reading Phase
      setIsReadingFiles(true);
      setFileReadProgress(0);
      setError(null);

      const readArticles: ArticleFile[] = [];
      for(let i=0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        try {
          const articleContent = await new Promise<ArticleFile>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
              if (event.target?.result) {
                resolve({
                  name: file.name,
                  content: event.target.result as string,
                  mimeType: file.type || 'application/octet-stream'
                });
              } else { reject(new Error("Failed to read file")); }
            };
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
          });
          readArticles.push(articleContent);
        } catch(err) {
          console.error(`Failed to read file ${file.name}`, err);
          setError(`Error reading file: ${file.name}. Please try again.`);
          setIsReadingFiles(false);
          return;
        }
        setFileReadProgress(((i+1) / filesToProcess.length) * 100);
      }
      

      setTimeout(() => { setIsReadingFiles(false) }, 500); // allow progress bar to hit 100%

      // 2. AI Extraction Phase (Batch processing)
      setIsExtracting(true);
      setExtractionProgress(0);
      
      // Prepare articles with their indices for batch processing
      const articlesWithIndices = readArticles.map((article, index) => ({
        article,
        originalIndex: index
      }));
      
      // Use batch extraction
      const allExtractedData = await performBatchExtraction(articlesWithIndices);
      
      setExtractedData(allExtractedData);
      setStep(Step.RESULTS);
      setIsExtracting(false);
      setExtractionProgress(null);
  }, [template, performBatchExtraction]);
  
  /**
   * Retry extraction for failed articles only
   */
  const handleRetryFailed = useCallback(async () => {
    setIsRetrying(true);
    setIsExtracting(true);
    setExtractionProgress(0);
    setError(null);
    
    // Find all failed extractions
    const failedExtractions = extractedData.filter(row => row._extractionStatus === 'failed');
    
    if (failedExtractions.length === 0) {
      setIsRetrying(false);
      setIsExtracting(false);
      return;
    }
    
    // Prepare failed articles for re-extraction
    const failedArticles = failedExtractions
      .filter(row => row._articleFile) // Filter out any without article data first
      .map((row, index) => ({
        article: row._articleFile!,
        originalIndex: index
      }));
    
    if (failedArticles.length === 0) {
      setError('No article data available for retry');
      setIsRetrying(false);
      setIsExtracting(false);
      return;
    }
    
    // Retry extraction using batch processing
    const retryResults = await performBatchExtraction(failedArticles);
    
    // Merge retry results back into extractedData
    const updatedData = extractedData.map(row => {
      if (row._extractionStatus === 'failed') {
        // Find the retry result for this article
        const retryResult = retryResults.find(r => r['Article Name'] === row['Article Name']);
        if (retryResult) {
          return retryResult;
        }
      }
      return row;
    });
    
    setExtractedData(updatedData);
    setIsRetrying(false);
    setIsExtracting(false);
    setExtractionProgress(null);
  }, [extractedData, template, performBatchExtraction]);

  const stepIndex = stepOrder.indexOf(step === Step.EXTRACTING ? Step.RESULTS : step);
  
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-200">
      {isLoading && (
        <div className="fixed inset-0 bg-gray-900/90 z-50 flex items-center justify-center backdrop-blur-sm">
            <Loader message={loadingMessage} />
        </div>
      )}
      <header className="text-center py-8 border-b border-gray-700 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-gray-100">
          RevFlow
        </h1>
        <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto px-4">
          An AI-powered assistant to streamline your systematic reviews. Follow the steps below: start with a title, refine the description, upload your articles, and get structured data in minutes.
        </p>
      </header>
      
      <main ref={mainContentRef} className="flex-1 w-full max-w-5xl mx-auto p-6 sm:p-10 space-y-12 overflow-y-auto">
          {error && (
              <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded-md relative" role="alert">
                  <strong className="font-bold">Error: </strong>
                  <span className="block sm:inline">{error}</span>
              </div>
          )}
          
          <section ref={sectionRefs[Step.TITLE]} id="title-section" aria-labelledby="title-heading" className="bg-gray-800 p-8 sm:p-10 rounded-xl shadow-lg border border-gray-700 transition-opacity" style={{opacity: step === Step.TITLE ? 1 : 0.6}}>
            <TitleInput 
              onGenerateDescription={handleDescriptionGeneration}
              initialTitle={title}
              disabled={step !== Step.TITLE}
            />
          </section>

          {stepIndex >= 1 && (
            <section ref={sectionRefs[Step.DESCRIPTION]} id="description-section" aria-labelledby="description-heading" className="bg-gray-800 p-8 sm:p-10 rounded-xl shadow-lg border border-gray-700 transition-opacity" style={{opacity: step === Step.DESCRIPTION ? 1 : 0.6}}>
              <DescriptionEditor
                initialDescription={description}
                onGenerateTemplate={handleTemplateGeneration}
                disabled={step !== Step.DESCRIPTION}
              />
            </section>
          )}
          
          {stepIndex >= 2 && (
            <section ref={sectionRefs[Step.TEMPLATE_UPLOAD]} id="template-section" aria-labelledby="template-heading" className="bg-gray-800 p-8 sm:p-10 rounded-xl shadow-lg border border-gray-700 transition-opacity" style={{opacity: step === Step.TEMPLATE_UPLOAD || isExtracting ? 1 : 0.6}}>
              <TemplateReviewAndUpload
                template={template}
                onTemplateUpdate={setTemplate}
                onExtractData={handleDataExtraction}
                disabled={step !== Step.TEMPLATE_UPLOAD}
                isReadingFiles={isReadingFiles}
                fileReadProgress={fileReadProgress}
                isExtracting={isExtracting}
                extractionProgress={extractionProgress}
              />
            </section>
          )}
          
          {step === Step.RESULTS && (
             <section ref={sectionRefs[Step.RESULTS]} id="results-section" aria-labelledby="results-heading" className="bg-gray-800 p-8 sm:p-10 rounded-xl shadow-lg border border-gray-700">
               <ResultsTable 
                 data={extractedData} 
                 onStartOver={handleStartOver}
                 onRetryFailed={handleRetryFailed}
                 isRetrying={isRetrying}
               />
            </section>
          )}
      </main>

      <footer className="text-center p-4 border-t border-gray-700 text-gray-500 text-sm">
        <p className="font-semibold text-gray-400">RevFlow: AI-Powered Systematic Review Assistant</p>
        <p>Author: Dr Arjun B, Junior Resident, Department of Community and Family Medicine, AIIMS Bhopal</p>
        <p>Contact: <a href="mailto:arjun.unni16@gmail.com" className="text-blue-400 hover:underline">arjun.unni16@gmail.com</a></p>
      </footer>
    </div>
  );
};

export default App;
