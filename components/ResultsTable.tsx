import React from 'react';
import type { ExtractedDataRow } from '../types';

interface ResultsTableProps {
  data: ExtractedDataRow[];
  onStartOver: () => void;
  onReExtract: () => void;
  isExtracting: boolean;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, onStartOver, onReExtract, isExtracting }) => {

  const convertToCSV = (dataToConvert: ExtractedDataRow[]): string => {
    if (dataToConvert.length === 0) return '';
    
    const headers = Object.keys(dataToConvert[0]);
    const csvRows = [headers.join(',')];

    for (const row of dataToConvert) {
      const values = headers.map(header => {
        const escaped = ('' + row[header]).replace(/"/g, '""');
        return `"${escaped}"`;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  };

  const downloadCSV = () => {
    const csvString = convertToCSV(data);
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'extracted_data.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  if (!data || data.length === 0) {
    return (
        <div className="text-center py-10">
            <h2 id="results-heading" className="text-3xl font-bold mb-4 text-gray-200">No Data Extracted</h2>
            <p className="text-lg text-gray-400 mb-8">Something went wrong during the extraction process.</p>
            <button onClick={onStartOver} className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 text-lg">
                Start Over
            </button>
        </div>
    );
  }

  // Calculate statistics
  const successCount = data.filter(row => row.status === 'success').length;
  const failedCount = data.filter(row => row.status === 'failed').length;
  const totalCount = data.length;
  const hasFailedArticles = failedCount > 0;

  const headers = Object.keys(data[0]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
        <h2 id="results-heading" className="text-3xl font-bold text-gray-200">4. Extraction Results</h2>
        <button
            onClick={downloadCSV}
            className="bg-green-600 text-white font-bold py-3 px-6 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-green-500 transition text-lg"
        >
            Download CSV
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="mb-6 p-4 bg-gray-700/50 rounded-lg border border-gray-600">
        <div className="flex flex-wrap gap-6 items-center justify-center text-lg">
          <div className="flex items-center gap-2">
            <span className="text-gray-300">Successfully extracted:</span>
            <span className="font-bold text-green-400">{successCount} of {totalCount}</span>
            <span className="text-gray-400">articles</span>
          </div>
          {hasFailedArticles && (
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Failed:</span>
              <span className="font-bold text-red-400">{failedCount}</span>
              <span className="text-gray-400">articles</span>
            </div>
          )}
        </div>
      </div>

      {/* Re-extract Failed Articles Button */}
      {hasFailedArticles && (
        <div className="mb-6 flex justify-center">
          <button
            onClick={onReExtract}
            disabled={isExtracting}
            className="bg-yellow-600 text-white font-bold py-3 px-6 rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-yellow-500 transition text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isExtracting ? 'Re-extracting...' : 'Re-extract Failed Articles'}
          </button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full divide-y-2 divide-gray-700 bg-gray-800 text-base">
          <thead className="bg-gray-900/75">
            <tr>
              {/* Status column first */}
              <th className="whitespace-nowrap px-6 py-4 font-semibold text-gray-200 text-left">Status</th>
              {headers.filter(h => h !== 'status' && h !== 'errorMessage' && h !== 'attemptCount').map(header => (
                <th key={header} className="whitespace-nowrap px-6 py-4 font-semibold text-gray-200 text-left">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((row, index) => {
              const isSuccess = row.status === 'success';
              const rowClassName = `hover:bg-gray-700/50 ${isSuccess ? 'bg-green-900/20' : 'bg-red-900/20'}`;
              
              return (
                <tr key={index} className={rowClassName}>
                  {/* Status cell with icon */}
                  <td className="whitespace-nowrap px-6 py-4 text-gray-300 align-top">
                    <div className="flex items-center gap-2">
                      {isSuccess ? (
                        <>
                          <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                          <span className="text-green-400 font-medium">Success</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                          </svg>
                          <div className="flex flex-col">
                            <span className="text-red-400 font-medium">Failed</span>
                            {row.errorMessage && (
                              <span className="text-xs text-gray-400 mt-1" title={row.errorMessage}>
                                {row.errorMessage.length > 30 ? row.errorMessage.substring(0, 30) + '...' : row.errorMessage}
                              </span>
                            )}
                            {row.attemptCount && (
                              <span className="text-xs text-gray-500 mt-1">
                                Attempts: {row.attemptCount}
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                  {headers.filter(h => h !== 'status' && h !== 'errorMessage' && h !== 'attemptCount').map(header => (
                    <td key={`${index}-${header}`} className="whitespace-pre-wrap px-6 py-4 text-gray-300 align-top">{row[header]}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

       <div className="mt-10 text-center">
            <button
                onClick={onStartOver}
                className="bg-blue-600 text-white font-bold py-3 px-8 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition text-lg"
            >
                Start New Review
            </button>
       </div>
    </div>
  );
};

export default ResultsTable;