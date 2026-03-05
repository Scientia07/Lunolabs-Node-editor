# Research: CSV Import/Export for Node Metadata

**Date**: 2026-03-05
**Researcher**: Claude Opus 4.6
**Status**: Complete

## Summary

How to design CSV import/export for contact and node data in the Netzwerk-Editor, informed by nonprofit CRM tools and Kumu's data format.

## Key Findings

### Kumu CSV Format (Industry Reference)

Kumu uses a simple, flat CSV format where each row is an element (node) or connection:

**Elements CSV:**
```csv
Label,Type,Description,Tags,CustomField1,CustomField2
"Jugendbuero March",center,"Hauptknoten","Zentrum",,,
"Schulpsych. Dienst",sector,"Beratungsstelle","Bildung, Beratung","Max Muster","max@example.ch"
```

- Column headers = field names (automatic mapping)
- `Label` and `Type` are required, everything else optional
- Custom columns become custom fields
- Tags are comma-separated within a single cell

**Connections CSV (separate file):**
```csv
From,To,Type,Strength
"Jugendbuero March","Schulpsych. Dienst","partner","strong"
```

Source: [Kumu Architecture Docs](https://docs.kumu.io/overview/kumus-architecture)
Date: accessed 2026-03-05

### Nonprofit CSV Import Best Practices

From Salesforce NPSP, Aplos, and Givebutter:

1. **Test with a single record first** before bulk import
2. **Save field mappings** so they can be reused on re-import
3. **Work from a copy** — never modify the original CSV
4. **Break large imports into batches** — import by sector/type
5. **Validate before import** — check for duplicates, empty required fields, encoding issues
6. **Handle conflicts explicitly** — when a label already exists, ask: update or skip?

Source: [Aplos — CSV Import in Nonprofit Software](https://www.aplos.com/glossary/csv-import)
Date: accessed 2026-03-05

Source: [Cloud4Good — NPSP Data Importer Deep Dive](https://cloud4good.com/announcements/npsp-data-importer-tool-deep-dive/)
Date: accessed 2026-03-05

Source: [Bonterra — Self-Importing Data](https://www.bonterratech.com/training/network-for-good/self-importing-your-data-successfully)
Date: accessed 2026-03-05

### Data Quality Considerations

- Excel may strip leading zeros (ZIP codes, phone numbers) — export as text
- UTF-8 encoding is critical for German umlauts (ue, ae, oe)
- Semicolon-separated values common in German Excel (locale uses `;` not `,`)
- Date formats: ISO 8601 (YYYY-MM-DD) preferred, but German locale uses DD.MM.YYYY

Source: [Givebutter — Data Migration](https://givebutter.com/features/importing-and-migration)
Date: accessed 2026-03-05

## Recommended CSV Design

### Export Format

Single CSV file with all nodes + metadata flattened:

```csv
Label;Type;Sektor;Beziehung;Kontaktperson;E-Mail;Telefon;Tags;Notizen;Website;Seit;X;Y
"Schulpsych. Dienst";company;"Beratung & Therapie";nah;"Max Muster";"max@example.ch";"+41 79 123 45 67";"Praevention, Beratung";"Langjaerig";"https://example.ch";"2018-01-01";640;552
```

**Design decisions:**
- Use **semicolon** (`;`) as delimiter — German Excel default, avoids conflicts with comma in tags
- Include `X` and `Y` columns for position data (allows re-import with layout preserved)
- `Sektor` column = label of the parent sector (human-readable, not parentId)
- All meta fields become columns
- Dynamic columns: if a node has custom meta keys, those become additional columns
- UTF-8 with BOM (`\uFEFF` prefix) for Excel compatibility

### Import Flow

```
1. User selects CSV file
2. Parse CSV (detect delimiter: , or ;)
3. Show preview table (first 5 rows)
4. Auto-map columns to known fields (Label -> label, Beziehung -> meta.tier, etc.)
5. Let user adjust mappings if needed
6. Handle conflicts:
   - Existing node with same label? -> Update metadata (merge)
   - New label? -> Create new company node
   - Sector assignment: match by sector label, or create new sector
7. Import and render
```

### Connections Export (Optional, Separate File)

```csv
Von;Nach;Farbe;Stil
"Jugendbuero March";"Beratung & Therapie";"#4ade80";"straight"
```

## Conclusion

**Use semicolon-delimited CSV with UTF-8 BOM for German Excel compatibility.** Export flattens all nodes into rows with metadata as columns. Import uses auto-mapping with a preview step. Match the Kumu convention of column-headers-as-field-names so data can flow between tools.

**Keep it simple for v1:**
- Export: one-click download of all nodes as CSV
- Import: file picker -> auto-map -> preview -> confirm
- No connections in CSV v1 (JSON handles that already)
