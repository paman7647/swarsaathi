#!/usr/bin/env python3
"""
SwarSaathi Keep-Alive Utility Script
Created by Aman Kumar Pandey

A lightweight, zero-dependency Python script to ping the SwarSaathi Voice Bot API
and keep the Render free tier instance active (preventing it from sleeping).

Usage:
  python keep_alive.py --url https://lullaby-follicle-manifesto.ngrok-free.dev/api/health --interval 600
"""

import argparse
import time
import urllib.request
import urllib.error
from datetime import datetime

DEFAULT_URL = "https://lullaby-follicle-manifesto.ngrok-free.dev/api/health"
DEFAULT_INTERVAL = 600  # 10 minutes in seconds

def ping(url: str, silent: bool = False) -> bool:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not silent:
        print(f"[{timestamp}] Pinging {url} ... ", end="", flush=True)
    
    try:
        # Set a 15-second timeout for the ping request
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'SwarSaathi-KeepAlive/1.0 (Uptime-Pinger)'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            status_code = response.getcode()
            if status_code == 200:
                if not silent:
                    print("SUCCESS (200 OK)")
                return True
            else:
                if not silent:
                    print(f"FAILED (HTTP Status: {status_code})")
                return False
    except urllib.error.HTTPError as e:
        if not silent:
            print(f"FAILED (HTTP Error: {e.code} - {e.reason})")
        return False
    except urllib.error.URLError as e:
        if not silent:
            print(f"FAILED (Connection Error: {e.reason})")
        return False
    except Exception as e:
        if not silent:
            print(f"FAILED (Unexpected Error: {str(e)})")
        return False

def main():
    parser = argparse.ArgumentParser(description="Keep SwarSaathi Web App awake on Render.")
    parser.add_argument(
        "-u", "--url",
        default=DEFAULT_URL,
        help=f"The health endpoint or application URL to ping (default: {DEFAULT_URL})"
    )
    parser.add_argument(
        "-i", "--interval",
        type=int,
        default=DEFAULT_INTERVAL,
        help=f"Time interval between pings in seconds (default: {DEFAULT_INTERVAL}s / 10 minutes)"
    )
    parser.add_argument(
        "-o", "--once",
        action="store_true",
        help="Ping the URL exactly once and exit (useful for cron jobs or scheduled tasks)"
    )
    parser.add_argument(
        "-s", "--silent",
        action="store_true",
        help="Run silently and suppress standard success console output"
    )

    args = parser.parse_args()

    if args.once:
        success = ping(args.url, args.silent)
        exit(0 if success else 1)

    print(f"SwarSaathi Keep-Alive loop started.")
    print(f"Target: {args.url}")
    print(f"Interval: {args.interval} seconds (~{args.interval // 60} minutes)")
    print("Press Ctrl+C to terminate.")
    print("-" * 60)

    try:
        while True:
            ping(args.url, args.silent)
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\nKeep-Alive service stopped by user.")
    except Exception as e:
        print(f"\nKeep-Alive service encountered an error and exited: {e}")

if __name__ == "__main__":
    main()
