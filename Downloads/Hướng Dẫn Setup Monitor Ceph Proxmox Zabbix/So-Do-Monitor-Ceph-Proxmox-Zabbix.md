# Sơ đồ Kiến trúc Giám sát Ceph trên Proxmox bằng Zabbix

```mermaid
flowchart TD
    %% Định nghĩa các thành phần
    subgraph Zabbix["Zabbix Infrastructure"]
        ZS[Zabbix Server / Proxy]
    end

    subgraph Proxmox["Proxmox Cluster"]
        subgraph NodeMGR["Proxmox Node (Chạy Ceph Manager)"]
            ZA2[Zabbix Agent 2]
            MGR[Ceph Manager Module: RESTful]
            HealthScript[Bash Script: cephstatus.sh / docfile.sh]
        end
        
        subgraph CephCluster["Ceph Cluster"]
            MON[Ceph Monitors]
            OSD[Ceph OSDs]
            MDS[Ceph MDS]
        end
    end

    %% Luồng dữ liệu và kết nối
    ZS <-->|Port 10050 / Active Check| ZA2
    ZA2 -->|Ceph Plugin API Gọi tới cổng 8003| MGR
    ZA2 -.->|system.run đọc file text (Tuỳ chọn)| HealthScript
    
    MGR <-->|Truy vấn dữ liệu nội bộ| CephCluster
    HealthScript -.->|ceph health > file txt| CephCluster

    %% Ghi chú
    classDef zabbix fill:#d32f2f,stroke:#fff,stroke-width:2px,color:#fff;
    classDef proxmox fill:#e65100,stroke:#fff,stroke-width:2px,color:#fff;
    classDef ceph fill:#00796b,stroke:#fff,stroke-width:2px,color:#fff;
    
    class ZS zabbix;
    class NodeMGR,ZA2 proxmox;
    class CephCluster,MGR,MON,OSD,MDS,HealthScript ceph;
```
