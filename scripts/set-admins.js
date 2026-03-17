#!/usr/bin/env node

/**
 * One-off script to mark given Supabase auth users as admins by setting
 * `app_metadata.role = 'admin'` and `app_metadata.is_admin = true`.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/set-admins.js 6ee09c54-a30a-42f5-8d2f-cc91046347bd 2ca56adc-e88c-4411-9557-b280633a4d88 --invalidate
 *
 * The `--invalidate` flag will call `invalidateUserRefreshTokens` so existing
 * sessions are forced to refresh and pick up new JWT claims.
 */

import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/set-admins.js <userId> [userId2 ...] [--invalidate]');
  process.exit(1);
}

const invalidateIndex = args.indexOf('--invalidate');
const shouldInvalidate = invalidateIndex !== -1;
if (shouldInvalidate) args.splice(invalidateIndex, 1);

const userIds = args;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setAdmin(userId) {
  console.log(`→ Updating user ${userId}...`);

  // Prepare admin metadata
  const app_metadata = { role: 'admin', is_admin: true };
  const user_metadata = { is_admin: true };

  try {
    const { data, error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata,
      user_metadata,
    });

    if (error) {
      console.error(`  ❌ Failed to update ${userId}:`, error.message || error);
      return { userId, ok: false, error };
    }

    console.log(`  ✅ Updated auth user ${userId}`);

    if (shouldInvalidate) {
      try {
        const { error: invErr } = await supabase.auth.admin.invalidateUserRefreshTokens(userId);
        if (invErr) {
          console.warn(`  ⚠️  Failed to invalidate tokens for ${userId}:`, invErr.message || invErr);
        } else {
          console.log(`  🔁 Invalidated refresh tokens for ${userId}`);
        }
      } catch (invEx) {
        console.warn(`  ⚠️  Exception invalidating tokens for ${userId}:`, invEx.message || invEx);
      }
    }

    return { userId, ok: true, data };
  } catch (ex) {
    console.error(`  ❌ Exception updating ${userId}:`, ex.message || ex);
    return { userId, ok: false, error: ex };
  }
}

(async () => {
  console.log('Starting admin update for user IDs:', userIds.join(', '));

  const results = [];
  for (const id of userIds) {
    // basic validation of UUID format
    if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
      console.warn(`Skipping invalid id: ${id}`);
      results.push({ userId: id, ok: false, error: 'invalid id format' });
      continue;
    }

    // perform update
    // eslint-disable-next-line no-await-in-loop
    const res = await setAdmin(id);
    results.push(res);
  }

  console.log('\nSummary:');
  results.forEach((r) => {
    if (r.ok) console.log(`  • ${r.userId}: OK`);
    else console.log(`  • ${r.userId}: FAILED → ${r.error?.message || r.error || 'unknown'}`);
  });

  const failed = results.filter((r) => !r.ok);
  process.exit(failed.length === 0 ? 0 : 2);
})();
