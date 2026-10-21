# Image chay console Java cua BMC (JViewer, iDRAC, iLO...) tren server proxy va hien len web qua noVNC.
#   Cach 1: goi java truc tiep; cach 2 (du phong, ca applet): IcedTea-Web javaws.
#   Java 8 + Xvfb (man hinh ao) + x11vnc + websockify/noVNC (cong 6080 trong container).
# Build:  sudo bash install.sh kvm      (hoac: docker build -t bmcgw-kvm:1 kvm/)
FROM ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive LANG=C.UTF-8 \
    JAVA_HOME=/usr/lib/jvm/java-8-openjdk-amd64/jre
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      openjdk-8-jre icedtea-netx xvfb x11vnc novnc websockify openbox python3 \
      fonts-dejavu-core ca-certificates procps \
 && rm -rf /var/lib/apt/lists/* \
 && ln -sf vnc.html /usr/share/novnc/index.html

COPY java.security.override jnlp_run.py start.sh /opt/kvm/
RUN chmod 0755 /opt/kvm/start.sh /opt/kvm/jnlp_run.py \
 && update-alternatives --set java /usr/lib/jvm/java-8-openjdk-amd64/jre/bin/java

EXPOSE 6080
# /kvm/viewer.jnlp do agent ghi (mount read-only)
CMD ["/opt/kvm/start.sh"]
