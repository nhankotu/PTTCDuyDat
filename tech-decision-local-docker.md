# Hệ thống phân tích báo cáo tài chính nội bộ: Chốt công nghệ & triển khai local

> Phạm vi: bản **MVP chạy thử trên máy cá nhân bằng Docker Desktop**. Quy mô thiết kế: ~20 người dùng đồng thời, 1 công ty, file Excel ≤ 50 MB.
> Trạng thái: **Bản nháp để chốt**. Các mục đánh dấu `[CẦN CHỐT]` cần bạn xác nhận.

---

## 1. Mục tiêu

1. Upload file Excel báo cáo tài chính, kiểm tra hợp lệ, chuẩn hóa vào CSDL.
2. Xem lại dữ liệu dưới dạng bảng, biểu đồ, chỉ số tài chính.
3. Lưu file gốc, truy vết phiên bản mỗi lần upload.
4. Chạy được toàn bộ bằng **một lệnh** `docker compose up` trên máy local.

**Ngoài phạm vi MVP**: dự báo ML/AI, SSO/Keycloak, hàng đợi RabbitMQ, Kubernetes.

---

## 2. Công nghệ đã chọn

| Tầng | Lựa chọn | Lý do |
|---|---|---|
| Backend | **C# / ASP.NET Core (.NET LTS)** `[CẦN CHỐT: C# hay Java]` | Ít RAM, LINQ gọn, tích hợp AD/Windows tốt |
| Đọc Excel | **MiniExcel** hoặc **ClosedXML** | Giấy phép thoáng (tránh EPPlus thương mại), MiniExcel đọc streaming tiết kiệm RAM |
| ORM / truy cập DB | **Dapper** cho truy vấn báo cáo + **EF Core** cho CRUD/migration | Truy vấn tổng hợp viết SQL trực tiếp cho rõ ràng |
| CSDL | **PostgreSQL 16** | Miễn phí, ổn định, window function tốt cho YoY/MoM |
| Lưu file gốc | **MinIO** (tương thích S3) | Tách file khỏi DB, dễ chuyển sang S3/NAS sau này |
| Frontend | **React + Vite + TypeScript** | Nhẹ, build ra file tĩnh |
| Biểu đồ | **Apache ECharts** | Có waterfall, treemap, combo chart |
| Bảng dữ liệu | **AG Grid Community** | Lọc, sắp xếp, nhóm, xuất Excel (bản Community đủ cho MVP) |
| Reverse proxy | **Nginx** (nằm trong container frontend) | Phục vụ file tĩnh + chuyển `/api` về backend |
| Xác thực MVP | **JWT, tài khoản nội bộ** | Keycloak/LDAP để giai đoạn sau |
| Triển khai | **Docker Desktop + Docker Compose** | Một lệnh dựng toàn bộ |

### Nếu chọn Java thay C#

| C# | Java tương đương |
|---|---|
| ASP.NET Core | Spring Boot 3 |
| MiniExcel / ClosedXML | Apache POI (streaming) hoặc FastExcel / EasyExcel |
| Dapper + EF Core | Spring JdbcTemplate + Spring Data JPA |
| Flyway/EF Migrations | Flyway |
| Image `mcr.microsoft.com/dotnet/aspnet` | Image `eclipse-temurin:21-jre` |

Phần còn lại của tài liệu (DB, MinIO, frontend, compose) giữ nguyên.

---

## 3. Kiến trúc

```
Trình duyệt ──► Nginx (frontend, :3000)
                  ├── file tĩnh React
                  └── /api/* ──► Backend (:8080)
                                   ├── PostgreSQL (:5432)   dữ liệu chuẩn hóa
                                   └── MinIO (:9000)        file Excel gốc
```

### Luồng upload

1. Người dùng chọn file → `POST /api/uploads`.
2. Backend lưu file gốc vào MinIO, tính SHA-256 để chặn upload trùng.
3. Đọc file → ánh xạ dòng Excel sang mã chỉ tiêu chuẩn → chạy bộ quy tắc kiểm tra.
4. Trả về **bản xem trước** kèm danh sách lỗi (chặn / cảnh báo).
5. Người dùng xác nhận → `POST /api/uploads/{id}/commit` → ghi vào `fact_value`.

---

## 4. Cấu trúc thư mục dự án

