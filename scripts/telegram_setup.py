#!/usr/bin/env python3
"""
Vigilo Telegram Bot Setup Utility
Usage: python3 scripts/telegram_setup.py

- Shows pending messages (to get your chat_id after /start)
- Sends a test alert to a specific chat_id
- Sets/checks webhook
"""

import json
import sys
import os
from urllib import request

TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN") or "8783676807:AAGt1-2i3isP_LhhYXYXLm84xHxGd4hJgE0"
BASE  = f"https://api.telegram.org/bot{TOKEN}"


def tg(method, **kwargs):
    payload = json.dumps(kwargs).encode()
    req = request.Request(
        f"{BASE}/{method}",
        data=payload,
        headers={"Content-Type": "application/json"},
    )
    with request.urlopen(req, timeout=10) as r:
        return json.loads(r.read())


def get_chat_ids():
    """Fetch pending updates to find who messaged the bot."""
    result = tg("getUpdates")
    chats = {}
    for u in result.get("result", []):
        msg = u.get("message") or u.get("channel_post") or {}
        chat = msg.get("chat", {})
        if chat.get("id"):
            chats[chat["id"]] = {
                "type":     chat.get("type"),
                "name":     chat.get("first_name") or chat.get("title") or "",
                "username": chat.get("username", ""),
                "text":     msg.get("text", ""),
            }
    return chats


def send_test(chat_id):
    """Send a test outbreak alert."""
    msg = (
        "🆘 <b>TEST — Vigilo URGENT</b>\n"
        "<i>This is a test notification from Vigilo.</i>\n\n"
        "🦠 <b>Ebola virus disease</b> · <b>UG</b> · 16× spike · 84%\n"
        "   <i>Confirmed Ebola outbreak near Uganda border…</i>\n\n"
        "🚨 <b>Avian influenza</b> · <b>CN</b> · 15× spike\n"
        "   <i>H5N1 detected in Guangdong province…</i>\n\n"
        "🌐 <a href='https://vigilo.cc/app.html'>vigilo.cc</a>  · /stop to unsubscribe"
    )
    result = tg("sendMessage", chat_id=chat_id, text=msg, parse_mode="HTML",
                disable_web_page_preview=True)
    return result


def check_webhook():
    result = tg("getWebhookInfo")
    info = result.get("result", {})
    print(f"Webhook URL:    {info.get('url', '(none)')}")
    print(f"Pending updates:{info.get('pending_update_count', 0)}")
    print(f"Last error:     {info.get('last_error_message', 'none')}")
    return info


def set_webhook(url):
    result = tg("setWebhook", url=url, allowed_updates=["message", "channel_post"])
    print(f"setWebhook: {result}")


if __name__ == "__main__":
    print("=== Vigilo Telegram Setup ===\n")

    print("Bot info:")
    info = tg("getMe")["result"]
    print(f"  @{info['username']} (id={info['id']})\n")

    print("Webhook status:")
    check_webhook()
    print()

    print("Pending chat messages (send /start to @vigilocc_bot first):")
    chats = get_chat_ids()
    if chats:
        for cid, c in chats.items():
            print(f"  chat_id={cid} type={c['type']} name={c['name']} @{c['username']}")
            print(f"    last msg: {c['text']!r}")
    else:
        print("  (none yet — write /start to @vigilocc_bot then re-run)")
    print()

    # Interactive test send
    if chats:
        chat_id = list(chats.keys())[0]
        print(f"Sending test alert to chat_id={chat_id} ({list(chats.values())[0]['name']})...")
        result = send_test(chat_id)
        if result.get("ok"):
            print("  ✓ Sent successfully!")
        else:
            print(f"  ✗ Error: {result}")
    elif len(sys.argv) > 1:
        chat_id = int(sys.argv[1])
        print(f"Sending test alert to chat_id={chat_id}...")
        result = send_test(chat_id)
        print(f"  Result: {result.get('ok')} — {result.get('description', '')}")
