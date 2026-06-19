# Supabase Security Configuration

## Single-Entry-Point Architecture

This application uses a hardcoded, single-entry-point security model for maximum protection.

### Auth Callback URL (Fixed)

**The ONLY allowed auth callback URL is:**
```
http://127.0.0.1:8000/auth/callback
```

**This URL must be whitelisted in Supabase:**

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Authentication → URL Configuration**
4. Under **Redirect URLs**, add:
   ```
   http://127.0.0.1:8000/auth/callback
   ```
5. **Remove any other URLs** (localhost:5173, localhost:3000, etc.)
6. Save changes

### Why Single Entry Point?

- ✅ **No dynamic origin:** Auth only works from `127.0.0.1:8000`
- ✅ **No localhost variants:** `localhost:5173`, `:8001`, etc. will NOT work
- ✅ **Production-safe:** Only the deployed URL will authenticate
- ✅ **Whitelist enforced:** Supabase rejects requests from any other origin

---

## Database Access (Edge Functions Only)

Database queries must go through Supabase Edge Functions, NOT directly from the client.

### Architecture

```
Frontend (127.0.0.1:8000)
    ↓
Supabase Edge Function (auth + validation)
    ↓
Supabase Database
```

### Implementation

**Never do this (❌ INSECURE):**
```typescript
const { data } = await supabase
    .from('access_whitelist')
    .select('*');
```

**Always use Edge Functions (✅ SECURE):**
```typescript
const { data } = await supabase.functions.invoke('get-whitelist', {
    body: { email: user.email }
});
```

### Edge Function Example

Create `supabase/functions/get-whitelist/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
    const { email } = await req.json();

    // Verify JWT token
    const token = req.headers.get('Authorization')?.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);
    
    if (!user) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Only allow users to query their own email
    if (user.email !== email) {
        return new Response('Forbidden', { status: 403 });
    }

    // Query database securely
    const { data } = await supabase
        .from('access_whitelist')
        .select('features')
        .eq('email', email)
        .single();

    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
    });
});
```

### Row-Level Security (RLS)

Enable RLS on all tables:

1. **Supabase Dashboard** → **Authentication → Policies**
2. For `access_whitelist` table, create policy:
   ```sql
   CREATE POLICY "Users can only view their own record"
   ON access_whitelist
   FOR SELECT
   USING (auth.jwt() ->> 'email' = email);
   ```

---

## Current Configuration

✅ **Auth callback:** Hardcoded to `http://127.0.0.1:8000/auth/callback`
✅ **Entry point:** Single URL only
⏳ **Edge functions:** Set up as needed for DB access
⏳ **RLS policies:** Configure per table

---

## Testing

After configuration, test auth flow:

1. Start backend: `uvicorn main:app --port 8000 --host 127.0.0.1`
2. Open: `http://127.0.0.1:8000`
3. Enter email → check magic link arrives
4. Click link → should redirect to `http://127.0.0.1:8000/auth/callback`
5. Login should succeed only if email is in `access_whitelist`

**If testing from different URL:**
- `http://localhost:5173` ❌ Will NOT work
- `http://127.0.0.1:5173` ❌ Will NOT work
- `http://192.168.x.x:8000` ❌ Will NOT work
- **Only** `http://127.0.0.1:8000` ✅ Works

