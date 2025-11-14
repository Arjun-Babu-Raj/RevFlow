import React from 'react';
import { Step } from '../types';
import { STEPS_CONFIG } from '../constants';

interface StepIndicatorProps {
  currentStep: Step;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ currentStep }) => {
  const stepOrder = [Step.TITLE, Step.DESCRIPTION, Step.TEMPLATE_UPLOAD, Step.RESULTS];
  let currentIndex = stepOrder.indexOf(currentStep);

  if (currentStep === Step.EXTRACTING) {
    currentIndex = stepOrder.indexOf(Step.TEMPLATE_UPLOAD);
  }

  return (
    <nav aria-label="Progress">
      <ol role="list" className="space-y-6">
        {STEPS_CONFIG.map((step, stepIdx) => {
          const stepStatus = stepIdx < currentIndex ? 'complete' : stepIdx === currentIndex ? 'current' : 'upcoming';

          return (
            <li key={step.name} className="relative">
              {stepIdx !== STEPS_CONFIG.length - 1 ? (
                 <div
                  className={`absolute left-4 top-5 -ml-px mt-0.5 h-full w-0.5 ${stepStatus === 'complete' ? 'bg-blue-600' : 'bg-gray-600'}`}
                  aria-hidden="true"
                />
              ) : null}
              
              <div className="relative flex items-start group">
                <span className="h-9 flex items-center">
                    {stepStatus === 'complete' ? (
                       <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                         <svg className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                           <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.052-.143z" clipRule="evenodd" />
                         </svg>
                       </span>
                    ) : stepStatus === 'current' ? (
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-blue-600 bg-gray-800">
                        <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                      </span>
                    ) : (
                      <span className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-600 bg-gray-800">
                         <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
                      </span>
                    )}
                </span>
                <span className="ml-4 flex min-w-0 flex-col">
                    <span className={`text-sm font-semibold ${stepStatus === 'current' ? 'text-blue-400' : 'text-gray-200'}`}>{step.name}</span>
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default StepIndicator;