import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../lib/store';
import type { Paper } from '../lib/types';
import { StudySession } from './StudySession';

const PaperCard: React.FC<{ paper: Paper }> = ({ paper }) => {
  const [showStudySession, setShowStudySession] = useState(false);

  if (showStudySession) {
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <button
          onClick={() => setShowStudySession(false)}
          className="mb-4 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          ← Back to Paper
        </button>
        <StudySession paper={paper} onComplete={() => setShowStudySession(false)} />
      </div>
    );
  }

  return (
  <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
      {paper.title}
    </h3>
    <div className="mb-2 text-sm text-gray-600 dark:text-gray-400">
      {paper.authors.join(', ')}
    </div>
    <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
      Published: {new Date(paper.publishedDate).toLocaleDateString()}
      {paper.citations !== undefined && ` • Citations: ${paper.citations}`}
    </div>
    <p className="mb-4 text-gray-700 dark:text-gray-300 line-clamp-3">
      {paper.abstract}
    </p>
    <div className="flex flex-wrap gap-2 mb-4">
      {paper.topics.map((topic, index) => (
        <span
          key={index}
          className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full"
        >
          {topic}
        </span>
      ))}
    </div>
    <div className="flex justify-between items-center">
      <div className="flex gap-4">
        <a
          href={paper.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
        >
          View on arXiv →
        </a>
        <button
          onClick={() => setShowStudySession(true)}
          className="text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300 text-sm"
        >
          Start Study Session →
        </button>
      </div>
      {paper.findings.length > 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {paper.findings.length} key findings
        </span>
      )}
    </div>
  </div>
  );
};

const PaperList: React.FC = () => {
  const { papers, loading } = useSelector((state: RootState) => state.papers);

  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-200 dark:bg-gray-700 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4 text-center text-gray-600 dark:text-gray-400">
        No papers found. Try searching for a different topic.
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="space-y-4">
        {papers.map((paper) => (
          <PaperCard key={paper.id} paper={paper} />
        ))}
      </div>
    </div>
  );
};

export default PaperList;
