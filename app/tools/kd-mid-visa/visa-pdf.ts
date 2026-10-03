export type VisaPdfApplicant = {
  surname: string;
  givenNames: string;
  birthDate: string;
  birthPlace: string;
  sex: string;
  passportNo: string;
  passportIssue: string;
  passportExpiry: string;
  phone: string;
  email: string;
  position: string;
  routeCity: string;
  hadFormerRussianCitizenship: boolean;
  formerCitizenshipLostDate: string;
  formerCitizenshipLossReason: string;
  visitedRussia: boolean;
  visitsCount: string;
  lastVisitFrom: string;
  lastVisitTo: string;
  hasInsurance: boolean;
  insurancePolicy: string;
  applicationId: string;
};

export type VisaPdfCommon = {
  citizenship: string;
  purpose: string;
  visaType: string;
  entries: string;
  entryDate: string;
  exitDate: string;
  organization: string;
  organizationAddress: string;
  tin: string;
  telex: string;
  invitation: string;
  city: string;
  embassy: string;
  employer: string;
  employerAddress: string;
  employerEmail: string;
  defaultPosition: string;
};

export const visaConsulates = [
  { value: "ПОСОЛЬСТВО РФ ВО ВЬЕТНАМЕ", label: "Đại sứ quán Liên bang Nga tại Hà Nội" },
  { value: "ГЕНКОНСУЛЬСТВО РФ В ДАНАНГЕ", label: "Tổng Lãnh sự quán Liên bang Nga tại Đà Nẵng" },
  { value: "ГЕНКОНСУЛЬСТВО РФ В ХОШИМИНЕ", label: "Tổng Lãnh sự quán Liên bang Nga tại TP. Hồ Chí Minh" },
] as const;

const PAGE_W_PT = 595;
const PAGE_H_PT = 842;
const DPI = 200;
const S = DPI / 72;
const GRAY = "#d8d8d8";
const FONT = '"Lucida Console", Consolas, "Courier New", monospace';
const FIXED_ADDRESS = "ВЬЕТНАМ, Г. ХАНОЙ, УЛИЦА НГИА ДО, ДОРОГА ХОАНГ КУОК ВЬЕТ, ДОМ Ш9";
const FIXED_WORK_PHONE = "+842437555706";

type DrawTextOptions = {
  size?: number;
  align?: CanvasTextAlign;
  maxWidthPt?: number;
};

function px(pt: number) {
  return pt * S;
}

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PAGE_W_PT * S);
  canvas.height = Math.round(PAGE_H_PT * S);
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Không thể khởi tạo Canvas để tạo PDF.");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "top";
  ctx.imageSmoothingEnabled = true;
  return { canvas, ctx };
}

function setFont(ctx: CanvasRenderingContext2D, size = 8) {
  ctx.font = `${px(size)}px ${FONT}`;
  ctx.fillStyle = "#000";
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: DrawTextOptions = {},
) {
  const size = options.size ?? 8;
  setFont(ctx, size);
  ctx.textAlign = options.align ?? "left";
  if (options.maxWidthPt) {
    ctx.fillText(text, px(x), px(y), px(options.maxWidthPt));
  } else {
    ctx.fillText(text, px(x), px(y));
  }
  ctx.textAlign = "left";
}

function drawGray(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = GRAY;
  ctx.fillRect(px(x), px(y), px(w), px(h));
}

function strokeRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, widthPt = 0.24) {
  ctx.strokeStyle = "#000";
  ctx.lineWidth = px(widthPt);
  ctx.strokeRect(px(x), px(y), px(w), px(h));
}

function drawWrapped(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidthPt: number,
  lineHeightPt = 8,
  size = 8,
) {
  setFont(ctx, size);
  const maxWidth = px(maxWidthPt);
  const tokens = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);

  lines.forEach((item, index) => {
    ctx.fillText(item, px(x), px(y + index * lineHeightPt));
  });
  return lines.length;
}

function formatMoscowNow() {
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(now);
  const timeParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Moscow",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const pick = (parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const date = `${pick(dateParts, "day")}.${pick(dateParts, "month")}.${pick(dateParts, "year")}`;
  const time = `${pick(timeParts, "hour")}:${pick(timeParts, "minute")}:${pick(timeParts, "second")}`;
  return { date, time };
}

