// Keep access decisions intact while projecting only the JSON fields they use.
export const WORKSPACE_ACCOUNT_SELECT = [
  'id', 'name', 'email', 'agency_name', 'journey', 'access_plan',
  'purchased_plans:diagnostic_state->purchasedPlans',
  'accelerator_completed:diagnostic_state->acceleratorCompleted'
].join(',');

export function workspaceAccount(row) {
  if (!row) return null;
  const { purchased_plans, accelerator_completed, ...account } = row;
  return { ...account, diagnostic_state: {
    purchasedPlans: Array.isArray(purchased_plans) ? purchased_plans : [],
    acceleratorCompleted: accelerator_completed === true
  } };
}

export function isCreatureGreeting(message) {
  return /^(hi|hello|hey|good morning|good afternoon|good evening)[!.,\s]*$/i.test(message.trim());
}

// Prefer the newest messages. Return chronological history within a hard budget.
export function boundedCreatureHistory(newestFirst, maxChars = 12000) {
  const kept = [];
  let remaining = maxChars;
  for (const row of (Array.isArray(newestFirst) ? newestFirst : []).slice(0, 12)) {
    if (!['user', 'assistant'].includes(row.role)) continue;
    const content = String(row.content || '');
    if (!content || content.length > remaining) break;
    kept.push({ role: row.role, content });
    remaining -= content.length;
  }
  return kept.reverse();
}

// Structured, bounded context: never cut a serialized JSON string in half.
export function compactCreatureData(value, maxChars = 6000) {
  let remaining = maxChars;
  function visit(item, depth) {
    if (remaining <= 0 || depth > 6) return '[omitted]';
    if (item == null || typeof item === 'boolean' || typeof item === 'number') {
      remaining -= 16;
      return item;
    }
    if (typeof item === 'string') {
      const limit = Math.max(0, Math.min(1200, remaining));
      remaining -= Math.min(item.length, limit);
      return item.length > limit ? item.slice(0, limit) + ' [truncated]' : item;
    }
    if (Array.isArray(item)) {
      const out = [];
      for (const child of item.slice(0, 20)) {
        if (remaining <= 0) break;
        out.push(visit(child, depth + 1));
      }
      return out;
    }
    if (typeof item === 'object') {
      const out = Object.create(null);
      for (const [key, child] of Object.entries(item).slice(0, 40)) {
        if (remaining <= 0) break;
        remaining -= key.length + 8;
        out[key] = visit(child, depth + 1);
      }
      return out;
    }
    return null;
  }
  const result = visit(value, 0);
  // JSON escaping and structural overhead are included in this final guard.
  return JSON.stringify(result).length <= maxChars ? result : { omitted: true, reason: 'Context exceeds size budget' };
}

export function creatureTimings(res, action) {
  const start = performance.now();
  const durations = {};
  return {
    async run(name, work) {
      const before = performance.now();
      try { return await work(); }
      finally { durations[name] = Math.round((performance.now() - before) * 10) / 10; }
    },
    finish(ok) {
      durations.total = Math.round((performance.now() - start) * 10) / 10;
      res.setHeader('Server-Timing', Object.entries(durations).map(([key, ms]) => `${key};dur=${ms}`).join(', '));
      console.info(JSON.stringify({ event: 'creature_performance', action, ok, durations }));
    }
  };
}
