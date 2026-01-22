import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Sync Customer Auth
 * 
 * One-time script to synchronize customer phone numbers with their Supabase auth users.
 * For each customer with a linked user_id, this script:
 * 1. Checks if the auth user's email matches the expected format (phone@gmail.com)
 * 2. If mismatched, updates the auth user's email AND password to match the customer's phone
 * 
 * Password is set to the phone number (matching the creation convention in create-user-from-customer.js)
 *
 * Called via POST request with optional JSON body:
 *  { dryRun: boolean } - defaults to true (preview mode)
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed. Use POST.', { status: 405 });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('Missing Supabase configuration');
        return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        // Parse request body for dryRun flag (defaults to true for safety)
        let dryRun = true;
        try {
            const body = await req.json();
            if (body && typeof body.dryRun === 'boolean') {
                dryRun = body.dryRun;
            }
        } catch {
            // No body or invalid JSON, use default dryRun = true
        }

        console.log(`🔄 Starting Sync Customer Auth (dryRun: ${dryRun})`);

        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Step 1: Fetch all customers with user_id (not soft-deleted)
        console.log('📊 Fetching customers with user_id...');
        const { data: customers, error: custError } = await supabase
            .from('customers')
            .select('id, name, phone, user_id')
            .not('user_id', 'is', null)
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (custError) {
            throw new Error(`Failed to fetch customers: ${custError.message}`);
        }

        console.log(`   Found ${customers?.length || 0} customers with user_id`);

        // Step 2: Fetch all auth users with pagination
        console.log('🔐 Fetching auth users...');
        let allAuthUsers = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase.auth.admin.listUsers({
                perPage: 1000,
                page: page,
            });

            if (error) {
                throw new Error(`Failed to fetch auth users: ${error.message}`);
            }

            const users = data?.users || [];
            allAuthUsers = allAuthUsers.concat(users);
            hasMore = users.length === 1000;
            page++;
        }

        console.log(`   Found ${allAuthUsers.length} auth users`);

        // Step 3: Create lookup map for auth users by ID
        const authUsersById = new Map(allAuthUsers.map(u => [u.id, u]));

        // Step 4: Find mismatches and sync
        const mismatches = [];
        const updated = [];
        const errors = [];
        const skipped = [];

        for (const customer of customers || []) {
            const expectedEmail = `${customer.phone}@gmail.com`.toLowerCase();
            const expectedPassword = customer.phone;

            const authUser = authUsersById.get(customer.user_id);

            if (!authUser) {
                // Auth user not found (orphaned user_id)
                skipped.push({
                    customerId: customer.id,
                    customerName: customer.name,
                    customerPhone: customer.phone,
                    userId: customer.user_id,
                    reason: 'Auth user not found (orphaned user_id)',
                });
                continue;
            }

            const actualEmail = (authUser.email || '').toLowerCase();

            if (actualEmail === expectedEmail) {
                // Already in sync
                continue;
            }

            // Found a mismatch
            const mismatchInfo = {
                customerId: customer.id,
                customerName: customer.name,
                customerPhone: customer.phone,
                userId: customer.user_id,
                currentEmail: authUser.email,
                expectedEmail: expectedEmail,
                newPassword: expectedPassword,
            };

            mismatches.push(mismatchInfo);

            if (!dryRun) {
                // Execute the update
                console.log(`🔧 Updating user ${customer.user_id}: ${authUser.email} -> ${expectedEmail}`);

                const { error: updateError } = await supabase.auth.admin.updateUserById(
                    customer.user_id,
                    {
                        email: expectedEmail,
                        password: expectedPassword,
                        email_confirm: true, // Auto-confirm the new email
                    }
                );

                if (updateError) {
                    console.error(`   ❌ Failed to update: ${updateError.message}`);
                    errors.push({
                        ...mismatchInfo,
                        error: updateError.message,
                    });
                } else {
                    console.log(`   ✅ Updated successfully`);
                    updated.push(mismatchInfo);
                }
            }
        }

        const result = {
            success: true,
            dryRun: dryRun,
            timestamp: new Date().toISOString(),
            summary: {
                totalCustomersChecked: customers?.length || 0,
                totalAuthUsers: allAuthUsers.length,
                mismatches: mismatches.length,
                updated: updated.length,
                errors: errors.length,
                skipped: skipped.length,
            },
            mismatches: mismatches,
            updated: dryRun ? [] : updated,
            errors: dryRun ? [] : errors,
            skipped: skipped,
            message: dryRun
                ? `Dry run complete. ${mismatches.length} user(s) would be updated. Set dryRun=false to execute.`
                : `Sync complete. ${updated.length} user(s) updated, ${errors.length} error(s).`,
        };

        console.log('📊 Sync complete:', result.summary);

        return new Response(JSON.stringify(result, null, 2), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('❌ Error in sync-customer-auth:', error.message);
        return new Response(
            JSON.stringify({
                error: 'Failed to sync customers',
                details: error.message,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
