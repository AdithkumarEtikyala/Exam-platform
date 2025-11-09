'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, BookMarked } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from '@/types';

export default function HomePage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();
  const heroImage = PlaceHolderImages.find(img => img.id === 'hero-image');
  const [role, setRole] = useState<UserProfile['role'] | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        try {
          const userDocRef = doc(firestore, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const userProfile = userDoc.data() as UserProfile;
            setRole(userProfile.role);
          } else {
            // User document doesn't exist, treat as logged out for this page's logic
            setRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setRole(null);
        }
      }
      setRoleLoading(false);
    };

    if (!isUserLoading) {
      fetchUserRole();
    }
  }, [user, isUserLoading, firestore]);

  useEffect(() => {
    const isReadyForRedirect = !isUserLoading && !roleLoading;
    if (isReadyForRedirect && user && role) {
      const dashboardUrl = role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard';
      router.push(dashboardUrl);
    }
  }, [user, role, isUserLoading, roleLoading, router]);

  const isLoading = isUserLoading || roleLoading;
  const isAuthenticated = user && role;

  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">{isAuthenticated ? 'Redirecting...' : 'Loading your experience...'}</p>
      </div>
    );
  }
  
  return (
      <div className="flex min-h-screen flex-col">
        <header className="container z-40 bg-background">
            <div className="flex h-20 items-center justify-between py-6">
                 <Link href="/" className="flex items-center space-x-2">
                    <BookMarked className="h-6 w-6 text-primary" />
                    <span className="font-bold">CampusExaminer Pro</span>
                </Link>
                <nav className='space-x-2'>
                    <Button asChild variant="ghost">
                        <Link href="/login">Log In</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/signup">Sign Up</Link>
                    </Button>
                </nav>
            </div>
        </header>
        <main className='flex-1'>
            <section className="container grid items-center gap-6 pb-8 pt-6 md:py-10">
                <div className="flex max-w-[980px] flex-col items-start gap-2">
                    <h1 className="text-3xl font-extrabold leading-tight tracking-tighter md:text-5xl lg:text-6xl font-headline">
                        The Modern Examination <br className="hidden sm:inline" />
                        Platform for Education.
                    </h1>
                    <p className="max-w-[700px] text-lg text-muted-foreground">
                        Streamline your examination process, from creation to evaluation. Built for both faculty and students with a focus on security, ease-of-use, and powerful features.
                    </p>
                </div>
                <div className="flex gap-4">
                    <Button asChild size="lg">
                        <Link href="/signup">Get Started</Link>
                    </Button>
                </div>
                {heroImage && 
                    <div className="mt-8 overflow-hidden rounded-lg border shadow-lg">
                        <Image
                            src={heroImage.imageUrl}
                            alt={heroImage.description}
                            width={1200}
                            height={600}
                            className="w-full object-cover"
                            data-ai-hint={heroImage.imageHint}
                        />
                    </div>
                }
            </section>
        </main>
      </div>
    );
}