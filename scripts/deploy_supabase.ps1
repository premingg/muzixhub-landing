<#
Simple PowerShell helper to link this repo to a Supabase project,
push schema (fresh start), deploy functions, and set function secrets.

Run from the project root in PowerShell. This script does NOT create
storage buckets or copy files — do those steps in the Supabase dashboard.

Usage: .\scripts\deploy_supabase.ps1 -ProjectRef lbwtbojhbqyfgdowjcwi
#>

param(
    [string]$ProjectRef = "lbwtbojhbqyfgdowjcwi"
)

function ExitIfLastError($msg) {
    if ($LASTEXITCODE -ne 0) {
        Write-Error $msg
        exit $LASTEXITCODE
    }
}

Write-Host "Checking for supabase CLI..."
try {
    supabase --version > $null 2>&1
} catch {
    Write-Warning "Supabase CLI not found. Install with: npm install -g supabase"
    exit 1
}

Write-Host "Linking repo to project: $ProjectRef"
supabase link --project-ref $ProjectRef
ExitIfLastError "Failed to link repo to project. Run 'supabase login' and try again."

Write-Host "Pushing database schema (schema-only, fresh start)..."
supabase db push --project-ref $ProjectRef
ExitIfLastError "Failed to push DB schema. Check migrations in the 'supabase/migrations' folder."

Write-Host "Deploying edge functions..."
supabase functions deploy telegram-upload --project-ref $ProjectRef
ExitIfLastError "Failed to deploy telegram-upload function."
supabase functions deploy telegram-stream --project-ref $ProjectRef
ExitIfLastError "Failed to deploy telegram-stream function."

Write-Host "Now setting required function secrets. You will be prompted."
$bot = Read-Host -Prompt 'Enter TELEGRAM_BOT_TOKEN (or press Enter to skip)'
if ($bot -and $bot.Trim() -ne '') {
    supabase secrets set TELEGRAM_BOT_TOKEN="$bot" --project-ref $ProjectRef
    ExitIfLastError "Failed to set TELEGRAM_BOT_TOKEN"
}

$chat = Read-Host -Prompt 'Enter TELEGRAM_CHAT_ID (or press Enter to skip)'
if ($chat -and $chat.Trim() -ne '') {
    supabase secrets set TELEGRAM_CHAT_ID="$chat" --project-ref $ProjectRef
    ExitIfLastError "Failed to set TELEGRAM_CHAT_ID"
}

Write-Host "Done. Next: create storage buckets 'covers' and 'avatars' in the Supabase dashboard, then run the app locally to verify."
