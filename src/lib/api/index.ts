import axios from 'axios';
import type { Paper, Question, SearchFilters } from '../types';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { llmCosts } from '../utils/llmCosts';
import { getQuestions, saveQuestion } from '../db';

// Create axios instances for different APIs
const arxivApi = axios.create({
  baseURL: import.meta.env.VITE_ARXIV_API_URL,
  headers: {
    'Accept': 'application/xml',
  },
});

const semanticScholarApi = axios.create({
  baseURL: import.meta.env.VITE_SEMANTIC_SCHOLAR_API_URL,
  headers: {
    'x-api-key': import.meta.env.VITE_SEMANTIC_SCHOLAR_API_KEY,
    'Content-Type': 'application/json',
  },
});

// Rate limiting utility
class RateLimiter {
  private lastRequest: number = 0;
  private interval: number;

  constructor(intervalMs: number) {
    this.interval = intervalMs;
  }

  async waitForNext(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.interval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.interval - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
  }
}

// Initialize rate limiters and request tracking
const arxivRateLimiter = new RateLimiter(
  parseInt(import.meta.env.VITE_ARXIV_REQUEST_INTERVAL) || 3000
);

// Claude API has a rate limit of 5 RPM (15s between requests to be safe)
const claudeRateLimiter = new RateLimiter(15000);

// Timeout promise helper
const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]);
};

// Track in-flight requests to prevent duplicates
const inFlightRequests = new Map<string, Promise<Question[]>>();

// Helper to parse arXiv XML response
const parseArxivResponse = (xmlString: string): Paper[] => {
  try {
    console.log('Parsing XML response:', xmlString.substring(0, 200) + '...');
    
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
    
    // Check for parsing errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parsing error:', parseError.textContent);
      throw new Error('Failed to parse arXiv response');
    }
    
    const entries = xmlDoc.getElementsByTagName('entry');
    console.log(`Found ${entries.length} entries in XML`);
    
    return Array.from(entries).map(entry => {
      const id = entry.getElementsByTagName('id')[0]?.textContent?.split('/').pop() || '';
      const topics = Array.from(entry.getElementsByTagName('category')).map(
        cat => cat.getAttribute('term') || ''
      ).filter(Boolean);
      
      const paper: Paper = {
        id,
        title: entry.getElementsByTagName('title')[0]?.textContent?.trim() || '',
        authors: Array.from(entry.getElementsByTagName('author')).map(
          author => author.getElementsByTagName('name')[0]?.textContent || ''
        ).filter(Boolean),
        abstract: entry.getElementsByTagName('summary')[0]?.textContent?.trim() || '',
        url: entry.getElementsByTagName('id')[0]?.textContent || '',
        publishedDate: entry.getElementsByTagName('published')[0]?.textContent || '',
        journal: 'arXiv',
        topics,
        findings: [],
        date: entry.getElementsByTagName('published')[0]?.textContent || '',
      };
      
      console.log('Parsed paper:', { id: paper.id, title: paper.title });
      return paper;
    });
  } catch (error) {
    console.error('Error parsing arXiv response:', error);
    throw error;
  }
};

export interface FetchPapersParams extends SearchFilters {
  count?: number;
}

export interface GenerateQuestionsParams {
  paperId: string;
  count?: number;
  onRetry?: (attempt: number, maxRetries: number, delay: number) => void;
  onTimeout?: (remainingSeconds: number, totalSeconds: number) => void;
}

// Cache for API responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = parseInt(import.meta.env.VITE_API_CACHE_DURATION) || 3600;

export interface ValidateAnswerParams {
  paperId: string;
  questionId: string;
  answer: string;
}

