// WHATSAPP · Transcoder MP4/Opus → OGG/Opus (remux sin re-encodear), portado
// tal cual de sacs_inbox/media-proxy (TS puro, sin deps). Chrome en macOS
// graba audio/mp4;codecs=opus y WhatsApp lo rechaza como nota de voz.
// Expone: esMP4(bytes), mp4OpusAOgg(bytes) → Uint8Array | null.

function readU32BE(d: Uint8Array, off: number): number {
  return ((d[off] << 24) | (d[off+1] << 16) | (d[off+2] << 8) | d[off+3]) >>> 0;
}

function readU16BE(d: Uint8Array, off: number): number {
  return (d[off] << 8) | d[off+1];
}

function readU64BE(d: Uint8Array, off: number): number {
  // JS can't handle full u64, but for file offsets/sizes this is fine
  const hi = readU32BE(d, off);
  const lo = readU32BE(d, off + 4);
  return hi * 0x100000000 + lo;
}

function boxType(d: Uint8Array, off: number): string {
  return String.fromCharCode(d[off], d[off+1], d[off+2], d[off+3]);
}

function isMP4(bytes: Uint8Array): boolean {
  if (bytes.length < 8) return false;
  return boxType(bytes, 4) === 'ftyp';
}

interface MP4Box { type: string; offset: number; size: number; headerSize: number }

function* iterateBoxes(d: Uint8Array, start: number, end: number): Generator<MP4Box> {
  let pos = start;
  while (pos + 8 <= end) {
    let size = readU32BE(d, pos);
    const type = boxType(d, pos + 4);
    let headerSize = 8;
    if (size === 1) {
      if (pos + 16 > end) break;
      size = readU64BE(d, pos + 8);
      headerSize = 16;
    } else if (size === 0) {
      size = end - pos;
    }
    if (size < headerSize || pos + size > end) break;
    yield { type, offset: pos, size, headerSize };
    pos += size;
  }
}

function findBox(d: Uint8Array, start: number, end: number, type: string): MP4Box | null {
  for (const box of iterateBoxes(d, start, end)) {
    if (box.type === type) return box;
  }
  return null;
}

interface DOpsInfo { version: number; channels: number; preSkip: number; sampleRate: number; outputGain: number; mappingFamily: number }

function parseDOps(d: Uint8Array, off: number): DOpsInfo {
  return {
    version: d[off],
    channels: d[off + 1],
    preSkip: readU16BE(d, off + 2),
    sampleRate: readU32BE(d, off + 4),
    outputGain: (d[off + 8] << 8) | d[off + 9],
    mappingFamily: d[off + 10],
  };
}

interface OpusFrameInfo { frames: Uint8Array[]; dOps: DOpsInfo }

