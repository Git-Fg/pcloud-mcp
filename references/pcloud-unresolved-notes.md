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

## How to verify (blocked)

The verification path requires a `/getauth` session token (username/password
flow). **This is not available on this host** — only an OAuth access token is
provisioned, and there is no path to obtain a `/getauth` token without
pCloud account credentials in a form the legacy flow accepts. The hypotheses
above therefore stay open by necessity, not by lack of effort. If a
`/getauth` token ever becomes available:

1. Run the same falsification test used for the trash family: compare
   `?auth=<token>` vs `?access_token=<token>` on each endpoint.
2. For listrevisions, additionally test against a file with known revision
   count >0 (pCloud returns 1000 for "no revisions" too, conflating the
   signal).
3. Document results in this file and update `RESULT_HINTS[1000]` and the
   three SKILL.md files accordingly.
