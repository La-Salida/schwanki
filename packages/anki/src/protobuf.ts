import { strFromU8 } from "fflate";

/**
 * Just enough protobuf decoding to read newer Anki exports: the media index and
 * the note type / card template configs stored as protobuf blobs.
 */
export type ProtoValue = number | Uint8Array;

/** Every field in a message, keyed by field number (repeated fields keep all values). */
export function readMessage(buf: Uint8Array): Map<number, ProtoValue[]> {
  const fields = new Map<number, ProtoValue[]>();
  let pos = 0;
  const varint = (): number => {
    let result = 0;
    let scale = 1;
    for (;;) {
      if (pos >= buf.length) throw new Error("truncated protobuf");
      const byte = buf[pos++]!;
      result += (byte & 0x7f) * scale;
      if (byte < 0x80) return result;
      scale *= 128;
    }
  };
  while (pos < buf.length) {
    const tag = varint();
    const field = Math.floor(tag / 8);
    const wire = tag % 8;
    let value: ProtoValue;
    if (wire === 0) value = varint();
    else if (wire === 2) {
      const len = varint();
      value = buf.subarray(pos, pos + len);
      pos += len;
    } else if (wire === 1) { value = buf.subarray(pos, pos + 8); pos += 8; }
    else if (wire === 5) { value = buf.subarray(pos, pos + 4); pos += 4; }
    else throw new Error(`unsupported protobuf wire type ${wire}`);
    const list = fields.get(field) ?? [];
    list.push(value);
    fields.set(field, list);
  }
  return fields;
}



export function protoString(fields: Map<number, ProtoValue[]>, field: number): string {
  const value = fields.get(field)?.[0];
  return value instanceof Uint8Array ? strFromU8(value) : "";
}

export function protoNumber(fields: Map<number, ProtoValue[]>, field: number): number {
  const value = fields.get(field)?.[0];
  return typeof value === "number" ? value : 0;
}
