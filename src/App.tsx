import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppDispatch } from './lib/store';
import { setOnlineStatus } from './lib/store/paperSlice';
import { loadStats } from './lib/store/statsSlice';
import { usePaperSync } from './lib/hooks/usePaperSync';
import { useBackgroundQuestions } from './lib/hooks/useBackgroundQuestions';
import Layout from './components/Layout';
import Home from './pages/Home';
import NotFound from './pages/NotFound';
import PaperList from './components/PaperList';
import Questions from './pages/Questions';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

export default function App() {
  const dispatch = useAppDispatch();
  const { fetchPapers } = usePaperSync();
  useBackgroundQuestions(); // Enable background question generation

  useEffect(() => {
    // Initialize online status
    dispatch(setOnlineStatus(navigator.onLine));

    // Listen for online/offline events
    const handleOnline = () => dispatch(setOnlineStatus(true));
    const handleOffline = () => dispatch(setOnlineStatus(false));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial data loading
    fetchPapers();
    dispatch(loadStats());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch, fetchPapers]);

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="papers" element={<PaperList />} />
        <Route path="questions" element={<Questions />} />
        <Route path="stats" element={<Stats />} />
        <Route path="settings" element={<Settings />} />
        <Route path="404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
