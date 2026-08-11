/**
 * Shared pagination helper for full-history trade queries.
 *
 * Supabase's PostgREST API layer caps any unbounded `.select()` at 1000 rows
 * by default. Several queries in this codebase select every trade for a
 * user (no `.limit()`/`.range()`) to compute aggregates — win rate, account
 * balance, pattern memory, weekly debrief stats. For an account with 1000+
 * trades those queries were silently truncated instead of erroring, quietly
 * corrupting whatever was computed from them (see fetch-trades.ts for the
 * first instance of this bug).
 *
 * This helper pages through `.range()` calls until a page comes back short,
 * so callers get the true full result set regardless of row count.
 */

const FETCH_PAGE_SIZE = 1000
/** Safety cap so a pathological account can't hang the request indefinitely. */
const FETCH_MAX_PAGES = 50

export type PaginatedFetchError = { message: string; code?: string }

/**
 * Returns the raw error object (not just its message) so callers can still
 * run their own error-classification helpers (e.g. "is this a missing
 * table/column error?") that check `.code` in addition to `.message`.
 */
export async function fetchAllRowsPaginated<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: PaginatedFetchError | null }>,
): Promise<{ rows: T[]; error: PaginatedFetchError | null }> {
  const rows: T[] = []

  for (let page = 0; page < FETCH_MAX_PAGES; page++) {
    const from = page * FETCH_PAGE_SIZE
    const to = from + FETCH_PAGE_SIZE - 1

    const { data, error } = await buildQuery(from, to)

    if (error) {
      return { rows, error }
    }

    const batch = data ?? []
    rows.push(...batch)

    if (batch.length < FETCH_PAGE_SIZE) {
      break
    }
  }

  return { rows, error: null }
}
