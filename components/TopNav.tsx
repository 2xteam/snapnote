"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { clearSession } from "@/lib/session";

const nav = [
  { href: "/home", label: "Home" },
  { href: "/folders", label: "Folders" },
  { href: "/print", label: "Print" },
  { href: "/my", label: "My" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const logout = () => { clearSession(); router.replace("/"); };

  return (
    <>
      {open && <div className="topnav-backdrop" onClick={() => setOpen(false)} />}
      <nav className={`topnav ${open ? "topnav--open" : ""}`}>
        <div className="topnav-bar">
          <Link href="/home" className="topnav-logo">
            <AppIcon size={26} alt="" priority className="topnav-logo-icon" />
            SnapNote
          </Link>
          <div className="topnav-links">
            {nav.map(({ href, label }) => {
              const active = href === "/home"
                ? pathname === "/home"
                : href === "/folders"
                  ? pathname.startsWith("/folders") || pathname.startsWith("/note/")
                  : pathname === href || pathname.startsWith(`${href}/`);
              return <Link key={href} href={href} className="topnav-link" data-active={active}>{label}</Link>;
            })}
            <button type="button" onClick={logout} className="topnav-logout">Logout</button>
          </div>
          <button type="button" className={`topnav-hamburger ${open ? "topnav-hamburger--open" : ""}`} onClick={() => setOpen((o) => !o)} aria-label={open ? "메뉴 닫기" : "메뉴 열기"}>
            <span className="topnav-hamburger-line topnav-hamburger-line--1" />
            <span className="topnav-hamburger-line topnav-hamburger-line--2" />
            <span className="topnav-hamburger-line topnav-hamburger-line--3" />
          </button>
        </div>
        <div className="topnav-menu">
          {nav.map(({ href, label }) => {
            const active = href === "/home"
              ? pathname === "/home"
              : href === "/folders"
                ? pathname.startsWith("/folders") || pathname.startsWith("/note/")
                : pathname === href || pathname.startsWith(`${href}/`);
            return <Link key={href} href={href} className="topnav-menu-link" data-active={active} onClick={() => setOpen(false)}>{label}</Link>;
          })}
          <button type="button" onClick={() => { setOpen(false); logout(); }} className="topnav-logout topnav-menu-logout">Logout</button>
        </div>
      </nav>
    </>
  );
}
