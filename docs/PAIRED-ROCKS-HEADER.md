# Paired issues and navigation above chat

Apply after the previous menu-button, chat-spacing, and scorecard-baseline fixes.

Each issue now has one checkbox with its matching opportunity underneath. One selection creates one Rock whose description includes both. Matching uses the diagnostic index and capability, not the display order. Existing Rocks created from either an issue or its opportunity disable the same selection. Existing records are preserved; this does not remove previously created duplicates.

The goals API canonicalizes the old opportunity keys to issue keys for new requests, skips existing records, and ignores concurrent duplicate inserts instead of resetting a Rock's progress. No database migration is required.

The sticky navigation spans the reserved desktop chat column and sits above the chat layer. Chat content, 420px desktop space, and the menu button's hide/show behavior are unchanged.

Validation: five automated tests passed; production build passed. Local Chromium checks with mocked account responses verified the shared header's right edge, stacking order, and chat position at 390, 1024, and 1440px. Live database writes and invitation delivery were not exercised.

After applying:

    node --test tests/paired-scorecard-rocks.test.mjs
    npm run build

After deployment, confirm one checkbox per issue, select a new issue to create a Rock, and verify its description in Agency Goals. Refresh the Scorecard to confirm it shows Already a 90-Day Rock. Check the sticky header while scrolling with chat open.
