create or replace function public.cc_admin_portfolio_health()
returns table (
  account_id uuid,
  owners jsonb,
  team_member_count bigint,
  partner_login_count bigint,
  last_member_login timestamptz,
  connections jsonb,
  last_connection_update timestamptz
)
language sql
security definer
set search_path = public
as $$
  with owner_rollup as (
    select
      ao.account_id,
      jsonb_agg(
        jsonb_build_object(
          'name', ao.name,
          'title', ao.title,
          'ownership_percent', ao.ownership_percent,
          'is_primary', ao.is_primary
        )
        order by ao.is_primary desc, ao.created_at asc
      ) filter (where ao.status = 'active') as owners
    from agency_owners ao
    group by ao.account_id
  ),
  member_rollup as (
    select
      am.account_id,
      count(*) filter (where am.status = 'active' and coalesce(am.role,'member') = 'member') as team_member_count,
      count(*) filter (where am.status = 'active' and am.role = 'partner') as partner_login_count,
      max(am.last_login_at) filter (where am.status = 'active') as last_member_login
    from account_members am
    group by am.account_id
  ),
  connection_rows as (
    select account_id,status,updated_at,'QuickBooks Online'::text provider from quickbooks_connections
    union all select account_id,status,updated_at,'FreshBooks' from freshbooks_connections
    union all select account_id,status,updated_at,'Google Calendar' from google_calendar_connections
    union all select account_id,status,updated_at,'Google Drive' from google_drive_connections
    union all select account_id,status,updated_at,'HubSpot' from hubspot_connections
    union all select account_id,status,updated_at,'Zoho CRM' from zoho_crm_connections
    union all select account_id,status,updated_at,'GoHighLevel' from ghl_connections
    union all select account_id,status,updated_at,'Slack' from slack_connections
    union all select account_id,status,updated_at,'Google Chat' from google_chat_connections
    union all select account_id,status,updated_at,'ClickUp' from clickup_connections
    union all select account_id,status,updated_at,'Teamwork' from teamwork_connections
    union all select account_id,status,updated_at,'Monday.com' from monday_connections
    union all select account_id,status,updated_at,'Jira' from jira_connections
    union all select account_id,status,updated_at,'Zoom' from zoom_connections
  ),
  connection_rollup as (
    select
      cr.account_id,
      jsonb_agg(
        jsonb_build_object(
          'provider', cr.provider,
          'status', coalesce(cr.status,'connected'),
          'updatedAt', cr.updated_at
        )
        order by cr.provider
      ) as connections,
      max(cr.updated_at) as last_connection_update
    from connection_rows cr
    group by cr.account_id
  )
  select
    a.id as account_id,
    coalesce(o.owners,'[]'::jsonb) as owners,
    coalesce(m.team_member_count,0) as team_member_count,
    coalesce(m.partner_login_count,0) as partner_login_count,
    m.last_member_login,
    coalesce(c.connections,'[]'::jsonb) as connections,
    c.last_connection_update
  from accounts a
  left join owner_rollup o on o.account_id=a.id
  left join member_rollup m on m.account_id=a.id
  left join connection_rollup c on c.account_id=a.id;
$$;

revoke all on function public.cc_admin_portfolio_health() from public, anon, authenticated;
grant execute on function public.cc_admin_portfolio_health() to service_role;
