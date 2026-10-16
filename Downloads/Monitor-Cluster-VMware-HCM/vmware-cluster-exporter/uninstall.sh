#!/usr/bin/env bash
# Go cai dat vmware-cluster-exporter (KHONG dung toi esxi-host-exporter):
#   sudo ./uninstall.sh            (go tat ca instance)
#   sudo ./uninstall.sh pool18     (chi go 1 instance)
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "can chay bang root: sudo ./uninstall.sh" >&2; exit 1; }

if [ $# -gt 0 ]; then
  systemctl disable --now "vmware-cluster-exporter@$1" 2>/dev/null || true
  rm -f "/etc/vmware-cluster-exporter/$1.env"
  echo "Da go instance $1."
  exit 0
fi

for unit in $(systemctl list-units --all --plain --no-legend 'vmware-cluster-exporter@*' | awk '{print $1}'); do
  systemctl disable --now "$unit" 2>/dev/null || true
done
rm -f /etc/systemd/system/vmware-cluster-exporter@.service
systemctl daemon-reload
rm -rf /opt/vmware-cluster-exporter /etc/vmware-cluster-exporter
userdel vmware-cluster 2>/dev/null || true
echo "Da go toan bo vmware-cluster-exporter."
