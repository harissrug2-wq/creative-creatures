import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

const clean = (value: unknown) => String(value ?? "").trim();
const lower = (value: unknown) => clean(value).toLowerCase();

function normalizeAgencyUrl(value: unknown) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const url = new URL(withProtocol);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path === "/" ? "" : path}`.toLowerCase();
  } catch {
    return raw.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

function deriveAgencyName(agencyUrl: unknown) {
  const normalized = normalizeAgencyUrl(agencyUrl);
  const first = normalized.split("/")[0].split(".")[0] || "Agency";
  return first
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function response(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), { status, headers: corsHeaders });
}

function publicAccount(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.display_name,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    agency_url: row.agency_url,
    agency_url_normalized: row.agency_url_normalized,
    agency_name: row.agency_name,
    journey: row.journey,
    archetype_result: row.archetype_result,
    report_data: row.report_data,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) {
    return response(500, { error: "Account service is not configured." });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  try {
    const url = new URL(req.url);

    if (req.method === "GET" && url.searchParams.get("health") === "1") {
      return response(200, { ok: true });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const firstName = clean(body.firstName || body.first_name);
      const lastName = clean(body.lastName || body.last_name);
      const displayName = clean(body.name) || `${firstName} ${lastName}`.trim();
      const email = lower(body.email) || null;
      const agencyUrl = clean(body.agencyUrl || body.agency_url);
      const normalizedUrl = normalizeAgencyUrl(agencyUrl);
      const journey = ["platform", "diagnostic", "accelerator"].includes(body.journey)
        ? body.journey
        : "diagnostic";

      if (!displayName || !normalizedUrl) {
        return response(422, { error: "Name and agency URL are required." });
      }
      if (email && !/^\S+@\S+\.\S+$/.test(email)) {
        return response(422, { error: "Enter a valid email address." });
      }

      const { data: existing, error: findError } = await supabase
        .from("owner_accounts")
        .select("*")
        .eq("agency_url_normalized", normalizedUrl)
        .maybeSingle();
      if (findError) throw findError;

      const record = {
        first_name: firstName,
        last_name: lastName,
        display_name: displayName,
        display_name_normalized: lower(displayName),
        email: email || existing?.email || null,
        email_normalized: email || existing?.email_normalized || null,
        agency_url: agencyUrl,
        agency_url_normalized: normalizedUrl,
        agency_name: clean(body.agencyName || body.agency_name) || deriveAgencyName(agencyUrl),
        journey,
        source: clean(body.source) || "owner-archetype",
        archetype_answers: body.archetypeAnswers || body.archetype_answers || {},
        archetype_result: body.archetypeResult || body.archetype_result || {},
        report_data: body.reportData || body.report_data || {},
        updated_at: new Date().toISOString()
      };

      let saved;
      if (existing) {
        const { data, error } = await supabase
          .from("owner_accounts")
          .update(record)
          .eq("id", existing.id)
          .select("*")
          .single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase
          .from("owner_accounts")
          .insert(record)
          .select("*")
          .single();
        if (error) throw error;
        saved = data;
      }

      return response(200, { account: publicAccount(saved) });
    }

    if (req.method === "GET") {
      const name = clean(url.searchParams.get("name"));
      const email = lower(url.searchParams.get("email"));
      const agencyUrl = clean(url.searchParams.get("agencyUrl") || url.searchParams.get("agency_url"));
      const normalizedUrl = normalizeAgencyUrl(agencyUrl);

      if (!normalizedUrl) return response(422, { error: "Agency URL is required." });

      const { data: account, error } = await supabase
        .from("owner_accounts")
        .select("*")
        .eq("agency_url_normalized", normalizedUrl)
        .maybeSingle();
      if (error) throw error;
      if (!account) return response(404, { error: "No matching account was found." });

      const storedName = lower(account.display_name);
      const storedEmail = lower(account.email);
      if (name && storedName && name.toLowerCase() !== storedName) {
        return response(404, { error: "No matching account was found." });
      }
      if (email && storedEmail && email !== storedEmail) {
        return response(404, { error: "No matching account was found." });
      }

      const lookupUpdate: Record<string, unknown> = {
        last_lookup_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (email && !storedEmail) {
        lookupUpdate.email = email;
        lookupUpdate.email_normalized = email;
      }

      const { data: updated, error: updateError } = await supabase
        .from("owner_accounts")
        .update(lookupUpdate)
        .eq("id", account.id)
        .select("*")
        .single();
      if (updateError) throw updateError;

      return response(200, { account: publicAccount(updated) });
    }

    return response(405, { error: "Method not allowed." });
  } catch (error) {
    console.error("account-v1 error", error);
    return response(500, { error: "The account could not be saved or loaded." });
  }
});
