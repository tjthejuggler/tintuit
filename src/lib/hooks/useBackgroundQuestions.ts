import { useEffect, useRef } from 'react';
import { useAppSelector } from '../store';
import { getQuestions, getPapers } from '../db';
import api from '../api';
import { logger } from '../utils/logger';

const QUESTIONS_PER_PAPER = 10;
const BATCH_SIZE = 3; // Number of papers to generate questions for in parallel

export function useBackgroundQuestions() {
  const isOnline = useAppSelector(state => state.papers.isOnline);
  const generationInProgress = useRef(false);

  useEffect(() => {
    const generateQuestionsForPaper = async (paperId: string) => {
      try {
        const existingQuestions = await getQuestions(paperId);
        if (existingQuestions.length < QUESTIONS_PER_PAPER) {
          await api.papers.generateQuestionsIfNeeded(
            paperId, 
            QUESTIONS_PER_PAPER - existingQuestions.length
          );
          logger.info('Generated questions for paper', { paperId });
        }
      } catch (error) {
        logger.error('Failed to generate questions for paper', { paperId, error });
      }
    };

    const generateQuestionsInBackground = async () => {
      if (generationInProgress.current || !isOnline) return;

      try {
        generationInProgress.current = true;
        const papers = await getPapers();
        
        // Sort papers by those with fewest questions first
        const papersWithQuestionCounts = await Promise.all(
          papers.map(async paper => ({
            paper,
            questionCount: (await getQuestions(paper.id)).length
          }))
        );

        const papersNeedingQuestions = papersWithQuestionCounts
          .filter(({ questionCount }) => questionCount < QUESTIONS_PER_PAPER)
          .sort((a, b) => a.questionCount - b.questionCount)
          .map(({ paper }) => paper);

        // Process papers in batches
        for (let i = 0; i < papersNeedingQuestions.length; i += BATCH_SIZE) {
          const batch = papersNeedingQuestions.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map(paper => generateQuestionsForPaper(paper.id)));
        }

      } catch (error) {
        logger.error('Background question generation failed', { error });
      } finally {
        generationInProgress.current = false;
      }
    };

    // Run question generation every 5 minutes when online
    const interval = setInterval(() => {
      if (isOnline) {
        generateQuestionsInBackground();
      }
    }, 5 * 60 * 1000);

    // Also run once when coming online
    if (isOnline) {
      generateQuestionsInBackground();
    }

    return () => clearInterval(interval);
  }, [isOnline]);
}
