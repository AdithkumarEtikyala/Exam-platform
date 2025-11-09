'use client';

import { useUser, useFirestore } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode, useState } from 'react';
import { UserRole, UserProfile } from '@/types';
import { Loader2 } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';

interface AuthGuardProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function AuthGuard({ children, allowedRoles }: AuthGuardProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        } else {
          // User doc not found, maybe sign out
          router.push('/login');
        }
      }
      setProfileLoading(false);
    };

    if (!isUserLoading) {
      fetchProfile();
    }
  }, [user, isUserLoading, firestore, router]);

  useEffect(() => {
    if (!isUserLoading && !profileLoading) {
      if (!user) {
        router.push('/login');
      } else if (userProfile && !allowedRoles.includes(userProfile.role)) {
        const home = userProfile.role === 'faculty' ? '/faculty/dashboard' : '/student/dashboard';
        router.push(home);
      }
    }
  }, [user, userProfile, isUserLoading, profileLoading, router, allowedRoles]);

  const isLoading = isUserLoading || profileLoading;
  const isAllowed = userProfile && allowedRoles.includes(userProfile.role);

  if (isLoading || !isAllowed) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Verifying access...</p>
      </div>
    );
  }

  return <>{children}</>;
}
