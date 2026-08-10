const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ29odnVrcGNrY2Z3aW14cnJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NTg5NDMsImV4cCI6MjEwMDIzNDk0M30.cCm5O9qjRQihpQxflS7ScLapbP2jKAx99Gu-iq9nvVM";

async function run() {
  const res = await fetch("https://mkgohvukpckcfwimxrra.supabase.co/functions/v1/api-v1/health", {
    headers: {
      "Authorization": `Bearer ${key}`
    }
  });
  console.log(res.status, await res.text());
}
run();
