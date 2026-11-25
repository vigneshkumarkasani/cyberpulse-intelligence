---
title: "Sample: How to evaluate a threat report before you act on it"
description: "A demonstration article showing how to grade a threat report's sources, separate observation from inference and decide what to do first."
date: 2026-10-02
category: research
tags: [methodology, reporting, triage]
featured: true
demo: true
references:
  - title: "NIST SP 800-61 Rev. 2, Computer Security Incident Handling Guide"
    url: "https://csrc.nist.gov/pubs/sp/800/61/r2/final"
    publisher: "NIST"
  - title: "MITRE ATT&CK knowledge base"
    url: "https://attack.mitre.org/"
    publisher: "MITRE"
---

> **This is sample content.** It demonstrates the article format, reading experience and metadata. It describes no real incident and must not be cited as research.

Threat reports are useful because they compress a lot of work into a few pages. They are also easy to over-trust. A confident headline, a familiar vendor name or a chart can make an unverified claim feel established. This article sets out a simple routine for reading a report so that the team's response is proportionate to the evidence.

## Start with the question

Before reading the details, write down the question the report is meant to answer. For example: *Could this affect our internet-facing VPN appliances?* or *Do we have detections for the persistence technique described?* Reports answer many questions at once. Your question decides which parts matter.

## Separate observation from inference

Most reports mix three kinds of statement:

- **Observations**: something was seen, measured or reproduced.
- **Attributions**: someone is linked to the activity.
- **Predictions**: what the actors are likely to do next.

Observations are the strongest part of a report. Attributions and predictions should be read with more caution, and they should be tagged with the confidence the authors state.

## Grade the sources

Trace each key claim back to where it came from. A claim that appears in five articles but traces back to one unnamed post has a single source. Use a simple grading:

| Grade | What it looks like | How to use it |
| --- | --- | --- |
| A | Primary evidence: patch notes, original samples, reproducible telemetry | Act on it |
| B | Reputable researchers who cite their own evidence | Plan around it |
| C | Commentary and news summaries | Context only |

## Check the time window

Many reports describe activity observed weeks or months earlier. Check when the evidence was collected, not only when the report was published. A detection gap that was real in March may have closed in June, and a campaign described as "ongoing" may have ended.

## Decide what to do first

Once you know what is confirmed, decide on the smallest useful action. Good first steps are usually:

1. Confirm whether the affected product or technique exists in your environment.
2. Check existing logs for the indicators that the report marks as high confidence.
3. Add or tune a detection, then test it against a known-benign sample.
4. Record what you checked and what you could not check.

Each of these steps produces evidence of its own, which makes the next decision easier.

## A short example

Suppose a sample report says that a remote access tool is delivered through a document attachment and that its command-and-control traffic uses a fixed port. The report includes a table of indicators, but only one of them is marked *confirmed*.

```text
Claim                               Type          Confidence   Action
------------------------------------------------------------------------
Delivered via .docx attachment      Observation   Likely       Check mail gateway logs
Fixed port 8443 for C2              Observation   Confirmed    Search egress logs for 8443
Operator is a named group           Attribution   Possible     Track, do not act on
Next phase is data theft            Prediction    Unverified   Note only
```

The team would start with the egress search, because it is cheap and based on a confirmed observation. The attribution is recorded but does not change the response. The prediction is kept as a watch item.

## Where this routine fails

This approach is not a substitute for expertise. It does not catch a well-written report that is simply wrong, and it cannot tell you whether an unfamiliar technique is novel. Its purpose is narrower: to make the *reasoning* visible, so that colleagues can challenge it. When the reasoning is written down, a wrong conclusion is easier to find and correct.
