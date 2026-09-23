import { expect, it } from "vitest";
import { sniffImageType } from "./image";

it("recognises image signatures and rejects everything else", () => {
  expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
  expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
  expect(sniffImageType(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
  expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  expect(sniffImageType(new Uint8Array([]))).toBeNull();
});
