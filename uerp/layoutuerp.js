/**
 * UNIMERCE U-ERP Layout Engine
 * File: layoutuerp.js
 *
 * Responsibility:
 * - Header behavior
 * - Navigation state
 * - Mobile menu
 * - Dropdown control
 * - Layout initialization
 *
 * Loaded after uerpheader.html injection
 */

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

    //เปิดเผยฟังก์ชันออกไปที่ Global Scope (window) เพื่อให้สคริปต์ภายนอกสามารถเรียกใช้โดยตรงได้
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
        const toggle = document.querySelector("[data-uerp-menu-toggle]");
        const menu = document.querySelector("[data-uerp-menu]");

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
     * <button data-uerp-dropdown-toggle>
     * <div data-uerp-dropdown>
     */
    function initDropdown(){
        const buttons = document.querySelectorAll("[data-uerp-dropdown-toggle]");

        if(!buttons.length){
            return;
        }

        buttons.forEach(btn=>{
            btn.addEventListener(
                "click",
                function(e){
                    e.stopPropagation();
                    const target = btn.nextElementSibling;
                    if(target){
                        target.classList.toggle("hidden");
                    }
                }
            );
        });

        document.addEventListener(
            "click",
            function(){
                document.querySelectorAll("[data-uerp-dropdown]")
                .forEach(el=>{
                    el.classList.add("hidden");
                });
            }
        );

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

        document.querySelectorAll("[data-uerp-link]")
        .forEach(link=>{
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
