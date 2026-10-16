#!/usr/bin/env bash
# Cai dat VMware cluster exporter (Prometheus, dashboard "VMWARE CLUSTER HCM") len Linux co systemd.
# Cai SONG SONG voi esxi-host-exporter: thu muc, service, user, port deu rieng - khong dung toi ban cu.
#
#   sudo ./install.sh                 # hoi tung thong tin
#   sudo NAME=pool18 VC=10.2.164.18 VC_USER=monitor_vsan@vsphere.local CLUSTER=- PORT=9821 ./install.sh
#
# Chay lai voi NAME khac de them vCenter/cluster khac (moi instance 1 port).
# Chay lai voi cung NAME de cap nhat code / doi mat khau.
set -euo pipefail

APP=/opt/vmware-cluster-exporter
CONF=/etc/vmware-cluster-exporter
UNIT=vmware-cluster-exporter@.service
SVC=vmware-cluster-exporter
SVC_USER=vmware-cluster
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

die() { echo "LOI: $*" >&2; exit 1; }
ask() {  # ask BIEN "Cau hoi" "mac dinh"
  local var=$1 q=$2 def=${3:-} val=${!1:-}
  if [ -z "$val" ]; then
    read -r -p "$q${def:+ [$def]}: " val
    val=${val:-$def}
  fi
  [ -n "$val" ] || die "$q khong duoc de trong"
  printf -v "$var" '%s' "$val"
}

[ "$(id -u)" -eq 0 ] || die "can chay bang root: sudo ./install.sh"
command -v systemctl >/dev/null || die "may nay khong co systemd"
command -v python3 >/dev/null || die "chua co python3 (Ubuntu/Debian: apt install python3 | RHEL: dnf install python3)"
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 8) else 1)' \
  || die "can Python >= 3.8 (dang co $(python3 -V 2>&1))"

echo "== Cai dat VMware cluster exporter $(cat "$SRC/VERSION") =="
ask NAME     "Ten instance (vd: pool18, chi chu/so/-)" "pool18"
[[ "$NAME" =~ ^[A-Za-z0-9_-]+$ ]] || die "ten instance chi gom chu, so, - va _"
ask VC       "IP/hostname vCenter" "10.2.164.18"
ask VC_USER  "User vCenter (chi can quyen Read-only)" "monitor_vsan@vsphere.local"
ask CLUSTER  "Cluster (- = tat ca cluster)" "-"
ask PORT     "Port metrics (khac port esxi-host-exporter 9811-9814)" "9821"
ask INTERVAL "Chu ky lay du lieu (giay)" "60"
[[ "$PORT" =~ ^[0-9]+$ && "$INTERVAL" =~ ^[0-9]+$ ]] || die "PORT va INTERVAL phai la so"
if command -v ss >/dev/null && ss -ltnH "sport = :$PORT" | grep -q . && ! systemctl is-active --quiet "$SVC@$NAME"; then
  die "port $PORT dang duoc chuong trinh khac dung (vd esxi-host-exporter) - chon port khac"
fi

ENV_FILE="$CONF/$NAME.env"
if [ -z "${VC_PASS:-}" ]; then
  if [ -f "$ENV_FILE" ] && grep -q '^VC_PASS=' "$ENV_FILE"; then
    read -r -s -p "Mat khau vCenter (Enter = giu mat khau cu): " VC_PASS; echo
  else
    read -r -s -p "Mat khau vCenter: " VC_PASS; echo
    [ -n "$VC_PASS" ] || die "mat khau khong duoc de trong"
  fi
fi

