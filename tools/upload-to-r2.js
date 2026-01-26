const fs = require("fs").promises;
const path = require("path");

async function loadEnvOnce() {
  if (process.env.__ENV_LOADED_FOR_R2__) return;

  const envPath = path.resolve(__dirname, "../.env");
  try {
    const envContent = await fs.readFile(envPath, "utf8");
    envContent
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .forEach((line) => {
        const index = line.indexOf("=");
        if (index === -1) return;
        const key = line.slice(0, index).trim();
        if (!key) return;
        const value = line
          .slice(index + 1)
          .trim()
          .replace(/^['"]|['"]$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
  } catch {
    // ignore
  }

  process.env.__ENV_LOADED_FOR_R2__ = "1";
}

async function main() {
  await loadEnvOnce();

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const bucket =
    process.env.R2_BUCKET ||
    process.env.R2_BUCKET_NAME ||
    process.env.BUCKET ||
    process.env.bucket ||
    "";
  const publicBase =
    process.env.R2_PUBLIC_BASE_URL ||
    process.env.PUBLIC_URL ||
    process.env.public_url ||
    "";
  const keyPrefix = process.env.R2_KEY_PREFIX || "";
  const keyMode = (process.env.R2_KEY_MODE || "").trim().toLowerCase();

  if (!accountId || !apiToken || !bucket) {
    console.error(
      "Missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN / R2_BUCKET in environment variables.",
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Usage: node tools/upload-to-r2.js <file1> [file2 ...]");
    process.exit(1);
  }

  const projectRoot = path.resolve(__dirname, "..");

  for (const input of args) {
    const absPath = path.resolve(process.cwd(), input);
    let stat;
    try {
      stat = await fs.stat(absPath);
    } catch {
      console.error("File not found:", absPath);
      // eslint-disable-next-line no-continue
      continue;
    }

    if (!stat.isFile()) {
      console.error("Not a file, skip:", absPath);
      // eslint-disable-next-line no-continue
      continue;
    }

    const rel = path.relative(projectRoot, absPath).replace(/\\/g, "/");
    const objectPath =
      keyMode === "basename" || keyMode === "flat" || rel.startsWith("..")
        ? path.basename(absPath)
        : rel;
    const key =
      keyPrefix.trim() === ""
        ? objectPath
        : `${keyPrefix.replace(/\/+$/, "")}/${objectPath}`;

    console.log(`Uploading to R2: ${absPath} -> ${bucket}/${key}`);

    const data = await fs.readFile(absPath);

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${encodeURIComponent(
      bucket,
    )}/objects/${encodeURIComponent(key)}`;

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": guessContentType(absPath),
      },
      body: data,
    });

    if (!response.ok) {
      let text;
      try {
        text = await response.text();
      } catch {
        text = "<no body>";
      }
      console.error(
        "Upload failed:",
        absPath,
        response.status,
        response.statusText,
        text,
      );
      process.exit(1);
    }

    let finalUrl = "";
    if (publicBase) {
      finalUrl = `${publicBase.replace(/\/+$/, "")}/${key}`;
      console.log("Uploaded. Public URL:", finalUrl);
    } else {
      console.log(
        "Uploaded. Configure R2_PUBLIC_BASE_URL to have a full public URL. Current key:",
        key,
      );
    }

    await writeMetaForFile({ filePath: absPath, publicUrl: finalUrl, bucket, key });
  }
}

function guessContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "application/octet-stream";
}

async function writeMetaForFile({ filePath, publicUrl, bucket, key }) {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const metaPath = path.join(dir, `${base}.json`);

  let existing = {};
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    existing = JSON.parse(raw);
  } catch {
    // ignore
  }

  const meta = {
    ...existing,
    url: publicUrl || existing.url || "",
    r2Bucket: bucket,
    r2Key: key,
    source: existing.source || "r2-upload",
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2));
  console.log("Saved meta", metaPath);
}

main().catch((err) => {
  console.error("Unexpected error in upload-to-r2:", err);
  process.exit(1);
});

