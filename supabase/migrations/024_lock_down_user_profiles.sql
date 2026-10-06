-- 024: Lock down user_profiles (pre-submission security fix).
--
-- Problem: any authenticated user could read every user_profiles row (emails,
-- push tokens, cert URLs) via the "authenticated read all profiles" policy, and
-- could UPDATE their own row to set is_creator / user_role / sommelier_status.
-- is_creator grants UPDATE on wine_entries (entries_creator), so that was a
-- privilege escalation.
--
-- After this migration:
--   * user_profiles SELECT = own row (user_profiles_self_select) or admin
--     (user_profiles_creator_select, via app_admins). Nothing else.
--   * member_directory / member_profiles views (run as owner) expose only safe
--     columns, never email.
--   * Admin push tokens come from get_admin_push_tokens(), not a table read.
--   * A trigger blocks self-service changes to privileged columns.
--
-- Note: the old "drop subscription_tier" follow-up is now 025.

-- ─── 1. Drop the broad read-all policies ─────────────────────────────────────
-- Live name first; the second is the name used in shared_wines.sql / DEPLOY.sql.
DROP POLICY IF EXISTS "authenticated read all profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated users can search profiles" ON public.user_profiles;

-- ─── 2. member_directory: run as owner so it still lists all members ─────────
-- INTENTIONAL security-definer-style view (Supabase linter will flag it):
-- it exposes only non-sensitive columns (id, display_name, avatar_url,
-- is_creator, user_role, member_since) and never email. With
-- security_invoker = true it would show only the caller's own row now that
-- the read-all policy is gone.
ALTER VIEW public.member_directory SET (security_invoker = false);
REVOKE ALL ON public.member_directory FROM PUBLIC, anon;
GRANT SELECT ON public.member_directory TO authenticated;

-- ─── 3. member_profiles: names + avatars for messaging threads ───────────────
-- INTENTIONAL owner-run view (linter will flag it). All members are included,
-- even those with directory_visible = false, because existing conversations
-- must still show the other person's name and avatar. Discoverability is
-- enforced elsewhere (member_directory and search_members filter on
-- directory_visible). No email or other sensitive columns.
CREATE OR REPLACE VIEW public.member_profiles
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.display_name,
  p.avatar_url,
  -- Only approved sommeliers get the badge, matching the app's isSommelier check
  CASE WHEN p.user_role = 'sommelier' AND p.sommelier_status = 'approved'
       THEN 'sommelier' ELSE 'enthusiast' END AS user_role
FROM public.user_profiles p;

REVOKE ALL ON public.member_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.member_profiles TO authenticated;

-- ─── 4. Admin push tokens without exposing user_profiles ─────────────────────
-- Used by notifyAdminsOfNewApplication (runs as the applicant). Returns
-- tokens only to a caller whose own application is pending, so it can't be
-- used as a general token lookup by arbitrary signed-in users.
CREATE OR REPLACE FUNCTION public.get_admin_push_tokens()
RETURNS TABLE (push_token text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.push_token
  FROM public.user_profiles p
  JOIN public.app_admins a ON a.user_id = p.id
  WHERE p.push_token IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM public.user_profiles me
              WHERE me.id = auth.uid() AND me.sommelier_status = 'pending')
      OR EXISTS (SELECT 1 FROM public.app_admins x WHERE x.user_id = auth.uid())
    );
$$;

REVOKE ALL ON FUNCTION public.get_admin_push_tokens() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_push_tokens() TO authenticated;

-- ─── 5. Protect privileged columns on user_profiles ──────────────────────────
-- Skipped for: service role / SQL editor / security-definer callers
-- (auth.uid() IS NULL) and admins (app_admins).
CREATE OR REPLACE FUNCTION public.protect_user_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.app_admins WHERE user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.user_role := 'enthusiast';
    NEW.is_creator := false;
    NEW.sommelier_status := NULL;
    NEW.sommelier_rejection_reason := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.is_creator IS DISTINCT FROM OLD.is_creator THEN
    RAISE EXCEPTION 'user_profiles: is_creator can only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.sommelier_rejection_reason IS DISTINCT FROM OLD.sommelier_rejection_reason THEN
    RAISE EXCEPTION 'user_profiles: sommelier_rejection_reason can only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;

  -- The only self-service status change is applying: -> 'pending' together
  -- with a certificate URL (submitSommelierApplication). Approved members
  -- cannot re-apply.
  IF NEW.sommelier_status IS DISTINCT FROM OLD.sommelier_status THEN
    IF NEW.sommelier_status = 'pending'
       AND OLD.sommelier_status IS DISTINCT FROM 'approved'
       AND NEW.sommelier_cert_url IS NOT NULL THEN
      NULL; -- allowed
    ELSE
      RAISE EXCEPTION 'user_profiles: sommelier_status can only be changed by an admin (except applying: pending with a certificate)'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- user_role is set only by admins (updateSommelierStatus sets 'sommelier'
  -- on approval and back to 'enthusiast' otherwise). Applying leaves it alone.
  IF NEW.user_role IS DISTINCT FROM OLD.user_role THEN
    RAISE EXCEPTION 'user_profiles: user_role can only be changed by an admin'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_profile_columns ON public.user_profiles;
CREATE TRIGGER trg_protect_user_profile_columns
  BEFORE INSERT OR UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_columns();

-- ─── 6. App Review demo account: paa_som must reach the Admin panel ──────────
-- Two gates: the UI shows the Admin panel when user_profiles.is_creator is true
-- (SettingsScreen), and the server lets it read/approve everything via an
-- app_admins row (policies user_profiles_creator_select / _admin_update,
-- wine_entries_creator_select). app_admins has a single column, user_id.
-- Runs as the migration role (auth.uid() IS NULL), so the trigger lets it through.
DO $$
DECLARE
  som_id uuid;
BEGIN
  SELECT id INTO som_id FROM auth.users WHERE email = 'paa_som@paa.com';
  IF som_id IS NULL THEN
    RAISE WARNING '024: paa_som@paa.com not found in auth.users; admin grant skipped';
  ELSE
    INSERT INTO public.app_admins (user_id) VALUES (som_id) ON CONFLICT DO NOTHING;
    UPDATE public.user_profiles SET is_creator = true WHERE id = som_id;
  END IF;
END $$;
