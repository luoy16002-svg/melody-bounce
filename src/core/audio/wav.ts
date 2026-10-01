export type Sample = { rate: number; channels: Float32Array[] };
const ascii = (bytes: Uint8Array, start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));

/** Browser/Node PCM RIFF decoder, including VSCO's 24-bit stereo masters. */
export function decodeWav(buffer: Uint8Array): Sample {
  if (buffer.length < 12 || ascii(buffer, 0, 4) !== 'RIFF' || ascii(buffer, 8, 4) !== 'WAVE') throw new Error('Invalid WAV header');
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let format = 0, channels = 0, rate = 0, bits = 0, block = 0, dataStart = -1, dataLength = 0;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = ascii(buffer, offset, 4), size = view.getUint32(offset + 4, true), start = offset + 8;
    if (start + size > buffer.length) throw new Error('Truncated WAV chunk');
    if (id === 'fmt ') {
      if (size < 16) throw new Error('Invalid WAV format chunk');
      format = view.getUint16(start, true); channels = view.getUint16(start + 2, true);
      rate = view.getUint32(start + 4, true); block = view.getUint16(start + 12, true); bits = view.getUint16(start + 14, true);
      if (format === 65534 && size >= 40) format = view.getUint16(start + 24, true);
    } else if (id === 'data') { dataStart = start; dataLength = size; }
    offset = start + size + (size % 2);
  }
  if (dataStart < 0 || !channels || !rate || ![16, 24, 32].includes(bits) || block !== channels * bits / 8 || (format !== 1 && !(format === 3 && bits === 32))) throw new Error('Unsupported WAV encoding (expected PCM 16/24/32 or float32)');
  if (dataLength % block) throw new Error('Incomplete WAV sample frame');
  const count = dataLength / block, output = Array.from({length: channels}, () => new Float32Array(count));
  for (let i = 0; i < count; i++) for (let c = 0; c < channels; c++) {
    const p = dataStart + i * block + c * bits / 8;
    const integer = bits === 16 ? view.getInt16(p, true) : bits === 24
      ? ((buffer[p] | (buffer[p + 1] << 8) | (buffer[p + 2] << 16)) << 8) >> 8 : view.getInt32(p, true);
    const value = format === 3 ? view.getFloat32(p, true) : integer / 2 ** (bits - 1);
    if (!Number.isFinite(value)) throw new Error('Nonfinite WAV sample');
    output[c][i] = value;
  }
  return {rate, channels: output};
}

export function encodeWav(channels: readonly (Float32Array | Float64Array)[], rate: number): Uint8Array {
  const count = channels[0]?.length ?? 0;
  if (!channels.length || channels.some(c => c.length !== count) || !Number.isInteger(rate) || rate <= 0) throw new Error('Invalid WAV dimensions');
  const bytes = count * channels.length * 2;
  if (bytes > 0xffffffff - 36) throw new Error('WAV exceeds RIFF size limit');
  const out = new Uint8Array(44 + bytes), view = new DataView(out.buffer);
  const text = (value: string, at: number) => { for (let i = 0; i < value.length; i++) out[at + i] = value.charCodeAt(i); };
  text('RIFF', 0); view.setUint32(4, 36 + bytes, true); text('WAVEfmt ', 8);
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * channels.length * 2, true); view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true); text('data', 36); view.setUint32(40, bytes, true);
  for (let i = 0; i < count; i++) for (let c = 0; c < channels.length; c++) {
    const value = channels[c][i];
    if (!Number.isFinite(value)) throw new Error('Nonfinite audio sample');
    view.setInt16(44 + (i * channels.length + c) * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
  }
  return out;
}
