#!/usr/bin/env bash
# Treafix Proxy BB - cai dat / go cai dat tren Ubuntu 22.04 (chay bang root)
#
#   sudo bash install.sh uninstall   go sach ban cu (sao luu truoc, tra lai nginx)
#   sudo bash install.sh all         web + Traefik + agent tren CUNG may (site dau tien)
#   sudo bash install.sh web         chi cai web (controller)
#   sudo bash install.sh agent       Traefik + agent cho site khac (can file agent.json tu web)
#   sudo bash install.sh remove-agent  go Traefik + agent, GIU web (tach web ra may rieng)
#   sudo bash install.sh kvm         build image Docker cho "console Java tren web" (tren server agent)
#   sudo bash install.sh db          luu du lieu web vao MySQL (hoi host / tai khoan / mat khau)
#   sudo bash install.sh secret-url  bat / doi link web bi mat (https://ip:cong/<chuoi>/); "secret-url off" de tat
#   sudo bash install.sh status      kiem tra tinh trang
#
# Bien moi truong (tuy chon): SITE DOMAIN LABEL CERT KEY TRAEFIK_VERSION WEB_PORT API_PORT
#                             AUTH_PORT AGENT_JSON
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SRC/../controller/gw_controller.py" ]; then  # dang o deploy/ cua ma nguon, khong phai goi cai dat
  echo "Đây là thư mục mã nguồn. Tạo gói trước:  python3 tools/build_packages.py" >&2
  echo "rồi chạy install.sh trong gói dist/bmc-gateway-web-*.zip hoặc dist/bmc-gateway-agent-*.zip" >&2
  exit 1
fi
APP=/opt/bmcproxy
TRAEFIK_VERSION="${TRAEFIK_VERSION:-v3.7.15}"
USER_WEB_PORT="${WEB_PORT:-}"   # cong nguoi dung chi dinh (neu co)
WEB_PORT="${WEB_PORT:-9443}"
API_PORT="${API_PORT:-18080}"
AUTH_PORT="${AUTH_PORT:-9444}"
USER_CERT="${CERT:-}"
USER_KEY="${KEY:-}"
CERT="${CERT:-/etc/nginx/ssl/longvan-vn-2027.crt}"
KEY="${KEY:-/etc/nginx/ssl/longvan-vn-2027.key}"
AGENT_FILES="bmcproxy.py gw_agent.py gw_auth.py gw_common.py gw_errpage.py gw_java.py gw_kvm.py gw_limit.py gw_nginx.py gw_render.py"
KVM_IMAGE="${KVM_IMAGE:-bmcgw-kvm:1}"

say()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
ok()   { printf '    \033[32mOK\033[0m %s\n' "$*"; }
warn() { printf '    \033[33m!!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[1;31mLỖI: %s\033[0m\n' "$*" >&2; exit 1; }

need_root() { [ "$(id -u)" = 0 ] || die "Hãy chạy bằng root: sudo bash $0 $*"; }

port_used() { ss -ltnH "sport = :$1" 2>/dev/null | grep -q .; }

check_port() {  # check_port <cong> <ten> [ten tien trinh duoc phep]
  if port_used "$1"; then
    if [ -n "${3:-}" ] && ss -ltnpH "sport = :$1" | grep -q "$3"; then
      ok "cổng $1 ($2) đang do $3 dùng - bản cũ, sẽ được thay"
    else
      ss -ltnpH "sport = :$1" | sed 's/^/      /'
      die "Cổng $1 ($2) đang bị chương trình khác dùng. Chạy lại với cổng khác, ví dụ: sudo ${4:-PORT}=<cổng khác> bash $0 $cmd"
    fi
  else
    ok "cổng $1 ($2) trống"
  fi
}

check_base() {
  say "Kiểm tra hệ thống"
  python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)' \
    || die "Cần Python 3.9 trở lên (đang có: $(python3 --version 2>&1))"
  ok "$(python3 --version)"
  for c in curl ss sha256sum tar systemctl; do
    command -v "$c" >/dev/null || die "Thiếu lệnh '$c'"
  done
  ok "đủ lệnh cần thiết"
  for f in bmcproxy.py gw_common.py; do
    [ -f "$SRC/$f" ] || die "Không thấy $SRC/$f - hãy copy cả thư mục gói lên server"
  done
  local kind="web + agent"
  [ -d "$SRC/web" ] || kind="agent (backend)"
  [ -f "$SRC/traefik.service" ] || kind="web (frontend)"
  ok "code tại $SRC - gói $kind"
}

