import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../lib/store';
import { Paper, Question } from '../lib/types';
import { saveQuestion, saveQuestionFeedback, getQuestions } from '../lib/db';
import { incrementQuestionsAnswered, updateAverageConfidence, updateStreak, updateTopicAccuracy, loadStats, persistStats } from '../lib/store/statsSlice';
import api from '../lib/api';
import { logger } from '../lib/utils/logger';
import { addNoteToAnki } from '../lib/utils/anki';

interface StudySessionProps {
  paper: Paper;
  initialQuestion?: Question;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

export const StudySession: React.FC<StudySessionProps> = ({ paper, initialQuestion, onComplete, onError }) => {
  const dispatch = useAppDispatch();
  const stats = useAppSelector(state => state.stats);

  // Load stats on mount
  useEffect(() => {
    dispatch(loadStats());
  }, [dispatch]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(initialQuestion || null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{
    isCorrect?: boolean;
    score?: number;
    feedback?: string;
    suggestedAnswer?: string;
  } | null>(null);
  const [showingFeedback, setShowingFeedback] = useState(false);
  const [confidence, setConfidence] = useState<number>(50);
  const [questionFeedback, setQuestionFeedback] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [followupQuestion, setFollowupQuestion] = useState('');
  const [followupAnswer, setFollowupAnswer] = useState<string | null>(null);
  const [ankiStatus, setAnkiStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [retryStatus, setRetryStatus] = useState<{
    attempt: number;
    maxAttempts: number;
    nextRetry: number;
  } | null>(null);
  const [timeoutStatus, setTimeoutStatus] = useState<{
    remaining: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    if (timeoutStatus && timeoutStatus.remaining > 0) {
      const timer = setInterval(() => {
        setTimeoutStatus(prev => prev ? {
          ...prev,
          remaining: prev.remaining - 1
        } : null);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeoutStatus]);

  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    // Load questions when component mounts
    const loadQuestions = async () => {
      try {
        if (!mounted) return;
        setLoading(true);
        setRetryStatus(null);

        // First try to find a paper with existing questions
        if (!initialQuestion && !paper) {
          const paperWithQuestions = await api.papers.findPaperWithQuestions();
          if (paperWithQuestions) {
            // TODO: Update paper selection in parent component
            if (paperWithQuestions.questions.length > 0) {
              setAllQuestions(paperWithQuestions.questions);
              setCurrentQuestion(paperWithQuestions.questions[currentQuestionIndex]);
              return;
            }
          }
        }
        
        // If we have a specific paper, first try to use existing questions
        if (paper) {
          // Get all questions for this paper
          const allPaperQuestions = await getQuestions(paper.id);
          
          // Filter out questions that have been answered
          const unusedQuestions = allPaperQuestions.filter(q => 
            !stats.questionHistory.some(h => h.questionId === q.id)
          );

          // If we have unused questions, use them immediately
          if (unusedQuestions.length > 0) {
            setAllQuestions(unusedQuestions);
            setCurrentQuestion(unusedQuestions[currentQuestionIndex]);
            setLoading(false);

            // Start background generation if we're running low on questions
            if (unusedQuestions.length < 5) {
              api.papers.generateQuestionsIfNeeded(paper.id, 5 - unusedQuestions.length)
                .catch(error => {
                  console.error('Background question generation failed:', error);
                });
            }
          } else {
            // Only generate new questions if we have none available
            await api.papers.generateQuestionsIfNeeded(paper.id, 5);
            const newQuestions = await api.papers.getQuestionsForPaper(paper.id);
            const newUnusedQuestions = newQuestions.filter(q => 
              !stats.questionHistory.some(h => h.questionId === q.id)
            );
            if (newUnusedQuestions.length > 0) {
              setAllQuestions(newUnusedQuestions);
              setCurrentQuestion(newUnusedQuestions[currentQuestionIndex]);
            }
          }
        }

      } catch (error) {
        if (!mounted) return;
        console.error('Error loading questions:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to load questions'));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };

    // Load questions if we don't have any or if we're switching papers
    if ((!initialQuestion && allQuestions.length === 0) || 
        (allQuestions.length > 0 && paper && allQuestions[0].paperId !== paper.id)) {
      loadQuestions();
    } else if (initialQuestion) {
      // If we have an initial question, use it
      setAllQuestions([initialQuestion]);
      setCurrentQuestion(initialQuestion);
    }

    return () => {
      mounted = false;
    };
  }, [paper?.id, initialQuestion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentQuestion || !userAnswer) return;

    try {
      setLoading(true);
      const evaluation = await api.papers.validateAnswer({
        paperId: paper.id,
        questionId: currentQuestion.id,
        answer: userAnswer
      });
      setFeedback(evaluation);
      setShowingFeedback(true);

      // Save response to IndexedDB
      await saveQuestion({
        ...currentQuestion,
        userResponse: {
          confidence,
          timestamp: new Date().toISOString(),
          notes: userAnswer
        }
      });

      // Update stats in Redux store
      dispatch(incrementQuestionsAnswered());
      dispatch(updateStreak());
      dispatch(updateAverageConfidence(confidence));
      
      // If the question has tags and we have accuracy info, update topic accuracy
      if (currentQuestion.tags && evaluation.isCorrect !== undefined) {
        currentQuestion.tags.forEach(topic => {
          dispatch(updateTopicAccuracy({ 
            topic, 
            accuracy: evaluation.isCorrect ? 100 : 0 
          }));
        });
      }

      // Persist stats to IndexedDB
      dispatch(persistStats());

      } catch (error) {
        console.error('Error validating answer:', error);
        onError?.(error instanceof Error ? error : new Error('Failed to validate answer'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        {retryStatus && (
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Rate limit reached. Retrying in {Math.ceil(retryStatus.nextRetry)} seconds...</p>
            <p>Attempt {retryStatus.attempt} of {retryStatus.maxAttempts}</p>
          </div>
        )}
        {timeoutStatus && (
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p>Generating questions... {timeoutStatus.remaining}s remaining</p>
            <div className="w-48 h-2 bg-gray-200 rounded-full mt-2">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ 
                  width: `${(timeoutStatus.remaining / timeoutStatus.total) * 100}%` 
                }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="text-center p-4">
        <div className="mb-4">No questions available</div>
        <button
          onClick={() => logger.downloadLogs()}
          className="text-sm text-blue-500 hover:text-blue-600"
        >
          Download Debug Logs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-lg font-semibold">{currentQuestion.text}</h3>
          <span className="text-sm text-gray-500">
            Question {currentQuestionIndex + 1} of {allQuestions.length}
          </span>
        </div>
        {currentQuestion.context && (
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4 text-sm">
            <h4 className="font-medium mb-2">Context:</h4>
            <p>{currentQuestion.context}</p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="answer" className="block text-sm font-medium mb-2">
            Your Answer:
          </label>
          {currentQuestion.type === 'predictive' ? (
            <div className="space-y-2">
              <select
                id="answer"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="w-full p-2 border rounded-lg dark:bg-gray-700"
                required
              >
                <option value="">Select your answer...</option>
                <option value="increased">increased</option>
                <option value="decreased">decreased</option>
                <option value="unchanged">unchanged</option>
              </select>
              <div className="text-sm text-gray-500">
                <span>Choose how the value changed</span>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                id="answer"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="w-full p-2 border rounded-lg dark:bg-gray-700 min-h-[100px]"
                placeholder="Enter your answer..."
                required
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="confidence" className="block text-sm font-medium mb-2">
            Confidence Level:
          </label>
          <input
            type="range"
            id="confidence"
            min="0"
            max="100"
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-gray-500">
            <span>0%</span>
            <span>{confidence}%</span>
            <span>100%</span>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !userAnswer || showingFeedback}
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          {showingFeedback ? 'Answer Submitted' : 'Submit Answer'}
        </button>
      </form>

      {feedback && (
        <div className={`mt-6 p-4 rounded-lg ${
          feedback.isCorrect ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900'
        }`}>
          <h4 className="font-medium mb-2">
            {feedback.isCorrect ? 'Correct!' : 'Needs Improvement'}
          </h4>
          <p className="mb-2">{feedback.feedback}</p>
          {!feedback.isCorrect && feedback.suggestedAnswer && (
            <div className="mt-4">
              <h5 className="font-medium mb-1">Suggested Answer:</h5>
              <p>{feedback.suggestedAnswer}</p>
            </div>
          )}
          <div className="mt-4 space-y-4">
            <div>
              <span className="text-sm font-medium">Score: </span>
              <span className="text-sm">{feedback.score}/100</span>
            </div>

            {/* Send to Anki Button */}
            <div className="mb-4">
              <button
                onClick={async () => {
                  if (!currentQuestion || !feedback) return;
                  
                  const front = currentQuestion.text;
                  const back = feedback.isCorrect 
                    ? userAnswer 
                    : feedback.suggestedAnswer || userAnswer;
                  
                  setAnkiStatus('idle');
                  const success = await addNoteToAnki(front, back);
                  setAnkiStatus(success ? 'success' : 'error');
                }}
                className="w-full bg-purple-500 text-white py-2 px-4 rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center space-x-2"
                disabled={ankiStatus === 'success'}
              >
                <span>
                  {ankiStatus === 'idle' && 'Send to Anki'}
                  {ankiStatus === 'success' && '✓ Added to Anki'}
                  {ankiStatus === 'error' && '❌ Failed to add to Anki'}
                </span>
              </button>
            </div>

            {/* Question Feedback */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Question Feedback:
                </label>
                <div className="space-y-2">
                  {['too_specific', 'not_predictive', 'references_paper', 'unclear'].map((type) => (
                    <button
                      key={type}
                      onClick={async () => {
                        if (!currentQuestion) return;
                        await saveQuestionFeedback(currentQuestion.id, {
                          type: type as 'too_specific' | 'not_predictive' | 'references_paper' | 'unclear'
                        });
                        setQuestionFeedback(`Reported as ${type.replace('_', ' ')}`);
                      }}
                      className="w-full text-left px-4 py-2 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      {type === 'too_specific' && "❌ This question is too specific to the paper"}
                      {type === 'not_predictive' && "❌ This isn't testing predictive understanding"}
                      {type === 'references_paper' && "❌ This references specific paper details/results"}
                      {type === 'unclear' && "❌ The question is unclear or confusing"}
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <label htmlFor="feedback" className="block text-sm font-medium mb-2">
                  Additional Comments (optional):
                </label>
                <div className="space-y-2">
                  <textarea
                    id="feedback"
                    value={questionFeedback}
                    onChange={(e) => setQuestionFeedback(e.target.value)}
                    placeholder="Any other feedback about this question?"
                    className="w-full h-24 p-2 border rounded-lg dark:bg-gray-700"
                  />
                  {questionFeedback && (
                    <button
                      onClick={async () => {
                        if (!currentQuestion) return;
                        await saveQuestionFeedback(currentQuestion.id, {
                          type: 'other',
                          comment: questionFeedback
                        });
                        setQuestionFeedback('Feedback submitted');
                      }}
                      className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
                    >
                      Submit Additional Feedback
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Followup Question Section */}
            {showingFeedback && (
              <div className="mt-4 space-y-4">
                <div>
                  <label htmlFor="followup" className="block text-sm font-medium mb-2">
                    Ask a followup question:
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      id="followup"
                      value={followupQuestion}
                      onChange={(e) => setFollowupQuestion(e.target.value)}
                      placeholder="Ask for more explanation..."
                      className="flex-1 p-2 border rounded-lg dark:bg-gray-700"
                    />
                    <button
                      onClick={async () => {
                        if (!currentQuestion || !followupQuestion.trim()) return;
                        setLoading(true);
                        try {
                          const response = await api.askFollowup({
                            paperId: paper.id,
                            questionId: currentQuestion.id,
                            question: followupQuestion
                          });
                          setFollowupAnswer(response.answer);
                          setFollowupQuestion('');
                        } catch (error) {
                          console.error('Error asking followup:', error);
                          onError?.(error instanceof Error ? error : new Error('Failed to get followup answer'));
                        } finally {
                          setLoading(false);
                        }
                      }}
                      disabled={loading || !followupQuestion.trim()}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    >
                      Ask
                    </button>
                  </div>
                </div>

                {followupAnswer && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <h5 className="font-medium mb-2">Additional Explanation:</h5>
                    <p className="text-sm">{followupAnswer}</p>
                  </div>
                )}
              </div>
            )}

            {/* Next Question Button */}
            {showingFeedback && (
              <button
                onClick={() => {
                  // Save feedback if provided
                  if (questionFeedback.trim()) {
                    // TODO: Save feedback
                    console.log('Question feedback:', questionFeedback);
                  }
                  
                  // Move to next question if available
                  const nextIndex = currentQuestionIndex + 1;
                  if (nextIndex < allQuestions.length) {
                    setCurrentQuestionIndex(nextIndex);
                    setCurrentQuestion(allQuestions[nextIndex]);
                    setUserAnswer('');
                    setFeedback(null);
                    setQuestionFeedback('');
                    setShowingFeedback(false);
                  } else {
                    onComplete?.();
                  }
                }}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600"
              >
                {currentQuestionIndex < allQuestions.length - 1 ? 'Next Question' : 'Finish'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
