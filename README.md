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

- `Promptfire: Copy context`
- `Promptfire: Preview context`
- Konfigurierbare Referenznotizen und Referenzordner
- Exclude-Liste für einzelne Notizen
- Aktive Note als `full`, `selection` oder `selection-fallback-full`
- Optionale Einbindung ausgehender Links und Backlinks mit Mengenlimit
- Steuerbare Prompt-Sektionen für Task, Working Rules und Included Sources
- Steuerbare Inhaltsfilter für Frontmatter, Body und Codeblöcke
- Deterministische Kürzung bei überschrittenem Zeichenlimit
- Hinweise auf fehlende oder übersprungene Quellen

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
4. In den Plugin-Settings die gewünschten Kontextquellen aktivieren
5. `Copy context` oder `Preview context` ausführen

Der aktuelle Testvault liegt bei `~/notes`.

## Noch nicht im MVP

- Integrierte Modell-API
- Automatische semantische Suche
- Agentische Multi-Step-Workflows
- Komplexe Profil- oder Teamverwaltung

## Nächster Schritt

Das Plugin gegen den Testvault schärfen: sinnvolle Referenznotizen anlegen, den Output in echten Notizen prüfen und dann Profil-Logik oder feinere Priorisierung ergänzen.
