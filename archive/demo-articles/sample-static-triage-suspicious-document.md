---
title: "Sample: Static triage of a suspicious document"
description: "A demonstration of first-pass static triage for a suspicious office document: hashing, metadata, structure and recording indicators with confidence."
date: 2026-09-21
category: malware
tags: [malware, triage, indicators, static-analysis]
demo: true
references:
  - title: "MITRE ATT&CK: Phishing (T1566)"
    url: "https://attack.mitre.org/techniques/T1566/"
    publisher: "MITRE"
  - title: "NIST SP 800-83 Rev. 1, Guide to Malware Incident Prevention and Handling"
    url: "https://csrc.nist.gov/pubs/sp/800/83/r1/final"
    publisher: "NIST"
---

> **This is sample content.** The hashes, addresses and domains below are placeholders. No sample was analysed.

Static triage answers a narrow question: *is this file worth escalating, and what can we learn without running it?* It is the cheapest stage of analysis, and when it is done carefully it prevents wasted effort and keeps risky steps out of the hands of people who should not run them.

## Work in an isolated copy

Copy the file into a dedicated analysis folder and work only on the copy. Keep a record of the original's hash so the copy can be traced back to the source. Never open a suspicious file on a machine that is connected to production systems.

## Start with hashes and type

Compute the cryptographic hashes first, then check what the file actually is, regardless of its extension.

```python
import hashlib
from pathlib import Path

def triage_hashes(path: str) -> dict[str, str]:
    """Return SHA-256 and SHA-1 for a file, read in chunks."""
    digests = {"sha256": hashlib.sha256(), "sha1": hashlib.sha1()}
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            for digest in digests.values():
                digest.update(chunk)
    return {name: digest.hexdigest() for name, digest in digests.items()}

print(triage_hashes("analysis/copy/invoice.docm"))
```

Compare the leading bytes with the expected format, and note any mismatch between the extension and the content. A file named `.pdf` that begins with a ZIP signature deserves attention.

## Look at structure, not just content

Office documents are ZIP containers. Listing their parts shows whether macros, embedded objects or external relationships are present, without executing anything.

| Part | Why it matters | Example value |
| --- | --- | --- |
| `vbaProject.bin` | Presence of macro code | Present or absent |
| `externalLinks/` | References to remote resources | `https://files.example.invalid/...` |
| `embeddings/` | Embedded objects that may be launched | Usually absent in normal documents |
| `docProps/core.xml` | Author and timestamps | Check for mismatch with the claimed sender |

## Record indicators with context

An indicator is only useful with its confidence and its scope. Record each one in a small table that a colleague could act on without reading the whole analysis.

| Indicator | Type | Confidence | Note |
| --- | --- | --- | --- |
| `files.example.invalid` | Domain | Likely | Remote template link in the document |
| `192.0.2.10` | IPv4 | Possible | Address seen in a related sample, documentation range |
| `3f9a…` (SHA-256) | File hash | Confirmed | This exact file only; trivially changed |

Hashes change easily and are weak for long-term detection. Behaviour, structure and infrastructure patterns usually last longer.

## Decide and hand off

At the end of static triage, one of three outcomes is reasonable:

- **Benign**: record the reason and close.
- **Suspicious**: escalate to dynamic analysis in a controlled lab, with the indicators attached.
- **Malicious with confidence**: contain affected hosts, search for the indicators in logs and open an incident.

Whatever the outcome, write down what you did not check. A clear list of gaps makes the next analyst's job faster and keeps the conclusion honest.
