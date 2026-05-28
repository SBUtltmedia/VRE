import puppeteer from 'puppeteer';

const url = process.argv[2];
if (!url) {
  console.error('Usage: node capture_console.mjs <url>');
  process.exit(1);
}

let hasError = false;

function emit(type, args) {
  process.stdout.write(`[${type}] ${args.join(' ')}\n`);
}

async function main() {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--use-gl=angle'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  page.on('console', msg => {
    emit(msg.type().toUpperCase(), [msg.text()]);
  });

  page.on('pageerror', err => {
    hasError = true;
    emit('PAGE_ERROR', [err.message]);
  });

  page.on('requestfailed', req => {
    const f = req.failure();
    if (f) {
      hasError = true;
      emit('NET_FAIL', [`${req.url()} — ${f.errorText}`]);
    }
  });

  emit('INFO', [`Opening ${url}`]);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    emit('WAIT', ['Waiting 8s for WebGL renders...']);
    await new Promise(r => setTimeout(r, 8000));
    await page.screenshot({ path: 'capture_output.png', fullPage: false });
    emit('SCREENSHOT', ['Saved to capture_output.png']);
  } catch (err) {
    hasError = true;
    emit('NAV_FAIL', [err.message]);
  }

  await browser.close();
  process.exit(hasError ? 1 : 0);
}

main();
