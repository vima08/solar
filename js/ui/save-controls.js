import { MAX_SAVE_BYTES, parseSaveFile, serializeSave } from "../game/save-files.js";

function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function setupSaveControls(store, snapshot, bodies) {
  const status = document.getElementById("save-status");
  const recovery = document.getElementById("restoreSaveBtn");
  const warning = document.getElementById("saveWarning");
  const dialog = document.getElementById("import-dialog");
  const resetDialog = document.getElementById("reset-dialog");
  const fileInput = document.getElementById("importSaveFile");
  let pending = null;
  document.getElementById("savesBtn").addEventListener("click", () => {
    dispatchEvent(new CustomEvent("kosmodrom-open-tab", { detail: "settings" }));
    document.getElementById("save-panel").scrollIntoView({ block: "start" });
    document.getElementById("save-heading").focus({ preventScroll: true });
  });
  store.subscribe(() => {
    status.textContent = store.message;
    warning.hidden = !store.issue && !/не сохранён|недоступно|не выполнена|не сброшен/.test(store.message);
    warning.textContent = store.message;
    document.getElementById("reloadSaveBtn").hidden = store.issue !== "external";
    recovery.hidden = store.issue !== "damaged";
    document.getElementById("exportSaveBtn").textContent = store.issue ? "Скачать исходную копию" : "Скачать JSON";
  });
  document.getElementById("reloadSaveBtn").addEventListener("click", () => location.reload());
  warning.addEventListener("click", () => dispatchEvent(new CustomEvent("kosmodrom-open-tab", { detail: "settings" })));
  const exportCurrent = () => {
    snapshot();
    download(store.issue ? store.raw ?? "null" : serializeSave(store.state), store.issue ? "kosmodrom-recovery.json" : "kosmodrom-save.json");
  };
  document.getElementById("exportSaveBtn").addEventListener("click", exportCurrent);
  document.getElementById("backupSaveBtn").addEventListener("click", exportCurrent);
  document.getElementById("resetBackupBtn").addEventListener("click", exportCurrent);
  document.getElementById("resetProgressBtn").addEventListener("click", () => {
    document.getElementById("reset-error").textContent = "";
    dispatchEvent(new Event("kosmodrom-input-reset"));
    resetDialog.showModal();
  });
  document.getElementById("confirmResetBtn").addEventListener("click", () => {
    if (store.reset()) location.reload();
    else document.getElementById("reset-error").textContent = store.message;
  });
  recovery.addEventListener("click", () => { store.restore(); dispatchEvent(new Event("kosmodrom-career-change")); });
  fileInput.addEventListener("change", async () => {
    pending = null;
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
      if (file.size > MAX_SAVE_BYTES) throw new Error("Файл больше 1 МиБ.");
      const next = parseSaveFile(await file.text(), bodies);
      pending = next;
      const labels = { available: "доступен", active: "в пути", completed: "завершён" };
      document.getElementById("import-summary").textContent = `Баланс: ${next.career.credits} кр. · контракт: ${labels[next.career.contractStatus]} · образцы: ${next.samples?.length ?? 0} · планеты: ${next.exploration.planets.length}. Текущий прогресс будет заменён. После загрузки игра перезапустится.`;
      document.getElementById("import-error").textContent = "";
      dispatchEvent(new Event("kosmodrom-input-reset"));
      dialog.showModal();
    } catch (error) { status.textContent = `Файл не загружен: ${error.message}`; }
  });
  document.getElementById("confirmImportBtn").addEventListener("click", () => {
    if (!pending) return;
    if (store.importState(pending)) location.reload();
    else document.getElementById("import-error").textContent = store.message;
  });
  dialog.addEventListener("close", () => { pending = null; });
}
