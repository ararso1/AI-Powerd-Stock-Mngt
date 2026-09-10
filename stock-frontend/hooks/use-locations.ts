"use client";

import { fetchAllLocations } from "@/lib/fetch-all-locations";
import type { LocationsListQueryParams } from "@/lib/list-query";
import { useFetch } from "@/hooks/use-fetch";

export function useLocations(params?: LocationsListQueryParams) {
  const paramsKey = JSON.stringify(params ?? {});
  return useFetch(() => fetchAllLocations(params), [paramsKey]);
}
