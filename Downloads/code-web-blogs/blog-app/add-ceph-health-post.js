const mongoose = require("mongoose");
const { marked } = require("marked");

const MONGODB_URI = "mongodb://fixnhanh-user:9SjCWffxQk9p@103.72.99.104:27017/fixnhanh-db";

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  excerpt: { type: String },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["draft", "pending", "published", "rejected", "scheduled"], default: "draft" },
  publishedAt: { type: Date },
}, { timestamps: true });

const UserSchema = new mongoose.Schema({
  email: { type: String }
});

const Post = mongoose.models.Post || mongoose.model("Post", PostSchema);
const User = mongoose.models.User || mongoose.model("User", UserSchema);

const markdownContent = `
# Phân tích các trạng thái Sức khỏe của Ceph (Healthy, Warn, Err) & Cách khắc phục

Trong quá trình quản trị cụm lưu trữ phân tán Ceph, lệnh mà bạn sẽ gõ nhiều nhất có lẽ là **ceph -s** hoặc **ceph health detail**. Hiểu được các trạng thái báo lỗi của Ceph là chìa khóa để duy trì một hệ thống ổn định và an toàn.

Bài viết này sẽ đi sâu vào việc giải phẫu 3 cấp độ trạng thái của Ceph: **HEALTH_OK**, **HEALTH_WARN** và **HEALTH_ERR**, cùng với các nguyên nhân và phương hướng khắc phục.

---

## 1. Sơ đồ các Cấp độ Trạng thái của Ceph (Health States)

Trạng thái tổng thể của cụm Ceph được định hình bởi tình trạng của các tiến trình con bên dưới (MON, OSD, MGR, MDS) và dữ liệu (Placement Groups - PGs).

<pre><code class="language-mermaid">
graph TD
    subgraph Muc_Do_Nghiem_Trong
        OK["HEALTH_OK&lt;br&gt;(Hoat dong binh thuong)"]
        WARN["HEALTH_WARN&lt;br&gt;(Canh bao: Suy giam hieu nang / Mat du phong)"]
        ERR["HEALTH_ERR&lt;br&gt;(Loi nghiem trong: Ngung tre / Mat du lieu)"]
    end
    
    subgraph Nguyen_Nhan_Thong_Thuong
        Cause1["Tat ca OSD, MON deu Up&lt;br&gt;PGs deu Active+Clean"]
        Cause2["1 vai OSD bi sap (Down)&lt;br&gt;Dung luong dat 85% (Nearfull)&lt;br&gt;PGs dang Degraded/Recovery"]
        Cause3["Dung luong dat 95% (Full)&lt;br&gt;Mat qua nhieu OSD (Incomplete PGs)&lt;br&gt;MON bi sap qua nua (No Quorum)"]
    end
    
    OK --&gt;|Phat sinh su co| WARN
    WARN --&gt;|Su co nghiem trong hon| ERR
    
    Cause1 --&gt; OK
    Cause2 --&gt; WARN
    Cause3 --&gt; ERR
    
    classDef ok fill:#38a169,stroke:#9ae6b4,stroke-width:2px,color:#fff;
    classDef warn fill:#dd6b20,stroke:#fbd38d,stroke-width:2px,color:#fff;
    classDef err fill:#e53e3e,stroke:#feb2b2,stroke-width:2px,color:#fff;
    classDef cause fill:#4a5568,stroke:#a0aec0,stroke-width:2px,color:#fff;
    
    class OK ok;
    class WARN warn;
    class ERR err;
    class Cause1,Cause2,Cause3 cause;
</code></pre>

---

## 2. HEALTH_WARN: Các cảnh báo phổ biến và Xử lý

Khi cụm chuyển sang **HEALTH_WARN**, hệ thống vẫn phục vụ Read/Write bình thường (client không bị gián đoạn), nhưng hệ số an toàn bị giảm sút.

### a) OSD_DOWN (Một hoặc vài ổ cứng bị ngắt kết nối)
- **Biểu hiện:** **1 osds down**
- **Nguyên nhân:** Có thể do cáp lỏng, ổ cứng vật lý bị hỏng bad sector quá nặng, hoặc tiến trình OSD bị OOM (hết RAM) do kernel OOM-killer giết chết.
- **Khắc phục:** 
  1. Kiểm tra log: **journalctl -u ceph-osd@id**
  2. Start lại tiến trình: **systemctl start ceph-osd@id**
  3. Nếu ổ cứng chết vật lý, cần thay thế ổ mới.

### b) PG_DEGRADED / RECOVERY (Suy thoái / Đang phục hồi dữ liệu)
- **Biểu hiện:** **150/4500 objects degraded**
- **Nguyên nhân:** Khi 1 OSD chết, các bản sao (replica) của dữ liệu bị thiếu hụt. Ceph sẽ tự động chép dữ liệu từ các OSD còn sống sang nhau để bù đắp (Recovery).
- **Khắc phục:** Không cần can thiệp. Hãy đợi Ceph tự đồng bộ (Backfill) xong, trạng thái sẽ tự về HEALTH_OK.

### c) NEARFULL (Sắp hết dung lượng)
- **Biểu hiện:** **pool &lt;name&gt; is nearfull**
- **Nguyên nhân:** Mặc định khi cụm Ceph (hoặc 1 OSD bất kỳ) đạt 85% dung lượng, nó sẽ báo Warn.
- **Khắc phục:** Lập tức thêm ổ cứng (OSD) mới vào cụm, hoặc xóa bớt dữ liệu thừa.

---

## 3. Sơ đồ Cây Quyết định (Decision Tree) Xử lý sự cố OSD

<pre><code class="language-mermaid">
graph TD
    Start["Phat hien OSD bi DOWN"] --&gt; CheckPing{"Node chua OSD&lt;br&gt;co the Ping duoc khong?"}
    
    CheckPing --&gt;|Khong| NodeDie["Sua loi mang / Khoi dong lai Server"]
    CheckPing --&gt;|Co| CheckProc{"Tien trinh ceph-osd&lt;br&gt;co dang chay khong?"}
    
    CheckProc --&gt;|Khong| Restart["Thu chay: systemctl start ceph-osd@X"]
    CheckProc --&gt;|Co| CheckNet{"Kiem tra mang Cluster/Public&lt;br&gt;giua cac OSD co thong khong?"}
    
    Restart --&gt; DidItWork{"Start len thanh cong khong?"}
    DidItWork --&gt;|Co| EndOk["Xong. Cho Recovery"]
    DidItWork --&gt;|Khong (Loi / Crashed)| CheckDisk["Kiem tra Disk I/O (dmesg / smartctl)"]
    
    CheckDisk --&gt;|O cung chet vat ly| Replace["Thuc hien thao tac Thay the OSD moi"]
    CheckDisk --&gt;|O cung con tot| CheckRAM["Kiem tra RAM (dmesg grep oom)"]
    
    classDef start fill:#dd6b20,stroke:#fff,stroke-width:2px,color:#fff;
    classDef decision fill:#3182ce,stroke:#fff,stroke-width:2px,color:#fff;
    classDef action fill:#4a5568,stroke:#fff,stroke-width:2px,color:#fff;
    classDef endnode fill:#38a169,stroke:#fff,stroke-width:2px,color:#fff;
    
    class Start start;
    class CheckPing,CheckProc,CheckNet,DidItWork,CheckDisk decision;
    class NodeDie,Restart,Replace,CheckRAM action;
    class EndOk endnode;
</code></pre>

---

## 4. HEALTH_ERR: Sự cố Nghiêm trọng (Downtime)

Khi xuất hiện **HEALTH_ERR**, cụm Ceph có thể đã **ngừng phục vụ I/O** một phần hoặc toàn bộ.

### a) FULL (Đầy 100% dung lượng)
- **Biểu hiện:** **full flag(s) set** hoặc **1 osds full**
- **Hậu quả:** Ceph sẽ **KHÓA TOÀN BỘ GHI (Block Writes)**. Mọi máy ảo Proxmox dùng Ceph sẽ bị treo (I/O Hang) vì không thể ghi thêm dữ liệu.
- **Khắc phục:** 
  1. Tăng tạm biến **mon_osd_full_ratio** lên 0.98 để gỡ lệnh khóa tạm thời.
  2. Nhanh chóng xóa dữ liệu hoặc thêm ổ cứng.

### b) PG_INCOMPLETE / PGs_DOWN
- **Biểu hiện:** **2 pgs incomplete**
- **Hậu quả:** Một mảng dữ liệu đã bị mất TẤT CẢ các bản sao (VD: bạn cấu hình **size=3** nhưng chết cùng lúc cả 3 ổ cứng chứa mảnh đó). Client sẽ không thể đọc hay ghi vào mảnh dữ liệu đó.
- **Khắc phục:** Rất khó! Cố gắng hồi sinh bằng được 1 trong số các ổ cứng vừa chết (Sửa nguồn, cắm cáp lại). Nếu không được, bạn sẽ mất trắng phần dữ liệu đó và buộc phải can thiệp xóa PG lỗi bằng lệnh cưỡng ép.

---

## 5. Sơ đồ: Quy trình Tự phục hồi Dữ liệu của Ceph (Self-Healing)

Đặc sản của Ceph chính là khả năng tự phục hồi mà không cần con người can thiệp nếu bạn thiết kế cụm đủ tốt.

<pre><code class="language-mermaid">
sequenceDiagram
    participant OSD as OSD Bi Loi
    participant MON as Ceph Monitors
    participant MGR as Ceph Manager
    participant OSD_Khac as Cac OSD Khac

    OSD-&gt;&gt;MON: Ngung gui heartbeat (Mat ket noi)
    activate MON
    MON-&gt;&gt;MON: Danh dau OSD la DOWN
    MON-&gt;&gt;MGR: Phat canh bao HEALTH_WARN
    deactivate MON
    
    Note over MON,OSD_Khac: Sau 10 phut (mon_osd_down_out_interval)
    
    MON-&gt;&gt;MON: Danh dau OSD do la OUT (Loai khoi cum)
    
    MON-&gt;&gt;OSD_Khac: Tinh toan lai ban do CRUSH Map
    activate OSD_Khac
    OSD_Khac-&gt;&gt;OSD_Khac: Copy cheo du lieu sang nhau de bu dap (Recovery / Backfill)
    OSD_Khac--&gt;&gt;MON: Hoan tat tai tao du lieu 100%
    deactivate OSD_Khac
    
    MON-&gt;&gt;MGR: Xoa canh bao, tro ve HEALTH_OK
</code></pre>

### Kết luận
Qua các phân tích trên, quy tắc vàng khi dùng Ceph là: **Đừng bao giờ để cụm bị đầy quá 85%** và **Hãy có đủ số lượng bản sao (Size=3)**. Nếu bạn sử dụng kèm Zabbix hoặc Prometheus (như hướng dẫn ở các bài trước), hãy cài đặt rule báo động ngay khi thấy chữ **HEALTH_WARN** xuất hiện nhé!
`;

async function main() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB");
    
    let user = await User.findOne({});
    let authorId;
    if (user) {
      authorId = user._id;
    } else {
      user = await User.create({ email: "admin@fixnhanh.com", role: "admin", username: "admin" });
      authorId = user._id;
    }

    const htmlContent = marked.parse(markdownContent);

    const post = new Post({
      title: "Hiểu rõ và Khắc phục các trạng thái Health của Ceph (HEALTH_WARN, HEALTH_ERR)",
      slug: "hieu-ro-trang-thai-health-cua-ceph-warn-err-" + Date.now(),
      content: htmlContent,
      excerpt: "Bài viết giải phẫu chuyên sâu 3 cấp độ trạng thái của Ceph: HEALTH_OK, HEALTH_WARN và HEALTH_ERR. Hướng dẫn cách đọc lỗi OSD Down, PG Degraded, Nearfull, Full và cách xử lý kèm sơ đồ chi tiết.",
      author: authorId,
      status: "published",
      publishedAt: new Date()
    });

    await post.save();
    console.log("Post inserted successfully! Slug:", post.slug);
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    mongoose.connection.close();
  }
}

main();
