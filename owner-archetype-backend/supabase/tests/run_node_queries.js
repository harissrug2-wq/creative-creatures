import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mkgohvukpckcfwimxrra.supabase.co";
const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1rZ29odnVrcGNrY2Z3aW14cnJhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1ODk0MywiZXhwIjoyMTAwMjM0OTQzfQ.Ny0XduVLRhJg1xOu_PuYm0iBj8RjJoxNDHkavWkwWP0";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data, error } = await supabase.rpc('get_pg_policies');
  if (error) {
    console.error("Error calling rpc:", error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

main();
