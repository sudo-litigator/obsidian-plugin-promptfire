# Promptfire

`Promptfire` ist ein Obsidian-Plugin, das den relevanten Arbeitskontext aus einem Vault sammelt und als strukturierten Prompt in die Zwischenablage kopiert.

Der Kernnutzen ist schlicht: Statt einem Modell jedes Mal Stilregeln, Konventionen, Beispielnotizen und die aktuelle Note manuell zu erklären, erzeugt `Promptfire` diesen Kontext auf Knopfdruck.

## Status

Scaffold steht. Build, Manifest, Commands, Settings, Kontextsammlung und Preview-Modal sind angelegt. Die erste Produktspezifikation liegt in [docs/mvp-spec.md](/home/luca/studio/software/obsidian-plugins/promptfire/docs/mvp-spec.md), die Implementierung geht inzwischen deutlich darüber hinaus.

## Produktidee

- Lokales Obsidian-Plugin ohne externe API im MVP
- Modellagnostischer Prompt-Export statt eingebautem Chat
- Fokus auf deterministische, reproduzierbare Kontextpakete
- Optimiert für Vault-Konventionen, nicht für allgemeine Wissenssuche

## Aktueller Funktionsumfang

- Mehrere Profile mit aktivem Standardprofil
- `Promptfire: Copy context for active profile`
- `Promptfire: Preview context for active profile`
- `Promptfire: Switch active profile`
- `Promptfire: Reload vault config`
- `Promptfire: Export resolved settings to vault config`
- Typisierte Source Definitions für:
  - aktive Note
  - einzelne Datei
  - Ordner
  - ausgehende Links
  - Backlinks
  - einfache Textsuche
- Optionale vault-native Konfigurationsdatei unter `.promptfire.json`
- Dynamische profilgebundene Commands für Copy und Preview
- Konfigurierbare Template Blocks mit Reihenfolge, Aktivierung und eigener Überschrift
- Profilweite Inhaltsfilter für Frontmatter, Body, Codeblöcke und Pfadlabels
- Debug-Vorschau mit Aufschlüsselung pro eingebundener Quelle
- Deterministische Kürzung bei überschrittenem Zeichenlimit
- Hinweise auf fehlende oder übersprungene Quellen

## Search Query Syntax

`search`-Quellen unterstützen jetzt feldbezogene, case-insensitive Abfragen:

- Bare terms: durchsuchen Pfad, Dateiname, Text, Tags, Headings und Frontmatter
- `path:guides`
- `name:daily`
- `text:"prompt engineering"`
- `tag:ai`
- `heading:conventions`
- `fm:status=active`
- Negation mit `-`, z. B. `-name:draft`

Beispiel:

```text
tag:ai path:guides "prompt engineering" -name:draft fm:status=active
```

## Vault Config

Wenn `Enable vault config` aktiv ist, lädt Promptfire zusätzliche Settings aus einer Datei im Vault, standardmäßig `.promptfire.json`. Die Datei kann per Command oder im Settings-Tab aus dem aktuellen Stand exportiert werden.

## Entwicklung

```bash
npm install
npm run build
```

Für den Entwicklungsmodus:

```bash
npm run dev
```

## Lokales Testen in Obsidian

1. `npm run build`
2. `manifest.json`, `main.js` und `styles.css` nach `<vault>/.obsidian/plugins/promptfire/` kopieren
3. Plugin in Obsidian aktivieren
4. In den Plugin-Settings ein Profil und passende Source Definitions konfigurieren
5. `Copy context` oder `Preview context` ausführen

Der aktuelle Testvault liegt bei `~/notes`.

## Noch nicht im MVP

- Integrierte Modell-API
- Automatische semantische Suche
- Agentische Multi-Step-Workflows
- Komplexe Profil- oder Teamverwaltung

## Nächster Schritt

Das Plugin gegen den Testvault schärfen: sinnvolle Referenznotizen anlegen, den Output in echten Notizen prüfen und dann Profil-Logik oder feinere Priorisierung ergänzen.