check_cert() {  # check_cert <thu muc chung chi da cai cua che do nay>
  # 1. Neu nguoi dung truyen bien CERT / KEY thi dung
  if [ -n "$USER_CERT" ] && [ -n "$USER_KEY" ]; then
    CERT="$USER_CERT"
    KEY="$USER_KEY"
  fi

  # 2. Tu dong tim theo cac cap duong dan pho bien tren server
  if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    local candidates=(
      "/etc/nginx/ssl/longvan-vn-2027.crt:/etc/nginx/ssl/longvan-vn-2027.key"
      "/etc/nginx/longvan-vn-2027.crt:/etc/nginx/longvan-vn-2027.key"
      "/etc/nginx/ssl/longvan.net-2027.cer:/etc/nginx/ssl/longvan.net-2027.key"
      "/etc/nginx/longvan.net-2027.cer:/etc/nginx/longvan.net-2027.key"
      "/etc/nginx/longvan.net.cer:/etc/nginx/longvan.net.key"
    )
    for pair in "${candidates[@]}"; do
      local c="${pair%%:*}"
      local k="${pair##*:}"
      if [ -f "$c" ] && [ -f "$k" ]; then
        CERT="$c"
        KEY="$k"
        break
      fi
    done
  fi

  # 3. Kiem tra thu muc da cai lan truoc neu chua co
  if [ ! -f "$CERT" ] || [ ! -f "$KEY" ]; then
    if [ -n "${1:-}" ] && [ -f "$1/longvan.net.cer" ] && [ -f "$1/longvan.net.key" ]; then
      CERT="$1/longvan.net.cer"
      KEY="$1/longvan.net.key"
    elif [ -n "${1:-}" ] && [ -f "$1/longvan-vn-2027.crt" ] && [ -f "$1/longvan-vn-2027.key" ]; then
      CERT="$1/longvan-vn-2027.crt"
      KEY="$1/longvan-vn-2027.key"
    fi
  fi

  [ -f "$CERT" ] || die "Không thấy chứng chỉ $CERT (đặt biến CERT=/đường/dẫn/file.crt KEY=/đường/dẫn/file.key)"
  [ -f "$KEY" ] || die "Không thấy khoá $KEY (đặt biến KEY=/đường/dẫn/file.key)"
  ok "chứng chỉ: $CERT (hết hạn $(openssl x509 -in "$CERT" -noout -enddate 2>/dev/null | cut -d= -f2))"
}

# --------------------------------------------------------------------------- Traefik
install_traefik() {
  need_agent_pkg
  say "Cài Traefik $TRAEFIK_VERSION"
  if [ -x /usr/local/bin/traefik ] && /usr/local/bin/traefik version 2>/dev/null | grep -q "${TRAEFIK_VERSION#v}"; then
    ok "đã có Traefik ${TRAEFIK_VERSION#v}, bỏ qua tải"
  else
    local tmp tgz sums
    tmp="$(mktemp -d)"
    tgz="traefik_${TRAEFIK_VERSION}_linux_amd64.tar.gz"
    sums="traefik_${TRAEFIK_VERSION}_checksums.txt"
    curl -fsSL -o "$tmp/$tgz" "https://github.com/traefik/traefik/releases/download/$TRAEFIK_VERSION/$tgz" \
      || die "Không tải được $tgz (server có ra Internet được không?)"
    curl -fsSL -o "$tmp/$sums" "https://github.com/traefik/traefik/releases/download/$TRAEFIK_VERSION/$sums" \
      || die "Không tải được file checksum"
    (cd "$tmp" && grep " $tgz\$" "$sums" | sha256sum -c - >/dev/null) || die "SHA-256 KHÔNG KHỚP - không cài file này"
    ok "SHA-256 khớp với bản chính thức"
    tar -xzf "$tmp/$tgz" -C /usr/local/bin traefik
    chmod 755 /usr/local/bin/traefik
    rm -rf "$tmp"
    ok "$(/usr/local/bin/traefik version | head -1 | tr -s ' ')"
  fi
  id traefik >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin traefik
  mkdir -p /etc/traefik/dynamic /etc/traefik/certs /var/log/traefik
  [ "$CERT" -ef /etc/traefik/certs/longvan.net.cer ] || cp "$CERT" /etc/traefik/certs/longvan.net.cer
  [ "$KEY" -ef /etc/traefik/certs/longvan.net.key ] || cp "$KEY" /etc/traefik/certs/longvan.net.key
  chown root:traefik /etc/traefik/certs/longvan.net.key
  chmod 640 /etc/traefik/certs/longvan.net.key
  chown -R traefik:traefik /var/log/traefik
  rm -f /etc/traefik/dynamic/dashboard-tam.yml
  install -m 644 "$SRC/traefik.service" /etc/systemd/system/traefik.service
  systemctl daemon-reload
  systemctl enable traefik >/dev/null 2>&1
  ok "service traefik đã enable (agent sẽ tạo cấu hình rồi tự khởi động)"
  if [ -f /etc/logrotate.d ] || [ -d /etc/logrotate.d ]; then
    cat > /etc/logrotate.d/traefik <<'EOF'
/var/log/traefik/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    postrotate
        systemctl kill -s USR1 traefik >/dev/null 2>&1 || true
    endscript
}
EOF
    ok "đã cài logrotate cho log Traefik"
  fi
}

