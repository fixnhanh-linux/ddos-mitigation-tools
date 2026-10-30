# Treafix Proxy BB 2.0 (nhiều site, Traefik)

Cổng truy cập BMC / IPMI (iDRAC, iLO, AMI, Supermicro…) cho **nhiều site**:
- Mỗi site có **1 server Traefik** riêng. Các server **không cần thông với nhau**.
- Tất cả được quản lý bằng **1 giao diện web chung**.

```text
                    ┌──────────────────────────────────┐
                    │  WEB (controller) — 1 máy        │  giao diện, danh sách BMC 4 site,
                    │  bmcproxy.py serve               │  phân quyền, sao lưu, nhật ký
                    └──▲──────────▲──────────▲──────▲──┘
     HTTPS + token     │          │          │      │      chỉ cần chiều server → web
               ┌───────┴──┐ ┌─────┴────┐ ┌───┴────┐ ┌┴─────────┐
               │ Site HN  │ │ Site HCM │ │Site DN │ │ Site CT  │   mỗi server:
               │ Traefik  │ │ Traefik  │ │Traefik │ │ Traefik  │   Traefik + agent
               │ + agent  │ │ + agent  │ │+ agent │ │ + agent  │   (forwardAuth 127.0.0.1:9444)
               └──────────┘ └──────────┘ └────────┘ └──────────┘
```

- **Web (controller):** nơi duy nhất thêm/sửa BMC. Bấm **Áp dụng** thì web phát hành một "bản cấu hình" cho site đó.
- **Agent** chạy trên mỗi server Traefik:
  - cứ 10 giây gọi lên web, báo trạng thái và nhận bản cấu hình **của site mình**;
  - tự sao lưu → ghi config Traefik → (restart nếu thêm/bớt cổng) → kiểm tra. Lỗi thì **tự khôi phục**, rồi báo kết quả về web;
  - chạy **forwardAuth ngay trên server**. **Web chết thì mọi site vẫn chạy** với cấu hình gần nhất.
- Áp dụng ở site nào **chỉ ảnh hưởng site đó**.
- Chỉ cần Python 3.9+ có sẵn trên Ubuntu 22.04, không cần `pip install`. Đã test với **Traefik v3.7.15**.

## Tính năng

| Nhóm | Tính năng |
|---|---|
| Site | Thêm / sửa / xoá site. Token agent riêng từng site (đổi được). Giới hạn IP agent. Ghi đè URL auth-token, chứng chỉ, log theo site. Trạng thái online, phiên bản Traefik, router lỗi, kết quả áp dụng gần nhất |
| BMC | Thêm / sửa / xoá / tạm tắt. Lọc theo site và trạng thái. Nhập từ nginx của từng server. Xem trước config Traefik. Cùng một cổng dùng được ở các site khác nhau |
| Mẫu & hàng loạt | 11 mẫu BMC có sẵn theo loại máy (iDRAC 6/7/8/9, Dell C6420/R620/R640, iLO 4/5, Lenovo, Cisco C220, Quanta, Supermicro) + mẫu riêng, dùng chung mọi site. Gợi ý cổng trống. Thêm / cập nhật hàng loạt nhiều site bằng cách dán từ Excel/CSV. Chọn nhiều BMC để bật/tắt xác thực, tạm tắt, đổi mẫu, đổi Host header, xoá. Xuất CSV |
| Thêm BMC nhanh | Nút **Dò**: gõ IP, agent của site nhận loại máy (cổng web, TLS cũ, trang chủ, Redfish, chứng chỉ) rồi tự chọn mẫu, cổng proxy trống, địa chỉ BMC. iDRAC 9 tự đặt Host = IP BMC (hết `QueryNotSupported`) |
| Điện thoại | Thanh icon dưới màn hình, thẻ BMC gọn, chip lọc vuốt ngang |
| Console Java | Chuyển tiếp TCP thô (cổng proxy → cổng BMC) cho console Java, giới hạn IP; agent tự sửa file `.jnlp` (IP nội bộ → tên miền proxy, cổng BMC → cổng proxy); file `.jar` tải không cần cookie. Có sẵn cổng Java cho QCT/AMI, iDRAC 6/7/8, iLO 4, Supermicro |
| Áp dụng | Diff từng file theo site. Chọn site để áp dụng. Theo dõi tiến độ trực tiếp. Thử lại khi lỗi. Kiểm tra cổng trống trước khi restart. Tự rollback |
| Bảo mật | Xác thực bật sẵn cho web + console. Target bắt buộc theo BMC. Chặn giả mạo header `Token-*`. TLS ≥ 1.2. Mật khẩu PBKDF2, khoá khi sai 5 lần, chống CSRF, CSP |
| Phân quyền | **Quản trị**: toàn quyền. **Vận hành** / **Chỉ xem**: theo site được giao, tick từng quyền (thêm / sửa / xoá BMC, áp dụng, dò, bảo trì, link khách, thống kê, nhật ký, xuất CSV) |
| Giám sát | Tổng quan 4 site. BMC mất kết nối (kiểm tra từ chính server của site). Lượt xác thực / bị chặn. Cảnh báo chứng chỉ, nginx chiếm cổng, agent mất liên lạc. API Zabbix |
| Sao lưu | Web: danh sách BMC, site, cài đặt. Mỗi server: config Traefik trước mỗi lần áp dụng (giữ 30 bản) |
| Cảnh báo | Telegram / email: site mất liên lạc, BMC mất kết nối, BMC sắp hết hạn, áp dụng lỗi, khoá tài khoản, cập nhật agent |
| Truy cập BMC | Ai mở trang BMC / console nào, lúc nào, từ IP nào. Link tạm cho khách (có hạn, thu hồi được). Xuất CSV |
| Cập nhật agent | Bấm 1 nút trên web: agent tự tải bản mới (kiểm SHA-256), chạy thử, sao lưu bản cũ, khởi động lại |
| Cổng khách hàng | Vai trò **Khách hàng**: chỉ thấy BMC của mình (theo nhãn / danh sách), tự mở BMC (link 4 giờ), xem lịch sử truy cập |
| Lịch bảo trì | Theo site hoặc BMC: không gửi cảnh báo, trang lỗi IPMI ghi "đang bảo trì", khách hàng thấy BMC đang bảo trì |

