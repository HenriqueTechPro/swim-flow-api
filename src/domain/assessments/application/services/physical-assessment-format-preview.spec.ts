import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as prettier from 'prettier';

// Temporary formatter diagnostic, removed before merging the feature PR.
it('prints the canonical formatting for the two new files', async () => {
  const paths = [
    'src/shared/contracts/student-physical-assessments.ts',
    'src/infra/database/prisma/repositories/prisma-student-physical-assessments-repository.ts',
  ];
  for (const relativePath of paths) {
    const filePath = resolve(process.cwd(), relativePath);
    const input = readFileSync(filePath, 'utf8');
    const formatted = await prettier.format(input, {
      ...(await prettier.resolveConfig(filePath)),
      filepath: filePath,
    });
    console.log('BEGIN_PRETTIER_OUTPUT ' + relativePath);
    console.log(formatted);
    console.log('END_PRETTIER_OUTPUT ' + relativePath);
  }
});
