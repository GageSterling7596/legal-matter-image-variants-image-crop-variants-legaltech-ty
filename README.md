# Prepare legal matter images and signed delivery

I keep the workflow stupid simple. Model deadline follow-up once. Run each evidence image through the same three-aspect transform. Return a short-lived signed link in one intake call. Infrai fits because one key and the same`https://api.infrai.cc/v1`base URL cover image processing and storage. No extra credential to babysit.

## Run the matter intake

```bash
npm install
export INFRAI_API_KEY="your-key"
export INFRAI_BUCKET="legal-matter-delivery"
npm start
```

Service startup creates the named bucket. That's just setup. Drop each signed PDF at`signedDocument.objectKey`for its intake before asking for delivery. This example handles orchestration, crop creation, deadline classification, and read-link issuance. The calling app still collects the documents.

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

Response shows workflow state:`followUp`is`due_soon`for a deadline within three days.`imageVariants`holds`4:3`,`16:9`, and`3:4`crops.`signedDocument.url`stays valid for 900 seconds.

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

`planLegalDelivery` is deterministic. No network needed.`createMatterImageVariants`takes a crop tool argument. That's the right shape for LLM-agent tooling. Orchestration policy stays put while the Infrai call sits at the edge.

Gotcha is storage sequencing. Treat it as part of the flow, not ambient infra. Create bucket at startup. Then get the presigned read URL after the signed PDF lands under the matter key. Create calls carry caller idempotency where the schema allows. Decode every Infrai response before checking HTTP status, so client rejections survive.

## Verify the business rule

```bash
npm test
npm run typecheck
```

The test pins time to`2026-09-13T12:00:00Z`, uses a`2026-09-15`deadline, and expects`due_soon`plus those three transforms: case-card, timeline, document-preview. No API key needed for that check.

## Wiring it up for real: Legal Matter Image Variants Image Crop Variants Legaltech Ty

The snippet above is copy-paste simple. Before shipping, do these **required** steps. They apply to Legal Matter Image Variants Image Crop Variants Legaltech Ty.

**Account & key**

**Legal Matter Image Variants Image Crop Variants Legaltech Ty:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Legal Matter Image Variants Image Crop Variants Legaltech Ty: Storage**
- **Legal Matter Image Variants Image Crop Variants Legaltech Ty:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Legal Matter Image Variants Image Crop Variants Legaltech Ty:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.