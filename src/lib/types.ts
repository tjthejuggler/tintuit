export interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  doi?: string;
  publishedDate: string;
  journal: string;
  topics: string[];
  citations?: number;
  methodology?: string;
  findings: string[];
  limitations?: string[];
  date: string; // For indexedDB sorting
}

export interface Question {
  id: string;
  paperId: string;
  text: string;
  type: 'methodology' | 'findings' | 'implications' | 'limitations' | 'predictive';
  context?: string;
  userResponse?: {
    confidence: number;
    timestamp: string;
    notes?: string;
  };
  correctAnswer: string;
  detailedExplanation: string;
  tags?: string[];
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  fontSize: 'small' | 'medium' | 'large';
  notificationsEnabled: boolean;
  autoSync: boolean;
  preferredTopics: string[];
  prefetchCount: number;
  reviewInterval: number;
  dailyQuestionTarget: number;
}

export interface UserStats {
  questionsAnswered: number;
  averageConfidence: number;
  topicAccuracy: Record<string, number>;
  streak: number;
  lastActive: string;
  completedPapers: string[];
  topicsExplored: string[];
  timeSpent: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface SearchFilters {
  topics?: string[];
  authors?: string[];
  dateRange?: DateRange;
  journals?: string[];
  minCitations?: number;
}

export type ConfidenceLevel = 1 | 2 | 3 | 4 | 5;

export interface QuestionResponse {
  questionId: string;
  confidence: ConfidenceLevel;
  timestamp: string;
  notes?: string;
}

export interface StudySession {
  id: string;
  startTime: string;
  endTime?: string;
  questionsAnswered: Question[];
  averageConfidence: number;
  topics: string[];
}

export interface TopicProgress {
  topic: string;
  questionsAnswered: number;
  averageConfidence: number;
  accuracy: number;
  lastStudied: string;
}

export interface DailyStreak {
  current: number;
  longest: number;
  lastActive: string;
  history: Array<{
    date: string;
    questionsAnswered: number;
    averageConfidence: number;
  }>;
}
