import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-4 text-xl text-foreground/70">Generating your report...</p>
    </div>
  );
}