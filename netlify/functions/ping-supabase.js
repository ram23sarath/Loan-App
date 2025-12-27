
export default async (req) => {
  try {
    // Dynamic import to prevent top-level crashes if module is missing
    const { createClient } = await import('@supabase/supabase-js');

    // Load environment variables
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL) {
      console.error("Missing SUPABASE_URL");
      return new Response("Configuration Error: Missing SUPABASE_URL", { status: 500 });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
      return new Response("Configuration Error: Missing SUPABASE_SERVICE_ROLE_KEY (Check Netlify Dashboard)", { status: 500 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Simple query to test connection
    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .limit(1);

    if (error) {
      console.error("Supabase Ping Error:", error.message);
      return new Response(`Supabase Ping Failed: ${error.message}`, { status: 500 });
    }

    console.log("Supabase ping successful!");
    return new Response("Connection to DB Successful", {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });

  } catch (err) {
    console.error("Unexpected error during Supabase ping:", err);
    return new Response(`Unexpected Function Error: ${err.message}`, { status: 500 });
  }
};

export const config = {
  path: "/.netlify/functions/ping-supabase"
};
