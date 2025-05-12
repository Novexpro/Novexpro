import {
  SignUp,
} from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp 
        afterSignUpUrl="/onboarding" 
        signInUrl="/auth/sign-in" 
      />
    </div>
  );
}



