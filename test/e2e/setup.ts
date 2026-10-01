import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const temporary = resolve('.tmp/e2e');
mkdirSync(temporary, {recursive: true});
process.env.TEMP = temporary;
process.env.TMP = temporary;
process.env.TMPDIR = temporary;
process.env.MELODY_BOUNCE_OFFLINE = '1';
