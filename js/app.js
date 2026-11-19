// KHA Firmware - nạp firmware ESP32 trên trình duyệt (Web Serial + esptool-js)
import { ESPLoader, Transport } from "./esptool.js";

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hasSerial = "serial" in navigator;
if (!hasSerial) $("nosupport").hidden = false;

/* ---------- điều hướng ---------- */
document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => {
  document.querySelectorAll("#nav button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll("main > section").forEach((s) => s.classList.toggle("on", s.id === b.dataset.t));
}));
let mode = "lib";
document.querySelectorAll(".sub button").forEach((b) => (b.onclick = () => {
  mode = b.dataset.s;
  document.querySelectorAll(".sub button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll(".subpane").forEach((s) => s.classList.toggle("on", s.id === mode));
  updSel();
}));

/* ---------- nhật ký ---------- */
const logEl = $("log");
function log(s, cls) {
  const line = document.createElement("div");
  line.textContent = `[${new Date().toLocaleTimeString("vi-VN")}] ${s}`;
  if (cls) line.className = cls;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}
const term = {   // terminal cho esptool-js
  clean() {},
  writeLine(d) { log(d); },
  write(d) { if (d.trim()) log(d); },
};

/* ---------- kho firmware ---------- */
let catalog = [], selected = null;
async function loadCatalog() {
  try {
    const r = await fetch("catalog.json", { cache: "no-cache" });
    catalog = (await r.json()).firmware || [];
  } catch (e) {
    log("Không tải được danh sách firmware: " + e.message, "err");
  }
  const chips = [...new Set(catalog.map((f) => f.chip))];
  $("chip").innerHTML = '<option value="">Mọi dòng chip</option>' + chips.map((c) => `<option>${esc(c)}</option>`).join("");
  if (catalog.length) selected = catalog[0];
  render();
}
function render() {
  const q = $("q").value.trim().toLowerCase(), chip = $("chip").value;
  const list = catalog.filter((f) => (!chip || f.chip === chip) &&
    (!q || [f.name, f.desc, f.board, ...(f.tags || [])].join(" ").toLowerCase().includes(q)));
  $("cards").innerHTML = list.map((f) => `
    <div class="card fw ${selected === f ? "sel" : ""}" data-id="${esc(f.id)}">
      <h3>${esc(f.name)}</h3>
      <div class="ver">v${esc(f.version)} ${f.featured ? '<span class="tag f">Khuyên dùng</span>' : ""}${(f.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
      <p>${esc(f.desc)}</p>
      <div class="meta">Chip: <b>${esc(f.chip)}</b> · Mạch: ${esc(f.board)} · Flash ≥ ${esc(f.flash)} · PSRAM ${esc(f.psram || "-")}<br>${esc(f.notes || "")}</div>
    </div>`).join("") || '<p class="mut">Không có firmware phù hợp.</p>';
  document.querySelectorAll(".fw").forEach((c) => (c.onclick = () => {
    selected = catalog.find((f) => f.id === c.dataset.id);
    render();
  }));
  updSel();
}
$("q").oninput = render;
$("chip").onchange = render;
function updSel() {
  $("selName").textContent = mode === "own" ? "Tệp .bin riêng" : selected ? `${selected.name} (v${selected.version})` : "—";
}

/* ---------- tệp riêng ---------- */
function addRow(addr = "0x0") {
  const d = document.createElement("div");
  d.className = "ownrow";
  d.innerHTML = `<input type="file" accept=".bin"> địa chỉ <input type="text" value="${addr}"> <button class="btn g">Xóa</button>`;
  d.querySelector("button").onclick = () => d.remove();
  $("ownRows").appendChild(d);
}
$("addRow").onclick = () => addRow("0x10000");
addRow();

/* ---------- nạp ---------- */
const sizeMB = (s) => { const m = /^(\d+)(MB|KB)$/i.exec(s || ""); return m ? (m[2].toUpperCase() === "KB" ? m[1] / 1024 : +m[1]) : 0; };

async function collectFiles() {
  if (mode === "own") {
    const rows = [...document.querySelectorAll(".ownrow")];
    const out = [];
    for (const r of rows) {
      const f = r.querySelector("input[type=file]").files[0];
      if (!f) continue;
      const addr = parseInt(r.querySelector("input[type=text]").value, 16);
      if (isNaN(addr)) throw new Error("Địa chỉ không hợp lệ: " + r.querySelector("input[type=text]").value);
      out.push({ data: new Uint8Array(await f.arrayBuffer()), address: addr, name: f.name });
    }
    if (!out.length) throw new Error("Chưa chọn tệp .bin");
    return { files: out, chip: null, flash: null };
  }
  if (!selected) throw new Error("Chưa chọn firmware");
  const files = [];
  for (const p of selected.parts) {
    log(`Tải ${p.file} ...`);
    const r = await fetch(p.file, { cache: "no-cache" });
    if (!r.ok) throw new Error(`Không tải được ${p.file} (HTTP ${r.status})`);
    files.push({ data: new Uint8Array(await r.arrayBuffer()), address: parseInt(p.addr, 16), name: p.file.split("/").pop() });
  }
  return { files, chip: selected.chip, flash: selected.flash };
}

let busy = false;
$("go").onclick = async () => {
  if (busy || !hasSerial) return;
  if (monPort) { alert("Hãy ngắt Serial Monitor trước khi nạp."); return; }
  busy = true;
  $("go").disabled = true;
  $("bar").style.width = "0";
  $("barTxt").textContent = "";
  let transport;
  try {
    const job = await collectFiles();
    const total = job.files.reduce((a, f) => a + f.data.length, 0);
    $("stat").textContent = "Chọn cổng COM của mạch…";
    const port = await navigator.serial.requestPort();
    transport = new Transport(port, false);
    const loader = new ESPLoader({ transport, baudrate: +$("baud").value, romBaudrate: 115200, terminal: term });
    $("stat").textContent = "Đang kết nối chip…";
    const chip = await loader.main();
    log("Chip: " + chip, "ok");
    if (job.chip && !chip.toUpperCase().includes(job.chip.toUpperCase()))
      throw new Error(`Firmware dành cho ${job.chip}, mạch đang cắm là ${chip}`);
    const fs = await loader.detectFlashSize();
    log("Bộ nhớ flash: " + (fs || "không rõ"));
    if (job.flash && fs && sizeMB(fs) < sizeMB(job.flash))
      throw new Error(`Firmware cần flash ${job.flash}, mạch chỉ có ${fs}`);
    const erase = $("erase").checked;
    if (erase) log("Xóa toàn bộ flash (mất 10-30 giây)…");
    $("stat").textContent = "Đang nạp…";
    const done = new Array(job.files.length).fill(0);
    await loader.writeFlash({
      fileArray: job.files.map((f) => ({ data: f.data, address: f.address })),
      flashMode: "keep", flashFreq: "keep", flashSize: "keep",
      eraseAll: erase, compress: true,
      reportProgress: (i, w, t) => {
        done[i] = (w / t) * job.files[i].data.length;
        const pct = Math.round((done.reduce((a, b) => a + b, 0) / total) * 100);
        $("bar").style.width = pct + "%";
        $("barTxt").textContent = `${pct}% · ${job.files[i].name} @ 0x${job.files[i].address.toString(16)}`;
      },
    });
    $("bar").style.width = "100%";
    log("Nạp xong - khởi động lại thiết bị", "ok");
    await loader.after("hard_reset");
    $("stat").innerHTML = '<span class="ok">✔ Thành công! Thiết bị đang khởi động lại.</span>';
    $("barTxt").textContent = "Mở tab Serial Monitor để xem log, hoặc kết nối Wi-Fi KHA-Printer-xxxx (mật khẩu 12345678) → http://192.168.4.1";
  } catch (e) {
    const m = e && e.message ? e.message : String(e);
    if (/No port selected|cancel/i.test(m)) { $("stat").textContent = "Đã hủy chọn cổng"; }
    else {
      log("LỖI: " + m, "err");
      $("stat").innerHTML = `<span class="err">✘ ${esc(m)}</span>`;
      if (/connect|sync|timeout|Failed/i.test(m))
        log("Gợi ý: giữ nút BOOT, bấm RST/EN, thả BOOT rồi thử lại; hoặc giảm tốc độ nạp xuống 115200; kiểm tra driver CH340/CP210x.", "err");
    }
  } finally {
    try { if (transport) await transport.disconnect(); } catch (e) {}
    busy = false;
    $("go").disabled = false;
  }
};

/* ---------- Serial Monitor ---------- */
let monPort = null, monReader = null, monStop = false, monLog = "";
const ANSI = /\x1b\[[0-9;]*m/g;
let lineStart = true;
function termWrite(s) {
  s = s.replace(ANSI, "");
  if ($("mTime").checked) {
    let out = "";
    for (const ch of s) {
      if (lineStart && ch !== "\n") { out += `[${new Date().toLocaleTimeString("vi-VN")}] `; lineStart = false; }
      out += ch;
      if (ch === "\n") lineStart = true;
    }
    s = out;
  }
  monLog += s;
  if (monLog.length > 400000) monLog = monLog.slice(-300000);
  const t = $("term");
  t.textContent = monLog.slice(-120000);
  if ($("mScroll").checked) t.scrollTop = t.scrollHeight;
}
function monUi(on) {
  $("mConn").textContent = on ? "Ngắt kết nối" : "Kết nối";
  $("mReset").disabled = $("mIn").disabled = $("mSend").disabled = !on;
  $("mStat").textContent = on ? "● Đang kết nối" : "";
}
async function monOpen() {
  if (busy) return alert("Đang nạp firmware");
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: +$("mBaud").value, bufferSize: 65536 });
  monPort = port;
  monStop = false;
  monUi(true);
  try { await port.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (e) {}
  const dec = new TextDecoder();
  (async () => {
    while (monPort && !monStop && port.readable) {
      monReader = port.readable.getReader();
      try {
        while (true) {
          const { value, done } = await monReader.read();
          if (done) break;
          termWrite(dec.decode(value, { stream: true }));
        }
      } catch (e) {
        if (!monStop) termWrite(`\n[Mất kết nối: ${e.message}]\n`);
        break;
      } finally {
        monReader.releaseLock();
      }
    }
    await monClose();
  })();
}
async function monClose() {
  monStop = true;
  const p = monPort;
  monPort = null;
  try { if (monReader) await monReader.cancel(); } catch (e) {}
  try { if (p) await p.close(); } catch (e) {}
  monUi(false);
}
$("mConn").onclick = () => (monPort ? monClose() : monOpen().catch((e) => { if (!/No port/i.test(e.message)) alert(e.message); }));
$("mReset").onclick = async () => {   // EN qua RTS (mạch có mạch tự reset)
  if (!monPort) return;
  await monPort.setSignals({ dataTerminalReady: false, requestToSend: true });
  await new Promise((r) => setTimeout(r, 120));
  await monPort.setSignals({ dataTerminalReady: false, requestToSend: false });
  termWrite("\n[Đã khởi động lại thiết bị]\n");
};
$("mClear").onclick = () => { monLog = ""; $("term").textContent = ""; };
$("mSave").onclick = () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([monLog], { type: "text/plain" }));
  a.download = `kha-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
  a.click();
};
async function monSend() {
  if (!monPort || !monPort.writable) return;
  const eol = $("mEol").value.replace("\\r", "\r").replace("\\n", "\n");
  const w = monPort.writable.getWriter();
  await w.write(new TextEncoder().encode($("mIn").value + eol));
  w.releaseLock();
  $("mIn").value = "";
}
$("mSend").onclick = monSend;
$("mIn").onkeydown = (e) => { if (e.key === "Enter") monSend(); };

loadCatalog();
