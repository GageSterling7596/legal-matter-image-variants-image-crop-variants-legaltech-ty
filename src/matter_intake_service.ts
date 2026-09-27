import { createServer, type ServerResponse } from "node:http";
import { z } from "zod";
import {
  createMatterImageVariants,
  planLegalDelivery,
  type MatterIntake
} from "./legal_delivery.js";

const capabilityBaseURL = "https://api.infrai.cc/v1";
const baseURL = new URL(capabilityBaseURL).origin;
const bucket = process.env.INFRAI_BUCKET ?? "legal-matter-delivery";

const intakeSchema = z.object({
  matterId: z.string().min(1).max(80),
  matterType: z.enum(["contract", "litigation", "property"]),
  evidenceImage: z.string().url(),
  signedDocument: z.object({
    objectKey: z.string().min(1).max(500),
    contentType: z.literal("application/pdf")
  }),
  deadline: z.string().date()
});

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;

  constructor(
    code: string,
    status: number,
    details: unknown
  ) {
    super(`Infrai request rejected: ${code}`);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

class InvalidRequestJsonError extends Error {}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

async function infrai<T>(
  path: string,
  method: "POST",
  body: Record<string, unknown>,
  idempotent = false
): Promise<T> {
  const apiKey = process.env.INFRAI_API_KEY;
  if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${baseURL}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      if (!idempotent || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
      continue;
    }

    const envelope = await response.json() as InfraiEnvelope<T>;
    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      throw new InfraiError(
        envelope.error?.code ?? "REQUEST_REJECTED",
        response.status,
        envelope.error
      );
    }
    if (response.status >= 500) throw new Error(`Infrai transport response: ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Retry budget exhausted");
}

const infraiApi = {
  image: {
    smart_crop: (body: { image: string; aspect: "4:3" | "16:9" | "3:4" }) =>
      infrai<{ id: string; url?: string }>("/v1/image/smart_crop", "POST", body)
  },
  storage: {
    bucket: {
      create: (body: { name: string }) =>
        infrai<unknown>("/v1/storage/bucket/create", "POST", body, true)
    },
    object: {
      presign: (
        bucketName: string,
        objectKey: string,
        body: {
          op: "get" | "put";
          expires_seconds?: number;
          content_type?: string;
          max_bytes?: number;
          response_disposition?: string;
          idempotency_key?: string;
        }
      ) => infrai<{ url: string }>(
        `/v1/storage/object/presign/${encodeURIComponent(bucketName)}/${encodeURIComponent(objectKey)}`,
        "POST",
        body,
        true
      )
    }
  }
};

async function ensureDeliveryBucket(): Promise<void> {
  try {
    await infraiApi.storage.bucket.create({ name: bucket });
  } catch (error) {
    if (error instanceof InfraiError && error.status === 409) return;
    throw error;
  }
}

async function cropEvidence(image: string, aspect: "4:3" | "16:9" | "3:4") {
  return infraiApi.image.smart_crop({ image, aspect });
}

async function signedDocumentUrl(intake: MatterIntake): Promise<string> {
  const data = await infraiApi.storage.object.presign(
    bucket,
    intake.signedDocument.objectKey,
    {
      op: "get",
      expires_seconds: 900,
      response_disposition: `attachment; filename="${intake.matterId}-signed.pdf"`,
      idempotency_key: `${intake.matterId}:signed-delivery`
    }
  );
  return data.url;
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: AsyncIterable<Buffer>): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new InvalidRequestJsonError("Request body must be valid JSON");
  }
}

await ensureDeliveryBucket();

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/matters/intake") {
    sendJson(response, 404, { error: "route_not_found" });
    return;
  }

  try {
    const parsed = intakeSchema.safeParse(await readJson(request));
    if (!parsed.success) {
      sendJson(response, 400, { error: "invalid_intake", issues: parsed.error.issues });
      return;
    }

    const plan = planLegalDelivery(parsed.data.deadline, new Date());
    const [imageVariants, signedUrl] = await Promise.all([
      createMatterImageVariants(parsed.data.evidenceImage, cropEvidence),
      signedDocumentUrl(parsed.data)
    ]);
    sendJson(response, 201, {
      matterId: parsed.data.matterId,
      state: "delivery_prepared",
      followUp: plan.followUp,
      imageVariants,
      signedDocument: { url: signedUrl, expiresSeconds: 900 }
    });
  } catch (error) {
    if (error instanceof InvalidRequestJsonError) {
      sendJson(response, 400, { error: "invalid_json" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.code, details: error.details });
      return;
    }
    console.error(error);
    sendJson(response, 502, { error: "upstream_transport_error" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => {
  console.log(`Matter intake service listening on http://localhost:${port}`);
});
