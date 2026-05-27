import React from 'react';

interface BrandLogoProps {
  className?: string;
  isAuthScreen?: boolean;
}

export function BrandLogo({ className = "", isAuthScreen = false }: BrandLogoProps) {
  const part1 = "Abs".split("");
  const part2 = "tracts".split("");

  return (
    <span className={className}>
      <span className={isAuthScreen ? "text-black" : "text-black dark:text-white"}>
        {part1.map((char, i) => (
          <span
            key={i}
            className="animate-letter"
            style={{ animationDelay: `${i * 0.1}s` }}
          >
            {char}
          </span>
        ))}
      </span>
      <span className="text-blue-500">
        {part2.map((char, i) => (
          <span
            key={i + part1.length}
            className="animate-letter"
            style={{ animationDelay: `${(i + part1.length) * 0.1}s` }}
          >
            {char}
          </span>
        ))}
      </span>
    </span>
  );
}
