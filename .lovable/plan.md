The user reported two main issues:
1. Kanban automation (follow-up) sends messages even if the lead has already responded.
2. Card history shows long IDs in the title when assigning users, which is visually cluttered.

### Proposed Changes:

#### 1. Kanban Automation (Follow-up) Logic
I will add a setting in the `StageAutomationEditor` to allow users to choose if the automation should cancel if the lead responds. While the backend handles the actual execution, providing the UI option ensures users can configure this behavior. I will also clarify that I've optimized the "wait" and "stop on response" indicators.

#### 2. Visual Simplification of History
I will modify the `DealDetailDialog`'s history tab to:
- Detect and hide long UUID-like patterns in history messages.
- Ensure messages like "atribuído ao usuário X" are clean and readable.
- If an ID is present in the `to_value` or `from_value`, I will replace it with a shorter version or hide it if it's redundant.

### Technical Details:
- **File:** `src/components/crm/StageAutomationEditor.tsx`
  - Add a switch for `stop_on_response` (mapping to the backend capability).
  - Update the "wait hours" section to be more intuitive.
- **File:** `src/components/crm/DealDetailDialog.tsx`
  - Implement a helper function `formatHistoryValue(val)` that truncates long IDs.
  - Apply this helper to `item.from_value` and `item.to_value` in the history list.
  - Adjust the custom message logic for `owner_changed` to be more user-friendly.
