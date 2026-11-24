/**
 * Converte os 4 Markdown de docs-tcc/ em DOCX (python-docx-like via `docx`)
 * e PDF (Chrome headless) com formatação ABNT-lite.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { marked } from "marked";
import puppeteer from "puppeteer-core";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  Header,
} from "docx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "entrega-final");
const DIAGRAMAS = path.join(ROOT, "diagramas");
const NAVY = "0F172A";
const NAVY_SOFT = "1E293B";
const WHITE = "FFFFFF";
const MUTED = "475569";
const A4_W = 11906;
const A4_H = 16838;
const MARGIN_TOP_LEFT = 1701; // 3 cm
const MARGIN_BOTTOM_RIGHT = 1134; // 2 cm
const CONTENT_WIDTH_PX = 605; // ~16 cm at 96 dpi
const MAX_IMG_HEIGHT_PX = 720;

const DOCS = [
  {
    md: "01_DESIGN_SYSTEM_PALETA_CORES.md",
    stem: "01_Design_System_FrotaMaq",
    subtitle: "Design System e paleta de cores",
    embedFigures: false,
  },
  {
    md: "02_DOCUMENTO_DE_REQUISITOS.md",
    stem: "02_Documento_de_Requisitos_FrotaMaq",
    subtitle: "Documento de requisitos (RF, RNF e regras de negócio)",
    embedFigures: false,
  },
  {
    md: "03_CASOS_DE_TESTE.md",
    stem: "03_Casos_de_Teste_FrotaMaq",
    subtitle: "Casos de teste funcionais e evidências automatizadas",
    embedFigures: false,
  },
  {
    md: "04_DOCUMENTACAO_TCC_FROTAMAQ.md",
    stem: "04_Monografia_TCC_FrotaMaq",
    subtitle: "Monografia — Trabalho de Conclusão de Curso",
    embedFigures: true,
  },
];

const FIGURES = [
  {
    file: "01_diagrama_casos_de_uso.png",
    caption:
      "Figura 1 — Diagrama de casos de uso do FrotaMaq. Casos autenticados incluem obrigatoriamente Fazer Login.",
  },
  {
    file: "02_diagrama_sequencia.png",
    caption:
      "Figura 2 — Diagrama de sequência: ordem de serviço, aprovação de viagem, cálculo ESG e checagem RLS.",
  },
  {
    file: "03_diagrama_classes.png",
    caption:
      "Figura 3 — Diagrama de classes do domínio. RegistroESG e Alerta são conceitos calculados/derivados, não tabelas.",
  },
  {
    file: "04_diagrama_atividade.png",
    caption:
      "Figura 4 — Diagrama de atividade da solicitação e decisão de viagem.",
  },
  {
    file: "05_diagrama_banco_er.png",
    caption:
      "Figura 5 — Diagrama entidade-relacionamento do PostgreSQL/Supabase. EMPRESA = empresas; USUARIO = usuarios; VEICULO = veiculos; OS = manutencoes; RESERVA = reservas; CONVITE = chaves_convite; RELAT = solicitacoes_relatorio; AUDIT = audit_logs. Não existem tabelas abastecimentos nem emissoes.",
  },
];

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error("Chrome/Edge não encontrado para gerar PDF.");
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function extractText(token) {
  if (!token) return "";
  if (typeof token === "string") return token;
  if (token.text && !token.tokens) return token.text;
  if (token.tokens) return token.tokens.map(extractText).join("");
  if (token.items) return token.items.map(extractText).join(" ");
  return token.raw ? String(token.raw).replace(/[*_`#]/g, "") : "";
}

function inlineRuns(tokens = [], extras = {}) {
  const runs = [];
  for (const t of tokens) {
    switch (t.type) {
      case "text":
        runs.push(new TextRun({ text: (t.text || "").replace(/\s*\n\s*/g, " "), ...extras }));
        break;
      case "strong":
        runs.push(
          ...inlineRuns(t.tokens || [{ type: "text", text: t.text || "" }], { ...extras, bold: true }),
        );
        break;
      case "em":
        runs.push(
          ...inlineRuns(t.tokens || [{ type: "text", text: t.text || "" }], { ...extras, italics: true }),
        );
        break;
      case "codespan":
        runs.push(
          new TextRun({
            text: t.text || "",
            font: "Consolas",
            size: extras.size ? extras.size : 20,
            color: NAVY_SOFT,
            ...extras,
          }),
        );
        break;
      case "link":
        runs.push(
          new TextRun({
            text: extractText(t) || t.href || "",
            color: "2563EB",
            underline: {},
            ...extras,
          }),
        );
        break;
      case "br":
        runs.push(new TextRun({ break: 1 }));
        break;
      case "escape":
      case "html":
        runs.push(new TextRun({ text: t.text || "", ...extras }));
        break;
      case "image":
        break;
      default:
        if (t.tokens) runs.push(...inlineRuns(t.tokens, extras));
        else if (t.text) runs.push(new TextRun({ text: t.text, ...extras }));
    }
  }
  return runs.length ? runs : [new TextRun({ text: "", ...extras })];
}

