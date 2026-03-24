# Vector — Project Instructions

## Committing Changes

Every meaningful change or completed task must be committed with a detailed commit description.

**What counts as a meaningful change:**
- Any new file added
- Any feature implemented or completed
- Any bug fixed
- Any test added or updated
- Any documentation written or updated
- Any refactor that changes behaviour or structure

**Commit message format:**
```
<type>: <subject under 72 chars>

<body — 2+ lines explaining what changed, why, and how>

<optional: bullet list of specific changes>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`

**Good example:**
```
feat: add DELETE /users/:id endpoint

Implement user deletion with proper HTTP semantics to complete
the CRUD surface for the user resource.

- Returns 204 No Content on successful deletion
- Returns 404 Not Found if user does not exist
- Covered by 3 new tests in user-endpoints.test.ts
- docs/API.md updated with endpoint spec
```

**Bad examples (do not do these):**
```
fix stuff
update code
WIP
changes
```

Do not batch unrelated changes into one commit. One logical task = one commit.