function applicationNumber(applicant: VisaPdfApplicant) {
  const value = applicant.applicationId.trim();
  return /^\d{6,12}$/.test(value) ? value : "";
}

function drawPseudoBarcode(ctx: CanvasRenderingContext2D, id: string) {
  if (!id) return;
  const source = `20002${id}`;
  const x = 39.2;
  const y = 585.08;
  const w = 40.8;
  const h = 131.92;
  const rows: number[] = [2, 1, 2, 1, 1, 2, 1, 1];
  for (const char of source) {
    const code = char.charCodeAt(0);
    rows.push(
      1 + (code & 1),
      1,
      1 + ((code >> 1) & 1),
      1,
      1 + ((code >> 2) & 1),
      1,
    );
  }
  rows.push(2, 1, 2, 1, 2);
  const unit = h / rows.reduce((sum, item) => sum + item, 0);
  let cy = y;
  let black = true;
  ctx.fillStyle = "#000";
  for (const units of rows) {
    const rh = unit * units;
    if (black) ctx.fillRect(px(x), px(cy), px(w), Math.max(1, px(rh)));
    cy += rh;
    black = !black;
  }
}

function drawPageOne(applicant: VisaPdfApplicant, common: VisaPdfCommon) {
  const { canvas, ctx } = makeCanvas();
  const { date, time } = formatMoscowNow();
  const appId = applicationNumber(applicant);
  const consulate = common.embassy || visaConsulates[0].value;

  const grayRects = [
    [19.86, 48, 199.8, 27.2],
    [19.86, 81.84, 199.8, 11.2],
    [19.86, 99.68, 199.8, 19.2],
    [19.86, 125.52, 199.8, 11.2],
    [19.86, 143.36, 199.8, 11.2],
    [19.86, 161.2, 199.8, 11.2],
    [19.86, 221.64, 199.8, 11.2],
    [19.86, 239.48, 199.8, 11.2],
    [19.86, 257.32, 199.8, 11.2],
    [19.86, 275.16, 199.8, 11.2],
    [19.86, 293, 199.8, 19.2],
    [19.86, 389.84, 199.8, 11.2],
    [19.86, 558.42, 555.14, 14.16],
  ] as const;
  grayRects.forEach(([x, y, w, h]) => drawGray(ctx, x, y, w, h));

  strokeRect(ctx, 89.34, 575.46, 99.18, 127.56, 0.72);
  strokeRect(ctx, 19.86, 736.98, 199.86, 69.48, 1);
  strokeRect(ctx, 219.72, 558.42, 355.28, 248.04, 0.24);
  strokeRect(ctx, 219.72, 678.9, 355.28, 14.16, 0.24);
  strokeRect(ctx, 19.86, 558.42, 199.86, 248.04, 0.24);

  drawText(ctx, "ПЕЧАТНАЯ ФОРМА ЭЛЕКТРОННОЙ ВИЗОВОЙ АНКЕТЫ", 20, 19.4, { size: 14 });

  const staticLines: Array<[number, number, string]> = [
    [23.86, 49.66, "1. Гражданство (Если вы имели"],
    [23.86, 57.66, "гражданство СССР или России, то когда и"],
    [23.86, 65.66, "в связи с чем его утратили?)."],
    [23.86, 83.5, "2. Фамилия (согласно паспорту)."],
    [23.86, 101.34, "3. Имя, другие имена, отчество"],
    [23.86, 109.34, "(согласно паспорту)."],
    [23.86, 127.18, "4. Дата рождения (дд/мм/гггг)."],
    [23.86, 145.02, "5. Пол."],
    [23.86, 162.86, "6. Паспортные данные."],
    [143.42, 177.06, "Номер паспорта:"],
    [114.52, 191.26, "Дата выдачи паспорта:"],
    [100.08, 205.46, "Паспорт действителен до:"],
    [23.86, 223.3, "7. Цель въезда."],
    [23.86, 241.14, "8. Категория и вид визы."],
    [23.86, 258.98, "9. Кратность визы."],
    [23.86, 276.82, "10. Даты въезда и выезда из России."],
    [23.86, 294.66, "11. В какое учреждение Вы"],
    [23.86, 302.66, "направляетесь?"],
    [172.32, 316.86, "Компания:"],
    [196.4, 331.06, "ИНН:"],
    [148.24, 345.26, "№ приглашения:"],
    [162.68, 359.46, "№ указания:"],
    [186.76, 373.66, "Адрес:"],
    [23.86, 391.5, "12. Маршрут (населенные пункты)."],
    [24, 562.08, "Фотография и подпись."],
    [223.72, 562.08, "Служебная информация (формируется автоматически)."],
    [117.26, 630.9, "Место для"],
    [114.85, 638.9, "фотографии"],
    [40.33, 727.64, "Дата (дд/мм/гггг), личная подпись"],
    [320.6, 578.64, "Получатель анкеты:"],
    [224.28, 603.44, "Основание (ваучер, № указ., № пригл.):"],
    [248.36, 615.84, "Предполагаемая дата визита в КЗУ:"],
    [315.79, 628.24, "№ заявления (сайт):"],
    [335.05, 640.64, "Дата обработки:"],
    [272.44, 653.04, "№ заявления (визовый центр):"],
    [257.99, 665.44, "Дата обработки визовым центром:"],
    [315.79, 682.56, "Номер заявки в КЗУ:"],
    [223.72, 698.32, "Я согласен, что мои персональные данные будут обработаны и переданы в"],
    [223.72, 707.92, "электронном виде для принятия решения о выдаче визы. Я заявляю, что"],
    [223.72, 717.52, "предоставленные мной в данной анкете сведения полные и достоверные. Я"],
    [223.72, 727.12, "осведомлён о том, что любые ложные сведения могут привести к отказу в"],
    [223.72, 736.72, "выдаче  визы  или  аннулированию  уже  выданной  визы,  а  также  другим"],
    [223.72, 746.32, "действиям, предусмотренным законодательством Российской Федерации. При"],
    [223.72, 755.92, "получении  визы  обязуюсь  покинуть  территорию  Российской  Федерации  в"],
    [223.72, 765.52, "течение срока действия визы. Я осведомлен о том, что наличие визы не"],
    [223.72, 775.12, "даёт права автоматического въезда на территорию Российской Федерации. В"],
    [223.72, 784.72, "случае отказа во въезде, мной не будет ставиться вопрос о компенсации"],
    [223.72, 794.32, "возможных потерь."],
    [502.76, 814.66, "Страница 1 из 2"],
  ];
  staticLines.forEach(([x, y, text]) => drawText(ctx, text, x, y));

  const invitation = common.invitation.trim() || "НЕТ";
  drawText(ctx, common.citizenship || "ВЬЕТНАМ", 229.66, 49.66);
  if (applicant.hadFormerRussianCitizenship) {
    drawText(ctx, `ДА, ${applicant.formerCitizenshipLostDate}`, 229.66, 57.66, { size: 7.6, maxWidthPt: 340 });
    drawText(ctx, applicant.formerCitizenshipLossReason, 229.66, 65.66, { size: 7.2, maxWidthPt: 340 });
  }
  const values: Array<[number, number, string]> = [
    [229.66, 83.5, applicant.surname.toUpperCase()],
    [229.66, 101.34, applicant.givenNames.toUpperCase()],
    [229.66, 127.18, applicant.birthDate],
    [229.66, 145.02, applicant.sex],
    [229.66, 177.06, applicant.passportNo.toUpperCase()],
    [229.66, 191.26, applicant.passportIssue],
    [229.66, 205.46, applicant.passportExpiry],
    [229.66, 223.3, common.purpose],
    [229.66, 241.14, common.visaType],
    [229.66, 258.98, common.entries],
    [229.66, 276.82, `${common.entryDate} - ${common.exitDate}`],
    [229.66, 316.86, common.organization],
    [229.66, 331.06, common.tin],
    [229.66, 345.26, invitation],
    [229.66, 359.46, common.telex],
    [229.66, 373.66, common.organizationAddress],
    [229.66, 391.5, applicant.routeCity.trim() || common.city],
  ];
  values.forEach(([x, y, text]) => drawText(ctx, text, x, y));

  const headerId = appId || "--------";
  drawText(ctx, `20002-${headerId} \\ ${date} ${time}`, 575, 21.17, { size: 9, align: "right" });
  drawText(ctx, consulate, 575, 30.17, { size: 9, align: "right" });

  drawText(ctx, consulate, 412, 578.64);
  drawText(ctx, common.telex, 412, 603.44);
  if (appId) drawText(ctx, appId, 412, 628.24);
  drawText(ctx, date, 412, 640.64);
  drawPseudoBarcode(ctx, appId);

  return canvas;
}