function headingLevel(depth) {
  if (depth <= 1) return HeadingLevel.HEADING_1;
  if (depth === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

function thinBorders() {
  const b = { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" };
  return { top: b, bottom: b, left: b, right: b };
}

function makeTable(header, rows) {
  const colCount = Math.max(header.length, ...rows.map((r) => r.length), 1);
  const width = Math.floor(10000 / colCount);
  const toRow = (cells, isHeader) =>
    new TableRow({
      tableHeader: isHeader,
      children: Array.from({ length: colCount }, (_, i) => {
        const cellTokens = cells[i] || [];
        return new TableCell({
          width: { size: width, type: WidthType.PERCENTAGE },
          shading: isHeader
            ? { type: ShadingType.CLEAR, fill: NAVY, color: NAVY }
            : { type: ShadingType.CLEAR, fill: i % 2 === 0 ? "F8FAFC" : WHITE },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 60, bottom: 60, left: 80, right: 80 },
          borders: thinBorders(),
          children: [
            new Paragraph({
              spacing: { line: 276, lineRule: "auto", after: 0, before: 0 },
              children: inlineRuns(cellTokens, {
                bold: isHeader,
                color: isHeader ? WHITE : NAVY,
                size: 18,
                font: "Calibri",
              }),
            }),
          ],
        });
      }),
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: colCount }, () => Math.floor(9360 / colCount)),
    rows: [toRow(header, true), ...rows.map((r) => toRow(r, false))],
  });
}

function makeFigure(absPath, caption) {
  const buf = fs.readFileSync(absPath);
  const { width, height } = pngSize(buf);
  let w = CONTENT_WIDTH_PX;
  let h = Math.round((height / width) * w);
  if (h > MAX_IMG_HEIGHT_PX) {
    h = MAX_IMG_HEIGHT_PX;
    w = Math.round((width / height) * h);
  }
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 240, after: 80 },
      keepNext: true,
      children: [
        new ImageRun({
          type: "png",
          data: buf,
          transformation: { width: w, height: h },
          altText: { title: caption, description: caption, name: path.basename(absPath) },
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 280, line: 276, lineRule: "auto" },
      children: [
        new TextRun({
          text: caption,
          italics: true,
          size: 18,
          color: MUTED,
          font: "Calibri",
        }),
      ],
    }),
  ];
}

function isFigureIndexTable(headerCells) {
  const head = headerCells.map((c) => extractText({ tokens: c }).toLowerCase()).join(" ");
  return head.includes("figura") && (head.includes("arquivo") || head.includes("png"));
}

