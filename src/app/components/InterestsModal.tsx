import { useState } from 'react';
import { Check, Search, Plus, Sparkles, Loader2, ArrowRight, AlertCircle } from 'lucide-react';
import { userApi } from '../services/api';

const MAX_SELECTIONS = 4;

const DEFAULT_DOMAINS = [
  // Technology & Computing
  { id: 'ai', name: 'Artificial Intelligence', image: 'https://images.unsplash.com/photo-1531746790731-6c087fecd65a?auto=format&fit=crop&w=400&q=80' },
  { id: 'ml', name: 'Machine Learning', image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=400&q=80' },
  { id: 'quantum', name: 'Quantum Computing', image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=400&q=80' },
  { id: 'cyber', name: 'Cybersecurity', image: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?auto=format&fit=crop&w=400&q=80' },
  { id: 'crypto', name: 'Cryptography', image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=400&q=80' },
  { id: 'data', name: 'Data Science', image: 'https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=400&q=80' },
  { id: 'bigdata', name: 'Big Data Analytics', image: 'https://images.unsplash.com/photo-1527474305487-b87b222841cc?auto=format&fit=crop&w=400&q=80' },
  // Engineering & Physical Sciences
  { id: 'nano', name: 'Nanotechnology', image: 'https://images.unsplash.com/photo-1628595351029-c2bf17511435?auto=format&fit=crop&w=400&q=80' },
  { id: 'robotics', name: 'Robotics', image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=400&q=80' },
  { id: 'automation', name: 'Automation', image: 'https://images.unsplash.com/photo-1565688534245-05d6b5be184a?auto=format&fit=crop&w=400&q=80' },
  // Biology & Life Sciences
  { id: 'bioinf', name: 'Bioinformatics', image: 'https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&w=400&q=80' },
  { id: 'compbio', name: 'Computational Biology', image: 'https://images.unsplash.com/photo-1579154341098-e4e158cc7f55?auto=format&fit=crop&w=400&q=80' },
  { id: 'materials', name: 'Materials Science', image: 'https://images.unsplash.com/photo-1603126857599-f6e157fa2fe6?auto=format&fit=crop&w=400&q=80' },
  // Space & Physics
  { id: 'astro', name: 'Astrophysics', image: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=400&q=80' },
  { id: 'cosmo', name: 'Cosmology', image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?auto=format&fit=crop&w=400&q=80' },
  // Medicine & Health
  { id: 'onco', name: 'Oncology', image: 'https://salvavidaspharma.com/wp-content/uploads/2022/08/What-is-Oncology.webp' },
  { id: 'genomics', name: 'Genomics', image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=400&q=80' },
  { id: 'geneedit', name: 'Gene Editing', image: 'https://images.unsplash.com/photo-1582560475093-ba66accbc424?auto=format&fit=crop&w=400&q=80' },
  { id: 'immuno', name: 'Immunology', image: 'https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=400&q=80' },
  { id: 'vaccine', name: 'Vaccine Development', image: 'https://images.unsplash.com/photo-1584362917165-526a968579e8?auto=format&fit=crop&w=400&q=80' },
  { id: 'neuro', name: 'Neuroscience', image: 'https://images.unsplash.com/photo-1559757175-5700dde675bc?auto=format&fit=crop&w=400&q=80' },
  { id: 'cognsci', name: 'Cognitive Science', image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=400&q=80' },
  { id: 'epid', name: 'Epidemiology', image: 'https://images.unsplash.com/photo-1584118624012-df056829fbd0?auto=format&fit=crop&w=400&q=80' },
  { id: 'pubhealth', name: 'Public Health', image: 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=400&q=80' },
  { id: 'pharma', name: 'Pharmacology', image: 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=400&q=80' },
  { id: 'drugrepurp', name: 'Drug Repurposing', image: 'https://images.unsplash.com/photo-1585435557343-3b092031a831?auto=format&fit=crop&w=400&q=80' },
  // { id: 'personmed', name: 'Personalized Medicine', image: 'https://images.unsplash.com/photo-1530026454774-5e7d4a03f7f4?auto=format&fit=crop&w=400&q=80' },
  { id: 'biomedeng', name: 'Biomedical Engineering', image: 'https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=400&q=80' },
  // Environment & Earth
  { id: 'climate', name: 'Climate Change', image: 'https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=400&q=80' },
  { id: 'globalwarm', name: 'Global Warming', image: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=400&q=80' },
  { id: 'renewable', name: 'Renewable Energy', image: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?auto=format&fit=crop&w=400&q=80' },
  { id: 'sustain', name: 'Sustainability', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80' },
  { id: 'consbio', name: 'Conservation Biology', image: 'https://images.unsplash.com/photo-1474511320723-9a56873867b5?auto=format&fit=crop&w=400&q=80' },
  { id: 'ocean', name: 'Oceanography', image: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?auto=format&fit=crop&w=400&q=80' },
  { id: 'marine', name: 'Marine Biology', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=400&q=80' },
  { id: 'envtox', name: 'Environmental Toxicology', image: 'https://images.unsplash.com/photo-1556075798-4825dfaaf498?auto=format&fit=crop&w=400&q=80' },
  // Agriculture & Ecology
  { id: 'agri', name: 'Agricultural Science', image: 'https://images.unsplash.com/photo-1500651230702-0e2d8a49d4ad?auto=format&fit=crop&w=400&q=80' },
  { id: 'foodsec', name: 'Food Security', image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=400&q=80' },
  { id: 'ecology', name: 'Ecology', image: 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=400&q=80' },
  { id: 'biodiv', name: 'Biodiversity', image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=400&q=80' },
  // Psychology & Social Science
  { id: 'clinpsych', name: 'Clinical Psychology', image: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=400&q=80' },
  { id: 'behavpsych', name: 'Behavioral Psychology', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80' },
  { id: 'orgpsych', name: 'Organizational Psychology', image: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=400&q=80' },
  { id: 'sociol', name: 'Sociology', image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=400&q=80' },
  { id: 'demog', name: 'Demographics', image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&w=400&q=80' },
  { id: 'polsci', name: 'Political Science', image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=400&q=80' },
  { id: 'intrel', name: 'International Relations', image: 'https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?auto=format&fit=crop&w=400&q=80' },
  { id: 'edu', name: 'Education', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=400&q=80' },
  { id: 'pedagogy', name: 'Pedagogy', image: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=400&q=80' },
  // { id: 'anthro', name: 'Anthropology', image: 'https://images.unsplash.com/photo-1608848461950-0fe51dfc41cb?auto=format&fit=crop&w=400&q=80' },
  // Humanities
  { id: 'behecon', name: 'Behavioral Economics', image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=400&q=80' },
  { id: 'urban', name: 'Urban Planning', image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=400&q=80' },
  { id: 'history', name: 'History', image: 'https://images.unsplash.com/photo-1461360228754-6e81c478b882?auto=format&fit=crop&w=400&q=80' },
  { id: 'archeo', name: 'Archaeology', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&q=80' },
  { id: 'ling', name: 'Linguistics', image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=400&q=80' },
  { id: 'phil', name: 'Philosophy', image: 'https://images.unsplash.com/photo-1446329360995-b4642a139973?auto=format&fit=crop&w=400&q=80' },
  { id: 'bioeth', name: 'Bioethics', image: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=400&q=80' },
  { id: 'aiethics', name: 'AI Ethics', image: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?auto=format&fit=crop&w=400&q=80' },
  // Culture & Humanities
  { id: 'cultural', name: 'Cultural Studies', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRfin0Iwt_WenJvdmivq8NPpgFjKz12FuTLeg&s' },
  //{ id: 'genderstud', name: 'Gender Studies', image: 'https://images.unsplash.com/photo-1573496774426-ac5f39b56e9d?auto=format&fit=crop&w=400&q=80' },
  { id: 'lit', name: 'Literature', image: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=400&q=80' },
  { id: 'media', name: 'Media Studies', image: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=400&q=80' },
  { id: 'theol', name: 'Theology', image: 'https://images.unsplash.com/photo-1501526029524-a8ea952b15be?auto=format&fit=crop&w=400&q=80' },
  // { id: 'religion', name: 'Religious Studies', image: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&w=400&q=80' },
  // Economics & Management
  { id: 'macroecon', name: 'Macroeconomics', image: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=400&q=80' },
  { id: 'globtrade', name: 'Global Trade', image: 'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&w=400&q=80' },
  { id: 'supply', name: 'Supply Chain Management', image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=400&q=80' },
  { id: 'logistics', name: 'Logistics', image: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=400&q=80' },
  { id: 'orgbehav', name: 'Organizational Behavior', image: 'https://images.unsplash.com/photo-1553877522-43269d4ea984?auto=format&fit=crop&w=400&q=80' },
  { id: 'leadership', name: 'Leadership', image: 'https://images.unsplash.com/photo-1491975474562-1f4e30bc9468?auto=format&fit=crop&w=400&q=80' },
  { id: 'marketing', name: 'Marketing', image: 'https://images.unsplash.com/photo-1533750516457-a7f992034fec?auto=format&fit=crop&w=400&q=80' },
  { id: 'consbehav', name: 'Consumer Behavior', image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=400&q=80' },
  { id: 'fintech', name: 'Financial Technology', image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=400&q=80' },
  { id: 'innov', name: 'Innovation', image: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=400&q=80' },
  { id: 'entrepr', name: 'Entrepreneurship', image: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=400&q=80' },
];

interface InterestsModalProps {
  onComplete: (interests: string[]) => void;
  initialInterests?: string[];
}

export function InterestsModal({ onComplete, initialInterests = [] }: InterestsModalProps) {
  const [selected, setSelected] = useState<string[]>(initialInterests.slice(0, MAX_SELECTIONS));
  const [customInput, setCustomInput] = useState('');
  const [customInterests, setCustomInterests] = useState<string[]>(
    initialInterests.filter((i) => !DEFAULT_DOMAINS.find(d => d.name === i))
  );
  const [saving, setSaving] = useState(false);
  const [atLimit, setAtLimit] = useState(false);

  const toggleInterest = (name: string) => {
    if (selected.includes(name)) {
      setSelected(selected.filter((item) => item !== name));
      setAtLimit(false);
    } else {
      if (selected.length >= MAX_SELECTIONS) {
        setAtLimit(true);
        setTimeout(() => setAtLimit(false), 2000);
        return;
      }
      setSelected([...selected, name]);
    }
  };

  const handleAddCustom = () => {
    const val = customInput.trim();
    if (!val) return;
    if (selected.length >= MAX_SELECTIONS && !selected.includes(val)) {
      setAtLimit(true);
      setTimeout(() => setAtLimit(false), 2000);
      return;
    }
    if (!selected.includes(val) && !customInterests.includes(val)) {
      setCustomInterests([...customInterests, val]);
      setSelected([...selected, val]);
      setCustomInput('');
    }
  };

  const handleSave = async () => {
    if (selected.length === 0) return;
    try {
      setSaving(true);
      await userApi.updateProfile({ interests: selected, hasSelectedInterests: true });
      onComplete(selected);
    } catch (error) {
      console.error('Failed to save interests:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-5xl bg-card border border-primary/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="p-8 pb-5 border-b border-border bg-gradient-to-br from-primary/5 to-transparent relative flex-shrink-0">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-foreground mb-1 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-primary" />
              What are your research interests?
            </h2>
            <p className="text-muted-foreground text-base">
              Pick up to <strong className="text-primary">{MAX_SELECTIONS} domains</strong> to personalize your Discover feed and AI recommendations.
            </p>
          </div>
        </div>

        {/* Limit warning banner */}
        {atLimit && (
          <div className="flex-shrink-0 flex items-center gap-3 px-8 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 animate-in fade-in duration-200">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-semibold">You can only select up to {MAX_SELECTIONS} research domains. Deselect one to pick another.</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {DEFAULT_DOMAINS.map((domain) => {
              const isSelected = selected.includes(domain.name);
              const isDisabled = !isSelected && selected.length >= MAX_SELECTIONS;
              return (
                <div
                  key={domain.id}
                  onClick={() => toggleInterest(domain.name)}
                  className={`group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 border-2 ${isSelected
                    ? 'border-primary ring-4 ring-primary/20 scale-[0.98]'
                    : isDisabled
                      ? 'border-transparent opacity-40 cursor-not-allowed'
                      : 'border-transparent hover:border-primary/50 hover:-translate-y-1'
                    }`}
                >
                  <div className="aspect-[4/3] w-full relative">
                    <img
                      src={domain.image}
                      alt={domain.name}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                    <div className={`absolute inset-0 transition-colors duration-300 ${isSelected ? 'bg-primary/45' : 'bg-black/55 group-hover:bg-black/35'
                      }`}></div>

                    <div className="absolute inset-0 p-3 flex flex-col justify-end">
                      <h3 className="text-white font-bold text-sm leading-tight drop-shadow-md">
                        {domain.name}
                      </h3>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-7 h-7 bg-primary rounded-full flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-background border border-border rounded-2xl p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">Not listed here? Add your own</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {customInterests.map((interest) => (
                <div
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all border text-sm font-medium ${selected.includes(interest)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-foreground border-border hover:border-primary/50'
                    }`}
                >
                  {interest}
                  {selected.includes(interest) && <Check className="w-4 h-4" />}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="e.g. Cognitive Psychology, Fluid Dynamics..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); }}
                  className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-foreground transition-all"
                />
              </div>
              <button
                onClick={handleAddCustom}
                disabled={!customInput.trim()}
                className="p-4 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 disabled:opacity-50 transition-all shadow-sm"
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-card flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-foreground font-bold">
              {selected.length} / {MAX_SELECTIONS} selected
            </p>
            <p className="text-muted-foreground text-xs mt-0.5">
              {selected.length === 0 ? 'Select at least 1 domain to continue' : `${MAX_SELECTIONS - selected.length} slot${MAX_SELECTIONS - selected.length !== 1 ? 's' : ''} remaining`}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={selected.length === 0 || saving}
            className="flex items-center gap-3 px-8 py-4 bg-primary text-primary-foreground rounded-2xl font-black uppercase tracking-widest text-sm hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-xl shadow-primary/20"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" />}
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </div>

      </div>
    </div>
  );
}
