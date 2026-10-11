import { z } from "zod";
import { UserError } from "@/lib/user-error";

/** Tapping an item cycles through these in order. */
export const STATUSES = ["TODO", "OK", "MISSING", "SKIP"] as const;
export type ChecklistStatus = (typeof STATUSES)[number];

export type ChecklistItem = { id: number; name: string; note: string; status: ChecklistStatus };
export type ChecklistSection = { id: number; title: string; description: string; items: ChecklistItem[] };

/** A section before it has ids: the default list, an import, or an export. */
export type SectionDraft = { title: string; description: string; items: { name: string; note: string }[] };

export function nextStatus(status: ChecklistStatus): ChecklistStatus {
  return STATUSES[(STATUSES.indexOf(status) + 1) % STATUSES.length];
}

export function summarize(sections: ChecklistSection[]) {
  const counts = { OK: 0, MISSING: 0, SKIP: 0, TODO: 0 };
  const missing: { name: string; step: number; section: string }[] = [];
  sections.forEach((sec, i) => {
    for (const it of sec.items) {
      counts[it.status]++;
      if (it.status === "MISSING") missing.push({ name: it.name, step: i + 1, section: sec.title });
    }
  });
  const total = counts.OK + counts.MISSING + counts.SKIP + counts.TODO;
  const percent = total ? Math.round(((total - counts.TODO) / total) * 100) : 0;
  return { ...counts, total, percent, missing };
}

/** Swaps a section with its neighbour; null when it is already at that end. */
export function moveSection(sections: ChecklistSection[], index: number, dir: -1 | 1) {
  const j = index + dir;
  if (j < 0 || j >= sections.length) return null;
  const next = [...sections];
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}

/**
 * Moves an item one place up or down. Past the top or bottom of its section it moves into the
 * neighbouring section (to its end going up, its start going down), so items can change sections
 * with the same two buttons. Null at the very first or last place.
 */
export function moveItem(sections: ChecklistSection[], si: number, ii: number, dir: -1 | 1) {
  const items = sections[si].items;
  const next = sections.map((s) => ({ ...s, items: [...s.items] }));
  const j = ii + dir;
  if (j >= 0 && j < items.length) {
    [next[si].items[ii], next[si].items[j]] = [next[si].items[j], next[si].items[ii]];
    return next;
  }
  const target = si + dir;
  if (target < 0 || target >= sections.length) return null;
  const [item] = next[si].items.splice(ii, 1);
  if (dir < 0) next[target].items.push(item);
  else next[target].items.unshift(item);
  return next;
}

/** Same shape as the stand-alone checklist page's backup, so its JSON imports here as is. */
export function exportChecklist(sections: ChecklistSection[]) {
  return JSON.stringify(
    {
      version: 2,
      sections: sections.map((s) => ({
        title: s.title,
        desc: s.description,
        items: s.items.map((i) => ({ name: i.name, note: i.note })),
      })),
    },
    null,
    2,
  );
}

const fileSchema = z.object({
  sections: z.array(
    z.object({
      title: z.string(),
      desc: z.string().optional(),
      description: z.string().optional(),
      items: z.array(z.object({ name: z.string(), note: z.string().optional() })),
    }),
  ),
});

export function parseChecklist(text: string): SectionDraft[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new UserError("That isn't valid JSON.");
  }
  const parsed = fileSchema.safeParse(data);
  if (!parsed.success) throw new UserError("Expected sections, each with a title and items that have a name.");
  return cleanDrafts(
    parsed.data.sections.map((s) => ({
      title: s.title,
      description: s.description ?? s.desc ?? "",
      items: s.items.map((i) => ({ name: i.name, note: i.note ?? "" })),
    })),
  );
}

/** Trims text and drops nameless items; used for anything about to be saved wholesale. */
export function cleanDrafts(drafts: SectionDraft[]): SectionDraft[] {
  return drafts.map((s) => ({
    title: s.title.trim(),
    description: s.description.trim(),
    items: s.items.map((i) => ({ name: i.name.trim(), note: i.note.trim() })).filter((i) => i.name),
  }));
}

const d = (title: string, description: string, items: [string, string?][]): SectionDraft => ({
  title,
  description,
  items: items.map(([name, note = ""]) => ({ name, note })),
});

