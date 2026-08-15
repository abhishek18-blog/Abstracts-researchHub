/**
 * Modular filter logic for papers.
 * Can be used by backend services or API routes to filter search results.
 */

function filterPapers(papers, criteria) {
  if (!papers || !Array.isArray(papers)) return [];
  
  return papers.filter(paper => {
    let authorMatch = true;
    let yearMatch = true;

    if (criteria.authors && criteria.authors.length > 0) {
      const paperAuthors = paper.authors || [];
      authorMatch = paperAuthors.some(author => criteria.authors.includes(author));
    }

    if (criteria.years && criteria.years.length > 0) {
      yearMatch = criteria.years.includes(paper.year);
    }

    return authorMatch && yearMatch;
  });
}

export { filterPapers };
