#BuildingOnMyCommute - Part 9

Building Vector, my own agent harness system that deterministically enforces quality as it guides agents in real time.

Someone asked me the obvious question this week: why does this even need to exist?

Fair. Claude Code already iterates. Everything-Claude-Code already has 28 agents, 125+ skills, hooks, rules. You can copy a battle-tested .claude setup in minutes. And models are getting dramatically better — two years ago they couldn't do half of what they do today.

So here's my honest answer to every counter-argument:

"Just let Claude iterate until it works" — Claude Code can get there eventually. Vector gets there without you. Right now, you are the enforcement layer. You check, correct, verify. Vector replaces that.

"Just copy someone's .claude setup" — Copying rules tells Claude what to do. Vector verifies it actually did it. A copied folder is someone else's static wisdom. Vector is yours, built from your own failures, calibrated to how you ship.

"ECC already exists" — ECC optimises the instruction. Vector validates the outcome. They're complementary. ECC makes your agents smarter. Vector makes them trustworthy enough to walk away from.

"Models will get better" — Yes. And what you build with them will get more complex. Capability and reliability are different dimensions. Vector gets lighter as models improve — it doesn't disappear.

"Just loop a skill in CI/CD until green" — Right instinct. Missing the retry cap, specialist routing, escalation context, and compound learning. Also — CI/CD catches failures after the push. Vector prevents bad pushes.

The core insight: Vector compounds. First project you add a few rules. Third project the harness knows your patterns. Simple app, keep it light. Mission-critical, dial it up.

Claude Code builds it. Vector makes sure it's done.

Next post — testing V1 manually. 🫡