# --------------------------------------------------------------------------- web
need_web_pkg() {
  for f in gw_controller.py gw_templates.py web/index.html bmcproxy.service; do
    [ -e "$SRC/$f" ] || die "Thư mục $SRC là gói AGENT (thiếu $f) - không cài web được. Dùng gói bmc-gateway-web."
  done
}

need_agent_pkg() {
  for f in traefik.service bmcproxy-agent.service; do
    [ -e "$SRC/$f" ] || die "Thư mục $SRC là gói WEB (thiếu $f) - không cài Traefik/agent được. Dùng gói bmc-gateway-agent."
  done
}

load_web_port() {  # da cai web roi thi dung cong trong config.json (tru khi chi dinh WEB_PORT)
  if [ -f "$APP/config.json" ]; then
    local p
    p="$(python3 -c "import json;print(json.load(open('$APP/config.json'))['listen_port'])" 2>/dev/null || true)"
    if [ -n "$p" ] && [ -z "$USER_WEB_PORT" ]; then
      WEB_PORT="$p"
    fi
  fi
}

install_web() {
  need_web_pkg
  load_web_port
  say "Cài web (controller) - cổng $WEB_PORT"
  check_port "$WEB_PORT" "web" "python3" WEB_PORT
  id bmcproxy >/dev/null 2>&1 || useradd --system --home "$APP" --shell /usr/sbin/nologin bmcproxy
  mkdir -p "$APP/data" "$APP/backups" /etc/bmcproxy/certs
  cp "$SRC"/bmcproxy.py "$SRC"/gw_*.py "$APP/"
  rm -rf "$APP/web" && cp -r "$SRC/web" "$APP/web"
  if [ -d "$SRC/agent-package" ]; then  # goi agent cho lenh "cai agent 1 dong" tren web
    rm -rf "$APP/agent-package" && cp -r "$SRC/agent-package" "$APP/agent-package"
    ok "gói agent cho lệnh cài 1 dòng: $(ls "$APP/agent-package")"
  fi
  [ "$CERT" -ef /etc/bmcproxy/certs/longvan.net.cer ] || cp -f "$CERT" /etc/bmcproxy/certs/longvan.net.cer
  [ "$KEY" -ef /etc/bmcproxy/certs/longvan.net.key ] || cp -f "$KEY" /etc/bmcproxy/certs/longvan.net.key
  cp -f "$CERT" /etc/bmcproxy/certs/longvan-vn-2027.crt 2>/dev/null || true
  cp -f "$KEY" /etc/bmcproxy/certs/longvan-vn-2027.key 2>/dev/null || true
  if [ -f "$APP/config.json" ]; then
    python3 - "$APP/config.json" "$WEB_PORT" "$CERT" "$KEY" <<'PY'
import json, sys, os
p, port, cert, key = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
try:
    c = json.load(open(p, encoding="utf-8"))
    changed = False
    if sys.argv[2] and c.get("listen_port") != port:
        c["listen_port"] = port
        changed = True
        print(f"    OK đổi cổng web trong config.json thành {port}")
    c_cert = c.get("tls_cert", "")
    c_key = c.get("tls_key", "")
    if not os.path.isfile(c_cert) or not os.path.isfile(c_key):
        c["tls_cert"] = "/etc/bmcproxy/certs/longvan.net.cer"
        c["tls_key"] = "/etc/bmcproxy/certs/longvan.net.key"
        changed = True
        print(f"    OK cập nhật lại chứng chỉ hợp lệ trong config.json")
    if changed:
        json.dump(c, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
except Exception:
    pass
PY
  fi
  if [ ! -f "$APP/config.json" ]; then
    cat > "$APP/config.json" <<EOF
{
  "listen_host": "0.0.0.0",
  "listen_port": $WEB_PORT,
  "tls_cert": "/etc/bmcproxy/certs/longvan.net.cer",
  "tls_key": "/etc/bmcproxy/certs/longvan.net.key",
  "data_dir": "data",
  "backup_dir": "backups",
  "zabbix_token": "",
  "agent_offline_after": 45
}
EOF
    ok "tạo $APP/config.json"
  fi
  chown -R bmcproxy:bmcproxy "$APP" /etc/bmcproxy
  chmod 600 /etc/bmcproxy/certs/longvan.net.key
  [ -f "$APP/agent.json" ] && chown root:root "$APP/agent.json" && chmod 600 "$APP/agent.json"

  if ! sudo -u bmcproxy python3 -c "import json,sys; sys.exit(0 if json.load(open('$APP/data/users.json')) else 1)" 2>/dev/null; then
    say "Tạo tài khoản quản trị 'admin' cho web (mật khẩu ≥ 10 ký tự)"
    (cd "$APP" && sudo -u bmcproxy python3 bmcproxy.py adduser admin) || die "Chưa tạo được tài khoản"
  else
    ok "đã có tài khoản web, giữ nguyên"
  fi

  if grep -q '"type": *"mysql"' "$APP/config.json" 2>/dev/null && ! python3 -c "import pymysql" 2>/dev/null; then
    apt-get install -y python3-pymysql python3-cryptography >/dev/null && ok "cài python3-pymysql (web đang dùng MySQL)" \
      || die "Không cài được python3-pymysql"
  fi
  if ! python3 -c "import ldap3" 2>/dev/null; then  # dang nhap AD / LDAP (Cai dat -> AD)
    apt-get install -y python3-ldap3 >/dev/null && ok "cài python3-ldap3 (đăng nhập AD / LDAP)"       || warn "Không cài được python3-ldap3 - đăng nhập AD sẽ tắt (apt install -y python3-ldap3)"
  fi
  install -m 644 "$SRC/bmcproxy.service" /etc/systemd/system/bmcproxy.service
  systemctl daemon-reload
  systemctl enable bmcproxy >/dev/null 2>&1
  systemctl restart bmcproxy
  for _ in $(seq 1 15); do
    if [ "$(curl -sk -o /dev/null -w '%{http_code}' "https://127.0.0.1:$WEB_PORT/")" = 200 ]; then
      ok "web chạy: https://127.0.0.1:$WEB_PORT/"
      return
    fi
    sleep 1
  done
  journalctl -u bmcproxy -n 20 --no-pager
  die "Web không khởi động được (xem log ở trên)"
}

# --------------------------------------------------------------------------- site + agent.json (cung may)
bootstrap_site() {
  say "Tạo site trên web và file agent.json"
  [ -n "${SITE:-}" ] || read -rp "    Mã site (a-z, 0-9, -), vd hn: " SITE
  [ -n "${DOMAIN:-}" ] || read -rp "    Tên miền của server, vd proxybb-hn.longvan.net: " DOMAIN
  [ -n "${LABEL:-}" ] || read -rp "    Tên hiển thị, vd Hà Nội: " LABEL
  local token
  token="$(cd "$APP" && SITE="$SITE" DOMAIN="$DOMAIN" LABEL="$LABEL" sudo -E -u bmcproxy python3 - <<'PY'
import os, secrets, sys
sys.path.insert(0, "/opt/bmcproxy")
from gw_common import RE_DOMAIN, RE_SITE_KEY, hash_token
from gw_controller import Store, load_controller_config, new_site_record
site, domain, label = os.environ["SITE"].strip(), os.environ["DOMAIN"].strip(), os.environ["LABEL"].strip()
if not RE_SITE_KEY.match(site):
    sys.exit("Mã site chỉ gồm a-z, 0-9, -")
if not RE_DOMAIN.match(domain):
    sys.exit("Tên miền không hợp lệ")
st = Store(load_controller_config("/opt/bmcproxy/config.json"))
rec = st.sites.get(site) or new_site_record(site, label or site.upper(), domain)
rec["label"], rec["domain"] = label or rec["label"], domain
if "127.0.0.1" not in rec.get("allowed_ips", []):
    rec["allowed_ips"] = list(rec.get("allowed_ips", [])) + ["127.0.0.1"]
token = secrets.token_urlsafe(32)
rec["token_hash"], rec["token_hint"] = hash_token(token), token[-4:]
st.sites[site] = rec
st.save("sites.json")
st.audit("install.sh", "site-add", f"{domain} + token agent", site)
print(token)
PY
)" || die "Không tạo được site"
  write_agent_json "$token" "https://127.0.0.1:$WEB_PORT" false
  ok "site '$SITE' đã tạo, agent.json đã ghi (token mới)"
}

write_agent_json() {  # token controller_url verify_tls
  umask 077
  cat > "$APP/agent.json" <<EOF
{
  "site": "$SITE",
  "controller_url": "$2",
  "token": "$1",
  "verify_tls": $3,
  "poll_interval": 10,
  "auth_listen_host": "127.0.0.1",
  "auth_listen_port": $AUTH_PORT,
  "traefik_static_file": "/etc/traefik/traefik.yml",
  "traefik_dynamic_dir": "/etc/traefik/dynamic",
  "traefik_restart_cmd": ["systemctl", "restart", "traefik"],
  "traefik_stop_cmd": ["systemctl", "stop", "traefik"],
  "traefik_api": "http://127.0.0.1:$API_PORT",
  "nginx_conf_dir": "/etc/nginx/conf.d",
  "nginx_test_cmd": ["nginx", "-t"],
  "nginx_reload_cmd": ["systemctl", "reload", "nginx"],
  "data_dir": "agent-data"
}
EOF
  umask 022
  chown root:root "$APP/agent.json"
  chmod 600 "$APP/agent.json"
}

# --------------------------------------------------------------------------- agent
install_agent() {
  say "Cài agent"
  check_port "$AUTH_PORT" "forwardAuth" "python3" AUTH_PORT
  check_port "$API_PORT" "API Traefik" "traefik" API_PORT
  mkdir -p "$APP"
  for f in $AGENT_FILES; do
    [ -f "$SRC/$f" ] || die "Gói thiếu $f - dùng gói bmc-gateway-agent"
    cp "$SRC/$f" "$APP/"
  done
  if [ -d "$SRC/kvm" ] && [ "$SRC" != "$APP" ]; then
    rm -rf "$APP/kvm" && cp -r "$SRC/kvm" "$APP/kvm"
  fi
  if [ ! -f "$APP/agent.json" ] || [ "${FORCE_AGENT_JSON:-}" = 1 ]; then
    local src="${AGENT_JSON:-/root/agent.json}"
    [ -f "$src" ] || die "Chưa có agent.json. Trên web: Site → + Thêm site → Sao chép, dán vào $src (nano $src) rồi chạy lại."
    install -m 600 -o root -g root "$src" "$APP/agent.json"
    ok "dùng $src"
  fi
  python3 - "$APP/agent.json" "$API_PORT" "$AUTH_PORT" <<'PY' || die "agent.json không hợp lệ (JSON sai?)"
import json, sys
p, api, auth = sys.argv[1], sys.argv[2], int(sys.argv[3])
c = json.load(open(p, encoding="utf-8"))
c.setdefault("traefik_api", f"http://127.0.0.1:{api}")
c.setdefault("auth_listen_port", auth)
for k in ("site", "controller_url", "token"):
    if not c.get(k):
        sys.exit(f"thiếu {k}")
json.dump(c, open(p, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"    site={c['site']} controller={c['controller_url']} traefik_api={c['traefik_api']}")
PY
  say "Thử kết nối agent → web"
  (cd "$APP" && python3 bmcproxy.py agent -c agent.json --once) || die "Agent chạy lỗi (xem ở trên)"
  install -m 644 "$SRC/bmcproxy-agent.service" /etc/systemd/system/bmcproxy-agent.service
  systemctl daemon-reload
  systemctl enable bmcproxy-agent >/dev/null 2>&1
  systemctl restart bmcproxy-agent
  sleep 4
  if journalctl -u bmcproxy-agent -n 20 --no-pager | grep -q "đã kết nối controller"; then
    ok "agent đã kết nối web"
  else
    journalctl -u bmcproxy-agent -n 20 --no-pager
    die "Agent chưa kết nối được web (xem log ở trên)"
  fi
}

# --------------------------------------------------------------------------- go cai dat
uninstall() {
  say "GỠ Treafix Proxy BB + Traefik trên máy này"
  echo "    Sẽ: dừng service, trả lại file nginx cũ, xoá /opt/bmcproxy /etc/bmcproxy /etc/traefik"
  echo "        /var/log/traefik /usr/local/bin/traefik (có sao lưu trước). nginx KHÔNG bị gỡ."
  read -rp "    Gõ XOA để tiếp tục: " ans
  [ "$ans" = "XOA" ] || die "Đã huỷ"
  local bk="/root/bmcproxy-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$bk"
  for d in /opt/bmcproxy /etc/bmcproxy /etc/traefik; do
    [ -e "$d" ] && cp -a "$d" "$bk/" && ok "sao lưu $d"
  done
  for s in bmcproxy-agent bmcproxy traefik; do
    systemctl disable --now "$s" >/dev/null 2>&1 && ok "dừng $s" || true
    rm -f "/etc/systemd/system/$s.service"
  done
  systemctl daemon-reload
  local n=0
  shopt -s nullglob
  for f in /etc/nginx/conf.d/*.disabled-by-bmcproxy; do
    mv "$f" "${f%.disabled-by-bmcproxy}"
    n=$((n + 1))
  done
  shopt -u nullglob
  if [ "$n" -gt 0 ]; then
    nginx -t && systemctl reload nginx && ok "bật lại $n file nginx cũ, nginx đã reload"
  else
    ok "không có file nginx nào bị tắt"
  fi
  command -v docker >/dev/null 2>&1 && docker ps -aq --filter label=bmcproxy=kvm | xargs -r docker rm -f >/dev/null 2>&1 || true
  rm -rf /opt/bmcproxy /etc/bmcproxy /etc/traefik /var/log/traefik /usr/local/bin/traefik /etc/logrotate.d/traefik
  userdel bmcproxy >/dev/null 2>&1 || true
  userdel traefik >/dev/null 2>&1 || true
  ok "đã gỡ xong. Bản sao lưu: $bk"
}

# --------------------------------------------------------------------------- go Traefik + agent, giu web
remove_agent() {
  say "GỠ Traefik + agent trên máy này (GIỮ web và dữ liệu web)"
  echo "    Sẽ: dừng traefik + bmcproxy-agent, trả lại file nginx cũ, xoá /etc/traefik,"
  echo "        /usr/local/bin/traefik, agent.json, agent-data. Web (/opt/bmcproxy/data) giữ nguyên."
  read -rp "    Gõ XOA để tiếp tục: " ans
  [ "$ans" = "XOA" ] || die "Đã huỷ"
  local bk="/root/bmcproxy-agent-backup-$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$bk"
  [ -d /etc/traefik ] && cp -a /etc/traefik "$bk/" && ok "sao lưu /etc/traefik"
  [ -f "$APP/agent.json" ] && cp -a "$APP/agent.json" "$bk/" && ok "sao lưu agent.json"
  [ -d "$APP/agent-data" ] && cp -a "$APP/agent-data" "$bk/" && ok "sao lưu agent-data"
  for s in bmcproxy-agent traefik; do
    systemctl disable --now "$s" >/dev/null 2>&1 && ok "dừng $s" || true
    rm -f "/etc/systemd/system/$s.service"
  done
  systemctl daemon-reload
  local n=0
  shopt -s nullglob
  for f in /etc/nginx/conf.d/*.disabled-by-bmcproxy; do
    mv "$f" "${f%.disabled-by-bmcproxy}"
    n=$((n + 1))
  done
  shopt -u nullglob
  if [ "$n" -gt 0 ]; then
    nginx -t && systemctl reload nginx && ok "bật lại $n file nginx cũ, nginx đã reload"
  fi
  rm -rf /etc/traefik /var/log/traefik /usr/local/bin/traefik /etc/logrotate.d/traefik \
         "$APP/agent.json" "$APP/agent-data"
  userdel traefik >/dev/null 2>&1 || true
  ok "đã gỡ Traefik + agent. Bản sao lưu: $bk"
  if systemctl is-active bmcproxy >/dev/null 2>&1; then
    ok "web vẫn chạy: https://127.0.0.1:$WEB_PORT/"
    echo "    Nhớ: trên web, site từng chạy trên máy này sẽ báo mất liên lạc."
    echo "         Vào Site → Sửa để đổi IP được phép sang server mới, rồi cài agent ở server đó."
  fi
}

# --------------------------------------------------------------------------- link web bi mat
secret_url() {
  load_web_port
  [ -f "$APP/config.json" ] || die "Chưa cài web trên máy này (chạy install.sh web trước)"
  local wp
  if [ "${1:-}" = off ]; then
    wp=""
  elif [ -n "${WEB_PATH:-}" ]; then
    wp="/${WEB_PATH#/}"
  else
    wp="/$(python3 -c 'import secrets; print(secrets.token_urlsafe(12))')"
  fi
  python3 - "$APP/config.json" "$wp" <<'PY' || die "Đường dẫn không hợp lệ (6-64 ký tự chữ, số, - _)"
import json, re, sys
path, wp = sys.argv[1], sys.argv[2]
if wp and not re.fullmatch(r"/[A-Za-z0-9_-]{6,64}", wp):
    sys.exit(1)
c = json.load(open(path, encoding="utf-8"))
c["web_path"] = wp
json.dump(c, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
PY
  systemctl restart bmcproxy
  sleep 2
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  if [ -n "$wp" ]; then
    ok "đã bật link bí mật. Link vào web (lưu lại, không gửi công khai):"
    echo "        https://${ip:-<ip-server>}:$WEB_PORT$wp/"
    echo "    https://${ip:-<ip-server>}:$WEB_PORT/  giờ trả 404. Agent, lệnh cài agent, API Zabbix không đổi."
    echo "    Đổi link khác: sudo bash $0 secret-url   ·   Tắt: sudo bash $0 secret-url off"
  else
    ok "đã tắt link bí mật: https://${ip:-<ip-server>}:$WEB_PORT/"
  fi
  printf '    kiểm tra: %s\n' "$(curl -sk -o /dev/null -w 'HTTP %{http_code}' "https://127.0.0.1:$WEB_PORT$wp/")"
}

# --------------------------------------------------------------------------- MySQL cho web
install_db() {
  say "Lưu dữ liệu web vào MySQL"
  [ -f "$APP/config.json" ] || die "Chưa cài web trên máy này (chạy install.sh web trước)"
  if ! python3 -c "import pymysql" 2>/dev/null; then
    apt-get install -y python3-pymysql python3-cryptography >/dev/null || die "Không cài được python3-pymysql (apt install -y python3-pymysql)"
    ok "đã cài python3-pymysql"
  fi
  local h p u d pw
  read -rp "    MySQL host [${DB_HOST:-127.0.0.1}]: " h; h="${h:-${DB_HOST:-127.0.0.1}}"
  read -rp "    Cổng [${DB_PORT:-3306}]: " p; p="${p:-${DB_PORT:-3306}}"
  read -rp "    Tài khoản [${DB_USER:-bmcproxy}]: " u; u="${u:-${DB_USER:-bmcproxy}}"
  read -rp "    Database [${DB_NAME:-bmcproxy}]: " d; d="${d:-${DB_NAME:-bmcproxy}}"
  read -rsp "    Mật khẩu MySQL (không hiện khi gõ): " pw; echo
  [ -n "$pw" ] || die "Chưa nhập mật khẩu"
  install -d -m 750 -o root -g bmcproxy /etc/bmcproxy
  ( umask 077; printf '%s' "$pw" > /etc/bmcproxy/db.pass )
  chown bmcproxy:bmcproxy /etc/bmcproxy/db.pass
  chmod 600 /etc/bmcproxy/db.pass
  unset pw
  ok "mật khẩu lưu ở /etc/bmcproxy/db.pass (chmod 600, không nằm trong config.json)"
  say "Thử kết nối MySQL $u@$h:$p/$d"
  # Uu tien ket noi ma hoa TLS (MySQL 8 co san). DB_SSL_CA=/duong/dan/ca.pem de kiem tra chung chi MySQL.
  rm -f /tmp/.bmcproxy-db-mode
  sudo -u bmcproxy DB_SSL_CA="${DB_SSL_CA:-}" python3 - "$h" "$p" "$u" "$d" <<'PY' || die "Không kết nối được MySQL (xem lỗi ở trên). config.json chưa bị đổi."
import os, ssl, sys, pymysql
h, p, u, d = sys.argv[1], int(sys.argv[2]), sys.argv[3], sys.argv[4]
pw = open("/etc/bmcproxy/db.pass").read().strip()
ca = os.environ.get("DB_SSL_CA") or ""
ctx = ssl.create_default_context(cafile=ca or None)
if not ca:  # chung chi tu ky mac dinh cua MySQL: van ma hoa, khong kiem tra ten
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
mode = "tls"
try:
    try:
        c = pymysql.connect(host=h, port=p, user=u, password=pw, database=d, connect_timeout=8, ssl=ctx)
    except pymysql.err.OperationalError as e:
        if e.args and e.args[0] in (1045, 1049):
            raise
        print(f"    !! MySQL không nhận TLS ({e.args[1] if len(e.args) > 1 else e}) - thử không mã hoá")
        mode = "plain"
        c = pymysql.connect(host=h, port=p, user=u, password=pw, database=d, connect_timeout=8)
except pymysql.err.OperationalError as e:
    code = e.args[0] if e.args else 0
    hint = {1045: "sai tài khoản / mật khẩu, hoặc user không được phép từ IP máy này",
            1049: f"chưa có database '{d}' (CREATE DATABASE {d} CHARACTER SET utf8mb4)",
            2003: "không tới được cổng MySQL (firewall / bind-address / sai IP)"}.get(code, "")
    sys.exit(f"    LỖI MySQL {code}: {e.args[1] if len(e.args) > 1 else e}" + (f"\n    -> {hint}" if hint else ""))
cur = c.cursor(); cur.execute("SELECT VERSION()"); print("    OK MySQL", cur.fetchone()[0])
cur.execute("SHOW SESSION STATUS LIKE 'Ssl_cipher'"); row = cur.fetchone()
if mode == "tls" and row and row[1]:
    print(f"    OK kết nối mã hoá TLS ({row[1]})" + (", đã kiểm tra chứng chỉ" if ca else ""))
else:
    mode = "plain"
    print("    !! kết nối KHÔNG mã hoá - bật TLS trên MySQL (MySQL 8 có sẵn), hoặc chỉ dùng trong mạng riêng / VPN")
open("/tmp/.bmcproxy-db-mode", "w").write(mode)
cur.execute("CREATE TABLE IF NOT EXISTS bmcproxy_check (id INT PRIMARY KEY)"); cur.execute("DROP TABLE bmcproxy_check")
print("    OK có quyền tạo bảng")
PY
  cp -a "$APP/config.json" "$APP/config.json.bak-$(date +%Y%m%d-%H%M%S)"
  local mode; mode="$(cat /tmp/.bmcproxy-db-mode 2>/dev/null || echo plain)"; rm -f /tmp/.bmcproxy-db-mode
  python3 - "$APP/config.json" "$h" "$p" "$u" "$d" "$mode" "${DB_SSL_CA:-}" <<'PY'
import json, sys
path, h, p, u, d, mode, ca = sys.argv[1:8]
c = json.load(open(path, encoding="utf-8"))
c["db"] = {"type": "mysql", "host": h, "port": int(p), "user": u, "database": d,
           "password_file": "/etc/bmcproxy/db.pass", "ssl": mode == "tls", "ssl_verify": bool(ca), "ssl_ca": ca}
json.dump(c, open(path, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print("    OK config.json: db -> mysql")
PY
  systemctl restart bmcproxy
  sleep 3
  if journalctl -u bmcproxy -n 30 --no-pager | grep -q "dữ liệu: mysql"; then
    ok "web đã chạy với MySQL"
    journalctl -u bmcproxy -n 30 --no-pager | grep -E "đã chuyển|dữ liệu:" | sed 's/^/    /'
  else
    journalctl -u bmcproxy -n 20 --no-pager | sed 's/^/    /'
    die "web chưa chạy được với MySQL - xem log ở trên. Quay lại JSON: xoá khối \"db\" trong $APP/config.json rồi systemctl restart bmcproxy"
  fi
}

# --------------------------------------------------------------------------- console Java tren web
install_kvm() {
  say "Console Java trên web: build image Docker $KVM_IMAGE"
  command -v docker >/dev/null 2>&1 || die "Chưa có Docker. Cài: apt install -y docker.io && systemctl enable --now docker"
  local d="$SRC/kvm"
  [ -f "$d/Dockerfile" ] || d="$APP/kvm"
  [ -f "$d/Dockerfile" ] || die "Gói thiếu thư mục kvm/ - dùng gói bmc-gateway-agent mới"
  docker build -t "$KVM_IMAGE" "$d" || die "build lỗi (server cần ra Internet để tải ubuntu:20.04 + gói apt)"
  ok "image: $(docker image ls --format '{{.Repository}}:{{.Tag}}  {{.Size}}' "$KVM_IMAGE")"
  if [ -f "$APP/agent.json" ]; then
    systemctl restart bmcproxy-agent && ok "restart agent"
  fi
  echo "    Tiếp theo trên web: BMC → Sửa → bật 'Mở console Java ngay trên web'"
  echo "    (hoặc chọn mẫu 'QCT / AMI MegaRAC (console Java trên web)') → Lưu → Áp dụng."
  echo "    Không cần mở cổng TCP nào thêm: noVNC đi qua chính cổng web của BMC."
}

# --------------------------------------------------------------------------- trang thai
status() {
  load_web_port
  say "Trạng thái"
  for s in bmcproxy bmcproxy-agent traefik nginx; do
    printf '    %-16s %s\n' "$s" "$(timeout 5 systemctl is-active "$s" 2>/dev/null || true)"
  done
  local api
  api="$(python3 -c "import json;print(json.load(open('$APP/agent.json'))['traefik_api'])" 2>/dev/null || echo "http://127.0.0.1:$API_PORT")"
  printf '    %-16s %s\n' "web" "$(curl -sk -o /dev/null -w 'HTTP %{http_code}' --max-time 5 "https://127.0.0.1:$WEB_PORT/" || true)"
  printf '    %-16s %s\n' "API Traefik" "$(curl -s --max-time 5 "$api/api/version" || echo 'không phản hồi')"
  if command -v docker >/dev/null 2>&1; then
    printf '    %-16s %s\n' "image kvm" "$(docker image ls -q "$KVM_IMAGE" | grep -q . && echo "có ($KVM_IMAGE)" || echo "chưa có (sudo bash install.sh kvm)")"
    printf '    %-16s %s\n' "console Java" "$(docker ps -q --filter label=bmcproxy=kvm | wc -l) container đang mở"
  fi
  printf '    %-16s %s\n' "nginx đã tắt" "$(find /etc/nginx/conf.d -name '*.disabled-by-bmcproxy' 2>/dev/null | wc -l) file"
  echo "    log agent:"
  timeout 5 journalctl -u bmcproxy-agent -n 5 --no-pager 2>/dev/null | sed 's/^/      /' || true
}

# --------------------------------------------------------------------------- main
cmd="${1:-}"
case "$cmd" in
  uninstall) need_root; uninstall ;;
  remove-agent) need_root; remove_agent ;;
  all)
    need_root; check_base; check_cert; need_web_pkg; need_agent_pkg
    install_traefik; install_web; bootstrap_site; install_agent
    say "XONG"
    echo "    Web:  https://$DOMAIN:$WEB_PORT/  (hoặc https://<ip-server>:$WEB_PORT/) - đăng nhập admin"
    echo "    Tiếp theo trên web: Site → '$SITE' → Nhập từ nginx → kiểm tra BMC → Xem & áp dụng"
    echo "    Nhớ mở firewall cổng $WEB_PORT cho IP của bạn: ufw allow from <ip-của-bạn> to any port $WEB_PORT proto tcp"
    ;;
  web)   need_root; check_base; check_cert /etc/bmcproxy/certs; install_web
    say "XONG - vào https://<ip-server>:$WEB_PORT/ để thêm site" ;;
  agent) need_root; check_base; check_cert /etc/traefik/certs; install_traefik; install_agent
    say "XONG - trên web, site đã trực tuyến. Tiếp theo: Nhập từ nginx → Xem & áp dụng" ;;
  kvm) need_root; install_kvm ;;
  db) need_root; install_db ;;
  secret-url) need_root; secret_url "${2:-}" ;;
  status) status ;;
  *) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
