import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Paper, Question } from '../types';
import type { PaperState } from './index';

const initialState: PaperState = {
  papers: [],
  currentPaper: null,
  loading: false,
  error: null,
  questions: [],
  currentQuestion: null,
  offlineQuestions: [],
  isOnline: navigator.onLine
};

const paperSlice = createSlice({
  name: 'papers',
  initialState,
  reducers: {
    setPapers: (state, action: PayloadAction<Paper[]>) => {
      state.papers = action.payload;
      state.error = null;
    },
    setCurrentPaper: (state, action: PayloadAction<Paper | null>) => {
      state.currentPaper = action.payload;
      state.error = null;
    },
    setQuestions: (state, action: PayloadAction<Question[]>) => {
      state.questions = action.payload;
      state.error = null;
    },
    setCurrentQuestion: (state, action: PayloadAction<Question | null>) => {
      state.currentQuestion = action.payload;
      state.error = null;
    },
    addOfflineQuestion: (state, action: PayloadAction<Question>) => {
      state.offlineQuestions.push(action.payload);
    },
    removeOfflineQuestion: (state, action: PayloadAction<string>) => {
      state.offlineQuestions = state.offlineQuestions.filter(q => q.id !== action.payload);
    },
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    }
  }
});

export const {
  setPapers,
  setCurrentPaper,
  setQuestions,
  setCurrentQuestion,
  addOfflineQuestion,
  removeOfflineQuestion,
  setOnlineStatus,
  setLoading,
  setError
} = paperSlice.actions;

export default paperSlice.reducer;
