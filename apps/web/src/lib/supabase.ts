import { createClient } from "@supabase/supabase-js";
import { SchwankiApi } from "@schwanki/core";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
);
export const api = new SchwankiApi(supabase);
