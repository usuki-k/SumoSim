Task-ID: ACTION-11G-GRIP-SUCCESS-ARM-HAND-VFX
Status: REVIEWED
Task-Type: PRESENTATION VISUAL EFFECT GATE
Executor: Claude Code / Codex
Target-Branch: develop
Source-Baseline: a88234c335218cc5dc409e80ced3c8fd506675b6
Implementation-Commit: 7e7ea6fb2928da47fa7bdffe571b8fea4109cc37
Handoff-Mode: GITHUB

# ChatGPT Review Handoff

Review-Date: 2026-10-23
Overall Result: TECHNICAL PASS / USER VISUAL GATE REJECTED
Accepted Technical Baseline: 7e7ea6fb2928da47fa7bdffe571b8fea4109cc37

## Technical Review

Confirmed from Current Source / diff:

- ACTION-11F pair compression remains +0.14 R forward / -0.20 R lateral
- Grip-success limb VFX is presentation-only
- two procedural limbs per wrestler are created once and reused
- FAR depth = 1.9, body = 2, NEAR depth = 2.2
- limb geometry follows the ACTION-11F displayed body center and canonical facing
- visible only for grapple / drive
- hidden for attempt / recovery / Push / Tsuppari / Counter / Kuzushi / idle
- release removes limb VFX immediately
- no src/game/sumo or src/game/input gameplay changes
- no wrestler asset / art exporter changes
- canonical grapple bond remains 0.70 m.

Verification accepted:

- focused limb tests: 13 / 13 PASS
- Grip success focused tests: 19 / 19 PASS
- pnpm test: 30 files / 518 PASS
- pnpm build: PASS
- git diff --check: PASS
- browser/runtime smoke: 27 / 27 PASS
- ACTION-11F pair compression and existing gameplay/presentation regressions preserved.

## User Visual Gate

REJECTED.

User feedback:

- the VFX does not match the intended arm / hand relationship
- the current procedural arms look too much like detached bars laid across the bodies
- desired appearance is closer to the supplied reference:
  - shoulder-originating arms visibly wrap toward the opponent
  - forearms pass around / across the opponent's torso
  - hands visibly land near the opponent's side / waist / mawashi region
  - the arm should read as belonging to one wrestler and gripping the other, not as a generic horizontal overlay.

The supplied visual reference showing overlaid arms on the Grip-success source is the direction for a future VFX redesign.

## Current 11G VFX Is NOT Accepted Product Baseline

Do not promote the current procedural limb VFX as accepted Grip Product presentation.

The current 11G implementation may remain in develop as a rejected Visual Gate until a focused follow-up task replaces or disables it.

Future arm-VFX work must not infer User acceptance from Technical PASS.

## Do Not Reopen

Accepted:
- ACTION-11C Grip gameplay
- ACTION-11F pair compression: +0.14 R forward / -0.20 R lateral
- 0.70 m canonical grapple bond
- Grip attempt art
- Grip success body art source / normalization.

Do not change these to solve the arm-VFX problem.

## Deferred Correction

A future focused arm-VFX task should first redesign limb geometry / rendering to match the User's supplied desired arm placement.

Do not combine that correction with the next brightness/tone-matching task.

## Next Task Constraint

The next requested task is Grip-success image brightness/tone correction.

It must:
- leave the rejected ACTION-11G arm-VFX geometry untouched
- leave ACTION-11F pair compression untouched
- change only the Grip-success art tone pipeline/output
- remain presentation/art-tooling only.
