import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

interface PagedList<T> {
  items: T[];
  /** True until the first page has arrived. */
  isLoading: boolean;
  isError: boolean;
  isFetchingMore: boolean;
  /** True while the server may hold rows that are not loaded yet. */
  hasMore: boolean;
  /** Loads the next page, if there is one and nothing is already loading. */
  loadMore: () => void;
  /** Reloads every page already shown (used by pull to refresh). */
  refetch: () => Promise<unknown>;
}

/**
 * A long list loaded one page at a time. `fetchPage(offset)` returns up to
 * `pageSize` rows starting at `offset`; a short page means the end.
 *
 * Paging is by offset, so a row added on the server between two page loads can
 * shift the next page by one. Rows are therefore de-duplicated by id, which
 * also keeps list keys unique.
 */
export function usePagedList<T>(
  queryKey: QueryKey,
  fetchPage: (offset: number) => Promise<T[]>,
  pageSize: number,
  getId: (item: T) => string,
): PagedList<T> {
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => (lastPage.length < pageSize ? undefined : allPages.length * pageSize),
  });

  const pages = query.data?.pages;
  const items = useMemo(() => {
    const seen = new Set<string>();
    const unique: T[] = [];
    for (const page of pages ?? []) {
      for (const item of page) {
        const id = getId(item);
        if (seen.has(id)) continue;
        seen.add(id);
        unique.push(item);
      }
    }
    return unique;
  }, [pages, getId]);

  const { hasNextPage, isFetching, isFetchingNextPage, fetchNextPage, refetch } = query;
  // `isFetching` covers a refresh too: asking for the next page then would cancel it.
  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetching) void fetchNextPage();
  }, [hasNextPage, isFetching, fetchNextPage]);

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetchingMore: isFetchingNextPage,
    hasMore: hasNextPage,
    loadMore,
    refetch,
  };
}