function tokensToDocx(tokens, { embedFigures }) {
  const children = [];
  let skipNextHr = true;
  let figuresInserted = false;
  let skippedFirstH1 = false;
  const hasMdImages = tokens.some(
    (t) =>
      t.type === "paragraph" &&
      (t.tokens || []).some((x) => x.type === "image" && /diagrama_/.test(x.href || "")),
  );
  let i = 0;

  const pushParagraph = (token, extra = {}) => {
    const img = (token.tokens || []).find((t) => t.type === "image");
    if (img) {
      const href = img.href.startsWith("http") ? null : path.resolve(ROOT, img.href);
      if (href && fs.existsSync(href)) {
        children.push(...makeFigure(href, img.text || img.href));
        return;
      }
    }
    children.push(
      new Paragraph({
        spacing: { line: 360, lineRule: "auto", after: 160 },
        ...extra,
        children: inlineRuns(token.tokens || [{ type: "text", text: extractText(token) }]),
      }),
    );
  };

  while (i < tokens.length) {
    const token = tokens[i];
    switch (token.type) {
      case "space":
        break;
      case "hr":
        if (!skipNextHr) {
          children.push(
            new Paragraph({
              spacing: { before: 120, after: 120 },
              border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "E2E8F0", space: 1 } },
              children: [new TextRun("")],
            }),
          );
        }
        skipNextHr = false;
        break;
      case "heading": {
        const text = extractText(token);
        if (token.depth === 1 && !skippedFirstH1) {
          skippedFirstH1 = true;
          break;
        }
        const isChapter =
          /^capítulo\s+\d/i.test(text) || /^referências/i.test(text) || /^resumo$/i.test(text);
        children.push(
          new Paragraph({
            heading: headingLevel(token.depth),
            spacing: { before: token.depth === 1 ? 0 : 280, after: 160, line: 276, lineRule: "auto" },
            pageBreakBefore: isChapter && token.depth === 2 && children.length > 4,
            children: inlineRuns(token.tokens || [{ type: "text", text }]),
          }),
        );
        skipNextHr = false;
        break;
      }
      case "paragraph":
        pushParagraph(token);
        break;
      case "blockquote":
        for (const inner of token.tokens || []) {
          if (inner.type === "paragraph") {
            pushParagraph(inner, {
              indent: { left: 420 },
              border: { left: { style: BorderStyle.SINGLE, size: 12, color: "2563EB", space: 8 } },
            });
          }
        }
        break;
      case "code":
        children.push(
          new Paragraph({
            shading: { type: ShadingType.CLEAR, fill: "F1F5F9" },
            spacing: { before: 120, after: 200, line: 276, lineRule: "auto" },
            children: (token.text || "").split("\n").flatMap((line, idx, arr) => [
              new TextRun({
                text: line || " ",
                font: "Consolas",
                size: 18,
                color: NAVY,
              }),
              ...(idx < arr.length - 1 ? [new TextRun({ break: 1 })] : []),
            ]),
          }),
        );
        break;
      case "list": {
        const walk = (items, level) => {
          for (const item of items) {
            const first = (item.tokens || []).find((t) => t.type === "paragraph");
            children.push(
              new Paragraph({
                numbering: { reference: token.ordered ? "num-list" : "bullets", level: Math.min(level, 2) },
                spacing: { line: 360, lineRule: "auto", after: 80 },
                children: inlineRuns(first?.tokens || [{ type: "text", text: extractText(item) }]),
              }),
            );
            const nested = (item.tokens || []).filter((t) => t.type === "list");
            for (const n of nested) walk(n.items || [], level + 1);
          }
        };
        walk(token.items || [], 0);
        break;
      }
      case "table": {
        const header = (token.header || []).map((c) => c.tokens || [{ type: "text", text: c.text || "" }]);
        const rows = (token.rows || []).map((row) =>
          row.map((c) => c.tokens || [{ type: "text", text: c.text || "" }]),
        );
        children.push(makeTable(header, rows));
        children.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
        if (embedFigures && !figuresInserted && !hasMdImages && isFigureIndexTable(header)) {
          for (const fig of FIGURES) {
            children.push(...makeFigure(path.join(DIAGRAMAS, fig.file), fig.caption));
          }
          figuresInserted = true;
        }
        break;
      }
      default:
        if (token.tokens) {
          /* skip nested wrappers */
        } else if (token.text) {
          children.push(
            new Paragraph({
              spacing: { line: 360, lineRule: "auto", after: 160 },
              children: [new TextRun({ text: token.text })],
            }),
          );
        }
    }
    i += 1;
  }

  if (embedFigures && !figuresInserted && !hasMdImages) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun("Figuras da modelagem")],
      }),
    );
    for (const fig of FIGURES) {
      children.push(...makeFigure(path.join(DIAGRAMAS, fig.file), fig.caption));
    }
  }
  return children;
}

