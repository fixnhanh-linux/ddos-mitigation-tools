#!/bin/sh
# Man hinh ao :1 -> x11vnc (chi trong container) -> websockify + noVNC cong 6080.
# Container tu dung khi dong cua so Java hoac qua KVM_MAX_SECONDS.
W=${KVM_WIDTH:-1600}
H=${KVM_HEIGHT:-1000}
export DISPLAY=:1

Xvfb :1 -screen 0 "${W}x${H}x24" -nolisten tcp >/tmp/xvfb.log 2>&1 &
i=0
while [ ! -e /tmp/.X11-unix/X1 ] && [ $i -lt 100 ]; do sleep 0.1; i=$((i + 1)); done

openbox >/tmp/openbox.log 2>&1 &
# Mat khau VNC ngau nhien do agent tao cho moi lan Launch (chi trinh duyet da bam Launch biet)
if [ -n "${KVM_VNC_PASSWORD:-}" ]; then
  x11vnc -storepasswd "$KVM_VNC_PASSWORD" /tmp/vncpass >/dev/null 2>&1
  unset KVM_VNC_PASSWORD
  VNCAUTH="-rfbauth /tmp/vncpass"
else
  VNCAUTH="-nopw"
fi
x11vnc -display :1 -rfbport 5900 -localhost $VNCAUTH -forever -shared -quiet -noxdamage >/tmp/x11vnc.log 2>&1 &
websockify --web /usr/share/novnc 6080 localhost:5900 >/tmp/websockify.log 2>&1 &

timeout "${KVM_MAX_SECONDS:-14400}" python3 /opt/kvm/jnlp_run.py /kvm/viewer.jnlp
echo "console Java da dong (ma $?)"
sleep 2
