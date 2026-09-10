import { fetchAllPages } from "@/lib/fetch-all-pages";
import { apiPaginated } from "@/lib/list-response";
import {
  buildCustomersListPath,
  buildSuppliersListPath,
} from "@/lib/list-query";
import { MAX_LIMIT } from "@/lib/pagination";
import type { Customer, Supplier } from "@/lib/types";

export interface PartyOption {
  id: string;
  label: string;
}

export function formatPartyLabel(party: {
  name: string;
  phone?: string | null;
  email?: string | null;
}): string {
  const parts = [party.name];
  if (party.phone?.trim()) parts.push(party.phone.trim());
  else if (party.email?.trim()) parts.push(party.email.trim());
  return parts.join(" · ");
}

export function partySelectOptions(
  parties: Array<{
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  }>,
  selectedId: string,
  selectedRecord?: {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
  } | null
): PartyOption[] {
  const map = new Map<string, PartyOption>();
  for (const party of parties) {
    map.set(party.id, { id: party.id, label: formatPartyLabel(party) });
  }
  if (selectedId && selectedRecord && !map.has(selectedId)) {
    map.set(selectedId, {
      id: selectedId,
      label: formatPartyLabel(selectedRecord),
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

async function fetchPartyList<T>(
  buildPath: (search?: string, page?: number, limit?: number) => string,
  search?: string
): Promise<T[]> {
  const term = search?.trim();
  if (term) {
    const result = await apiPaginated<T>(buildPath(term, 1, MAX_LIMIT));
    return result.data;
  }
  return fetchAllPages<T>((page, limit) => buildPath(undefined, page, limit));
}

export function fetchCustomers(search?: string): Promise<Customer[]> {
  return fetchPartyList<Customer>((term, page, limit) =>
    buildCustomersListPath(term ? { search: term } : undefined, page, limit)
  );
}

export function fetchSuppliers(search?: string): Promise<Supplier[]> {
  return fetchPartyList<Supplier>((term, page, limit) =>
    buildSuppliersListPath(term ? { search: term } : undefined, page, limit)
  );
}
