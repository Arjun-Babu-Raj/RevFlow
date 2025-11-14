import React, { useState } from 'react';
import type { TemplateField } from '../types';

interface TemplateReviewAndUploadProps {
  template: TemplateField[];
  onTemplateUpdate: (template: TemplateField[]) => void;
  onExtractData: (articles: File[]) => void;
  disabled: boolean;
  isReadingFiles: boolean;
  fileReadProgress: number | null;
  isExtracting: boolean;
  extractionProgress: number | null;
}

const TemplateReviewAndUpload: React.FC<TemplateReviewAndUploadProps> = ({ 
    template, 
    onTemplateUpdate,
    onExtractData, 
    disabled,
    isReadingFiles,
    fileReadProgress,
    isExtracting,
    extractionProgress
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const componentDisabled = disabled || isExtracting;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
      setFileError(null);
    }
  };

  const handleFieldChange = (index: number, key: keyof TemplateField, value: string) => {
    const updatedTemplate = [...template];
    updatedTemplate[index] = { ...updatedTemplate[index], [key]: value };
    onTemplateUpdate(updatedTemplate);
  };

  const handleAddField = () => {
    onTemplateUpdate([...template, { field: '', description: '' }]);
  };

  const handleRemoveField = (index: number) => {
    onTemplateUpdate(template.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setFileError('Please upload at least one article file.');
      return;
    }
    if (componentDisabled) return;
    onExtractData(files);
  };

  return (
    <div className="space-y-10">
      <h2 id="template-heading" className="text-3xl font-bold text-gray-200">3. Review Template & Upload Articles</h2>
      
      <section aria-labelledby="template-edit-heading">
        <h3 id="template-edit-heading" className="text-xl font-semibold mb-2 text-gray-200">Editable Data Extraction Template</h3>
        <p className="text-lg text-gray-400 mb-6">Review and refine the template fields below. Add or remove fields as needed to fit your review criteria.</p>
        <div className="space-y-4">
          {template.map((item, index) => (
            <div key={index} className="flex flex-col sm:flex-row items-start gap-3 p-4 bg-gray-900/50 border border-gray-700 rounded-lg">
              <div className="flex-1 w-full">
                <label htmlFor={`field-name-${index}`} className="sr-only">Field Name</label>
                <input
                  id={`field-name-${index}`}
                  type="text"
                  value={item.field}
                  onChange={(e) => handleFieldChange(index, 'field', e.target.value)}
                  placeholder="Field Name (e.g., Sample Size)"
                  className="w-full px-3 py-2 text-base bg-gray-700 text-gray-100 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  disabled={componentDisabled}
                />
              </div>
              <div className="flex-[2] w-full">
                 <label htmlFor={`field-desc-${index}`} className="sr-only">Field Description</label>
                 <textarea
                  id={`field-desc-${index}`}
                  value={item.description}
                  onChange={(e) => handleFieldChange(index, 'description', e.target.value)}
                  placeholder="Field Description"
                  rows={1}
                  className="w-full px-3 py-2 text-base bg-gray-700 text-gray-100 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-y min-h-[42px]"
                  disabled={componentDisabled}
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveField(index)}
                className="p-2 text-gray-400 hover:text-red-400 rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:hover:text-gray-400 disabled:hover:bg-transparent"
                disabled={componentDisabled}
                aria-label={`Remove field ${item.field}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
              </button>
            </div>
          ))}
          <div className="flex justify-start mt-4">
              <button type="button" onClick={handleAddField} className="text-blue-400 font-semibold hover:text-blue-300 disabled:opacity-50" disabled={componentDisabled}>
                + Add Field
              </button>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section aria-labelledby="upload-heading">
          <h3 id="upload-heading" className="text-xl font-semibold mb-2 text-gray-200">Upload Articles</h3>
          <p className="text-lg text-gray-400 mb-6">
              Upload one or more articles. Text-based files (.txt) and PDFs (.pdf) are supported.
          </p>
          <div className={`mt-2 flex justify-center rounded-lg border border-dashed border-gray-600 px-6 py-10 transition ${!componentDisabled && "hover:border-gray-500"}`}>
              <div className="text-center">
                  <svg className="mx-auto h-12 w-12 text-gray-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                  <div className="mt-4 flex justify-center text-base leading-6 text-gray-400">
                      <label htmlFor="file-upload" className={`relative rounded-md bg-gray-800 font-semibold text-blue-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-gray-800 ${componentDisabled ? "cursor-not-allowed text-blue-400/50" : "cursor-pointer hover:text-blue-300"}`}>
                          <span>Upload files</span>
                          <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple onChange={handleFileChange} accept=".txt,.pdf,text/plain,application/pdf" disabled={componentDisabled} />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                  </div>
                   {files.length > 0 && <p className="text-sm leading-5 text-gray-500 mt-2">{files.length} file(s) selected: {files.map(f => f.name).join(', ')}</p>}
                   {fileError && <p className="text-sm text-red-500 mt-2">{fileError}</p>}
              </div>
          </div>
        </section>

        {(isReadingFiles || isExtracting) && (
          <div className="pt-4 space-y-3">
            <p className="text-base font-medium text-gray-300">
              {isExtracting ? 'Extracting data from articles...' : 'Preparing files...'}
            </p>
            <div className="w-full bg-gray-600 rounded-full h-3">
              <div 
                className="bg-blue-500 h-3 rounded-full transition-all duration-300" 
                style={{ width: `${isExtracting ? extractionProgress : fileReadProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white font-bold py-3 px-8 text-lg rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition disabled:bg-blue-800/50 disabled:cursor-not-allowed"
            disabled={componentDisabled || files.length === 0 || isReadingFiles}
          >
            {isReadingFiles ? 'Preparing...' : isExtracting ? 'Extracting...' : 'Extract Data'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TemplateReviewAndUpload;