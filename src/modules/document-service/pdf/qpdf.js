import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../../../config/index.js';
import { AppError } from '../../../shared/errors/AppError.js';

const exec = promisify(execFile);

export class QpdfNotAvailableError extends AppError {
  constructor() {
    super(
      'qpdf is not available. Install it (Linux: `apt install qpdf`; Windows: `winget install QPDF.QPDF`) and/or set QPDF_BIN.',
      501,
      { code: 'QPDF_NOT_AVAILABLE' },
    );
  }
}

export class PdfOperationError extends AppError {
  constructor(message) {
    super(message, 422, { code: 'PDF_OPERATION_FAILED' });
  }
}

/** Run qpdf with args. qpdf exit codes: 0 ok, 3 ok-with-warnings, 2 error. */
async function runQpdf(args) {
  try {
    await exec(config.documents.qpdfBin, args, { maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (err.code === 'ENOENT') throw new QpdfNotAvailableError();
    // Exit code 3 = warnings but output was still written → treat as success.
    if (err.code === 3) return;
    const detail = (err.stderr || err.message || '').toString().trim();
    throw new PdfOperationError(detail || 'qpdf failed');
  }
}

/** Run an op that reads a temp input file and writes a temp output file. */
async function withTempIo(inputBuffer, buildArgs) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'qpdf-'));
  const inPath = path.join(dir, 'in.pdf');
  const outPath = path.join(dir, 'out.pdf');
  try {
    await writeFile(inPath, inputBuffer);
    await runQpdf(buildArgs(inPath, outPath));
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** qpdf version string (used for availability/health checks). */
export async function version() {
  try {
    const { stdout } = await exec(config.documents.qpdfBin, ['--version']);
    return stdout.toString().split('\n')[0].trim();
  } catch (err) {
    if (err.code === 'ENOENT') throw new QpdfNotAvailableError();
    throw err;
  }
}

/**
 * Compress: re-pack with object streams + recompressed flate streams. This
 * shrinks bloated/uncompressed PDFs structurally. (Image-heavy PDFs benefit
 * additionally from Ghostscript image downsampling — out of scope here.)
 */
export function compress(inputBuffer) {
  return withTempIo(inputBuffer, (i, o) => [
    '--object-streams=generate',
    '--compress-streams=y',
    '--recompress-flate',
    '--',
    i,
    o,
  ]);
}

/**
 * Lock: encrypt with AES. `userPassword` opens the file; `ownerPassword`
 * controls permissions (defaults to userPassword if omitted). Either may be
 * empty (e.g. open freely but restrict permissions).
 */
export function lock(inputBuffer, { userPassword = '', ownerPassword } = {}) {
  const bits = String(config.documents.encryptionBits);
  const owner = ownerPassword ?? userPassword;
  return withTempIo(inputBuffer, (i, o) => [
    '--encrypt',
    userPassword,
    owner,
    bits,
    '--',
    i,
    o,
  ]);
}

/** Unlock: remove encryption using the document's password. */
export function unlock(inputBuffer, password) {
  return withTempIo(inputBuffer, (i, o) => [
    '--decrypt',
    `--password=${password ?? ''}`,
    '--',
    i,
    o,
  ]);
}
