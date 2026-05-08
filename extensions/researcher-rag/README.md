# Extension — Researcher + Vertex AI Vector Search (RAG)

**Difficulty:** Hard · **Time:** 6–8 hours · **What you'll learn:** turn your agent into a researcher that answers from your private corpus.

## Why this matters

Your Level 2 memory bank is great for short notes. But you can't dump a 200-page PDF into it — grep stops being useful past a few thousand entries. By the end of this extension, your agent indexes any document you give it (PDF, Markdown, Notion export) into Vertex AI Vector Search and retrieves the right passages on demand.

## What you'll build

- `src/tools/document-ingest.ts` — chunk + embed any document into Vertex AI Vector Search
- `src/tools/rag-search.ts` — semantic search tool the agent calls during reasoning
- `src/lib/embeddings.ts` — Vertex AI embeddings client (`gemini-embedding-001`)
- A Firestore-backed mapping from chunk-ID → original document + offset (for citations)

## Prerequisites

- Completed Levels 1–4
- Vertex AI API enabled in your GCP project
- A few documents to index (PDFs, Markdown files, scraped HTML)

## Steps

### 1. Provision Vertex AI Vector Search

```bash
# Create the index
gcloud ai indexes create \
  --display-name=adkclaw-rag \
  --metadata-file=index-metadata.json \
  --region=$REGION

# Deploy to an endpoint
gcloud ai index-endpoints create \
  --display-name=adkclaw-rag-endpoint \
  --region=$REGION

gcloud ai index-endpoints deploy-index \
  $ENDPOINT_ID \
  --deployed-index-id=adkclaw_rag \
  --display-name=AdkclawRagDeployed \
  --index=$INDEX_ID \
  --region=$REGION
```

The `index-metadata.json` defines dimension (3072 for `gemini-embedding-001`), distance metric (cosine), and shard size. A starter is in `extensions/researcher-rag/index-metadata.example.json`.

### 2. Build the embeddings client

```typescript
// src/lib/embeddings.ts
import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI();

export async function embed(texts: string[]): Promise<number[][]> {
  const result = await client.models.embedContent({
    model: 'gemini-embedding-001',
    contents: texts,
  });
  return result.embeddings.map(e => e.values);
}
```

### 3. Build the ingest tool

`document_ingest({ path, sourceId })`:
1. Read file (PDF via `pdf-parse`, Markdown as text)
2. Chunk into ~500-token windows with 50-token overlap
3. Call `embed(chunks)` in batches of 100
4. Upsert vectors to Vertex AI Vector Search with `chunkId` as the datapoint ID
5. Write a Firestore doc per chunk: `{ chunkId, sourceId, text, offset }`

### 4. Build the search tool

`rag_search({ query, topK })`:
1. `embed([query])` → query vector
2. Call Vector Search nearest-neighbors → `topK` chunk IDs
3. Look up Firestore for the chunk text + source metadata
4. Return `[{ text, source, similarity }]`

### 5. Register both tools in `src/index.ts`

Plug them into the existing `ToolRegistry`. The agent will pick them up the next turn.

### 6. Test the round-trip

```bash
# Ingest a PDF
echo "Use the document_ingest tool to index ./test/fixtures/sample.pdf with sourceId='sample'" | npm run chat

# Query it
echo "What does the sample document say about agent loops? Use rag_search." | npm run chat
```

## Success criteria

- [ ] `document_ingest` chunks a PDF and writes vectors + Firestore mappings
- [ ] `rag_search` returns relevant passages with source citations
- [ ] Agent uses the citations in its final response (not just paraphrasing)
- [ ] Cost per ingest is logged (chunks × embedding price)
- [ ] Two failing tests in `src/tools/rag-search.test.ts` pass after your implementation

## Stretch

- Hybrid search (lexical + semantic) — boost exact-term hits
- Reranking with `gemini-2.5-flash` to filter top 20 down to top 5
- Per-user namespaces (multi-tenant RAG)
- Streaming partial results from the search tool

## Common pitfalls

| Symptom | Fix |
|---|---|
| Vector Search returns empty | The deployed index is still warming up (~10 min after first deploy). Wait, then retry. |
| Embeddings call rate-limited | Batch larger (100/call) and add exponential backoff via the existing healing engine. |
| Costs explode | You're embedding the same chunks repeatedly — write a Firestore-backed dedup before calling `embed()`. |
| Cited passages don't match the answer | Chunk size is too small (or too big). 400–600 tokens is usually the sweet spot. |
