# Agent orientation

This repository contains documentation, architecture decisions, requirements,
and marketing-site source. It is not an executable PlatformKit distribution.

## Read documents by authority

1. The current runnable contract is the code and README on
   [septagon-oss/platformkit](https://github.com/septagon-oss/platformkit).
2. ADRs must be interpreted with their front-matter status. Only `Accepted`
   decisions are current; `Proposed` is roadmap intent and `Superseded` is
   historical context.
3. Requirements must be interpreted with their front-matter status. `Proposed`
   is roadmap intent, not shipped behavior.
4. Directories named for a version, such as `docs/v0.2.0`, are maintained
   historical documentation and may contain later corrections or backports. They are not
   immutable release snapshots and must not be used to infer the current
   release. Use a pinned Git commit for exact release research.
5. `overlays/platformkit/site` is marketing-site content. Its copy and public
   site interactions are not runtime APIs, modules, or starter capabilities.

Do not turn examples, proposed requirements, marketing copy, synthetic data,
or historical release notes into implementation claims. Verify every claimed
current capability against the owning public code repository.

Keep product/client concepts out of reusable OSS architecture guidance, and
label future work explicitly as proposed.
