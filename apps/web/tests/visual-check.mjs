import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const baseUrl = process.env.TALKNEST_WEB_URL ?? "http://127.0.0.1:5173";
const outputDir = path.resolve("artifacts");
mkdirSync(outputDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  { name: "desktop", width: 1440, height: 980 },
  { name: "mobile", width: 390, height: 844 }
];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({
    path: path.join(outputDir, `talknest-${viewport.name}.png`),
    fullPage: true
  });

  const canvasStats = await page.locator("canvas").evaluate((canvas) => {
    const element = canvas;
    const context =
      element.getContext("webgl2", { preserveDrawingBuffer: true }) ??
      element.getContext("webgl", { preserveDrawingBuffer: true });

    if (!context) {
      return { ok: false, reason: "missing-webgl-context" };
    }

    const data = new Uint8Array(element.width * element.height * 4);
    context.readPixels(
      0,
      0,
      element.width,
      element.height,
      context.RGBA,
      context.UNSIGNED_BYTE,
      data
    );
    let colored = 0;

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3];

      if (alpha > 0 && (data[index] !== 0 || data[index + 1] !== 0 || data[index + 2] !== 0)) {
        colored += 1;
      }

      if (colored > 100) {
        break;
      }
    }

    return { ok: colored > 100, colored };
  });

  if (!canvasStats.ok) {
    throw new Error(`Three.js canvas appears blank for ${viewport.name}`);
  }

  const heroBox = await page.locator(".hero-copy").boundingBox();
  const featureBox = await page.locator("#features").boundingBox();

  if (!heroBox || !featureBox || featureBox.y <= 0) {
    throw new Error(`Landing layout did not render correctly for ${viewport.name}`);
  }

  await page.close();
}

await browser.close();
console.log("Visual validation passed");
