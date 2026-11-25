---
title: "Sample: Writing detection notes that survive sample changes"
description: "A demonstration of writing detection notes around behaviour and structure rather than hashes, so that they still work when a malware sample is repacked."
date: 2026-06-09
category: research
tags: [detection, malware, behaviour, methodology]
demo: true
references:
  - title: "MITRE ATT&CK: Data sources and detection guidance"
    url: "https://attack.mitre.org/datasources/"
    publisher: "MITRE"
---

> **This is sample content.** The rule logic is illustrative pseudocode for teaching purposes and has not been tested against real telemetry.

A detection built on a file hash has a short life. Change one byte and it stops matching. Detections built on behaviour last longer, but they are harder to write and easier to make noisy. This article describes how to write detection notes that remain useful when a sample changes, and how to show what they can and cannot see.

## Describe the behaviour first

Start with a plain-language description of what the activity does, independent of the tool that does it. For example: *a document process starts a script interpreter, which then writes to a startup folder.* That sentence survives a rename, a repack or a change of language.

## Write the logic as a hypothesis

Turn the description into a testable condition over fields your telemetry actually provides:

```text
WHEN process.parent.name IN ("WINWORD.EXE", "EXCEL.EXE")
 AND process.name IN ("powershell.exe", "wscript.exe", "cscript.exe")
 AND process.command_line CONTAINS-ANY ("-enc", "-nop", "http")
THEN raise alert "Office spawned a script host with suspicious arguments"
```

Note the assumptions in the logic: which fields are present, whether command lines are logged, and whether the parent process is recorded reliably. A detection that depends on a field your environment does not collect will silently never fire.

## Measure before you trust

Every detection needs two measurements:

| Measure | How to get it | What it tells you |
| --- | --- | --- |
| True positive rate | Run a controlled, benign simulation of the behaviour | Whether the rule fires when it should |
| False positive rate | Run the rule over a week of normal activity | Whether analysts will drown in noise |

Publish both measurements in the note. A detection without them is an opinion.

## Document what it cannot see

Every detection has blind spots. Write them down explicitly: encrypted channels, activity on hosts without the agent, living-off-the-land variants with different arguments, or actions outside the logged event types. Blind spots are not failures of the note. They are the information another analyst needs to decide whether to add a second control.

## Keep the note alive

When the detection fires, record what happened and whether it was correct. When a new variant appears, update the behavioural description rather than adding a hash. Over time the note becomes a record of what the team has learned, which is worth more than the rule itself.
