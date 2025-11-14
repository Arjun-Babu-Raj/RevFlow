import React, { useState } from 'react';

interface TitleInputProps {
  initialTitle: string;
  onGenerateDescription: (title: string) => void;
  disabled: boolean;
}

const TitleInput: React.FC<TitleInputProps> = ({ initialTitle, onGenerateDescription, disabled }) => {
  const [title, setTitle] = useState(initialTitle);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() && !disabled) {
      onGenerateDescription(title.trim());
    }
  };

  return (
    <div className="flex flex-col items-center">
      <h2 id="title-heading" className="text-3xl font-bold mb-4 text-gray-200">1. Start Your Review</h2>
      <p className="text-lg text-gray-400 mb-8 text-center max-w-prose">
        Enter the title of your systematic review. Our AI will generate a draft description to get you started.
      </p>
      <form onSubmit={handleSubmit} className="w-full max-w-xl flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., The Efficacy of Mindfulness Interventions..."
          className="flex-grow w-full px-4 py-3 text-lg bg-gray-700 text-gray-100 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition placeholder-gray-400 disabled:bg-gray-700/50 disabled:cursor-not-allowed"
          required
          disabled={disabled}
          aria-label="Systematic review title"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white font-bold py-3 px-8 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200 disabled:bg-blue-800/50 disabled:cursor-not-allowed text-lg"
          disabled={disabled || !title.trim()}
        >
          Generate Description
        </button>
      </form>
    </div>
  );
};

export default TitleInput;