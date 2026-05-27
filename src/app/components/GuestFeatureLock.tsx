import { Lock } from 'lucide-react';

interface GuestFeatureLockProps {
  onSignUp: () => void;
}

export function GuestFeatureLock({ onSignUp }: GuestFeatureLockProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background p-8 text-center animate-in fade-in zoom-in-95 duration-500 w-full h-full">
      <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6 shadow-inner">
        <Lock className="w-10 h-10 text-primary" />
      </div>
      <h2 className="text-3xl font-black text-foreground mb-4 tracking-tight">Want to access this feature?</h2>
      <p className="text-muted-foreground text-lg mb-8 max-w-md leading-relaxed">
        Join our community to save papers, build your library, and collaborate with other researchers worldwide.
      </p>
      <button
        onClick={onSignUp}
        className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-primary/20 hover:scale-105 active:scale-95"
      >
        Click here to create account
      </button>
    </div>
  );
}
