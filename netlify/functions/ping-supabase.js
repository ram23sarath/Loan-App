import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async (req) => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Supabase URL or Service Role Key is not set in environment variables.");
    return new Response("Configuration Error: Missing Environment Variables", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { data, error } = await supabase

      .from('customers') // Updated to a real table name
      .select('id')
      .limit(1);

    if (error) {
      console.error("Supabase Ping Error:", error.message);
      return new Response(`Supabase Ping Failed: ${error.message}`, { status: 500 });
    }

    console.log("Supabase ping successful!", data);
    return new Response("Connection to DB Successful", { status: 200 });

  } catch (err) {
    console.error("Unexpected error during Supabase ping:", err);
    return new Response(`Unexpected Error: ${err.message}`, { status: 500 });
  }
};

