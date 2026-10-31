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
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab));
  });
  toggle.addEventListener("click", () => setOpen(dashboard.hidden));
  document.getElementById("closeDashboard").addEventListener("click", () => {
    setOpen(false);
    toggle.focus();
  });
  addEventListener("keydown", (event) => {
    if (event.altKey && !event.ctrlKey && !event.metaKey && !event.repeat) {
      const index = ["Digit1", "Digit2", "Digit3", "Digit4"].indexOf(event.code);
      if (index !== -1) {
        event.preventDefault();
        selectTab(tabs[index].dataset.tab);
        setOpen(true);
        tabs[index].focus();
      } else if (event.code === "KeyP") {
        event.preventDefault();
        setOpen(dashboard.hidden);
        if (dashboard.hidden) toggle.focus();
      }
    }
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
