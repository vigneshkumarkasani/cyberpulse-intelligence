---
title: "Sample: Structuring a threat actor profile"
description: "A demonstration template for profiling a threat actor from public reporting, keeping reported facts, inferences and attribution confidence clearly apart."
date: 2026-08-30
category: threat-actors
tags: [threat-actors, attribution, profiling, template]
demo: true
references:
  - title: "MITRE ATT&CK: Groups"
    url: "https://attack.mitre.org/groups/"
    publisher: "MITRE"
---

> **This is sample content.** `ACTOR-DEMO-01` is a fictional actor used only to show the profile structure.

A threat actor profile is a summary of what is known about a group that conducts intrusions. Its value depends on one discipline above all: keeping *what was reported* separate from *what we infer*. Readers should be able to tell at a glance which parts are well supported and which are opinion.

## Profile fields

Every profile uses the same fields in the same order, so that profiles can be compared:

1. **Aliases**: names used by other organisations, each linked to its source.
2. **Summary**: two or three sentences describing the group's observed purpose.
3. **Observed activity**: dated, sourced observations only.
4. **Techniques**: mapped to a shared framework where possible.
5. **Targeting**: sectors and regions as reported, with the number of sources behind each claim.
6. **Attribution confidence**: stated explicitly, with the evidence for and against.
7. **Open questions**: what would change the picture.

## Separate reported from inferred

Write each claim in one of two forms. *Reported*: a named source says something happened. *Inferred*: we conclude something from reported facts. A profile that mixes the two loses its usefulness, because a reader cannot tell which parts to trust.

| Claim | Form | Sources | Confidence |
| --- | --- | --- | --- |
| Initial access via phishing with archive attachments | Reported | 3 (grade B) | Likely |
| Targets regional logistics providers | Reported | 2 (grade B, grade C) | Possible |
| Operates from a specific country | Inferred | 1 | Unverified |

## Attribution needs its own section

Attribution is the most fragile claim in threat intelligence. Overlapping tooling, shared infrastructure and public copies of malware can all mislead. In the profile, list the evidence that supports the link and the evidence that weakens it. If the evidence is thin, say so, and avoid naming individuals. Naming a person requires a documented public basis and careful review, and most profiles should not do it.

## Keep it current

Actors change. Mark the profile with the date of its latest source, and set a review date. A profile that has not been reviewed in a year should say so at the top, so that readers do not mistake old observations for current activity.

## What defenders can use

A profile is most useful when it ends with actions. Map its techniques to detections the team already has, identify the controls that would have stopped the observed activity, and list the telemetry that would confirm the group is active in your environment. Those three lists turn a profile from background reading into a plan.
