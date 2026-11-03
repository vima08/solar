export const FLYBY_DEFAULTS = { speed: 0.7, offset: 3.5, planetSpeed: 0 };
export const FLYBY_PRESETS = [
  { id: "turn", name: "Поворот", ...FLYBY_DEFAULTS },
  { id: "boost", name: "Разгон", speed: 0.7, offset: 3.5, planetSpeed: -0.4 },
  { id: "brake", name: "Торможение", speed: 0.7, offset: 3.5, planetSpeed: 0.4 },
  { id: "danger", name: "Опасное сближение", speed: 0.6, offset: 1.2, planetSpeed: 0 },
];

function circleFraction(p, q, radius, entry) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const a = dx * dx + dy * dy;
  if (a === 0) return 0;
  const b = 2 * (p.x * dx + p.y * dy);
  const c = p.x * p.x + p.y * p.y - radius * radius;
  const discriminant = Math.max(0, b * b - 4 * a * c);
  return Math.max(0, Math.min(1, (-b + (entry ? -1 : 1) * Math.sqrt(discriminant)) / (2 * a)));
}

function segmentRadius(p, q) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const squared = dx * dx + dy * dy;
  const fraction = squared ? Math.max(0, Math.min(1, -(p.x * dx + p.y * dy) / squared)) : 0;
  return Math.hypot(p.x + fraction * dx, p.y + fraction * dy);
}

export function predictFlyby(parameters = {}, options = {}) {
  const { speed, offset, planetSpeed } = { ...FLYBY_DEFAULTS, ...parameters };
  const { mu = 1, step = 0.02, maxSteps = 8000 } = options;
  if (![speed, offset, planetSpeed, mu, step].every(Number.isFinite) || speed < 0.45 || speed > 1.4 ||
      Math.abs(offset) > 6 || Math.abs(planetSpeed) > 0.5 || mu < 0 || mu > 1 || step < 0.005 || step > 0.04 ||
      !Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 8000) throw new Error("Параметры прогноза вне допустимого диапазона.");
  const initial = { x: -12, y: offset, vx: speed, vy: 0, t: 0 };
  const points = [initial];
  const radius = Math.hypot(initial.x, initial.y);
  const energy = (p) => (p.vx ** 2 + p.vy ** 2) / 2 - mu / Math.hypot(p.x, p.y);
  const momentum = (p) => p.x * p.vy - p.y * p.vx;
  const e0 = energy(initial);
  const h0 = momentum(initial);
  let energyError = 0;
  let momentumError = 0;
  let closest = radius;
  let status = "incomplete";
  let p = initial;
  // Four bounded Verlet substeps retain the requested horizon and output budget.
  const substeps = 4;
  const h = step / substeps;
  for (let i = 0; i < maxSteps * substeps; i++) {
    const r = Math.hypot(p.x, p.y);
    const ax = -mu * p.x / r ** 3;
    const ay = -mu * p.y / r ** 3;
    let q = { x: p.x + p.vx * h + ax * h ** 2 / 2, y: p.y + p.vy * h + ay * h ** 2 / 2, t: p.t + h };
    const near = segmentRadius(p, q);
    let fraction = 1;
    if (near <= 1) {
      fraction = circleFraction(p, q, 1, true);
      q.x = p.x + (q.x - p.x) * fraction;
      q.y = p.y + (q.y - p.y) * fraction;
      status = "collision";
      closest = 1;
    } else closest = Math.min(closest, near);
    let qr = Math.hypot(q.x, q.y);
    q.vx = p.vx + (ax - mu * q.x / qr ** 3) * h / 2;
    q.vy = p.vy + (ay - mu * q.y / qr ** 3) * h / 2;
    if (status !== "collision" && q.x * q.vx + q.y * q.vy > 0 && qr >= radius) {
      fraction = circleFraction(p, q, radius, false);
      q = { x: p.x + (q.x - p.x) * fraction, y: p.y + (q.y - p.y) * fraction,
        vx: p.vx + (q.vx - p.vx) * fraction, vy: p.vy + (q.vy - p.vy) * fraction, t: p.t + h * fraction };
      status = "escaped";
    } else if (status === "collision") {
      q.vx = p.vx + (ax - mu * q.x) * h * fraction / 2;
      q.vy = p.vy + (ay - mu * q.y) * h * fraction / 2;
      q.t = p.t + h * fraction;
    }
    energyError = Math.max(energyError, Math.abs(energy(q) - e0) / Math.max(Math.abs(e0), 0.01));
    momentumError = Math.max(momentumError, Math.abs(momentum(q) - h0) / Math.max(Math.abs(h0), 0.01));
    if ((i + 1) % substeps === 0 || status !== "incomplete") points.push(q);
    p = q;
    if (status !== "incomplete") break;
  }
  const escaped = status === "escaped";
  const initialStationSpeed = Math.hypot(speed, planetSpeed);
  const exitStationSpeed = escaped ? Math.hypot(p.vx, p.vy + planetSpeed) : null;
  return {
    status, points, closest, duration: p.t, initialRadius: radius,
    direct: [{ x: -12, y: offset, t: 0 }, { x: -12 + speed * p.t, y: offset, t: p.t }],
    initialRelativeSpeed: speed, exitRelativeSpeed: escaped ? Math.hypot(p.vx, p.vy) : null,
    initialStationSpeed, exitStationSpeed,
    deltaSpeed: escaped ? exitStationSpeed - initialStationSpeed : null,
    turnAngle: escaped ? Math.atan2(p.vy, p.vx) * 180 / Math.PI : null,
    energyError, momentumError,
  };
}
