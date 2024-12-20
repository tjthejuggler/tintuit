import { useAppSelector } from '../lib/store';
import { Question } from '../lib/types';

export default function Stats() {
  const stats = useAppSelector(state => state.stats);
  const { papers, questions } = useAppSelector(state => state.papers);

  // Group questions by paper ID
  const questionsByPaper = questions.reduce((acc, q) => {
    if (!acc[q.paperId]) {
      acc[q.paperId] = [];
    }
    acc[q.paperId].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  // Calculate topic mastery percentages
  const topicMastery = Object.entries(stats.topicAccuracy).map(([topic, accuracy]) => ({
    topic,
    accuracy: Math.round(accuracy)
  })).sort((a, b) => b.accuracy - a.accuracy);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Study Statistics</h2>
      
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Questions Answered</h3>
          <p className="text-3xl font-bold text-blue-500">{stats.questionsAnswered}</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Daily Streak</h3>
          <p className="text-3xl font-bold text-green-500">{stats.streak} days</p>
        </div>
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Average Confidence</h3>
          <p className="text-3xl font-bold text-purple-500">{Math.round(stats.averageConfidence)}%</p>
        </div>
      </div>

      {/* Topic Mastery */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">Topic Mastery</h3>
        <div className="space-y-4">
          {topicMastery.map(({ topic, accuracy }) => (
            <div key={topic}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-medium">{topic}</span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{accuracy}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${accuracy}%` }}
                />
              </div>
            </div>
          ))}
          {topicMastery.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">
              No topic mastery data available yet. Answer some questions to see your progress!
            </p>
          )}
        </div>
      </div>

      {/* Papers Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Papers Progress</h3>
        <div className="space-y-4">
          {papers.map((paper) => {
            const paperQuestions = questionsByPaper[paper.id] || [];
            const completedQuestions = paperQuestions.filter(q => q.userResponse);
            
            return (
              <div key={paper.id} className="border-b dark:border-gray-700 pb-4 last:border-0">
                <h4 className="font-medium mb-2">{paper.title}</h4>
                <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span>Questions: {paperQuestions.length}</span>
                  <span>•</span>
                  <span>Completed: {completedQuestions.length}</span>
                </div>
              </div>
            );
          })}
          {papers.length === 0 && (
            <p className="text-gray-600 dark:text-gray-400">
              No papers added yet. Start by searching and adding some papers to study!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