function extractOpusFramesFromMP4(d: Uint8Array): OpusFrameInfo {
  const end = d.length;

  // Navigate to moov > trak > mdia > minf > stbl > stsd to find dOps
  const moov = findBox(d, 0, end, 'moov');
  if (!moov) throw new Error('MP4: no moov box');
  const moovStart = moov.offset + moov.headerSize;
  const moovEnd = moov.offset + moov.size;

  const trak = findBox(d, moovStart, moovEnd, 'trak');
  if (!trak) throw new Error('MP4: no trak box');
  const mdia = findBox(d, trak.offset + trak.headerSize, trak.offset + trak.size, 'mdia');
  if (!mdia) throw new Error('MP4: no mdia box');
  const minf = findBox(d, mdia.offset + mdia.headerSize, mdia.offset + mdia.size, 'minf');
  if (!minf) throw new Error('MP4: no minf box');
  const stbl = findBox(d, minf.offset + minf.headerSize, minf.offset + minf.size, 'stbl');
  if (!stbl) throw new Error('MP4: no stbl box');
  const stsd = findBox(d, stbl.offset + stbl.headerSize, stbl.offset + stbl.size, 'stsd');
  if (!stsd) throw new Error('MP4: no stsd box');

  // stsd is a full box (version + flags = 4 bytes) + entry_count (4 bytes)
  const stsdDataStart = stsd.offset + stsd.headerSize + 4 + 4;
  // First entry is the codec box (Opus)
  const codecBox = findBox(d, stsdDataStart, stsd.offset + stsd.size, 'Opus');
  if (!codecBox) throw new Error('MP4: no Opus codec in stsd');

  // Inside the Opus sample entry, find dOps
  // Opus sample entry: 6 reserved + 2 data_ref_idx + 8 reserved + 2 channels + 2 sample_size + 4 reserved + 4 sample_rate = 28 bytes after box header
  const opusInner = codecBox.offset + codecBox.headerSize + 28;
  const dOpsBox = findBox(d, opusInner, codecBox.offset + codecBox.size, 'dOps');
  if (!dOpsBox) throw new Error('MP4: no dOps box');
  const dOps = parseDOps(d, dOpsBox.offset + dOpsBox.headerSize);

  // Extract frames from moof+mdat pairs
  const frames: Uint8Array[] = [];
  for (const topBox of iterateBoxes(d, 0, end)) {
    if (topBox.type !== 'moof') continue;

    // Find traf > trun inside moof
    const traf = findBox(d, topBox.offset + topBox.headerSize, topBox.offset + topBox.size, 'traf');
    if (!traf) continue;

    // Parse tfhd for default_sample_size
    const tfhd = findBox(d, traf.offset + traf.headerSize, traf.offset + traf.size, 'tfhd');
    let defaultSampleSize = 0;
    if (tfhd) {
      const tfhdFlags = readU32BE(d, tfhd.offset + tfhd.headerSize) & 0xFFFFFF;
      let tfhdOff = tfhd.offset + tfhd.headerSize + 4 + 4; // version+flags + track_id
      if (tfhdFlags & 0x01) tfhdOff += 8; // base_data_offset
      if (tfhdFlags & 0x02) tfhdOff += 4; // sample_description_index
      if (tfhdFlags & 0x08) tfhdOff += 4; // default_sample_duration
      if (tfhdFlags & 0x10) defaultSampleSize = readU32BE(d, tfhdOff);
    }

    const trun = findBox(d, traf.offset + traf.headerSize, traf.offset + traf.size, 'trun');
    if (!trun) continue;

    // trun is a full box: version (1) + flags (3)
    const trunStart = trun.offset + trun.headerSize;
    const trunFlags = readU32BE(d, trunStart) & 0xFFFFFF;
    const sampleCount = readU32BE(d, trunStart + 4);

    let dataOffset = 0;
    let trunPos = trunStart + 8;
    if (trunFlags & 0x01) { // data_offset_present
      dataOffset = readU32BE(d, trunPos);
      // dataOffset is signed i32
      if (dataOffset > 0x7FFFFFFF) dataOffset -= 0x100000000;
      trunPos += 4;
    }
    if (trunFlags & 0x04) trunPos += 4; // first_sample_flags

    const hasDuration = !!(trunFlags & 0x100);
    const hasSize = !!(trunFlags & 0x200);
    const hasFlags = !!(trunFlags & 0x400);
    const hasCTO = !!(trunFlags & 0x800);

    // Find the mdat that follows this moof
    const mdatSearch = topBox.offset + topBox.size;
    const mdat = findBox(d, mdatSearch, Math.min(mdatSearch + 32, end), 'mdat');
    if (!mdat) continue;

    // Data starts at moof.offset + dataOffset (relative to moof start)
    let framePos = topBox.offset + dataOffset;

    for (let i = 0; i < sampleCount; i++) {
      if (hasDuration) trunPos += 4;
      const sampleSize = hasSize ? readU32BE(d, trunPos) : defaultSampleSize;
      if (hasSize) trunPos += 4;
      if (hasFlags) trunPos += 4;
      if (hasCTO) trunPos += 4;

      if (sampleSize > 0 && framePos + sampleSize <= end) {
        frames.push(d.slice(framePos, framePos + sampleSize));
      }
      framePos += sampleSize;
    }
  }

  if (frames.length === 0) throw new Error('MP4: no Opus frames found');
  return { frames, dOps };
}

// ── OGG Muxer ──

const CRC32_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function oggCrc32(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = CRC32_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return crc >>> 0;
}

function writeU32LE(d: Uint8Array, off: number, v: number) {
  d[off] = v & 0xFF; d[off+1] = (v >> 8) & 0xFF; d[off+2] = (v >> 16) & 0xFF; d[off+3] = (v >> 24) & 0xFF;
}

function writeU16LE(d: Uint8Array, off: number, v: number) {
  d[off] = v & 0xFF; d[off+1] = (v >> 8) & 0xFF;
}

