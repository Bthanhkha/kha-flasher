// Kho cấu hình máy in KHA - chỉ hiển thị và cho tải tệp .khd (không có firmware)
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
document.querySelectorAll("#nav button").forEach((b) => (b.onclick = () => {
  document.querySelectorAll("#nav button").forEach((x) => x.classList.toggle("on", x === b));
  document.querySelectorAll("main > section").forEach((s) => s.classList.toggle("on", s.id === b.dataset.t));
}));
const FAM = { capt: "Canon CAPT", pcl: "PCL (HP, Brother…)" };
let list = [];
function render() {
  const q = $("q").value.trim().toLowerCase(), f = $("fam").value;
  const items = list.filter((c) => (!f || c.family === f) &&
    (!q || [c.name, c.id, ...(c.match.mdl || []), ...(c.match.pid || [])].join(" ").toLowerCase().includes(q)));
  $("cards").innerHTML = items.map((c) => {
    const ids = (c.match.pid || []).map((p) => `${(c.match.vid || ["?"])[0]}:${p}`).join(", ");
    return `<div class="card fw">
      <h3>${esc(c.name)}</h3>
      <div class="ver">v${esc(c.version)} <span class="tag">${esc(FAM[c.family] || c.family)}</span>${c.verified ? '<span class="tag f">Đã kiểm chứng</span>' : '<span class="tag">Thử nghiệm</span>'}</div>
      <p>${c.note ? esc(c.note) : "Dòng máy: " + esc((c.match.mdl || []).join(", ") || "theo ngôn ngữ in " + (c.match.cmd || []).join(", "))}</p>
      <div class="meta">${ids ? "USB ID: " + esc(ids) + " · " : ""}Tệp: ${esc(c.file)} (${c.size} byte)</div>
      <div class="row"><a class="btn" href="configs/${encodeURIComponent(c.file)}" download>Tải .khd</a></div>
    </div>`;
  }).join("") || '<p class="mut">Không có cấu hình phù hợp. Gửi Mã thiết bị và tên máy in cho KHA để được hỗ trợ.</p>';
}
fetch("configs/index.json", { cache: "no-cache" }).then((r) => r.json()).then((j) => {
  list = j.configs || [];
  const fams = [...new Set(list.map((c) => c.family))];
  $("fam").innerHTML = '<option value="">Mọi họ máy</option>' + fams.map((f) => `<option value="${esc(f)}">${esc(FAM[f] || f)}</option>`).join("");
  $("bundle").href = "configs/" + encodeURIComponent(j.bundle);
  $("upd").textContent = "Cập nhật: " + (j.updated || "");
  render();
}).catch((e) => { $("cards").innerHTML = '<p class="mut">Không tải được danh sách: ' + esc(e.message) + "</p>"; });
$("q").oninput = render;
$("fam").onchange = render;
