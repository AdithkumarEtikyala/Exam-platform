
'use client';

import { useEffect, useReducer, useState, useMemo, useCallback } from 'react';
import type { Exam, StudentAnswer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Check, ChevronLeft, ChevronRight, Flag, Loader2, Monitor, MonitorOff, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { QuestionStatus, Question } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { doc, serverTimestamp } from 'firebase/firestore';
import { useFirestore, useUser, setDocumentNonBlocking, useDoc, useMemoFirebase } from '@/firebase';
import { useFullscreenEnforcement } from '@/hooks/use-fullscreen-enforcement';

type AnswerPayload = 
  | { type: 'mcq', questionId: string; optionIndex: number }
  | { type: 'long-answer', questionId: string; textAnswer: string };

type QuestionForStudent = Omit<Question, 'correctOption'>;
export type ExamForStudent = Omit<Exam, 'questions'> & {
  questions: QuestionForStudent[];
};


// --- State Management ---
type State = {
  currentQuestionIndex: number;
  answers: Map<string, number | string | null>;
  statuses: Map<string, QuestionStatus>;
  timeLeft: number;
  examStarted: boolean;
  examFinished: boolean;
  totalQuestions: number;
};

type Action =
  | { type: 'INITIALIZE'; payload: State }
  | { type: 'START_EXAM' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREV_QUESTION' }
  | { type: 'JUMP_TO_QUESTION'; payload: number }
  | { type: 'ANSWER'; payload: AnswerPayload }
  | { type: 'TOGGLE_MARK_FOR_REVIEW'; payload: string }
  | { type: 'TICK_TIMER' }
  | { type: 'FINISH_EXAM' };

function examReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INITIALIZE':
      return action.payload;
    case 'START_EXAM': {
        if (!state.statuses.size) return { ...state, examStarted: true };
        const firstQuestionId = Array.from(state.statuses.keys())[0];
        
        const newStatuses = new Map(state.statuses);
        if (newStatuses.get(firstQuestionId) === 'not-visited') {
            newStatuses.set(firstQuestionId, 'not-answered');
        }
        return { ...state, examStarted: true, statuses: newStatuses };
    }
    case 'NEXT_QUESTION': {
      const nextIndex = Math.min(state.currentQuestionIndex + 1, state.totalQuestions - 1);
      const questionId = Array.from(state.statuses.keys())[nextIndex];
      const newStatuses = new Map(state.statuses);
      if (newStatuses.get(questionId) === 'not-visited') {
        newStatuses.set(questionId, 'not-answered');
      }
      return { ...state, currentQuestionIndex: nextIndex, statuses: newStatuses };
    }
    case 'PREV_QUESTION': {
      const prevIndex = Math.max(state.currentQuestionIndex - 1, 0);
      return { ...state, currentQuestionIndex: prevIndex };
    }
    case 'JUMP_TO_QUESTION': {
      const questionId = Array.from(state.statuses.keys())[action.payload];
      const newStatuses = new Map(state.statuses);
      if (newStatuses.get(questionId) === 'not-visited') {
        newStatuses.set(questionId, 'not-answered');
      }
      return { ...state, currentQuestionIndex: action.payload, statuses: newStatuses };
    }
    case 'ANSWER': {
      const newAnswers = new Map(state.answers);
      const { payload } = action;
      if (payload.type === 'mcq') {
        newAnswers.set(payload.questionId, payload.optionIndex);
      } else {
        newAnswers.set(payload.questionId, payload.textAnswer);
      }

      const newStatuses = new Map(state.statuses);
      // Only set to answered if not marked for review
      if (newStatuses.get(payload.questionId) !== 'marked-for-review') {
        newStatuses.set(payload.questionId, 'answered');
      }
      return { ...state, answers: newAnswers, statuses: newStatuses };
    }
    case 'TOGGLE_MARK_FOR_REVIEW': {
      const newStatuses = new Map(state.statuses);
      const currentStatus = state.statuses.get(action.payload);
      if (currentStatus === 'marked-for-review') {
        newStatuses.set(action.payload, state.answers.get(action.payload) != null ? 'answered' : 'not-answered');
      } else {
        newStatuses.set(action.payload, 'marked-for-review');
      }
      return { ...state, statuses: newStatuses };
    }
    case 'TICK_TIMER': {
        if (state.timeLeft <= 1) { // Finish when 1 second is left, before it hits 0
            return { ...state, timeLeft: 0, examFinished: true };
        }
        return { ...state, timeLeft: state.timeLeft - 1 };
    }
    case 'FINISH_EXAM':
        return { ...state, examFinished: true, timeLeft: 0 };
    default:
      return state;
  }
}