## 1. Cài web (controller)

> Cách nhanh: giải nén gói `dist/bmc-gateway-web-*.zip` rồi `sudo bash install.sh web` (xem `docs/HUONG-DAN-CAI-DAT.md`).
> Các lệnh `cp` bên dưới (cài tay) chạy **trong thư mục gói đã giải nén**, không phải thư mục mã nguồn.

Đặt ở máy mà **cả 4 server Traefik gọi tới được qua HTTPS** (Internet hoặc mạng riêng). Có thể chung máy với một server Traefik.

```bash
sudo useradd --system --home /opt/bmcproxy --shell /usr/sbin/nologin bmcproxy
sudo mkdir -p /opt/bmcproxy/data /opt/bmcproxy/backups /etc/bmcproxy/certs
sudo cp -r bmcproxy.py gw_*.py web config.example.json bmcproxy.service /opt/bmcproxy/
sudo cp config.example.json /opt/bmcproxy/config.json      # sửa tls_cert / tls_key
sudo cp longvan.net-2027.cer /etc/bmcproxy/certs/longvan.net.cer
sudo cp longvan.net-2027.key /etc/bmcproxy/certs/longvan.net.key
sudo chown -R bmcproxy:bmcproxy /opt/bmcproxy /etc/bmcproxy
sudo chmod 600 /etc/bmcproxy/certs/longvan.net.key
cd /opt/bmcproxy && sudo -u bmcproxy python3 bmcproxy.py adduser admin
sudo cp bmcproxy.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now bmcproxy
```

Firewall cho cổng 9443:
- **Mạng quản trị / VPN:** để vào giao diện.
- **IP public của 4 server Traefik:** đường `/agent/v1/*`.

## 2. Thêm site trên web

Vào **Site → + Thêm site**, nhập:
- mã site (vd `hn`), tên hiển thị, tên miền (`proxybb-hn.longvan.net`);
- **IP public của server** đó.

Web sẽ hiện `agent.json` kèm **token. Token chỉ hiện một lần**, nên sao chép ngay.

## 3. Cài trên mỗi server Traefik

```bash
# Traefik v3 (linux_amd64) từ https://github.com/traefik/traefik/releases — so SHA-256 với *_checksums.txt
sudo tar -xzf traefik_v3.*_linux_amd64.tar.gz -C /usr/local/bin traefik
sudo useradd --system --no-create-home --shell /usr/sbin/nologin traefik
sudo mkdir -p /etc/traefik/dynamic /etc/traefik/certs /var/log/traefik /opt/bmcproxy
sudo cp /etc/nginx/longvan.net-2027.cer /etc/traefik/certs/longvan.net.cer
sudo cp /etc/nginx/longvan.net-2027.key /etc/traefik/certs/longvan.net.key
sudo chown -R traefik:traefik /var/log/traefik
sudo chgrp traefik /etc/traefik/certs/longvan.net.key && sudo chmod 640 /etc/traefik/certs/longvan.net.key
sudo cp traefik.service /etc/systemd/system/

# agent
sudo cp -r bmcproxy.py gw_*.py bmcproxy-agent.service /opt/bmcproxy/
sudo nano /opt/bmcproxy/agent.json        # dán nội dung web vừa hiện, sửa controller_url
sudo chmod 600 /opt/bmcproxy/agent.json
sudo cp bmcproxy-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable traefik             # chưa start: agent sẽ tạo traefik.yml rồi tự restart
sudo systemctl enable --now bmcproxy-agent
```

