import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import type { StatsState } from './index';
import { getStats, saveStats } from '../db';
import { logger } from '../utils/logger';

// Async thunk to load stats from IndexedDB
export const loadStats = createAsyncThunk(
  'stats/loadStats',
  async () => {
    try {
      const stats = await getStats();
      return stats || {
        questionsAnswered: 0,
        averageConfidence: 0,
        topicAccuracy: {},
        streak: 0,
        lastActive: new Date().toISOString(),
        papersRead: [],
        questionHistory: []
      };
    } catch (error) {
      logger.error('Failed to load stats from IndexedDB', { error });
      throw error;
    }
  }
);

// Async thunk to save stats to IndexedDB
export const persistStats = createAsyncThunk(
  'stats/persistStats',
  async (_, { getState }) => {
    try {
      const stats = (getState() as any).stats;
      await saveStats(stats);
    } catch (error) {
      logger.error('Failed to save stats to IndexedDB', { error });
      throw error;
    }
  }
);

const initialState: StatsState & {
  papersRead: string[];
  questionHistory: Array<{
    questionId: string;
    paperId: string;
    answer: string;
    isCorrect: boolean;
    confidence: number;
    timestamp: string;
  }>;
} = {
  questionsAnswered: 0,
  averageConfidence: 0,
  topicAccuracy: {},
  streak: 0,
  lastActive: new Date().toISOString(),
  papersRead: [],
  questionHistory: []
};

const statsSlice = createSlice({
  name: 'stats',
  initialState,
  reducers: {
    incrementQuestionsAnswered: (state) => {
      state.questionsAnswered += 1;
    },
    updateAverageConfidence: (state, action: PayloadAction<number>) => {
      const newConfidence = action.payload;
      state.averageConfidence = (
        (state.averageConfidence * state.questionsAnswered + newConfidence) /
        (state.questionsAnswered + 1)
      );
    },
    updateTopicAccuracy: (state, action: PayloadAction<{ topic: string; accuracy: number }>) => {
      const { topic, accuracy } = action.payload;
      if (topic in state.topicAccuracy) {
        const currentAccuracy = state.topicAccuracy[topic];
        const questionCount = state.questionsAnswered;
        state.topicAccuracy[topic] = (currentAccuracy * questionCount + accuracy) / (questionCount + 1);
      } else {
        state.topicAccuracy[topic] = accuracy;
      }
    },
    updateStreak: (state) => {
      const lastActive = new Date(state.lastActive);
      const today = new Date();
      const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        state.streak += 1;
      } else if (diffDays > 1) {
        state.streak = 1;
      }
      state.lastActive = today.toISOString();
    },
    resetStreak: (state) => {
      state.streak = 0;
      state.lastActive = new Date().toISOString();
    },
    resetStats: (state) => {
      state.questionsAnswered = 0;
      state.averageConfidence = 0;
      state.topicAccuracy = {};
      state.streak = 0;
      state.lastActive = new Date().toISOString();
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadStats.fulfilled, (state, action) => {
        Object.assign(state, action.payload);
      })
      .addCase(loadStats.rejected, (state, action) => {
        logger.error('Failed to load stats', { error: action.error });
      });
  }
});

export const {
  incrementQuestionsAnswered,
  updateAverageConfidence,
  updateTopicAccuracy,
  updateStreak,
  resetStreak,
  resetStats
} = statsSlice.actions;

export default statsSlice.reducer;
