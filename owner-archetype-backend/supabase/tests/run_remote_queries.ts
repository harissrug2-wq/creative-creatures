import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://mkgohvukpckcfwimxrra.supabase.co";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
  const { data, error } = await supabase.rpc('get_policies_temp');
  if (error) {
    console.error("Error calling rpc:", error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

main();
