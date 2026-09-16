# Using a company brain

Optional. Skip this whole page if you do not run one.

A company brain indexes your notes and documents and lets you search them by
meaning. If you have one, it already holds most of what a sales agent needs to
know, written down once and kept current.

## Why the brain exports rather than serves

The obvious design is for the agent to query the brain live on every message.
This repo deliberately does not do that.

A brain indexes with a local embedding model. A search only works if the
question is embedded by the same model that embedded the documents, because
vectors from different models are not comparable. So a live query from your VPS
would mean installing that embedding model on the VPS and holding it in memory,
to answer one short question per message. That is a heavy thing to ask of the
smallest server someone can rent, and it makes the agent stop working whenever
that service is down.

Instead the brain does the retrieval where the embedding model already runs, and
writes the result into this repo's `knowledge/` folder as markdown. The agent
stays a plain Node process with no extra services, and it does not care whether
your brain machine is switched on.

## Why a person reads the files before they ship

A company brain holds internal notes. A sales agent talks to strangers.

Exporting to files rather than querying live turns that from a prompt rule into
a review step. You see a diff of what changed before it goes near a customer,
and a note that should never have left the building gets caught by a person
rather than by an instruction the model may or may not follow.

That is worth the extra step. Do not automate it away.

## Doing it

In your company brain, open the sales department and ask it to generate the
knowledge files for this agent. It reads what the department owns, writes
customer-safe markdown, and drops it into `knowledge/`.

Then read the diff. Look for anything about margins, supplier names, other
customers, internal problems or unreleased work. Delete what does not belong.

Then restart the agent, because the files are read once at boot.

## Live retrieval, if you really want it

If you already run the embedding service alongside the agent on the same
machine, a retrieval-backed provider can sit behind the same interface the file
loader uses, in `src/knowledge/`. The loader takes a `{ load(): Promise<string> }`
and nothing else, so nothing in the agent changes.

It is not built here and it is not the recommended path. The file export is
simpler, cheaper, offline, and safer, and for the size of knowledge a small
business actually has, retrieval buys nothing.
