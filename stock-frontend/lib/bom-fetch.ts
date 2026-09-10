import { fetchAllPages } from "@/lib/fetch-all-pages";
import { buildBomsListPath } from "@/lib/list-query";
import type { Bom } from "@/lib/types";

export async function fetchAllBoms(params?: {
  finishedItemId?: string;
  isActive?: boolean;
  search?: string;
}): Promise<Bom[]> {
  return fetchAllPages<Bom>((page, limit) =>
    buildBomsListPath(params, page, limit)
  );
}
