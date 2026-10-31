import type { WeekDay } from "./streak";

export interface ShareFacts {
  reviewed: number;
  knownPct: number;
  bestRun: number;
  time: string;
  streak: number | null;
  week: WeekDay[] | null;
  line: string;
  date: string;
}

const INK = "#14213D", RULED = "#2346B8", LINES = "#DCE5F5", MARGIN = "#C8372D", ACID = "#F5D90A";
const W = 1080, H = 1350;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** The finish card as a 4:5 PNG for Instagram stories and posts: a tilted index card on navy. */
export async function drawShareCard(f: ShareFacts): Promise<Blob | null> {
  try { await Promise.all([document.fonts.load("900 64px Archivo"), document.fonts.load("700 32px Archivo")]); } catch { /* system font */ }
  const goose = await loadImage("/goose.png");
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return null;
  const font = (weight: number, px: number) => `${weight} ${px}px Archivo, system-ui, sans-serif`;

  c.fillStyle = INK;
  c.fillRect(0, 0, W, H);

  // The card, tilted a little, with ruled lines and the red margin rule along the top.
  const cx = 90, cy = 150, cw = W - 180, ch = H - 330;
  c.save();
  c.translate(W / 2, H / 2 - 30);
  c.rotate(-0.025);
  c.translate(-W / 2, -(H / 2 - 30));
  c.fillStyle = "rgba(0,0,0,.35)";
  c.fillRect(cx + 14, cy + 18, cw, ch);
  c.fillStyle = "#fff";
  c.fillRect(cx, cy, cw, ch);
  c.fillStyle = LINES;
  for (let y = cy + 150; y < cy + ch - 20; y += 52) c.fillRect(cx, y, cw, 2);
  c.fillStyle = MARGIN;
  c.fillRect(cx, cy + 96, cw, 4);

  const left = cx + 64;
  c.fillStyle = INK;
  c.textBaseline = "alphabetic";
  c.font = font(700, 30);
  c.globalAlpha = 0.65;
  c.fillText(f.date, left, cy + 70);
  c.globalAlpha = 1;

  c.font = font(900, 250);
  const num = String(f.reviewed);
  c.fillText(num, left - 8, cy + 380);
  const numW = c.measureText(num).width;
  c.font = font(900, 54);
  c.fillText("cards", left + numW + 16, cy + 300);
  c.fillText("reviewed", left + numW + 16, cy + 362);

  // Three stats in a row.
  const stats: Array<[string, string]> = [["Known", `${f.knownPct}%`], ["Best run", String(f.bestRun)], ["Time", f.time]];
  const colW = (cw - 128) / 3;
  stats.forEach(([k, v], i) => {
    const x = left + i * colW;
    c.font = font(700, 28); c.globalAlpha = 0.65; c.fillText(k, x, cy + 480); c.globalAlpha = 1;
    c.font = font(900, 72); c.fillText(v, x, cy + 560);
  });

  if (f.streak !== null && f.week) {
    c.font = font(900, 64);
    const s = `${f.streak}-day streak`;
    c.fillStyle = RULED;
    c.fillText(s, left, cy + 700);
    const dot = 70, gap = (cw - 128 - dot * 7) / 6;
    f.week.forEach((d, i) => {
      const x = left + i * (dot + gap), y = cy + 740;
      c.beginPath();
      c.arc(x + dot / 2, y + dot / 2, dot / 2, 0, Math.PI * 2);
      c.fillStyle = d.done ? (d.today ? ACID : RULED) : "#fff";
      c.fill();
      c.lineWidth = 4;
      c.strokeStyle = d.today ? INK : d.done ? RULED : LINES;
      c.stroke();
      c.fillStyle = d.done && !d.today ? "#fff" : INK;
      c.font = font(900, 30);
      c.textAlign = "center";
      c.fillText(d.label, x + dot / 2, y + dot / 2 + 11);
      c.textAlign = "left";
    });
  }

  c.fillStyle = INK;
  c.font = font(700, 34);
  c.fillText(f.line, left, cy + ch - 60, cw - 128);
  c.restore();

  if (goose) {
    const gw = 280, gh = (goose.height / goose.width) * gw;
    c.save();
    c.translate(W - 120 - gw / 2, 120 + gh / 2);
    c.rotate(0.12);
    c.drawImage(goose, -gw / 2, -gh / 2, gw, gh);
    c.restore();
  }

  c.fillStyle = "#fff";
  c.textAlign = "center";
  c.font = font(900, 44);
  c.fillText("schwanki", W / 2, H - 80);
  c.font = font(700, 26);
  c.globalAlpha = 0.7;
  c.fillText("schwankiapp.com", W / 2, H - 40);
  c.globalAlpha = 1;
  c.textAlign = "left";

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/** Web Share with the image where the phone supports it; otherwise download it. */
export async function shareImage(blob: Blob, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], "schwanki-session.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return "shared"; }
    catch (e) { if (e instanceof DOMException && e.name === "AbortError") return "cancelled"; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = file.name;
  document.body.append(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "downloaded";
}
