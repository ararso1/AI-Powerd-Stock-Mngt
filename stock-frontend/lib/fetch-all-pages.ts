import { apiPaginated } from "@/lib/list-response";
import { MAX_LIMIT } from "@/lib/pagination";

export async function fetchAllPages<T>(
  buildPath: (page: number, limit: number) => string
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;

  while (true) {
    const result = await apiPaginated<T>(buildPath(page, MAX_LIMIT));
    items.push(...result.data);
    if (page >= result.meta.totalPages || result.data.length === 0) {
      break;
    }
    page += 1;
  }

  return items;
}
