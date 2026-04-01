# Promptfire MVP-Spezifikation

Hinweis: Die aktuelle Implementierung hat den ursprünglichen MVP bereits erweitert. Zusätzlich zu Referenznotizen und aktiver Note unterstützt sie inzwischen Referenzordner, ausgehende Links, Backlinks und deutlich feinere Output-Settings.

## Produktziel

`Promptfire` erzeugt auf Knopfdruck einen strukturierten Arbeitskontext für externe KI-Modelle. Das Plugin soll einem Modell genug Vault-spezifische Regeln mitgeben, damit es in Notizen, Stil und Konventionen konsistent arbeiten kann.

## Problem

Beim Arbeiten mit ChatGPT, Claude oder ähnlichen Modellen fehlt oft der lokale Kontext:

- Wie sehen Frontmatter und Metadaten aus?
- Welche Schreib- und Strukturkonventionen gelten im Vault?
- Welche Beispielnotizen repräsentieren den gewünschten Stil?
- Welche aktuelle Note oder welches aktuelle Projekt ist relevant?

Dieser Kontext liegt im Vault bereits vor, ist aber vor jeder Modellsitzung mühsam manuell zusammenzustellen.

## Zielbild

Ein Nutzer markiert keine Texte und baut keine Prompts per Hand zusammen. Stattdessen führt ein Command oder Button zu einem vorbereiteten, klar strukturierten Prompt, der direkt in ein externes Modell eingefügt werden kann.

## Primärer Workflow

1. Nutzer hinterlegt in den Plugin-Settings die relevanten Referenznotizen.
2. Nutzer öffnet eine Zielnote im Vault.
3. Nutzer startet `Promptfire: Preview context` oder `Promptfire: Copy context`.
4. Das Plugin sammelt die konfigurierten Quellen und optional die aktive Note.
5. Das Plugin assembliert einen strukturierten Prompt.
6. Der Prompt wird entweder in einer Vorschau angezeigt oder direkt in die Zwischenablage kopiert.
7. Nutzer fügt den Inhalt in ein externes Modell ein.

## MVP-Umfang

### Enthalten

- Ein global konfigurierbarer Satz von Referenznotizen
- Optionales Einbeziehen der aktiven Note
- Zwei Commands:
  - `Promptfire: Copy context`
  - `Promptfire: Preview context`
- Strukturierte Prompt-Ausgabe mit festen Sektionen
- Kopieren in die System-Zwischenablage
- Vorschau-Modal
- Konfigurierbares Größenlimit
- Deterministische Kürzungslogik mit sichtbaren Trennmarkern

### Nicht enthalten

- Direkte Verbindung zu OpenAI, Anthropic oder anderen APIs
- Automatische Auswahl semantisch relevanter Notizen
- Kontextgewinnung aus Backlinks, Graph oder Embeddings
- Mehrbenutzer-Features
- Mehrstufige Profile pro Projektbereich
- Automatische Modellauswahl

## Nutzerwert

- Weniger manuelle Prompt-Arbeit
- Konsistentere Modellantworten innerhalb eines Vaults
- Höhere Wiederverwendbarkeit guter Referenznotizen
- Sauberer Übergang zwischen Obsidian und externem Modell

## Funktionsschnitt

### Befehl 1: `Promptfire: Copy context`

- Sammelt den aktuellen Kontext
- Baut den Prompt zusammen
- Kopiert das Ergebnis direkt in die Zwischenablage
- Zeigt eine kurze Erfolgsmeldung mit grober Längenangabe

### Befehl 2: `Promptfire: Preview context`

- Baut denselben Prompt wie der Copy-Command
- Zeigt den Inhalt in einem Modal an
- Bietet im Modal einen `Copy`-Button

## Datenquellen im MVP

### Globale Referenznotizen

Explizit konfigurierte Markdown-Dateien, die Regeln oder gute Beispiele enthalten, etwa:

- Schreibstil
- Frontmatter-Konventionen
- Projektstruktur
- Namenskonventionen
- Template-Beispiele

### Aktive Note

Optional wird die gerade geöffnete Markdown-Note in den Prompt eingebettet.

### Keine weiteren automatischen Quellen

Für das MVP werden keine verlinkten Notizen, Backlinks, Suchergebnisse oder Ordnerinhalte automatisch einbezogen.

## Output-Vertrag

Der erzeugte Prompt soll immer dieselbe Grundstruktur haben.

```md
# Promptfire Context

## Task
Use the provided vault context to help with the current note.

## Vault Conventions
### Source: path/to/conventions.md
<content>

### Source: path/to/frontmatter-rules.md
<content>

## Current Note
Path: path/to/current-note.md
<content>

## Working Rules
- Follow the vault conventions before inventing new structure.
- Prefer existing naming, metadata, and formatting patterns.
- If context is incomplete, say what is missing instead of guessing.

## Included Sources
- path/to/conventions.md
- path/to/frontmatter-rules.md
- path/to/current-note.md
```

