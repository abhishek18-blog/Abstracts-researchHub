const BASE = "http://localhost:3001";
const results = [];

async function t(label, fn) {
  try {
    const { status, pass, detail } = await fn();
    results.push({ label, status, pass, detail });
  } catch(e) {
    results.push({ label, status: 'ERR', pass: false, detail: e.message });
  }
}

// C3: x-user-id auth bypass must be blocked
await t("C3 x-user-id bypass blocked", async () => {
  const r = await fetch(BASE + "/api/papers", { headers: { "x-user-id": "507f1f77bcf86cd799439011" }});
  return { status: r.status, pass: r.status === 401 };
});

// Auth required on protected route
await t("Auth required on /api/user", async () => {
  const r = await fetch(BASE + "/api/user");
  return { status: r.status, pass: r.status === 401 };
});

// H3: Weak password rejected (< 8 chars)
await t("H3 Weak password rejected (<8 chars)", async () => {
  const r = await fetch(BASE + "/api/auth/register", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name:"Test", email:"t@t.com", password:"abc" })
  });
  return { status: r.status, pass: r.status === 400 };
});

// H3: Invalid email format rejected
await t("H3 Invalid email format rejected", async () => {
  const r = await fetch(BASE + "/api/auth/register", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name:"Test", email:"notanemail", password:"strongpass123" })
  });
  return { status: r.status, pass: r.status === 400 };
});

// H3: Missing required fields
await t("H3 Missing required fields rejected", async () => {
  const r = await fetch(BASE + "/api/auth/register", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email:"t@t.com" })
  });
  return { status: r.status, pass: r.status === 400 };
});

// H3: Role injection blocked (admin role must be downgraded to Student)
await t("H3 Role injection blocked (admin → Student)", async () => {
  const r = await fetch(BASE + "/api/auth/register", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ name:"Attacker", email:"attacker_"+Date.now()+"@test.com", password:"StrongPass123", role:"admin" })
  });
  const d = await r.json();
  return { status: r.status, pass: d?.user?.role !== "admin", detail: "role=" + d?.user?.role };
});

// M3: Forgot password must not reveal if email exists (always 200)
await t("M3 Forgot-password hides user existence", async () => {
  const r = await fetch(BASE + "/api/auth/forgot-password", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ email: "definitely_not_registered_xyz@nowhere.com" })
  });
  return { status: r.status, pass: r.status === 200 };
});

// H1+H2: Search limiter is active (RateLimit-Limit header present)
await t("H1/H2 Rate-limit headers present on search", async () => {
  const r = await fetch(BASE + "/api/search/papers?q=AI&limit=2");
  const hasLimitHeader = r.headers.has("ratelimit-limit") || r.headers.has("x-ratelimit-limit");
  return { status: r.status, pass: hasLimitHeader, detail: "ratelimit-limit=" + r.headers.get("ratelimit-limit") };
});

// Health check
await t("Server health check", async () => {
  const r = await fetch(BASE + "/api/health");
  return { status: r.status, pass: r.status === 200 };
});

// Print results
console.log("\n╔══════════════════════════════════════════════════════════════╗");
console.log("║          ABSTRACTS RESEARCHHUB — SECURITY AUDIT RESULTS     ║");
console.log("╚══════════════════════════════════════════════════════════════╝\n");

let passed = 0, failed = 0;
for (const r of results) {
  const icon = r.pass ? "✅" : "❌";
  const detail = r.detail ? `  [${r.detail}]` : "";
  console.log(`${icon}  [${r.status}] ${r.label}${detail}`);
  r.pass ? passed++ : failed++;
}

console.log(`\n  Result: ${passed}/${results.length} tests passed  ${failed > 0 ? "(" + failed + " FAILED)" : "🎉 All passed!"}`);
