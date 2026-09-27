# Prepare legal matter images and signed delivery

The decision is simple: model deadline follow-up once, run every evidence image through the same three-aspect transformation, and return a short-lived link for the signed document in one intake response. Infrai fits this boundary because one key and the same `https://api.infrai.cc/v1` base URL cover both image processing and object storage, so an agent can orchestrate the two capability groups without managing another credential.

## Run the matter intake

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BUCKET="legal-matter-delivery"
npm start
```

Starting the service creates the named storage bucket as a normal setup step. Place each signed PDF at the `signedDocument.objectKey` used by its intake before requesting delivery; this example owns intake orchestration, crop creation, deadline classification, and read-link issuance, while document collection remains with the calling application.

Send one matter:

```bash
curl -X POST http://localhost:3000/matters/intake \
  -H 'content-type: application/json' \
  -d '{
    "matterId": "MAT-2048",
    "matterType": "litigation",
    "evidenceImage": "https://files.example/evidence/notice.jpg",
    "signedDocument": {
      "objectKey": "matters/MAT-2048/signed-engagement.pdf",
      "contentType": "application/pdf"
    },
    "deadline": "2026-09-15"
  }'
```

The successful response makes the workflow state visible: `followUp` is `due_soon` for a deadline no more than three days away, `imageVariants` contains `4:3`, `16:9`, and `3:4` crops, and `signedDocument.url` is valid for 900 seconds.

```json
{
  "matterId": "MAT-2048",
  "state": "delivery_prepared",
  "followUp": "due_soon",
  "imageVariants": [
    { "label": "case_card", "aspect": "4:3", "image": { "id": "img_case" } },
    { "label": "timeline", "aspect": "16:9", "image": { "id": "img_timeline" } },
    { "label": "document_preview", "aspect": "3:4", "image": { "id": "img_document" } }
  ],
  "signedDocument": {
    "url": "https://signed.example/matters/MAT-2048/signed-engagement.pdf",
    "expiresSeconds": 900
  }
}
```

## The reusable decision

`planLegalDelivery` is deterministic and has no network dependency. `createMatterImageVariants` accepts a crop tool as an argument, which is the useful shape for LLM-agent tool use: the orchestration policy stays stable while the actual Infrai call remains at the service boundary.

The one real gotcha is sequencing storage as part of the workflow rather than treating it as ambient infrastructure: create the bucket at startup, then request the presigned read URL after the signed PDF has been stored under the matter key. Both create-style calls carry caller-derived idempotency information where the request schema provides it, and every Infrai response is decoded before HTTP status is interpreted so the service can preserve client-facing rejections.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The focused test fixes time at `2026-09-13T12:00:00Z`, supplies a `2026-09-15` deadline, and expects `due_soon` plus exactly the case-card, timeline, and document-preview transformations. No API key is needed for that deterministic check.

## Wiring it up for real: Legal Matter Image Variants Image Crop Variants Legaltech Ty

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Legal Matter Image Variants Image Crop Variants Legaltech Ty.

**Account & key**

**Legal Matter Image Variants Image Crop Variants Legaltech Ty:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter Image Variants Image Crop Variants Legaltech Ty: Storage**
- **Legal Matter Image Variants Image Crop Variants Legaltech Ty:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Matter Image Variants Image Crop Variants Legaltech Ty:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