function coverParagraphs(title, subtitle) {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [new TextRun({ text: "FROTAMAQ", bold: true, size: 21, color: "2563EB", font: "Calibri" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Trabalho de Conclusão de Curso — Documentação técnica",
          italics: true,
          size: 20,
          color: MUTED,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 120, line: 276, lineRule: "auto" },
      children: [new TextRun({ text: title.replace(/^#\s+/, ""), bold: true, size: 36, color: NAVY, font: "Calibri" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 280 },
      children: [new TextRun({ text: subtitle, size: 22, color: NAVY_SOFT, font: "Calibri" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: "Gabriel Felipe Spohn · Gustavo Henrique da Silva · Lucas Eduardo de Lima",
          size: 20,
          color: NAVY,
          font: "Calibri",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "2563EB", space: 8 } },
      children: [new TextRun({ text: "Cascavel, Paraná — 2026", size: 20, color: MUTED, font: "Calibri" })],
    }),
  ];
}

async function writeDocx(spec, md, tokens) {
  const title = (md.match(/^#\s+(.+)$/m) || [, spec.stem])[1];
  const doc = new Document({
    creator: "FrotaMaq TCC",
    title,
    description: spec.subtitle,
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: NAVY },
          paragraph: { spacing: { line: 360, lineRule: "auto" } },
        },
        heading1: {
          run: { font: "Calibri", size: 32, bold: true, color: NAVY },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 },
        },
        heading2: {
          run: { font: "Calibri", size: 26, bold: true, color: NAVY },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 1 },
        },
        heading3: {
          run: { font: "Calibri", size: 24, bold: true, color: NAVY_SOFT },
          paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 2 },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            { level: 0, format: "bullet", text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 180 } } } },
            { level: 1, format: "bullet", text: "–", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 180 } } } },
            { level: 2, format: "bullet", text: "○", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1020, hanging: 180 } } } },
          ],
        },
        {
          reference: "num-list",
          levels: [
            { level: 0, format: "decimal", text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 420, hanging: 180 } } } },
            { level: 1, format: "lowerLetter", text: "%2.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 180 } } } },
            { level: 2, format: "lowerRoman", text: "%3.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1020, hanging: 180 } } } },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: A4_W, height: A4_H },
            margin: {
              top: MARGIN_TOP_LEFT,
              left: MARGIN_TOP_LEFT,
              bottom: MARGIN_BOTTOM_RIGHT,
              right: MARGIN_BOTTOM_RIGHT,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "FrotaMaq · TCC 2026", italics: true, size: 16, color: MUTED, font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Página ", size: 16, color: MUTED, font: "Calibri" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: MUTED, font: "Calibri" }),
                ],
              }),
            ],
          }),
        },
        children: [...coverParagraphs(title, spec.subtitle), ...tokensToDocx(tokens, spec)],
      },
    ],
  });
  const outPath = path.join(OUT, `${spec.stem}.docx`);
  const buf = await Packer.toBuffer(doc);
  fs.writeFileSync(outPath, buf);
  return outPath;
}

