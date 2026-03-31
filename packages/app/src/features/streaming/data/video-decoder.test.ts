import { describe, it, expect } from "vitest";
import { parseAnnexBNalus, buildAvcC, annexBToAvcC, base64ToUint8Array } from "./video-decoder";

describe("parseAnnexBNalus", () => {
  it("should parse NALUs with 4-byte start codes", () => {
    // 00 00 00 01 [NALU1] 00 00 00 01 [NALU2]
    const data = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0xC0, 0x1E, // SPS NALU
      0x00, 0x00, 0x00, 0x01, 0x68, 0xCE, 0x38, 0x80, // PPS NALU
    ]);
    const nalus = parseAnnexBNalus(data);
    expect(nalus).toHaveLength(2);
    expect(nalus[0]).toEqual(new Uint8Array([0x67, 0x42, 0xC0, 0x1E]));
    expect(nalus[1]).toEqual(new Uint8Array([0x68, 0xCE, 0x38, 0x80]));
  });

  it("should parse NALUs with 3-byte start codes", () => {
    const data = new Uint8Array([
      0x00, 0x00, 0x01, 0x67, 0x42, // 3-byte start code + SPS
      0x00, 0x00, 0x01, 0x68, 0xCE, // 3-byte start code + PPS
    ]);
    const nalus = parseAnnexBNalus(data);
    expect(nalus).toHaveLength(2);
    expect(nalus[0]).toEqual(new Uint8Array([0x67, 0x42]));
    expect(nalus[1]).toEqual(new Uint8Array([0x68, 0xCE]));
  });

  it("should return empty array for empty data", () => {
    const nalus = parseAnnexBNalus(new Uint8Array([]));
    expect(nalus).toHaveLength(0);
  });

  it("should return empty array for data without start codes", () => {
    const nalus = parseAnnexBNalus(new Uint8Array([0x67, 0x42, 0xC0]));
    expect(nalus).toHaveLength(0);
  });

  it("should handle single NALU", () => {
    const data = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x84]);
    const nalus = parseAnnexBNalus(data);
    expect(nalus).toHaveLength(1);
    expect(nalus[0]).toEqual(new Uint8Array([0x65, 0x88, 0x84]));
  });
});

describe("buildAvcC", () => {
  it("should build a valid avcC box from SPS and PPS", () => {
    const sps = new Uint8Array([0x67, 0x64, 0x00, 0x2A, 0xAC, 0x2B]);
    const pps = new Uint8Array([0x68, 0xEE, 0x3C, 0x80]);

    const avcC = buildAvcC(sps, pps);

    // Header: 6 bytes + SPS length (2) + SPS data + PPS count (1) + PPS length (2) + PPS data
    expect(avcC.length).toBe(11 + sps.length + pps.length);

    // configurationVersion
    expect(avcC[0]).toBe(1);
    // AVCProfileIndication (from SPS[1])
    expect(avcC[1]).toBe(0x64);
    // profile_compatibility (from SPS[2])
    expect(avcC[2]).toBe(0x00);
    // AVCLevelIndication (from SPS[3])
    expect(avcC[3]).toBe(0x2A);
    // lengthSizeMinusOne = 0xFF (4-byte NALU lengths)
    expect(avcC[4]).toBe(0xFF);
    // numOfSequenceParameterSets = 0xE1 (1 SPS)
    expect(avcC[5]).toBe(0xE1);
    // SPS length big-endian
    expect(avcC[6]).toBe(0);
    expect(avcC[7]).toBe(sps.length);
    // numOfPictureParameterSets = 1
    expect(avcC[8 + sps.length]).toBe(1);
  });
});

describe("annexBToAvcC", () => {
  it("should convert Annex B NALUs to 4-byte length prefixed format", () => {
    const annexB = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x65, 0x88, 0x84, // 1 NALU, 3 bytes data
    ]);

    const avcC = annexBToAvcC(annexB);

    // Should be: 4 bytes length + 3 bytes data = 7 bytes
    expect(avcC.length).toBe(7);
    // Length prefix: big-endian 3
    expect(avcC[0]).toBe(0);
    expect(avcC[1]).toBe(0);
    expect(avcC[2]).toBe(0);
    expect(avcC[3]).toBe(3);
    // NALU data
    expect(avcC[4]).toBe(0x65);
    expect(avcC[5]).toBe(0x88);
    expect(avcC[6]).toBe(0x84);
  });

  it("should handle multiple NALUs", () => {
    const annexB = new Uint8Array([
      0x00, 0x00, 0x00, 0x01, 0x65, 0x88, // NALU 1: 2 bytes
      0x00, 0x00, 0x00, 0x01, 0x41, 0x9A, 0x55, // NALU 2: 3 bytes
    ]);

    const avcC = annexBToAvcC(annexB);

    // NALU 1: 4 + 2 = 6, NALU 2: 4 + 3 = 7, total = 13
    expect(avcC.length).toBe(13);
  });

  it("should return empty for data without NALUs", () => {
    const avcC = annexBToAvcC(new Uint8Array([0x65, 0x88]));
    expect(avcC.length).toBe(0);
  });
});

describe("base64ToUint8Array", () => {
  it("should decode base64 to bytes", () => {
    // "AQID" = [1, 2, 3]
    const result = base64ToUint8Array("AQID");
    expect(result).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("should handle empty string", () => {
    const result = base64ToUint8Array("");
    expect(result.length).toBe(0);
  });

  it("should decode longer base64 correctly", () => {
    // "SGVsbG8=" = "Hello"
    const result = base64ToUint8Array("SGVsbG8=");
    expect(Array.from(result)).toEqual([72, 101, 108, 108, 111]);
  });
});
