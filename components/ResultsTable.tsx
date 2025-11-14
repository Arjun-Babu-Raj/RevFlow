import React from 'react';
import type { ExtractedDataRow } from '../types';

interface ResultsTableProps {
  data: ExtractedDataRow[];
  onStartOver: () => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ data, onStartOver }) => {

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

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="min-w-full divide-y-2 divide-gray-700 bg-gray-800 text-base">
          <thead className="bg-gray-900/75">
            <tr>
              {headers.map(header => (
                <th key={header} className="whitespace-nowrap px-6 py-4 font-semibold text-gray-200 text-left">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {data.map((row, index) => (
              <tr key={index} className="hover:bg-gray-700/50">
                {headers.map(header => (
                  <td key={`${index}-${header}`} className="whitespace-pre-wrap px-6 py-4 text-gray-300 align-top">{row[header]}</td>
                ))}
              </tr>
            ))}
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