import fetch from 'node-fetch';

async function run() {
  try {
    const res = await fetch('http://localhost:5000/api/papers');
    const json = await res.json();
    console.log(json.data.map(p => p.abstract.length).slice(0, 5));
  } catch (e) {
    console.error(e.message);
  }
}
run();
