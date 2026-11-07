# 📊 Finra Financial Dashboard (PTTC Duy Đạt)

Hệ thống Quản trị & Báo cáo Tài chính Phân tích Hợp đồng Huy động Vốn nội bộ (Finra & UPSC).

---

## 🏗️ Kiến trúc & Công nghệ

* **Backend**: ASP.NET Core 8.0 WebAPI, Dapper, Npgsql, MiniExcel (Streaming bulk import 12.600+ dòng chỉ trong ~7 giây), BCrypt.NET.
* **Database**: PostgreSQL 16 Alpine (Partitioning theo Batch, Index tối ưu truy vấn thời gian thực).
* **Storage**: MinIO Object Storage (Lưu trữ snapshot file Excel gốc).
* **Frontend**: React 19, TypeScript, Vite, Apache ECharts (`echarts-for-react`), Nginx Alpine.
* **Xác thực & Phân quyền**: JWT Access Token (60m) + Refresh Token xoay vòng (14 ngày), Phân quyền cấp dòng (Row-Level Security) theo Chi nhánh.

---

## 🚀 Khởi chạy Nhanh với Docker

### 1. Chuẩn bị biến môi trường
```bash
cd finance-dashboard
cp .env.example .env
```

### 2. Khởi chạy toàn bộ hệ sinh thái
```bash
docker compose up -d --build
```

### 3. Cổng dịch vụ (Port Bindings)
* **Giao diện người dùng (Frontend)**: [http://localhost:3000](http://localhost:3000)
* **Backend API Swagger**: [http://localhost:8080/swagger](http://localhost:8080/swagger)
* **PostgreSQL Database**: Host port `5433` (Database: `finra_finance`)
* **MinIO Console**: [http://localhost:9011](http://localhost:9011) (`minioadmin` / `minio_secret_pass_2026`)

---

## 🔑 Tài khoản Mặc định & Phân quyền

Chi tiết xem tại tài liệu: [`finance-dashboard/ACCOUNTS.md`](./finance-dashboard/ACCOUNTS.md)

| Vai trò | Tên đăng nhập | Mật khẩu | Quyền hạn |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Super Admin)** | `admin` | `admin123` | Toàn quyền: Xem tất cả chi nhánh, Import Excel, Quản lý & cấp tài khoản người dùng, đổi mật khẩu. |
| **Quản lý Chi nhánh (User)** | `sale_manager` | `password123` | Chỉ xem dữ liệu được gán tại `CN Hoàn Kiếm 1`, ẩn nút Import Excel và Quản lý người dùng. |

---

## 📈 Tính năng Nổi bật

1. **Dashboard KPI chuẩn**: 6 thẻ chỉ số tài chính (Doanh số, Dư nợ, Tỷ lệ hoàn thành chỉ tiêu, Book rate, Khách hàng mới...).
2. **Biểu đồ Kết hợp (Combo Chart)**: Xu hướng doanh số & số dư theo tuần.
3. **Phân tích Thống kê Đa chiều (Self-service BI)**:
   * Tùy chọn gom nhóm theo **Sản phẩm**, **Kỳ hạn**, **Chi nhánh**, **Kênh bán**, **Nhân viên Sale**.
   * Chu kỳ thời gian: **Ngày**, **Tuần**, **Tháng**, **Quý**.
   * Chuyển đổi tức thì giữa 4 chế độ View: **📋 Bảng tổng hợp**, **📊 Biểu đồ Cột**, **🥧 Biểu đồ Tròn/Donut**, **📈 Biểu đồ Đường xu hướng**.
   * Nút **📥 Xuất CSV**: Tải file báo cáo tiếng Việt chuẩn UTF-8 BOM về làm việc trên Excel.
4. **Quản lý Hợp đồng**: Bảng tra cứu, tìm kiếm, lọc theo chi nhánh/sản phẩm với dữ liệu chi tiết.
5. **Bảo mật phiên kép**: Tự động gia hạn phiên ngầm với Refresh Token Rotation, thu hồi token ngay khi logout hoặc bị khóa tài khoản.
