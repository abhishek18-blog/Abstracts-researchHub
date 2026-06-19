import React, { useEffect } from 'react';
import { ArrowLeft, Search, LayoutDashboard, Brain, Users } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export function AboutPage({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-['Outfit'] selection:bg-indigo-500/30 overflow-x-hidden pb-32">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button
              onClick={onBack}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600" />
            </button>
            <BrandLogo isAuthScreen={true} className="text-2xl font-black" />
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 pt-40">
        <div className="text-center mb-24">
          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-8 text-slate-900">
            How to use Abstracts
          </h1>
          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Your comprehensive guide to discovering, managing, and analyzing research papers using AI.
          </p>
        </div>

        {/* Section 1 */}
        <section className="mb-32">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center mb-6">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4">1. Semantic Discovery</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Navigate to the <strong>Discover</strong> tab to search millions of papers. Using the power of Semantic Scholar, you can search for concepts rather than exact keywords to find the most relevant literature.
              </p>
            </div>
            <div className="flex-1 w-full bg-white p-2 rounded-3xl shadow-xl border border-slate-200">
              <img
                src="../Screenshots/discover.png"
                alt="Discover Page Screenshot"
                className="w-full h-auto rounded-2xl border border-slate-100 object-cover"
              />
            </div>
          </div>
        </section>

        {/* Section 2: For You Feed */}
        <section className="mb-32">
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center mb-6">
                <LayoutDashboard className="w-8 h-8 text-purple-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4">2. Personalized "For You" Feed</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Curate your own personalized reading list! Using the <strong>For You</strong> section (or via Settings), you can choose up to <strong>4 specific research topics</strong>. Your feed will then automatically update with the absolute latest papers corresponding precisely to those selected interests.
              </p>
            </div>
            <div className="flex-1 w-full bg-white p-2 rounded-3xl shadow-xl border border-slate-200">
              <img
                src="../Screenshots/foryou.png"
                alt="For You Feed Screenshot"
                className="w-full h-auto rounded-2xl border border-slate-100 object-cover"
              />
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="mb-32">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-indigo-100 flex items-center justify-center mb-6">
                <LayoutDashboard className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4">3. Library & Projects</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Save interesting papers directly to your <strong>Library</strong>. To keep your research organized, you can group them into specific <strong>Projects</strong> (folders). The app also automatically tracks exactly how much of a paper you have read.
              </p>
            </div>
            <div className="flex-1 w-full bg-white p-2 rounded-3xl shadow-xl border border-slate-200">
              <img
                src="../Screenshots/library.png"
                alt="Library Screenshot"
                className="w-full h-auto rounded-2xl border border-slate-100 object-cover"
              />
            </div>
          </div>
        </section>

        {/* Section 4 */}
        <section className="mb-32">
          <div className="flex flex-col md:flex-row-reverse items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-6">
                <Brain className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4">4. AI Chat Assistant</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Open any paper to access the persistent <strong>AI Chat Sidebar</strong> on the right. Ask it to summarize the abstract, extract methodologies, explain complex formulas, or generate citations in standard academic formats.
              </p>
            </div>
            <div className="flex-1 w-full bg-white p-2 rounded-3xl shadow-xl border border-slate-200">
              <img
                src="../Screenshots/ai.png"
                alt="AI Chat Screenshot"
                className="w-full h-auto rounded-2xl border border-slate-100 object-cover"
              />
            </div>
          </div>
        </section>

        {/* Section 5 */}
        <section className="mb-32">
          <div className="flex flex-col md:flex-row items-center gap-12">
            <div className="flex-1">
              <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-amber-600" />
              </div>
              <h2 className="text-3xl font-bold mb-4">5. Community Forums</h2>
              <p className="text-lg text-slate-600 leading-relaxed mb-6">
                Join <strong>Communities</strong> specific to your field of study. Create posts, share papers you've discovered, and discuss methodologies with other researchers and students securely.
              </p>
            </div>
            <div className="flex-1 w-full bg-white p-2 rounded-3xl shadow-xl border border-slate-200">
              <img
                src="../Screenshots/community.png"
                alt="Community Screenshot"
                className="w-full h-auto rounded-2xl border border-slate-100 object-cover"
              />
            </div>
          </div>
        </section>

        <div className="text-center pb-20">
          <h2 className="text-4xl font-bold mb-8">Ready to get started?</h2>
          <button
            onClick={onBack}
            className="px-8 py-4 bg-slate-900 text-white rounded-full font-bold text-lg shadow-xl shadow-slate-900/20 hover:-translate-y-1 hover:shadow-2xl hover:bg-black transition-all"
          >
            Go back to Home
          </button>
        </div>
      </main>
    </div>
  );
}
