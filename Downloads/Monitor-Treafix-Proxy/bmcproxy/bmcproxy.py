#!/usr/bin/env python3
"""Treafix Proxy BB - truy cap BMC/IPMI qua Traefik cho nhieu site, quan ly bang 1 giao dien web.

Chi dung thu vien chuan cua Python 3.9+, khong can pip install.

  Tren may chay web (controller):
    python3 bmcproxy.py adduser admin               # tao tai khoan quan tri
    python3 bmcproxy.py serve -c config.json        # chay giao dien web + API cho agent

  Tren moi server Traefik (agent):
    python3 bmcproxy.py agent -c agent.json         # keo cau hinh, ap dung, chay forwardAuth
    python3 bmcproxy.py agent -c agent.json --once  # dong bo 1 lan roi thoat (de thu)

Kien truc:
    controller (1 may)  <-- HTTPS + token --  agent + Traefik (moi site 1 server)
                                               trinh duyet -> Traefik :cong -> forwardAuth
                                               (agent 127.0.0.1:9444) -> dich vu auth-token -> BMC
"""

import argparse
import getpass
import os
import sys

APP_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, APP_DIR)
# Ma nguon chia thu muc (common/ controller/ agent/); goi cai dat (dist/) thi moi file nam phang canh bmcproxy.py
for _d in ("agent", "controller", "common"):
    if os.path.isdir(os.path.join(APP_DIR, _d)):
        sys.path.insert(0, os.path.join(APP_DIR, _d))

from gw_common import RE_USER, ROLES, hash_password  # noqa: E402


def main():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    ap = argparse.ArgumentParser(description="Treafix Proxy BB (Traefik, nhiều site)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("serve", help="chạy controller (giao diện web)")
    s.add_argument("-c", "--config", default=os.path.join(APP_DIR, "config.json"))

    u = sub.add_parser("adduser", help="tạo / đổi mật khẩu tài khoản web")
    u.add_argument("name")
    u.add_argument("--role", choices=ROLES, default="admin")
    u.add_argument("--reset-2fa", action="store_true", help="tắt xác thực 2 lớp (mất điện thoại)")
    u.add_argument("--unlock", action="store_true", help="mở khoá + bỏ ngày hết hạn")
    u.add_argument("-c", "--config", default=os.path.join(APP_DIR, "config.json"))

    a = sub.add_parser("agent", help="chạy agent trên server Traefik")
    a.add_argument("-c", "--config", default=os.path.join(APP_DIR, "agent.json"))
    a.add_argument("--once", action="store_true", help="đồng bộ 1 lần rồi thoát")

    args = ap.parse_args()

    if args.cmd == "agent":
        from gw_agent import Agent, load_agent_config
        Agent(load_agent_config(args.config)).run(once=args.once)
        return

    try:
        from gw_controller import Store, load_controller_config, serve
    except ImportError:
        sys.exit("Đây là gói AGENT (backend), không có web. Lệnh 'serve' / 'adduser' dùng gói bmc-gateway-web.")
    store = Store(load_controller_config(args.config))
    if args.cmd == "serve":
        serve(store)
    elif args.cmd == "adduser":
        if not RE_USER.match(args.name):
            sys.exit("Tên chỉ gồm chữ, số, . _ -")
        pw = getpass.getpass("Mật khẩu (>=10 ký tự): ")
        if len(pw) < 10 or pw != getpass.getpass("Nhập lại: "):
            sys.exit("Mật khẩu quá ngắn hoặc không khớp")
        existed = args.name in store.users
        rec = store.users.get(args.name, {})
        rec.update(hash_password(pw))
        rec.pop("must_change", None)
        if args.reset_2fa:
            rec.pop("totp_secret", None)
            rec.pop("totp_pending", None)
        if args.unlock:
            rec.pop("disabled", None)
            rec["expires"] = ""
        if not existed:
            rec.update(role=args.role, sites=[])
        store.users[args.name] = rec
        store.save("users.json")
        store.audit("cli", "adduser", f"{args.name} ({rec['role']})" + (" tắt 2FA" if args.reset_2fa else "")
                    + (" mở khoá" if args.unlock else ""))
        print(f"Đã lưu tài khoản {args.name} ({rec['role']})")


if __name__ == "__main__":
    main()
