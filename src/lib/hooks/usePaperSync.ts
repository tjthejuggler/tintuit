import { useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setPapers, setOnlineStatus, setLoading, setError } from '../store/paperSlice';
import api from '../api';
import { savePaper, getPapers } from '../db';

export const usePaperSync = () => {
  const dispatch = useAppDispatch();
  const isOnline = useAppSelector(state => state.papers.isOnline);
  const papers = useAppSelector(state => state.papers.papers);
  const preferredTopics = useAppSelector(state => state.settings.preferredTopics);
  const prefetchCount = useAppSelector(state => state.settings.prefetchCount);

  const fetchPapers = useCallback(async () => {
    dispatch(setLoading(true));
    try {
      if (isOnline) {
        // Fetch from API when online
        const data = await api.papers.fetch({
          topics: preferredTopics,
          count: prefetchCount,
        });
        
        // Save papers to IndexedDB
        await Promise.all(data.map(paper => savePaper(paper)));
        
        dispatch(setPapers(data));
      } else {
        // Load from IndexedDB when offline
        const cachedPapers = await getPapers();
        dispatch(setPapers(cachedPapers));
      }
    } catch (error) {
      dispatch(setError(error instanceof Error ? error.message : 'Failed to fetch papers'));
    } finally {
      dispatch(setLoading(false));
    }
  }, [dispatch, isOnline, preferredTopics, prefetchCount]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => dispatch(setOnlineStatus(true));
    const handleOffline = () => dispatch(setOnlineStatus(false));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [dispatch]);

  // Initial fetch and refetch when preferences change
  useEffect(() => {
    if (papers.length === 0 || preferredTopics.length > 0) {
      fetchPapers();
    }
  }, [fetchPapers, papers.length, preferredTopics]);

  // Load cached papers when going offline
  useEffect(() => {
    if (!isOnline) {
      getPapers().then(cachedPapers => {
        if (cachedPapers.length > 0) {
          dispatch(setPapers(cachedPapers));
        }
      });
    }
  }, [isOnline, dispatch]);

  return { fetchPapers };
};
