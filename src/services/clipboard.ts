interface ElectronClipboard {
  writeText: (text: string) => void;
}

type WindowWithRequire = Window & {
  require?: (module: string) => unknown;
};

function getElectronClipboard(): ElectronClipboard | null {
  const electron = (window as WindowWithRequire).require?.("electron") as
    | { clipboard?: ElectronClipboard }
    | undefined;

  return electron?.clipboard ?? null;
}

export async function copyTextToClipboard(text: string): Promise<void> {
  const electronClipboard = getElectronClipboard();

  if (electronClipboard) {
    electronClipboard.writeText(text);
    return;
  }

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("Promptfire could not access the system clipboard.");
}
