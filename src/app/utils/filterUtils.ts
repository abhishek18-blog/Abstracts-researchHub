export interface FilterCriteria {
  authors: string[];
  years: string[];
}

export function filterPapers<T extends { authors: string[], year: string }>(papers: T[], criteria: FilterCriteria): T[] {
  return papers.filter(paper => {
    let authorMatch = true;
    let yearMatch = true;

    if (criteria.authors && criteria.authors.length > 0) {
      authorMatch = paper.authors.some(author => criteria.authors.includes(author));
    }

    if (criteria.years && criteria.years.length > 0) {
      yearMatch = criteria.years.includes(paper.year);
    }

    return authorMatch && yearMatch;
  });
}