function buildOggPage(
  serialNo: number, pageSeqNo: number, granulePos: number,
  headerType: number, segments: Uint8Array[]
): Uint8Array {
  // Build segment table
  const segSizes: number[] = [];
  for (const seg of segments) {
    let remaining = seg.length;
    while (remaining >= 255) { segSizes.push(255); remaining -= 255; }
    segSizes.push(remaining);
  }

  const headerSize = 27 + segSizes.length;
  const dataSize = segments.reduce((sum, s) => sum + s.length, 0);
  const page = new Uint8Array(headerSize + dataSize);

  // OggS capture pattern
  page[0] = 0x4F; page[1] = 0x67; page[2] = 0x67; page[3] = 0x53;
  // Version
  page[4] = 0;
  // Header type
  page[5] = headerType;
  // Granule position (64-bit LE)
  const granLo = granulePos >>> 0;
  const granHi = (granulePos / 0x100000000) >>> 0;
  writeU32LE(page, 6, granLo);
  writeU32LE(page, 10, granHi);
  // Serial number
  writeU32LE(page, 14, serialNo);
  // Page sequence number
  writeU32LE(page, 18, pageSeqNo);
  // CRC (placeholder, filled later)
  writeU32LE(page, 22, 0);
  // Segment count
  page[26] = segSizes.length;
  // Segment table
  for (let i = 0; i < segSizes.length; i++) page[27 + i] = segSizes[i];
  // Data
  let off = headerSize;
  for (const seg of segments) { page.set(seg, off); off += seg.length; }

  // Compute CRC
  const crc = oggCrc32(page);
  writeU32LE(page, 22, crc);

  return page;
}

function buildOpusHead(dOps: DOpsInfo): Uint8Array {
  const head = new Uint8Array(19);
  // "OpusHead"
  const magic = [0x4F,0x70,0x75,0x73,0x48,0x65,0x61,0x64];
  for (let i = 0; i < 8; i++) head[i] = magic[i];
  head[8] = 1; // version
  head[9] = dOps.channels;
  writeU16LE(head, 10, dOps.preSkip);
  writeU32LE(head, 12, dOps.sampleRate);
  writeU16LE(head, 16, dOps.outputGain);
  head[18] = dOps.mappingFamily;
  return head;
}

function buildOpusTags(): Uint8Array {
  const vendor = 'sacs-media-proxy';
  const buf = new Uint8Array(8 + 4 + vendor.length + 4);
  // "OpusTags"
  const magic = [0x4F,0x70,0x75,0x73,0x54,0x61,0x67,0x73];
  for (let i = 0; i < 8; i++) buf[i] = magic[i];
  writeU32LE(buf, 8, vendor.length);
  for (let i = 0; i < vendor.length; i++) buf[12 + i] = vendor.charCodeAt(i);
  writeU32LE(buf, 12 + vendor.length, 0); // 0 comments
  return buf;
}

function convertMP4OpusToOGG(mp4Bytes: Uint8Array): Uint8Array {
  const { frames, dOps } = extractOpusFramesFromMP4(mp4Bytes);
  const serialNo = (Math.random() * 0x7FFFFFFF) >>> 0;
  const pages: Uint8Array[] = [];
  let pageSeqNo = 0;

  // Page 0: OpusHead (BOS)
  pages.push(buildOggPage(serialNo, pageSeqNo++, 0, 0x02, [buildOpusHead(dOps)]));

  // Page 1: OpusTags
  pages.push(buildOggPage(serialNo, pageSeqNo++, 0, 0x00, [buildOpusTags()]));

  // Audio pages: pack multiple frames per page (max ~48 segments per page to stay under 255 segment limit)
  const SAMPLES_PER_FRAME = 960; // 20ms at 48kHz
  let granulePos = 0;
  let batch: Uint8Array[] = [];
  let batchSegCount = 0;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    // Each frame needs ceil(frame.length / 255) + 1 segment table entries
    // (or ceil(frame.length / 255) if frame.length is multiple of 255, which adds a trailing 0)
    const segsNeeded = Math.floor(frame.length / 255) + 1;

    if (batchSegCount + segsNeeded > 255 && batch.length > 0) {
      // Flush current batch
      pages.push(buildOggPage(serialNo, pageSeqNo++, granulePos, 0x00, batch));
      batch = [];
      batchSegCount = 0;
    }

    granulePos += SAMPLES_PER_FRAME;
    batch.push(frame);
    batchSegCount += segsNeeded;
  }

  // Flush remaining with EOS flag
  if (batch.length > 0) {
    pages.push(buildOggPage(serialNo, pageSeqNo++, granulePos, 0x04, batch));
  }

  // Concatenate all pages
  const totalSize = pages.reduce((sum, p) => sum + p.length, 0);
  const ogg = new Uint8Array(totalSize);
  let off = 0;
  for (const p of pages) { ogg.set(p, off); off += p.length; }

  if (false) console.log(`[ogg] converted MP4/Opus → OGG/Opus, ${frames.length} frames, ${mp4Bytes.length}→${ogg.length} bytes`);
  return ogg;
}

export const esMP4 = isMP4;
/** Convierte; si el MP4 no trae Opus o el parseo falla, devuelve null (subir original). */
export function mp4OpusAOgg(bytes: Uint8Array): Uint8Array | null {
  try { return convertMP4OpusToOGG(bytes); } catch { return null; }
}