echo "-> Chep chuong trinh vao $APP"
install -d -m 755 "$APP" "$APP/vendor"
install -m 644 "$SRC/app/vmware_cluster_exporter.py" "$APP/"
install -m 755 "$SRC/uninstall.sh" "$APP/uninstall.sh"
rm -rf "$APP/vendor"/*
cp -r "$SRC/vendor/." "$APP/vendor/"
chmod -R a+rX "$APP"

echo "-> Kiem tra thu vien pyVmomi"
PYTHONPATH="$APP/vendor" python3 -c 'import pyVmomi, pyVim.connect; from pyVmomi import vim; vim.cluster.VsanVcClusterHealthSystem' \
  || die "khong import duoc pyVmomi tu $APP/vendor"

if ! id "$SVC_USER" >/dev/null 2>&1; then
  echo "-> Tao user he thong $SVC_USER"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SVC_USER" 2>/dev/null \
    || useradd -r -M -s /sbin/nologin "$SVC_USER"
fi

echo "-> Ghi cau hinh $ENV_FILE (chi root doc duoc)"
install -d -m 700 "$CONF"
OLD_PASS_LINE=""
if [ -z "$VC_PASS" ] && [ -f "$ENV_FILE" ]; then
  OLD_PASS_LINE=$(grep '^VC_PASS=' "$ENV_FILE")
fi
quote() {  # dua gia tri vao EnvironmentFile cua systemd an toan voi moi ky tu dac biet
  local s=$1
  if [[ "$s" != *"'"* ]]; then
    printf "'%s'" "$s"            # nhay don: systemd giu nguyen moi ky tu
  else
    s=${s//\\/\\\\}; s=${s//\"/\\\"}; s=${s//\$/\\\$}
    printf '"%s"' "$s"
  fi
}
umask 077
{
  echo "# Tao boi install.sh luc $(date '+%F %T') - KHONG chia se file nay"
  echo "VC=$(quote "$VC")"
  echo "VC_USER=$(quote "$VC_USER")"
  echo "CLUSTER=$(quote "$CLUSTER")"
  echo "PORT=$PORT"
  echo "INTERVAL=$INTERVAL"
  if [ -n "$OLD_PASS_LINE" ]; then echo "$OLD_PASS_LINE"; else echo "VC_PASS=$(quote "$VC_PASS")"; fi
  echo "# Chu ky lay vSAN Skyline Health (giay):"
  echo "#VC_SLOW_INTERVAL=300"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"; chown root:root "$ENV_FILE"
umask 022

echo "-> Cai systemd unit"
install -m 644 "$SRC/$UNIT" "/etc/systemd/system/$UNIT"
systemctl daemon-reload
systemctl enable "$SVC@$NAME" >/dev/null 2>&1
systemctl restart "$SVC@$NAME"

echo "-> Cho exporter lay du lieu lan dau (toi da 3 phut)..."
ok=""
for _ in $(seq 1 36); do
  sleep 5
  systemctl is-active --quiet "$SVC@$NAME" || break
  if python3 - "$PORT" <<'EOF' 2>/dev/null; then ok=1; break; fi
import sys, urllib.request
t = urllib.request.urlopen("http://127.0.0.1:%s/metrics" % sys.argv[1], timeout=5).read().decode()
sys.exit(0 if "\nvmware_cluster_exporter_up 1" in t else 1)
EOF
done

echo
journalctl -u "$SVC@$NAME" -n 5 --no-pager || true
echo
if [ -n "$ok" ]; then
  IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  echo "OK - exporter dang chay."
  echo "   Prometheus : http://${IP:-<ip-may-nay>}:$PORT/metrics"
  echo "   Log        : journalctl -u $SVC@$NAME -f"
  echo "   Go cai dat : sudo $APP/uninstall.sh $NAME   (bo ten = go tat ca)"
  echo "   Mo firewall neu can: ufw allow $PORT/tcp   |   firewall-cmd --add-port=$PORT/tcp --permanent && firewall-cmd --reload"
elif systemctl is-active --quiet "$SVC@$NAME"; then
  echo "Service dang chay nhung chua lay xong du lieu (vCenter cham?). Theo doi: journalctl -u $SVC@$NAME -f"
else
  code=$(systemctl show -p ExecMainStatus --value "$SVC@$NAME")
  [ "$code" = "3" ] && die "dang nhap vCenter that bai (sai user/mat khau). Chay lai: sudo ./install.sh voi NAME=$NAME"
  die "service khong chay duoc - xem: journalctl -u $SVC@$NAME -n 50"
fi
