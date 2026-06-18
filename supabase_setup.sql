-- Supabase Auth Matrix Configuration

-- 1. Create the whitelist table
CREATE TABLE IF NOT EXISTS public.access_whitelist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.access_whitelist ENABLE ROW LEVEL SECURITY;

-- 3. Create a policy allowing anyone to READ the whitelist
-- This is necessary so the frontend client can verify their own email upon login
CREATE POLICY "Allow read access to all" 
ON public.access_whitelist 
FOR SELECT 
USING (true);

-- 4. Insert the initial admin user 
-- (You can add more users here or via the Supabase Table Editor)
INSERT INTO public.access_whitelist (email) 
VALUES ('admin@grew.one') 
ON CONFLICT (email) DO NOTHING;
