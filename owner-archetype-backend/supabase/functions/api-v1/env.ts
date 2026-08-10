/**
 * Edge Function Environment Helper
 * Securely loads backend environment variables without fallback secrets or exposing values in errors.
 */

export interface BackendEnvConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  reportTokenSecret: string;
  frontendUrl: string;
  resendApiKey: string | null;
  resendWebhookSecret: string | null;
  resendFromEmail: string | null;
}

export function validateBackendEnv(): BackendEnvConfig {
  // Built-in Supabase hosted variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  // Custom required secrets
  const reportTokenSecret = Deno.env.get('REPORT_TOKEN_SECRET');
  const frontendUrl = Deno.env.get('FRONTEND_URL');

  // Custom optional secrets (Resend will be used later)
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const resendWebhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET');
  const resendFromEmail = Deno.env.get('RESEND_FROM_EMAIL');

  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!reportTokenSecret) missing.push('REPORT_TOKEN_SECRET');
  if (!frontendUrl) missing.push('FRONTEND_URL');

  if (missing.length > 0) {
    // SECURITY: Do not expose the exact missing variables directly to the caller,
    // throw a generic error to be logged, and an API can return a generic 500.
    throw new Error(`Critical Server Configuration Error: Required environment variables are missing (${missing.length} missing).`);
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    reportTokenSecret,
    frontendUrl,
    resendApiKey: resendApiKey || null,
    resendWebhookSecret: resendWebhookSecret || null,
    resendFromEmail: resendFromEmail || null
  };
}

export interface EnvStatus {
  reportTokenSecret: boolean;
  resendConfigured: boolean;
  frontendUrl: boolean;
}

export function getEnvStatus(): EnvStatus {
  return {
    reportTokenSecret: !!Deno.env.get('REPORT_TOKEN_SECRET'),
    frontendUrl: !!Deno.env.get('FRONTEND_URL'),
    resendConfigured: !!(Deno.env.get('RESEND_API_KEY') && Deno.env.get('RESEND_WEBHOOK_SECRET') && Deno.env.get('RESEND_FROM_EMAIL')),
  };
}