export const papers = {
  async fetch(params: FetchPapersParams): Promise<Paper[]> {
    console.log('[API] Fetching papers with params:', params);
    try {
      const {
        topics = [],
        authors = [],
        dateRange,
        count = parseInt(import.meta.env.VITE_DEFAULT_PAPER_FETCH_LIMIT) || 10
      } = params;
      console.log('[API] Normalized params:', { topics, authors, dateRange, count });

      // Build arXiv query
      const queryParts: string[] = [];
      if (topics.length > 0) {
        // Use 'cat' for exact category matches and 'all' for general search
        const topicQueries = topics.map(topic => `(cat:${topic} OR all:${topic})`);
        queryParts.push(topicQueries.join(' OR '));
      }
      if (authors.length > 0) {
        queryParts.push(`au:${authors.join(' OR au:')}`);
      }
      if (dateRange) {
        queryParts.push(
          `submittedDate:[${dateRange.start.toISOString()} TO ${dateRange.end.toISOString()}]`
        );
      }

      const query = queryParts.length > 0 ? queryParts.join(' AND ') : 'all:physics';
      console.log('arXiv query:', query);

      // Check cache
      const cacheKey = `arxiv:${query}:${count}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
        console.log('[API] Cache hit for key:', cacheKey);
        return cached.data;
      }
      console.log('[API] Cache miss for key:', cacheKey);

      // Wait for rate limiter
      await arxivRateLimiter.waitForNext();

      // Fetch from arXiv
      console.log('[API] Making arXiv API request...');
      const response = await arxivApi.get('', {
        params: {
          search_query: query,
          start: 0,
          max_results: Math.min(count, parseInt(import.meta.env.VITE_MAX_PAPERS_PER_REQUEST) || 30),
          sortBy: 'lastUpdatedDate',
          sortOrder: 'descending',
        },
      });

      console.log('arXiv response status:', response.status);
      const papers = parseArxivResponse(response.data);
      console.log(`Parsed ${papers.length} papers`);

      // Enrich with Semantic Scholar data if API key is available
      if (import.meta.env.VITE_SEMANTIC_SCHOLAR_API_KEY) {
        console.log('Enriching with Semantic Scholar data...');
        const enrichedPapers = await Promise.all(
          papers.map(async paper => {
            try {
              const semanticResponse = await semanticScholarApi.get(`/paper/arXiv:${paper.id}`);
              return {
                ...paper,
                citations: semanticResponse.data.citationCount,
                findings: semanticResponse.data.tldr?.results || [],
              };
            } catch (error) {
              console.warn(`Failed to enrich paper ${paper.id} with Semantic Scholar data:`, error);
              return paper;
            }
          })
        );
        papers.splice(0, papers.length, ...enrichedPapers);
      }

      // Update cache
      cache.set(cacheKey, { data: papers, timestamp: Date.now() });

      return papers;
    } catch (error) {
      console.error('Error fetching papers:', error);
      throw error;
    }
  },

  async getById(id: string): Promise<Paper> {
    try {
      // Check cache
      const cacheKey = `paper:${id}`;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION * 1000) {
        return cached.data;
      }

      // Wait for rate limiter
      await arxivRateLimiter.waitForNext();

      // Fetch from arXiv
      const response = await arxivApi.get('', {
        params: {
          id_list: id,
        },
      });

      const papers = parseArxivResponse(response.data);
      if (papers.length === 0) {
        throw new Error('Paper not found');
      }

      const paper = papers[0];

      // Enrich with Semantic Scholar data if available
      if (import.meta.env.VITE_SEMANTIC_SCHOLAR_API_KEY) {
        try {
          const semanticResponse = await semanticScholarApi.get(`/paper/arXiv:${id}`);
          Object.assign(paper, {
            citations: semanticResponse.data.citationCount,
            findings: semanticResponse.data.tldr?.results || [],
          });
        } catch (error) {
          console.warn(`Failed to enrich paper ${id} with Semantic Scholar data:`, error);
        }
      }

      // Update cache
      cache.set(cacheKey, { data: paper, timestamp: Date.now() });

      return paper;
    } catch (error) {
      console.error('Error fetching paper by ID:', error);
      throw error;
    }
  },

  async getQuestionsForPaper(paperId: string): Promise<Question[]> {
    console.log('[API] Getting questions for paper:', paperId);
    const questions = await getQuestions(paperId);
    return questions || [];
  },

  async findPaperWithQuestions(): Promise<{paperId: string, questions: Question[]} | null> {
    console.log('[API] Finding paper with available questions');
    const allQuestions = await getQuestions();
    
    // Group questions by paper ID and filter for papers with unanswered questions
    const paperQuestions = allQuestions.reduce((acc, q) => {
      if (!q.userResponse) { // Only include unanswered questions
        if (!acc[q.paperId]) {
          acc[q.paperId] = [];
        }
        acc[q.paperId].push(q);
      }
      return acc;
    }, {} as Record<string, Question[]>);

    // Find a paper with available questions
    const paperIds = Object.keys(paperQuestions);
    if (paperIds.length > 0) {
      const paperId = paperIds[0]; // Could randomize this selection
      return {
        paperId,
        questions: paperQuestions[paperId]
      };
    }

    return null;
  },

  async generateQuestionsIfNeeded(paperId: string, minQuestionCount: number = 5): Promise<void> {
    console.log('[API] Checking if questions need to be generated for paper:', paperId);
    
    // Check if paper already has questions
    const existingQuestions = await getQuestions(paperId);
    const unansweredQuestions = existingQuestions.filter(q => !q.userResponse);
    
    console.log('[API] Found questions:', {
      total: existingQuestions.length,
      unanswered: unansweredQuestions.length
    });

    // Only generate if we have fewer unanswered questions than the minimum
    if (unansweredQuestions.length < minQuestionCount) {
      console.log('[API] Generating new questions');
      await this.generateNewQuestions(paperId, minQuestionCount - unansweredQuestions.length);
    }
  },

  async generateNewQuestions(
    paperId: string, 
    count: number,
    onRetry?: (attempt: number, maxRetries: number, delay: number) => void,
    onTimeout?: (remainingSeconds: number, totalSeconds: number) => void
  ): Promise<Question[]> {
    console.log('[API] Generating new questions:', { paperId, count });

    // Check for existing in-flight request
    const requestKey = `generate_questions_${paperId}`;
    const existingRequest = inFlightRequests.get(requestKey);
    if (existingRequest) {
      console.log('[API] Using existing request for paper:', paperId);
      return existingRequest;
    }

    // Create new request
    const request = (async () => {
      try {
        console.log('[API] Fetching paper details...');
        const paper = await this.getById(paperId);
        console.log('[API] Paper fetched successfully');
        
        if (!paper) {
          throw new Error('Failed to load paper');
        }

        const anthropic = new Anthropic({
          apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
          dangerouslyAllowBrowser: true
        });
        console.log('[API] Initialized Anthropic client');

        const prompt = `Generate ${count} predictive questions that test understanding of basic scientific principles, WITHOUT requiring knowledge of the paper's specific results.

CRITICAL RULES:
1. Questions must be PURELY PREDICTIVE - testing what someone would expect to happen BEFORE seeing any results
2. NEVER reference specific measurements, graphs, or data from the paper
3. Focus ONLY on universal scientific principles that anyone with basic science knowledge would understand
4. Questions must follow this EXACT format:
   "When [general cause], how do you predict [general effect] changed?"

Questions must use ONLY these basic principles:
- Temperature affects reaction rates
- Pressure affects gas behavior
- Concentration affects reaction rates
- Force affects motion/acceleration
- Voltage affects current
- Distance affects field strength
- Size/scale affects surface area to volume ratio
etc.

Questions MUST be answerable with ONLY:
- "increased"
- "decreased"
- "unchanged"

Example GOOD questions:
✓ "When the reaction temperature was increased, how do you predict the reaction rate changed?"
✓ "When the distance between charged particles was doubled, how do you predict the electric force changed?"
✓ "When more catalyst was added, how do you predict the reaction time changed?"

Example BAD questions:
✗ "When more vertices were marked negative in the graph..." (References specific paper details)
✗ "After the treatment was applied..." (Not clearly predictive)
✗ "Based on the results in Figure 2..." (References paper data)

Here's the paper abstract to generate questions about (but remember, questions should test predictive understanding WITHOUT requiring knowledge of the specific paper):

${paper.abstract}

Format each question as a JSON object with:
- text: A predictive question testing universal scientific principles
- type: "predictive"
- correctAnswer: ONLY "increased", "decreased", or "unchanged"
- detailedExplanation: Simple explanation of the general scientific principle
- context: Brief description of the relevant scientific concept (NOT specific paper details)

Example format:
[
  {
    "text": "When the gas temperature was increased, how do you predict the molecular collision rate changed?",
    "type": "predictive",
    "correctAnswer": "increased",
    "detailedExplanation": "Higher temperature means molecules have more energy and move faster. Faster-moving molecules collide more frequently - this is a basic principle of kinetic theory.",
    "context": "Kinetic theory states that temperature is directly related to molecular motion and collision frequency."
  }
]

CRITICAL RULES:
1. ONLY use "increased", "decreased", or "unchanged" as answers
2. Questions must follow clear cause-and-effect logic
3. Focus on relationships that are intuitive without special knowledge
4. No questions about specific methods, measurements, or terminology
5. Every question must make common sense to a general audience

Respond with ONLY the JSON array, no other text.`;

        logger.info('Attempting to create Anthropic message', {
          apiKeyPresent: !!import.meta.env.VITE_ANTHROPIC_API_KEY,
          model: 'claude-3-5-sonnet-20241022',
          paperId,
          prompt
        });

        // Add retry logic with exponential backoff for rate limits
        let retryCount = 0;
        const maxRetries = 3;
        const baseDelay = 15000; // Start with 15 seconds

        let message;
        while (true) {
          try {
            await claudeRateLimiter.waitForNext();
            const timeoutMs = 30000;
            let timeoutTimer: NodeJS.Timeout | undefined;
            let remaining = timeoutMs / 1000;
            
            if (onTimeout) {
              onTimeout(remaining, timeoutMs / 1000);
              timeoutTimer = setInterval(() => {
                remaining--;
                if (remaining > 0) {
                  onTimeout?.(remaining, timeoutMs / 1000);
                }
              }, 1000);
            }
            
            try {
              message = await withTimeout(anthropic.messages.create({
              model: 'claude-3-5-sonnet-20241022',
              max_tokens: 4000,
              temperature: 0.3,
              system: "You are an expert at creating intuition-testing questions that help readers predict research outcomes. You always respond with valid JSON arrays containing well-structured question objects.",
              messages: [{ role: 'user', content: prompt }],
              }), timeoutMs);
            } finally {
              if (timeoutTimer) {
                clearInterval(timeoutTimer);
              }
            }

            // Track token usage and cost
            const inputTokens = prompt.length / 4; // Rough estimate
            const outputTokens = message.content[0].type === 'text' ? message.content[0].text.length / 4 : 0; // Rough estimate
            llmCosts.trackCost('generate_questions', 'claude-3-5-sonnet-20241022', inputTokens, outputTokens);

            if (!message.content[0] || message.content[0].type !== 'text') {
              throw new Error('Invalid response format from Claude');
            }

            // If we get here, the request was successful
            break;
          } catch (error: any) {
            // Log the full error details
            logger.error('Claude API error details:', {
              error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
              } : error,
              anthropicError: error?.error,
              response: error?.response,
              type: error?.type
            });

            // Check for rate limit error or timeout
            const isRateLimit = error?.error?.status === 429 || // Anthropic API error format
                              error?.response?.status === 429 || // HTTP response status
                              error?.type === 'rate_limit_error' || // Anthropic SDK error type
                              (error?.message && (
                                error.message.toLowerCase().includes('rate limit') ||
                                error.message.toLowerCase().includes('timeout')
                              ));

            logger.info('Rate limit check:', {
              isRateLimit,
              retryCount,
              maxRetries,
              retryAfter: error?.error?.headers?.['retry-after'] || 
                         error?.response?.headers?.['retry-after']
            });
                              
            if (isRateLimit && retryCount < maxRetries) {
              // Rate limit error, apply exponential backoff
              retryCount++;
              const delay = baseDelay * Math.pow(2, retryCount - 1);
              logger.warn(`Rate limit hit, retrying in ${delay/1000} seconds (attempt ${retryCount}/${maxRetries})`, {
                error: error?.message,
                status: error?.status || error?.response?.status,
                details: error?.error
              });
              
              // Call onRetry callback if provided
              onRetry?.(retryCount, maxRetries, delay);
              
              // Reset timeout countdown for next attempt
              const nextTimeoutMs = 30000;
              if (onTimeout) {
                onTimeout(nextTimeoutMs / 1000, nextTimeoutMs / 1000);
              }
              
              await new Promise(resolve => setTimeout(resolve, delay));
              continue;
            }
            // If not a rate limit error or we've exhausted retries, rethrow
            throw error;
          }
        }

        const content = message.content[0].text.trim();
        if (!content) {
          throw new Error('Empty response from Claude');
        }

        logger.debug('Raw content from Claude', {
          content,
          length: content.length
        });
        
        const questions = JSON.parse(content);
        if (!Array.isArray(questions)) {
          throw new Error('Claude response is not an array');
        }

        const formattedQuestions = questions.map((q: any, index: number) => {
          if (!q.text || !q.type || !q.correctAnswer) {
            throw new Error(`Question ${index} is missing required fields`);
          }
          
          return {
            id: `${paperId}-${index}`,
            paperId,
            text: q.text,
            type: q.type,
            context: q.context,
            correctAnswer: q.correctAnswer,
            detailedExplanation: q.detailedExplanation,
            tags: paper?.topics || []
          };
        });

        logger.info('Successfully generated questions', {
          count: formattedQuestions.length,
          paperId
        });

        // Save questions to IndexedDB
        try {
          await Promise.all(formattedQuestions.map(q => saveQuestion(q)));
          console.log('[API] Saved questions to cache');
        } catch (error) {
          console.warn('[API] Error saving questions to cache:', error);
        }

        return formattedQuestions;
      } catch (error) {
        logger.error('Error generating questions', error);
        throw error;
      } finally {
        // Clean up the in-flight request
        inFlightRequests.delete(requestKey);
      }
    })();

    // Store the request
    inFlightRequests.set(requestKey, request);
    return request;
  },
};

export interface SaveResponseParams {
  questionId: string;
  confidence: number;
  notes?: string;
}

export const questions = {
  async getById(id: string): Promise<Question> {
    try {
      const [paperId] = id.split('-');
      const paper = await papers.getById(paperId);
      
      // For now, return a basic question about the paper
      // This will be enhanced with stored questions later
      const question: Question = {
        id,
        paperId,
        text: `What is the main topic of this paper?`,
        type: 'findings',
        context: paper.abstract,
        correctAnswer: paper.topics[0],
        detailedExplanation: 'This can be derived from the paper\'s primary topic category.',
        tags: paper.topics
      };
      return question;
    } catch (error: any) {
      console.error('Error getting question by ID:', error);
      throw error;
    }
  },

  async saveResponse(params: SaveResponseParams): Promise<void> {
    try {
      // For now, just log the response
      // This will be enhanced with actual storage later
      console.log('Saved response:', params);
    } catch (error) {
      console.error('Error saving response:', error);
      throw error;
    }
  },
};

// Add authentication headers to both API instances
[arxivApi, semanticScholarApi].forEach(api => {
  api.interceptors.request.use(
    (config: any) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: any) => {
      return Promise.reject(error);
    }
  );

  api.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
});

export interface AskFollowupParams {
  paperId: string;
  questionId: string;
  question: string;
}

export default {
  papers: {
    ...papers,
    async validateAnswer(params: ValidateAnswerParams) {
      console.log('[API] Validating answer for paper:', params.paperId);
      try {
        // Get the question details
        const questions = await getQuestions(params.paperId);
        const question = questions.find(q => q.id === params.questionId);
        if (!question) {
          throw new Error('Question not found');
        }

        // Normalize answers for comparison
        const normalizedUserAnswer = params.answer.toLowerCase().trim();
        const normalizedCorrectAnswer = question.correctAnswer.toLowerCase().trim();

        // Validate answer format
        const validAnswers = ['increased', 'decreased', 'unchanged'];
        if (!validAnswers.includes(normalizedUserAnswer)) {
          return {
            isCorrect: false,
            score: 0,
            feedback: 'Please answer with exactly "increased", "decreased", or "unchanged".',
            suggestedAnswer: question.correctAnswer
          };
        }

        // Compare answers
        const isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
        
        return {
          isCorrect,
          score: isCorrect ? 100 : 0,
          feedback: isCorrect 
            ? `Correct! ${question.detailedExplanation}`
            : `Incorrect. ${question.detailedExplanation}`,
          suggestedAnswer: question.correctAnswer
        };
      } catch (error) {
        console.error('[API] Error validating answer:', error);
        if (error instanceof Error) {
          console.error('[API] Error details:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            response: (error as any).response ? JSON.stringify((error as any).response, null, 2) : undefined
          });
        }
        throw error;
      }
    }
  },
  questions,

  async askFollowup(params: AskFollowupParams) {
    try {
      // Get the question details for context
      const questions = await getQuestions(params.paperId);
      const question = questions.find(q => q.id === params.questionId);
      if (!question) {
        throw new Error('Question not found');
      }

      const anthropic = new Anthropic({
        apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY,
        dangerouslyAllowBrowser: true
      });

      await claudeRateLimiter.waitForNext();
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: 0.7,
        system: "You are a helpful science tutor who explains concepts clearly and thoroughly.",
        messages: [
          {
            role: 'user',
            content: `Context:
Original Question: "${question.text}"
Correct Answer: "${question.correctAnswer}"
Scientific Explanation: "${question.detailedExplanation}"

User's Followup Question: "${params.question}"

Please provide a detailed but clear explanation that helps the user understand the scientific concept better.`
          }
        ]
      });

      // Track token usage
      const inputTokens = params.question.length / 4;
      const outputTokens = message.content[0].type === 'text' ? message.content[0].text.length / 4 : 0;
      llmCosts.trackCost('ask_followup', 'claude-3-5-sonnet-20241022', inputTokens, outputTokens);

      return {
        answer: message.content[0].type === 'text' ? message.content[0].text : 'No response generated'
      };
    } catch (error) {
      console.error('[API] Error handling followup question:', error);
      throw error;
    }
  }
};