Vài giây sau, site trên web chuyển sang **trực tuyến**.

## 4. Chuyển BMC từ nginx sang (nên làm ngoài giờ, từng site một)

1. **Site → Nhập từ nginx.** Agent đọc `/etc/nginx/conf.d` trên server và gửi danh sách BMC về web.
   - URL auth-token tìm thấy trong config nginx được giữ làm cấu hình riêng của site.
   - Cổng nào trước đây mở sẽ được **bật xác thực**, có nhãn "mới bật".
2. Xem lại danh sách BMC. BMC nào dùng console Java thì tắt "Bắt xác thực console".
3. **Xem & áp dụng → chọn site → Áp dụng.** Agent lần lượt:
   1. sao lưu;
   2. ghi config Traefik;
   3. đổi tên file nginx cũ thành `*.disabled-by-bmcproxy`, `nginx -t`, reload;
   4. kiểm tra cổng trống;
   5. restart Traefik;
   6. kiểm tra mọi router và cổng.
   - Lỗi bước nào thì tự bật lại nginx và khôi phục Traefik.
4. Mở thử vài BMC. `default.conf` (cổng 80) và `webproxyauto.conf` (8888) vẫn do nginx chạy.

## Cấu hình

**`config.json` (web):**

| Khoá | Ý nghĩa |
|---|---|
| `listen_host`, `listen_port`, `tls_cert`, `tls_key` | Địa chỉ và chứng chỉ của web |
| `agent_offline_after` | Số giây không báo về thì coi agent mất liên lạc (mặc định 45) |
| `zabbix_token` | Token cho `/api/zabbix`. Để trống thì tắt |

**`agent.json` (mỗi server):**

| Khoá | Ý nghĩa |
|---|---|
| `site`, `controller_url`, `token`, `verify_tls` | Kết nối tới web. `verify_tls` để `true` trừ khi đang thử |
| `poll_interval` | Bao lâu hỏi web một lần (giây) |
| `auth_listen_*` | forwardAuth, giữ `127.0.0.1` |
| `traefik_*`, `entrypoint_host`, `verify_*` | Đường dẫn và lệnh của Traefik. `entrypoint_host` để trống = nghe mọi IP |
| `nginx_*` | Để nhập và tắt config nginx cũ |

Lệnh trong `agent.json` **không sửa được từ web**. Web chỉ gửi dữ liệu BMC, agent kiểm tra lại mọi trường trước khi ghi file.

## Lưu ý quan trọng

- **Thêm cổng mới:** nếu Traefik không mở được **một** cổng, **cả Traefik dừng**, tức mọi BMC của site đó đều mất. Vì vậy agent kiểm tra cổng trống trước khi restart, và khôi phục nếu Traefik chết sau restart.
- **BMC đời cũ:** Traefik (Go) không hỗ trợ cipher DHE. Thử trước bằng lệnh dưới đây. Ra `Cipher is AES...` là dùng được với tuỳ chọn "BMC đời cũ".
  ```bash
  openssl s_client -connect <ip-bmc>:<cổng> -cipher 'AES128-SHA:AES256-SHA' -tls1_2 </dev/null
  ```
- **Một token vào được mọi BMC?** Dịch vụ auth-token không được biết người dùng mở cổng nào. Xem trường `target` mà dịch vụ trả về; nếu có, điền vào **Target bắt buộc** của từng BMC.
- **Header `X-Original-TARGET`** trả về trình duyệt (có ở nginx cũ) không còn nữa.

## Zabbix

Header `X-Api-Token: <zabbix_token>`:

- `GET /api/zabbix`: mỗi BMC một dòng
  `{"site","port","key":"hn:8005","up","latency_ms","console_up","router_ok","auth_ok","auth_deny","auth_error","site_online",…}`
- `GET /api/zabbix?type=sites`: mỗi site một dòng `{"site","online","phase","bmcs","down","router_errors"}`

Dùng LLD với `{#KEY}` ← `$.key`. Traefik trên mỗi server có thêm metrics Prometheus tại `http://127.0.0.1:18080/metrics`.

## Cấu trúc thư mục

