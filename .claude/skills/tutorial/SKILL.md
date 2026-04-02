---
name: tutorial
disable-model-invocation: true
user-invocable: true
---

# Vector v2 Tutorial Skill

## Overview

**Vector** is a configurable enforcement framework for Claude Code. It replaces hardcoded checks with a YAML-based check registry where every check is a shell command (exit 0 = pass). It runs automatically via Claude Code hooks to verify your work meets quality standards.

## What You'll Build

In this tutorial, you'll create a CRUD todo API using Express and TypeScript, then use it as a playground to learn Vector v2 concepts. By the end, you'll understand how Vector integrates into your development workflow and can apply these patterns to any project.

## What You'll Learn

- Initializing Vector in a project with `vector init`
- Running checks and understanding pass/fail behavior
- Composing checks into named vectors for different workflows
- Retry behavior and escalation triggers
- Task-level overrides with `vector activate`
- Viewing reports in terminal, JSON, and markdown formats

## Exercises

1. **[Initialize Vector](./exercise-1.md)** — Run `vector init` and explore the generated config

2. **[Your First Check (fail → pass)](./exercise-2.md)** — Break code, watch Vector catch it, fix it

3. **[Multiple Checks & Vectors](./exercise-3.md)** — Add checks, compose them into named vectors

4. **[Retries & Escalation](./exercise-4.md)** — Understand retry behavior and escalation triggers

5. **[Task-Level Overrides & Reports](./exercise-5.md)** — Use `vector activate` and view reports in 3 formats

## Getting Started

Start with the [setup guide](./setup.md) to bootstrap your environment and create the todo API project.

## Estimated Time

~30 minutes total (including setup)
