import { useEffect, useState } from 'react';
import { useAppSelector } from '../lib/store';
import { StudySession } from '../components/StudySession';
import api from '../lib/api';
import { getQuestions, getStats } from '../lib/db';
import type { Question, Paper } from '../lib/types';
import { logger } from '../lib/utils/logger';

type QuestionWithPaper = Question & { 
  paper?: Paper;
  userAnswers?: Array<{
    answer: string;
    isCorrect: boolean;
    confidence: number;
    timestamp: string;
  }>;
  lastAnswered?: string;
};

export default function Questions() {
  const papers = useAppSelector(state => state.papers.papers);
  const [questions, setQuestions] = useState<QuestionWithPaper[]>([]);
  const [stats, setStats] = useState<{
    questionsAnswered: number;
    averageConfidence: number;
    topicAccuracy: Record<string, number>;
  } | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null);
  const [filter, setFilter] = useState<{
    paper?: string;
    type?: Question['type'];
    answered?: boolean;
    correctness?: 'correct' | 'incorrect';
    topic?: string;
    searchTerm?: string;
  }>({});

  // Get unique topics from questions
  const topics = [...new Set(questions.flatMap(q => q.tags || []))].sort();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load papers if needed
    if (papers.length === 0) {
      api.papers.fetch({}).catch(error => {
        logger.error('Failed to fetch papers:', error);
        setError('Failed to load papers. Please try again.');
      });
    }
  }, [papers.length]);

  useEffect(() => {
    // Load all questions and stats
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        logger.info('Loading questions and stats');

        const [allQuestions, questionStats] = await Promise.all([
          getQuestions(),
          getStats()
        ]);

        // Find an unused question if available
        const unusedQuestions = allQuestions.filter(q => 
          !questionStats?.questionHistory?.some(h => h.questionId === q.id)
        );

        // If we have an unused question, show it immediately
        if (unusedQuestions.length > 0) {
          const randomIndex = Math.floor(Math.random() * unusedQuestions.length);
          const selectedQ = unusedQuestions[randomIndex];
          const paper = papers.find(p => p.id === selectedQ.paperId);
          if (paper) {
            setSelectedQuestion(selectedQ);
            setLoading(false);
            
            // Continue loading the rest in the background
            enrichAndSetQuestions(allQuestions, papers);
            if (questionStats) {
              setStats({
                questionsAnswered: questionStats.questionsAnswered,
                averageConfidence: questionStats.averageConfidence,
                topicAccuracy: questionStats.topicAccuracy
              });
            }
            return;
          }
        }

        // If no unused questions or paper not found, load everything
        await enrichAndSetQuestions(allQuestions, papers);
        if (questionStats) {
          setStats({
            questionsAnswered: questionStats.questionsAnswered,
            averageConfidence: questionStats.averageConfidence,
            topicAccuracy: questionStats.topicAccuracy
          });
        }
        logger.info('Successfully loaded questions and stats');
      } catch (error) {
        logger.error('Error loading questions:', error);
        setError('Failed to load questions. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [papers]);

  // Helper function to enrich questions with paper data
  const enrichAndSetQuestions = async (questions: Question[], papers: Paper[]) => {
    const enrichedQuestions = await Promise.all(
      questions.map(async q => {
        try {
          const paper = papers.find(p => p.id === q.paperId) || 
                       await api.papers.getById(q.paperId).catch(() => undefined);
          return { ...q, paper };
        } catch (error) {
          logger.warn(`Failed to enrich question ${q.id} with paper data:`, error);
          return { ...q };
        }
      })
    );
    setQuestions(enrichedQuestions);
  };

  const filteredQuestions = questions.filter(q => {
    if (filter.paper && q.paperId !== filter.paper) return false;
    if (filter.type && q.type !== filter.type) return false;
    if (filter.answered !== undefined) {
      const hasAnswers = (q.userAnswers?.length || 0) > 0;
      if (filter.answered !== hasAnswers) return false;
    }
    if (filter.correctness) {
      const lastAnswer = q.userAnswers?.slice(-1)[0];
      if (!lastAnswer) return false;
      if (filter.correctness === 'correct' && !lastAnswer.isCorrect) return false;
      if (filter.correctness === 'incorrect' && lastAnswer.isCorrect) return false;
    }
    if (filter.topic) {
      if (!q.tags?.includes(filter.topic)) return false;
    }
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      return (
        q.text.toLowerCase().includes(term) ||
        q.correctAnswer.toLowerCase().includes(term) ||
        q.paper?.title.toLowerCase().includes(term) ||
        q.tags?.some(t => t.toLowerCase().includes(term))
      );
    }
    return true;
  });

  const questionsByPaper = filteredQuestions.reduce((acc, q) => {
    const paperId = q.paperId;
    if (!acc[paperId]) acc[paperId] = [];
    acc[paperId].push(q);
    return acc;
  }, {} as Record<string, QuestionWithPaper[]>);

  if (selectedQuestion) {
    return (
      <div>
        <button 
          onClick={() => setSelectedQuestion(null)}
          className="mb-4 text-blue-500 hover:text-blue-600"
        >
          ← Back to Questions
        </button>
        <StudySession 
          paper={papers.find(p => p.id === selectedQuestion.paperId)!} 
          initialQuestion={selectedQuestion}
          onError={(error) => {
            logger.error('Study session error:', error);
            setError('An error occurred during the study session. Please try again.');
            setSelectedQuestion(null);
          }}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-4"></div>
        <div className="text-gray-600 dark:text-gray-400">Loading questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-100 p-4 rounded-lg mb-4">
          {error}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-500 hover:text-blue-600"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      {/* Stats Overview */}
      {stats && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <h2 className="text-lg font-semibold mb-4">Progress Overview</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-gray-500">Questions Answered</div>
              <div className="text-2xl font-bold">{stats.questionsAnswered}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Average Confidence</div>
              <div className="text-2xl font-bold">
                {Math.round(stats.averageConfidence)}%
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Topics Mastered</div>
              <div className="text-2xl font-bold">
                {Object.values(stats.topicAccuracy).filter(acc => acc >= 80).length}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search questions..."
            className="flex-1 p-2 border rounded dark:bg-gray-700"
            value={filter.searchTerm || ''}
            onChange={e => setFilter(f => ({ ...f, searchTerm: e.target.value }))}
          />
          <select
            className="p-2 border rounded dark:bg-gray-700"
            value={filter.type || ''}
            onChange={e => setFilter(f => ({ ...f, type: e.target.value as Question['type'] || undefined }))}
          >
            <option value="">All Types</option>
            <option value="findings">Findings</option>
            <option value="methodology">Methodology</option>
            <option value="implications">Implications</option>
            <option value="limitations">Limitations</option>
          </select>
          <select
            className="p-2 border rounded dark:bg-gray-700"
            value={filter.answered === undefined ? '' : filter.answered.toString()}
            onChange={e => setFilter(f => ({ 
              ...f, 
              answered: e.target.value === '' ? undefined : e.target.value === 'true'
            }))}
          >
            <option value="">All Questions</option>
            <option value="true">Answered</option>
            <option value="false">Unanswered</option>
          </select>

          <select
            className="p-2 border rounded dark:bg-gray-700"
            value={filter.correctness || ''}
            onChange={e => setFilter(f => ({ 
              ...f, 
              correctness: e.target.value as 'correct' | 'incorrect' | undefined
            }))}
          >
            <option value="">All Results</option>
            <option value="correct">Correct Answers</option>
            <option value="incorrect">Incorrect Answers</option>
          </select>

          {topics.length > 0 && (
            <select
              className="p-2 border rounded dark:bg-gray-700"
              value={filter.topic || ''}
              onChange={e => setFilter(f => ({ ...f, topic: e.target.value || undefined }))}
            >
              <option value="">All Topics</option>
              {topics.map(topic => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {Object.entries(questionsByPaper).length === 0 ? (
          <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow">
            <p className="text-gray-500 dark:text-gray-400">
              No questions found. Try adjusting your filters or adding more papers.
            </p>
          </div>
        ) : (
          Object.entries(questionsByPaper).map(([paperId, questions]) => {
            const paper = questions[0].paper;
            return (
              <div key={paperId} className="bg-white dark:bg-gray-800 rounded-lg shadow">
                <div className="p-4 border-b dark:border-gray-700">
                  <h3 className="text-lg font-semibold">
                    {paper?.title || 'Unknown Paper'}
                  </h3>
                  {paper && (
                    <div className="text-sm text-gray-500 mt-1">
                      {paper.authors.join(', ')}
                    </div>
                  )}
                </div>
                <div className="divide-y dark:divide-gray-700">
                  {questions.map(question => {
                    const lastAnswer = question.userAnswers?.slice(-1)[0];
                    return (
                      <div 
                        key={question.id} 
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => setSelectedQuestion(question)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium mb-1">{question.text}</div>
                            <div className="text-sm text-gray-500">
                              Type: {question.type}
                              {question.tags?.length && ` • Tags: ${question.tags.join(', ')}`}
                            </div>
                          </div>
                          {lastAnswer && (
                            <div className={`text-sm px-2 py-1 rounded ${
                              lastAnswer.isCorrect 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' 
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                            }`}>
                              {lastAnswer.isCorrect ? 'Correct' : 'Incorrect'}
                            </div>
                          )}
                        </div>
                        {lastAnswer && (
                          <div className="mt-2 text-sm text-gray-500">
                            Last answered {new Date(lastAnswer.timestamp).toLocaleDateString()} 
                            with confidence level {lastAnswer.confidence}/5
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
