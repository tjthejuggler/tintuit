# TinTuit Development Tasks

## Completed
1. ✅ Basic React + TypeScript + Vite setup
2. ✅ Redux store configuration
3. ✅ Dark mode support
4. ✅ Basic UI layout
5. ✅ Question Generation with Claude API
   - ✅ Direct integration with Anthropic's Claude API
   - ✅ Answer validation with Claude
   - ✅ Rate-limited API interactions

## Current Priority: Paper Integration
1. [✅] Paper Search & Browse Interface
   - ✅ Implemented arXiv search with rate limiting
   - ✅ Added Semantic Scholar metadata enrichment
   - ✅ Created paper list and detail views
   - ✅ Add paper saving to IndexedDB

2. [✅] Study Session Flow
   - ✅ Created study session interface with confidence tracking
   - ✅ Integrated Claude API for question generation
   - ✅ Implemented answer validation with detailed feedback
   - ✅ Added progress tracking in IndexedDB

3. [✅] Progress Tracking
   - ✅ Implemented study statistics storage in IndexedDB
   - ✅ Added confidence level tracking
   - ✅ Added daily streak tracking
   - ✅ Track questions answered per paper

4. [✅] Offline Support
   - ✅ Enhanced service worker for API caching
   - ✅ Added paper and question caching in IndexedDB
   - ✅ Enabled offline study sessions
   - ✅ Added automatic sync when back online

## Next Steps for New Developer
1. Get API Keys:
   - Anthropic API key from console.anthropic.com
   - Semantic Scholar API key from semanticscholar.org

2. Configure Environment:
   ```bash
   cd /home/twain/Projects/tintuit
   cp .env.example .env
   # Add your API keys to .env
   ```

3. Start Development:
   ```bash
   cd /home/twain/Projects/tintuit
   npm install
   npm run dev
   ```

## Implementation Notes

### Paper Integration
- Use arXiv API with 3s delay between requests
- Maximum 30 results per query
- Cache results in IndexedDB
- Enrich with Semantic Scholar data when available

### Question Generation
- Use Claude API directly for all AI interactions
- Rate limit API calls to respect Anthropic's limits
- Generate questions when paper is first saved
- Cache questions in IndexedDB
- Support offline answer validation through caching

### Progress Tracking
- Track per-topic accuracy
- Implement spaced repetition algorithm
- Store statistics in IndexedDB
- Sync with backend when implemented

### Future Considerations
1. [ ] User Authentication
2. [ ] Cloud Sync
3. [ ] Collaborative Study Features
4. [ ] Mobile App Optimization
5. [ ] Citation Management
6. [ ] Spaced Repetition Scheduling
7. [ ] Topic Mastery Analytics
8. [ ] Full-Text Paper Content Integration
9. [✅] Custom Question Types
   - ✅ Added support for both predictive and open-ended questions
   - ✅ Updated question validation to handle different answer types
   - ✅ Enhanced StudySession UI to adapt based on question type
10. [ ] Study Session Sharing

### Recent Updates
- Implemented actual statistics tracking in Stats page
  - Added questions answered per paper tracking
  - Added topic mastery visualization
  - Added daily streak display
  - Added confidence level trends
  - Added persistent storage of all user activity
  - Added background question generation
  - Improved question management:
    - Questions are now generated in advance
    - Each question is only asked once
    - Questions are stored in IndexedDB
    - Stats persist between sessions
