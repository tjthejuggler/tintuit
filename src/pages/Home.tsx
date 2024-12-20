import { useEffect, useState } from 'react';
import { useAppSelector } from '../lib/store';
import { StudySession } from '../components/StudySession';
import { getQuestions } from '../lib/db';
import type { Question, Paper } from '../lib/types';
import api from '../lib/api';

export default function Home() {
  const { papers, loading, error, isOnline } = useAppSelector(state => state.papers);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentPaper, setCurrentPaper] = useState<Paper | null>(null);
  const [availableQuestions, setAvailableQuestions] = useState<number>(0);

  // Track available questions
  useEffect(() => {
    const checkAvailableQuestions = async () => {
      try {
        const questions = await getQuestions();
        const unanswered = questions.filter(q => !q.userResponse);
        setAvailableQuestions(unanswered.length);
      } catch (error) {
        console.error('Failed to check available questions:', error);
      }
    };

    checkAvailableQuestions();
  }, [currentQuestion]);
  const { dailyQuestionTarget } = useAppSelector(state => state.settings);
  const { questionsAnswered, streak } = useAppSelector(state => state.stats);

  // Load or generate questions as needed
  useEffect(() => {
    const loadNextQuestion = async () => {
      try {
        // First try to find a paper with existing questions
        const paperWithQuestions = await api.papers.findPaperWithQuestions();
        if (paperWithQuestions) {
          const paper = papers.find(p => p.id === paperWithQuestions.paperId);
          if (paper && paperWithQuestions.questions.length > 0) {
            setCurrentQuestion(paperWithQuestions.questions[0]);
            setCurrentPaper(paper);
            return;
          }
        }

        // If no existing questions found and we have papers, generate new ones
        if (papers.length > 0) {
          // Pick a random paper that doesn't have questions yet
          const availablePapers = papers.filter(p => !paperWithQuestions?.paperId || p.id !== paperWithQuestions.paperId);
          if (availablePapers.length > 0) {
            const randomPaper = availablePapers[Math.floor(Math.random() * availablePapers.length)];
            
            // Generate questions for this paper
            await api.papers.generateQuestionsIfNeeded(randomPaper.id, 5);
            const questions = await api.papers.getQuestionsForPaper(randomPaper.id);
            
            if (questions.length > 0) {
              setCurrentQuestion(questions[0]);
              setCurrentPaper(randomPaper);
            }
          }
        }
      } catch (error) {
        console.error('Failed to load next question:', error);
      }
    };

    if (!currentQuestion) {
      loadNextQuestion();
    }
  }, [currentQuestion, papers]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
            Train Your Research Intuition
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
            Predict research outcomes before seeing the results. Build your scientific intuition through practice.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Daily Progress</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {questionsAnswered}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                / {dailyQuestionTarget} questions
              </span>
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Streak</p>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-3xl font-semibold text-gray-900 dark:text-white">
                {streak}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">days</span>
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
            <div className="mt-2 space-y-2">
              <p className="flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    isOnline ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                />
                <span className="text-sm text-gray-900 dark:text-white">
                  {isOnline ? 'Online' : 'Offline (cached questions available)'}
                </span>
              </p>
              <p className="text-sm text-gray-900 dark:text-white">
                {availableQuestions} questions ready
              </p>
            </div>
          </div>
        </div>

        {/* Study Session */}
        <div className="w-full">
          {currentPaper && currentQuestion ? (
            <StudySession 
              paper={currentPaper}
              initialQuestion={currentQuestion}
              onComplete={() => {
                // Clear current question to load a new one
                setCurrentQuestion(null);
                setCurrentPaper(null);
              }}
              onError={(error) => {
                console.error('Study session error:', error);
              }}
            />
          ) : loading ? (
            <div className="text-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading next question...</p>
            </div>
          ) : (
            <div className="text-center p-8">
              <p className="text-gray-600 dark:text-gray-400">
                Preparing your next question...
              </p>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/50">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error
                </h3>
                <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
