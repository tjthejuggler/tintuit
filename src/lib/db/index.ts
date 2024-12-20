import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { Paper, Question } from '../types';
import { logger } from '../utils/logger';

interface TinTuitDB extends DBSchema {
  papers: {
    key: string;
    value: Paper & {
      lastRead?: string;
      timesRead?: number;
      questionsGenerated?: boolean;
    };
    indexes: { 'by-date': string };
  };
  questions: {
    key: string;
    value: Question & {
      userAnswers?: Array<{
        answer: string;
        isCorrect: boolean;
        confidence: number;
        timestamp: string;
      }>;
      lastAnswered?: string;
      feedback?: Array<{
        type: 'too_specific' | 'not_predictive' | 'references_paper' | 'unclear' | 'other';
        comment?: string;
        timestamp: string;
      }>;
      feedbackStatus?: {
        needsRevision: boolean;
        revisionReason?: string;
      };
    };
    indexes: { 
      'by-paper': string;
      'by-type': string;
      'by-last-answered': string;
    };
  };
  settings: {
    key: string;
    value: {
      preferredTopics: string[];
      prefetchCount: number;
      reviewInterval: number;
      dailyQuestionTarget: number;
    };
  };
  stats: {
    key: string;
    value: {
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
    };
  };
}

const DB_NAME = 'tintuit-db';
const DB_VERSION = 2; // Increased version for schema update

let db: IDBPDatabase<TinTuitDB>;

