import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

async function testKey() {
  const apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY;
  console.log('Testing key:', apiKey ? 'FOUND' : 'MISSING');
  
  const apiUrl = 'https://api.semanticscholar.org/graph/v1/paper/search?query=dinosaur&limit=1';
  const headers = { 'Accept': 'application/json' };
  if (apiKey) headers['x-api-key'] = apiKey;

  try {
    const res = await fetch(apiUrl, { headers });
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
  } catch(e) {
    console.error(e);
  }
}

testKey();