## Regeln für die Ausgabe

- Feste Sektionsreihenfolge
- Jede Quelle wird mit Vault-Pfad ausgezeichnet
- Klare Trenner zwischen Quellen
- Kürzungen werden explizit markiert
- Keine stillschweigende Umformulierung der Quelldateien
- Quelleninhalt wird roh oder minimal normalisiert übernommen

## Größenlimit

Der MVP soll nicht tokenbasiert rechnen, sondern mit Zeichenlängen arbeiten.

### Vorschlag

- Default-Limit: `20_000` Zeichen
- Einstellbar in den Plugin-Settings
- Mindestwert: `2_000`
- Höchstwert: `100_000`

### Kürzungsstrategie

1. Sektionshülle bleibt immer erhalten.
2. Globale Referenznotizen werden in der konfigurierten Reihenfolge eingefügt.
3. Wenn das Limit erreicht wird, wird die letzte betroffene Quelle gekürzt.
4. Die aktive Note wird nur eingebettet, wenn dafür noch Platz vorhanden ist.
5. Jede Kürzung wird mit `[...] truncated by Promptfire` markiert.

Diese Logik ist bewusst simpel und nachvollziehbar.

## Settings für den MVP

### Pflichtfelder

- `referenceNotePaths`
  - Liste von Vault-Pfaden zu Referenznotizen

### Optionale Felder

- `includeActiveNote`
  - Default: `true`
- `maxOutputCharacters`
  - Default: `20000`
- `showRibbonIcon`
  - Default: `true`
- `workingRules`
  - Liste kurzer Standardanweisungen, die immer in den Prompt kommen

## UI im MVP

### Settings Tab

- Textarea oder Listenfeld für Referenzpfade
- Toggle für aktive Note
- Numeric Input für Größenlimit
- Toggle für Ribbon-Icon
- Textarea für zusätzliche feste Arbeitsregeln

### Ribbon Action

- Optionaler schneller Einstieg
- Führt standardmäßig `Copy context` aus

### Preview Modal

- Scrollbarer Prompt-Inhalt
- `Copy`-Button
- Anzeige der Zeichenanzahl

## Fehlerszenarien

- Keine Referenznotizen konfiguriert
  - Plugin zeigt Notice mit klarem Hinweis auf Settings
- Konfigurierter Pfad existiert nicht
  - Quelle wird übersprungen und im Preview/Notice ausgewiesen
- Keine aktive Markdown-Note offen
  - Nur globale Kontexte werden verwendet
- Clipboard-Zugriff schlägt fehl
  - Plugin zeigt Fehlermeldung und lässt im Preview manuelles Kopieren zu

## Architekturvorschlag

### Module

- `src/main.ts`
  - Plugin-Bootstrap, Commands, Ribbon, Lifecycle
- `src/settings.ts`
  - Settings-Definition, Laden/Speichern, Settings-Tab
- `src/context/collector.ts`
  - Liest konfigurierten Kontext und aktive Note aus dem Vault
- `src/context/assembler.ts`
  - Baut den finalen Prompt in fester Struktur
- `src/context/truncation.ts`
  - Wendet das Zeichenlimit deterministisch an
- `src/ui/preview-modal.ts`
  - Zeigt den erzeugten Prompt und Copy-Aktion
- `src/services/clipboard.ts`
  - Kapselt Clipboard-Zugriff

### Datenmodell

```ts
interface PromptfireSettings {
  referenceNotePaths: string[];
  includeActiveNote: boolean;
  maxOutputCharacters: number;
  showRibbonIcon: boolean;
  workingRules: string[];
}
```

## Qualitätskriterien

- Ein Nutzer versteht ohne Dokumentation, was der Copy-Command macht.
- Der Output ist reproduzierbar bei gleicher Eingabe.
- Fehlende Quellen führen nicht zu stillen Fehlern.
- Das Plugin bleibt lokal, schnell und transparent.
- Die erste Version ist klein genug, dass sie in einem Implementierungsdurchgang gebaut werden kann.

## V2-Kandidaten

- Profile für verschiedene Vault-Bereiche
- Automatische Kontextwahl anhand des aktuellen Pfads
- Priorisierte Einbeziehung verlinkter Notizen
- Template-spezifische Output-Formate
- Export als Markdown-Datei zusätzlich zur Zwischenablage
- Direkte Übergabe an ausgewählte KI-Apps per URL-Schema oder Deep Link

## Konkreter Implementierungsplan

1. Obsidian-Plugin scaffolden
2. Manifest, Build-Setup und TypeScript-Basis anlegen
3. Settings-Datenmodell und Settings-Tab bauen
4. Collector für Referenznotizen und aktive Note implementieren
5. Assembler mit festem Prompt-Format implementieren
6. Kürzungslogik ergänzen
7. Clipboard-Flow und Notices ergänzen
8. Preview-Modal bauen
9. End-to-End im Obsidian-Testvault prüfen
