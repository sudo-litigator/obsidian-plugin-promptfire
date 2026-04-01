import type { TFile } from "obsidian";

export type SearchField = "any" | "path" | "name" | "text" | "tag" | "heading" | "frontmatter";

export interface SearchQueryClause {
  field: SearchField;
  frontmatterKey?: string;
  negate: boolean;
  value?: string;
}

export interface SearchIndexEntry {
  file: TFile;
  frontmatter: Record<string, string[]>;
  headings: string[];
  name: string;
  path: string;
  tags: string[];
  text: string;
}

function tokenizeQuery(query: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let inQuotes = false;
  let escaped = false;

  for (const character of query) {
    if (escaped) {
      current += character;
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && /\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function parseClause(token: string): SearchQueryClause | null {
  const negate = token.startsWith("-");
  const rawToken = negate ? token.slice(1) : token;

  if (!rawToken) {
    return null;
  }

  const prefixMatch = rawToken.match(/^(path|name|text|content|tag|heading|h|fm|frontmatter):(.*)$/i);

  if (!prefixMatch) {
    return {
      field: "any",
      negate,
      value: rawToken.toLowerCase(),
    };
  }

  const rawField = prefixMatch[1];
  const rawValue = prefixMatch[2];

  if (!rawField || rawValue === undefined) {
    return null;
  }

  const field = rawField.toLowerCase();
  const value = rawValue.trim();

  if (!value) {
    return null;
  }

  if (field === "path") {
    return { field: "path", negate, value: value.toLowerCase() };
  }

  if (field === "name") {
    return { field: "name", negate, value: value.toLowerCase() };
  }

  if (field === "text" || field === "content") {
    return { field: "text", negate, value: value.toLowerCase() };
  }

  if (field === "tag") {
    return { field: "tag", negate, value: value.replace(/^#/, "").toLowerCase() };
  }

  if (field === "heading" || field === "h") {
    return { field: "heading", negate, value: value.toLowerCase() };
  }

  const [frontmatterKey, ...frontmatterValueParts] = value.split("=");
  const normalizedFrontmatterKey = frontmatterKey?.trim().toLowerCase();

  if (!normalizedFrontmatterKey) {
    return null;
  }

  const frontmatterValue = frontmatterValueParts.join("=").trim().toLowerCase();

  return {
    field: "frontmatter",
    frontmatterKey: normalizedFrontmatterKey,
    negate,
    value: frontmatterValue || undefined,
  };
}

function uniqueLowercase(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean))];
}

function includesValue(values: string[], term: string): boolean {
  return values.some((value) => value.includes(term));
}

function matchFrontmatter(entry: SearchIndexEntry, clause: SearchQueryClause): boolean {
  if (!clause.frontmatterKey) {
    return false;
  }

  const matchingEntry = Object.entries(entry.frontmatter).find(([key]) => key === clause.frontmatterKey);

  if (!matchingEntry) {
    return false;
  }

  if (!clause.value) {
    return true;
  }

  const [, values] = matchingEntry;
  return includesValue(values, clause.value);
}

function matchClause(entry: SearchIndexEntry, clause: SearchQueryClause): number {
  const term = clause.value ?? "";

  if (!term && clause.field !== "frontmatter") {
    return 0;
  }

  if (clause.field === "path") {
    return entry.path.includes(term) ? 4 : 0;
  }

  if (clause.field === "name") {
    return entry.name.includes(term) ? 5 : 0;
  }

  if (clause.field === "text") {
    return entry.text.includes(term) ? 1 : 0;
  }

  if (clause.field === "tag") {
    return includesValue(entry.tags, term) ? 5 : 0;
  }

  if (clause.field === "heading") {
    return includesValue(entry.headings, term) ? 4 : 0;
  }

  if (clause.field === "frontmatter") {
    return matchFrontmatter(entry, clause) ? 4 : 0;
  }

  const weights = [
    entry.name.includes(term) ? 5 : 0,
    entry.path.includes(term) ? 4 : 0,
    includesValue(entry.tags, term) ? 5 : 0,
    includesValue(entry.headings, term) ? 4 : 0,
    includesValue(Object.values(entry.frontmatter).flat(), term) ? 3 : 0,
    entry.text.includes(term) ? 1 : 0,
  ];

  return Math.max(...weights);
}

export function parseSearchQuery(query: string): SearchQueryClause[] {
  return tokenizeQuery(query)
    .map((token) => parseClause(token))
    .filter((clause): clause is SearchQueryClause => clause !== null);
}

export function scoreSearchIndexEntry(
  entry: SearchIndexEntry,
  clauses: SearchQueryClause[],
): number | null {
  let score = 0;

  for (const clause of clauses) {
    const clauseScore = matchClause(entry, clause);

    if (clause.negate) {
      if (clauseScore > 0) {
        return null;
      }
      continue;
    }

    if (clauseScore === 0) {
      return null;
    }

    score += clauseScore;
  }

  return score;
}

export function normalizeSearchIndexEntry(entry: SearchIndexEntry): SearchIndexEntry {
  return {
    ...entry,
    frontmatter: Object.fromEntries(
      Object.entries(entry.frontmatter).map(([key, values]) => [key.toLowerCase(), uniqueLowercase(values)]),
    ),
    headings: uniqueLowercase(entry.headings),
    name: entry.name.toLowerCase(),
    path: entry.path.toLowerCase(),
    tags: uniqueLowercase(entry.tags.map((tag) => tag.replace(/^#/, ""))),
    text: entry.text.toLowerCase(),
  };
}
