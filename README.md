# TinTuit - Research Paper Study Assistant

A Progressive Web App (PWA) that helps users study and retain knowledge from research papers through interactive questions and spaced repetition.

## Features

- 📚 Browse and search research papers from multiple sources (arXiv, Semantic Scholar)
- 🤖 AI-generated questions to test understanding
- 📊 Track study progress and retention
- 📱 Offline support and PWA functionality
- 🌙 Dark mode support
- 📈 Detailed statistics and progress tracking

## Setup

1. API Keys:
   - Required: Anthropic API key (should already be in .env files)
   - Optional: Semantic Scholar API key (app will use only arXiv if not provided)
   - Note: arXiv API key not required

2. Configure Main App:
   ```bash
   cd /home/twain/Projects/tintuit
   npm install
   cp .env.example .env
   # Add your API keys to .env
   ```

3. Start Development Server:
   ```bash
   cd /home/twain/Projects/tintuit
   npm run dev
   ```
   The app will be available at http://localhost:5173

## Testing Checklist

1. Paper Search & Browse:
   - [ ] Search for papers by topic (e.g., "quantum computing")
   - [ ] Verify papers load with titles, authors, and abstracts
   - [ ] Check that paper metadata is loaded from arXiv (and optionally enriched with Semantic Scholar data if API key is provided)
   - [ ] Confirm papers are saved to IndexedDB (check DevTools -> Application -> IndexedDB)

2. Study Session:
   - [ ] Start a study session for a paper
   - [ ] Verify AI generates relevant questions
   - [ ] Answer questions and check validation works
   - [ ] Test different confidence levels
   - [ ] Verify progress is saved

3. Progress Tracking:
   - [ ] Check that answered questions are tracked
   - [ ] Verify confidence levels are recorded
   - [ ] Test daily streak tracking
   - [ ] Check per-paper progress tracking

4. Offline Support:
   - [ ] Load the app and search for papers
   - [ ] Turn off internet connection
   - [ ] Verify previously loaded papers are still accessible
   - [ ] Check that study sessions work offline
   - [ ] Turn internet back on and verify sync works

5. Dark Mode:
   - [ ] Toggle between light and dark modes
   - [ ] Verify all components render correctly in both modes

6. Error Handling:
   - [ ] Test with invalid search terms
   - [ ] Try accessing non-existent papers
   - [ ] Check error messages are user-friendly
   - [ ] Verify app recovers gracefully from API errors

## Development

### Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/         # Route pages
├── lib/
│   ├── api/       # API integration
│   ├── db/        # IndexedDB storage
│   ├── store/     # Redux store
│   ├── hooks/     # Custom React hooks
│   └── types.ts   # TypeScript definitions
└── sw.ts          # Service worker
```

### Key Technologies

- React + TypeScript
- Vite
- Redux Toolkit
- TailwindCSS
- IndexedDB
- Service Workers (PWA)

### API Integrations

- arXiv API: Research paper metadata and full text
- Semantic Scholar: Enhanced metadata, citations, and references
- Claude API (Anthropic): 
  - Direct integration for AI-powered features
  - Question generation from research papers
  - Answer validation with detailed feedback
  - Rate-limited to respect API constraints
  - Results cached in IndexedDB for offline use

## Building for Production

```bash
npm run build
```

The build output will be in the `dist` directory, ready for deployment.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
