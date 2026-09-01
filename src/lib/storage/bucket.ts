import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * The object store the dashboard uploads pictures into.
 *
 * ## Why this file is `server-only`, and why that matters more here than usual
 *
 * Everything else in this dashboard is deliberately client-side: the browser
 * holds the anon key, signs in as a real user, and **Row-Level Security decides
 * what it may do**. There is no privileged credential anywhere, which is what
 * makes "the UI is never the only guard" true rather than aspirational.
 *
 * An S3 secret key is not that kind of credential. It is not scoped to a user,
 * RLS has no opinion about it, and anyone holding it can read, overwrite and
 * delete every object in the bucket. Inlined into the bundle it would be
 * readable by anybody who opens the page.
 *
 * So this is the one privileged thing in the deployed app, and it is confined
 * to three places: this module, the route handlers that use it, and the
 * environment. `import "server-only"` makes that a build error rather than a
 * convention — a component that imports this by accident fails to compile
 * instead of shipping a key.
 *
 * **The authorisation this displaces has to be written by hand.** For every
 * other write, the question "is this person an operator" is answered by a
 * policy in Postgres. Here it is answered by `requireOperator` in the route,
 * because the bucket cannot ask. That is the real cost of moving storage out of
 * Supabase, and it is why the check is one shared function rather than a few
 * lines repeated in each handler.
 *
 * ## The browser still sends the bytes
 *
 * The route signs a URL; the file goes from the browser straight to the bucket.
 * Two reasons, and the first is not the interesting one:
 *
 * - A serverless function on Vercel takes a request body of about 4.5 MB, and
 *   `IMAGE.maxBytes` is 5 MB. Proxying would reject valid photographs.
 * - The upload keeps a **real** progress bar. Through a proxy the browser only
 *   watches its own hop, and the second one — the slow one, on a bad
 *   connection — is invisible behind a bar that has already reached the end.
 */

export type BucketConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /**
   * Where the objects are readable from without a signature, if anywhere.
   *
   * Empty for this bucket today — see `imageUrlFor` — and read from the
   * environment so that pointing at a CDN later is a variable, not a release.
   */
  publicBaseUrl: string;
  /**
   * This deployment's canonical origin, used to build `/i/<key>` URLs.
   *
   * Explicit rather than taken from the incoming request, because the URL goes
   * into a database column and outlives the request that made it. A picture
   * uploaded from a Vercel preview would otherwise be stored as
   * `https://dashboard-abc123-....vercel.app/i/...` — correct that afternoon,
   * a dead link in the customer app for good once the preview is gone.
   *
   * Empty in local development, where the request's own origin is right and is
   * all there is.
   */
  canonicalUrl: string;
};

const LABELS: Record<keyof BucketConfig, string> = {
  endpoint: "S3_ENDPOINT",
  region: "S3_REGION",
  bucket: "S3_BUCKET",
  accessKeyId: "S3_ACCESS_KEY_ID",
  secretAccessKey: "S3_SECRET_ACCESS_KEY",
  publicBaseUrl: "S3_PUBLIC_BASE_URL",
  canonicalUrl: "APP_PUBLIC_URL",
};

/** The optional one. Anything else missing is a misconfiguration. */
const OPTIONAL: (keyof BucketConfig)[] = ["publicBaseUrl", "canonicalUrl"];

export function readBucketConfig(): BucketConfig {
  const raw: BucketConfig = {
    endpoint: process.env.S3_ENDPOINT ?? "",
    region: process.env.S3_REGION ?? "auto",
    bucket: process.env.S3_BUCKET ?? "",
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL ?? "").replace(/\/+$/, ""),
    canonicalUrl: (process.env.APP_PUBLIC_URL ?? "").replace(/\/+$/, ""),
  };

  const missing = (Object.keys(LABELS) as (keyof BucketConfig)[]).filter(
    (key) => !OPTIONAL.includes(key) && raw[key].length === 0,
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing environment ${missing.length === 1 ? "variable" : "variables"}: ` +
        `${missing.map((key) => LABELS[key]).join(", ")}. ` +
        "Copy .env.example to .env.local and fill them in.",
    );
  }

  return raw;
}

/**
 * One client per process.
 *
 * The SDK keeps a connection pool, and a fresh client per request throws it
 * away — on a warm serverless instance that is a new TLS handshake to the
 * storage host on every upload, which is most of the cost of signing a URL.
 */
let client: S3Client | null = null;

function s3(config: BucketConfig): S3Client {
  client ??= new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    // The bucket is a path segment, not a subdomain. Virtual-host style would
    // need a wildcard certificate this host does not serve.
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return client;
}

/** How long a browser has to start and finish one upload. */
const UPLOAD_WINDOW_SECONDS = 15 * 60;

/**
 * A URL the browser may `PUT` one object to.
 *
 * The signature covers the **key, the method and the content type** — so a URL
 * handed out for a JPEG cannot be used to store a script, or an object under a
 * different name. That matters because this is the only point in the design
 * where a browser writes to the bucket directly: what the route decided has to
 * be nailed into the signature, or it is a suggestion the client can ignore.
 *
 * Fifteen minutes is long enough for a large photograph on a shop's tethered
 * phone, and short enough that a URL captured from a log is not a standing
 * invitation.
 */
export async function presignUpload(
  key: string,
  contentType: string,
): Promise<string> {
  const config = readBucketConfig();
  return getSignedUrl(
    s3(config),
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      ContentType: contentType,
    }),
    {
      expiresIn: UPLOAD_WINDOW_SECONDS,
      // Part of the bargain above, so it must be presented by the browser and
      // checked by the store rather than left to trust.
      signableHeaders: new Set(["content-type"]),
    },
  );
}

/** Reads one object back, for the public route to stream. */
export async function getObject(key: string) {
  const config = readBucketConfig();
  return s3(config).send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}

/** Removes one object. Only ever a supersession — see `lib/images.ts`. */
export async function deleteObject(key: string): Promise<void> {
  const config = readBucketConfig();
  await s3(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}

/**
 * The URL that goes in an `image_url` column.
 *
 * ## Why this is not simply the storage host
 *
 * This bucket has **no public read**. Objects return 403 unsigned; the S3
 * bucket-policy API answers `NotImplemented`, and a `public-read` ACL on a
 * `PutObject` is accepted and then ignored. Only a signed request succeeds, and
 * a signed URL expires — which makes it exactly the wrong thing to store in a
 * column the app reads months later. `0065` chose a public bucket for that
 * reason, and it is still the reason.
 *
 * So the dashboard serves them: `/i/<key>` streams the object behind a
 * signature the customer never sees. The trade is stated rather than buried —
 * the app's pictures now depend on this deployment being up, where before they
 * depended on Supabase's CDN. The route caches hard at the edge to keep that
 * from meaning a function invocation per image.
 *
 * ## And the way out is one variable
 *
 * If the storage account later exposes a public or CDN domain for this bucket,
 * set `S3_PUBLIC_BASE_URL` and new uploads get a direct URL with no code
 * change. Rows already written keep working either way, because `/i/<key>`
 * stays a valid route — which is the whole reason the key is recoverable from
 * the URL rather than the URL being opaque.
 *
 * `requestOrigin` is the fallback, not the preference — see `canonicalUrl`.
 */
export function imageUrlFor(key: string, requestOrigin: string): string {
  const { publicBaseUrl, canonicalUrl } = readBucketConfig();
  const base =
    publicBaseUrl || `${canonicalUrl || requestOrigin.replace(/\/+$/, "")}/i`;
  return `${base}/${key}`;
}
