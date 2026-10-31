import { UserAllocation, DEFAULT_USER_ALLOCATIONS } from '../types/allocation';
import { TranslatedCcfRow } from '../types/ccf';

const ALLOC_IDB_KEY = 'user_allocations_v1';

export async function loadAllocations(): Promise<UserAllocation[]> {
  try {
    const res = await fetch('/api/allocations', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('[Allocations] Server fetch failed, checking local storage', err);
  }

  try {
    const saved = localStorage.getItem(ALLOC_IDB_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Allocations] Local read failed', e);
  }

  return DEFAULT_USER_ALLOCATIONS;
}

export async function saveAllocations(allocations: UserAllocation[]): Promise<boolean> {
  try {
    localStorage.setItem(ALLOC_IDB_KEY, JSON.stringify(allocations));
  } catch (e) {
    console.warn(e);
  }

  try {
    const res = await fetch('/api/allocations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allocations),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Allocations] Server save error', err);
    return false;
  }
}

/**
 * Normalizes strings for robust matching:
 * Removes whitespace, symbols, lowercases.
 */
function normalizeKey(str?: string): string {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds user allocation matching an assignee string.
 * Supports matching by short Jira username ('amasri'), full name ('Abdelfattah Al-Masri'),
 * or partial name.
 */
export function matchAllocation(
  assigneeRaw: string,
  allocations: UserAllocation[]
): UserAllocation | undefined {
  if (!assigneeRaw) return undefined;
  const rawClean = assigneeRaw.trim().toLowerCase();
  const rawKey = normalizeKey(assigneeRaw);

  // 1. Exact match on assignee username (e.g. "amasri" === "amasri")
  let match = allocations.find((a) => a.assignee.toLowerCase() === rawClean);
  if (match) return match;

  // 2. Exact match on owner display name (e.g. "abdelfattah al-masri")
  match = allocations.find((a) => a.owner.toLowerCase() === rawClean);
  if (match) return match;

  // 3. Normalized key match
  match = allocations.find((a) => normalizeKey(a.assignee) === rawKey);
  if (match) return match;

  match = allocations.find((a) => normalizeKey(a.owner) === rawKey);
  if (match) return match;

  // 4. Substring / contains match (e.g. "sparameswaran" within "sparameswaran@etisalat.ae")
  match = allocations.find(
    (a) =>
      rawClean.includes(a.assignee.toLowerCase()) ||
      a.owner.toLowerCase().includes(rawClean) ||
      rawClean.includes(a.owner.toLowerCase())
  );
  if (match) return match;

  return undefined;
}

/**
 * Automatically applies the latest User Allocations to a dataset of CCF rows,
 * guaranteeing consistent Owner display names and HOD team assignments.
 */
export function applyAllocationsToRows(
  rows: TranslatedCcfRow[],
  allocations: UserAllocation[]
): TranslatedCcfRow[] {
  return rows.map((row) => {
    const rawAssignee = String(row.assignee || '').trim();
    const alloc = matchAllocation(rawAssignee, allocations);

    if (alloc) {
      return {
        ...row,
        assignee: alloc.owner, // Standardized full display name
        hod: alloc.hod,        // Assigned Team Lead / Head of Department
        assigneeKey: alloc.assignee, // Jira username
      };
    }

    return row;
  });
}

/**
 * Identifies assignees in uploaded spreadsheet that are not yet mapped in the allocations table.
 */
export function findUnmappedAssignees(
  rows: TranslatedCcfRow[],
  allocations: UserAllocation[]
): { rawName: string; count: number }[] {
  const unmappedCounts: Record<string, number> = {};

  rows.forEach((row) => {
    const raw = String(row.assignee || '').trim();
    if (!raw || raw === 'Unassigned') return;
    const match = matchAllocation(raw, allocations);
    if (!match) {
      unmappedCounts[raw] = (unmappedCounts[raw] || 0) + 1;
    }
  });

  return Object.entries(unmappedCounts).map(([rawName, count]) => ({
    rawName,
    count,
  }));
}
