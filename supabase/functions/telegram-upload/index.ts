// Uploads files to Telegram – auth validated in code (verify_jwt=false in config.toml)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_API = "https://api.telegram.org";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");
    if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");
    if (!CHAT_ID) throw new Error("TELEGRAM_CHAT_ID not configured");

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const formData = await req.formData();
    const type = formData.get("type") as string; // "audio" or "photo"
    const file = formData.get("file") as File;
    const title = formData.get("title") as string | null;
    const artist = formData.get("artist") as string | null;

    if (!file || !type) {
      return new Response(JSON.stringify({ error: "Missing file or type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let endpoint: string;

    if (type === "audio") {
      endpoint = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendAudio`;
    } else if (type === "photo") {
      endpoint = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendPhoto`;
    } else {
      endpoint = `${TELEGRAM_API}/bot${BOT_TOKEN}/sendDocument`;
    }

    const buildTelegramForm = (chatId: string) => {
      const form = new FormData();
      form.append("chat_id", chatId);

      if (type === "audio") {
        form.append("audio", file, file.name);
        if (title) form.append("title", title);
        if (artist) form.append("performer", artist);
      } else if (type === "photo") {
        form.append("photo", file, file.name);
      } else {
        form.append("document", file, file.name);
      }

      return form;
    };

    const sendToTelegram = async (chatId: string) => {
      const response = await fetch(endpoint, {
        method: "POST",
        body: buildTelegramForm(chatId),
      });
      const data = await response.json();
      return { response, data };
    };

    let { response: tgRes, data: tgData } = await sendToTelegram(CHAT_ID);

    if ((!tgRes.ok || !tgData.ok) && tgData?.parameters?.migrate_to_chat_id) {
      const migratedChatId = String(tgData.parameters.migrate_to_chat_id);
      console.warn(`Telegram chat migrated, retrying with chat_id=${migratedChatId}`);
      ({ response: tgRes, data: tgData } = await sendToTelegram(migratedChatId));
    }

    if (!tgRes.ok || !tgData.ok) {
      throw new Error(`Telegram API error: ${JSON.stringify(tgData)}`);
    }

    // Extract file_id
    let fileId: string | null = null;
    const msg = tgData.result;

    if (type === "audio" && msg.audio) {
      fileId = msg.audio.file_id;
    } else if (type === "photo" && msg.photo) {
      // Get largest photo
      fileId = msg.photo[msg.photo.length - 1].file_id;
    } else if (msg.document) {
      fileId = msg.document.file_id;
    }

    return new Response(
      JSON.stringify({ success: true, file_id: fileId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Telegram upload error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
