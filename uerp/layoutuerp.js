/**
 * UNIMERCE U-ERP Layout Engine
 * File: layoutuerp.js
 *
 * Responsibility:
 * - Authentication Guard (Immediate redirect if unauthenticated)
 * - Header behavior
 * - Navigation state
 * - Mobile menu
 * - Dropdown control
 * - Layout initialization
 *
 * Loaded after uerpheader.html injection
 */

// ====================================================
// 🔐 UERP Authentication Guard (ทำงานทันทีเมื่อโหลดไฟล์)
// ====================================================
(function checkUerpAuth() {
    const AUTH_KEY = "uerp_auth_token";
    const AUTH_TIME_KEY = "uerp_auth_timestamp";
    const EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // จำไว้ 7 วัน (ปรับระยะเวลาได้ตามต้องการ)

    const currentPath = window.location.pathname.toLowerCase();
    const isLoginPage = currentPath.includes('/uerp/login');

    const token = localStorage.getItem(AUTH_KEY);
    const loginTime = localStorage.getItem(AUTH_TIME_KEY);
    const now = Date.now();

    const isAuthenticated = token && loginTime && (now - parseInt(loginTime, 10) < EXPIRE_MS);

    // ถ้าไม่มี Token หรือ Token หมดอายุ และไม่ได้อยู่ที่หน้า Login
    if (!isAuthenticated && !isLoginPage) {
        // บล็อกไม่ให้หน้าเว็บแอบแสดงผล/ดึงข้อมูลก่อนโดนดีด
        document.documentElement.style.display = 'none';

        // บันทึก URL ปัจจุบันไว้ เพื่อส่งกลับมาหน้านี้หลัง Login สำเร็จ
        localStorage.setItem("uerp_redirect_target", window.location.href);

        // เด้งส่งผู้ใช้ไปหน้า Login ทันที
        window.location.replace("/uerp/login");
    }
})();

// ====================================================
// 🚀 UERP Layout Engine Core
// ====================================================
(function(){
    "use strict";

    console.log(
        "%c UERP Layout Engine Starting...",
        "color:#1a73e8;font-weight:bold;"
    );

    // ผูก Event Listener ปกติเผื่อกรณีการโหลดรูปแบบอื่น
    document.addEventListener(
        "DOMContentLoaded",
        initUerpLayout
    );

    // ถ้า script ถูกโหลดหลัง DOM ready แล้ว
    if(document.readyState === "interactive" || document.readyState === "complete"){
        initUerpLayout();
    }

    // เปิดเผยฟังก์ชันออกไปที่ Global Scope
    // เพื่อให้สคริปต์ภายนอกสามารถเรียกใช้โดยตรงได้
    window.initUerpLayout = initUerpLayout;

    function initUerpLayout(){

        // ป้องกันการทำงานซ้ำซ้อนถ้าถูกเรียกไปแล้ว
        if (window.__uerpLayoutInitialized) return;

        window.__uerpLayoutInitialized = true;

        console.log(
            "UERP Layout Init"
        );

        initMobileMenu();
        initDropdown();
        setActiveMenu();
        dispatchReadyEvent();
    }

    /**
     * Mobile Menu Toggle
     *
     * HTML expectation:
     * button: data-uerp-menu-toggle
     * menu: data-uerp-menu
     */
    function initMobileMenu(){

        const toggle = document.querySelector(
            "[data-uerp-menu-toggle]"
        );

        const menu = document.querySelector(
            "[data-uerp-menu]"
        );

        if(!toggle || !menu){

            console.log(
                "Mobile menu not found (skip)"
            );

            return;
        }

        toggle.addEventListener(
            "click",
            function(){

                menu.classList.toggle("hidden");
                toggle.classList.toggle("active");

            }
        );

        console.log(
            "Mobile menu ready"
        );
    }

    /**
     * Dropdown Menu
     *
     * HTML:
     *
     * <button data-uerp-dropdown-toggle>
     * <div data-uerp-dropdown>
     *
     * รองรับ Sales Report Dropdown
     */
    function initDropdown(){

        const buttons = document.querySelectorAll(
            "[data-uerp-dropdown-toggle]"
        );

        if(!buttons.length){

            console.log(
                "Dropdown not found (skip)"
            );

            return;
        }

        buttons.forEach(function(btn){

            btn.addEventListener(
                "click",
                function(e){

                    e.preventDefault();
                    e.stopPropagation();

                    const target = btn.nextElementSibling;

                    if(!target){
                        return;
                    }

                    // ปิด dropdown ตัวอื่นก่อน
                    document.querySelectorAll(
                        "[data-uerp-dropdown]"
                    ).forEach(function(el){

                        if(el !== target){
                            el.classList.add("hidden");
                        }

                    });

                    // เปิด / ปิด dropdown ปัจจุบัน
                    target.classList.toggle("hidden");

                }
            );

        });

        // คลิกด้านนอก = ปิด dropdown
        document.addEventListener(
            "click",
            function(){

                document.querySelectorAll(
                    "[data-uerp-dropdown]"
                ).forEach(function(el){

                    el.classList.add("hidden");

                });

            }
        );

        // คลิกใน dropdown ไม่ให้ event ไปถึง document
        document.querySelectorAll(
            "[data-uerp-dropdown]"
        ).forEach(function(dropdown){

            dropdown.addEventListener(
                "click",
                function(e){

                    e.stopPropagation();

                }
            );

            // เมื่อเลือกเมนู ให้ปิด dropdown
            dropdown.querySelectorAll(
                "a"
            ).forEach(function(link){

                link.addEventListener(
                    "click",
                    function(){

                        dropdown.classList.add("hidden");

                    }
                );

            });

        });

        console.log(
            "Dropdown ready"
        );
    }

    /**
     * Active Menu Highlight
     * Compare current URL
     */
    function setActiveMenu(){

        const current = window.location.pathname.split("/").pop();

        document.querySelectorAll(
            "[data-uerp-link]"
        ).forEach(function(link){

            const href = link.getAttribute("href");

            if(!href) return;

            const file = href.split("/").pop();

            if(file === current){

                link.classList.add(
                    "active",
                    "text-blue-600",
                    "font-bold"
                );

            }

        });

        console.log(
            "Active menu:",
            current
        );
    }

    /**
     * Global Event
     * Other pages can listen:
     * document.addEventListener('uerp-ready', function(){})
     */
    function dispatchReadyEvent(){

        document.dispatchEvent(
            new CustomEvent(
                "uerp-ready",
                {
                    detail:{
                        time:new Date()
                    }
                }
            )
        );

        console.log(
            "%c UERP Layout Ready",
            "color:#16a34a;font-weight:bold;"
        );
    }

})();