function mdToHtml(md, spec) {
  const title = (md.match(/^#\s+(.+)$/m) || [, spec.stem])[1];
  let body = marked.parse(md, { gfm: true, breaks: false });
  if (spec.embedFigures && !body.includes("01_diagrama_casos_de_uso.png")) {
    const figs = FIGURES.map(
      (f) => `
      <figure>
        <img src="${pathToFileURL(path.join(DIAGRAMAS, f.file)).href}" alt="${f.caption}" />
        <figcaption>${f.caption}</figcaption>
      </figure>`,
    ).join("\n");
    body += figs;
  }
  body = body.replace(
    /<p><img src="([^"]+)" alt="([^"]*)"[^>]*><\/p>/g,
    `<figure><img src="$1" alt="$2" /><figcaption>$2</figcaption></figure>`,
  );
  body = body.replace(/<h1>[^<]*<\/h1>/, "");
  const base = pathToFileURL(ROOT).href + "/";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <base href="${base}" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 3cm 2cm 2cm 3cm; }
    * { box-sizing: border-box; }
    body {
      font-family: Calibri, Arial, Helvetica, sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #0f172a;
      margin: 0;
    }
    .cover { text-align: center; margin-bottom: 24pt; padding-bottom: 12pt; border-bottom: 2px solid #2563eb; }
    .cover .brand { color: #2563eb; font-weight: 700; letter-spacing: 0.08em; font-size: 11pt; }
    .cover h1 { font-size: 18pt; margin: 12pt 0 6pt; }
    .cover .sub { color: #1e293b; font-size: 12pt; }
    .cover .meta { color: #475569; font-size: 10pt; }
    h1 { font-size: 16pt; color: #0f172a; page-break-after: avoid; }
    h2 { font-size: 13pt; color: #0f172a; margin-top: 18pt; page-break-after: avoid; page-break-before: auto; }
    h2[id], h2 { }
    h3 { font-size: 12pt; color: #1e293b; page-break-after: avoid; }
    p { margin: 0 0 10pt; text-align: justify; }
    code, pre { font-family: Consolas, "Courier New", monospace; font-size: 9.5pt; }
    pre { background: #f1f5f9; padding: 10pt; border-radius: 4px; white-space: pre-wrap; page-break-inside: avoid; }
    table { width: 100%; border-collapse: collapse; margin: 8pt 0 14pt; font-size: 9.5pt; page-break-inside: auto; }
    th { background: #0f172a; color: #ffffff; text-align: left; padding: 6pt 8pt; font-weight: 700; }
    td { border: 0.5pt solid #cbd5e1; padding: 5pt 8pt; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    figure { margin: 14pt 0 18pt; page-break-inside: avoid; text-align: center; }
    figure img, img { display: block; max-width: 100%; height: auto; margin: 0 auto; }
    figcaption, .caption {
      display: block;
      text-align: center;
      font-size: 10pt;
      font-style: italic;
      color: #475569;
      margin: 8pt 8pt 0;
      line-height: 1.4;
    }
    hr { border: 0; border-top: 1px solid #e2e8f0; margin: 14pt 0; }
    a { color: #2563eb; }
    ul, ol { margin: 0 0 10pt; padding-left: 18pt; }
    blockquote { margin: 0 0 10pt; padding: 0 0 0 12pt; border-left: 3px solid #2563eb; color: #1e293b; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">FROTAMAQ</div>
    <div class="meta">Trabalho de Conclusão de Curso — Documentação técnica</div>
    <h1>${title}</h1>
    <div class="sub">${spec.subtitle}</div>
    <p class="meta">Gabriel Felipe Spohn · Gustavo Henrique da Silva · Lucas Eduardo de Lima</p>
    <p class="meta">Cascavel, Paraná — 2026</p>
  </div>
  ${body}
</body>
</html>`;
}

async function writePdf(browser, spec, md) {
  const htmlPath = path.join(OUT, `${spec.stem}.html`);
  const html = mdToHtml(md, spec);
  fs.writeFileSync(htmlPath, html, "utf8");
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle0", timeout: 120000 });
  const pdfPath = path.join(OUT, `${spec.stem}.pdf`);
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:8px; color:#64748b; width:100%; text-align:right; padding: 0 2cm 0 0; font-family: Calibri, Arial;">FrotaMaq · TCC 2026</div>`,
    footerTemplate: `<div style="font-size:8px; color:#64748b; width:100%; text-align:center; font-family: Calibri, Arial;">Página <span class="pageNumber"></span></div>`,
    margin: { top: "3cm", left: "3cm", bottom: "2cm", right: "2cm" },
  });
  await page.close();
  fs.unlinkSync(htmlPath);
  return pdfPath;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  marked.setOptions({ gfm: true, breaks: false });
  const chrome = findChrome();
  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=medium"],
  });
  const created = [];
  try {
    for (const spec of DOCS) {
      const mdPath = path.join(ROOT, spec.md);
      const md = fs.readFileSync(mdPath, "utf8");
      const tokens = marked.lexer(md);
      const docxPath = await writeDocx(spec, md, tokens);
      const pdfPath = await writePdf(browser, spec, md);
      const dstat = fs.statSync(docxPath);
      const pstat = fs.statSync(pdfPath);
      if (dstat.size < 4000) throw new Error(`DOCX muito pequeno: ${docxPath}`);
      if (pstat.size < 4000) throw new Error(`PDF muito pequeno: ${pdfPath}`);
      created.push({ docx: path.basename(docxPath), docxBytes: dstat.size, pdf: path.basename(pdfPath), pdfBytes: pstat.size });
      console.log(`OK  ${spec.stem}.docx (${dstat.size} bytes)  ${spec.stem}.pdf (${pstat.size} bytes)`);
    }
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(created, null, 2));
}

export { mdToHtml, DOCS };

const isDirectRun = process.argv[1] && path.normalize(process.argv[1]).includes("export-entrega");
if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
