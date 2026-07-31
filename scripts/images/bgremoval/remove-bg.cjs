/**
 * Background removal script — Node.js CommonJS
 * Usage: node remove-bg.js <input> <output.png>
 * Run from the bgremoval directory so that node_modules are resolved locally.
 */
const fs = require('fs');
const { removeBackground } = require('@imgly/background-removal-node');

(async () => {
  const [inputPath, outputPath] = process.argv.slice(2);
  if (!inputPath || !outputPath) {
    process.stderr.write('Usage: node remove-bg.js <input> <output.png>\n');
    process.exit(1);
  }

  try {
    const buffer = fs.readFileSync(inputPath);

    // Build a Blob with proper MIME type (the library's Buffer→Blob conversion loses type)
    const magic = buffer[0];
    let mime = 'image/jpeg';
    if (buffer[0] === 0x89 && buffer[1] === 0x50) mime = 'image/png';
    else if (buffer[0] === 0x52 && buffer[1] === 0x49) mime = 'image/webp';
    const blob = new Blob([buffer], { type: mime });

    const t0 = Date.now();
    const resultBlob = await removeBackground(blob, {
      model: 'medium',
      output: { format: 'image/png' },
    });

    const arr = Buffer.from(await resultBlob.arrayBuffer());
    fs.writeFileSync(outputPath, arr);

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    process.stderr.write(`OK ${(buffer.length / 1024).toFixed(0)}→${(arr.length / 1024).toFixed(0)} Ko ${elapsed}s\n`);
  } catch (err) {
    process.stderr.write(`FAIL: ${err.message}\n`);
    process.exit(1);
  }
})();
