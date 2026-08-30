---
name: add-cafe-field
description: Checklist for adding or changing a café data field in Café Journal. Use when adding, renaming, removing, or changing the type of a field on the café data model.
---

Adding or changing a café field requires four coordinated edits. Miss any one
and it fails at runtime, often unhelpfully:

1. `CafeInput` / `Cafe` in `frontend/src/api/client.ts` — the types.
2. The `fromDoc` default in the same file — without it, cafés written before
   the field existed fail to deserialize.
3. `frontend/src/components/CafeForm.tsx` — the shared add/edit form.
4. `isValidCafe` in `firestore.rules` (repo root), **then redeploy the rules** (see the
   `deploy` skill). The rules validate on create *and* update, and anything
   not explicitly permitted is denied. Skipping this makes every write fail
   with a *permission* error, which looks nothing like the validation error
   it actually is.
