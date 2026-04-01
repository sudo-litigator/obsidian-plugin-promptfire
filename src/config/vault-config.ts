import { App, TFile, TFolder, normalizePath } from "obsidian";

import type { PromptfireSettings } from "../settings";

export interface VaultConfigStatus {
  error?: string;
  path: string;
  state: "disabled" | "error" | "loaded" | "missing";
}

function stripJsonComments(input: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const nextCharacter = input[index + 1];

    if (inString) {
      result += character;

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === "/" && nextCharacter === "/") {
      while (index < input.length && input[index] !== "\n") {
        index += 1;
      }

      if (index < input.length) {
        result += "\n";
      }
      continue;
    }

    if (character === "/" && nextCharacter === "*") {
      index += 2;

      while (index < input.length) {
        if (input[index] === "*" && input[index + 1] === "/") {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    result += character;
  }

  return result;
}

function stripTrailingCommas(input: string): string {
  let result = "";
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inString) {
      result += character;

      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }

      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }

    if (character === ",") {
      let lookahead = index + 1;

      while (lookahead < input.length && /\s/.test(input[lookahead] ?? "")) {
        lookahead += 1;
      }

      const nextCharacter = input[lookahead];

      if (nextCharacter === "}" || nextCharacter === "]") {
        continue;
      }
    }

    result += character;
  }

  return result;
}

function parseJsonc<T>(content: string): T {
  const withoutComments = stripJsonComments(content);
  const withoutTrailingCommas = stripTrailingCommas(withoutComments);
  return JSON.parse(withoutTrailingCommas) as T;
}

async function ensureFolderPath(app: App, folderPath: string): Promise<void> {
  if (!folderPath) {
    return;
  }

  const normalizedFolderPath = normalizePath(folderPath);
  const existing = app.vault.getAbstractFileByPath(normalizedFolderPath);

  if (existing instanceof TFolder) {
    return;
  }

  const segments = normalizedFolderPath.split("/");
  let currentPath = "";

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    const current = app.vault.getAbstractFileByPath(currentPath);

    if (!current) {
      await app.vault.createFolder(currentPath);
    }
  }
}

export async function loadVaultConfig(
  app: App,
  configPath: string,
): Promise<{ config: Partial<PromptfireSettings> | null; status: VaultConfigStatus }> {
  const normalizedConfigPath = normalizePath(configPath.trim() || ".promptfire.json");
  const abstractFile = app.vault.getAbstractFileByPath(normalizedConfigPath);

  if (!abstractFile) {
    return {
      config: null,
      status: {
        path: normalizedConfigPath,
        state: "missing",
      },
    };
  }

  if (!(abstractFile instanceof TFile)) {
    return {
      config: null,
      status: {
        error: `Promptfire vault config path "${normalizedConfigPath}" is not a file.`,
        path: normalizedConfigPath,
        state: "error",
      },
    };
  }

  try {
    const parsedConfig = parseJsonc<Partial<PromptfireSettings>>(await app.vault.cachedRead(abstractFile));
    return {
      config: parsedConfig,
      status: {
        path: normalizedConfigPath,
        state: "loaded",
      },
    };
  } catch (error) {
    return {
      config: null,
      status: {
        error: error instanceof Error ? error.message : String(error),
        path: normalizedConfigPath,
        state: "error",
      },
    };
  }
}

export async function writeVaultConfig(
  app: App,
  configPath: string,
  settings: PromptfireSettings,
): Promise<VaultConfigStatus> {
  const normalizedConfigPath = normalizePath(configPath.trim() || ".promptfire.json");
  const folderPath = normalizedConfigPath.includes("/")
    ? normalizedConfigPath.slice(0, normalizedConfigPath.lastIndexOf("/"))
    : "";

  await ensureFolderPath(app, folderPath);
  await app.vault.adapter.write(normalizedConfigPath, `${JSON.stringify(settings, null, 2)}\n`);

  return {
    path: normalizedConfigPath,
    state: "loaded",
  };
}
