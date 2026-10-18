# Unresolved pCloud API questions (as of 2026-10-18)

## 1. listrevisions token provenance
- Symptom: Returns 1000 "Log in required" on this account despite a valid OAuth token.
- Unclear whether the failure is due to:
  a) The tested file simply has no revision history (pCloud uses 1000 for "no revisions").
  b) The revisions family truly requires a legacy `/getauth` session token like the trash family.
- Evidence: pub.flutter source groups `trash` + `getZip` as OAuth-blocked while claiming revisions *work*.
- Needed to resolve: a file with known revisions (non-zero revision count) or a `/getauth` session token to test with.

## 2. createuploadlink and revertrevision token provenance
- Symptom: Both return 1000 "Log in required" on this account.
- Neither appears in any published list of OAuth-blocked methods (trash family is well-documented elsewhere).
- No public report found of either succeeding over OAuth.
- Needed to resolve: a `/getauth` session token to test the same falsification we ran for trash/list.

## 3. Potential account-tier or region variance
- All sources consulted assume a uniform API surface.
- No test performed across account types (free vs premium, EU vs US regions).
- It remains possible that premium or region-specific accounts receive different capabilities on the above endpoints.

## How to verify
1. Obtain a `/getauth` session token (username/password flow).
2. Run the same falsification test: compare `?auth=` vs `?access_token=` on each endpoint.
3. For listrevisions, additionally test against a file with known revision count >0.
4. Document results in this file.
