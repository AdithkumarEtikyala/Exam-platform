
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
  
  // State to track if the user is currently in fullscreen mode.
  const [isFullscreen, setIsFullscreen] = useState(true);
  
  // State for the number of times the user has exited fullscreen.
  // Initialized from localStorage to persist across refreshes.
  const [exitCount, setExitCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return parseInt(localStorage.getItem(storageKey) || '0', 10);
  });

  // State to track if a warning has been issued for the current exit.
  // This prevents multiple warnings for a single exit event.
  const [warningIssued, setWarningIssued] = useState(false);

  // Callback to enter fullscreen mode.
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

  // Effect to handle fullscreen change events.
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = document.fullscreenElement != null;
      setIsFullscreen(isCurrentlyFullscreen);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    // Initial check in case component mounts while already in fullscreen
    handleFullscreenChange();

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // Core logic to handle warnings and auto-submission.
  useEffect(() => {
    // Only run the logic if the exam is active.
    if (!examStarted || examFinished) return;

    if (isFullscreen) {
      // User has entered or is in fullscreen, so we reset the warning flag.
      // This allows a new warning to be issued if they exit again.
      setWarningIssued(false);
    } else {
      // User has exited fullscreen.
      // Check if a warning has NOT already been issued for this specific exit.
      if (!warningIssued) {
        const newCount = exitCount + 1;
        setExitCount(newCount);
        localStorage.setItem(storageKey, newCount.toString());
        
        // Mark that we've issued a warning for this exit to prevent re-triggering.
        setWarningIssued(true);

        if (newCount > MAX_EXITS) {
          toast({
              variant: 'destructive',
              title: 'Auto-Submitting Exam',
              description: `You have exited full-screen mode more than ${MAX_EXITS} times.`,
          });
          onAutoSubmit();
        } else {
          const warnings = [
              'Please stay in full-screen mode.',
              'You will be auto-submitted if you leave again.',
              `Next exit will auto-submit your exam.`,
          ];
          toast({
              variant: 'destructive',
              title: `Full-Screen Exit Detected (Warning ${newCount}/${MAX_EXITS})`,
              description: warnings[newCount - 1] || 'You must remain in fullscreen.',
          });
        }
      }
    }
  // This effect depends on the fullscreen status and whether the exam is active.
  }, [isFullscreen, examStarted, examFinished, onAutoSubmit, storageKey, toast, exitCount, warningIssued]);


  // Effect to automatically enter fullscreen when the exam starts.
  useEffect(() => {
    if (examStarted && !isFullscreen) {
      enterFullscreen();
    }
  }, [examStarted, isFullscreen, enterFullscreen]);

  // Effect to clean up localStorage on unmount if the exam is finished.
  useEffect(() => {
    return () => {
      if (examFinished) {
        localStorage.removeItem(storageKey);
      }
    };
  }, [examFinished, storageKey]);

  return { isFullscreen, exitCount, MAX_EXITS, enterFullscreen };
}
