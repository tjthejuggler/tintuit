import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { store } from './lib/store';
import App from './App';
import './index.css';

// Initialize IndexedDB
import { initDB } from './lib/db';

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered:', registration);
    }).catch(error => {
      console.log('SW registration failed:', error);
    });
  });
}

// Check if IndexedDB is supported
const checkIndexedDB = async () => {
  // Check basic IndexedDB support
  if (!window.indexedDB) {
    throw new Error('Your browser doesn\'t support IndexedDB. Please use a modern browser.');
  }

  // Test if IndexedDB is actually available (not blocked by private browsing)
  try {
    // Try to open a test database
    const request = window.indexedDB.open('test-db', 1);
    
    await new Promise((resolve, reject) => {
      request.onerror = () => {
        reject(new Error(
          request.error?.message || 
          'IndexedDB access denied. This might happen in private browsing mode.'
        ));
      };
      request.onsuccess = () => {
        // Clean up the test database
        request.result.close();
        window.indexedDB.deleteDatabase('test-db');
        resolve(true);
      };
    });
  } catch (error) {
    throw error;
  }
};

// Initialize app with proper error handling
const initApp = async () => {
  try {
    // Check IndexedDB availability first
    await checkIndexedDB();
    
    // Then initialize our database
    await initDB();
    
    // If successful, render the app
    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <Provider store={store}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Provider>
      </React.StrictMode>,
    );
  } catch (error) {
    console.error('Failed to initialize application:', error);
    
    // Determine the specific error message
    let errorMessage = 'An unknown error occurred.';
    let helpText = 'Please try again or contact support if the problem persists.';
    
    if (error instanceof Error) {
      if (error.message.includes('private browsing')) {
        errorMessage = 'IndexedDB is not available in private browsing mode.';
        helpText = 'Please try using normal browsing mode or a different browser.';
      } else if (error.message.includes('support')) {
        errorMessage = error.message;
        helpText = 'Please use a modern browser like Chrome, Firefox, Safari, or Edge.';
      } else if (error.message.includes('access denied')) {
        errorMessage = 'Database access was denied.';
        helpText = 'Please check your browser settings and ensure cookies and site data are allowed.';
      }
    }
    
    // Render an error message with specific details
    document.getElementById('root')!.innerHTML = `
      <div style="
        padding: 2rem;
        max-width: 600px;
        margin: 0 auto;
        text-align: center;
        font-family: system-ui, -apple-system, sans-serif;
      ">
        <h1 style="
          color: #ef4444;
          margin-bottom: 1rem;
          font-size: 1.5rem;
          font-weight: 600;
        ">Failed to Start Application</h1>
        
        <p style="
          color: #1f2937;
          margin-bottom: 1rem;
          font-size: 1rem;
        ">${errorMessage}</p>
        
        <p style="
          color: #4b5563;
          margin-bottom: 2rem;
          font-size: 0.875rem;
        ">${helpText}</p>
        
        <button onclick="window.location.reload()" style="
          background-color: #3b82f6;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          border: none;
          font-size: 0.875rem;
          cursor: pointer;
          transition: background-color 0.2s;
        ">Try Again</button>
        
        <div style="
          margin-top: 2rem;
          padding: 1rem;
          background-color: #f3f4f6;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          color: #6b7280;
        ">
          Technical details: ${error instanceof Error ? error.message : 'Unknown error'}
        </div>
      </div>
    `;
  }
};

// Start the application
initApp();
