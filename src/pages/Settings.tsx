import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../lib/store';
import { 
  setPrefetchCount, 
  setDailyQuestionTarget,
  addQuestionKeyword,
  removeQuestionKeyword 
} from '../lib/store/settingsSlice';

export default function Settings() {
  const dispatch = useAppDispatch();
  const { prefetchCount, dailyQuestionTarget, questionKeywords } = useAppSelector(state => state.settings);
  const [newKeyword, setNewKeyword] = useState('');

  const handleAddKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newKeyword.trim()) {
      dispatch(addQuestionKeyword(newKeyword.trim()));
      setNewKeyword('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Settings</h2>
      
      {/* Question Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">Question Settings</h3>
        
        <div className="space-y-6">
          {/* Pre-generated Questions */}
          <div>
            <label htmlFor="prefetchCount" className="block text-sm font-medium mb-2">
              Number of Pre-generated Questions
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                id="prefetchCount"
                min="1"
                max="20"
                value={prefetchCount}
                onChange={(e) => dispatch(setPrefetchCount(Number(e.target.value)))}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-center">
                {prefetchCount}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              How many questions to generate and keep ready for you to answer
            </p>
          </div>

          {/* Daily Question Target */}
          <div>
            <label htmlFor="dailyTarget" className="block text-sm font-medium mb-2">
              Daily Question Target
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                id="dailyTarget"
                min="1"
                max="50"
                value={dailyQuestionTarget}
                onChange={(e) => dispatch(setDailyQuestionTarget(Number(e.target.value)))}
                className="flex-1"
              />
              <span className="text-sm font-medium w-12 text-center">
                {dailyQuestionTarget}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Your daily goal for number of questions to answer
            </p>
          </div>

          {/* Question Keywords */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Question Keywords
            </label>
            <form onSubmit={handleAddKeyword} className="flex gap-2 mb-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Add a keyword"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Add
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {questionKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-100"
                >
                  {keyword}
                  <button
                    onClick={() => dispatch(removeQuestionKeyword(keyword))}
                    className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-700 focus:outline-none"
                  >
                    <span className="sr-only">Remove keyword</span>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Keywords to focus on when generating questions from papers
            </p>
          </div>
        </div>
      </div>

      {/* Other Settings Coming Soon */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">More Settings Coming Soon</h3>
        <ul className="list-disc list-inside space-y-2 text-gray-600 dark:text-gray-300">
          <li>Paper search filters</li>
          <li>Dark mode preferences</li>
          <li>Notification settings</li>
        </ul>
      </div>
    </div>
  );
}
