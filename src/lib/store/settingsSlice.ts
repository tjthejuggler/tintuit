import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SettingsState } from './index';

const initialState: SettingsState = {
  preferredTopics: [],
  prefetchCount: 5,
  reviewInterval: 7,
  dailyQuestionTarget: 10,
  questionKeywords: []
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setPreferredTopics: (state, action: PayloadAction<string[]>) => {
      state.preferredTopics = action.payload;
    },
    addPreferredTopic: (state, action: PayloadAction<string>) => {
      if (!state.preferredTopics.includes(action.payload)) {
        state.preferredTopics.push(action.payload);
      }
    },
    removePreferredTopic: (state, action: PayloadAction<string>) => {
      state.preferredTopics = state.preferredTopics.filter(topic => topic !== action.payload);
    },
    setPrefetchCount: (state, action: PayloadAction<number>) => {
      state.prefetchCount = Math.max(1, Math.min(20, action.payload));
    },
    setReviewInterval: (state, action: PayloadAction<number>) => {
      state.reviewInterval = Math.max(1, Math.min(30, action.payload));
    },
    setDailyQuestionTarget: (state, action: PayloadAction<number>) => {
      state.dailyQuestionTarget = Math.max(1, Math.min(50, action.payload));
    },
    setQuestionKeywords: (state, action: PayloadAction<string[]>) => {
      state.questionKeywords = action.payload;
    },
    addQuestionKeyword: (state, action: PayloadAction<string>) => {
      if (!state.questionKeywords.includes(action.payload)) {
        state.questionKeywords.push(action.payload);
      }
    },
    removeQuestionKeyword: (state, action: PayloadAction<string>) => {
      state.questionKeywords = state.questionKeywords.filter(keyword => keyword !== action.payload);
    }
  }
});

export const {
  setPreferredTopics,
  addPreferredTopic,
  removePreferredTopic,
  setPrefetchCount,
  setReviewInterval,
  setDailyQuestionTarget,
  setQuestionKeywords,
  addQuestionKeyword,
  removeQuestionKeyword
} = settingsSlice.actions;

export default settingsSlice.reducer;
