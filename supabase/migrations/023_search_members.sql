-- Member search for the New Message / Send-to-member picker.
--
-- SECURITY DEFINER so it works independently of user_profiles RLS (the broad
-- "authenticated read all profiles" policy is slated to be tightened). Output
-- is locked to four non-sensitive columns — never email — and capped at 8 rows.
-- Mirrors the member_directory view's filter (directory_visible = true) and
-- always excludes the caller.
--
-- Matching: case-insensitive prefix on the whole display_name OR on any word
-- in it, so "jo" and "smi" both find "John Smith". Label is first word + last
-- initial ("John S."), or just the word for single-word names.

CREATE INDEX IF NOT EXISTS user_profiles_display_name_lower_idx
  ON public.user_profiles (lower(display_name) text_pattern_ops);

CREATE OR REPLACE FUNCTION public.search_members(query text)
RETURNS TABLE (id uuid, display_label text, avatar_url text, user_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH q AS (
    -- Escape LIKE wildcards so user input is matched literally
    SELECT replace(replace(replace(lower(btrim(left(query, 50))), '\', '\\'), '%', '\%'), '_', '\_') AS pat,
           length(btrim(query)) AS len
  )
  SELECT
    p.id,
    CASE
      WHEN array_length(s.parts, 1) > 1
        THEN s.parts[1] || ' ' || upper(left(s.parts[array_length(s.parts, 1)], 1)) || '.'
      ELSE s.parts[1]
    END AS display_label,
    p.avatar_url,
    -- Only approved sommeliers get the Sommelier badge, matching the app's isSommelier check
    CASE WHEN p.user_role = 'sommelier' AND p.sommelier_status = 'approved'
         THEN 'sommelier' ELSE 'enthusiast' END AS user_role
  FROM public.user_profiles p
  CROSS JOIN q
  CROSS JOIN LATERAL (
    SELECT regexp_split_to_array(btrim(p.display_name), '\s+') AS parts
  ) s
  WHERE auth.uid() IS NOT NULL
    AND q.len >= 2
    AND p.id <> auth.uid()
    AND p.directory_visible = true
    AND btrim(coalesce(p.display_name, '')) <> ''
    AND (
      lower(p.display_name) LIKE q.pat || '%'
      OR lower(p.display_name) LIKE '% ' || q.pat || '%'
    )
  ORDER BY (lower(p.display_name) LIKE q.pat || '%') DESC, lower(p.display_name)
  LIMIT 8;
$$;

REVOKE ALL ON FUNCTION public.search_members(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_members(text) TO authenticated;
