import React from 'react';

interface LoaderProps {
  message: string;
  progress?: number | null;
}

const Loader: React.FC<LoaderProps> = ({ message, progress }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-800/80 rounded-lg shadow-md w-full max-w-md">
      <div className="w-12 h-12 border-4 border-t-blue-500 border-gray-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-lg font-semibold text-gray-200 text-center">{message}</p>
      {progress !== null && progress !== undefined && (
        <div className="w-full mt-4 bg-gray-600 rounded-full h-2.5">
          <div 
            className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default Loader;