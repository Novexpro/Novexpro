"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardIndex from "../../components/Dashboard/DashboardIndex";
import { useAuth } from "@clerk/nextjs";

export default function MarketDashboard() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only run authentication logic after Clerk has loaded
    if (!isLoaded) return;
    
    if (isSignedIn) {
      const onboardingCompleted = localStorage.getItem('onboardingCompleted');
      if (!onboardingCompleted) {
        router.push('/onboarding');
      }
      setIsLoading(false);
    } else {
      // Only redirect if we're sure they're not signed in
      router.push('/auth/sign-in');
    }
  }, [isSignedIn, isLoaded, router]);

  // Show nothing while we're checking authentication
  if (isLoading || !isLoaded) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Only render dashboard if signed in
  if (!isSignedIn) {
    return null;
  }

  return <DashboardIndex />;
}