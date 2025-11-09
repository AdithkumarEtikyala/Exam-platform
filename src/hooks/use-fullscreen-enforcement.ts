
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

const MAX_EXITS = 3; // Auto-submits on the 4th exit

export function useFullscreenEnforcement(
  examId: string, 
  onAutoSubmit: () => void, 
  examStarted: boolean, 
  examFinished: boolean
) {
  const { toast } = useToast();
  const storageKey = `fullscreenExitCount_${examId}`;
  
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [isPageVisible, setIsPageVisible] = useState(true);
  
  const [exitCount, setExitCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(storageKey) || '0', 10);
  });

  const [warningIssued, setWarningIssued] = useState(false);

  const enterFullscreen = useCallback(() => {
    const element = document.documentElement;
    if (element.requestFullscreen) {
      element.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        toast({
          variant: 'destructive',
          title: 'Could not enter full-screen',
          description: 'Please enable full-screen mode in your browser to start the exam.'
        });
      });
    }
  }, [toast]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement != null);
    };

    const handleVisibilityChange = () => {
      setIsPageVisible(document.visibilityState === 'visible');
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    handleFullscreenChange();
    handleVisibilityChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!examStarted || examFinished) return;

    const isSecure = isFullscreen && isPageVisible;

    if (isSecure) {
      setWarningIssued(false);
    } else {
      if (!warningIssued) {
        const newCount = exitCount + 1;
        setExitCount(newCount);
        localStorage.setItem(storageKey, newCount.toString());
        
        setWarningIssued(true);

        if (newCount > MAX_EXITS) {
          toast({
              variant: 'destructive',
              title: 'Auto-Submitting Exam',
              description: `You have left the secure exam environment more than ${MAX_EXITS} times.`,
          });
          onAutoSubmit();
        } else {
          const warnings = [
              'Please stay in the secure exam environment.',
              'You will be auto-submitted if you leave again.',
              `Next exit will auto-submit your exam.`,
          ];
          toast({
              variant: 'destructive',
              title: `Secure Environment Exit Detected (Warning ${newCount}/${MAX_EXITS})`,
              description: warnings[newCount - 1] || 'You must remain in fullscreen and keep the tab active.',
          });
        }
      }
    }
  }, [isFullscreen, isPageVisible, examStarted, examFinished, onAutoSubmit, storageKey, toast, exitCount, warningIssued]);


  useEffect(() => {
    return () => {
      if (examFinished) {
        localStorage.removeItem(storageKey);
      }
    };
  }, [examFinished, storageKey]);

  return { isFullscreen, isPageVisible, exitCount, MAX_EXITS, enterFullscreen };
}
