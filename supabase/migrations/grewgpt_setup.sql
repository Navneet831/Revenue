-- GrewGPT setup: run once in Supabase SQL Editor
-- 1. User preferences table
CREATE TABLE IF NOT EXISTS public.grewgpt_user_prefs (
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email  TEXT NOT NULL,
    pref_key    TEXT NOT NULL,
    pref_value  TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT grewgpt_user_prefs_uq UNIQUE (user_email, pref_key)
);

ALTER TABLE public.grewgpt_user_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own prefs"
    ON public.grewgpt_user_prefs
    FOR ALL
    USING (auth.email() = user_email)
    WITH CHECK (auth.email() = user_email);

-- 2. Ensure app_config table exists
CREATE TABLE IF NOT EXISTS public.app_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Seed default GrewGPT config (safe to re-run — uses ON CONFLICT DO NOTHING)
INSERT INTO public.app_config (key, value, description) VALUES
(
    'grewgpt_system_prompt',
    'You are GrewGPT, the executive AI financial analyst for Grew Energy Ltd, a solar energy manufacturing company. You serve the CEO and CFO with real-time revenue intelligence.

ABSOLUTE RULES — NEVER BREAK THESE:
1. SCOPE: Only answer questions about revenue, sales performance, customer analytics, segment analysis, financial KPIs, growth metrics, pacing, market mix, and business strategy. Decline everything else.
2. REFUSAL: If a question is about technology, software, code, databases, IT systems, APIs, tech stacks, or any non-business topic, respond ONLY with: "I only assist with revenue and financial performance analytics."
3. CURRENCY: All monetary values MUST be in Indian Rupees formatted in Crores with exactly 2 decimal places. Format: ₹XX.XX Cr. Never use $ or other currencies.
4. FORMAT: ALL responses MUST use Markdown table format exclusively. No bullet points or paragraphs for data. Every piece of quantitative information goes in a table.
5. TABLE RULES: Include column headers, use | pipe format, always add a TOTAL or SUMMARY row at the bottom of each table.
6. GROWTH: When comparing periods, show both absolute change (₹ Cr) and % change in separate columns.
7. FISCAL YEAR: Indian financial year is April–March. Reference as FY25 (Apr 2024–Mar 2025) etc.
8. ROUNDING: All revenue figures rounded to 2 decimal places.',
    'AI system instructions — edit this value to change GrewGPT behavior without redeploying'
),
('grewgpt_model',        'openai/gpt-4o-mini',  'OpenRouter model slug'),
('grewgpt_provider',     'openrouter',           'AI provider'),
('grewgpt_temperature',  '0.3',                  '0.0 = deterministic, 1.0 = creative'),
('grewgpt_max_tokens',   '2048',                 'Max tokens per response')
ON CONFLICT (key) DO NOTHING;

-- 4. Ensure grewgpt_conversations table has all required columns
CREATE TABLE IF NOT EXISTS public.grewgpt_conversations (
    id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_email               TEXT,
    user_prompt              TEXT,
    ai_response              TEXT,
    ai_model                 VARCHAR,
    ai_provider              VARCHAR,
    conversation_session_id  TEXT,
    created_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.grewgpt_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own conversations"
    ON public.grewgpt_conversations
    FOR SELECT
    USING (auth.email() = user_email);

CREATE POLICY "Users insert own conversations"
    ON public.grewgpt_conversations
    FOR INSERT
    WITH CHECK (auth.email() = user_email);
