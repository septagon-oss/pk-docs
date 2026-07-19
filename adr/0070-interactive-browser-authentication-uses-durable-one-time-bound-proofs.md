---
title: "ADR 0070: Interactive browser authentication uses durable one-time bound proofs"
status: Accepted
date: 2026-07-18
slug: adr-0070-interactive-browser-authentication-uses-durable-one-time-bound-proofs
adr_topic: security
type: doc
tags: [adr, security, authentication, browser, oidc, saml, magic-link, csrf, replay]
---

# ADR 0070 — Interactive browser authentication uses durable one-time bound proofs

Status: **Accepted** (2026-07-18)

## The problem

An integrity-only, signed OIDC `state` value or SAML `RelayState` authenticates
its contents, but leaves confidential continuation facts readable and does not
make the callback single-use or prove that it returned through the browser that
started the flow. A copied callback, a provider retry, or a session-swap form
can therefore replay otherwise valid protocol material. Tenant routing adds
another authority dimension: state for one tenant, provider, or connection
must never complete under another tuple.

Browser mechanics differ by protocol. An OIDC callback is normally a top-level
redirect for which a Lax cookie is available. A SAML HTTP-POST callback is
cross-site and needs a `SameSite=None; Secure` cookie. Treating those paths as
identical either drops the browser proof for SAML or weakens the OIDC cookie.
Local MFA introduces a second handoff where the already-verified provider flow
must remain bound to the same browser without retaining provider bearer
material.

A magic-link confirmation has the same session-swap risk at a different
boundary. The mailed token proves mailbox control, but an explicit browser
confirmation POST must also prove continuity with the browser that rendered
the confirmation page before token lookup, tenant admission, or session
mutation begins.

## The decision

Every OIDC and SAML browser login start creates an independent, cryptographically
random 256-bit browser binding in addition to the provider protocol material.
The browser receives that binding only in a host-only, `HttpOnly` flow cookie.
Durable state stores only SHA-256 digests of the complete OIDC `state` or SAML
`RelayState` and browser binding, together with the exact tenant ID, normalized
provider, stable connection key, expiry, and optional consumption timestamp.
Raw state, RelayState, and browser binding never enter a durable row, entity
projection, log, metric label, audit payload, or event.

OIDC `state` and SAML `RelayState` are each opaque, randomized, purpose-bound
`pkps:v1` AES-256-GCM envelopes with distinct purposes. OIDC protects the
nonce, PKCE verifier, redirect, bounded issue/expiry times, tenant, connection
subject, configured issuer, and client audience. SAML protects the required
tenant, connection, authentication-request ID, absolute ACS URL, bounded
issue/expiry times, configured issuer, connection subject and audience, plus
an optional return target. The SAML issue-to-expiry interval may not exceed
five minutes plus the explicit 30-second clock-skew allowance.

Completion accepts only the corresponding envelope, authenticates and decrypts
it, and validates every required field, time bound, issuer, subject, audience,
connection, and exact callback tenant/provider/connection authority. SAML also
requires the callback ACS authority to equal the protected absolute ACS URL;
these checks complete before assertion parsing. Tampered, malformed,
wrong-purpose, and signed-but-readable JWT continuations fail closed without a
compatibility fallback. Rejecting the old readable signed format is a
deliberate security cutover: a prior-format in-flight continuation may require a new
login start, but its prior lifetime was at most five minutes.

Callback admission is one atomic conditional consume. Before invoking provider
completion, the authentication boundary hashes the presented protocol material
and browser binding and updates the one unconsumed, unexpired row matching both
digests and the exact tenant/provider/connection tuple. Exactly one callback
can win. A mismatch does not consume a different row, and an unavailable,
non-durable, ambiguous, or failing store returns no provider completion and no
platform session.

OIDC flow cookies use `SameSite=Lax`; they are `Secure` whenever the public
request is HTTPS. SAML HTTP-POST flow cookies use `SameSite=None; Secure`, and a
non-local deployed SAML login fails when HTTPS cannot be established. A
loopback-only development harness may use Lax over HTTP because browsers reject
`SameSite=None` without `Secure`; that exception is not valid deployment
behavior. Flow cookies are scoped to the public provider callback path, expire
no later than the durable transaction, and are deleted on success and terminal
denial.

When local MFA is required after provider completion, the continuation retains
the browser-binding digest and flow reference plus bounded non-secret facts:
exact provider and tenant authority, the verified platform identity reference,
display email, return target, remember-me choice, host-alias proof, and expiry.
It retains no upstream credential or arbitrary provider metadata. The
continuation rechecks the presented browser binding in constant time and the
exact tenant/provider/connection/reference tuple. It does not call the provider
again, admit membership, or create a platform session until local MFA succeeds.

Provider exchange credentials are adapter-local and ephemeral. OIDC ID,
access, and refresh bearers, raw SAML assertions, and other upstream session
credentials must not be persisted or projected into PlatformKit session fields
or metadata. Provider results expose only the verified non-secret facts needed
for identity resolution and tenant authority. Platform session persistence
uses a freshly generated platform-owned opaque reference, never an upstream
credential.

Magic-link GET remains scanner-safe and non-mutating. After the mailed token is
peeked successfully, the page creates a separate 256-bit confirmation nonce in
a host-only, `HttpOnly`, Lax cookie and matching hidden form field. The POST
checks their shape and constant-time equality before token lookup or any auth
work. When present, `Origin` must equal the request origin and
`Sec-Fetch-Site` must be `same-origin`. The same nonce remains bound through a
local-MFA form, and is cleared on success or terminal denial. Confirmation
responses are non-cacheable, suppress referrers, and deny framing.