function pageTwoY(visited: boolean, insured: boolean) {
  const visitExtra = visited ? 22.2 : 0;
  const insuranceExtra = insured ? 22.2 : 0;
  return {
    sec17: 183.76 + visitExtra,
    sec17Text: 185.42 + visitExtra,
    sec17Question: 207.62 + visitExtra,
    sec17Policy: 0,
    sec18: 239.8 + visitExtra + insuranceExtra,
    sec18Text: 241.46 + visitExtra + insuranceExtra,
    sec19: 273.64 + visitExtra + insuranceExtra,
    sec19Text: 275.3 + visitExtra + insuranceExtra,
    sec20: 307.48 + visitExtra + insuranceExtra,
    sec20Text: 309.14 + visitExtra + insuranceExtra,
  };
}

function drawPageTwo(applicant: VisaPdfApplicant, common: VisaPdfCommon) {
  const { canvas, ctx } = makeCanvas();
  const y = pageTwoY(applicant.visitedRussia, applicant.hasInsurance);

  const headers: Array<[number, number, string[]]> = [
    [20, 19.2, ["13. Дети до 16 лет или другие", "родственники, вписанные в Ваш паспорт."]],
    [76.04, 27.2, ["14. Адрес Вашего постоянного проживания", "(почтовый код, город, улица, дом,", "квартира) телефон, факс, E-mail."]],
    [109.88, 11.2, ["15. Текущее/последнее место работы."]],
    [143.72, 19.2, ["16. Информация о предыдущих Ваших", "визитах в Россию."]],
    [y.sec17, 19.2, ["17. Информация о медицинском", "страховании."]],
    [y.sec18, 27.2, ["18. Другие когда-либо использовавшиеся", "Вами имена (до брака, псевдонимы,", "религиозные саны и т.д.)."]],
    [y.sec19, 27.2, ["19. Место рождения (если Вы родились в", "СССР или России, укажите когда и в", "какую страну эмигрировали)."]],
    [y.sec20, 19.2, ["20. Дополнительная информация о Ваших", "родственниках."]],
  ];

  headers.forEach(([top, height, lines]) => {
    drawGray(ctx, 19.86, top, 199.8, height);
    lines.forEach((line, index) => drawText(ctx, line, 23.86, top + 1.66 + index * 8));
  });

  drawText(ctx, "Следуют ли с Вами дети до 16 лет или", 42.28, 43.86);
  drawText(ctx, "другие родственники, вписанные в Ваш", 42.28, 51.86);
  drawText(ctx, "паспорт?", 177.13, 59.86);
  drawText(ctx, "НЕТ", 229.66, 43.86);

  const address = `${FIXED_ADDRESS}, ТЕЛ: ${applicant.phone}, EMAIL: ${applicant.email}`;
  drawWrapped(ctx, address, 229.66, 77.7, 345, 8, 8);

  const position = applicant.position.trim() || common.defaultPosition;
  const work = `${common.employer}, ${position}, ${common.employerAddress}, ТЕЛ: ${FIXED_WORK_PHONE}, EMAIL: ${common.employerEmail}`;
  drawWrapped(ctx, work, 229.66, 111.54, 345, 8, 8);

  drawText(ctx, "Сколько раз Вы были в России?", 76, 167.58);
  drawText(ctx, applicant.visitedRussia ? (applicant.visitsCount || "1") : "-", 229.66, 167.58);

  if (applicant.visitedRussia) {
    drawText(ctx, "Даты Вашей последней поездки в Россию", 37.47, 181.78);
    drawText(ctx, "(дд/мм/гггг):", 153.05, 189.78);
    drawText(ctx, `${applicant.lastVisitFrom} - ${applicant.lastVisitTo}`, 229.66, 181.78);
  }

  drawText(ctx, "Имеете ли Вы документ о медицинском", 47.1, y.sec17Question);
  drawText(ctx, "страховании, действительный на", 71.18, y.sec17Question + 8);
  drawText(ctx, "территории России?", 128.97, y.sec17Question + 16);
  drawText(ctx, applicant.hasInsurance ? "ДА" : "НЕТ", 229.66, y.sec17Question);

  if (applicant.hasInsurance) {
    const policyY = y.sec17Question + 30.2;
    drawText(ctx, "Название страховой компании и номер", 47.1, policyY);
    drawText(ctx, "полиса:", 181.95, policyY + 8);
    drawText(ctx, applicant.insurancePolicy, 229.66, policyY);
  }

  drawText(ctx, "НЕТ", 229.66, y.sec18Text);
  drawText(ctx, applicant.birthPlace, 229.66, y.sec19Text);

  drawText(ctx, "Имеете ли Вы в настоящее время", 71.18, y.sec20Text + 22.2);
  drawText(ctx, "родственников на территории России?", 47.1, y.sec20Text + 30.2);
  drawText(ctx, "НЕТ", 229.66, y.sec20Text + 22.2);

  drawText(ctx, "Страница 2 из 2", 502.76, 814.66);

  return canvas;
}

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) out[index] = binary.charCodeAt(index);
  return out;
}

