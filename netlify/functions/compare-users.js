import { createClient } from '@supabase/supabase-js';

/**
 * Netlify Function: Compare Users
 * 
 * Compares customers in the database with Supabase auth users.
 * Returns statistics about missing, orphaned, and healthy accounts.
 *
 * Environment variables required:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req) => {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error('Missing Supabase configuration');
        return new Response(
            JSON.stringify({ error: 'Server configuration error' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }

    try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Fetch all customers (not soft-deleted)
        console.log('📊 Fetching customers...');
        const { data: customers, error: custError } = await supabase
            .from('customers')
            .select('id, name, phone, user_id')
            .is('deleted_at', null)
            .order('created_at', { ascending: true });

        if (custError) throw custError;

        // Fetch all auth users with pagination
        console.log('🔐 Fetching auth users...');
        let allAuthUsers = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const { data, error } = await supabase.auth.admin.listUsers({
                perPage: 1000,
                page: page,
            });

            if (error) throw error;

            const users = data?.users || [];
            allAuthUsers = allAuthUsers.concat(users);
            hasMore = users.length === 1000;
            page++;
        }

        console.log(`✅ Found ${customers?.length || 0} customers, ${allAuthUsers.length} auth users`);

        // Create lookup sets
        const authUserIds = new Set(allAuthUsers.map(u => u.id));
        const authUserEmails = new Map(allAuthUsers.map(u => [u.email, u.id]));

        // Categorize customers
        const customersWithoutUserId = [];
        const customersWithOrphanedUserId = [];
        const healthyCustomers = [];

        for (const customer of customers || []) {
            if (!customer.user_id) {
                // No user_id assigned - check if auth user might exist by email
                const expectedEmail = `${customer.phone}@gmail.com`;
                const existingAuthId = authUserEmails.get(expectedEmail);
                customersWithoutUserId.push({
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    expectedEmail,
                    existingAuthId: existingAuthId || null, // If auth exists, we can link it
                });
            } else if (!authUserIds.has(customer.user_id)) {
                // user_id exists but doesn't match any auth user
                const expectedEmail = `${customer.phone}@gmail.com`;
                const existingAuthId = authUserEmails.get(expectedEmail);
                customersWithOrphanedUserId.push({
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    orphanedUserId: customer.user_id,
                    expectedEmail,
                    existingAuthId: existingAuthId || null, // If auth exists by email, can be fixed
                });
            } else {
                healthyCustomers.push({
                    id: customer.id,
                    name: customer.name,
                    phone: customer.phone,
                    user_id: customer.user_id,
                });
            }
        }

        const result = {
            success: true,
            timestamp: new Date().toISOString(),
            summary: {
                totalCustomers: customers?.length || 0,
                totalAuthUsers: allAuthUsers.length,
                healthy: healthyCustomers.length,
                missingUserId: customersWithoutUserId.length,
                orphanedUserId: customersWithOrphanedUserId.length,
            },
            customersWithoutUserId,
            customersWithOrphanedUserId,
            // Don't include all healthy customers to reduce payload size
            // healthyCustomers,
        };

        console.log('📊 Comparison complete:', result.summary);

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('❌ Error in compare-users:', error.message);
        return new Response(
            JSON.stringify({
                error: 'Failed to compare users',
                details: error.message,
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
