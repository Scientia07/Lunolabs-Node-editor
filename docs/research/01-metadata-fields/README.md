# Research: Stakeholder Metadata Fields

**Date**: 2026-03-05
**Researcher**: Claude Opus 4.6
**Status**: Complete

## Summary

What metadata fields add real value to a partner/stakeholder network mapping tool, specifically for a Jugendbuero (youth office) mapping partner organizations?

## Key Findings

### Industry Standard: Kumu Architecture

Kumu is the most relevant prior art — an online stakeholder mapping platform used by the UN, nonprofits, and government agencies.

**Core fields (built-in):**
- `Label` — display name (we already have this)
- `Type` — category (we have this as node type: sector/company)
- `Description` — long-form text about the entity
- `Tags` — multiple comma-separated values for flexible categorization

**Custom fields:** Kumu allows unlimited user-defined fields. Common stakeholder map fields include:
- Influence level (high/medium/low)
- Interest level (high/medium/low)
- Engagement status
- Sector/industry
- Geographic location
- Website URL
- Contact person

**Architecture insight:** Everything is a flexible field on elements (nodes) and connections. No fixed schema. CSV column headers become field names automatically.

Source: [Kumu Architecture Docs](https://docs.kumu.io/overview/kumus-architecture)
Date: accessed 2026-03-05

### CRM-Integrated Stakeholder Mapping (Enterprise)

Tools like Introhive and DemandFarm focus on enterprise sales relationship mapping. Their metadata fields include:
- Relationship strength score (AI-calculated from interaction data)
- Decision-making authority level
- Reporting hierarchy (parent-child)
- Engagement recency (last interaction date)
- Interaction frequency
- Mutual connections

Source: [Introhive Relationship Mapping Guide](https://www.introhive.com/blog-posts/what-is-relationship-mapping-and-how-does-it-work/)
Date: 2025 (accessed 2026-03-05)

Source: [DemandFarm Stakeholder Mapping Tools](https://www.demandfarm.com/blog/best-stakeholder-mapping-tools/)
Date: 2025 (accessed 2026-03-05)

### Nonprofit Partner Management

Nonprofit CRM tools (Salesforce NPSP, Givebutter, Eleo) focus on:
- Organization name and type
- Primary contact person + role
- Contact details (email, phone, address)
- Relationship start date
- Last interaction date
- Engagement level / status
- Notes and interaction history
- Tags for cross-cutting themes

Source: [Aplos — CSV Import in Nonprofit Software](https://www.aplos.com/glossary/csv-import)
Date: accessed 2026-03-05

Source: [Salesforce NPSP Data Importer](https://s3.amazonaws.com/npsp-legacy-docs/npsp_data_import.pdf)
Date: accessed 2026-03-05

### UNDP Kumu Case Study

The United Nations Development Programme uses Kumu for complex stakeholder mapping with "behind the scenes" data per element:
- How long the organization has been operating in the area
- Potential pressure points
- Sectors they work in
- Any other information useful to analysis

Source: [UNDP Jordan — Kumu for Complex Data](https://www.undp.org/jordan/blog/kumu-powerful-tool-mapping-and-visualizing-complex-data-0)
Date: accessed 2026-03-05

## Recommended Fields for Jugendbuero

### Tier 1 — High Value (implement first)

| Field Key | Label (DE) | Type | Why |
|-----------|-----------|------|-----|
| `tier` | Beziehung | enum: `nah`, `satellit` | Drives gradient wash visual. Core feature request. |
| `relevancy` | Relevanz | number 1-10 | Auto-maps to node opacity. 10 = fully visible, 1 = nearly transparent. Manual opacity override takes priority. |
| `contact` | Kontaktperson | string | Who do you call at this org? Most asked question in partner networks. |
| `email` | E-Mail | string | Quick contact lookup without switching tools. |
| `phone` | Telefon | string | Same as email — immediate utility. |
| `tags` | Tags | string (comma-separated) | Multiple labels per entry. More flexible than single sector color. |
| `notes` | Notizen | text (multiline) | Free-text partnership notes. Universal need. |

### Tier 2 — Nice to Have (implement later)

| Field Key | Label (DE) | Type | Why |
|-----------|-----------|------|-----|
| `website` | Website | url | Quick link to partner site. |
| `since` | Seit | date (YYYY-MM-DD) | When did partnership start? Shows network maturity. |
| `lastContact` | Letzter Kontakt | date | When did you last interact? Spots neglected relationships. |
| `rating` | Bewertung | number (1-5) | Quick quality/engagement rating. |

## Conclusion

**Use a flexible `meta` object with suggested defaults.** The `meta` object on each node is a plain key-value map (like Kumu's fields). We predefine the Tier 1 keys as suggestions when creating new entries, but users can add any custom key-value pair they want. This matches the proven Kumu pattern and avoids schema lock-in.

**Data model:**
```js
node.meta = {
  tier: "nah",                    // enum, drives visual
  relevancy: 8,                   // 1-10, auto-maps to opacity (node.opacity overrides)
  contact: "Max Muster",          // string
  email: "max@example.ch",        // string
  phone: "+41 79 123 45 67",      // string
  tags: "Praevention, Beratung",  // comma-separated string
  notes: "Langjaerige Partnerschaft seit 2018",
  // ... any user-defined keys
}
```
