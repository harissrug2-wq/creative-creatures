const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ29odnVrcGNrY2Z3aW14cnJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTg5NDMsImV4cCI6MjEwMDIzNDk0M30.cCm5O9qjRQihpQxflS7ScLapbP2jKAx99Gu-iq9nvVM";
const BASE_URL = "https://mkgohvukpckcfwimxrra.supabase.co/functions/v1/api-v1";

async function run() {
  console.log("--- 1. Assessment Creation Test ---");
  const createRes = await fetch(`${BASE_URL}/assessments`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const createData = await createRes.json();
  console.log("Status:", createRes.status);
  console.log("Body:", createData);

  if (!createData.id) return;

  const id = createData.id;
  const draftToken = createData.draft_token;

  console.log("\n--- 2. Draft Save Test ---");
  const draftRes = await fetch(`${BASE_URL}/assessments/${id}`, {
    method: 'PUT',
    headers: { 
       'Authorization': `Bearer ${key}`,
       'Content-Type': 'application/json',
       'x-draft-token': draftToken
    },
    body: JSON.stringify({ "annual_revenue": "1M+" })
  });
  console.log("Status:", draftRes.status);
  console.log("Body:", await draftRes.text());

  console.log("\n--- 3. Final Submission Test (Should Fail due to Missing Configs) ---");
  const submitRes = await fetch(`${BASE_URL}/assessments/${id}/submit`, {
    method: 'POST',
    headers: { 
       'Authorization': `Bearer ${key}`,
       'Content-Type': 'application/json',
       'x-draft-token': draftToken,
       'idempotency-key': 'test-1234'
    }
  });
  console.log("Status:", submitRes.status);
  console.log("Body:", await submitRes.json());
}
run();
