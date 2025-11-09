import { ExamInterface } from '@/components/student/ExamInterface';

// This is a Server Component.
// It passes the examId to the client component that handles the exam logic.

export default function ExamPage({ params }: { params: { id: string } }) {
  return (
    <ExamInterface examId={params.id} />
  );
}
