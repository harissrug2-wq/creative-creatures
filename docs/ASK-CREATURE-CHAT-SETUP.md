# Ask Creature conversations

This patch is independent of the unfinished Stripe work. It changes the shared chat UI and only the Ask Creature routes in account-auth.js.

## Install

Apply the patch in the Creative Creatures repository, then run:

```
node --test tests/ask-creature-chat.test.mjs
```

Before deploying the code, run the complete SQL in `supabase/migrations/20260918010000_ask_creature_conversations.sql` using the SQL Editor of the existing Creative Creatures Supabase project. This requires the existing accounts, account_members and ask_creature_messages tables. It adds the conversation table, indexes and a private save function. It backfills old messages into a Previous conversation for each account/member identity and does not delete messages. The migration is transactional and can be rerun. If users sent messages through the old UI between migration and deployment, rerun it after deployment to group those final legacy messages too.

Deploy through the normal production workflow after reviewing the diff. This patch does not deploy or change Stripe settings. Existing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ACCOUNT_SESSION_SECRET and OPENAI_API_KEY settings are used. No additional environment variables are required. OPENAI_MODEL must support Responses API structured JSON output; default remains gpt-5-mini.

## Behavior

- Every click opening Ask Creature starts a blank conversation. A conversation is saved when the first question receives a saved answer, so opening and closing an empty panel does not clutter history.
- History lists conversations for the current agency and signed-in identity. The owner sees the owner's chats; members see their own chats. No member chat is silently merged into the owner's context.
- Select a conversation to resume it. History and messages have Load more controls, so older chats are not lost behind a fixed limit.
- The UI permits one pending send at a time. New chat and history are disabled during that send. Closing the panel does not cancel the server's save; reopen History to retrieve the result.
- Concurrent tabs cannot append answers based on stale history: the second must reopen the conversation. Request IDs make a retry return an already saved answer.
- The server retains existing authentication/plan/disabled-member gates, applies the rate limit to greetings and FAQs, and commits the question, answer and thread metadata atomically before returning success.
- Exact starter questions and greetings have immediate server answers without AI. Other questions use a single structured AI request, bounded history and optional bounded owner context. They may still take several seconds; there is no guarantee of instant model responses.
- The chat form opts out of the global page loader. Pending status remains inside the panel.

## Knowledge and scope

`lib/ask-creature-knowledge.js` is the maintained product knowledge source and page-specific FAQ catalogue. Each question has an approved answer. Update this file when workflows change. The initial knowledge covers the existing leadership/L10, transcripts, integrations, diagnostic, scorecard, goals, Accelerator, account, team, portal and department workflows. It deliberately does not quote prices or claim unseen records.

The model must classify each request as in or out of scope. An out-of-scope result is replaced by a fixed Creative Creatures-only response; malformed output is rejected. These are model-based controls, not a mathematical guarantee against every adversarial prompt. No web tools, record-writing tools or arbitrary document retrieval are exposed. Account data and chat content are treated as untrusted data. Members are not sent agency-wide diagnostic/report data. Questions about data absent from the supplied context must ask for details instead of inventing it.

## Manual production smoke check

Use your own account and a disposable test member:

1. Open Ask Creature from Leadership. Check the L10 starter questions, submit one, and close.
2. Open again: a fresh welcome should appear. Use History to resume the saved chat and send a follow-up.
3. Open on Integrations, Scorecard and a department page; each should show relevant, different questions.
4. Ask unrelated trivia and an instruction to ignore product scope. Expect a product-only redirect, with no unrelated answer.
5. Sign in as another account/member and confirm the previous identity's history is absent.
6. Test narrow/mobile and desktop widths, keyboard Tab/Shift+Tab, Escape and multiline input. Send should show only an inline Thinking status.
7. Simulate a network failure: ensure the question can be retried and no successful answer is reported before saving.

No migration has been run against production by the patch author. No live AI calls are required by the supplied tests.

## Verification performed

The 12 native Node chat tests pass. JavaScript syntax checks pass. Model and database HTTP calls are mocked in these tests; they do not prove live model refusal quality or database execution. Browser verification and SQL execution could not be completed in the authoring environment because the required dependency download was unavailable. Complete the smoke checks above after running the migration.
