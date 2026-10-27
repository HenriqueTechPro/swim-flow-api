const fs = require('node:fs');
const prettier = require('prettier');

async function main() {
  for (const path of [
    'src/infra/http/controllers/uploads.controller.ts',
    'test/private-image-upload.e2e-spec.ts',
  ]) {
    const content = fs.readFileSync(path, 'utf8');
    const formatted = await prettier.format(content, { filepath: path });
    process.stdout.write('@@@FORMATTED ' + path + ' ' + JSON.stringify(formatted) + '\n');
  }
}

main().catch((error) => {
  process.stderr.write(String(error) + '\n');
  process.exitCode = 1;
});
