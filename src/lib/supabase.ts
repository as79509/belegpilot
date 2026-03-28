import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[Supabase] Missing env vars:",
    !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : "",
    !supabaseKey ? "SUPABASE_SERVICE_ROLE_KEY" : ""
  );
}

if (supabaseKey && supabaseKey.length < 100) {
  console.warn(
    `[Supabase] SUPABASE_SERVICE_ROLE_KEY looks too short (${supabaseKey.length} chars). ` +
      "A valid service role key is a JWT starting with 'eyJ...' (~170+ chars). " +
      "Find it at: Supabase Dashboard → Settings → API → service_role key."
  );
}

export const supabase = createClient(supabaseUrl!, supabaseKey!);
