import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// Replicating the exact queue from searchController.js
let lastRequestTime = 0;
let queuePromise = Promise.resolve();

const rateLimitMutex = () => {
  const nextPromise = queuePromise.then(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastRequestTime;
    if (timeSinceLast < 1050) { // 1.05 seconds buffer
      await new Promise(r => setTimeout(r, 1050 - timeSinceLast));
    }
    lastRequestTime = Date.now();
  });
  queuePromise = nextPromise.catch(() => {});
  return nextPromise;
};

async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 2000, id) {
  for (let i = 0; i <= retries; i++) {
    await rateLimitMutex(); 
    
    console.log(`[Req ${id}] Firing request to Semantic Scholar at ${new Date().toISOString()}`);
    
    const res = await fetch(url, options);
    
    console.log(`[Req ${id}] Received Status: ${res.status}`);
    
    if (res.status === 429 && i < retries) {
      console.log(`[Req ${id}] ⏳ Rate limited, retrying...`);
      await new Promise(r => setTimeout(r, delayMs));
      delayMs *= 2; 
      continue;
    }
    return res;
  }
}

async function runTest() {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  if (!apiKey) {
    console.error("API Key not found!");
    return;
  }
  
  const headers = { 'Accept': 'application/json', 'x-api-key': apiKey };
  const queries = ['dinosaur', 'AI', 'quantum', 'space', 'biology'];
  
  console.log('--- STARTING CONCURRENT TEST (5 SEARCHES AT ONCE) ---');
  
  // Fire all 5 requests at the EXACT same time
  const promises = queries.map((q, idx) => {
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=1`;
    return fetchWithRetry(url, { headers }, 1, 1000, idx + 1);
  });
  
  await Promise.all(promises);
  console.log('--- TEST FINISHED SUCCESSFULLY ---');
}

runTest();
