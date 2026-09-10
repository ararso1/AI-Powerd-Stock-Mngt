import { fetchAllPages } from "@/lib/fetch-all-pages";
import {
  buildLocationsListPath,
  type LocationsListQueryParams,
} from "@/lib/list-query";
import type { Location } from "@/lib/types";

export async function fetchAllLocations(
  params?: LocationsListQueryParams
): Promise<Location[]> {
  return fetchAllPages<Location>((page, limit) =>
    buildLocationsListPath(params, page, limit)
  );
}
