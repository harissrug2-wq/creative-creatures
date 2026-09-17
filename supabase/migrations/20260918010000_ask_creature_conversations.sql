begin;
create table if not exists public.ask_creature_conversations (
 id uuid primary key default gen_random_uuid(),
 account_id uuid not null references public.accounts(id) on delete cascade,
 member_id uuid references public.account_members(id) on delete cascade,
 title text not null check(char_length(title) between 1 and 100),
 page_path text not null default '/',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 message_count integer not null default 0
);
alter table public.ask_creature_messages add column if not exists conversation_id uuid references public.ask_creature_conversations(id) on delete cascade;
alter table public.ask_creature_messages add column if not exists request_id uuid;
create index if not exists cc_ask_conversations_owner on public.ask_creature_conversations(account_id,member_id,updated_at desc,id desc);
create index if not exists cc_ask_messages_thread on public.ask_creature_messages(conversation_id,created_at desc,id desc);
create unique index if not exists cc_ask_messages_request on public.ask_creature_messages(conversation_id,request_id,role) where request_id is not null;
alter table public.ask_creature_conversations enable row level security;
revoke all on public.ask_creature_conversations from anon,authenticated;
grant all on public.ask_creature_conversations to service_role;
-- Preserve existing histories without mixing owner and member conversations.
do $$
declare g record; cid uuid;
begin
 for g in select account_id,member_id,min(created_at) as first_at,max(created_at) as last_at,count(*) as total from public.ask_creature_messages where conversation_id is null group by account_id,member_id loop
  insert into public.ask_creature_conversations(account_id,member_id,title,created_at,updated_at,message_count)
  values(g.account_id,g.member_id,'Previous conversation',g.first_at,g.last_at,g.total) returning id into cid;
  update public.ask_creature_messages set conversation_id=cid where conversation_id is null and account_id=g.account_id and member_id is not distinct from g.member_id;
 end loop;
end $$;
-- One atomic turn: save both messages and thread metadata, or save nothing.
create or replace function public.cc_ask_save_turn(p_account_id uuid,p_member_id uuid,p_conversation_id uuid,p_request_id uuid,p_page_path text,p_message text,p_answer text,p_expected_count integer)
returns jsonb language plpgsql security definer set search_path=public as $$
declare t public.ask_creature_conversations; saved text; stamp timestamptz;
begin
 if char_length(p_message) not between 1 and 4000 or char_length(p_answer) not between 1 and 12000 or p_request_id is null or p_conversation_id is null then raise exception 'Invalid chat turn'; end if;
 if p_member_id is not null and not exists(select 1 from public.account_members where id=p_member_id and account_id=p_account_id and status='active') then raise exception 'Member access unavailable'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_conversation_id::text,0));
 select * into t from public.ask_creature_conversations where id=p_conversation_id for update;
 if found then
  if t.account_id<>p_account_id or t.member_id is distinct from p_member_id then raise exception 'Conversation unavailable'; end if;
  select content into saved from public.ask_creature_messages where conversation_id=t.id and request_id=p_request_id and role='assistant';
  if found then
   if not exists(select 1 from public.ask_creature_messages where conversation_id=t.id and request_id=p_request_id and role='user' and content=p_message) then raise exception 'Request ID already used'; end if;
   return jsonb_build_object('conversationId',t.id,'answer',saved,'messageCount',t.message_count);
  end if;
  if t.message_count<>p_expected_count then raise exception 'Conversation changed. Reopen it before sending again.'; end if;
 else
  if p_expected_count<>0 then raise exception 'Conversation unavailable'; end if;
  insert into public.ask_creature_conversations(id,account_id,member_id,title,page_path) values(p_conversation_id,p_account_id,p_member_id,left(p_message,80),left(p_page_path,200)) returning * into t;
 end if;
 stamp=greatest(clock_timestamp(),coalesce((select max(created_at)+interval '1 millisecond' from public.ask_creature_messages where conversation_id=t.id),clock_timestamp()));
 insert into public.ask_creature_messages(account_id,member_id,conversation_id,request_id,role,content,created_at) values
 (p_account_id,p_member_id,t.id,p_request_id,'user',p_message,stamp),
 (p_account_id,p_member_id,t.id,p_request_id,'assistant',p_answer,stamp+interval '1 millisecond');
 update public.ask_creature_conversations set updated_at=stamp+interval '1 millisecond',message_count=message_count+2 where id=t.id;
 return jsonb_build_object('conversationId',t.id,'answer',p_answer,'messageCount',t.message_count+2);
end $$;
revoke all on function public.cc_ask_save_turn(uuid,uuid,uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.cc_ask_save_turn(uuid,uuid,uuid,uuid,text,text,text,integer) to service_role;
commit;
