import asyncio
import aiohttp
import argparse
import random
import time
from datetime import datetime

# ==============================================================================
# CÔNG CỤ DEMO KIỂM THỬ HIỆU NĂNG WEB (WEB STRESS TESTER)
# Mục đích: Kiểm tra khả năng chịu tải và độ ổn định của Server (Demo/Testing)
# Lưu ý: Chỉ sử dụng trên website thuộc quyền sở hữu của bạn.
# ==============================================================================

# Danh sách User-Agent để mô phỏng truy cập từ nhiều trình duyệt khác nhau
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0"
]

async def fire_request(session, url, stats):
    """Gửi một request đơn lẻ và ghi lại kết quả."""
    headers = {'User-Agent': random.choice(USER_AGENTS)}
    start = time.time()
    try:
        # Timeout 10 giây để không làm treo script nếu server phản hồi chậm
        async with session.get(url, headers=headers, timeout=10) as response:
            status = response.status
            await response.read()  # Đọc nội dung để hoàn tất request
            duration = time.time() - start
            
            stats['results'].append((status, duration))
            if status == 200:
                stats['success'] += 1
            else:
                stats['errors'] += 1
    except Exception as e:
        stats['errors'] += 1
        stats['exceptions'].append(str(e))

async def main_test(url, total, concurrency):
    stats = {'success': 0, 'errors': 0, 'results': [], 'exceptions': []}
    
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Đang khởi tạo Stress Test cho: {url}")
    print(f"Cấu hình: {total} request | {concurrency} luồng đồng thời\n")

    start_time = time.time()
    
    # TCPConnector giúp quản lý số lượng kết nối tối đa cùng lúc
    connector = aiohttp.TCPConnector(limit=concurrency)
    
    async with aiohttp.ClientSession(connector=connector) as session:
        # Chia nhỏ quá trình gửi theo từng đợt để tối ưu bộ nhớ
        for i in range(0, total, concurrency):
            batch_size = min(concurrency, total - i)
            tasks = [fire_request(session, url, stats) for _ in range(batch_size)]
            await asyncio.gather(*tasks)
            print(f"Tiến độ: {i + batch_size}/{total} requests...", end='\r')

    end_time = time.time()
    total_duration = end_time - start_time
    
    # --- HIỂN THỊ BÁO CÁO ---
    print("\n\n" + "="*50)
    print("      BÁO CÁO HIỆU NĂNG WEB (STRESS TEST)")
    print("="*50)
    print(f"Tổng thời gian:    {total_duration:.2f} giây")
    print(f"Thành công (200):  {stats['success']}")
    print(f"Thất bại/Lỗi:      {stats['errors']}")
    
    if total_duration > 0:
        print(f"Tốc độ trung bình: {total / total_duration:.2f} request/giây (RPS)")
    
    if stats['results']:
        avg_lat = sum(r[1] for r in stats['results']) / len(stats['results'])
        print(f"Độ trễ trung bình: {avg_lat:.4f} giây")
    
    if stats['exceptions']:
        print("\nCác lỗi ghi nhận được (phổ biến nhất):")
        unique_errors = list(set(stats['exceptions']))[:5]
        for err in unique_errors:
            print(f" - {err}")
    print("="*50)

if __name__ == "__main__":
    # Cách chạy: python web_stress_tester.py <URL> -n <TỔNG_REQUEST> -c <ĐỒNG_THỜI>
    
    parser = argparse.ArgumentParser(description="Web Performance Demo Tool")
    parser.add_argument("url", help="URL cần kiểm tra (ví dụ: http://localhost:8000)")
    parser.add_argument("-n", "--number", type=int, default=100, help="Tổng số request (mặc định: 100)")
    parser.add_argument("-c", "--concurrency", type=int, default=10, help="Số kết nối đồng thời (mặc định: 10)")
    
    args = parser.parse_args()
    
    # Kiểm tra URL hợp lệ cơ bản
    if not args.url.startswith("http"):
        print("Lỗi: URL phải bắt đầu bằng http:// hoặc https://")
        exit(1)
        
    try:
        asyncio.run(main_test(args.url, args.number, args.concurrency))
    except KeyboardInterrupt:
        print("\n[!] Test đã bị dừng bởi người dùng.")
    except Exception as e:
        print(f"\n[!] Có lỗi xảy ra: {e}")
