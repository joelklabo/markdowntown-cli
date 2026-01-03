# Skills section UI (layout + CTA notes)

Last updated: Dec 27, 2025

## Page layout
- **Skills list**
  - Hero: title + short description + primary target chips.
  - Left rail: filters (target, tag, search).
  - Main column: skill cards with target badges.

- **Skill detail**
  - Header: name, short description, targets.
  - Body: params + example usage (if present).
  - Sidebar: add-to-Workbench CTA, export summary.

## CTA hierarchy
- List: Primary CTA = View skill. Secondary = Add to Workbench.
- Detail: Primary CTA = Add to Workbench.
- Workbench empty state: CTA = Browse skills.

## UI components
- SkillCard: title, description, target badges, optional tag list.
- SkillsFilters: target pills, search input, tag chips.
- SkillsEmptyState: illustration + CTA to Workbench.

## Responsive behavior
- Filters collapse into a sheet on mobile.
- List becomes a single column with stacked cards.

## Visual tone
- Consistent with Library cards (raised cards, subtle borders).
- Clear badges for Codex CLI, Copilot CLI, Claude Code.
