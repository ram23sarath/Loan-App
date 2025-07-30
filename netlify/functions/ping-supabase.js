import { createClient } from '@supabase/supabase-js'; // You'll need to install this
import type { Config } from "@netlify/functions"; // For TypeScript, but good for type hinting

// Load environment variables
// It's crucial to set these as Netlify Environment Variables!
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export default async (req: Request) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("Supabase URL or Anon Key is not set in environment variables.");
    return new Response("Configuration Error", { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  try {
    // Perform a simple read query on a public table to keep the DB active.
    // Replace 'your_table_name' with an actual table name in your database.
    // If you don't have a public table, you can create a small dummy table.
    const { data, error } = await supabase
      .from('your_table_name') // IMPORTANT: Replace with a real table name
      .select('id') // Select a small column
      .limit(1); // Only fetch one row

    if (error) {
      console.error("Supabase Ping Error:", error.message);
      return new Response(`Supabase Ping Failed: ${error.message}`, { status: 500 });
    }

    console.log("Supabase ping successful!", data);
    return new Response("Supabase Ping Successful!", { status: 200 });

  } catch (err) {
    console.error("Unexpected error during Supabase ping:", err);
    return new Response("Unexpected Error", { status: 500 });
  }
};

// Configure the schedule for the function
export const config: Config = {
  schedule: "0 0 * * *", // Runs at midnight (00:00) UTC, every 5th day of the month
};
  // Equivalent cron: 0 0 */6 * *
  // Or: "0 0 * * *" // Daily at midnight UTC (more frequent, safer for free tier)
  // Or: "0 0 * * 1" // Every Monday at midnight UTC (once a week, might be too long for Supabase free tier)