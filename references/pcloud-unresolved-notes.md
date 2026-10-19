# Unresolved pCloud API questions (as of 2026-10-19)

## 1. listrevisions token provenance (still open)
- Symptom: Returns 1000 "Log in required" on this account despite a valid OAuth token.
- Unclear whether the failure is due to:
  a) The tested file simply has no revision history (pCloud uses 1000 for "no revisions").
  b) The revisions family truly requires a legacy `/getauth` session token like the trash family.
- Evidence: pub.flutter source groups `trash` + `getZip` as OAuth-blocked while claiming revisions *work*.
- Live reachability sweep (2026-10-19) confirmed: same 1000 response on multiple files. Cannot distinguish
  "no revisions" from "OAuth rejected" without a known-revisions file or a `/getauth` session token.
- Needed to resolve: a file with known revisions (non-zero revision count) or a `/getauth` session token to test with.

## 2. createuploadlink and revertrevision token provenance (still open)
- Symptom: Both return 1000 "Log in required" on this account.
- Neither appears in any published list of OAuth-blocked methods (trash family is well-documented elsewhere).
- No public report found of either succeeding over OAuth.
- Needed to resolve: a `/getauth` session token to test the same falsification we ran for trash/list.

## 3. trash family (CONFIRMED 2026-10-19)
- Original hypothesis: pCloud's OAuth tokens are silently rejected on the trash family; only a legacy
  `/getauth` session token sent as `auth=` works.
- **Confirmed 2026-10-19 via direct HTTP probes**: `?access_token=<oauth>` returns 1000; cannot mint a
  session token from an OAuth access token (getauth=1 returns result:0 with no auth field). The JS SDK
  encodes the same split: `createClient(token, 'pcloud')` sends `auth=`, `createClient(token, 'oauth')`
  sends `access_token=`.
- Same OAuth-vs-session split likely extends to listrevisions/createuploadlink/revertrevision (all return
  1000 with `access_token=`), but the falsification is incomplete for those three (see §1, §2).

## 4. Other 1000-family methods (1000 observed 2026-10-19)
- All return 1000 with this OAuth token, in addition to the trash family and the three "open" hypotheses:
  `getfilehistory`, `setlanguage`, `gethlslink`, `gettextfile`, `getzip`, `getziplink`,
  `extractarchiveprogress`, `savezipprogress`, all 8 `collection_*`, `trash_clear`, `listuploadlinks`.
- Suspected: same OAuth-provenance restriction. Not exposed as tools until falsified.

## 5. 2076-family methods (2076 observed 2026-10-19)
- User-share methods: `sharefolder`, `listshares`, `cancelsharerequest`, `acceptshare`, `declineshare`,
  `removeshare`, `changeshare` — return 2076, not 1000. Different error class, probably account-tier
  or feature-flag based. Not exposed as tools.

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
   count >0 (pCloud returns 1000 for "no revisions" too, conflating the signal).
3. Document results in this file and update `RESULT_HINTS[1000]` and the
   three SKILL.md files accordingly.
