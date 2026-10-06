#!/bin/bash
# Script tu dong cau hinh theo doi Ceph bang Zabbix Agent 2 dong loat tren nhieu server Proxmox

# Kiem tra va cai dat sshpass de ho tro dang nhap tu dong bang mat khau
if ! command -v sshpass &> /dev/null; then
    echo "[*] sshpass chua duoc cai dat. Dang tien hanh cai dat sshpass..."
    apt-get update -y > /dev/null 2>&1
    apt-get install sshpass -y > /dev/null 2>&1
fi

# 1. Nhap IP cua Zabbix Server hoac Proxy
read -p "Nhap IP cua Zabbix Server hoac Proxy (mac dinh: 10.8.10.201): " INPUT_IP
ZABBIX_SERVER_IP=${INPUT_IP:-10.8.10.201}

# 2. Nhap danh sach IP cua cac node Proxmox
read -p "Nhap danh sach IP cac node Proxmox (cach nhau bang khoang trang, VD: 10.0.0.1 10.0.0.2): " PROXMOX_NODES

if [ -z "$PROXMOX_NODES" ]; then
    echo "Loi: Ban chua nhap danh sach IP cac node Proxmox!"
    exit 1
fi

# 3. Nhap mat khau root (Dung chung cho tat ca cac node)
read -s -p "Nhap mat khau root cua cac node Proxmox (nhap 1 lan, dung chung cho tat ca): " SSH_PASSWORD
echo ""

if [ -z "$SSH_PASSWORD" ]; then
    echo "Loi: Ban chua nhap mat khau root!"
    exit 1
fi

echo "============================================================"
echo "Bat dau trien khai Zabbix Agent 2 (IP Server: $ZABBIX_SERVER_IP)"
echo "Danh sach cac node se xu ly: $PROXMOX_NODES"
echo "============================================================"

# Vong lap SSH toi tung node va chay cau hinh
for node in $PROXMOX_NODES; do
    echo ""
    echo ">>> DANG XU LY TREN NODE: $node <<<"
    
    # Dung sshpass de tu dong nhap mat khau root
    sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$node" "bash -s" -- "$ZABBIX_SERVER_IP" << 'EOF'
# Lay tham so ZABBIX_SERVER_IP duoc truyen vao
ZABBIX_SERVER_IP=$1

echo "=== BAT DAU CAU HINH ZABBIX AGENT 2 CHO CEPH ==="

# 1. Kiem tra xem zabbix-agent2 da cai chua
if dpkg -l | grep -qw "zabbix-agent2"; then
    echo "[*] Zabbix Agent 2 da duoc cai dat. Bo qua buoc cai dat."
else
    echo "[*] Zabbix Agent 2 chua duoc cai dat. Tien hanh cai dat..."
    apt update > /dev/null 2>&1
    apt install zabbix-agent2 -y > /dev/null 2>&1
fi

# 2. Cau hinh file zabbix_agent2.conf
CONF_FILE="/etc/zabbix/zabbix_agent2.conf"
if [ -f "$CONF_FILE" ]; then
    echo "[*] Dang cau hinh file $CONF_FILE ..."
    # Backup file config cu
    cp "$CONF_FILE" "${CONF_FILE}.bak"

    # Xoa cau hinh cu neu co va them cau hinh moi
    sed -i "s/^Server=.*/Server=${ZABBIX_SERVER_IP}/g" "$CONF_FILE"
    sed -i "s/^ServerActive=.*/ServerActive=${ZABBIX_SERVER_IP}/g" "$CONF_FILE"

    # Them cau hinh Ceph neu chua co
    grep -q "^Plugins.Ceph.InsecureSkipVerify=" "$CONF_FILE" || echo "Plugins.Ceph.InsecureSkipVerify=true" >> "$CONF_FILE"
    grep -q "^AllowKey=system.run\[\*\]" "$CONF_FILE" || echo "AllowKey=system.run[*]" >> "$CONF_FILE"
