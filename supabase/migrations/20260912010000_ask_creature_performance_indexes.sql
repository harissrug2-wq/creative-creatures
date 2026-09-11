-- Composite indexes for Ask Creature history and rate limit performance
create index if not exists ask_creature_messages_account_member_created_idx
  on public.ask_creature_messages(account_id, member_id, created_at desc);

create index if not exists ask_creature_messages_user_rate_limit_idx
  on public.ask_creature_messages(account_id, created_at desc)
  where role = 'user';
