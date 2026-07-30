"use client";

import { useEffect, useState } from "react";

type RemainingTime = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

function calculateRemaining(targetIso: string): RemainingTime {
  const target = new Date(targetIso).getTime();
  const totalSeconds = Math.max(0, Math.floor((target - Date.now()) / 1000));

  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export default function SalesCountdown({ targetIso }: { targetIso: string }) {
  const [remaining, setRemaining] = useState<RemainingTime | null>(null);

  useEffect(() => {
    const update = () => setRemaining(calculateRemaining(targetIso));

    update();
    const interval = window.setInterval(update, 1000);

    return () => window.clearInterval(interval);
  }, [targetIso]);

  if (!remaining) {
    return (
      <div className="rounded-[8px] border border-danger/20 bg-danger/10 p-3 text-sm font-black text-danger">
        Calculando prazo da oferta...
      </div>
    );
  }

  const units = [
    { label: "dias", value: remaining.days },
    { label: "horas", value: pad(remaining.hours) },
    { label: "min", value: pad(remaining.minutes) },
    { label: "seg", value: pad(remaining.seconds) }
  ];

  return (
    <div className="rounded-[8px] border border-danger/25 bg-danger/10 p-3">
      <p className="text-xs font-black uppercase text-danger">Preço beta termina em</p>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {units.map((unit) => (
          <div key={unit.label} className="rounded-[8px] bg-white p-2 text-center shadow-sm">
            <p className="text-lg font-black text-danger">{unit.value}</p>
            <p className="text-[10px] font-black uppercase text-ocean/50">{unit.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