/** Starter list: all-grain brew day through kegging. */
export const DEFAULT_CHECKLIST: SectionDraft[] = [
  d("ล้างและ Sanitize", "ทำก่อนทุกอย่าง อุปกรณ์ที่สัมผัสเวิร์ตหลังต้มเสร็จต้อง sanitize ทั้งหมด", [
    ["ผงล้าง (PBW หรือ oxygen cleaner)", "ล้างคราบก่อน sanitize ไม่ใช้แทนกัน"],
    ["Sanitizer (Star San / iodophor)", "ผสมตามอัตราบนฉลาก เช็กว่าเหลือพอทั้ง batch"],
    ["ขวดสเปรย์สำหรับ sanitizer"],
    ["ถังหรือภาชนะแช่อุปกรณ์ชิ้นเล็ก", "สำหรับ airlock, ฝา, ท่อ, ช้อน"],
    ["ฟองน้ำ / แปรงที่ไม่ทำให้เกิดรอยขีดข่วน"],
  ]),
  d("ตวงและชั่ง", "เครื่องมือเตรียมของก่อนวันต้ม", [
    ["เครื่องบดมอลต์", "เช็กระยะห่างลูกบดและความสะอาด"],
    ["ตาชั่งดิจิทัล", "ความละเอียด 0.1 g สำหรับ hops, 1 g สำหรับมอลต์"],
    ["ภาชนะหรือถุงสำหรับแยกชั่ง", "ใช้แยก grain และ hops ตามเวลาเติม"],
    ["ถ้วยตวงหรือภาชนะวัดปริมาตร (L)", "ใช้วัดน้ำ strike, sparge และ top-up"],
  ]),
  d("Mash", "แปลงแป้งเป็นน้ำตาล ช่วงอุณหภูมิทั่วไป 63–69°C นาน 60 นาที", [
    ["Mash tun หรือ kettle + ถุง BIAB", "ความจุพอกับ grain bill + น้ำ"],
    ["แหล่งความร้อน + เชื้อเพลิง / ไฟฟ้า", "ใช้อุ่น strike water ให้ถึงอุณหภูมิ"],
    ["เทอร์โมมิเตอร์สำหรับ mash", "เช็กค่าเทียบกับน้ำเดือดหรือน้ำแข็งเป็นระยะ"],
    ["พายหรือทัพพีคน mash", "วัสดุ food grade ยาวพอถึงก้น"],
    ["pH meter หรือแถบวัด pH", "เป้า mash pH ประมาณ 5.2–5.6, meter ต้อง calibrate"],
    ["นาฬิกาจับเวลา"],
    ["ชุดทดสอบไอโอดีน", "ตรวจว่า starch convert หมด (ไม่บังคับ)"],
  ]),
  d("Sparge / Lauter", "ล้างน้ำตาลออกจาก grain ด้วยน้ำร้อนประมาณ 75–78°C", [
    ["ภาชนะ / HLT สำหรับอุ่นน้ำ sparge", "ต้องมีที่อุ่นน้ำคู่ขนานไปกับ mash"],
    ["ตะแกรง / false bottom / ถุง BIAB", "ตรวจว่าไม่ตัน ไม่รั่ว"],
    ["ท่อ / ก๊อก / ปั๊มสำหรับ runoff", "ถ้าใช้ระบบหลายภาชนะ"],
    ["ภาชนะรองน้ำเวิร์ต", "ความจุพอสำหรับ pre-boil volume"],
    ["Refractometer หรือ hydrometer", "ตรวจ gravity ก่อนต้ม"],
  ]),
  d("ต้ม (Boil)", "Rolling boil 60–90 นาที เติม hops ตาม schedule", [
    ["Kettle ขนาดพอ", "ความจุอย่างน้อย batch + boil-off + เผื่อ 20% กันล้น"],
    ["ความร้อนพอสำหรับ rolling boil", "เช็กเชื้อเพลิง / กำลังไฟ และทดสอบเตาก่อน"],
    ["Hop bag / spider / ตะแกรงกรอง hops"],
    ["Timer เตือนเวลาเติม hops", "ตั้งเตือนแยกทุก addition"],
    ["ช้อนหรือพายยาว", "sanitize ส่วนที่จะลงเวิร์ตหลังต้ม"],
    ["ขวดสเปรย์น้ำ", "ฉีดลดฟองกัน boil-over (ไม่บังคับ)"],
    ["ปั๊มหรือช้อนสำหรับ whirlpool", "ถ้าทำ hop stand"],
  ]),
  d("ทำให้เย็น (Chill)", "ลดอุณหภูมิเวิร์ตให้ถึงช่วง pitch ยีสต์ ale ประมาณ 18–22°C โดยเร็ว", [
    ["Wort chiller (immersion / counterflow / plate)", "sanitize ใน 10–15 นาทีสุดท้ายของการต้ม"],
    ["ท่อน้ำ + ข้อต่อ ครบและไม่รั่ว", "ลองต่อน้ำก่อนวันต้ม"],
    ["น้ำเย็นหรือน้ำแข็งสำรอง", "ใช้ ice bath เสริมถ้าน้ำก๊อกไม่เย็นพอ"],
    ["เทอร์โมมิเตอร์วัดเวิร์ต", "sanitize ก่อนจุ่ม"],
  ]),
  d("ถ่ายลง Fermenter และ Pitch", "ขั้นที่เสี่ยงติดเชื้อที่สุด ทุกอย่างที่แตะเวิร์ตต้อง sanitize", [
    ["Fermenter ล้างและ sanitize แล้ว", "ความจุ batch + headspace อย่างน้อย 20%"],
    ["ท่อถ่าย / auto-siphon / ปั๊ม", "มีท่อสำรองหนึ่งเส้น"],
    ["Test jar + hydrometer หรือ refractometer", "วัด OG แล้วจดค่า"],
    ["ระบบเติมอากาศหรือออกซิเจน", "หินออกซิเจน + ถัง O₂ หรือเขย่า / กวนเวิร์ต"],
    ["ถ้วยหรือภาชนะ sanitize สำหรับ rehydrate ยีสต์", "ตามวิธีบนซองยีสต์"],
    ["ฝา + airlock หรือ blow-off tube + grommet", "เตรียมคู่สำรองไว้"],
    ["ป้ายติด fermenter / ปากกา / สมุดบันทึก", "จดวันที่ OG ชนิดยีสต์"],
  ]),
  d("หมัก (Ferment)", "คุมอุณหภูมิให้นิ่งตามสายพันธุ์ยีสต์ วัด FG ซ้ำสองวันติดกันก่อนถือว่าหมักจบ", [
    ["ระบบคุมอุณหภูมิ", "ตู้เย็น + temp controller, เข็มขัดความร้อน หรือถังแช่น้ำ"],
    ["โพรบอุณหภูมิติดที่ผนัง fermenter", "หุ้มฉนวนเพื่ออ่านค่าใกล้ของเหลวจริง"],
    ["ที่วางไม่โดนแสงแดดและความร้อนผันผวน"],
    ["อุปกรณ์เก็บตัวอย่าง (thief หรือก๊อกตัวอย่าง)", "sanitize ทุกครั้ง"],
    ["ถุงหรือตะแกรงสำหรับ dry hop", "ถ้า recipe ใช้ (ไม่บังคับ)"],
    ["Hydrometer / refractometer สำหรับวัด FG"],
  ]),
  d("Cold Crash และเตรียมถ่ายลง Keg", "ลดอุณหภูมิให้ตกตะกอน ประมาณ 0–4°C ก่อนถ่าย", [
    ["พื้นที่เย็นพอสำหรับ cold crash", "ตู้เย็น / kegerator ที่วาง fermenter ได้"],
    ["ท่อ silicone สำหรับ closed transfer", "สะอาดและ sanitize แล้ว ยาวพอ"],
    ["ข้อต่อ liquid post / gas post ที่ตรงกับ keg", "ball lock หรือ pin lock ให้ตรงชุด"],
    ["ถัง CO₂ เหลือพอ", "เช็กน้ำหนักถังหรือแรงดันก่อนวันถ่าย"],
  ]),
  d("ลง Keg", "ไล่ออกซิเจนออกจาก keg ก่อนถ่ายเพื่อให้เบียร์อยู่ได้นาน", [
    ["Keg ล้างและ sanitize แล้ว", "ความจุไม่น้อยกว่าปริมาณ batch"],
    ["O-ring / poppet / dip tube อยู่ในสภาพดี", "ยางแตก บวม หรือแข็งให้เปลี่ยนก่อน"],
    ["Keg lube (food grade)", "ทาบาง ๆ ที่ O-ring ฝา"],
    ["ถัง CO₂ + regulator + เกจ ใช้งานได้", "ทดสอบรั่วด้วยน้ำสบู่ที่ข้อต่อทุกจุด"],
    ["สาย gas + gas disconnect"],
    ["liquid disconnect + สายเบียร์ + faucet หรือ picnic tap", "ถ้าจะ serve ต่อทันที"],
    ["Pressure relief valve (PRV) ใช้งานได้", "ดึงเบา ๆ ดูว่าเปิดปิดได้"],
    ["Purge keg ด้วย CO₂", "ไล่อากาศก่อนถ่ายและหลังปิดฝา"],
    ["Spunding valve", "ถ้าทำ pressure fermentation (ไม่บังคับ)"],
    ["ตาราง carbonation", "ตั้ง PSI ตามอุณหภูมิและ volumes CO₂ เป้าหมาย เช่น ประมาณ 2.4 vol"],
    ["ป้ายติด keg / ปากกา", "ชื่อ batch และวันที่ลง keg"],
  ]),
];