```text
bmcproxy/
├── bmcproxy.py              Lệnh chính: serve (web) · agent · adduser
├── README.md                File này
│
├── common/                  Dùng chung cho web và agent (có trong cả 2 gói)
│   ├── gw_common.py         Hằng số, kiểm tra dữ liệu, mật khẩu PBKDF2, TOTP 2FA, YAML, HTTP
│   ├── gw_render.py         Sinh config Traefik (router, service, middleware) + mã phiên bản cấu hình
│   └── gw_auth.py           forwardAuth (thay authenticate.js), trang .jnlp / console Java, trang lỗi IPMI
│
├── controller/              WEB quản lý (gói bmc-gateway-web)
│   ├── gw_controller.py     Giao diện + API, đăng nhập, phân quyền, site, BMC, áp dụng, sao lưu, API agent
│   ├── gw_db.py             Lưu dữ liệu vào MySQL (tuỳ chọn, mặc định file JSON)
│   ├── gw_ldap.py           Đăng nhập bằng Active Directory / LDAP
│   ├── gw_notify.py         Cảnh báo Telegram / email (chạy nền, báo khi trạng thái đổi)
│   ├── gw_templates.py      Mẫu BMC theo loại máy, nhập / xuất CSV
│   ├── web/                 Giao diện: index.html · app.js · app.css
│   └── agent-package/       (sinh ra) gói agent cho lệnh "cài agent 1 dòng"
│
├── agent/                   AGENT trên mỗi server Traefik (gói bmc-gateway-agent)
│   ├── gw_agent.py          Đồng bộ với web, áp dụng + tự khôi phục, kiểm tra BMC, log, restart
│   ├── gw_nginx.py          Đọc / tắt config nginx cũ khi chuyển sang Traefik
│   ├── gw_limit.py          Giới hạn số kết nối đồng thời tới mỗi BMC (chống treo QCT / AMI)
│   ├── gw_errpage.py        Chẩn đoán khi BMC không vào được (mất kết nối, TLS, quá tải…)
│   ├── gw_java.py           Tải và sửa file .jnlp (đúng tên miền / cổng proxy)
│   ├── gw_kvm.py            Console Java ngay trên web (container Docker + noVNC)
│   └── kvm/                 Image Docker bmcgw-kvm: Dockerfile · start.sh · jnlp_run.py
│
├── deploy/                  Cài đặt lên server Ubuntu
│   ├── install.sh           web · agent · all · kvm · db · secret-url · status · uninstall
│   ├── config.example.json  Mẫu config web
│   ├── agent.example.json   Mẫu config agent
│   └── systemd/             bmcproxy.service · bmcproxy-agent.service · traefik.service
│
├── tools/
│   └── build_packages.py    Tạo 2 gói cài đặt trong dist/
├── tests/
│   └── test_smoke.py        Kiểm tra nhanh: import, web chạy thật, đăng nhập AD giả lập
├── docs/                    HUONG-DAN-CAI-DAT.md · Huong-Dan-BMC-Gateway.docx (quản trị)
│                            · Huong-Dan-Su-Dung-Treafix-Proxy-BB.docx (người dùng, có ảnh)
│
└── (sinh ra khi chạy, không commit)
    config.json · data/ · backups/ · dist/
```

**Ai import ai:** `controller/*` và `agent/*` chỉ dùng `common/*`; web và agent không import lẫn nhau
(trừ `gw_auth.py` gọi `gw_kvm` / `gw_java` / `gw_errpage` khi chạy trong agent).

## Làm việc với mã nguồn

```bash
python bmcproxy.py adduser admin -c config.json      # tạo tài khoản (máy dev)
python bmcproxy.py serve -c config.json              # chạy web
python bmcproxy.py dev -c config.json                # chạy web dev: sửa file web -> trình duyệt tự cập nhật (CSS đổi ngay),
                                                     #   sửa .py -> server tự khởi động lại
python -m unittest discover -s tests -v              # kiểm tra trước khi đóng gói
python tools/build_packages.py                       # tạo dist/bmc-gateway-web-*.zip, dist/bmc-gateway-agent-*.zip
```

- `bmcproxy.py` tự thêm `common/`, `controller/`, `agent/` vào đường dẫn import, nên chạy thẳng từ mã nguồn được.
- **Gói cài đặt vẫn để file phẳng** (`bmcproxy.py`, `gw_*.py`, `install.sh`, `web/`, `kvm/` cùng một chỗ) giống bản cũ.
  Server đang chạy chỉ cần giải nén gói mới và chạy lại `install.sh`.
- `deploy/install.sh` chạy thẳng từ mã nguồn sẽ dừng và nhắc tạo gói trước.
- Thư viện ngoài đều **tuỳ chọn**: `python3-pymysql` (khi dùng MySQL), `python3-ldap3` (khi đăng nhập AD).
