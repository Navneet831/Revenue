ALTER TABLE public.access_whitelist ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{"dashboard": true, "ledger": true, "audit": true}'::jsonb;
UPDATE public.access_whitelist SET features = '{"dashboard": true, "ledger": true, "audit": true}'::jsonb WHERE features IS NULL;

-- Allow all authenticated users to be automatically added to the whitelist when they sign up?
-- Wait, if we "Give permision to all user", we can create a trigger on auth.users to insert them into access_whitelist with default features.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.access_whitelist (email, features)
  VALUES (new.email, '{"dashboard": true, "ledger": true, "audit": true}'::jsonb)
  ON CONFLICT (email) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Let's also insert all existing users from auth.users into access_whitelist
INSERT INTO public.access_whitelist (email, features)
SELECT email, '{"dashboard": true, "ledger": true, "audit": true}'::jsonb
FROM auth.users
ON CONFLICT (email) DO NOTHING;
