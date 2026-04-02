# Exercise 1: Initialize Vector

## Goal

Set up Vector v2 in your project and understand the basic configuration structure. After this exercise, you'll have a working Vector setup that automatically validates your code whenever Claude Code finishes.

## Steps

### Step 1: Run Vector Init

In your project directory, run:

```bash
npx vector init
```

This command creates the `.vector/` directory structure and generates an initial configuration file.

### Step 2: Inspect `.vector/config.yaml`

Open `.vector/config.yaml` and review the file that was just created. Here's what each section does:

#### `version: '2'`

Specifies that this project uses Vector v2 (the current version). This tells the Vector CLI which schema and features to expect.

#### `checks` Block

Defines individual shell commands that validate specific aspects of your code:

```yaml
checks:
  test-pass:
    run: npm test
    expect: exit-0
    enabled: true
  no-ts-errors:
    run: npx tsc --noEmit
    expect: exit-0
    enabled: true
```

- **`test-pass`** — Runs `npm test`. The check **passes** if the command exits with code 0 (success).
- **`no-ts-errors`** — Runs TypeScript compiler in check mode. Passes if there are no type errors.
- **`expect: exit-0`** — Specifies that we expect the command to exit successfully (exit code 0).
- **`enabled: true`** — Both checks are active by default. You can disable checks per-task using `.vector/active.yaml`.

#### `vectors` Block

Groups checks into named sets called "vectors". Each vector has a trigger (description) and a list of checks to run:

```yaml
vectors:
  v1:
    trigger: Full test suite and type check
    checks:
      - test-pass
      - no-ts-errors
```

- **`v1`** — The name of this vector. You run it with `npx vector run v1`.
- **`trigger`** — A human-readable description of what this vector validates.
- **`checks`** — A list of check names (from the `checks` block) that belong to this vector. When you run `npx vector run v1`, both `test-pass` and `no-ts-errors` execute.

#### `defaults` Block

Sets project-wide defaults for check execution:

```yaml
defaults:
  maxRetries: 3
  timeout: 30000
```

- **`maxRetries: 3`** — If a check fails, Vector will retry it up to 3 times before giving up.
- **`timeout: 30000`** — Each check must complete within 30 seconds (30,000 milliseconds). If it takes longer, the check is considered failed.

### Step 3: Inspect `.claude/settings.local.json`

Open `.claude/settings.local.json` and look for the `hooks` section:

```json
{
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "npx vector run v1"
      }
    ]
  }
}
```

This is a Claude Code **Stop hook**. It runs automatically when Claude Code finishes a session. In this case:

- **`Stop` hook** — Fires when the Claude Code session ends.
- **`command`** — Tells Claude Code to execute a shell command.
- **`npx vector run v1`** — Runs the `v1` vector, which validates your tests and TypeScript compilation.

**Why this matters:** After Claude Code makes changes to your code, this hook automatically runs your validation checks. If something breaks, you'll know immediately instead of discovering it later.

### Step 4: Note `.vector/active.yaml` Does Not Exist Yet

The file `.vector/active.yaml` is not created during `init`. It's generated on-demand when you use the `vector activate` command to override checks for specific tasks or branches.

You'll learn about this in Exercise 2.

## Expected Output

After running `npx vector init`, your project structure should look like:

```
.vector/
├── config.yaml          # Configuration you just reviewed
├── active.yaml          # (Does not exist yet)
└── reports/             # (Created when you run checks)

.claude/
└── settings.local.json  # Contains the Stop hook
```

When you run `npx vector run v1`, you should see output like:

```
Vector v1: Full test suite and type check

✓ test-pass (1.2s)
✓ no-ts-errors (0.8s)

All checks passed in 2.0s
```

## What You Learned

- **Vector uses YAML configuration** — Not hardcoded rules. This makes Vector flexible and project-specific.
- **Every check is a shell command** — Vector runs whatever commands you define (`npm test`, `npx tsc`, `npm run lint`, etc.).
- **Checks have expectations** — Each check expects a specific exit code (usually 0 for success). Vector compares the actual exit code to the expected one.
- **Vectors group checks into sets** — You can create multiple vectors for different purposes (e.g., `v1` for core validation, `v2` for optional checks).
- **Defaults reduce repetition** — Instead of specifying `maxRetries` and `timeout` for each check, you set project-wide defaults.
- **Stop hooks automate validation** — The Claude Code Stop hook runs your vector automatically, keeping your code validated throughout development.

---

**Next:** [Exercise 2: Run Checks](./exercise-2.md)
