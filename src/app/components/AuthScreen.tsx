import { useState } from 'react';
import { Mail, Lock, User, ArrowRight, Loader2 } from 'lucide-react';
import { BASE_URL } from '../services/api';
import { BrandLogo } from './BrandLogo';
import { auth } from '../services/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

interface AuthScreenProps {
  onLogin: (token: string, user: any) => void;
}

export function AuthScreen({ onLogin }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isForgot, setIsForgot] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (isForgot) {
        const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newPassword }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Reset failed');
        setSuccess('Password updated! You can now login.');
        setIsForgot(false);
        setPassword(newPassword);
        return;
      }

      const body = isLogin ? { email, password } : { name, email, password };
      const res = await fetch(`${BASE_URL}/auth/${isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      
      const res = await fetch(`${BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed');
      }

      onLogin(data.token, data.user);
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden font-['Outfit']">
      {/* Animated Brand Background */}
      <div className="absolute inset-0 z-0 brand-animated-bg"></div>

      <div className="w-full max-w-6xl px-6 relative z-10 flex flex-col lg:flex-row items-center justify-between gap-20">

        {/* Brand Section */}
        <div className="flex-1 text-center lg:text-left animate-in fade-in slide-in-from-top-4 duration-1000">

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 leading-none flex items-center justify-center lg:justify-start">
            <BrandLogo isAuthScreen={true} />
          </h1>

          {/* THE QUOTE - Highlighted elegantly */}
          <div className="relative inline-block mb-8">
            <p className="text-2xl md:text-4xl font-light text-white/90 italic leading-tight">
              "Because <span className="text-blue-400 font-bold">Curiosity</span> lies within"
            </p>
            <div className="absolute -bottom-2 left-0 w-24 h-1 bg-gradient-to-r from-blue-500 to-transparent"></div>
          </div>

          <p className="text-lg text-white/40 font-medium max-w-lg leading-relaxed hidden md:block">
            Join a global network of researchers pushing the boundaries of human knowledge with integrated AI assistance.
          </p>
        </div>

        {/* Auth Interface */}
        <div className="w-full max-w-[440px] bg-slate-900 border border-slate-800 rounded-[48px] p-10 md:p-12 shadow-2xl animate-in fade-in zoom-in-95 duration-1000">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-white mb-2">
              {isLogin ? 'Portal Access' : 'Begin Journey'}
            </h2>
            <p className="text-white/40 text-sm font-medium">
              {isLogin ? 'Enter your credentials to synchronize data.' : 'Create your researcher profile today.'}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 text-red-200 text-xs rounded-2xl border border-red-500/20 backdrop-blur-md animate-in slide-in-from-top-4">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-500/10 text-emerald-200 text-xs rounded-2xl border border-emerald-500/20 backdrop-blur-md animate-in slide-in-from-top-4">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && !isForgot && (
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full pl-14 pr-6 py-4.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/10 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                    placeholder="Researcher Name"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-widest ml-1">Email Terminal</label>
              <div className="relative group">
                <Mail className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-14 pr-6 py-4.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/10 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="name@institution.edu"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                  {isForgot ? 'Override Code' : 'Access Key'}
                </label>
                {!isForgot && isLogin && (
                  <button
                    type="button"
                    onClick={() => setIsForgot(true)}
                    className="text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-wider"
                  >
                    Lost Key?
                  </button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="password"
                  required
                  value={isForgot ? newPassword : password}
                  onChange={e => isForgot ? setNewPassword(e.target.value) : setPassword(e.target.value)}
                  className="w-full pl-14 pr-6 py-4.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-white/10 focus:ring-2 focus:ring-blue-500/50 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> {isForgot ? 'Override Security' : (isLogin ? 'Initialize Portal' : 'Register Fellowship')}</>}
            </button>
          </form>

          {!isForgot && (
            <div className="mt-6 flex flex-col items-center">
              <div className="relative w-full flex items-center justify-center my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative px-3 bg-slate-900 text-xs font-medium text-white/30 tracking-widest uppercase">
                  OR
                </div>
              </div>
              <button
                onClick={handleGoogleSignIn}
                type="button"
                disabled={loading}
                className="w-full py-5 bg-white text-slate-900 hover:bg-slate-200 rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-2xl transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4" />
                Sign in with Google
              </button>
            </div>
          )}

          <div className="mt-10 pt-10 border-t border-white/5 text-center">
            <button
              onClick={() => { setIsLogin(!isLogin); setIsForgot(false); setError(''); }}
              className="text-white/30 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
            >
              {isLogin ? (
                <>New to the network? <span className="text-blue-400">Apply for Fellowship</span></>
              ) : (
                <>Returning fellow? <span className="text-blue-400">Initialize Access</span></>
              )}
              {isForgot && <div className="mt-2 text-blue-400 underline underline-offset-4">Return to Login</div>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
