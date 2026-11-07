# 🔐 Danh sách Tài khoản Mặc định & Phân quyền Hệ thống

Hệ thống Finra Financial Dashboard sử dụng cơ chế bảo mật nội bộ với **JWT Access Token (60 phút)** kết hợp **Refresh Token (14 ngày)**.

---

## 1. Tài khoản Quản trị viên Tối cao (Super Admin)
Tài khoản khởi tạo sẵn có toàn quyền quản trị hệ thống, upload dữ liệu và cấp quyền cho các tài khoản khác:

* **Tên đăng nhập (Username)**: `admin`
* **Mật khẩu (Password)**: `admin123`
* **Họ và tên**: `System Administrator`
* **Vai trò**: `admin` (Quản trị viên)
* **Phạm vi dữ liệu**: Toàn bộ hệ thống (Tất cả chi nhánh)
* **Quyền hạn**:
  - Full quyền xem toàn bộ báo cáo, KPI, biểu đồ, số liệu chi tiết.
  - Quyền Upload / Import file Excel dữ liệu mới.
  - Quyền truy cập trang Quản lý Người dùng: Tạo tài khoản mới, phân quyền chi nhánh, gán quyền chức năng, đổi mật khẩu và khóa/xóa tài khoản.

---

## 2. Tài khoản Người dùng mẫu (Branch User / Manager)
Tài khoản mẫu dành cho quản lý hoặc nhân viên chi nhánh:

* **Tên đăng nhập (Username)**: `sale_manager`
* **Mật khẩu (Password)**: `password123`
* **Họ và tên**: `Quản lý Chi nhánh Hoàn Kiếm`
* **Vai trò**: `user` (Người dùng)
* **Phạm vi dữ liệu**: Giới hạn theo chi nhánh được gán: `CN Hoàn Kiếm 1`
* **Quyền hạn**:
  - Xem Dashboard, KPI, biểu đồ được lọc tự động theo `CN Hoàn Kiếm 1`.
  - Xem Thống kê đa chiều và Tra cứu danh sách hợp đồng của chi nhánh.
  - Không có quyền upload dữ liệu (nút Import ẩn).
  - Không có quyền quản lý người dùng (tab Người dùng ẩn).

---

## 3. Quy tắc Đăng nhập & Bảo mật phiên
1. Bắt buộc phải đăng nhập tại giao diện `http://localhost:3000` để truy cập hệ thống.
2. Phiên làm việc duy trì liên tục trong 14 ngày thông qua cơ chế tự động xoay vòng Refresh Token (Silent Refresh).
3. Người dùng có thể bấm nút **Đăng xuất** ở góc trên bên phải để hủy phiên làm việc.
4. Khi Admin khóa tài khoản, người dùng đó sẽ bị thu hồi phiên đăng nhập ngay lập tức.