// --- Components ---

const QuestionPalette = ({ statuses, currentIndex, dispatch }: { statuses: Map<string, QuestionStatus>, currentIndex: number, dispatch: React.Dispatch<Action> }) => {
    const statusArray = Array.from(statuses.entries());
    return (
        <Card>
            <CardHeader><CardTitle>Question Palette</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-5 gap-2">
                {statusArray.map(([questionId, status], index) => (
                    <Button
                        key={questionId}
                        variant={currentIndex === index ? 'default' : 'outline'}
                        className={cn('h-10 w-10 relative', {
                            'bg-green-100 border-green-400 text-green-800 hover:bg-green-200': status === 'answered' && currentIndex !== index,
                            'bg-purple-100 border-purple-400 text-purple-800 hover:bg-purple-200': status === 'marked-for-review' && currentIndex !== index,
                            'bg-gray-100 border-gray-400 text-gray-800 hover:bg-gray-200': status === 'not-answered' && currentIndex !== index,
                            'bg-white border-gray-300 text-gray-600': status === 'not-visited' && currentIndex !== index,
                        })}
                        onClick={() => dispatch({ type: 'JUMP_TO_QUESTION', payload: index })}
                    >
                        {index + 1}
                        {status === 'marked-for-review' && <Flag className="absolute top-0 right-0 h-3 w-3 text-purple-600" fill="currentColor" />}
                        {status === 'answered' && <Check className="absolute bottom-0 right-0 h-3 w-3 text-green-600" />}
                    </Button>
                ))}
            </CardContent>
        </Card>
    );
};

const ExamTimer = ({ timeLeft }: { timeLeft: number }) => {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className={cn("text-2xl font-bold font-mono", timeLeft < 300 && 'text-destructive')}>
      {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
    </div>
  );
};

const FullscreenStatus = ({ isFullscreen, exitCount, maxExits }: { isFullscreen: boolean, exitCount: number, maxExits: number}) => {
  const warningsLeft = maxExits - exitCount;
  return (
    <Card>
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
            {isFullscreen ? <Monitor className="h-5 w-5 text-green-600" /> : <MonitorOff className="h-5 w-5 text-destructive" />}
            <span className={cn("font-semibold", isFullscreen ? "text-green-700" : "text-destructive")}>
                {isFullscreen ? "Full-Screen Active" : "Not in Full-Screen"}
            </span>
        </div>
        <div className="text-right">
            <p className="text-sm font-medium">Warnings: <span className={cn(warningsLeft <= 1 && "text-destructive font-bold")}>{exitCount}/{maxExits}</span></p>
            <p className="text-xs text-muted-foreground">{warningsLeft > 0 ? `${warningsLeft} warnings left` : 'Next exit will submit'}</p>
        </div>
      </CardContent>
    </Card>
  );
};

