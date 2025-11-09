import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

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
  startTime?: Timestamp;
  endTime?: Timestamp;
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

export type StudentExamStatus = 'completed' | 'graded' | 'suspicious';

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

export interface ExamRoster {
    studentId: string;
    examId: string;
    hasAccess: boolean;
}


// Schema for AI-powered question file processing
export const ProcessQuestionFileInputSchema = z.object({
  fileDataUri: z.string().describe(
    "A data URI of the file content that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
  ),
  fileName: z.string().describe('The name of the uploaded file.'),
});
export type ProcessQuestionFileInput = z.infer<typeof ProcessQuestionFileInputSchema>;

export const ProcessQuestionFileOutputSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string().describe('The text of the question.'),
      options: z.array(z.string()).describe('An array of possible answers.'),
      correctOption: z.number().int().min(0).describe('The index of the correct answer in the options array.'),
      type: z.enum(['mcq', 'coding', 'long-answer']).describe('The type of the question.'),
      difficulty: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of the question.'),
      error: z.string().optional().describe('An error message if the question is missing data.'),
    })
  ).describe('An array of processed exam questions.'),
});
export type ProcessQuestionFileOutput = z.infer<typeof ProcessQuestionFileOutputSchema>;
