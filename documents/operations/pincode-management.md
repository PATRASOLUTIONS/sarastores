# Pincode management

Open `/admin/blocked-pincodes` using an account authorized to manage pincodes.

## Excel import format

Use **Download Excel format**, or create the following columns starting in cell
A1 of the first worksheet:

| Pincode | Name | State |
| --- | --- | --- |
| 560001 | Bangalore GPO | Karnataka |
| 400001 | Fort | Maharashtra |
| 110001 | Connaught Place | Delhi |

Only `Pincode` is required. It must contain exactly six digits, stored as text
or a whole number. `Name` and `State` are optional. Header matching ignores case
and surrounding spaces. Use plain values, not formulas. Remove the example rows
before uploading your own list.

Choose **Import Excel** on either the allowed or blocked list. `.xlsx` and `.xls`
files up to 3 MB and 20,000 data rows are accepted. The entire worksheet is
validated before one atomic list update; invalid rows are reported with Excel
row numbers, and an invalid import saves nothing. Empty rows are ignored.
Duplicate pincodes are merged, with the final row's metadata winning. Import
updates matching entries and preserves other entries, the other list and the
active delivery mode. It does not clear or replace a list.

## Removing pincodes

Both lists support **Remove** on an individual row, checkbox selection and
**Remove selected**, plus **Clear allowed list** / **Clear blocked list**.
Search by pincode, area or state; lists show 100 rows per page to keep large
imports responsive. **Select shown** only selects rows on the visible page.
Removing selected rows or clearing a list asks for confirmation. Clearing removes
entries, not the active mode. An empty allowed list in Allowed/Both mode denies
all delivery pincodes until entries are added or the mode changes.

Legacy string-only entries remain visible and removable, alongside named
entries. Names and states are preserved by the API.

## Delivery modes

- **Blocked List:** reject listed blocked pincodes; retain the existing
  Bangalore/Mysore, Karnataka checkout area.
- **Allowed List:** require membership in the allowed list; retain that area.
- **Both Lists:** require allowed membership and exclude blocked membership;
  retain that area.
- **Allow all pincodes:** allow all valid six-digit Indian pincodes, including
  outside Bangalore/Mysore. Both saved lists are retained but ignored. Enabling
  this mode asks for confirmation.

Allow-all mode enables all Indian states/union territories and a city/town field
at checkout. Address books support Indian addresses; saving an address does not
guarantee serviceability under a restrictive mode. Checkout rechecks current
rules before payment. The product delivery estimator uses the same list policy.
Existing shipping-fee configuration and store pickup are unchanged; no courier
integration or postal-database lookup is added.

All mutations, including `/api/blocked-pincodes/import`, require the existing
admin authorization guard. Public delivery configuration is returned with
`Cache-Control: no-store`. Switching mode does not run any migration or delete
lists. Changes take effect for newly loaded checkout forms and fresh payment
validation; refresh an already-open checkout to update its address controls.
