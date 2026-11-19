# Kho cấu hình máy in KHA (GitHub Pages)

Trang công khai **chỉ chứa tệp cấu hình máy in (.khd)** đã ký + mã hóa – **không có firmware, không có mã nguồn**.
Firmware gốc được KHA nạp sẵn trước khi giao thiết bị (công cụ nội bộ `kha-tools/flasher`).

- Địa chỉ: https://bthanhkha.github.io/kha-flasher/
- Thiết bị (firmware ≥ 1.8.3) tải trực tiếp: `configs/index.json` + `configs/<id>.khd`

## Cập nhật kho
1. Thêm/sửa cấu hình trong `kha-tools/profiles/` (đặt `"public": false` nếu không muốn đăng công khai).
2. `python kha-tools/khd_tool.py web` (hoặc menu số 6) → tạo lại thư mục `configs/`.
3. Tải thư mục `configs/` lên repo (ghi đè).
