import React, { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';
import { ArrowRight, Globe, Search, Brain, Users, Sparkles, ChevronRight } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
  onGuestAccess: () => void;
}

export function LandingPage({ onGetStarted, onGuestAccess }: LandingPageProps) {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="relative min-h-screen text-white overflow-hidden font-['Outfit'] flex flex-col selection:bg-indigo-500/30">
      {/* Animated Brand Background */}
      <div className="absolute inset-0 z-0 brand-animated-bg pointer-events-none"></div>

      {/* Dynamic Cursor Glow */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300 opacity-50"
        style={{
          background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(79, 70, 229, 0.1), transparent 40%)`
        }}
      />

      {/* Abstract Background Elements */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none mix-blend-screen" />
      
      {/* Subtle Grid */}
      <div className="absolute inset-0 z-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA0MCAwIEwgMCAwIDAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50 mask-image-gradient" />

      {/* Header / Navbar */}
      <div className="relative z-20 w-full max-w-7xl mx-auto pt-6 px-6">
        <header className="flex items-center justify-between px-8 py-4 bg-white rounded-full shadow-2xl shadow-black/20">
          <div className="origin-left">
            <BrandLogo isAuthScreen={true} className="text-3xl md:text-5xl font-black tracking-tight" />
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={onGuestAccess}
              className="text-base md:text-lg font-semibold text-slate-600 hover:text-black transition-colors hidden sm:block"
            >
              Explore as Guest
            </button>
            <button 
              onClick={onGetStarted}
              className="text-base md:text-lg font-bold bg-slate-900 text-white px-8 py-3.5 rounded-full hover:bg-black transition-all active:scale-95 shadow-[0_4px_14px_0_rgb(0,0,0,0.39)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.23)] hover:-translate-y-0.5"
            >
              Sign In
            </button>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-12 pb-24 max-w-7xl mx-auto w-full text-center">
        
        {/* Badge removed as requested */}

        {/* Hero Title */}
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight mb-6 leading-[1.1]">
          Accelerate your <br className="hidden md:block" />
          <span className="text-black drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
            discovery process.
          </span>
        </h1>

        {/* Hero Subtitle */}
        <p className="text-lg md:text-2xl text-white/70 max-w-3xl mx-auto mb-12 font-medium leading-relaxed drop-shadow-sm">
          The all-in-one workspace for researchers. Leverage advanced AI to synthesize papers, uncover insights, and collaborate with brilliant minds worldwide.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mt-4">
          <button
            onClick={onGetStarted}
            className="w-full sm:w-auto px-8 py-4 bg-white text-black hover:bg-gray-100 rounded-full font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:-translate-y-1 group"
          >
            Start researching
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button
            onClick={onGuestAccess}
            className="w-full sm:w-auto px-8 py-4 bg-transparent hover:bg-white/5 text-white rounded-full font-semibold text-base border border-white/20 backdrop-blur-md transition-all active:scale-95 flex items-center justify-center gap-2 hover:-translate-y-1 group"
          >
            Try without account
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-white/50" />
          </button>
        </div>

        {/* Dashboard Preview / Abstract Visual */}
        <div className="mt-24 w-full max-w-5xl relative perspective-[2000px] hidden md:block group/mockup">
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent z-20 translate-y-20 h-[150%] mix-blend-multiply" />
          <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl p-2 shadow-2xl transform rotate-x-[15deg] scale-95 hover:rotate-x-0 hover:scale-100 transition-all duration-700 ease-out z-10 relative">
            <div className="rounded-xl overflow-hidden border border-white/5 bg-[#0a0a0a] relative flex flex-col h-[400px]">
              {/* Light Mode Overlay (Reveals on Hover) */}
              <div className="absolute inset-0 bg-white z-50 opacity-0 group-hover/mockup:opacity-100 transition-opacity duration-700 flex flex-col pointer-events-none text-left">
                <div className="h-12 border-b border-gray-200 flex items-center px-4 gap-2 bg-gray-50 shadow-sm">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-emerald-400" />
                  <div className="ml-auto text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Search className="w-4 h-4 text-blue-500" /> Paper Details
                  </div>
                </div>
                <div className="flex-1 p-8 flex flex-col items-start justify-start bg-white relative">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-100 text-blue-700 text-xs font-bold mb-4">
                    Computer Science - AI
                  </div>
                  <h2 className="text-3xl font-black text-gray-900 mb-2 tracking-tight leading-tight">Attention Is All You Need</h2>
                  <p className="text-gray-500 text-sm font-medium mb-6">Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit...</p>
                  
                  <h3 className="text-sm font-bold text-gray-800 mb-2 uppercase tracking-widest">Abstract</h3>
                  <p className="text-gray-600 text-sm leading-relaxed max-w-2xl text-justify">
                    The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms...
                  </p>
                  
                  <div className="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200">
                    <Brain className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Fake Top Bar */}
              <div className="h-12 border-b border-white/5 flex items-center px-4 gap-2 bg-white/[0.02]">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                  <div className="w-3 h-3 rounded-full bg-white/10" />
                </div>
                <div className="mx-auto w-1/3 h-6 bg-white/5 rounded-md" />
              </div>
              {/* Fake Content */}
              <div className="flex-1 p-6 flex gap-6">
                <div className="w-1/4 flex flex-col gap-4">
                  <div className="h-8 w-3/4 bg-white/5 rounded-md group-hover/mockup:bg-white/10 transition-colors duration-500" />
                  <div className="h-4 w-full bg-white/5 rounded-md group-hover/mockup:translate-x-2 transition-transform duration-500 delay-75" />
                  <div className="h-4 w-5/6 bg-white/5 rounded-md group-hover/mockup:translate-x-2 transition-transform duration-500 delay-100" />
                  <div className="h-4 w-4/6 bg-white/5 rounded-md group-hover/mockup:translate-x-2 transition-transform duration-500 delay-150" />
                </div>
                <div className="w-3/4 flex flex-col gap-4">
                  <div className="h-48 w-full bg-gradient-to-br from-indigo-500/10 to-blue-500/10 rounded-xl border border-white/5 relative overflow-hidden flex items-center justify-center group-hover/mockup:border-indigo-500/30 transition-colors duration-500">
                     <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAyMCAwIEwgMCAwIDAgMjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50 group-hover/mockup:opacity-100 transition-opacity duration-1000 group-hover/mockup:scale-[1.02]" />
                     <Brain className="w-16 h-16 text-indigo-400/50 group-hover/mockup:text-indigo-400 group-hover/mockup:scale-110 transition-all duration-700 animate-pulse group-hover/mockup:animate-none" />
                  </div>
                  <div className="flex gap-4">
                    <div className="h-24 flex-1 bg-white/5 rounded-xl border border-white/5 group-hover/mockup:-translate-y-1 transition-transform duration-500 delay-100" />
                    <div className="h-24 flex-1 bg-white/5 rounded-xl border border-white/5 group-hover/mockup:-translate-y-1 transition-transform duration-500 delay-200" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section className="relative z-20 w-full bg-black/20 backdrop-blur-sm border-t border-white/5 pt-24 pb-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Built for modern researchers</h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">Everything you need to discover, understand, and organize scientific knowledge in one unified platform.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard 
              icon={<Search />}
              title="Semantic Discovery"
              description="Go beyond keyword search. Find highly relevant papers based on contextual meaning and conceptual overlap."
              colorClass="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-cyan-400"
              glowColor="bg-cyan-500"
            />
            <FeatureCard 
              icon={<Brain />}
              title="AI Assistant"
              description="Chat with any paper. Extract methodologies, summarize findings, and clarify complex math instantly."
              colorClass="bg-gradient-to-br from-purple-500/20 to-fuchsia-500/20 border-purple-500/30 text-fuchsia-400"
              glowColor="bg-fuchsia-500"
            />
            <FeatureCard 
              icon={<Users />}
              title="Collaborative Hub"
              description="Share libraries, annotate papers together, and discuss findings with your peers in real-time."
              colorClass="bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30 text-emerald-400"
              glowColor="bg-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Global styles for custom mask */}
      <style dangerouslySetInnerHTML={{__html: `
        .mask-image-gradient {
          mask-image: radial-gradient(circle at center, black, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black, transparent 80%);
        }
        @keyframes gradient-x {
          0%, 100% {
            background-size: 200% 200%;
            background-position: left center;
          }
          50% {
            background-size: 200% 200%;
            background-position: right center;
          }
        }
        .animate-gradient-x {
          animation: gradient-x 8s ease infinite;
        }
        .perspective-\\[2000px\\] {
          perspective: 2000px;
        }
        .rotate-x-\\[15deg\\] {
          transform: rotateX(15deg);
        }
        .hover\\:rotate-x-0:hover {
          transform: rotateX(0deg);
        }
      `}} />
    </div>
  );
}

function FeatureCard({ icon, title, description, colorClass, glowColor }: { icon: React.ReactNode, title: string, description: string, colorClass: string, glowColor: string }) {
  return (
    <div className="group relative p-8 rounded-[2.5rem] bg-[#030303]/40 border border-white/10 hover:border-white/20 transition-all hover:-translate-y-2 duration-500 overflow-hidden backdrop-blur-xl shadow-2xl">
      {/* Animated Gradient Background on Hover */}
      <div className={`absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-[0.15] transition-opacity duration-700 ${glowColor}`} />
      
      {/* Top subtle border highlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="relative z-10">
        <div className={`w-16 h-16 rounded-3xl border flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500 shadow-xl ${colorClass}`}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: "w-8 h-8 drop-shadow-md" })}
        </div>
        <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">{title}</h3>
        <p className="text-white/60 leading-relaxed font-medium text-base">{description}</p>
      </div>
    </div>
  );
}