async function upgradeDB(db: IDBPDatabase<TinTuitDB>, oldVersion: number, newVersion: number | null) {
  logger.info('Upgrading database', { oldVersion, newVersion, dbName: DB_NAME });

  try {
    if (oldVersion < 1) {
      logger.info('Creating initial database schema');
      
      // Papers store
      const paperStore = db.createObjectStore('papers', { keyPath: 'id' });
      paperStore.createIndex('by-date', 'date');
      logger.info('Created papers store');

      // Questions store
      const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
      questionStore.createIndex('by-paper', 'paperId');
      questionStore.createIndex('by-type', 'type');
      questionStore.createIndex('by-last-answered', 'lastAnswered');
      logger.info('Created questions store');

      // Settings store
      db.createObjectStore('settings');
      logger.info('Created settings store');

      // Stats store
      db.createObjectStore('stats');
      logger.info('Created stats store');
    }

    if (oldVersion < 2) {
      logger.info('Upgrading to version 2: Adding new fields');
      
      try {
        // Add new fields to existing records
        const tx = db.transaction(['papers', 'questions', 'stats'], 'readwrite');
        
        // Set up error handling for the transaction
        tx.addEventListener('error', (event) => {
          logger.error('Transaction error during upgrade', {
            error: (event.target as any)?.error || event,
          });
          throw new Error('Transaction failed during database upgrade');
        });

        // Update papers
        const paperStore = tx.objectStore('papers');
        let paperCursor = await paperStore.openCursor();
        while (paperCursor) {
          const paper = paperCursor.value;
          paper.lastRead = paper.lastRead || undefined;
          paper.timesRead = paper.timesRead || 0;
          paper.questionsGenerated = paper.questionsGenerated || false;
          await paperCursor.update(paper);
          paperCursor = await paperCursor.continue();
        }
        logger.info('Updated papers store');

        // Update questions
        const questionStore = tx.objectStore('questions');
        let questionCursor = await questionStore.openCursor();
        while (questionCursor) {
          const question = questionCursor.value;
          question.userAnswers = question.userAnswers || [];
          question.lastAnswered = question.lastAnswered || undefined;
          await questionCursor.update(question);
          questionCursor = await questionCursor.continue();
        }
        logger.info('Updated questions store');

        // Update stats
        const statsStore = tx.objectStore('stats');
        let statsCursor = await statsStore.openCursor();
        while (statsCursor) {
          const stats = statsCursor.value;
          stats.papersRead = stats.papersRead || [];
          stats.questionHistory = stats.questionHistory || [];
          await statsCursor.update(stats);
          statsCursor = await statsCursor.continue();
        }
        logger.info('Updated stats store');

        // Wait for the transaction to complete
        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        
        logger.info('Database upgrade completed successfully');
      } catch (error) {
        logger.error('Error during version 2 upgrade', { error });
        throw error;
      }
    }
  } catch (error) {
    logger.error('Database upgrade failed', { error });
    throw new Error(`Failed to upgrade database: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export async function initDB() {
  try {
    logger.info('Initializing database', { name: DB_NAME, version: DB_VERSION });
    
    db = await openDB<TinTuitDB>(DB_NAME, DB_VERSION, {
      upgrade: upgradeDB,
      blocked() {
        logger.warn('Database upgrade blocked - another tab has the database open');
        throw new Error('Database upgrade blocked. Please close other tabs of this application and try again.');
      },
      blocking() {
        logger.warn('This tab is blocking a database upgrade');
        throw new Error('A database upgrade is needed. Please reload the page.');
      },
      terminated() {
        logger.error('Database connection terminated unexpectedly');
        throw new Error('Database connection was terminated. Please reload the page.');
      },
    });

    logger.info('Database initialized successfully');
    return db;
  } catch (error) {
    logger.error('Failed to initialize database', { error });
    throw new Error(
      `Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

export async function getDB() {
  if (!db) {
    db = await initDB();
  }
  return db;
}

// Papers
export async function getPapers() {
  const dbInstance = await getDB();
  return dbInstance.getAllFromIndex('papers', 'by-date');
}

export async function savePaper(paper: Paper & Partial<TinTuitDB['papers']['value']>) {
  const db = await getDB();
  const now = new Date().toISOString();
  const existingPaper = await db.get('papers', paper.id);
  
  if (existingPaper) {
    // Update existing paper
    await db.put('papers', {
      ...existingPaper,
      ...paper,
      lastRead: now || undefined,
      timesRead: (existingPaper.timesRead || 0) + 1
    });
  } else {
    // New paper
    await db.put('papers', {
      ...paper,
      lastRead: now,
      timesRead: 1,
      questionsGenerated: false
    });
  }
}

export async function markPaperQuestionsGenerated(paperId: string) {
  const db = await getDB();
  const paper = await db.get('papers', paperId);
  if (paper) {
    await db.put('papers', {
      ...paper,
      questionsGenerated: true
    });
  }
}

// Questions
export async function getQuestions(paperId?: string) {
  const dbInstance = await getDB();
  if (paperId) {
    return dbInstance.getAllFromIndex('questions', 'by-paper', paperId);
  }
  return dbInstance.getAll('questions');
}

export async function getQuestionsByType(type: Question['type']) {
  const dbInstance = await getDB();
  return dbInstance.getAllFromIndex('questions', 'by-type', type);
}

export async function getRecentQuestions() {
  const dbInstance = await getDB();
  return dbInstance.getAllFromIndex('questions', 'by-last-answered');
}

export async function saveQuestion(question: Question) {
  const db = await getDB();
  await db.put('questions', {
    ...question,
    userAnswers: [],
    lastAnswered: undefined,
    feedback: [],
    feedbackStatus: {
      needsRevision: false
    }
  });
}

export async function saveQuestionFeedback(
  questionId: string,
  feedback: {
    type: 'too_specific' | 'not_predictive' | 'references_paper' | 'unclear' | 'other';
    comment?: string;
  }
) {
  const db = await getDB();
  const question = await db.get('questions', questionId);
  
  if (question) {
    const feedbackArray = question.feedback || [];
    feedbackArray.push({
      ...feedback,
      timestamp: new Date().toISOString()
    });

    // Update feedback status
    const feedbackStatus = {
      needsRevision: true,
      revisionReason: feedback.type === 'other' && feedback.comment 
        ? feedback.comment 
        : feedback.type
    };

    await db.put('questions', {
      ...question,
      feedback: feedbackArray,
      feedbackStatus
    });

    // Log feedback for analysis
    logger.info('Question feedback received', {
      questionId,
      feedbackType: feedback.type,
      comment: feedback.comment,
      timestamp: new Date().toISOString()
    });
  }
}

export async function getQuestionsNeedingRevision(): Promise<Array<Question & { 
  userAnswers?: Array<{
    answer: string;
    isCorrect: boolean;
    confidence: number;
    timestamp: string;
  }>;
  lastAnswered?: string;
  feedback?: Array<{
    type: 'too_specific' | 'not_predictive' | 'references_paper' | 'unclear' | 'other';
    comment?: string;
    timestamp: string;
  }>;
  feedbackStatus: {
    needsRevision: boolean;
    revisionReason?: string;
  };
}>> {
  const dbInstance = await getDB();
  const questions = await dbInstance.getAll('questions');
  return questions.filter(q => q.feedbackStatus?.needsRevision).map(q => ({
    ...q,
    feedbackStatus: q.feedbackStatus || { needsRevision: false }
  }));
}

export async function saveQuestionAnswer(
  questionId: string, 
  answer: string, 
  isCorrect: boolean,
  confidence: number
) {
  const db = await getDB();
  const question = await db.get('questions', questionId);
  const now = new Date().toISOString();
  
  if (question) {
    // Update question
    const userAnswers = question.userAnswers || [];
    userAnswers.push({
      answer,
      isCorrect,
      confidence,
      timestamp: now
    });
    
    await db.put('questions', {
      ...question,
      userAnswers,
      lastAnswered: now
    });

    // Update stats
    const stats = await getStats() || {
      questionsAnswered: 0,
      averageConfidence: 0,
      topicAccuracy: {},
      streak: 0,
      lastActive: now,
      papersRead: [],
      questionHistory: []
    };

    stats.questionsAnswered++;
    stats.lastActive = now;
    
    // Update confidence average
    const totalConfidence = stats.averageConfidence * (stats.questionsAnswered - 1) + confidence;
    stats.averageConfidence = totalConfidence / stats.questionsAnswered;
    
    // Update topic accuracy
    question.tags?.forEach(tag => {
      const currentAccuracy = stats.topicAccuracy[tag] || 0;
      const totalQuestions = stats.questionHistory.filter(h => 
        h.questionId.startsWith(question.paperId) && 
        (question.tags || []).includes(tag)
      ).length;
      
      stats.topicAccuracy[tag] = 
        (currentAccuracy * totalQuestions + (isCorrect ? 100 : 0)) / (totalQuestions + 1);
    });

    // Add to history
    stats.questionHistory.push({
      questionId,
      paperId: question.paperId,
      answer,
      isCorrect,
      confidence,
      timestamp: now
    });

    await saveStats(stats);
  }
}

// Settings
export async function getSettings() {
  const db = await getDB();
  return db.get('settings', 'user-settings');
}

export async function saveSettings(settings: TinTuitDB['settings']['value']) {
  const db = await getDB();
  await db.put('settings', settings, 'user-settings');
}

// Stats
export async function getStats() {
  const db = await getDB();
  return db.get('stats', 'user-stats');
}

export async function saveStats(stats: TinTuitDB['stats']['value']) {
  const db = await getDB();
  await db.put('stats', stats, 'user-stats');
}

export async function clearAllQuestions() {
  const db = await getDB();
  await db.clear('questions');
  
  // Reset question-related stats
  const stats = await getStats();
  if (stats) {
    stats.questionsAnswered = 0;
    stats.averageConfidence = 0;
    stats.topicAccuracy = {};
    stats.questionHistory = [];
    await saveStats(stats);
  }
  
  // Reset questionsGenerated flag on papers
  const papers = await getPapers();
  for (const paper of papers) {
    paper.questionsGenerated = false;
    await savePaper(paper);
  }
}

export async function updatePaperReadStats(paperId: string) {
  const db = await getDB();
  const stats = await getStats() || {
    questionsAnswered: 0,
    averageConfidence: 0,
    topicAccuracy: {},
    streak: 0,
    lastActive: new Date().toISOString(),
    papersRead: [],
    questionHistory: []
  };

  if (!stats.papersRead.includes(paperId)) {
    stats.papersRead.push(paperId);
    await saveStats(stats);
  }
}
