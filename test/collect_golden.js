const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");

(async () => {
    const url = "file:///" + path.resolve("plays/chain.html").replace(/\\/g, "/");
    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-web-security", "--allow-file-access-from-files"],
    });
    const page = await browser.newPage();

    page.on("pageerror", (err) => console.error("PAGE_ERROR:", err.message));

    await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
    await page.evaluate(() => { window._chainData = []; });
    await page.click("#renderCanvas").catch(() => {});

    await page.waitForFunction(
        () => document.body.getAttribute("data-status") === "complete",
        { timeout: 60000 }
    );

    const chainData = await page.evaluate(() => window._chainData);
    const outPath = path.resolve("plays/chain_golden.json");
    fs.writeFileSync(outPath, JSON.stringify(chainData, null, 2));
    console.log(`Saved ${chainData.length} frames to ${outPath}`);

    const clipNames = [...new Set(chainData.map((d) => d.clip))];
    console.log(`Clips: ${clipNames.join(", ")}`);
    const byClip = {};
    chainData.forEach((d) => { byClip[d.clip] = (byClip[d.clip] || 0) + 1; });
    for (const [clip, n] of Object.entries(byClip)) {
        const frames = chainData.filter((d) => d.clip === clip);
        console.log(`  ${clip}: ${n} frames, progress ${frames[0].progress} → ${frames[frames.length - 1].progress}`);
    }

    await browser.close();
})();