```
finance-dashboard/
├── docker-compose.yml
├── .env
├── db/
│   └── init/
│       └── 001_schema.sql
├── backend/
│   ├── Dockerfile
│   └── src/...
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   └── src/...
└── samples/
    └── bao-cao-mau.xlsx        # file Excel mẫu đã ẩn số liệu thật
```

---

## 5. File cấu hình

### 5.1 `.env`

```env
# PostgreSQL
POSTGRES_DB=finance
POSTGRES_USER=finance_app
POSTGRES_PASSWORD=doi_mat_khau_nay_123

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=doi_mat_khau_minio_123
MINIO_BUCKET=finance-raw

# Backend
JWT_SECRET=chuoi_bi_mat_toi_thieu_32_ky_tu_doi_ngay
MAX_UPLOAD_MB=50
```

> Chỉ dùng mật khẩu này cho local. **Không commit `.env` lên git** (thêm vào `.gitignore`).

### 5.2 `docker-compose.yml`

```yaml
x-logging: &default-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  db:
    image: postgres:16-alpine
    container_name: fin-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./db/init:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"            # mở để dùng DBeaver/pgAdmin khi test, bỏ khi lên server
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    mem_limit: 1g
    logging: *default-logging

  minio:
    image: minio/minio:latest
    container_name: fin-minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - miniodata:/data
    ports:
      - "9000:9000"            # API S3
      - "9001:9001"            # Console quản trị
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 5s
      timeout: 5s
      retries: 10
    mem_limit: 512m
    logging: *default-logging

  minio-init:
    image: minio/mc:latest
    container_name: fin-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set local http://minio:9000 ${MINIO_ROOT_USER} ${MINIO_ROOT_PASSWORD} &&
      mc mb --ignore-existing local/${MINIO_BUCKET} &&
      echo 'Bucket san sang';
      "
    restart: "no"

  backend:
    build: ./backend
    container_name: fin-backend
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      minio-init:
        condition: service_completed_successfully
    environment:
      ASPNETCORE_URLS: http://+:8080
      ASPNETCORE_ENVIRONMENT: Development
      ConnectionStrings__Default: Host=db;Port=5432;Database=${POSTGRES_DB};Username=${POSTGRES_USER};Password=${POSTGRES_PASSWORD}
      Storage__Endpoint: minio:9000
      Storage__AccessKey: ${MINIO_ROOT_USER}
      Storage__SecretKey: ${MINIO_ROOT_PASSWORD}
      Storage__Bucket: ${MINIO_BUCKET}
      Storage__UseSsl: "false"
      Jwt__Secret: ${JWT_SECRET}
      Upload__MaxMb: ${MAX_UPLOAD_MB}
    ports:
      - "8080:8080"            # để gọi thẳng Swagger khi phát triển
    mem_limit: 768m
    logging: *default-logging

  frontend:
    build: ./frontend
    container_name: fin-frontend
    restart: unless-stopped
    depends_on:
      - backend
    ports:
      - "3000:80"
    mem_limit: 128m
    logging: *default-logging

volumes:
  pgdata:
  miniodata:
```

### 5.3 `backend/Dockerfile` (C#, multi-stage)

```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY src/*.csproj ./
RUN dotnet restore
COPY src/ ./
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENTRYPOINT ["dotnet", "FinanceDashboard.Api.dll"]
```

> Đổi `8.0` sang phiên bản LTS mới hơn nếu bạn dùng .NET mới hơn. Tên DLL `FinanceDashboard.Api.dll` đặt theo tên project thực tế.

### 5.4 `frontend/Dockerfile`

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

### 5.5 `frontend/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    client_max_body_size 50m;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:8080/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }
}
```

### 5.6 `db/init/001_schema.sql` (khung ban đầu)

```sql
CREATE TABLE company (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(30)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL
);

CREATE TABLE report_type (
    id          SERIAL PRIMARY KEY,
    code        VARCHAR(30)  NOT NULL UNIQUE,   -- BCDKT, KQKD, LCTT
    name        VARCHAR(200) NOT NULL
);

CREATE TABLE indicator (
    id          SERIAL PRIMARY KEY,
    report_type_id INT NOT NULL REFERENCES report_type(id),
    code        VARCHAR(30)  NOT NULL,          -- mã số chỉ tiêu: 100, 270, 440...
    name        VARCHAR(300) NOT NULL,
    parent_code VARCHAR(30),
    sign        SMALLINT NOT NULL DEFAULT 1,    -- +1 cộng, -1 trừ khi cộng dồn lên cha
    sort_order  INT NOT NULL DEFAULT 0,
    UNIQUE (report_type_id, code)
);