export function ExamInterface({ examId }: { examId: string }) {
  const { toast } = useToast();
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [examForStudent, setExamForStudent] = useState<ExamForStudent | null>(null);

  const examDocRef = useMemoFirebase(() => doc(firestore, 'exams', examId), [firestore, examId]);
  const { data: examData, isLoading: isExamLoading, error: examError } = useDoc<Exam>(examDocRef);

  useEffect(() => {
      if (examData) {
        const questions = Array.isArray(examData.questions) ? examData.questions : [];
        const questionsForStudent: QuestionForStudent[] = questions.map(q => {
          // Omit correctOption for student exam
          const { correctOption, ...rest } = q;
          return rest;
        });

        const preparedExam: ExamForStudent = {
          ...examData,
          questions: questionsForStudent,
        };
        setExamForStudent(preparedExam);
      } else if (!isExamLoading) {
          setExamForStudent(null);
      }
  }, [examData, isExamLoading]);

  const initialState: State | null = useMemo(() => {
    if (!examForStudent) return null;
    const initialStatuses = new Map(examForStudent.questions.map(q => [q.id, 'not-visited'] as const));
    // Mark first question as not-answered if exam starts
    if(initialStatuses.size > 0) {
        const firstKey = initialStatuses.keys().next().value;
        initialStatuses.set(firstKey, 'not-answered');
    }

    return {
      currentQuestionIndex: 0,
      answers: new Map(),
      statuses: new Map(examForStudent.questions.map(q => [q.id, 'not-visited'])),
      timeLeft: examForStudent.duration * 60,
      examStarted: false,
      examFinished: false,
      totalQuestions: examForStudent.questions.length,
    };
  }, [examForStudent]);

  const [state, dispatch] = useReducer(examReducer, initialState as State);
  
  useEffect(() => {
    if (initialState) {
        dispatch({type: 'INITIALIZE', payload: initialState});
    }
  }, [initialState])

  const handleSubmitExam = useCallback(async (autoSubmitDetails?: { autoSubmitted: boolean, exitCount: number }) => {
    if (!state || !user || !examData || !Array.isArray(examData.questions)) return;
    if (isSubmitting) return;

    setIsSubmitting(true);
    toast({ title: "Submitting exam...", description: "Please wait." });

    try {
        const studentAnswers: StudentAnswer[] = examData.questions.map(q => {
            const answer = state.answers.get(q.id) ?? null;
            let studentAnswer: Partial<StudentAnswer> = {
                questionId: q.id,
                questionText: q.text,
                status: state.statuses.get(q.id) || 'not-visited',
            };

            if (examData.examType === 'mcq') {
                studentAnswer.selectedOption = typeof answer === 'number' ? answer : null;
                studentAnswer.correctOption = q.correctOption ?? null;
                studentAnswer.options = q.options ?? [];
            } else {
                studentAnswer.textAnswer = typeof answer === 'string' ? answer : '';
            }
            return studentAnswer as StudentAnswer;
        });

        const studentExamSubmission: any = {
            studentId: user.uid,
            examId: examId,
            examTitle: examData.title,
            answers: studentAnswers,
            timeFinished: serverTimestamp(),
            ...(autoSubmitDetails && {
                autoSubmitted: autoSubmitDetails.autoSubmitted,
                exitCount: autoSubmitDetails.exitCount,
            }),
        }

        if (examData.examType === 'mcq') {
            let marks = 0;
            examData.questions.forEach((q, index) => {
                const answer = studentAnswers[index];
                if (typeof answer.selectedOption === 'number' && typeof q.correctOption === 'number' && answer.selectedOption === q.correctOption) {
                    marks += 1;
                    studentAnswers[index].marks = 10;
                } else {
                    studentAnswers[index].marks = 0;
                }
            });
            studentExamSubmission.score = (marks / (examData.questions.length || 1)) * 100;
            studentExamSubmission.status = 'graded';
        } else {
            studentExamSubmission.status = 'completed';
        }

        const studentExamDocRef = doc(firestore, 'studentExams', `${user.uid}_${examId}`);
        setDocumentNonBlocking(studentExamDocRef, studentExamSubmission, { merge: true });
        
        dispatch({ type: 'FINISH_EXAM' });

        toast({
            title: "Exam Submitted!",
            description: "Your responses have been recorded.",
            variant: 'default',
        });
        router.push('/student/dashboard');

    } catch (error) {
        console.error("Submission failed", error)
        toast({
            variant: 'destructive',
            title: 'Submission Failed',
            description: 'There was an error submitting your exam. Please try again.',
        });
        setIsSubmitting(false);
    }
  }, [state, user, examData, examId, isSubmitting, toast, firestore, router]);


  const handleAutoSubmit = useCallback(() => {
    const exitCount = parseInt(localStorage.getItem(`fullscreenExitCount_${examId}`) || '0', 10);
    handleSubmitExam({ autoSubmitted: true, exitCount: exitCount });
  }, [examId, handleSubmitExam]);

  const { isFullscreen, exitCount, MAX_EXITS, enterFullscreen } = useFullscreenEnforcement(
      examId, 
      handleAutoSubmit,
      state?.examStarted,
      state?.examFinished
  );

  useEffect(() => {
    if (!state || !state.examStarted || state.examFinished) return;
    const timer = setInterval(() => {
      dispatch({ type: 'TICK_TIMER' });
    }, 1000);
    return () => clearInterval(timer);
  }, [state?.examStarted, state?.examFinished]);
  
  useEffect(() => {
    const header = document.querySelector('.exam-layout-header');
    if (state && state.examStarted) {
        header?.classList.add('hidden');
    }

    return () => {
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(console.error);
        }
        header?.classList.remove('hidden');
    };
  }, [state?.examStarted]);
  
  useEffect(() => {
    if(state && state.timeLeft <= 0 && !state.examFinished) {
        const currentExitCount = parseInt(localStorage.getItem(`fullscreenExitCount_${examId}`) || '0', 10);
        handleSubmitExam({ autoSubmitted: true, exitCount: currentExitCount });
    }
  }, [state?.timeLeft, state?.examFinished, handleSubmitExam, examId]);


  if (isExamLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Loading Exam...</p>
      </div>
    );
  }

  if (examError) {
      return (
          <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center">
              <h2 className="text-2xl font-bold text-destructive">Error Loading Exam</h2>
              <p className="mt-2 text-muted-foreground">There was a problem fetching the exam data. It might be due to a network issue or insufficient permissions.</p>
          </div>
      )
  }

  if (!examForStudent || !state) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center">
            <h2 className="text-2xl font-bold">Exam Not Found</h2>
            <p className="mt-2 text-muted-foreground">The exam you are looking for does not exist or has been removed.</p>
        </div>
    );
  }

  const currentQuestion = examForStudent.questions[state.currentQuestionIndex];

  if (!state.examStarted) {
      return (
          <div className="container flex items-center justify-center min-h-[calc(100vh-4rem)]">
            <Card className="w-full max-w-2xl text-center">
                <CardHeader>
                    <CardTitle className="text-3xl">{examForStudent.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>{examForStudent.description}</p>
                    <div className="flex justify-center gap-8 text-lg">
                        <p><strong>Duration:</strong> {examForStudent.duration} minutes</p>
                        <p><strong>Questions:</strong> {examForStudent.questions.length}</p>
                    </div>
                    <p className="text-sm text-muted-foreground">This exam will be conducted in fullscreen mode.</p>
                    <Button size="lg" onClick={() => {
                        enterFullscreen();
                        dispatch({type: 'START_EXAM'});
                    }}>Start Exam</Button>
                </CardContent>
            </Card>
          </div>
      );
  }

  if (state.examFinished) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">{isSubmitting ? "Submitting your exam..." : "Exam Finished!"}</p>
        </div>
    );
  }

  if (state.examStarted && !isFullscreen) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <AlertTriangle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-2xl font-bold">You have left full-screen mode.</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          To continue the exam, you must return to full-screen. Please be aware that exiting full-screen mode multiple times will result in the automatic submission of your exam.
        </p>
        <p className="font-bold text-lg mt-4">
          Warnings used: <span className="text-destructive">{exitCount} / {MAX_EXITS}</span>
        </p>
        <Button onClick={enterFullscreen} size="lg" className="mt-6">
          Return to Fullscreen
        </Button>
      </div>
    );
  }


  return (
    <div className="grid lg:grid-cols-12 gap-8 p-8 h-screen bg-muted/20">
      {/* Left Panel: Question */}
      <div className="lg:col-span-8 flex flex-col">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-4">Question {state.currentQuestionIndex + 1} of {examForStudent.questions.length}</h2>
          <Card className="h-full">
            <CardContent className="p-6 text-lg">
              <p className="mb-6">{currentQuestion.text}</p>
              {examForStudent.examType === 'mcq' && currentQuestion.options && (
                <RadioGroup
                  value={(state.answers.get(currentQuestion.id) as number | undefined)?.toString()}
                  onValueChange={(value) => dispatch({ type: 'ANSWER', payload: { type: 'mcq', questionId: currentQuestion.id, optionIndex: parseInt(value) }})}
                >
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2 rounded-md border p-4 has-[:checked]:bg-primary/10 has-[:checked]:border-primary">
                      <RadioGroupItem value={index.toString()} id={`q${state.currentQuestionIndex}-o${index}`} />
                      <label htmlFor={`q${state.currentQuestionIndex}-o${index}`} className="flex-1 cursor-pointer">{option}</label>
                    </div>
                  ))}
                </RadioGroup>
              )}
               {examForStudent.examType === 'long-answer' && (
                <div>
                  <div className='bg-blue-50 border-l-4 border-blue-400 text-blue-700 p-4 rounded-md mb-4 text-sm'>
                    <p className='font-bold'>Write your answer below:</p>
                    <ul className='list-disc list-inside mt-2'>
                        <li>Your response will be manually evaluated by the faculty.</li>
                        <li>Please ensure your answer is complete and accurate before submitting.</li>
                        <li>Click Submit when you are ready. No automatic checking will be performed.</li>
                    </ul>
                  </div>
                  <Textarea
                    value={(state.answers.get(currentQuestion.id) as string) || ''}
                    onChange={(e) => dispatch({ type: 'ANSWER', payload: { type: 'long-answer', questionId: currentQuestion.id, textAnswer: e.target.value }})}
                    className="min-h-[200px] text-base"
                    placeholder="Type your answer here..."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex justify-between items-center mt-4">
            <Button variant="outline" onClick={() => dispatch({ type: 'PREV_QUESTION' })} disabled={state.currentQuestionIndex === 0}>
                <ChevronLeft className="mr-2 h-4 w-4" /> Previous
            </Button>
            <Button variant="outline" onClick={() => dispatch({ type: 'TOGGLE_MARK_FOR_REVIEW', payload: currentQuestion.id })}>
                <Flag className="mr-2 h-4 w-4" /> Mark for Review
            </Button>
            <Button onClick={() => dispatch({ type: 'NEXT_QUESTION' })} disabled={state.currentQuestionIndex === examForStudent.questions.length - 1}>
                Next <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
        </div>
      </div>
      
      {/* Right Panel: Palette & Controls */}
      <div className="lg:col-span-4 flex flex-col gap-8">
        <Card>
            <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Time Left</CardTitle>
                <ExamTimer timeLeft={state.timeLeft} />
            </CardHeader>
        </Card>
        
        <FullscreenStatus 
            isFullscreen={isFullscreen} 
            exitCount={exitCount} 
            maxExits={MAX_EXITS} 
        />

        <QuestionPalette statuses={state.statuses} currentIndex={state.currentQuestionIndex} dispatch={dispatch} />
        
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="lg" disabled={isSubmitting}>
                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                   End Exam
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure you want to end the exam?</AlertDialogTitle>
                    <AlertDialogDescription>
                        You have answered {Array.from(state.statuses.values()).filter(s => s === 'answered').length} out of {examForStudent.questions.length} questions. You cannot change your answers after submitting.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Return to Exam</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleSubmitExam({ autoSubmitted: false, exitCount: exitCount })} disabled={isSubmitting}>
                        {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
