'use client';

import { useMemo, useEffect, useState } from 'react';
import { collection, query, where, orderBy, getDocs, Query } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { StudentExam, UserProfile, Exam } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Award, BookOpenCheck, User, Clock, Mail } from 'lucide-react';
import { format } from 'date-fns';

export function ExamResults() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [facultyExams, setFacultyExams] = useState<Exam[]>([]);
  const [isLoadingFacultyExams, setIsLoadingFacultyExams] = useState(true);

  // 1. Fetch all exams created by the current faculty member
  useEffect(() => {
    if (!user) {
        setIsLoadingFacultyExams(false);
        return;
    };
    const fetchExams = async () => {
      setIsLoadingFacultyExams(true);
      const examsQuery = query(collection(firestore, 'exams'), where('facultyId', '==', user.uid));
      const examsSnapshot = await getDocs(examsQuery);
      const exams: Exam[] = examsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Exam));
      setFacultyExams(exams);
      setIsLoadingFacultyExams(false);
    };
    fetchExams();
  }, [user, firestore]);

  const examIds = useMemo(() => facultyExams.map(exam => exam.id), [facultyExams]);

  // 2. Fetch student submissions, but only for the exams belonging to this faculty
  const studentExamsQuery = useMemoFirebase(() => {
    if (!user || examIds.length === 0) return null;
    return query(
      collection(firestore, 'studentExams'),
      where('examId', 'in', examIds),
      orderBy('timeFinished', 'desc')
    );
  }, [firestore, user, examIds]);

  const usersQuery = useMemoFirebase(() => {
    if(!user) return null;
    return collection(firestore, 'users');
  }, [firestore, user]);

  const { data: studentExams, isLoading: isLoadingExams } = useCollection<StudentExam>(studentExamsQuery);
  const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

  const userMap = useMemo(() => {
    if (!users) return new Map();
    return new Map(users.map(user => [user.id, user]));
  }, [users]);
  
  const isLoading = isLoadingFacultyExams || (examIds.length > 0 && isLoadingExams) || isLoadingUsers;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center">
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
                <Skeleton className="h-5 w-1/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!studentExams || studentExams.length === 0) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Student Results</CardTitle>
                <CardDescription>View real-time results from student exam submissions.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12 text-center">
                    <BookOpenCheck className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No student submissions yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Results for your exams will appear here as students complete them.</p>
                </div>
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
        <CardHeader>
            <CardTitle>Student Results</CardTitle>
            <CardDescription>View real-time results from student exam submissions.</CardDescription>
        </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><User className="inline-block mr-2" />Student</TableHead>
              <TableHead><Mail className="inline-block mr-2" />Email</TableHead>
              <TableHead><BookOpenCheck className="inline-block mr-2" />Exam</TableHead>
              <TableHead><Clock className="inline-block mr-2" />Completed</TableHead>
              <TableHead className="text-right"><Award className="inline-block mr-2" />Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {studentExams.map(exam => {
              const student = userMap.get(exam.studentId);
              return (
                <TableRow key={exam.id}>
                  <TableCell className="font-medium">{student?.name || 'Unknown Student'}</TableCell>
                  <TableCell>{student?.email || 'N/A'}</TableCell>
                  <TableCell>{exam.examTitle || 'Untitled Exam'}</TableCell>
                  <TableCell>{exam.timeFinished ? format(exam.timeFinished.toDate(), 'PPp') : 'N/A'}</TableCell>
                  <TableCell className="text-right font-bold">{exam.score?.toFixed(0) ?? 'N/A'}%</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
