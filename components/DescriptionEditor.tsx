import React, { useState } from 'react';

interface DescriptionEditorProps {
  initialDescription: string;
  onGenerateTemplate: (description: string) => void;
  disabled: boolean;
}

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  initialDescription,
  onGenerateTemplate,
  disabled,
}) => {
  const [description, setDescription] = useState(initialDescription);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      onGenerateTemplate(description);
    }
  };

  return (
    <div>
      <h2 id="description-heading" className="text-3xl font-bold mb-4 text-gray-200">2. Refine the Description</h2>
      <p className="text-lg text-gray-400 mb-6">
        Here's a draft description for your review. Feel free to edit it to better match your scope. This description will be used to create the data extraction template.
      </p>
      <form onSubmit={handleSubmit}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={10}
          className="w-full p-4 text-base bg-gray-700 text-gray-100 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition disabled:bg-gray-700/50 disabled:cursor-not-allowed"
          disabled={disabled}
          aria-label="Review description"
        />
        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white font-bold py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition disabled:bg-blue-800/50 disabled:cursor-not-allowed text-lg"
            disabled={disabled || !description.trim()}
          >
            Generate Template
          </button>
        </div>
      </form>
    </div>
  );
};

export default DescriptionEditor;