# Supabase Setup Guide

## 1. Create a project
1. Go to https://supabase.com → New project
2. Note your **Project URL** and **anon public** key (Settings → API)

---

## 2. Create the Storage bucket
Storage tab → New bucket:
- **Name**: `event-photos`
- **Public bucket**: ✅ Yes

---

## 3. Run this SQL in the SQL Editor (Database → SQL Editor → New query)

```sql
-- ── Tables ────────────────────────────────────────────────────────

CREATE TABLE public.profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  max_photos  INTEGER NOT NULL DEFAULT 10,
  host_id     UUID REFERENCES auth.users(id) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.photos (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id   UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES auth.users(id) NOT NULL,
  url        TEXT NOT NULL,
  filter_id  TEXT NOT NULL DEFAULT 'natural',
  taken_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_photos_event ON public.photos(event_id, taken_at);

-- ── Auto-create profile on sign-up ────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── Row Level Security ─────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos   ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles viewable by anyone"       ON public.profiles FOR SELECT USING (TRUE);
CREATE POLICY "Users manage own profile"           ON public.profiles FOR ALL    USING (auth.uid() = id);

-- Events
CREATE POLICY "Events viewable by anyone"          ON public.events   FOR SELECT USING (TRUE);
CREATE POLICY "Auth users can create events"       ON public.events   FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Hosts can update their events"      ON public.events   FOR UPDATE USING (auth.uid() = host_id);

-- Photos
CREATE POLICY "Photos viewable by anyone"          ON public.photos   FOR SELECT USING (TRUE);
CREATE POLICY "Auth users insert own photos"       ON public.photos   FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own photos"            ON public.photos   FOR DELETE USING (auth.uid() = user_id);

-- ── Storage policies ──────────────────────────────────────────────

CREATE POLICY "Public read event photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-photos');

CREATE POLICY "Auth users upload event photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'event-photos' AND auth.role() = 'authenticated');

-- ── Enable Realtime ───────────────────────────────────────────────

ALTER TABLE public.photos REPLICA IDENTITY FULL;
```

---

## 4. Enable Realtime
Database → Replication → enable **photos** table.

---

## 5. Add your keys to `supabase.js`
Replace the two placeholder strings at the top of the file with your Project URL and anon key.
