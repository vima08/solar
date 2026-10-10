export function setupDashboard() {
  const dashboard = document.getElementById("dashboard");
  const toggle = document.getElementById("dashboardBtn");
  const tabs = [...document.querySelectorAll("[data-tab]")];
  function setOpen(open) {
    dashboard.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
  }
  function selectTab(id) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === id;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute("aria-controls")).hidden = !selected;
    });
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
        (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[next].dataset.tab);
      tabs[next].focus();
    });
  });
  toggle.addEventListener("click", () => setOpen(dashboard.hidden));
  document.getElementById("closeDashboard").addEventListener("click", () => {
    setOpen(false);
    toggle.focus();
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.querySelector("dialog[open]")) {
      setOpen(false);
      toggle.focus();
    }
  });
  addEventListener("kosmodrom-flight-mode", (event) => {
    selectTab(event.detail ? "ship" : "route");
  });
  addEventListener("kosmodrom-open-tab", (event) => {
    selectTab(event.detail);
    setOpen(true);
  });
  setOpen(!matchMedia("(max-width: 800px)").matches);
}
