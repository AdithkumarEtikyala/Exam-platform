'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { serverTimestamp } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection } from 'firebase/firestore';
import { PlusCircle, Loader2 } from 'lucide-react';
import { Exam } from '@/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

const formSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().optional(),
  duration: z.coerce.number().int().min(1, { message: 'Duration must be at least 1 minute.' }),
  examType: z.enum(['mcq', 'coding', 'long-answer'], { required_error: 'Exam type is required.' }),
  // Optional fields for coding exams
  problemStatement: z.string().optional(),
  language: z.enum(['python', 'javascript', 'java', 'cpp']).optional(),
  defaultCode: z.string().optional(),
});

export function CreateExam() {
  const router = useRouter();
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [examType, setExamType] = useState<'mcq' | 'coding' | 'long-answer' | undefined>();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      duration: 60,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: 'destructive', title: 'You must be logged in to create an exam.' });
      return;
    }
    setIsLoading(true);
    try {
      const newExam: Omit<Exam, 'id' | 'createdAt'> = {
        title: values.title,
        description: values.description || '',
        duration: values.duration,
        examType: values.examType,
        facultyId: user.uid,
        questions: [],
        ...(values.examType === 'coding' && {
            problemStatement: values.problemStatement,
            language: values.language,
            defaultCode: values.defaultCode,
        })
      };
      
      const examsCollection = collection(firestore, 'exams');
      const docRef = await addDocumentNonBlocking(examsCollection, {
        ...newExam,
        createdAt: serverTimestamp(),
      });

      if (docRef) {
        toast({ title: 'Exam Created', description: 'Redirecting to exam editor...' });
        setOpen(false);
        form.reset();
        setExamType(undefined);
        // For non-coding exams, we redirect to add questions. Coding exam details are already added.
        if (values.examType !== 'coding') {
          router.push(`/faculty/exam/${docRef.id}`);
        } else {
            router.push(`/faculty/dashboard`); // Or maybe to the editor too? For now, dashboard.
        }

      } else {
          throw new Error("Failed to get document reference after creation.");
      }
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error creating exam', description: 'Please try again.' });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }
  
  const handleExamTypeChange = (value: 'mcq' | 'coding' | 'long-answer') => {
      setExamType(value);
      form.setValue('examType', value);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
            form.reset();
            setExamType(undefined);
        }
    }}>
      <DialogTrigger asChild>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create New Exam
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Exam</DialogTitle>
          <DialogDescription>
            Fill in the details for your new exam. You can add questions in the next step for MCQ/Long-Answer types.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                 <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Exam Title</FormLabel>
                        <FormControl>
                        <Input placeholder="e.g., Mid-Term Biology" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                            <Textarea placeholder="A brief description of the exam." {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="examType"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Exam Type</FormLabel>
                            <Select onValueChange={handleExamTypeChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select an exam type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="mcq">MCQ</SelectItem>
                                <SelectItem value="coding">Coding</SelectItem>
                                <SelectItem value="long-answer">Answer the Question</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                        <FormItem>
                            <FormLabel>Duration (in minutes)</FormLabel>
                            <FormControl>
                            <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                </div>

                {examType === 'coding' && (
                    <div className='space-y-4 p-4 border rounded-md bg-muted/50'>
                        <h3 className='text-lg font-medium'>Coding Problem Details</h3>
                         <FormField
                            control={form.control}
                            name="problemStatement"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Problem Statement</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Describe the coding challenge..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="language"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Language</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="javascript">JavaScript</SelectItem>
                                        <SelectItem value="python">Python</SelectItem>
                                        <SelectItem value="java">Java</SelectItem>
                                        <SelectItem value="cpp">C++</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="defaultCode"
                            render={({ field }) => (
                            <FormItem>
                                <FormLabel>Default Code Snippet</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Provide starter code for the student..." {...field} className="font-code" rows={6}/>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                )}

                <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isLoading ? 'Creating...' : 'Create Exam'}
                    </Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
