import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CitationToggleProps {
  paperTitle: string;
  authors: string[];
  year: string;
}

export function CitationToggle({ paperTitle, authors, year }: CitationToggleProps) {
  const [format, setFormat] = useState<'APA' | 'MLA' | 'BibTeX'>('APA');
  const [copied, setCopied] = useState(false);

  const getCitation = () => {
    const authorsList = authors.join(', ');
    
    switch (format) {
      case 'APA':
        return `${authors[0]} et al. (${year}). ${paperTitle}. Journal Name.`;
      case 'MLA':
        return `${authors[0]}, et al. "${paperTitle}." Journal Name, ${year}.`;
      case 'BibTeX':
        return `@article{author${year},
  title={${paperTitle}},
  author={${authorsList}},
  year={${year}},
  journal={Journal Name}
}`;
      default:
        return '';
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getCitation());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-semibold text-[#111827]">Citation</h4>
        <div className="flex gap-2">
          {(['APA', 'MLA', 'BibTeX'] as const).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setFormat(fmt)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                format === fmt
                  ? 'bg-[#1E40AF] text-white'
                  : 'bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB]'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>
      
      <div className="relative">
        <pre className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-4 text-sm text-[#374151] overflow-x-auto whitespace-pre-wrap">
          {getCitation()}
        </pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 bg-white border border-[#E5E7EB] rounded-lg hover:bg-[#F3F4F6] transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-600" />
          ) : (
            <Copy className="w-4 h-4 text-[#6B7280]" />
          )}
        </button>
      </div>
    </div>
  );
}