The credential-login form uses the general CSRF middleware contract. On the
first safe page load, the middleware places the newly issued response-cookie
token in the request context before rendering. After a valid mutating request,
it rotates the token before calling the handler and places that exact new token
in context, so an error re-render never submits the stale request token. The
default login form and every custom auth-page flavor receive the same
response-authoritative value and render it as the hidden `csrf_token` field;
the contract works without JavaScript.

## What we gave up

- Interactive login now requires durable storage at start and callback; a
  stateless signed value alone is insufficient.
- A provider retry or concurrent callback loses after the first atomic consume
  even when its protocol evidence is otherwise valid.
- Non-local SAML browser login requires HTTPS so its cross-site cookie can
  remain both usable and secure.
- Troubleshooting and extension code cannot inspect or retain upstream bearer
  material; it must rely on verified, non-secret provider facts.
- Browser login needs short-lived per-flow cookies and explicit cleanup rather
  than one shared unbound callback cookie.
- Deployments intentionally do not complete prior readable JWT state or
  RelayState values; an in-flight login started during the cutover must restart.
- Custom login flavors must preserve the supplied server-side CSRF token in
  their form instead of inventing or recovering a token in browser script.

## What we kept

- OIDC nonce, PKCE, signature, issuer, audience, and expiry validation and SAML
  assertion, issuer, audience, destination, request, and time validation remain
  mandatory inside their protocol adapters.
- [ADR 0066](./0066-federated-identities-bind-verified-issuer-and-subject.md)
  remains the authority for durable provider-subject identity binding.
- Local MFA remains PlatformKit-owned evidence; provider `acr`, `amr`, or
  similarly named metadata cannot satisfy it.
- Magic-link bearer consumption and tenant admission retain their existing
  transactional and least-privilege rules; the browser proof is an earlier
  gate, not replacement authority.

## How we enforce it

- [Convention C-20](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs)
  defines the mechanical start, cookie, consume, continuation, and projection
  rules.
- `auth_management/migrations/020_create_interactive_authentication_flows.up.sql`
  creates the constrained hash-only callback ledger; the authentication flow
  store consumes it with one conditional update over both digests, exact
  authority, expiry, and unconsumed state.
- `interactive_flow_security_test.go` covers raw-material opacity,
  mismatch-without-burning, exactly-one concurrent provider winner, expiry,
  storage outage, registration failure, provider-error consumption, and SAML
  RelayState consumption before assertion parsing.
- `interactive_flow_browser_security_test.go` covers server-generated binding,
  host-only OIDC Lax cookies, SAML `None; Secure`, insecure deployed SAML
  rejection, cross-browser callback denial, independent concurrent-tab cookies,
  terminal cleanup, and MFA continuation denial in another browser.
- Interactive-MFA tests cover browser-binding and flow-reference retention,
  exact authority revalidation, single-use continuation, provider non-reentry,
  and absence of membership or session writes before local MFA succeeds.
- Magic-link browser-confirmation tests cover scanner-safe GET, host-only
  cookie/hidden-field pairing, session-swap rejection before token lookup,
  browser-signal checks, local-MFA continuity, terminal cleanup, and anti-frame
  response policy.
- `newPlatformSession` generates a platform-owned session reference, and
  append-only migration 021 scrubs historical upstream values from projectable
  session rows.
- `interactive_flow_migration_test.go` verifies the hash-only one-time ledger,
  historical session scrub, and security-irreversible down migrations.
- `security/protectedstate/codec_test.go` proves randomized opaque sealing,
  purpose separation, tamper rejection, malformed-value rejection, and
  fail-closed configuration. OIDC begin/authority tests prove `pkps:v1`, hidden
  nonce/PKCE material, signed-readable-state rejection, and exact connection,
  client, tenant, and provider callback authority. SAML
  `TestBeginAuthentication_BuildsRedirectFlowWithProtectedRelayState` and
  `TestValidateSAMLRelayStateAuthorityRequiresExactConnectionAndCallbackMetadata`
  prove opaque RelayState, readable-JWT rejection, bounded required claims, and
  exact authority validation before assertion parsing.
- Core OIDC completion returns a fresh 256-bit provider-session reference and
  verified non-secret facts only. Provider tests reject upstream ID, access,
  and refresh bearers in the provider-neutral session token, metadata, and
  serialized projection.
- Core CSRF `TestMiddleware_SetsCookie` and
  `TestMiddleware_ContextCarriesRotatedToken`, together with auth
  `TestLoginPageCSRFSupportsNoJavaScriptFirstLoadAndRotatedErrorRender` and
  `TestLoginFlavorReceivesResponseAuthoritativeCSRFToken`, prove first-load and
  rotated response/context agreement for the default and custom login surfaces.

## References

- [ADR 0006 — Multi-entity writes are atomic or they do not happen](./0006-transactional-atomicity-for-multi-entity-state.md)
- [ADR 0066 — Federated identities bind verified issuer and subject, not mutable claims](./0066-federated-identities-bind-verified-issuer-and-subject.md)
- [REQ AUTH-003 — Two-factor authentication](../requirements/REQ-AUTH-003-twofactor.md)
- [REQ AUTH-001 — Authentication](../requirements/REQ-AUTH-001-authentication.md)
- [REQ AUTH-025 — Magic-link tenant self-enrollment](../requirements/REQ-AUTH-025-magic-link-self-enrollment.md)
- [REQ AUTH-026 — Interactive-provider tenant self-enrollment](../requirements/REQ-AUTH-026-interactive-provider-self-enrollment.md)
- [Convention C-20](../conventions.md#c-20-interactive-browser-authentication-uses-one-time-bound-proofs)