else
    echo "[!] Loi: Khong tim thay file $CONF_FILE. Vui long kiem tra lai."
    exit 1
fi

# 3. Tao cac file script check Ceph Health
echo "[*] Dang tao cac script lay trang thai Ceph..."
mkdir -p /etc/zabbix/
touch /etc/zabbix/cephstatus.txt

# Tao script lay trang thai ceph
cat << 'INNER_EOF' > /etc/zabbix/cephstatus.sh
#!/bin/sh
ceph health > /etc/zabbix/cephstatus.txt
date >> /etc/zabbix/cephstatus.txt
INNER_EOF

# Tao script doc trang thai ceph
cat << 'INNER_EOF' > /etc/zabbix/docfile.sh
#!/bin/sh
value=$(cat /etc/zabbix/cephstatus.txt)
echo "$value"
INNER_EOF

# Phan quyen thuc thi
chmod +x /etc/zabbix/cephstatus.txt
chmod +x /etc/zabbix/cephstatus.sh
chmod +x /etc/zabbix/docfile.sh

# Chay thu lan dau de co file txt
/etc/zabbix/cephstatus.sh 2>/dev/null || echo "[!] Lenh ceph health khong thanh cong (Node nay co the khong chay Ceph Monitor)."

# 4. Them vao crontab (Cronjob chay moi phut)
echo "[*] Dang thiet lap cronjob..."
CRON_JOB="* * * * * /etc/zabbix/cephstatus.sh"
(crontab -l 2>/dev/null | grep -v -F "/etc/zabbix/cephstatus.sh"; echo "$CRON_JOB") | crontab -

# 5. Khoi dong lai dich vu
echo "[*] Dang khoi dong lai dich vu Zabbix Agent 2..."
systemctl restart zabbix-agent2
systemctl enable zabbix-agent2

echo "=== CAU HINH HOAN TAT TREN NODE NAY ==="
EOF

done

echo ""
echo "============================================================"
echo "TAT CA CAC NODE DA DUOC XU LY ZABBIX AGENT XONG!"
echo "============================================================"

# Chay cau hinh Ceph RESTful API tren Node dau tien de lay API Key
FIRST_NODE=$(echo $PROXMOX_NODES | awk '{print $1}')
echo ""
echo ">>> DANG TAI API KEY TU CEPH MANAGER (Node: $FIRST_NODE) <<<"
sshpass -p "$SSH_PASSWORD" ssh -o StrictHostKeyChecking=no root@"$FIRST_NODE" "bash -s" << 'EOF'
echo "[*] Kich hoat module restful cho Ceph..."
ceph mgr module enable restful 2>/dev/null

echo "[*] Tao API Key cho user 'zabbix-monitor'..."
ceph restful create-key zabbix-monitor 2>/dev/null

echo "[*] Tao chung chi tu ky (self-signed cert)..."
ceph restful create-self-signed-cert 2>/dev/null

echo "[*] Khoi dong lai dich vu restful..."
ceph restful restart 2>/dev/null

echo ""
echo "********************************************************************"
echo "           THONG TIN DE CAU HINH TREN GIAO DIEN ZABBIX WEB"
echo "********************************************************************"
# Lay API Key ra tu list-keys
API_KEY=$(ceph restful list-keys | grep "zabbix-monitor" | cut -d'"' -f4)
echo "1. Macro {\$CEPH.API.KEY} = $API_KEY"
echo "2. Macro {\$CEPH.USER}    = zabbix-monitor"

# Lay dia chi URL cua API
MGR_URL=$(ceph mgr services | grep restful | cut -d'"' -f4)
if [ -z "$MGR_URL" ]; then
    echo "3. Macro {\$CEPH.API.URL} = https://<IP_NODE_DANG_CHAY_MGR>:8003"
else
    echo "3. Macro {\$CEPH.API.URL} = $MGR_URL"
fi
echo "********************************************************************"
EOF

echo ""
echo "XONG! Ban hay copy thong tin trong khung tren de paste vao Zabbix."
