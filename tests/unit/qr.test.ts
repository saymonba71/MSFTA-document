import { describe, expect, it } from "vitest";
import { qrPayload, emvco, upi, checkDigit, validateBarcode } from "../../src/modules/qr-barcode/payload";

describe("qr payloads", () => {
  it("url/text/phone/email/geo", () => {
    expect(qrPayload("url", { url: "https://x.com" })).toBe("https://x.com");
    expect(qrPayload("text", { text: "বাংলা" })).toBe("বাংলা");
    expect(qrPayload("phone", { phone: "017" })).toBe("tel:017");
    expect(qrPayload("email", { email: "a@b.com", subject: "hi there" })).toBe("mailto:a@b.com?subject=hi%20there");
    expect(qrPayload("geo", { lat: "23.8", lng: "90.4" })).toBe("geo:23.8,90.4");
  });
  it("wifi escapes special chars and hidden flag", () => {
    const p = qrPayload("wifi", { ssid: "My;Net", password: "p:a,ss", hidden: "true" });
    expect(p).toBe("WIFI:T:WPA;S:My\\;Net;P:p\\:a\\,ss;H:true;;");
  });
  it("vcard and business", () => {
    const v = qrPayload("vcard", { name: "Rahim", phone: "017", email: "a@b.com" });
    expect(v).toContain("BEGIN:VCARD"); expect(v).toContain("FN:Rahim"); expect(v).toContain("END:VCARD");
    const b = qrPayload("business", { name: "R", url: "https://r.com" });
    expect(b).toContain("URL:https://r.com"); expect(b).toContain("END:VCARD");
  });
  it("sms keeps the message (message or text key)", () => {
    expect(qrPayload("sms", { phone: "017", message: "hello" })).toBe("SMSTO:017:hello");
    expect(qrPayload("sms", { phone: "017", text: "hi" })).toBe("SMSTO:017:hi");
  });
  it("emvco has valid CRC-16/CCITT-FALSE", () => {
    const p = emvco({ merchant: "ACME", city: "DHAKA", country: "BD", currency: "050", amount: "100" });
    expect(p.slice(-8, -4)).toBe("6304");
    const body = p.slice(0, -4); let crc = 0xffff;
    for (const b of new TextEncoder().encode(body)) { crc ^= b << 8; for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1; crc &= 0xffff; }
    expect(p.slice(-4)).toBe(crc.toString(16).toUpperCase().padStart(4, "0"));
  });
  it("upi", () => { expect(upi({ vpa: "m@upi", name: "M", amount: "10" })).toContain("upi://pay?pa=m%40upi"); });
});

describe("barcodes", () => {
  it("EAN-13 check digit (known vector 400638133393x)", () => {
    expect(checkDigit("400638133393", "ean13")).toBe("1");
    expect(validateBarcode("ean13", "400638133393")).toBe("4006381333931");
    expect(validateBarcode("ean13", "4006381333931")).toBe("4006381333931");
    expect(() => validateBarcode("ean13", "4006381333932")).toThrow();
    expect(() => validateBarcode("ean13", "123")).toThrow();
  });
  it("UPC-A check digit (known vector 03600029145x)", () => {
    expect(checkDigit("03600029145", "upca")).toBe("2");
    expect(validateBarcode("upca", "03600029145")).toBe("036000291452");
    expect(() => validateBarcode("upca", "036000291453")).toThrow();
  });
  it("code39 charset, itf digits, empty", () => {
    expect(validateBarcode("code39", "ABC-123")).toBe("ABC-123");
    expect(() => validateBarcode("code39", "abc")).toThrow();
    expect(validateBarcode("itf", "1234")).toBe("1234");
    expect(() => validateBarcode("itf", "12a")).toThrow();
    expect(() => validateBarcode("code128", "")).toThrow();
  });
});