CREATE TABLE upload (
    id           BIGSERIAL PRIMARY KEY,
    company_id   INT NOT NULL REFERENCES company(id),
    report_type_id INT NOT NULL REFERENCES report_type(id),
    period_start DATE NOT NULL,
    period_end   DATE NOT NULL,
    file_name    VARCHAR(300) NOT NULL,
    file_sha256  CHAR(64) NOT NULL,
    storage_key  VARCHAR(500) NOT NULL,         -- đường dẫn object trong MinIO
    status       VARCHAR(20) NOT NULL DEFAULT 'DRAFT',  -- DRAFT, COMMITTED, SUPERSEDED, REJECTED
    version      INT NOT NULL DEFAULT 1,
    uploaded_by  VARCHAR(100) NOT NULL,
    uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_upload_hash ON upload(file_sha256);

CREATE TABLE fact_value (
    id           BIGSERIAL PRIMARY KEY,
    upload_id    BIGINT NOT NULL REFERENCES upload(id),
    company_id   INT NOT NULL REFERENCES company(id),
    report_type_id INT NOT NULL REFERENCES report_type(id),
    period_end   DATE NOT NULL,
    indicator_id INT NOT NULL REFERENCES indicator(id),
    value        NUMERIC(24,2) NOT NULL          -- luôn quy về 1 đơn vị tiền (đồng)
);
CREATE INDEX ix_fact_lookup
    ON fact_value(company_id, report_type_id, period_end, indicator_id);

CREATE TABLE validation_issue (
    id          BIGSERIAL PRIMARY KEY,
    upload_id   BIGINT NOT NULL REFERENCES upload(id),
    severity    VARCHAR(10) NOT NULL,           -- ERROR (chặn), WARNING (cảnh báo)
    sheet_name  VARCHAR(100),
    cell_ref    VARCHAR(20),
    rule_code   VARCHAR(50) NOT NULL,
    message     TEXT NOT NULL
);
```

> Lưu ý: chỉ đọc dữ liệu `fact_value` của upload có `status = 'COMMITTED'` (phiên bản mới nhất cho mỗi công ty + kỳ + loại báo cáo).

---

## 6. Cấu hình Docker Desktop cho máy local

| Mục | Giá trị gợi ý |
|---|---|
| Backend của Docker | **WSL 2** (Windows) hoặc VirtioFS (macOS) |
| CPU cấp cho Docker | 4 |
| RAM cấp cho Docker | **6 GB** (tối thiểu 4 GB) |
| Swap | 1-2 GB |
| Disk image size | 40-60 GB |

- Windows: chỉnh trong file `%UserProfile%\.wslconfig`:
  ```ini
  [wsl2]
  memory=6GB
  processors=4
  swap=2GB
  ```
  rồi chạy `wsl --shutdown` và mở lại Docker Desktop.
- Máy có 8 GB RAM tổng: giảm xuống `memory=4GB`, tắt bớt ứng dụng khác khi build.
- **Để code nằm trong hệ thống file của WSL** (ví dụ `\\wsl$\Ubuntu\home\...`) nếu thấy build/chạy chậm.

---

## 7. Cách chạy

```bash
# 1. Tạo file .env (copy mẫu ở mục 5.1 và đổi mật khẩu)
# 2. Dựng toàn bộ hệ thống
docker compose up -d --build

# 3. Kiểm tra trạng thái
docker compose ps

# 4. Xem log
docker compose logs -f backend

# 5. Dừng (giữ dữ liệu)
docker compose down

# 6. Dừng và XÓA sạch dữ liệu (dùng khi muốn làm lại từ đầu)
docker compose down -v
```

| Dịch vụ | Địa chỉ |
|---|---|
| Giao diện | http://localhost:3000 |
| Swagger (API) | http://localhost:8080/swagger |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | localhost:5432 (DBeaver / pgAdmin) |

> Lưu ý: script trong `db/init` **chỉ chạy lần đầu** khi volume `pgdata` còn trống. Muốn chạy lại, dùng `docker compose down -v`. Về lâu dài nên chuyển sang công cụ migration (EF Core Migrations hoặc Flyway).

---

## 8. Quy ước & nguyên tắc kỹ thuật

1. **Tiền tệ**: lưu `NUMERIC`, quy về một đơn vị (đồng) ngay khi nhập. Không dùng float.
2. **Kỳ báo cáo**: lưu `period_end` (ngày cuối kỳ), loại kỳ suy ra từ khoảng ngày.
3. **Bất biến**: không sửa/xóa `fact_value` của upload đã commit. Upload lại thì đánh dấu bản cũ `SUPERSEDED`.
4. **Công thức chỉ số** (ROE, ROA, biên lợi nhuận...) định nghĩa **một nơi** dưới dạng SQL view; biểu đồ chỉ gọi view.
5. **Kiểm tra dữ liệu** chia hai mức: `ERROR` chặn lưu, `WARNING` cho lưu nhưng đánh dấu.
6. **Đặt giới hạn tài nguyên** (`mem_limit`) và xoay vòng log cho mọi container.
7. **Không dùng `latest`** cho image khi lên môi trường thật; ghim phiên bản cụ thể.

---

## 9. Bộ quy tắc kiểm tra bản đầu

| Mã | Mức | Nội dung |
|---|---|---|
| FMT-001 | ERROR | Ô cần là số nhưng chứa chữ |
| FMT-002 | ERROR | Ô công thức lỗi (`#REF!`, `#N/A`...) |
| STR-001 | ERROR | Thiếu chỉ tiêu bắt buộc |
| STR-002 | ERROR | Không nhận diện được đơn vị tiền |
| MATH-001 | ERROR | Tổng tài sản ≠ Tổng nguồn vốn |
| MATH-002 | ERROR | Dòng tổng ≠ tổng các dòng con |
| PER-001 | WARNING | Số đầu kỳ ≠ số cuối kỳ trước |
| PER-002 | WARNING | Biến động > 20% so với kỳ trước |
| DUP-001 | ERROR | File trùng mã băm đã upload |
| DUP-002 | WARNING | Đã có dữ liệu cùng công ty + kỳ + loại, sẽ tạo phiên bản mới |

---

## 10. Các màn hình MVP

1. **Đăng nhập**
2. **Upload**: chọn công ty, loại báo cáo, kỳ → xem trước + danh sách lỗi → xác nhận
3. **Lịch sử upload**: trạng thái, phiên bản, tải lại file gốc
4. **Bảng dữ liệu**: lọc theo công ty / kỳ / loại, xuất Excel
5. **Dashboard**: thẻ KPI, đường xu hướng, cột chồng cơ cấu, so sánh kỳ

---

## 11. Lộ trình gợi ý

| Giai đoạn | Nội dung | Ước tính |
|---|---|---|
| 0 | Chốt template Excel + danh mục chỉ tiêu cùng kế toán | 2-3 ngày |
| 1 | Dựng `docker compose`, schema, upload + lưu MinIO | 3-5 ngày |
| 2 | Đọc Excel, ánh xạ, bộ quy tắc kiểm tra, màn xem trước | 1-2 tuần |
| 3 | Bảng dữ liệu + dashboard cơ bản | 1 tuần |
| 4 | Phân quyền, log truy cập, backup, hướng dẫn triển khai server | 1 tuần |

---

## 12. Rủi ro cần lưu ý

| Rủi ro | Cách giảm |
|---|---|
| Template Excel mỗi đơn vị một kiểu | Chốt template chuẩn từ đầu, không đoán cấu trúc |
| File lớn làm hết RAM | Đọc streaming, giới hạn kích thước, xử lý từng file |
| Mất dữ liệu do volume Docker bị xóa | Backup `pg_dump` + sao lưu bucket MinIO ra ổ khác |
| Chạy local ổn nhưng lên server lỗi | Giữ cấu hình qua biến môi trường, không hard-code |
| Dữ liệu tài chính nhạy cảm | Phân quyền theo đơn vị, ghi log truy cập, đổi mọi mật khẩu mặc định |

---

## 13. Danh sách cần chốt

- [ ] Backend: **C#** hay **Java**
- [ ] Loại báo cáo làm đầu tiên (BCDKT / KQKD / LCTT / quản trị)
- [ ] Chuẩn kế toán và danh mục chỉ tiêu (TT200 / TT133 / nội bộ)
- [ ] Đơn vị tiền trong file nguồn (đồng / nghìn / triệu)
- [ ] File Excel mẫu đã ẩn số liệu
- [ ] Kỳ báo cáo: tháng / quý / năm
- [ ] Cách đăng nhập: tài khoản nội bộ hay LDAP/AD
