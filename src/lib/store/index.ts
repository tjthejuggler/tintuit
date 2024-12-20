import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import paperReducer from './paperSlice';
import settingsReducer from './settingsSlice';
import statsReducer from './statsSlice';
import { Paper, Question } from '../types';

export interface PaperState {
  papers: Paper[];
  currentPaper: Paper | null;
  loading: boolean;
  error: string | null;
  questions: Question[];
  currentQuestion: Question | null;
  offlineQuestions: Question[];
  isOnline: boolean;
}

export interface SettingsState {
  preferredTopics: string[];
  prefetchCount: number;
  reviewInterval: number;
  dailyQuestionTarget: number;
  questionKeywords: string[];
}

export interface StatsState {
  questionsAnswered: number;
  averageConfidence: number;
  topicAccuracy: Record<string, number>;
  streak: number;
  lastActive: string;
  papersRead: string[];
  questionHistory: Array<{
    questionId: string;
    paperId: string;
    answer: string;
    isCorrect: boolean;
    confidence: number;
    timestamp: string;
  }>;
}

export const store = configureStore({
  reducer: {
    papers: paperReducer,
    settings: settingsReducer,
    stats: statsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Use throughout your app instead of plain `useDispatch` and `useSelector`
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
