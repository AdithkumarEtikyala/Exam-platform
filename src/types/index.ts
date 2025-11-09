import type { Timestamp } from 'firebase/firestore';

export type UserRole = 'student' | 'faculty';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Question {
  id:string;
  text: string;
  // MCQ specific fields
  options?: string[];
  correctOption?: number;
}

export type ExamType = 'mcq' | 'coding' | 'long-answer';

export interface Exam {
  id: string;
  title: string;
  description: string;
  facultyId: string;
  duration: number; // in minutes
  examType: ExamType;
  questions: Question[];
  createdAt: Timestamp;
  // Fields for 'coding' exam type
  problemStatement?: string;
  language?: 'python' | 'javascript' | 'java' | 'cpp';
  defaultCode?: string;
}

export type QuestionStatus = 'answered' | 'not-answered' | 'marked-for-review' | 'not-visited';

export interface StudentAnswer {
  questionId: string;
  questionText: string; // Storing the question text for grading context
  status: QuestionStatus;
  marks?: number; // Marks assigned by faculty for this specific answer
  // Answer for MCQ
  selectedOption?: number | null;
  correctOption?: number | null; // Storing the correct option for grading context
  options?: string[]; // Storing the options for grading context
  // Answer for "Answer the Question" or "Coding"
  textAnswer?: string;
}

export type StudentExamStatus = 'completed' | 'graded';

export interface StudentExam {
  id: string;
  studentId: string;
  examId: string;
  examTitle: string;
  status: StudentExamStatus;
  answers: StudentAnswer[];
  score?: number; // Overall score, as a percentage
  timeFinished?: Timestamp;
  // Fields for fullscreen enforcement
  autoSubmitted?: boolean;
  exitCount?: number;
}
