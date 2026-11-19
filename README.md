# KHA Firmware – trang nạp firmware trên trình duyệt

Trang tĩnh (HTML + JS), chạy miễn phí trên **GitHub Pages**. Nạp firmware ESP32 qua cổng COM bằng Web Serial (Chrome / Edge), dùng thư viện esptool-js (Apache-2.0) của Espressif.

## Đưa lên mạng (một lần)
1. GitHub → **New repository** → tên `kha-flasher` → **Public** → Create.
2. Trong repo vừa tạo, chọn **uploading an existing file** → kéo **toàn bộ nội dung** thư mục này (index.html, style.css, catalog.json, các thư mục js/, firmware/) → **Commit changes**.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, thư mục **/(root)** → Save.
4. Sau 1-2 phút trang chạy tại: `https://bthanhkha.github.io/kha-flasher/`

## Cập nhật firmware mới
`python ../kha-tools/flasher_publish.py 1.8.3` (sau khi build) → tải lại các tệp trong `firmware/kha-printer/` và `catalog.json` lên repo.

## Thêm firmware khác
Thêm thư mục `firmware/<tên>/` và một mục trong `catalog.json` (`parts`: danh sách tệp + địa chỉ nạp).
