const fs = require("fs/promises");
const path = require("path");

function extractField(patterns, source) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\./g, "/").replace(/-/g, "/");
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseAmount(value) {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : null;
}

async function callConfiguredProvider(filePath) {
  const providerUrl = process.env.OCR_PROVIDER_URL;
  if (!providerUrl) {
    return null;
  }

  const buffer = await fs.readFile(filePath);
  const response = await fetch(providerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": process.env.OCR_PROVIDER_TOKEN ? `Bearer ${process.env.OCR_PROVIDER_TOKEN}` : undefined
    },
    body: JSON.stringify({
      fileName: path.basename(filePath),
      contentBase64: buffer.toString("base64")
    })
  });

  if (!response.ok) {
    throw new Error(`OCR provider request failed with status ${response.status}`);
  }

  return response.json();
}

function parseProviderResult(result) {
  const rawText = String(result?.rawText || result?.text || "");
  const extractedAmount = parseAmount(result?.amount || extractField([
    /amount[:\s]*([Pp₱]?\s*[\d,]+(?:\.\d{1,2})?)/i,
    /total[:\s]*([Pp₱]?\s*[\d,]+(?:\.\d{1,2})?)/i
  ], rawText));
  const extractedReferenceNumber = result?.referenceNumber || extractField([
    /reference(?:\s*number)?[:\s]*([A-Z0-9-]+)/i,
    /ref(?:\s*no\.?)?[:\s]*([A-Z0-9-]+)/i
  ], rawText);
  const extractedDate = parseDate(result?.date || extractField([
    /date[:\s]*([0-9]{1,4}[\/.-][0-9]{1,2}[\/.-][0-9]{1,4})/i
  ], rawText));

  return {
    providerName: result?.providerName || "CONFIGURED_PROVIDER",
    providerReference: result?.requestId || result?.referenceId || null,
    rawText: rawText || null,
    extractedAmount,
    extractedReferenceNumber: extractedReferenceNumber || null,
    extractedDate
  };
}

async function runReceiptOcr(filePath, expectedAmount) {
  let providerResult = null;

  try {
    providerResult = await callConfiguredProvider(filePath);
  } catch (error) {
    providerResult = {
      providerName: "OCR_PROVIDER_ERROR",
      rawText: error.message
    };
  }

  const parsed = parseProviderResult(providerResult || {});
  const expected = Number(expectedAmount || 0);
  const extracted = Number(parsed.extractedAmount || 0);
  const amountMismatch = expected > 0 && extracted > 0 && Math.abs(expected - extracted) > 1;
  const hasMinimumFields = Boolean(parsed.extractedAmount || parsed.extractedReferenceNumber || parsed.extractedDate);

  return {
    ...parsed,
    matchStatus: hasMinimumFields && !amountMismatch ? "MATCH" : "MISMATCH",
    mismatchReason: amountMismatch
      ? `OCR amount ${extracted.toFixed(2)} does not match expected amount ${expected.toFixed(2)}`
      : hasMinimumFields ? null : "OCR provider did not extract enough receipt fields",
    confidence: hasMinimumFields ? 0.8 : 0.2
  };
}

module.exports = {
  runReceiptOcr
};
