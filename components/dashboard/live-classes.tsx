"use client";

import { useEffect, useState } from "react";
import { ClassItem, type ClassItemData } from "../items";

/** Liste des cours avec indicateur "en cours" rafraîchi chaque minute */
export function LiveClasses({ classes }: { classes: ClassItemData[] }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="space-y-2">
      {classes.map((c) => (
        <ClassItem key={c.id} c={c} now={now} />
      ))}
    </div>
  );
}
