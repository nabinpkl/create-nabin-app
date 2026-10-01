# 1. Record architecture decisions

- Status: Accepted
- Date: {{date}}

## Context

Load-bearing decisions (stack, storage, boundaries, external contracts) get lost in chat
scrollback and commit messages. Later readers need the why, not just the what.

## Decision

Record each load-bearing decision as a numbered file in `docs/adr/`, named
`NNNN-kebab-title.md`, using this file's sections: Context, Decision, Consequences, plus a
Status and Date header. Status is one of Proposed, Accepted, or Superseded by NNNN.

Accepted records are immutable. A changed decision gets a new record, and the old one's
status is updated to point at it (the only permitted edit).

## Consequences

- Each decision has one durable home that code review and agents can link to.
- Small, reversible choices do not need a record; if unsure, it probably does not.
