"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import OnboardingForm from "../../components/Dashboard/OnboardingForm";

export default function OnboardingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only run authentication logic after Clerk has loaded
    if (!isLoaded) return;
    
    if (isSignedIn) {
      // Check if onboarding was already completed
      const onboardingCompleted = localStorage.getItem('onboardingCompleted');
      if (onboardingCompleted) {
        // If already completed, redirect to dashboard
        router.push('/dashboard');
      } else {
        setIsLoading(false);
      }
    } else {
      // Redirect to sign-in if not authenticated
      router.push('/auth/sign-in');
    }
  }, [isSignedIn, isLoaded, router]);

  const handleOnboardingComplete = () => {
    // Store the onboarding status in localStorage
    localStorage.setItem('onboardingCompleted', 'true');
    // Redirect to dashboard
    router.push('/dashboard');
  };

  // Show loading while checking authentication
  if (isLoading || !isLoaded) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Only render if signed in
  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <OnboardingForm onClose={handleOnboardingComplete} />
    </div>
  );
} 