function concatBytes(chunks: Uint8Array[]) {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function ascii(value: string) {
  return new TextEncoder().encode(value);
}

function buildImagePdf(images: Array<{ bytes: Uint8Array; width: number; height: number }>) {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;

  const append = (chunk: Uint8Array) => {
    chunks.push(chunk);
    length += chunk.length;
  };
  const appendText = (value: string) => append(ascii(value));

  const objectCount = 2 + images.length * 3;
  const pageIds = images.map((_, index) => 3 + index * 3);
  const imageIds = images.map((_, index) => 4 + index * 3);
  const contentIds = images.map((_, index) => 5 + index * 3);

  appendText("%PDF-1.4\n%KD-MID-VN\n");

  const beginObj = (id: number) => {
    offsets[id] = length;
    appendText(`${id} 0 obj\n`);
  };
  const endObj = () => appendText("\nendobj\n");

  beginObj(1);
  appendText("<< /Type /Catalog /Pages 2 0 R >>");
  endObj();

  beginObj(2);
  appendText(`<< /Type /Pages /Count ${images.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`);
  endObj();

  images.forEach((image, index) => {
    const pageId = pageIds[index];
    const imageId = imageIds[index];
    const contentId = contentIds[index];
    const imageName = `Im${index + 1}`;

    beginObj(pageId);
    appendText(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W_PT} ${PAGE_H_PT}] /Resources << /XObject << /${imageName} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    endObj();

    beginObj(imageId);
    appendText(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
    );
    append(image.bytes);
    appendText("\nendstream");
    endObj();

    const stream = `q\n${PAGE_W_PT} 0 0 ${PAGE_H_PT} 0 0 cm\n/${imageName} Do\nQ\n`;
    beginObj(contentId);
    appendText(`<< /Length ${ascii(stream).length} >>\nstream\n${stream}endstream`);
    endObj();
  });

  const xrefOffset = length;
  appendText(`xref\n0 ${objectCount + 1}\n`);
  appendText("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    appendText(`${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`);
  }
  appendText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return new Blob([concatBytes(chunks)], { type: "application/pdf" });
}

function safeFilename(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "VISA-APPLICATION";
}

export async function generateVisaApplicationPdf(applicant: VisaPdfApplicant, common: VisaPdfCommon) {
  const page1 = drawPageOne(applicant, common);
  const page2 = drawPageTwo(applicant, common);

  const page1Data = dataUrlToBytes(page1.toDataURL("image/jpeg", 0.96));
  const page2Data = dataUrlToBytes(page2.toDataURL("image/jpeg", 0.96));

  const blob = buildImagePdf([
    { bytes: page1Data, width: page1.width, height: page1.height },
    { bytes: page2Data, width: page2.width, height: page2.height },
  ]);

  const filename = `XINVISA-${safeFilename([applicant.surname, applicant.givenNames].filter(Boolean).join("-"))}.pdf`;
  return { blob, filename };
}

export function downloadVisaPdf(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
