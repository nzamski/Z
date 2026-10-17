-- Full-text search over posts (PLAN.md §7.7, docs/search.md). Core `simple` config only; no
-- pg_trgm (open question Q4). Hebrew glues one-letter prefixes (ו ה ב ל מ ש כ) onto words, so the
-- vector holds every word as written, plus each Hebrew word with one and with two leading prefix
-- letters stripped (at least 3 letters must remain: "ובמערכת" -> "במערכת", "מערכת").
-- lib/search.ts also strips one prefix letter from query terms.
CREATE OR REPLACE FUNCTION z_search_vector(body text) RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT to_tsvector('simple', body)
      || to_tsvector('simple', regexp_replace(body, '(^|[^א-ת])[והבלמשכ]([א-ת]{3})', '\1\2', 'g'))
      || to_tsvector('simple', regexp_replace(body, '(^|[^א-ת])[והבלמשכ]{2}([א-ת]{3})', '\1\2', 'g'))
$$;
